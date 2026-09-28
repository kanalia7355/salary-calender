import { useState } from 'react';
import { useSalaryStore } from '../store/useSalaryStore';
import { assignPaymentLabel } from '../utils/payments';

export default function BulkPaymentLabels() {
  const { entries, settings, assignPaymentLabels } = useSalaryStore();
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [query, setQuery] = useState('');
  const [tag, setTag] = useState('');
  const [payerId, setPayerId] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const keyOf = (date: string, id: string) => JSON.stringify([date, id]);
  const labels = settings.paymentLabels ?? [];
  const tags = [...new Set(Object.values(entries).flatMap(list => list.flatMap(e => e.tags ?? [])))].sort();
  const rows = Object.entries(entries).flatMap(([date, list]) =>
    list.map(entry => ({ date, entry, key: keyOf(date, entry.id) })))
    .filter(({ date, entry }) => (!from || date >= from) && (!to || date <= to)
      && entry.projectName.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())
      && (!tag || entry.tags?.includes(tag))
      && !entry.payerId && !entry.paymentSnapshot)
    .sort((a, b) => a.date.localeCompare(b.date) || a.entry.projectName.localeCompare(b.entry.projectName));
  // 絞り込み後に見えている選択だけを処理する。
  const targets = rows.filter(row => selected.includes(row.key));
  const selections = targets.map(row => ({ dateKey: row.date, id: row.entry.id }));
  let preview: ReturnType<typeof assignPaymentLabel> = {};
  let previewError = '';
  if (payerId && selections.length) {
    try { preview = assignPaymentLabel(entries, selections, payerId, settings, false); }
    catch (e) { previewError = e instanceof Error ? e.message : '条件を確認してください。'; }
  }
  const changed = targets.filter(row =>
    preview[row.date]?.find(e => e.id === row.entry.id) !== undefined
    && preview[row.date]?.find(e => e.id === row.entry.id) !== row.entry);
  const allSelected = rows.length > 0 && targets.length === rows.length;
  const input = 'rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 p-2 text-sm w-full';
  const resetSelection = () => { setSelected([]); setMessage(''); setError(''); };
  const apply = async () => {
    setBusy(true); setError(''); setMessage('');
    try {
      const count = await assignPaymentLabels(selections, payerId, false);
      setSelected([]); setMessage(count + '件に支払元ラベルを設定しました。');
    } catch (e) { setError(e instanceof Error ? e.message : '一括保存に失敗しました。'); }
    finally { setBusy(false); }
  };

  return <details className="mb-5 rounded border border-gray-300 dark:border-gray-600 p-3">
    <summary className="font-semibold cursor-pointer">支払元ラベルをまとめて設定</summary>
    <fieldset disabled={busy} className="mt-3 space-y-3">
      <p className="text-xs text-gray-500 dark:text-gray-400">
        ラベル未設定の勤務（全年）だけを表示します。絞り込んで勤務を選択し、振込予定日を確認して適用してください。
        時給・勤務内容は変更しません。
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <label className="text-xs">勤務日（開始）
          <input type="date" className={input} value={from} onChange={e => { setFrom(e.target.value); resetSelection(); }} />
        </label>
        <label className="text-xs">勤務日（終了）
          <input type="date" className={input} value={to} onChange={e => { setTo(e.target.value); resetSelection(); }} />
        </label>
        <label className="text-xs">案件名で検索
          <input className={input} value={query} onChange={e => { setQuery(e.target.value); resetSelection(); }} />
        </label>
        <label className="text-xs">分類用タグ
          <select className={input} value={tag} onChange={e => { setTag(e.target.value); resetSelection(); }}>
            <option value="">すべて</option>{tags.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </label>
      </div>
      <label className="block text-xs">適用する支払元ラベル
        <select className={input} value={payerId} onChange={e => { setPayerId(e.target.value); setMessage(''); }}>
          <option value="">選択してください</option>
          {labels.map(label => <option key={label.id} value={label.id}>{label.name}</option>)}
        </select>
      </label>
      {labels.length === 0 && <p className="text-sm">基本設定で支払元ラベルを作成してください。</p>}
      <label className={`flex min-h-12 items-center gap-3 rounded-lg border px-3 py-2 transition-colors ${busy || !rows.length ? 'cursor-not-allowed opacity-50' : 'cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800'} ${allSelected ? 'border-blue-400 bg-blue-50 dark:border-blue-500 dark:bg-blue-950/40' : 'border-gray-200 dark:border-gray-700'}`}>
        <input type="checkbox" className="peer sr-only" checked={allSelected} disabled={busy || !rows.length}
          ref={element => { if (element) element.indeterminate = targets.length > 0 && !allSelected; }}
          onChange={e => setSelected(e.target.checked ? rows.map(row => row.key) : [])} />
        <SelectionMark checked={allSelected} mixed={targets.length > 0 && !allSelected} />
        <span className="text-sm font-medium">表示中の全{rows.length}件を選択</span>
      </label>
      <div className="max-h-80 overflow-auto space-y-2 p-1" aria-label="ラベル未設定の勤務">
        {rows.map(row => {
          const next = preview[row.date]?.find(e => e.id === row.entry.id);
          const checked = selected.includes(row.key);
          return <label key={row.key}
            className={`flex min-h-16 items-center gap-3 rounded-xl border px-3 py-3 transition-colors ${busy ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'} ${checked ? 'border-blue-400 bg-blue-50 dark:border-blue-500 dark:bg-blue-950/40' : 'border-gray-200 bg-white hover:border-blue-300 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:hover:border-blue-600 dark:hover:bg-gray-700/60'}`}>
            <input type="checkbox" className="peer sr-only" disabled={busy}
              aria-label={row.date + ' ' + row.entry.projectName}
              checked={checked}
              onChange={e => setSelected(list => e.target.checked ? [...list, row.key] : list.filter(k => k !== row.key))} />
            <SelectionMark checked={checked} />
            <span className="min-w-0 flex-1">
              <span className="block text-xs text-gray-500 dark:text-gray-400">{row.date}</span>
              <span className="block break-words text-sm font-medium text-gray-900 dark:text-gray-100">{row.entry.projectName}</span>
            </span>
            <span className="shrink-0 text-right">
              <span className="block text-xs text-gray-500 dark:text-gray-400">振込予定日</span>
              <span className={`block text-sm ${next ? 'font-medium text-blue-700 dark:text-blue-300' : 'text-gray-400 dark:text-gray-500'}`}>
                {next?.paymentSnapshot?.scheduledDate ?? '—'}
              </span>
            </span>
          </label>;
        })}
        {!rows.length && <p className="rounded-lg bg-gray-50 p-4 text-center text-sm text-gray-500 dark:bg-gray-800 dark:text-gray-400">条件に合う未設定の勤務はありません。</p>}
      </div>
      <p className="text-sm">{targets.length}件選択・{changed.length}件変更予定</p>
      {(error || previewError) && <p role="alert" className="text-sm text-red-600">{error || previewError}</p>}
      {message && <p role="status" className="text-sm">{message}</p>}
      <button type="button" disabled={busy || !changed.length || !!previewError}
        className="rounded bg-blue-600 text-white px-4 py-2 disabled:opacity-40" onClick={apply}>
        {busy ? '保存中…' : changed.length + '件にラベルを適用'}
      </button>
    </fieldset>
  </details>;
}

function SelectionMark({ checked, mixed = false }: { checked: boolean; mixed?: boolean }) {
  return <span aria-hidden="true"
    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-blue-500 peer-focus-visible:ring-offset-2 dark:peer-focus-visible:ring-offset-gray-800 ${checked || mixed ? 'border-blue-600 bg-blue-600 text-white' : 'border-gray-300 bg-white dark:border-gray-500 dark:bg-gray-900'}`}>
    {mixed ? <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 8h8" /></svg>
      : checked ? <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m3 8 3 3 7-7" /></svg> : null}
  </span>;
}
