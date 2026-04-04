import { useState, useEffect } from 'react';
import type { Session } from '@supabase/supabase-js';
import Calendar from './components/Calendar';
import SummaryBar from './components/SummaryBar';
import EntryList from './components/EntryList';
import EntryForm from './components/EntryForm';
import SettingsPanel from './components/SettingsPanel';
import LoginPage from './components/LoginPage';
import { useSalaryStore } from './store/useSalaryStore';
import { supabase } from './lib/supabase';
import type { WorkEntry } from './types';

type PanelMode = 'empty' | 'list' | 'form' | 'settings';

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const loadFromSupabase = useSalaryStore((s) => s.loadFromSupabase);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setAuthLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
    });
    return () => subscription.unsubscribe();
  }, []);

  // ログイン後にSupabaseからデータを読み込む
  useEffect(() => {
    if (session?.user.id) {
      loadFromSupabase(session.user.id);
    }
  }, [session?.user.id, loadFromSupabase]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [panelMode, setPanelMode] = useState<PanelMode>('empty');
  const [editingEntry, setEditingEntry] = useState<WorkEntry | null>(null);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-gray-400">読み込み中...</div>
      </div>
    );
  }

  if (!session) {
    return <LoginPage />;
  }

  const prevMonth = () => {
    if (month === 1) { setYear(y => y - 1); setMonth(12); }
    else setMonth(m => m - 1);
  };

  const nextMonth = () => {
    if (month === 12) { setYear(y => y + 1); setMonth(1); }
    else setMonth(m => m + 1);
  };

  const handleSelectDate = (dateKey: string) => {
    setSelectedDate(dateKey);
    setPanelMode('list');
    setEditingEntry(null);
  };

  const handleAdd = () => {
    setEditingEntry(null);
    setPanelMode('form');
  };

  const handleEdit = (entry: WorkEntry) => {
    setEditingEntry(entry);
    setPanelMode('form');
  };

  const handleFormClose = () => {
    setPanelMode('list');
    setEditingEntry(null);
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <div className="max-w-6xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <button
              onClick={prevMonth}
              className="bg-gray-700 hover:bg-gray-600 text-white w-8 h-8 rounded flex items-center justify-center"
            >
              ◀
            </button>
            <h1 className="text-xl font-bold">{year}年{month}月</h1>
            <button
              onClick={nextMonth}
              className="bg-gray-700 hover:bg-gray-600 text-white w-8 h-8 rounded flex items-center justify-center"
            >
              ▶
            </button>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setPanelMode('settings')}
              className="flex items-center gap-1 bg-gray-700 hover:bg-gray-600 text-white px-3 py-1.5 rounded text-sm"
            >
              ⚙ 基本設定
            </button>
            <span className="text-gray-400 text-sm">{session.user.email}</span>
            <button
              onClick={handleLogout}
              className="bg-gray-700 hover:bg-gray-600 text-white px-3 py-1.5 rounded text-sm"
            >
              ログアウト
            </button>
          </div>
        </div>

        {/* Summary Bar */}
        <SummaryBar year={year} month={month} />

        {/* Main Layout */}
        <div className="flex flex-col md:flex-row gap-4">
          {/* Calendar */}
          <div className="flex-1">
            <Calendar
              year={year}
              month={month}
              selectedDate={selectedDate}
              onSelectDate={handleSelectDate}
            />
          </div>

          {/* Right Panel */}
          <div className="w-full md:w-80 bg-gray-800 rounded-lg p-4 min-h-64">
            {panelMode === 'empty' && (
              <p className="text-gray-500 text-sm">日付をクリックして勤務を管理</p>
            )}
            {panelMode === 'list' && selectedDate && (
              <EntryList
                dateKey={selectedDate}
                onAdd={handleAdd}
                onEdit={handleEdit}
              />
            )}
            {panelMode === 'form' && selectedDate && (
              <EntryForm
                dateKey={selectedDate}
                entry={editingEntry}
                onClose={handleFormClose}
              />
            )}
            {panelMode === 'settings' && (
              <SettingsPanel onClose={() => setPanelMode('empty')} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
