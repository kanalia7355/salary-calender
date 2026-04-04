import { useSalaryStore } from '../store/useSalaryStore';
import type { WorkEntry } from '../types';
import { calcEntry, formatCurrency } from '../utils/calc';

interface Props {
  dateKey: string;
  onAdd: () => void;
  onEdit: (entry: WorkEntry) => void;
}

export default function EntryList({ dateKey, onAdd, onEdit }: Props) {
  const { entries, settings, deleteEntry } = useSalaryStore();
  const dayEntries = entries[dateKey] ?? [];

  const totalPay = dayEntries.reduce((sum, e) => {
    const r = calcEntry(e, settings);
    return sum + r.pay + r.transport;
  }, 0);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-gray-900 dark:text-white font-semibold">{dateKey}</h2>
        <button
          onClick={onAdd}
          className="bg-blue-600 hover:bg-blue-700 text-white text-sm px-3 py-1 rounded"
        >
          ＋ 追加
        </button>
      </div>

      {dayEntries.length === 0 ? (
        <p className="text-gray-400 dark:text-gray-500 text-sm">勤務記録なし</p>
      ) : (
        <div className="space-y-2 flex-1 overflow-y-auto">
          {dayEntries.map((e) => {
            const r = calcEntry(e, settings);
            return (
              <div key={e.id} className="bg-gray-50 dark:bg-gray-800 rounded p-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-gray-900 dark:text-white font-medium text-sm">{e.projectName}</span>
                  <div className="flex gap-1">
                    <button
                      onClick={() => onEdit(e)}
                      className="text-blue-400 hover:text-blue-300 text-xs px-2 py-0.5 border border-blue-400 rounded"
                    >
                      編集
                    </button>
                    <button
                      onClick={() => deleteEntry(dateKey, e.id)}
                      className="text-red-400 hover:text-red-300 text-xs px-2 py-0.5 border border-red-400 rounded"
                    >
                      削除
                    </button>
                  </div>
                </div>
                <div className="text-gray-500 dark:text-gray-400 text-xs">
                  {e.startTime}〜{e.endTime}（休憩{e.breakMinutes}分）
                </div>
                <div className="text-green-400 text-xs mt-1">
                  {r.workHours.toFixed(2)}h / {formatCurrency(r.pay + r.transport)}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {dayEntries.length > 0 && (
        <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
          <div className="flex justify-between text-sm">
            <span className="text-gray-500 dark:text-gray-400">日次合計</span>
            <span className="text-gray-900 dark:text-white font-bold">{formatCurrency(totalPay)}</span>
          </div>
        </div>
      )}
    </div>
  );
}
