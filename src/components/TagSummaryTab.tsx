import { useMemo } from 'react';
import { useSalaryStore } from '../store/useSalaryStore';
import { calcEntry } from '../utils/calc';

interface Props {
  year: number;
}

const UNTAGGED = '(タグなし)';

const TAG_COLOR_CLASSES = [
  'bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-200',
  'bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-200',
  'bg-purple-100 dark:bg-purple-900/40 text-purple-800 dark:text-purple-200',
  'bg-orange-100 dark:bg-orange-900/40 text-orange-800 dark:text-orange-200',
  'bg-pink-100 dark:bg-pink-900/40 text-pink-800 dark:text-pink-200',
  'bg-teal-100 dark:bg-teal-900/40 text-teal-800 dark:text-teal-200',
  'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-800 dark:text-indigo-200',
  'bg-yellow-100 dark:bg-yellow-900/40 text-yellow-800 dark:text-yellow-200',
];

function fmt(v: number) {
  return v > 0 ? `¥${v.toLocaleString('ja-JP')}` : '—';
}

export default function TagSummaryTab({ year }: Props) {
  const { entries, settings } = useSalaryStore();

  const { tags, monthlyTagIncome, monthlyActualTotal } = useMemo(() => {
    const tagSet = new Set<string>();
    // monthlyTagIncome[monthIdx][tag] = income
    const monthlyTagIncome: Record<string, number>[] = Array.from({ length: 12 }, () => ({}));
    const monthlyActualTotal: number[] = Array.from({ length: 12 }, () => 0);

    Object.entries(entries).forEach(([dateKey, dayEntries]) => {
      if (!dateKey.startsWith(String(year))) return;
      const monthIdx = parseInt(dateKey.split('-')[1], 10) - 1;
      if (monthIdx < 0 || monthIdx > 11) return;

      dayEntries.forEach((entry) => {
        const r = calcEntry(entry, settings);
        const income = r.netPay + r.transport + r.otherFee;
        monthlyActualTotal[monthIdx] += income;

        const entryTags =
          (entry.tags ?? []).length > 0 ? entry.tags! : [UNTAGGED];

        entryTags.forEach((tag) => {
          tagSet.add(tag);
          monthlyTagIncome[monthIdx][tag] =
            (monthlyTagIncome[monthIdx][tag] ?? 0) + income;
        });
      });
    });

    // 名前タグを先にアルファベット順、タグなしを末尾
    const tags = Array.from(tagSet).sort((a, b) => {
      if (a === UNTAGGED) return 1;
      if (b === UNTAGGED) return -1;
      return a.localeCompare(b, 'ja');
    });

    return { tags, monthlyTagIncome, monthlyActualTotal };
  }, [entries, settings, year]);

  if (tags.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg p-8 text-center">
        <p className="text-gray-400 dark:text-gray-500 text-sm">
          {year}年のタグが設定された勤務記録がありません。
        </p>
        <p className="text-gray-400 dark:text-gray-500 text-xs mt-1">
          勤務登録フォームのタグ欄から追加できます。
        </p>
      </div>
    );
  }

  const yearTagTotals = tags.map((tag) =>
    monthlyTagIncome.reduce((s, m) => s + (m[tag] ?? 0), 0)
  );
  const yearActualTotal = monthlyActualTotal.reduce((s, v) => s + v, 0);

  return (
    <div className="space-y-4">
      {/* タグ凡例 */}
      <div className="flex flex-wrap gap-2">
        {tags.map((tag, i) => (
          <span
            key={tag}
            className={`text-xs px-2.5 py-1 rounded-full font-medium ${TAG_COLOR_CLASSES[i % TAG_COLOR_CLASSES.length]}`}
          >
            {tag}
          </span>
        ))}
      </div>

      {/* テーブル */}
      <div className="bg-white dark:bg-gray-800 rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 dark:border-gray-700">
              <th className="text-left px-4 py-3 text-gray-500 dark:text-gray-400 font-medium w-14">
                月
              </th>
              {tags.map((tag, i) => (
                <th key={tag} className="text-right px-4 py-3 font-medium min-w-[100px]">
                  <span
                    className={`px-2 py-0.5 rounded-full text-xs ${TAG_COLOR_CLASSES[i % TAG_COLOR_CLASSES.length]}`}
                  >
                    {tag}
                  </span>
                </th>
              ))}
              <th className="text-right px-4 py-3 text-gray-500 dark:text-gray-400 font-medium min-w-[100px]">
                合計
              </th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 12 }, (_, i) => {
              const hasData = monthlyActualTotal[i] > 0;
              return (
                <tr
                  key={i}
                  className={`border-b border-gray-100 dark:border-gray-700/50 transition-colors ${
                    hasData
                      ? 'hover:bg-gray-50 dark:hover:bg-gray-700/30'
                      : 'opacity-40'
                  }`}
                >
                  <td className="px-4 py-2.5 text-gray-600 dark:text-gray-400 font-medium">
                    {i + 1}月
                  </td>
                  {tags.map((tag) => (
                    <td
                      key={tag}
                      className="px-4 py-2.5 text-right text-gray-900 dark:text-gray-100 tabular-nums"
                    >
                      {fmt(monthlyTagIncome[i][tag] ?? 0)}
                    </td>
                  ))}
                  <td className="px-4 py-2.5 text-right font-semibold text-gray-900 dark:text-white tabular-nums">
                    {fmt(monthlyActualTotal[i])}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="bg-gray-50 dark:bg-gray-700/50 border-t-2 border-gray-200 dark:border-gray-600">
              <td className="px-4 py-3 font-semibold text-gray-700 dark:text-gray-300">
                年計
              </td>
              {yearTagTotals.map((total, i) => (
                <td
                  key={tags[i]}
                  className="px-4 py-3 text-right font-semibold text-gray-900 dark:text-white tabular-nums"
                >
                  {fmt(total)}
                </td>
              ))}
              <td className="px-4 py-3 text-right font-bold text-blue-600 dark:text-blue-400 tabular-nums">
                {fmt(yearActualTotal)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {tags.length > 1 && tags.some((t) => t !== UNTAGGED) && (
        <p className="text-xs text-gray-400 dark:text-gray-500 text-right">
          ※ 複数タグが付いた勤務は各タグ列に重複して計上されます。合計列は実際の収入合計です。
        </p>
      )}
    </div>
  );
}
