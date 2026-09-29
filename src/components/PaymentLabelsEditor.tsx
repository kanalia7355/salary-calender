import type { PaymentLabel, PaymentRule } from '../types';

interface Props {
  labels: PaymentLabel[];
  onChange: (labels: PaymentLabel[]) => void;
}

export default function PaymentLabelsEditor({ labels, onChange }: Props) {
  const inputClass = 'w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 p-2 text-sm';
  const update = (id: string, patch: Partial<PaymentLabel>) =>
    onChange(labels.map(p => p.id === id ? { ...p, ...patch } : p));
  const ruleField = (label: PaymentLabel, key: string, value: number) =>
    update(label.id, { rule: { ...label.rule, [key]: value } as PaymentRule });

  return <section className="space-y-3 text-gray-900 dark:text-white">
    <h3 className="font-semibold">支払元ラベルと支払条件</h3>
    <p className="text-xs text-gray-500 dark:text-gray-400">
      1勤務につき1つ指定します。変更は新しく条件を適用する勤務に反映されます。
      日数は暦日、土日祝の調整は行いません。31日は月末として扱います。
    </p>
    {labels.map(label => <div key={label.id} className="border border-gray-300 dark:border-gray-600 rounded p-3 space-y-2">
      <label className="block text-xs">ラベル名
        <input aria-label="支払元ラベル名" className={inputClass} value={label.name}
          onChange={e => update(label.id, { name: e.target.value })} />
      </label>
      <div className="flex items-center justify-between gap-3 rounded bg-gray-50 p-2 text-sm dark:bg-gray-900">
        <span>実働8時間超の25％割増</span>
        <button type="button" role="switch" aria-checked={label.overtimePremiumEnabled ?? false}
          aria-label={`${label.name || '支払元'}の8時間超割増`}
          onClick={() => update(label.id, { overtimePremiumEnabled: !(label.overtimePremiumEnabled ?? false) })}
          className={`relative h-6 w-11 rounded-full transition-colors ${label.overtimePremiumEnabled ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'}`}>
          <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${label.overtimePremiumEnabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
        </button>
      </div>
      <label className="block text-xs">支払方式
        <select className={inputClass} value={label.rule.kind}
          onChange={e => update(label.id, { rule: e.target.value === 'daysAfterWork'
            ? { kind: 'daysAfterWork', days: 7 }
            : { kind: 'monthly', closingDay: 31, payDay: 25, monthOffset: 1 } })}>
          <option value="daysAfterWork">勤務日の何日後</option>
          <option value="monthly">締め日・支払日指定</option>
        </select>
      </label>
      {label.rule.kind === 'daysAfterWork' ? <label className="block text-xs">勤務日の何日後（0＝当日）
        <input type="number" min="0" max="366" step="1" className={inputClass} value={label.rule.days}
          onChange={e => ruleField(label, 'days', Number(e.target.value))} />
      </label> : <div className="grid grid-cols-3 gap-2">
        <label className="text-xs">締め日
          <input type="number" min="1" max="31" step="1" className={inputClass} value={label.rule.closingDay}
            onChange={e => ruleField(label, 'closingDay', Number(e.target.value))} />
        </label>
        <label className="text-xs">支払月
          <select className={inputClass} value={label.rule.monthOffset}
            onChange={e => ruleField(label, 'monthOffset', Number(e.target.value))}>
            <option value="0">当月</option><option value="1">翌月</option><option value="2">翌々月</option>
          </select>
        </label>
        <label className="text-xs">支払日
          <input type="number" min="1" max="31" step="1" className={inputClass} value={label.rule.payDay}
            onChange={e => ruleField(label, 'payDay', Number(e.target.value))} />
        </label>
      </div>}
      <button type="button" className="text-sm text-red-600 underline dark:text-red-400"
        onClick={() => onChange(labels.filter(item => item.id !== label.id))}>この支払元ラベルを削除</button>
    </div>)}
    <button type="button" className="rounded bg-gray-100 dark:bg-gray-700 px-3 py-2 text-sm"
      onClick={() => onChange([...labels, { id: crypto.randomUUID(), name: '',
        rule: { kind: 'daysAfterWork', days: 7 }, overtimePremiumEnabled: false }])}>支払元ラベルを追加</button>
    <p className="text-xs text-gray-500 dark:text-gray-400">ラベルを削除しても、登録済み勤務と保存済みの支払条件は削除されません。</p>
  </section>;
}
