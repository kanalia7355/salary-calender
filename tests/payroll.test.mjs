import test from 'node:test';
import assert from 'node:assert/strict';
import { calcEntry, calcDay } from '../src/utils/calc.ts';
import { assignPaymentLabel, paymentDate, prepareEntry, freezeLegacyEntries, migratePaymentSnapshots, monthlyPaymentSummary, snapshotPayment, entriesByPaymentDate, paymentGroups } from '../src/utils/payments.ts';

const settings = { hourlyRate: 1000, standardHours: 8, overtimeMultiplier: 1.25, showTagTab: false,
  paymentLabels: [
    { id: 'a', name: '会社A', rule: { kind: 'daysAfterWork', days: 7 }, overtimePremiumEnabled: true },
    { id: 'b', name: '会社B', rule: { kind: 'monthly', closingDay: 20, payDay: 25, monthOffset: 1 }, overtimePremiumEnabled: false },
  ] };
const entry = (startTime = '09:00', endTime = '18:00', extra = {}) => ({
  id: 'test', projectName: 'test', startTime, endTime, breakMinutes: 0, transportFee: 0,
  otherFee: 0, hourlyRate: null, stdHours: null, overtimeMult: null, withholdingTax: 0, ...extra,
});
for (const [name, start, end, extra, night, overtime, pay] of [
  ['8時間は割増なし', '09:00', '18:00', { breakMinutes: 60 }, 0, 0, 8000],
  ['実働9時間', '09:00', '19:00', { breakMinutes: 60 }, 0, 1, 9250],
  ['22時境界', '21:30', '22:30', {}, 0.5, 0, 1125],
  ['当日4〜5時', '04:00', '06:00', {}, 1, 0, 2250],
  ['当日0時開始', '00:00', '07:00', { breakMinutes: 45 }, 5, 0, 7500],
  ['5時以降', '05:00', '06:00', {}, 0, 0, 1000],
  ['翌5時まで', '22:00', '29:00', {}, 7, 0, 8750],
  ['深夜と残業は加算', '18:00', '29:00', { breakMinutes: 60 }, 7, 2, 12250],
  ['所定6時間', '09:00', '16:00', { stdHours: 6 }, 0, 0, 7000],
  ['所定10時間でも8時間で判定', '09:00', '19:00', { stdHours: 10 }, 0, 2, 10500],
  ['深夜内休憩', '22:00', '29:00', { breakMinutes: 60 }, 6, 0, 7500],
  ['個別時給・倍率', '18:00', '29:00', { hourlyRate: 1200, overtimeMult: 1.5 }, 7, 3, 18300],
  ['深夜倍率下限', '22:00', '23:00', { overtimeMult: 1 }, 1, 0, 1250],
  ['1分超過', '09:00', '17:01', {}, 0, 1/60, 8000 + 1250/60],
]) test(name, () => {
  const result = calcEntry(entry(start, end, { ...extra,
    paymentSnapshot: { payerId: 'a', payerName: '会社A', rule: { kind: 'daysAfterWork', days: 7 },
      scheduledDate: '2026-10-06', overtimePremiumEnabled: true } }), settings);
  assert.equal(result.deepNightHours, night);
  assert.equal(result.overtimeHours, overtime);
  assert.ok(Math.abs(result.pay - pay) < 1e-8);
});

