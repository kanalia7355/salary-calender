import type { WorkEntry, DefaultSettings, CalcResult } from '../types';

export function calcEntry(entry: WorkEntry, def: DefaultSettings): CalcResult {
  const [sh, sm] = entry.startTime.split(':').map(Number);
  const [eh, em] = entry.endTime.split(':').map(Number);
  const startMin = sh * 60 + sm;
  const endMin = eh * 60 + em;
  const diffMin = endMin - startMin - entry.breakMinutes;
  const workHours = diffMin <= 0 ? 0 : diffMin / 60;

  const stdHours = entry.stdHours ?? def.standardHours;
  const rate = entry.hourlyRate ?? def.hourlyRate;
  const mult = entry.overtimeMult ?? def.overtimeMultiplier;

  const regularHours = Math.min(workHours, stdHours);
  const overtimeHours = Math.max(0, workHours - stdHours);
  const pay = regularHours * rate + overtimeHours * rate * mult;

  return {
    workHours,
    regularHours,
    overtimeHours,
    pay: Math.round(pay),
    transport: entry.transportFee,
  };
}

export function calcDay(entries: WorkEntry[], def: DefaultSettings): CalcResult {
  return entries.reduce(
    (acc, e) => {
      const r = calcEntry(e, def);
      return {
        workHours: acc.workHours + r.workHours,
        regularHours: acc.regularHours + r.regularHours,
        overtimeHours: acc.overtimeHours + r.overtimeHours,
        pay: acc.pay + r.pay,
        transport: acc.transport + r.transport,
      };
    },
    { workHours: 0, regularHours: 0, overtimeHours: 0, pay: 0, transport: 0 }
  );
}
