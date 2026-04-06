import type { WorkEntry, DefaultSettings, CalcResult } from '../types';

export function formatCurrency(amount: number): string {
  return `¥${amount.toLocaleString('ja-JP', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// 深夜時間帯: 22:00〜翌4:00 = 1320〜1680 分
const DEEP_NIGHT_START = 22 * 60; // 1320
const DEEP_NIGHT_END   = 28 * 60; // 1680

export function calcEntry(entry: WorkEntry, def: DefaultSettings): CalcResult {
  const [sh, sm] = entry.startTime.split(':').map(Number);
  const [eh, em] = entry.endTime.split(':').map(Number);
  const startMin      = sh * 60 + sm;
  const endMin        = eh * 60 + em;
  const totalShiftMin = endMin - startMin;

  const stdHours = entry.stdHours    ?? def.standardHours;
  const rate     = entry.hourlyRate  ?? def.hourlyRate;
  const mult     = entry.overtimeMult ?? def.overtimeMultiplier;

  // すべて整数分で計算し、最後だけ時間に変換（浮動小数点誤差を防ぐ）
  const workMin = Math.max(0, totalShiftMin - entry.breakMinutes);

  // 深夜帯との生の重複（分）
  const rawDeepNightMin = Math.max(
    0,
    Math.min(endMin, DEEP_NIGHT_END) - Math.max(startMin, DEEP_NIGHT_START)
  );

  // 休憩は深夜外の時間に優先して充当し、余りだけ深夜帯から引く
  const nonDeepNightShiftMin = totalShiftMin - rawDeepNightMin;
  const deepNightBreakMin    = Math.max(0, entry.breakMinutes - nonDeepNightShiftMin);
  const deepNightMin         = Math.max(0, rawDeepNightMin - deepNightBreakMin);

  // 深夜以外の労働分で所定内/時間外を算出（整数分で引き算するので誤差なし）
  const nonDeepNightMin = Math.max(0, workMin - deepNightMin);
  const stdMin          = Math.round(stdHours * 60);
  const regularMin      = Math.min(nonDeepNightMin, stdMin);
  const overtimeMin     = Math.max(0, nonDeepNightMin - stdMin);

  // 時間に変換（表示・給与計算用）
  const workHours      = workMin      / 60;
  const regularHours   = regularMin   / 60;
  const overtimeHours  = overtimeMin  / 60;
  const deepNightHours = deepNightMin / 60;

  // 給与: 所定内(日中) + 時間外(日中、割増なし) + 深夜時間 × 割増
  const pay = regularHours  * rate
            + overtimeHours * rate
            + deepNightHours * rate * mult;

  return {
    workHours,
    regularHours,
    overtimeHours,
    deepNightHours,
    pay,
    transport: entry.transportFee,
    otherFee:  entry.otherFee ?? 0,
  };
}

export function calcDay(entries: WorkEntry[], def: DefaultSettings): CalcResult {
  return entries.reduce(
    (acc, e) => {
      const r = calcEntry(e, def);
      return {
        workHours:      acc.workHours      + r.workHours,
        regularHours:   acc.regularHours   + r.regularHours,
        overtimeHours:  acc.overtimeHours  + r.overtimeHours,
        deepNightHours: acc.deepNightHours + r.deepNightHours,
        pay:            acc.pay            + r.pay,
        transport:      acc.transport      + r.transport,
        otherFee:       acc.otherFee       + r.otherFee,
      };
    },
    { workHours: 0, regularHours: 0, overtimeHours: 0, deepNightHours: 0, pay: 0, transport: 0, otherFee: 0 }
  );
}
