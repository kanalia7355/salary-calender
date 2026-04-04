import { useState } from 'react';
import { useSalaryStore } from '../store/useSalaryStore';
import { calcEntry, formatCurrency } from '../utils/calc';

interface Props {
  year: number;
}

const MONTH_LABELS = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];

export default function YearlySummary({ year }: Props) {
  const { entries, settings, actualPayments, setActualPayment } = useSalaryStore();
  // editingMonth: 編集中の月キー ("YYYY-MM") or null
  const [editingMonth, setEditingMonth] = useState<string | null>(null);
  const [inputValue, setInputValue] = useState('');

  const rows = MONTH_LABELS.map((label, i) => {
    const month = i + 1;
    const monthKey = `${year}-${String(month).padStart(2, '0')}`;

    let days = 0;
    let expectedPay = 0;
    let expectedTransport = 0;

    Object.entries(entries).forEach(([dateKey, dayEntries]) => {
      if (!dateKey.startsWith(monthKey)) return;
      if (dayEntries.length === 0) return;
      days++;
      dayEntries.forEach((e) => {
        const r = calcEntry(e, settings);
        expectedPay += r.pay;
        expectedTransport += r.transport;
      });
    });

    const expected = expectedPay + expectedTransport;
    const actual = actualPayments[monthKey] ?? null;
    const diff = actual !== null ? actual - expected : null;

    return { label, monthKey, days, expected, actual, diff };
  });

  const totalExpected = rows.reduce((s, r) => s + r.expected, 0);
  const totalActual = rows.reduce((s, r) => s + (r.actual ?? 0), 0);
  const registeredCount = rows.filter((r) => r.actual !== null).length;

  const startEdit = (monthKey: string, current: number | null) => {
    setEditingMonth(monthKey);
    setInputValue(current !== null ? String(current) : '');
  };

  const commitEdit = (monthKey: string) => {
    const amount = parseInt(inputValue, 10);
    if (!isNaN(amount) && amount >= 0) {
      setActualPayment(monthKey, amount);
    }
    setEditingMonth(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent, monthKey: string) => {
    if (e.key === 'Enter') commitEdit(monthKey);
    if (e.key === 'Escape') setEditingMonth(null);
  };

  return (
    <div>
      {/* 年次サマリーカード */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-2 md:gap-3 mb-5">
        <div className="bg-gray-800 rounded-lg p-3">
          <div className="text-xs text-gray-400 mb-0.5">年間給与見込み</div>
          <div className="text-sm md:text-lg font-bold text-white">{formatCurrency(totalExpected)}</div>
        </div>
        <div className="bg-blue-600 rounded-lg p-3">
          <div className="text-xs text-gray-200 mb-0.5">実振込額合計 ({registeredCount}ヶ月)</div>
          <div className="text-sm md:text-lg font-bold text-white">{formatCurrency(totalActual)}</div>
        </div>
        <div className={`rounded-lg p-3 col-span-2 md:col-span-1 ${totalActual - totalExpected >= 0 ? 'bg-green-800' : 'bg-red-900'}`}>
          <div className="text-xs text-gray-300 mb-0.5">差額（実振込 − 見込み）</div>
          <div className="text-sm md:text-lg font-bold text-white">
            {registeredCount > 0
              ? `${totalActual - totalExpected >= 0 ? '+' : ''}${formatCurrency(totalActual - totalExpected)}`
              : '—'}
          </div>
        </div>
      </div>

      {/* 月別テーブル */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-gray-400 text-xs border-b border-gray-700">
              <th className="text-left py-2 pr-2 font-medium">月</th>
              <th className="text-right py-2 px-2 font-medium">勤務日数</th>
              <th className="text-right py-2 px-2 font-medium">給与見込み</th>
              <th className="text-right py-2 px-2 font-medium">実振込額</th>
              <th className="text-right py-2 pl-2 font-medium">差額</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ label, monthKey, days, expected, actual, diff }) => (
              <tr key={monthKey} className="border-b border-gray-800 hover:bg-gray-800/50 transition-colors">
                <td className="py-2 pr-2 text-gray-200 font-medium">{label}</td>
                <td className="py-2 px-2 text-right text-gray-400">
                  {days > 0 ? `${days}日` : <span className="text-gray-600">—</span>}
                </td>
                <td className="py-2 px-2 text-right text-white">
                  {expected > 0 ? formatCurrency(expected) : <span className="text-gray-600">—</span>}
                </td>
                <td className="py-2 px-2 text-right">
                  {editingMonth === monthKey ? (
                    <input
                      type="number"
                      autoFocus
                      className="w-28 bg-gray-700 border border-blue-500 rounded px-2 py-0.5 text-white text-sm text-right focus:outline-none"
                      value={inputValue}
                      onChange={(e) => setInputValue(e.target.value)}
                      onBlur={() => commitEdit(monthKey)}
                      onKeyDown={(e) => handleKeyDown(e, monthKey)}
                    />
                  ) : (
                    <button
                      onClick={() => startEdit(monthKey, actual)}
                      className="group flex items-center justify-end gap-1 w-full"
                    >
                      <span className={actual !== null ? 'text-white' : 'text-gray-600'}>
                        {actual !== null ? formatCurrency(actual) : '未登録'}
                      </span>
                      <span className="text-gray-600 text-xs opacity-0 group-hover:opacity-100 transition-opacity">✎</span>
                    </button>
                  )}
                </td>
                <td className="py-2 pl-2 text-right">
                  {diff !== null ? (
                    <span className={diff >= 0 ? 'text-green-400' : 'text-red-400'}>
                      {diff >= 0 ? '+' : ''}{formatCurrency(diff)}
                    </span>
                  ) : (
                    <span className="text-gray-600">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-gray-600 text-sm font-bold">
              <td className="py-2 pr-2 text-gray-300">合計</td>
              <td className="py-2 px-2 text-right text-gray-400">
                {rows.reduce((s, r) => s + r.days, 0)}日
              </td>
              <td className="py-2 px-2 text-right text-white">{formatCurrency(totalExpected)}</td>
              <td className="py-2 px-2 text-right text-white">
                {registeredCount > 0 ? formatCurrency(totalActual) : '—'}
              </td>
              <td className="py-2 pl-2 text-right">
                {registeredCount > 0 ? (
                  <span className={totalActual - totalExpected >= 0 ? 'text-green-400' : 'text-red-400'}>
                    {totalActual - totalExpected >= 0 ? '+' : ''}{formatCurrency(totalActual - totalExpected)}
                  </span>
                ) : '—'}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
      <p className="text-gray-600 text-xs mt-3">実振込額のセルをクリックして金額を入力 → Enterで確定</p>
    </div>
  );
}