test('費用と源泉徴収を維持', () => {
  const e = entry('09:00', '18:00', { withholdingTax: 100, transportFee: 500, otherFee: 200 });
  const r = calcDay([e, e], settings);
  assert.equal(r.netPay, 17800); assert.equal(r.transport, 1000); assert.equal(r.otherFee, 400);
});
test('支払元ラベルで8時間超の25%割増を無効化', () => {
  const withoutPremium = entry('09:00', '19:00', { breakMinutes: 60,
    paymentSnapshot: { payerId: 'b', payerName: '会社B', rule: { kind: 'daysAfterWork', days: 0 },
      scheduledDate: '2026-09-29', overtimePremiumEnabled: false } });
  assert.equal(calcEntry(withoutPremium, settings).pay, 9000);
  assert.equal(calcEntry({ ...withoutPremium, paymentSnapshot: null }, settings).pay, 9000);
});
test('旧スナップショットを勤務単位で移行し、件数と給与を維持', () => {
  const old = entry('09:00', '19:00', { id: 'old', breakMinutes: 60, payerId: 'b',
    paymentSnapshot: { payerId: 'b', payerName: '会社B',
      rule: { kind: 'monthly', closingDay: 20, payDay: 25, monthOffset: 1 },
      scheduledDate: '2026-10-25' } });
  const source = { '2026-09-21': [old] };
  const migrated = migratePaymentSnapshots(source, settings);
  assert.equal(Object.keys(migrated).length, 1);
  assert.equal(migrated['2026-09-21'].length, 1);
  assert.equal(migrated['2026-09-21'][0].paymentSnapshot.scheduledDate, '2026-11-25');
  assert.equal(migrated['2026-09-21'][0].paymentSnapshot.overtimePremiumEnabled, false);
  assert.equal(calcEntry(migrated['2026-09-21'][0], settings).pay, 9000);
  assert.deepEqual(migratePaymentSnapshots(migrated, settings), migrated);
});
test('振込月集計は振込予定日数ではなく元の勤務日数と勤務件数を数える', () => {
  const first = prepareEntry('2026-09-01', entry('09:00', '18:00', { id: '1', payerId: 'a', breakMinutes: 60 }), settings);
  const second = prepareEntry('2026-09-01', entry('18:00', '22:00', { id: '2', payerId: 'a' }), settings);
  const third = prepareEntry('2026-09-02', entry('09:00', '18:00', { id: '3', payerId: 'a', breakMinutes: 60 }), settings);
  const summary = monthlyPaymentSummary({ '2026-09-01': [first, second], '2026-09-02': [third] }, settings, '2026-09');
  assert.equal(summary.workDays, 2);
  assert.equal(summary.entryCount, 3);
});
for (const [date, rule, expected] of [
  ['2026-12-28', { kind: 'daysAfterWork', days: 7 }, '2027-01-04'],
  ['2026-09-29', { kind: 'daysAfterWork', days: 0 }, '2026-09-29'],
  ['2028-02-28', { kind: 'daysAfterWork', days: 1 }, '2028-02-29'],
  ['2026-09-20', { kind: 'monthly', closingDay: 20, payDay: 25, monthOffset: 1 }, '2026-10-25'],
  ['2026-09-21', { kind: 'monthly', closingDay: 20, payDay: 25, monthOffset: 1 }, '2026-11-25'],
  ['2026-01-31', { kind: 'monthly', closingDay: 31, payDay: 31, monthOffset: 1 }, '2026-02-28'],
  ['2028-01-31', { kind: 'monthly', closingDay: 31, payDay: 31, monthOffset: 1 }, '2028-02-29'],
  ['2026-12-21', { kind: 'monthly', closingDay: 20, payDay: 25, monthOffset: 2 }, '2027-03-25'],
  ['2026-09-15', { kind: 'monthly', closingDay: 15, payDay: 25, monthOffset: 0 }, '2026-09-25'],
]) test('支払日 ' + date + ' → ' + expected, () => assert.equal(paymentDate(date, rule), expected));

