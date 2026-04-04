interface Props {
  label: string;
  value: string;
  accent?: boolean;
}

export default function MetricCard({ label, value, accent }: Props) {
  return (
    <div className={`flex-1 rounded-lg p-3 ${accent ? 'bg-blue-600' : 'bg-gray-800'}`}>
      <div className="text-xs text-gray-400 mb-1">{label}</div>
      <div className={`text-lg font-bold ${accent ? 'text-white' : 'text-white'}`}>{value}</div>
    </div>
  );
}
