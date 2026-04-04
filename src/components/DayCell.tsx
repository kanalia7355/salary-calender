import type { WorkEntry, DefaultSettings } from '../types';
import { calcEntry, formatCurrency } from '../utils/calc';

interface Props {
  day: number | null;
  dateKey: string;
  entries: WorkEntry[];
  settings: DefaultSettings;
  isToday: boolean;
  isSelected: boolean;
  dayOfWeek: number;
  onClick: () => void;
}

export default function DayCell({ day, dateKey: _dateKey, entries, settings, isToday, isSelected, dayOfWeek, onClick }: Props) {
  if (day === null) {
    return <div className="h-14 md:h-20 bg-gray-50 dark:bg-gray-900 rounded" />;
  }

  const totalPay = entries.reduce((sum, e) => sum + calcEntry(e, settings).pay + e.transportFee, 0);
  const hasEntries = entries.length > 0;

  let textColor = 'text-gray-700 dark:text-gray-200';
  if (dayOfWeek === 0) textColor = 'text-red-500 dark:text-red-400';
  if (dayOfWeek === 6) textColor = 'text-blue-500 dark:text-blue-400';

  let cellBg = 'bg-white dark:bg-gray-800';
  if (isToday) cellBg = 'bg-gray-100 dark:bg-gray-700';
  if (isSelected) cellBg = 'bg-blue-50 dark:bg-blue-950';

  let border = 'border border-gray-200 dark:border-gray-700';
  if (isSelected) border = 'border-2 border-blue-500';

  return (
    <div
      className={`h-14 md:h-20 rounded p-1 cursor-pointer ${cellBg} ${border} hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors`}
      onClick={onClick}
    >
      <div className={`text-xs md:text-sm font-medium ${textColor}`}>{day}</div>
      {hasEntries && (
        <div className="mt-0.5 md:mt-1 space-y-0.5">
          <div className="bg-green-700 rounded px-1 py-0.5 text-xs text-green-100 truncate leading-tight">
            {entries.length === 1 ? entries[0].projectName : `${entries.length}件`}
          </div>
          <div className="text-xs text-green-400 font-medium truncate">{formatCurrency(totalPay)}</div>
        </div>
      )}
    </div>
  );
}
