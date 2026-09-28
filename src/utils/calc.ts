import type { WorkEntry, DefaultSettings, CalcResult } from '../types';

export function formatCurrency(amount: number): string {
  return `¥${amount.toLocaleString('ja-JP', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// 深夜時間帯: 22:00〜翌5:00
const DEEP_NIGHT_START = 22 * 60; // 1320
const DEEP_NIGHT_END   = 29 * 60; // 1740

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

  // 当日早朝と、当日22時〜翌5時の両方を計算する。
  const overlap = (start: number, end: number) =>
    Math.max(0, Math.min(endMin, end) - Math.max(startMin, start));
  const rawDeepNightMin = overlap(0, 5 * 60)
    + overlap(DEEP_NIGHT_START, DEEP_NIGHT_END);

  // 休憩は深夜外の時間に優先して充当し、余りだけ深夜帯から引く
  const nonDeepNightShiftMin = totalShiftMin - rawDeepNightMin;
  const deepNightBreakMin    = Math.max(0, entry.breakMinutes - nonDeepNightShiftMin);
  const deepNightMin         = Math.max(0, rawDeepNightMin - deepNightBreakMin);

  // 所定時間とは別に、深夜を含む実働8時間超を法定時間外として扱う。
  const regularMin = Math.min(workMin, Math.round(stdHours * 60));
  const overtimeMin = Math.max(0, workMin - 8 * 60);
  const workHours = workMin / 60;
  const regularHours = regularMin / 60;
  const overtimeHours = overtimeMin / 60;
  const deepNightHours = deepNightMin / 60;
  // 重複部分は加算（通常設定では25% + 25%）。
  const pay = workHours * rate + overtimeHours * rate * 0.25
    + deepNightHours * rate * (Math.max(1.25, mult) - 1);

  const withholdingTax = entry.withholdingTax ?? 0;
  const netPay = pay - withholdingTax;

  return {
    workHours,
    regularHours,
    overtimeHours,
    deepNightHours,
    pay,
    transport: entry.transportFee,
    otherFee:  entry.otherFee ?? 0,
    withholdingTax,
    netPay,
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
        pay:             acc.pay             + r.pay,
        transport:       acc.transport       + r.transport,
        otherFee:        acc.otherFee        + r.otherFee,
        withholdingTax:  acc.withholdingTax  + r.withholdingTax,
        netPay:          acc.netPay          + r.netPay,
      };
    },
    { workHours: 0, regularHours: 0, overtimeHours: 0, deepNightHours: 0, pay: 0, transport: 0, otherFee: 0, withholdingTax: 0, netPay: 0 }
  );
}
