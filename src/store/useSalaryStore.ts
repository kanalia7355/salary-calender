import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { WorkEntry, DefaultSettings, EntriesMap, ActualPaymentsMap } from '../types';
import { freezeLegacyEntries, prepareEntry, snapshotPayment, validateRule } from '../utils/payments';
import { supabase } from '../lib/supabase';

interface SalaryStore {
  entries: EntriesMap;
  settings: DefaultSettings;
  actualPayments: ActualPaymentsMap;
  loadError: string | null;
  dataReady: boolean;
  reapplyPayment: (dateKey: string, id: string) => Promise<void>;
  userId: string | null;
  setUserId: (id: string | null) => void;
  addEntry: (dateKey: string, entry: WorkEntry) => Promise<void>;
  updateEntry: (dateKey: string, entry: WorkEntry) => Promise<void>;
  deleteEntry: (dateKey: string, id: string) => void;
  updateSettings: (settings: DefaultSettings) => Promise<void>;
  setActualPayment: (monthKey: string, amount: number) => Promise<void>;
  loadFromSupabase: (userId: string) => Promise<void>;
  clearStore: () => void;
}

const DEFAULT_SETTINGS: DefaultSettings = {
  hourlyRate: 1500,
  standardHours: 8,
  overtimeMultiplier: 1.25,
  showTagTab: false,
  paymentLabels: [],
};

async function upsertEntries(userId: string, dateKey: string, data: WorkEntry[]) {
  const { error } = await supabase
    .from('entries')
    .upsert({ user_id: userId, date_key: dateKey, data, updated_at: new Date().toISOString() }, {
      onConflict: 'user_id,date_key',
    });
  if (error) throw new Error('勤務の保存に失敗しました: ' + error.message);
}

async function deleteEntriesRow(userId: string, dateKey: string) {
  const { error } = await supabase
    .from('entries')
    .delete()
    .eq('user_id', userId)
    .eq('date_key', dateKey);
  if (error) console.error('deleteEntries error:', error.message);
}

async function upsertSettings(userId: string, data: DefaultSettings) {
  const { error } = await supabase
    .from('settings')
    .upsert({ user_id: userId, data });
  if (error) throw new Error('設定の保存に失敗しました: ' + error.message);
}

async function upsertActualPayment(userId: string, monthKey: string, amount: number) {
  const { error } = await supabase
    .from('actual_payments')
    .upsert({ user_id: userId, month_key: monthKey, amount });
  if (error) throw new Error('実振込額の保存に失敗しました: ' + error.message);
}

