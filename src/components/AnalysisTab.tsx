import { useMemo } from 'react';
import { useSalaryStore } from '../store/useSalaryStore';
import { calcEntry } from '../utils/calc';

interface Props {
  year: number;
}

const MONTH_LABELS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'];

function niceMax(value: number): number {
  if (value === 0) return 100000;
  const mag = Math.pow(10, Math.floor(Math.log10(value)));
  return Math.ceil(value / mag) * mag;
}

function formatYLabel(value: number): string {
  if (value === 0) return '0';
  if (value >= 10000) return `${(value / 10000).toFixed(0)}万`;
  return `${value.toLocaleString()}`;
}

function formatBarLabel(value: number): string {
  if (value === 0) return '';
  if (value >= 10000) return `${(value / 10000).toFixed(1)}万`;
  return `${value.toLocaleString()}`;
}

interface BarChartProps {
  title: string;
  subtitle: string;
  data: number[];
  hasActual: boolean[];
  barFill: string;
  barFillDark: string;
  isDark: boolean;
}

function BarChart({ title, subtitle, data, hasActual, barFill, barFillDark, isDark }: BarChartProps) {
  const maxVal = Math.max(...data, 0);
  const yMax = niceMax(maxVal);
  const Y_TICKS = 4;

  // SVG レイアウト定数
  const W = 560;
  const H = 200;
  const PAD_L = 62;
  const PAD_R = 8;
  const PAD_T = 24;
  const PAD_B = 28;
  const chartW = W - PAD_L - PAD_R;
  const chartH = H - PAD_T - PAD_B;
  const slotW = chartW / 12;
  const barW = Math.max(slotW * 0.55, 8);

  const fillBase    = isDark ? barFillDark : barFill;
  const fillEstimate = isDark ? `${barFillDark}66` : `${barFill}55`; // 見込み値は薄く
  const textColor = isDark ? '#d1d5db' : '#374151';   // gray-300 / gray-700
  const gridColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)';
  const axisColor = isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.15)';
  const labelColor = isDark ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.4)';

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg p-4">
      <div className="mb-3">
        <div className="text-sm font-semibold text-gray-800 dark:text-gray-100">{title}</div>
        <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{subtitle}</div>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
        {/* Y軸グリッドとラベル */}
        {Array.from({ length: Y_TICKS + 1 }, (_, i) => {
          const val = (yMax / Y_TICKS) * i;
          const y = PAD_T + chartH - (val / yMax) * chartH;
          return (
            <g key={i}>
              <line
                x1={PAD_L} y1={y} x2={W - PAD_R} y2={y}
                stroke={i === 0 ? axisColor : gridColor}
                strokeWidth={i === 0 ? 1 : 1}
              />
              <text x={PAD_L - 6} y={y + 4} textAnchor="end" fontSize={10} fill={labelColor}>
                {formatYLabel(val)}
              </text>
            </g>
          );
        })}

        {/* 左軸線 */}
        <line x1={PAD_L} y1={PAD_T} x2={PAD_L} y2={PAD_T + chartH} stroke={axisColor} strokeWidth={1} />

        {/* バーと月ラベル */}
        {data.map((val, i) => {
          const barH = yMax > 0 ? (val / yMax) * chartH : 0;
          const x = PAD_L + i * slotW + (slotW - barW) / 2;
          const y = PAD_T + chartH - barH;
          const labelY = PAD_T + chartH + 16;

          return (
            <g key={i}>
              {/* バー */}
              {barH > 0 && (
                <rect x={x} y={y} width={barW} height={barH} fill={hasActual[i] ? fillBase : fillEstimate} rx={3} />
              )}
              {barH === 0 && (
                <rect x={x} y={PAD_T + chartH - 2} width={barW} height={2} fill={isDark ? '#374151' : '#e5e7eb'} rx={1} />
              )}
              {/* バー上ラベル */}
              {val > 0 && (
                <text
                  x={x + barW / 2} y={y - 5}
                  textAnchor="middle" fontSize={9} fill={textColor} opacity={0.8}
                >
                  {formatBarLabel(val)}
                </text>
              )}
              {/* 月ラベル */}
              <text x={x + barW / 2} y={labelY} textAnchor="middle" fontSize={10} fill={labelColor}>
                {MONTH_LABELS[i]}
              </text>
            </g>
          );
        })}
      </svg>
      <div className="text-right text-xs text-gray-400 dark:text-gray-600 -mt-1 pr-1">月</div>
      <div className="flex items-center gap-4 mt-2">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm" style={{ background: fillBase }} />
          <span className="text-xs text-gray-500 dark:text-gray-400">実振込額ベース</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm" style={{ background: fillEstimate }} />
          <span className="text-xs text-gray-500 dark:text-gray-400">計算見込み</span>
        </div>
      </div>
    </div>
  );
}

