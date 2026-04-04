import type { WorkEntry, DefaultSettings, CalcResult } from '../types';

export function formatCurrency(amount: number): string {
  return `¥${amount.toLocaleString('ja-JP', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// 深夜時間帯: 22:00 〜 翌4:00 を分で表すと 1320 〜 1680
const DEEP_NIGHT_START = 22 * 60; // 1320
const DEEP_NIGHT_END   = 28 * 60; // 1680

export function calcEntry(entry: WorkEntry, def: DefaultSettings): CalcResult {
  const [sh, sm] = entry.startTime.split(':').map(Number);
  const [eh, em] = entry.endTime.split(':').map(Number);
  const startMin = sh * 60 + sm;
  const endMin   = eh * 60 + em;
  const totalShiftMin = endMin - startMin;
  const diffMin = totalShiftMin - entry.breakMinutes;
  const workHours = diffMin <= 0 ? 0 : diffMin / 60;

  const stdHours = entry.stdHours  ?? def.standardHours;
  const rate     = entry.hourlyRate ?? def.hourlyRate;
  const mult     = entry.overtimeMult ?? def.overtimeMultiplier;

  // 深夜時間帯との重複（分）
  const rawDeepNightMin = Math.max(
    0,
    Math.min(endMin, DEEP_NIGHT_END) - Math.max(startMin, DEEP_NIGHT_START)
  );
  // 休憩を深夜帯に比例配分して差し引く
  const deepNightBreakMin = totalShiftMin > 0
    ? entry.breakMinutes * (rawDeepNightMin / totalShiftMin)
    : 0;
  const deepNightHours = Math.max(0, rawDeepNightMin - deepNightBreakMin) / 60;

  // 深夜以外の労働時間で所定内/時間外を算出
  const nonDeepNightHours = Math.max(0, workHours - deepNightHours);
  const regularHours  = Math.min(nonDeepNightHours, stdHours);
  const overtimeHours = Math.max(0, nonDeepNightHours - stdHours);

  // 給与: 所定内(日中) + 時間外(日中) + 深夜割増
  const pay = regularHours  * rate
            + overtimeHours * rate * mult
            + deepNightHours * rate * mult;

  return {
    workHours,
    regularHours,
    overtimeHours,
    deepNightHours,
    pay,
    transport: entry.transportFee,
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
      };
    },
    { workHours: 0, regularHours: 0, overtimeHours: 0, deepNightHours: 0, pay: 0, transport: 0 }
  );
}
