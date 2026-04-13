import { useState } from 'react';
import { useSalaryStore } from '../store/useSalaryStore';
import { calcEntry, formatCurrency } from '../utils/calc';

interface Props {
  year: number;
}

const MONTH_LABELS = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];

function escapeCsv(value: string | number): string {
  const s = String(value);
  return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s;
}

export default function YearlySummary({ year }: Props) {
  const { entries, settings, actualPayments, setActualPayment } = useSalaryStore();
  const [editingMonth, setEditingMonth] = useState<string | null>(null);
  const [inputValue, setInputValue] = useState('');

  const rows = MONTH_LABELS.map((label, i) => {
    const month = i + 1;
    const monthKey = `${year}-${String(month).padStart(2, '0')}`;

    let days = 0;
    let payTotal = 0;        // 総支給（交通費除く）
    let withholdingTax = 0;  // 源泉徴収合計
    let transport = 0;       // 交通費合計
    let otherFee = 0;        // その他費用合計

    Object.entries(entries).forEach(([dateKey, dayEntries]) => {
      if (!dateKey.startsWith(monthKey)) return;
      if (dayEntries.length === 0) return;
      days++;
      dayEntries.forEach((e) => {
        const r = calcEntry(e, settings);
        payTotal       += r.pay;
        withholdingTax += r.withholdingTax;
        transport      += r.transport;
        otherFee       += r.otherFee;
      });
    });

    const netPay  = payTotal - withholdingTax;          // 手取り給与（交通費除く）
    const expected = netPay + transport + otherFee;     // 給与見込み合計
    const actual = actualPayments[monthKey] ?? null;
    const diff = actual !== null ? actual - expected : null;

    return { label, monthKey, days, payTotal, withholdingTax, netPay, transport, otherFee, expected, actual, diff };
  });

  const totalExpected      = rows.reduce((s, r) => s + r.expected, 0);
  const totalActual        = rows.reduce((s, r) => s + (r.actual ?? 0), 0);
  const totalPayOnly       = rows.reduce((s, r) => s + r.payTotal, 0);
  const totalWithholding   = rows.reduce((s, r) => s + r.withholdingTax, 0);
  const registeredCount    = rows.filter((r) => r.actual !== null).length;

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

  const exportCsv = () => {
    const headers = ['月', '勤務日数', '総支給額（交通費除く）', '源泉徴収額', '手取り給与（交通費除く）', '交通費', 'その他費用', '給与見込み合計', '実振込額', '差額'];
    const dataRows = rows.map((r) => [
      r.label,
      r.days,
      Math.round(r.payTotal),
      Math.round(r.withholdingTax),
      Math.round(r.netPay),
      Math.round(r.transport),
      Math.round(r.otherFee),
      Math.round(r.expected),
      r.actual ?? '',
      r.diff !== null ? Math.round(r.diff) : '',
    ]);
    const totalRow = [
      '合計',
      rows.reduce((s, r) => s + r.days, 0),
      Math.round(totalPayOnly),
      Math.round(totalWithholding),
      Math.round(totalPayOnly - totalWithholding),
      Math.round(rows.reduce((s, r) => s + r.transport, 0)),
      Math.round(rows.reduce((s, r) => s + r.otherFee, 0)),
      Math.round(totalExpected),
      registeredCount > 0 ? Math.round(totalActual) : '',
      registeredCount > 0 ? Math.round(totalActual - totalExpected) : '',
    ];

    const csvLines = [
      `# ${year}年 給与サマリー`,
      headers.map(escapeCsv).join(','),
      ...dataRows.map((row) => row.map(escapeCsv).join(',')),
      totalRow.map(escapeCsv).join(','),
    ];

    const bom = '\uFEFF';
    const blob = new Blob([bom + csvLines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `salary_${year}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      {/* 年次サマリーカード */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-2 md:gap-3 mb-5">
        <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-3">
          <div className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">年間給与見込み</div>
          <div className="text-sm md:text-lg font-bold text-gray-900 dark:text-white">{formatCurrency(totalExpected)}</div>
        </div>
        <div className="bg-blue-600 rounded-lg p-3">
          <div className="text-xs text-gray-200 mb-0.5">実振込額合計 ({registeredCount}ヶ月)</div>
          <div className="text-sm md:text-lg font-bold text-white">{formatCurrency(totalActual)}</div>
        </div>
        <div className={`rounded-lg p-3 col-span-2 md:col-span-1 ${totalActual - totalExpected >= 0 ? 'bg-green-800' : 'bg-red-900'}`}>
          <div className="text-xs text-gray-700 dark:text-gray-300 mb-0.5">差額（実振込 − 見込み）</div>
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
            <tr className="text-gray-500 dark:text-gray-400 text-xs border-b border-gray-200 dark:border-gray-700">
              <th className="text-left py-2 pr-2 font-medium">月</th>
              <th className="text-right py-2 px-2 font-medium">勤務日数</th>
              <th className="text-right py-2 px-2 font-medium">給与見込み</th>
              <th className="text-right py-2 px-2 font-medium">実振込額</th>
              <th className="text-right py-2 pl-2 font-medium">差額</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ label, monthKey, days, expected, actual, diff }) => (
              <tr key={monthKey} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-100 dark:hover:bg-gray-800/50 transition-colors">
                <td className="py-2 pr-2 text-gray-700 dark:text-gray-200 font-medium">{label}</td>
                <td className="py-2 px-2 text-right text-gray-500 dark:text-gray-400">
                  {days > 0 ? `${days}日` : <span className="text-gray-400 dark:text-gray-600">—</span>}
                </td>
                <td className="py-2 px-2 text-right text-gray-900 dark:text-white">
                  {expected > 0 ? formatCurrency(expected) : <span className="text-gray-400 dark:text-gray-600">—</span>}
                </td>
                <td className="py-2 px-2 text-right">
                  {editingMonth === monthKey ? (
                    <input
                      type="number"
                      autoFocus
                      className="w-28 bg-white dark:bg-gray-700 border border-blue-500 rounded px-2 py-0.5 text-gray-900 dark:text-white text-sm text-right focus:outline-none"
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
                      <span className={actual !== null ? 'text-gray-900 dark:text-white' : 'text-gray-400 dark:text-gray-600'}>
                        {actual !== null ? formatCurrency(actual) : '未登録'}
                      </span>
                      <span className="text-gray-400 dark:text-gray-600 text-xs opacity-0 group-hover:opacity-100 transition-opacity">✎</span>
                    </button>
                  )}
                </td>
                <td className="py-2 pl-2 text-right">
                  {diff !== null ? (
                    <span className={diff >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>
                      {diff >= 0 ? '+' : ''}{formatCurrency(diff)}
                    </span>
                  ) : (
                    <span className="text-gray-400 dark:text-gray-600">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-gray-300 dark:border-gray-600 text-sm font-bold">
              <td className="py-2 pr-2 text-gray-600 dark:text-gray-300">合計</td>
              <td className="py-2 px-2 text-right text-gray-500 dark:text-gray-400">
                {rows.reduce((s, r) => s + r.days, 0)}日
              </td>
              <td className="py-2 px-2 text-right text-gray-900 dark:text-white">{formatCurrency(totalExpected)}</td>
              <td className="py-2 px-2 text-right text-gray-900 dark:text-white">
                {registeredCount > 0 ? formatCurrency(totalActual) : '—'}
              </td>
              <td className="py-2 pl-2 text-right">
                {registeredCount > 0 ? (
                  <span className={totalActual - totalExpected >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>
                    {totalActual - totalExpected >= 0 ? '+' : ''}{formatCurrency(totalActual - totalExpected)}
                  </span>
                ) : '—'}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="flex items-center justify-between mt-3">
        <p className="text-gray-400 dark:text-gray-600 text-xs">実振込額のセルをクリックして金額を入力 → Enterで確定</p>
        <button
          onClick={exportCsv}
          className="flex items-center gap-1.5 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 text-xs px-3 py-1.5 rounded font-medium transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
          CSV エクスポート
        </button>
      </div>
    </div>
  );
}