export default function AnalysisTab({ year }: Props) {
  const { entries, settings, actualPayments } = useSalaryStore();

  // ダークモード検出
  const isDark = document.documentElement.classList.contains('dark');

  const monthlyData = useMemo(() => {
    return Array.from({ length: 12 }, (_, i) => {
      const monthKey = `${year}-${String(i + 1).padStart(2, '0')}`;
      let payTotal = 0, withholdingTax = 0, transport = 0, otherFee = 0;

      Object.entries(entries).forEach(([dateKey, dayEntries]) => {
        if (!dateKey.startsWith(monthKey)) return;
        dayEntries.forEach((e) => {
          const r = calcEntry(e, settings);
          payTotal       += r.pay;
          withholdingTax += r.withholdingTax;
          transport      += r.transport;
          otherFee       += r.otherFee;
        });
      });

      const netPay = payTotal - withholdingTax;
      const actual = actualPayments[monthKey] ?? null;

      // 実振込額が登録済みの場合はそちらを優先。
      // 交通費は入力済みの確定値なので実振込額から差し引いて給与分を算出する。
      const total   = actual !== null ? actual : netPay + transport + otherFee;
      const payOnly = actual !== null ? actual - transport : netPay + otherFee;

      return { total, payOnly, hasActual: actual !== null };
    });
  }, [entries, settings, actualPayments, year]);

  const totalData    = monthlyData.map((d) => d.total);
  const payOnlyData  = monthlyData.map((d) => d.payOnly);
  const hasActualArr = monthlyData.map((d) => d.hasActual);

  const yearTotal   = totalData.reduce((s, v) => s + v, 0);
  const yearPayOnly = payOnlyData.reduce((s, v) => s + v, 0);

  return (
    <div className="space-y-5">
      {/* 年間サマリー */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white dark:bg-gray-800 rounded-lg p-3">
          <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">年間収入合計</div>
          <div className="text-lg font-bold text-gray-900 dark:text-white">
            ¥{yearTotal.toLocaleString('ja-JP')}
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg p-3">
          <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">年間収入（交通費除く）</div>
          <div className="text-lg font-bold text-gray-900 dark:text-white">
            ¥{yearPayOnly.toLocaleString('ja-JP')}
          </div>
        </div>
      </div>

      {/* グラフ2本 */}
      <BarChart
        title="月別収入（合計）"
        subtitle="手取り給与 ＋ 交通費 ＋ その他費用　※実振込額登録済みの月はその値を使用"
        data={totalData}
        hasActual={hasActualArr}
        barFill="#2563eb"
        barFillDark="#3b82f6"
        isDark={isDark}
      />
      <BarChart
        title="月別収入（交通費除く）"
        subtitle="手取り給与 ＋ その他費用　※実振込額登録済みの月は（実振込額 − 交通費）"
        data={payOnlyData}
        hasActual={hasActualArr}
        barFill="#059669"
        barFillDark="#10b981"
        isDark={isDark}
      />
    </div>
  );
}
