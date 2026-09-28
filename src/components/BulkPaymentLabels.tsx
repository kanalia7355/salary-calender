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
  const [overwrite, setOverwrite] = useState(false);
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
      && (overwrite || (!entry.payerId && !entry.paymentSnapshot)))
    .sort((a, b) => a.date.localeCompare(b.date) || a.entry.projectName.localeCompare(b.entry.projectName));
  // 絞り込み後に見えている選択だけを処理する。
  const targets = rows.filter(row => selected.includes(row.key));
  const selections = targets.map(row => ({ dateKey: row.date, id: row.entry.id }));
  let preview: ReturnType<typeof assignPaymentLabel> = {};
  let previewError = '';
  if (payerId && selections.length) {
    try { preview = assignPaymentLabel(entries, selections, payerId, settings, overwrite); }
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
      const count = await assignPaymentLabels(selections, payerId, overwrite);
      setSelected([]); setMessage(count + '件に支払元ラベルを設定しました。');
    } catch (e) { setError(e instanceof Error ? e.message : '一括保存に失敗しました。'); }
    finally { setBusy(false); }
  };

  return <details className="mb-5 rounded border border-gray-300 dark:border-gray-600 p-3">
    <summary className="font-semibold cursor-pointer">支払元ラベルをまとめて設定</summary>
    <fieldset disabled={busy} className="mt-3 space-y-3">
      <p className="text-xs text-gray-500 dark:text-gray-400">
        初期表示はラベル未設定の勤務（全年）です。絞り込んで勤務を選択し、振込予定日を確認して適用してください。
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
      <label className="flex gap-2 text-sm items-center">
        <input type="checkbox" checked={overwrite} onChange={e => { setOverwrite(e.target.checked); resetSelection(); }} />
        設定済みの勤務も表示し、別のラベルへの変更を許可する
      </label>
      <label className="block text-xs">適用する支払元ラベル
        <select className={input} value={payerId} onChange={e => { setPayerId(e.target.value); setMessage(''); }}>
          <option value="">選択してください</option>
          {labels.map(label => <option key={label.id} value={label.id}>{label.name}</option>)}
        </select>
      </label>
      {labels.length === 0 && <p className="text-sm">基本設定で支払元ラベルを作成してください。</p>}
      {overwrite && <p className="text-xs text-gray-500 dark:text-gray-400">
        別ラベルへ変更する勤務は、現在の支払条件で予定日を更新します。同じラベルの保存済み条件は維持します。
      </p>}
      <label className="flex gap-2 text-sm items-center">
        <input type="checkbox" checked={allSelected} disabled={!rows.length}
          onChange={e => setSelected(e.target.checked ? rows.map(row => row.key) : [])} />
        表示中の全{rows.length}件を選択
      </label>
      <div className="max-h-80 overflow-auto">
        <table className="w-full text-sm">
          <thead><tr><th>選択</th><th className="text-left">勤務日・案件名</th><th className="text-left">現在の支払元</th><th className="text-left">振込予定日（適用後）</th></tr></thead>
          <tbody>{rows.map(row => {
            const next = preview[row.date]?.find(e => e.id === row.entry.id);
            const currentLabel = row.entry.paymentSnapshot?.payerName
              ?? labels.find(p => p.id === row.entry.payerId)?.name ?? '未設定';
            return <tr key={row.key} className="border-t border-gray-200 dark:border-gray-700">
              <td className="p-2"><input type="checkbox" aria-label={row.date + ' ' + row.entry.projectName}
                checked={selected.includes(row.key)}
                onChange={e => setSelected(list => e.target.checked ? [...list, row.key] : list.filter(k => k !== row.key))} /></td>
              <td className="py-2">{row.date}<br />{row.entry.projectName}</td>
              <td>{currentLabel}</td>
              <td>{next?.paymentSnapshot?.scheduledDate ?? row.entry.paymentSnapshot?.scheduledDate ?? '未設定'}</td>
            </tr>;
          })}</tbody>
        </table>
        {!rows.length && <p className="text-sm py-3">条件に合う勤務はありません。</p>}
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
