import { create } from 'zustand';
import type { WorkEntry, DefaultSettings, EntriesMap } from '../types';
import { supabase } from '../lib/supabase';

interface SalaryStore {
  entries: EntriesMap;
  settings: DefaultSettings;
  addEntry: (dateKey: string, entry: WorkEntry) => void;
  updateEntry: (dateKey: string, entry: WorkEntry) => void;
  deleteEntry: (dateKey: string, id: string) => void;
  updateSettings: (settings: DefaultSettings) => void;
  loadFromSupabase: (userId: string) => Promise<void>;
}

const DEFAULT_SETTINGS: DefaultSettings = {
  hourlyRate: 1500,
  standardHours: 8,
  overtimeMultiplier: 1.25,
};

// entries テーブルの1行分をupsertする
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

async function getCurrentUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.user.id ?? null;
}

export const useSalaryStore = create<SalaryStore>()((set, get) => ({
  entries: {},
  settings: DEFAULT_SETTINGS,

  addEntry: async (dateKey, entry) => {
    const newEntries = {
      ...get().entries,
      [dateKey]: [...(get().entries[dateKey] ?? []), entry],
    };
    set({ entries: newEntries });
    const userId = await getCurrentUserId();
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
    const userId = await getCurrentUserId();
    if (userId) await upsertEntries(userId, dateKey, newEntries[dateKey]);
  },

  deleteEntry: async (dateKey, id) => {
    const remaining = (get().entries[dateKey] ?? []).filter((e) => e.id !== id);
    const newEntries = { ...get().entries, [dateKey]: remaining };
    set({ entries: newEntries });
    const userId = await getCurrentUserId();
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
    const userId = await getCurrentUserId();
    if (userId) await upsertSettings(userId, settings);
  },

  loadFromSupabase: async (userId) => {
    try {
      const [entriesRes, settingsRes] = await Promise.all([
        supabase.from('entries').select('date_key, data').eq('user_id', userId),
        supabase.from('settings').select('data').eq('user_id', userId).maybeSingle(),
      ]);

      if (entriesRes.error) console.error('load entries error:', entriesRes.error.message);
      if (settingsRes.error) console.error('load settings error:', settingsRes.error.message);

      const entries: EntriesMap = {};
      for (const row of entriesRes.data ?? []) {
        entries[row.date_key] = row.data as WorkEntry[];
      }

      set({
        entries,
        settings: (settingsRes.data?.data as DefaultSettings) ?? DEFAULT_SETTINGS,
      });
    } catch (e) {
      console.error('loadFromSupabase error:', e);
    }
  },
}));