test('不正な日付・支払条件を拒否', () => {
  assert.throws(() => paymentDate('2026-02-30', { kind: 'daysAfterWork', days: 1 }));
  for (const days of [-1, 0.5, NaN, 367]) assert.throws(() => paymentDate('2026-09-29', { kind: 'daysAfterWork', days }));
  assert.throws(() => paymentDate('2026-09-29', { kind: 'monthly', closingDay: 31, payDay: 25, monthOffset: 0 }));
});
test('時給と支払条件を固定し、通常編集でも維持', () => {
  const old = prepareEntry('2026-09-29', entry('09:00', '18:00', { payerId: 'a' }), settings);
  const changed = { ...settings, hourlyRate: 2000, paymentLabels: [{ ...settings.paymentLabels[0], rule: { kind: 'daysAfterWork', days: 30 } }] };
  const edited = prepareEntry('2026-09-29', { ...old, projectName: '修正' }, changed, old);
  assert.equal(edited.hourlyRate, 1000);
  assert.equal(edited.paymentSnapshot.scheduledDate, '2026-10-06');
  assert.equal(old.paymentSnapshot.rule.days, 7);
  assert.equal(snapshotPayment('2026-09-29', 'a', changed).scheduledDate, '2026-10-29');
});
test('支払元を変更したときだけ新条件を適用', () => {
  const old = prepareEntry('2026-09-29', entry('09:00', '18:00', { payerId: 'a' }), settings);
  const changed = prepareEntry('2026-09-29', { ...old, payerId: 'b' }, settings, old);
  assert.equal(changed.paymentSnapshot.payerId, 'b');
  assert.equal(changed.paymentSnapshot.scheduledDate, '2026-11-25');
});
test('過去勤務の移行は冪等で、個別時給を維持', () => {
  const entries = { '2026-09-01': [entry(), entry('09:00', '18:00', { hourlyRate: 1500 })], '2026-10-01': [entry()] };
  const frozen = freezeLegacyEntries(entries, settings, '2026-09-29');
  assert.equal(frozen['2026-09-01'][0].hourlyRate, 1000);
  assert.equal(frozen['2026-09-01'][1].hourlyRate, 1500);
  assert.equal(frozen['2026-10-01'][0].hourlyRate, null);
  assert.equal(entries['2026-09-01'][0].hourlyRate, null);
  assert.deepEqual(freezeLegacyEntries(frozen, { ...settings, hourlyRate: 3000 }, '2026-09-29'), frozen);
});
test('年をまたぐ支払集計・未設定除外・費用と税', () => {
  const e = prepareEntry('2026-12-28', entry('09:00', '18:00', { payerId: 'a', breakMinutes: 60, withholdingTax: 100, transportFee: 500, otherFee: 200 }), settings);
  const map = { '2026-12-28': [e, entry()] };
  assert.equal(entriesByPaymentDate(map)['2027-01-04'].length, 1);
  assert.equal(paymentGroups(map, settings, 2026).length, 0);
  assert.deepEqual(paymentGroups(map, settings, 2027), [{ date: '2027-01-04', payer: '会社A', count: 1, amount: 8600 }]);
});

test('一括設定は選択した勤務だけ更新し、時給・費用・タグを維持', () => {
  const a = entry('09:00', '18:00', { id: 'a', hourlyRate: 1234, transportFee: 500, tags: ['現場'] });
  const b = entry('09:00', '18:00', { id: 'b' });
  const c = entry('22:00', '29:00', { id: 'c' });
  const original = { '2026-12-28': [a, b], '2026-12-29': [c] };
  const result = assignPaymentLabel(original, [
    { dateKey: '2026-12-28', id: 'a' }, { dateKey: '2026-12-29', id: 'c' },
  ], 'a', settings);
  assert.equal(result['2026-12-28'][0].paymentSnapshot.scheduledDate, '2027-01-04');
  assert.equal(result['2026-12-29'][0].paymentSnapshot.scheduledDate, '2027-01-05');
  assert.equal(result['2026-12-28'][0].hourlyRate, 1234);
  assert.equal(result['2026-12-28'][0].transportFee, 500);
  assert.deepEqual(result['2026-12-28'][0].tags, ['現場']);
  assert.equal(result['2026-12-28'][1], b);
  assert.equal(original['2026-12-28'][0].payerId, undefined);
});
test('一括設定は既存ラベルを既定で保護し、明示指定時のみ変更', () => {
  const e = prepareEntry('2026-09-29', entry('09:00', '18:00', { payerId: 'a' }), settings);
  const map = { '2026-09-29': [e] };
  const selection = [{ dateKey: '2026-09-29', id: e.id }];
  assert.deepEqual(assignPaymentLabel(map, selection, 'b', settings), {});
  const updated = assignPaymentLabel(map, selection, 'b', settings, true);
  assert.equal(updated['2026-09-29'][0].payerId, 'b');
  assert.equal(updated['2026-09-29'][0].paymentSnapshot.scheduledDate, '2026-11-25');
  const changedSettings = { ...settings, paymentLabels: [{ ...settings.paymentLabels[0], rule: { kind: 'daysAfterWork', days: 30 } }] };
  assert.deepEqual(assignPaymentLabel(map, selection, 'a', changedSettings, true), {});
});
test('一括設定は選択重複を許容し、不明な勤務・ラベルを拒否', () => {
  const map = { '2026-09-29': [entry()] };
  const selection = { dateKey: '2026-09-29', id: 'test' };
  assert.equal(assignPaymentLabel(map, [selection, selection], 'a', settings)['2026-09-29'].length, 1);
  assert.throws(() => assignPaymentLabel(map, [{ ...selection, id: 'deleted' }], 'a', settings));
  assert.throws(() => assignPaymentLabel(map, [selection], 'missing', settings));
  assert.deepEqual(assignPaymentLabel(map, [], 'a', settings), {});
});
