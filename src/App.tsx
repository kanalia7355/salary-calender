import { useState, useEffect } from 'react';
import type { Session } from '@supabase/supabase-js';
import Calendar from './components/Calendar';
import SummaryBar from './components/SummaryBar';
import EntryList from './components/EntryList';
import EntryForm from './components/EntryForm';
import SettingsPanel from './components/SettingsPanel';
import AccountPanel from './components/AccountPanel';
import LoginPage from './components/LoginPage';
import YearlySummary from './components/YearlySummary';
import AnalysisTab from './components/AnalysisTab';
import TagSummaryTab from './components/TagSummaryTab';
import { useSalaryStore } from './store/useSalaryStore';
import { supabase } from './lib/supabase';
import type { WorkEntry } from './types';
import { useTheme } from './hooks/useTheme';

type PanelMode = 'empty' | 'list' | 'form';
type ModalMode = 'settings' | 'account' | null;
type Tab = 'calendar' | 'yearly' | 'analysis' | 'tags';

export default function App() {
  const { theme, toggleTheme } = useTheme();
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const loadFromSupabase = useSalaryStore((s) => s.loadFromSupabase);
  const clearStore = useSalaryStore((s) => s.clearStore);
  const loadError = useSalaryStore((s) => s.loadError);
  const setUserId = useSalaryStore((s) => s.setUserId);
  const settings = useSalaryStore((s) => s.settings);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setAuthLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      setUserId(s?.user.id ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (session?.user.id) {
      setUserId(session.user.id);
      loadFromSupabase(session.user.id);
    }
  }, [session?.user.id, loadFromSupabase, setUserId]);

  // Supabase Realtimeで他端末の変更をリアルタイム受信
  useEffect(() => {
    if (!session?.user.id) return;
    const userId = session.user.id;

    const channel = supabase
      .channel(`user-${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'entries', filter: `user_id=eq.${userId}` },
        () => loadFromSupabase(userId))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'settings', filter: `user_id=eq.${userId}` },
        () => loadFromSupabase(userId))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'actual_payments', filter: `user_id=eq.${userId}` },
        () => loadFromSupabase(userId))
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [session?.user.id, loadFromSupabase]);

  const handleLogout = async () => {
    clearStore();
    await supabase.auth.signOut();
  };

  const today = new Date();
  const [tab, setTab] = useState<Tab>('calendar');

  // タグタブが非表示になったとき、そのタブにいたらカレンダーへ戻す
  useEffect(() => {
    if (!settings.showTagTab && tab === 'tags') setTab('calendar');
  }, [settings.showTagTab]);
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [panelMode, setPanelMode] = useState<PanelMode>('empty');
  const [modalMode, setModalMode] = useState<ModalMode>(null);
  const [editingEntry, setEditingEntry] = useState<WorkEntry | null>(null);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-gray-500 dark:text-gray-400">読み込み中...</div>
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
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white">
      {/* 右ドロワー（基本設定・アカウント） */}
      {/* 背景オーバーレイ */}
      {modalMode !== null && (
        <div
          className="fixed inset-0 z-40 bg-black/20"
          onClick={() => setModalMode(null)}
        />
      )}
      {/* ドロワー本体 */}
      <div
        className={`fixed top-0 right-0 z-50 h-full w-80 bg-white dark:bg-gray-800 shadow-2xl flex flex-col transition-transform duration-300 ease-in-out ${
          modalMode !== null ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {modalMode !== null && (
          <div className="flex-1 overflow-y-auto p-6">
            {modalMode === 'settings' && (
              <SettingsPanel onClose={() => setModalMode(null)} theme={theme} onToggleTheme={toggleTheme} />
            )}
            {modalMode === 'account' && (
              <AccountPanel
                email={session.user.email ?? ''}
                onLogout={handleLogout}
                onClose={() => setModalMode(null)}
              />
            )}
          </div>
        )}
      </div>

      {loadError && (
        <div className="bg-red-800 text-red-100 text-sm px-4 py-3 flex items-center gap-2">
          <span>⚠</span>
          <span>{loadError}</span>
          <a
            href="https://vercel.com/docs/projects/environment-variables"
            target="_blank"
            rel="noopener noreferrer"
            className="underline ml-1"
          >
            Vercel環境変数の設定方法
          </a>
        </div>
      )}
      <div className="max-w-6xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-4 gap-2">
          <div className="flex items-center gap-2">
            <button
              onClick={prevPeriod}
              className="bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-900 dark:text-white w-8 h-8 rounded flex items-center justify-center shrink-0"
            >
              ◀
            </button>
            <h1 className="text-base md:text-xl font-bold whitespace-nowrap">{periodLabel}</h1>
            <button
              onClick={nextPeriod}
              className="bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-900 dark:text-white w-8 h-8 rounded flex items-center justify-center shrink-0"
            >
              ▶
            </button>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setModalMode('settings')}
              className="flex items-center gap-1 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-900 dark:text-white px-2 md:px-3 py-1.5 rounded text-sm whitespace-nowrap"
            >
              ⚙ <span className="hidden sm:inline">基本設定</span>
            </button>
            <button
              onClick={() => setModalMode('account')}
              className="flex items-center gap-1 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-900 dark:text-white px-2 md:px-3 py-1.5 rounded text-sm whitespace-nowrap"
            >
              👤 <span className="hidden sm:inline">アカウント</span>
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-4 border-b border-gray-200 dark:border-gray-700">
          <button
            onClick={() => setTab('calendar')}
            className={`px-4 py-2 text-sm font-medium rounded-t transition-colors ${
              tab === 'calendar'
                ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white border-b-2 border-blue-500'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
            }`}
          >
            カレンダー
          </button>
          <button
            onClick={() => setTab('analysis')}
            className={`px-4 py-2 text-sm font-medium rounded-t transition-colors ${
              tab === 'analysis'
                ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white border-b-2 border-blue-500'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
            }`}
          >
            分析
          </button>
          {settings.showTagTab && (
            <button
              onClick={() => setTab('tags')}
              className={`px-4 py-2 text-sm font-medium rounded-t transition-colors ${
                tab === 'tags'
                  ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white border-b-2 border-blue-500'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
              }`}
            >
              タグ別集計
            </button>
          )}
          <button
            onClick={() => setTab('yearly')}
            className={`px-4 py-2 text-sm font-medium rounded-t transition-colors ${
              tab === 'yearly'
                ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white border-b-2 border-blue-500'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
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
              <div className="w-full md:w-80 bg-white dark:bg-gray-800 rounded-lg p-4 min-h-48 md:min-h-64 md:max-h-[calc(100vh-220px)] md:overflow-y-auto">
                {panelMode === 'empty' && (
                  <p className="text-gray-400 dark:text-gray-500 text-sm">日付をクリックして勤務を管理</p>
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
              </div>
            </div>
          </>
        )}

        {tab === 'yearly' && (
          <div className="bg-white dark:bg-gray-800 rounded-lg p-4">
            <YearlySummary year={year} />
          </div>
        )}

        {tab === 'analysis' && (
          <AnalysisTab year={year} />
        )}

        {tab === 'tags' && settings.showTagTab && (
          <TagSummaryTab year={year} />
        )}
      </div>
    </div>
  );
}
