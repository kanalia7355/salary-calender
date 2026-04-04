interface Props {
  label: string;
  value: string;
  accent?: boolean;
}

export default function MetricCard({ label, value, accent }: Props) {
  return (
    <div className={`rounded-lg p-2.5 md:p-3 ${accent ? 'bg-blue-600' : 'bg-gray-100 dark:bg-gray-800'}`}>
      <div className="text-xs text-gray-500 dark:text-gray-400 mb-0.5 truncate">{label}</div>
      <div className="text-sm md:text-lg font-bold text-gray-900 dark:text-white truncate">{value}</div>
    </div>
  );
}
