import type { WorkEntry, DefaultSettings, EntriesMap, PaymentRule, PaymentSnapshot, ActualPaymentsMap } from '../types';
import { calcEntry } from './calc.ts';

export function todayInJapan(): string {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Tokyo' }).format(new Date());
}

function parseDate(key: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) throw new Error('勤務日が不正です。');
  const date = new Date(key + 'T00:00:00Z');
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== key) {
    throw new Error('勤務日が不正です。');
  }
  return date;
}

export function validateRule(rule: PaymentRule): void {
  if (rule.kind === 'daysAfterWork') {
    if (!Number.isInteger(rule.days) || rule.days < 0 || rule.days > 366) {
      throw new Error('振込までの日数は0〜366の整数で入力してください。');
    }
  } else if (rule.kind === 'monthly') {
    if (![rule.closingDay, rule.payDay].every(d => Number.isInteger(d) && d >= 1 && d <= 31)
      || !Number.isInteger(rule.monthOffset) || rule.monthOffset < 0 || rule.monthOffset > 2) {
      throw new Error('締め日・支払日は1〜31、支払月は当月〜翌々月で設定してください。');
    }
    if (rule.monthOffset === 0 && rule.payDay < rule.closingDay) {
      throw new Error('当月払いの支払日は締め日以降にしてください。');
    }
  } else {
    throw new Error('支払方式が不正です。');
  }
}

// 31は月末。短い月は存在する最終日に丸める。
function monthDate(year: number, month: number, day: number): Date {
  const last = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return new Date(Date.UTC(year, month, Math.min(day, last)));
}

export function paymentDate(workDate: string, rule: PaymentRule): string {
  validateRule(rule);
  const date = parseDate(workDate);
  if (rule.kind === 'daysAfterWork') {
    date.setUTCDate(date.getUTCDate() + rule.days);
    return date.toISOString().slice(0, 10);
  }
  const year = date.getUTCFullYear();
  let month = date.getUTCMonth();
  if (date > monthDate(year, month, rule.closingDay)) month++;
  return monthDate(year, month + rule.monthOffset, rule.payDay).toISOString().slice(0, 10);
}

export function snapshotPayment(dateKey: string, payerId: string | null | undefined,
  settings: DefaultSettings): PaymentSnapshot | null {
  if (!payerId) return null;
  const label = settings.paymentLabels?.find(p => p.id === payerId);
  if (!label) throw new Error('支払元ラベルが見つかりません。');
  return {
    payerId: label.id, payerName: label.name, rule: { ...label.rule },
    scheduledDate: paymentDate(dateKey, label.rule),
    overtimePremiumEnabled: label.overtimePremiumEnabled ?? false,
  };
}

export function migratePaymentSnapshots(entries: EntriesMap, settings: DefaultSettings): EntriesMap {
  return Object.fromEntries(Object.entries(entries).map(([date, list]) => [date, list.map(entry => {
    const snapshot = entry.paymentSnapshot;
    if (!snapshot) return entry;
    const label = settings.paymentLabels?.find(item => item.id === snapshot.payerId);
    const migrated: PaymentSnapshot = {
      ...snapshot,
      scheduledDate: paymentDate(date, snapshot.rule),
      overtimePremiumEnabled: snapshot.overtimePremiumEnabled
        ?? label?.overtimePremiumEnabled
        ?? false,
    };
    return JSON.stringify(migrated) === JSON.stringify(snapshot)
      ? entry
      : { ...entry, paymentSnapshot: migrated };
  })]));
}

export function monthlyPaymentSummary(entries: EntriesMap, settings: DefaultSettings, monthKey: string) {
  const workDates = new Set<string>();
  let entryCount = 0;
  let payTotal = 0;
  let withholdingTax = 0;
  let transport = 0;
  let otherFee = 0;
  for (const [workDate, list] of Object.entries(entries)) for (const entry of list) {
    if (!entry.paymentSnapshot?.scheduledDate.startsWith(monthKey)) continue;
    workDates.add(workDate);
    entryCount++;
    const result = calcEntry(entry, settings);
    payTotal += result.pay;
    withholdingTax += result.withholdingTax;
    transport += result.transport;
    otherFee += result.otherFee;
  }
  return { workDays: workDates.size, entryCount, payTotal, withholdingTax, transport, otherFee };
}

