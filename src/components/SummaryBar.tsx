import MetricCard from './MetricCard';
import { useSalaryStore } from '../store/useSalaryStore';
import { calcEntry } from '../utils/calc';

interface Props {
  year: number;
  month: number;
}

export default function SummaryBar({ year, month }: Props) {
  const { entries, settings } = useSalaryStore();
  const prefix = `${year}-${String(month).padStart(2, '0')}`;

  let days = 0;
  let totalHours = 0;
  let totalPay = 0;
  let totalTransport = 0;

  Object.entries(entries).forEach(([key, dayEntries]) => {
    if (!key.startsWith(prefix)) return;
    if (dayEntries.length === 0) return;
    days++;
    dayEntries.forEach((e) => {
      const r = calcEntry(e, settings);
      totalHours += r.workHours;
      totalPay += r.pay;
      totalTransport += r.transport;
    });
  });

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3 mb-4">
      <MetricCard label="勤務日数" value={`${days}日`} />
      <MetricCard label="総勤務時間" value={`${totalHours.toFixed(1)} h`} />
      <MetricCard label="給与合計" value={`¥${totalPay.toLocaleString()}`} />
      <MetricCard label="交通費込み総計" value={`¥${(totalPay + totalTransport).toLocaleString()}`} accent />
    </div>
  );
}