export const useSalaryStore = create<SalaryStore>()(
  persist(
    (set, get) => ({
      entries: {},
      settings: DEFAULT_SETTINGS,
      actualPayments: {},
      loadError: null,
      dataReady: false,
      userId: null,

      setUserId: (id) => {
        if (id !== get().userId) set({ userId: id, dataReady: false, entries: {}, actualPayments: {}, settings: DEFAULT_SETTINGS });
      },

      addEntry: async (dateKey, entry) => {
        if (!get().dataReady) throw new Error('読み込み完了後に保存してください。');
        entry = prepareEntry(dateKey, entry, get().settings);
        const newEntries = {
          ...get().entries,
          [dateKey]: [...(get().entries[dateKey] ?? []), entry],
        };
        const userId = get().userId;
        if (userId) await upsertEntries(userId, dateKey, newEntries[dateKey]);
        set({ entries: newEntries });
      },

      updateEntry: async (dateKey, entry) => {
        if (!get().dataReady) throw new Error('読み込み完了後に保存してください。');
        const previous = get().entries[dateKey]?.find(e => e.id === entry.id);
        entry = prepareEntry(dateKey, entry, get().settings, previous);
        const newEntries = {
          ...get().entries,
          [dateKey]: (get().entries[dateKey] ?? []).map((e) =>
            e.id === entry.id ? entry : e
          ),
        };
        const userId = get().userId;
        if (userId) await upsertEntries(userId, dateKey, newEntries[dateKey]);
        set({ entries: newEntries });
      },

      deleteEntry: async (dateKey, id) => {
        const remaining = (get().entries[dateKey] ?? []).filter((e) => e.id !== id);
        const newEntries = { ...get().entries, [dateKey]: remaining };
        set({ entries: newEntries });
        const userId = get().userId;
        if (userId) {
          if (remaining.length === 0) {
            await deleteEntriesRow(userId, dateKey);
          } else {
            await upsertEntries(userId, dateKey, remaining);
          }
        }
      },

      reapplyPayment: async (dateKey, id) => {
        if (!get().dataReady) throw new Error('読み込み完了後に保存してください。');
        const next = (get().entries[dateKey] ?? []).map(e => e.id === id
          ? { ...e, paymentSnapshot: snapshotPayment(dateKey, e.payerId, get().settings) } : e);
        const userId = get().userId;
        if (userId) await upsertEntries(userId, dateKey, next);
        set({ entries: { ...get().entries, [dateKey]: next } });
      },

      updateSettings: async (settings) => {
        if (!get().dataReady) throw new Error('読み込み完了後に保存してください。');
        const labels = settings.paymentLabels ?? [];
        if (new Set(labels.map(p => p.name.trim())).size !== labels.length) {
          throw new Error('支払元ラベルの名前が重複しています。');
        }
        for (const label of labels) {
          if (!label.name.trim()) throw new Error('支払元ラベル名を入力してください。');
          validateRule(label.rule);
        }
        const previous = get().entries;
        const frozen = freezeLegacyEntries(previous, get().settings);
        const userId = get().userId;
        // 先に過去勤務の適用時給を永続化。失敗時は基本設定を変更しない。
        if (userId) {
          for (const [date, list] of Object.entries(frozen)) {
            if (JSON.stringify(list) !== JSON.stringify(previous[date])) await upsertEntries(userId, date, list);
          }
          await upsertSettings(userId, settings);
        }
        set({ entries: frozen, settings });
      },

      setActualPayment: async (monthKey, amount) => {
        const userId = get().userId;
        if (userId) await upsertActualPayment(userId, monthKey, amount);
        set((s) => ({ actualPayments: { ...s.actualPayments, [monthKey]: amount } }));
      },

      clearStore: () => set({ entries: {}, actualPayments: {}, settings: DEFAULT_SETTINGS, loadError: null, dataReady: false, userId: null }),

      loadFromSupabase: async (userId) => {
        try {
          const [entriesRes, settingsRes, paymentsRes] = await Promise.all([
            supabase.from('entries').select('date_key, data').eq('user_id', userId),
            supabase.from('settings').select('data').eq('user_id', userId).maybeSingle(),
            supabase.from('actual_payments').select('month_key, amount').eq('user_id', userId),
          ]);

          if (entriesRes.error) {
            console.error('load entries error:', entriesRes.error.message);
            set({ loadError: 'Supabaseへの接続に失敗しました。環境変数を確認してください。' });
            return;
          }
          if (settingsRes.error) throw settingsRes.error;
          if (paymentsRes.error) throw paymentsRes.error;

          const entries: EntriesMap = {};
          for (const row of entriesRes.data ?? []) {
            entries[row.date_key] = row.data as WorkEntry[];
          }

          const loadedSettings = settingsRes.data?.data
            ? { ...DEFAULT_SETTINGS, ...(settingsRes.data.data as DefaultSettings) }
            : DEFAULT_SETTINGS;
          const frozen = freezeLegacyEntries(entries, loadedSettings);
          for (const [date, list] of Object.entries(frozen)) {
            if (JSON.stringify(list) !== JSON.stringify(entries[date])) await upsertEntries(userId, date, list);
          }
          if (get().userId !== userId) return;
          const actualPayments: ActualPaymentsMap = {};
          for (const row of paymentsRes.data ?? []) {
            actualPayments[row.month_key] = row.amount;
          }

          set({
            entries: frozen, actualPayments, settings: loadedSettings,
            loadError: null, dataReady: true,
          });
        } catch (e) {
          console.error('loadFromSupabase error:', e);
          set({ loadError: 'Supabaseへの接続に失敗しました。環境変数を確認してください。' });
        }
      },
    }),
    {
      name: 'salary-calendar-v1',
      // loadError はlocalStorageに保存しない
      partialize: (state) => ({
        entries: state.entries,
        settings: state.settings,
        actualPayments: state.actualPayments,
        // userId・loadError はlocalStorageに保存しない
      }),
    }
  )
);
