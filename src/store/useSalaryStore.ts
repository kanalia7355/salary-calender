import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { WorkEntry, DefaultSettings, EntriesMap, ActualPaymentsMap } from '../types';
import { supabase } from '../lib/supabase';

interface SalaryStore {
  entries: EntriesMap;
  settings: DefaultSettings;
  actualPayments: ActualPaymentsMap;
  loadError: string | null;
  userId: string | null;
  setUserId: (id: string | null) => void;
  addEntry: (dateKey: string, entry: WorkEntry) => void;
  updateEntry: (dateKey: string, entry: WorkEntry) => void;
  deleteEntry: (dateKey: string, id: string) => void;
  updateSettings: (settings: DefaultSettings) => void;
  setActualPayment: (monthKey: string, amount: number) => void;
  loadFromSupabase: (userId: string) => Promise<void>;
  clearStore: () => void;
}

const DEFAULT_SETTINGS: DefaultSettings = {
  hourlyRate: 1500,
  standardHours: 8,
  overtimeMultiplier: 1.25,
  showTagTab: false,
};

async function upsertEntries(userId: string, dateKey: string, data: WorkEntry[]) {
  const { error } = await supabase
    .from('entries')
    .upsert({ user_id: userId, date_key: dateKey, data, updated_at: new Date().toISOString() }, {
      onConflict: 'user_id,date_key',
    });
  if (error) console.error('upsertEntries error:', error.message);
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
  if (error) console.error('upsertSettings error:', error.message);
}

async function upsertActualPayment(userId: string, monthKey: string, amount: number) {
  const { error } = await supabase
    .from('actual_payments')
    .upsert({ user_id: userId, month_key: monthKey, amount });
  if (error) console.error('upsertActualPayment error:', error.message);
}

export const useSalaryStore = create<SalaryStore>()(
  persist(
    (set, get) => ({
      entries: {},
      settings: DEFAULT_SETTINGS,
      actualPayments: {},
      loadError: null,
      userId: null,

      setUserId: (id) => set({ userId: id }),

      addEntry: async (dateKey, entry) => {
        const newEntries = {
          ...get().entries,
          [dateKey]: [...(get().entries[dateKey] ?? []), entry],
        };
        set({ entries: newEntries });
        const userId = get().userId;
        if (userId) await upsertEntries(userId, dateKey, newEntries[dateKey]);
      },

      updateEntry: async (dateKey, entry) => {
        const newEntries = {
          ...get().entries,
          [dateKey]: (get().entries[dateKey] ?? []).map((e) =>
            e.id === entry.id ? entry : e
          ),
        };
        set({ entries: newEntries });
        const userId = get().userId;
        if (userId) await upsertEntries(userId, dateKey, newEntries[dateKey]);
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

      updateSettings: async (settings) => {
        set({ settings });
        const userId = get().userId;
        if (userId) await upsertSettings(userId, settings);
      },

      setActualPayment: async (monthKey, amount) => {
        set((s) => ({ actualPayments: { ...s.actualPayments, [monthKey]: amount } }));
        const userId = get().userId;
        if (userId) await upsertActualPayment(userId, monthKey, amount);
      },

      clearStore: () => set({ entries: {}, actualPayments: {}, settings: DEFAULT_SETTINGS, loadError: null, userId: null }),

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
          if (settingsRes.error) console.error('load settings error:', settingsRes.error.message);
          if (paymentsRes.error) console.error('load actual_payments error:', paymentsRes.error.message);

          const entries: EntriesMap = {};
          for (const row of entriesRes.data ?? []) {
            entries[row.date_key] = row.data as WorkEntry[];
          }

          const actualPayments: ActualPaymentsMap = {};
          for (const row of paymentsRes.data ?? []) {
            actualPayments[row.month_key] = row.amount;
          }

          set({
            entries,
            actualPayments,
            settings: settingsRes.data?.data
              ? { ...DEFAULT_SETTINGS, ...(settingsRes.data.data as DefaultSettings) }
              : DEFAULT_SETTINGS,
            loadError: null,
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
