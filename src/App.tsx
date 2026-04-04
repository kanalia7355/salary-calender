import { useState, useEffect } from 'react';
import type { Session } from '@supabase/supabase-js';
import Calendar from './components/Calendar';
import SummaryBar from './components/SummaryBar';
import EntryList from './components/EntryList';
import EntryForm from './components/EntryForm';
import SettingsPanel from './components/SettingsPanel';
import LoginPage from './components/LoginPage';
import YearlySummary from './components/YearlySummary';
import { useSalaryStore } from './store/useSalaryStore';
import { supabase } from './lib/supabase';
import type { WorkEntry } from './types';

type PanelMode = 'empty' | 'list' | 'form' | 'settings';
type Tab = 'calendar' | 'yearly';

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const loadFromSupabase = useSalaryStore((s) => s.loadFromSupabase);
  const clearStore = useSalaryStore((s) => s.clearStore);

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

  useEffect(() => {
    if (session?.user.id) {
      loadFromSupabase(session.user.id);
    }
  }, [session?.user.id, loadFromSupabase]);

  // タブがアクティブになった瞬間に最新データを取得（スマホでタブ開きっぱなし対策）
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && session?.user.id) {
        loadFromSupabase(session.user.id);
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [session?.user.id, loadFromSupabase]);

  const handleLogout = async () => {
    clearStore();
    await supabase.auth.signOut();
  };

  const today = new Date();
  const [tab, setTab] = useState<Tab>('calendar');
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

  const prevPeriod = () => {
    if (tab === 'yearly') {
      setYear(y => y - 1);
    } else {
      if (month === 1) { setYear(y => y - 1); setMonth(12); }
      else setMonth(m => m - 1);
    }
  };

  const nextPeriod = () => {
    if (tab === 'yearly') {
      setYear(y => y + 1);
    } else {
      if (month === 12) { setYear(y => y + 1); setMonth(1); }
      else setMonth(m => m + 1);
    }
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

  const periodLabel = tab === 'yearly' ? `${year}年` : `${year}年${month}月`;

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <div className="max-w-6xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-4 gap-2">
          <div className="flex items-center gap-2">
            <button
              onClick={prevPeriod}
              className="bg-gray-700 hover:bg-gray-600 text-white w-8 h-8 rounded flex items-center justify-center shrink-0"
            >
              ◀
            </button>
            <h1 className="text-base md:text-xl font-bold whitespace-nowrap">{periodLabel}</h1>
            <button
              onClick={nextPeriod}
              className="bg-gray-700 hover:bg-gray-600 text-white w-8 h-8 rounded flex items-center justify-center shrink-0"
            >
              ▶
            </button>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPanelMode('settings')}
              className="flex items-center gap-1 bg-gray-700 hover:bg-gray-600 text-white px-2 md:px-3 py-1.5 rounded text-sm whitespace-nowrap"
            >
              ⚙ <span className="hidden sm:inline">基本設定</span>
            </button>
            <span className="text-gray-400 text-xs hidden md:block truncate max-w-32">{session.user.email}</span>
            <button
              onClick={handleLogout}
              className="bg-gray-700 hover:bg-gray-600 text-white px-2 md:px-3 py-1.5 rounded text-sm whitespace-nowrap"
            >
              ログアウト
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-4 border-b border-gray-700">
          <button
            onClick={() => setTab('calendar')}
            className={`px-4 py-2 text-sm font-medium rounded-t transition-colors ${
              tab === 'calendar'
                ? 'bg-gray-800 text-white border-b-2 border-blue-500'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            カレンダー
          </button>
          <button
            onClick={() => setTab('yearly')}
            className={`px-4 py-2 text-sm font-medium rounded-t transition-colors ${
              tab === 'yearly'
                ? 'bg-gray-800 text-white border-b-2 border-blue-500'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            年次サマリー
          </button>
        </div>

        {tab === 'calendar' && (
          <>
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
              <div className="w-full md:w-80 bg-gray-800 rounded-lg p-4 min-h-48 md:min-h-64 md:max-h-[calc(100vh-220px)] md:overflow-y-auto">
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
          </>
        )}

        {tab === 'yearly' && (
          <div className="bg-gray-800 rounded-lg p-4">
            <YearlySummary year={year} />
          </div>
        )}
      </div>
    </div>
  );
}
