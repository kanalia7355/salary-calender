import DayCell from './DayCell';
import { useSalaryStore } from '../store/useSalaryStore';

interface Props {
  year: number;
  month: number;
  selectedDate: string | null;
  onSelectDate: (dateKey: string) => void;
}

const DOW_LABELS = ['日', '月', '火', '水', '木', '金', '土'];

export default function Calendar({ year, month, selectedDate, onSelectDate }: Props) {
  const { entries, settings } = useSalaryStore();
  const today = new Date();

  const firstDay = new Date(year, month - 1, 1).getDay();
  const daysInMonth = new Date(year, month, 0).getDate();

  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <div>
      <div className="grid grid-cols-7 gap-1 mb-1">
        {DOW_LABELS.map((d, i) => (
          <div
            key={d}
            className={`text-center text-sm font-medium py-1 ${i === 0 ? 'text-red-400' : i === 6 ? 'text-blue-400' : 'text-gray-400'}`}
          >
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((day, i) => {
          const dateKey = day
            ? `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
            : '';
          const isToday =
            day !== null &&
            today.getFullYear() === year &&
            today.getMonth() + 1 === month &&
            today.getDate() === day;
          return (
            <DayCell
              key={i}
              day={day}
              dateKey={dateKey}
              entries={day ? (entries[dateKey] ?? []) : []}
              settings={settings}
              isToday={isToday}
              isSelected={selectedDate === dateKey}
              dayOfWeek={i % 7}
              onClick={() => day && onSelectDate(dateKey)}
            />
          );
        })}
      </div>
    </div>
  );
}