export function yearlyPaymentAnalysis(entries: EntriesMap, settings: DefaultSettings,
  actualPayments: ActualPaymentsMap, year: number) {
  return Array.from({ length: 12 }, (_, index) => {
    const monthKey = `${year}-${String(index + 1).padStart(2, '0')}`;
    const summary = monthlyPaymentSummary(entries, settings, monthKey);
    const netPay = summary.payTotal - summary.withholdingTax;
    const total = netPay + summary.transport + summary.otherFee;
    return {
      ...summary,
      monthKey,
      netPay,
      total,
      payOnly: netPay + summary.otherFee,
      actual: actualPayments[monthKey] ?? null,
    };
  });
}

export function freezeWages(entry: WorkEntry, settings: DefaultSettings): WorkEntry {
  return {
    ...entry,
    hourlyRate: entry.hourlyRate ?? settings.hourlyRate,
    stdHours: entry.stdHours ?? settings.standardHours,
    overtimeMult: entry.overtimeMult ?? settings.overtimeMultiplier,
  };
}

// 支払元が同じなら保存済み条件を維持する。条件の再適用は明示操作だけで行う。
export function prepareEntry(dateKey: string, entry: WorkEntry, settings: DefaultSettings,
  previous?: WorkEntry): WorkEntry {
  const frozen = freezeWages(entry, settings);
  const payerId = entry.payerId ?? null;
  return {
    ...frozen, payerId,
    paymentSnapshot: previous && (previous.payerId ?? null) === payerId
      ? previous.paymentSnapshot ?? null
      : snapshotPayment(dateKey, payerId, settings),
  };
}

export function freezeLegacyEntries(entries: EntriesMap, settings: DefaultSettings,
  today = todayInJapan()): EntriesMap {
  return Object.fromEntries(Object.entries(entries).map(([date, list]) => [
    date, date <= today ? list.map(e => freezeWages(e, settings)) : list,
  ]));
}

export function entriesByPaymentDate(entries: EntriesMap): EntriesMap {
  const result: EntriesMap = {};
  for (const list of Object.values(entries)) {
    for (const entry of list) {
      const date = entry.paymentSnapshot?.scheduledDate;
      if (date) (result[date] ??= []).push(entry);
    }
  }
  return result;
}

export function paymentGroups(entries: EntriesMap, settings: DefaultSettings, year: number) {
  const groups = new Map<string, { date: string; payer: string; count: number; amount: number }>();
  for (const list of Object.values(entries)) for (const entry of list) {
    const s = entry.paymentSnapshot;
    if (!s || !s.scheduledDate.startsWith(year + '-')) continue;
    const key = s.scheduledDate + ':' + s.payerId;
    const row = groups.get(key) ?? { date: s.scheduledDate, payer: s.payerName, count: 0, amount: 0 };
    const r = calcEntry(entry, settings);
    row.count++;
    row.amount += r.netPay + r.transport + r.otherFee;
    groups.set(key, row);
  }
  return [...groups.values()].sort((a, b) => a.date.localeCompare(b.date) || a.payer.localeCompare(b.payer));
}

export interface EntrySelection { dateKey: string; id: string }

// ラベルだけを変更し、適用時給・勤務内容はそのまま保持する。
// 同じラベルの保存済み条件は維持し、未設定または別ラベルにだけ現在の条件を適用。
export function assignPaymentLabel(entries: EntriesMap, selected: EntrySelection[],
  payerId: string, settings: DefaultSettings, overwrite = false): EntriesMap {
  if (!payerId || !settings.paymentLabels?.some(p => p.id === payerId)) {
    throw new Error('支払元ラベルを選択してください。');
  }
  const changed: EntriesMap = {};
  const keys = new Set(selected.map(s => JSON.stringify([s.dateKey, s.id])));
  let found = 0;
  for (const [date, list] of Object.entries(entries)) {
    let touched = false;
    const next = list.map(entry => {
      if (!keys.has(JSON.stringify([date, entry.id]))) return entry;
      found++;
      if (!overwrite && (entry.payerId || entry.paymentSnapshot)) return entry;
      if (entry.payerId === payerId && entry.paymentSnapshot) return entry;
      touched = true;
      return { ...entry, payerId, paymentSnapshot: snapshotPayment(date, payerId, settings) };
    });
    if (touched) changed[date] = next;
  }
  if (found !== keys.size) throw new Error('選択した勤務が変更・削除されています。選び直してください。');
  return changed;
}
