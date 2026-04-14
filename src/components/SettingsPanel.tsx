import { useState } from 'react';
import { useSalaryStore } from '../store/useSalaryStore';
import type { DefaultSettings } from '../types';

interface Props {
  onClose: () => void;
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
}

export default function SettingsPanel({ onClose, theme, onToggleTheme }: Props) {
  const { settings, updateSettings } = useSalaryStore();
  const [form, setForm] = useState<DefaultSettings>({ ...settings });

  const handleSave = () => {
    updateSettings(form);
    onClose();
  };

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-gray-900 dark:text-white font-semibold">基本設定</h2>

      <div>
        <label className="text-gray-500 dark:text-gray-400 text-xs mb-1 block">基本時給（円）</label>
        <input
          type="number"
          className="w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded px-3 py-2 text-gray-900 dark:text-white text-sm focus:outline-none focus:border-blue-500"
          value={form.hourlyRate}
          onChange={(e) => setForm((f) => ({ ...f, hourlyRate: Number(e.target.value) }))}
        />
      </div>

      <div>
        <label className="text-gray-500 dark:text-gray-400 text-xs mb-1 block">所定労働時間（h/日）</label>
        <input
          type="number"
          step="0.5"
          className="w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded px-3 py-2 text-gray-900 dark:text-white text-sm focus:outline-none focus:border-blue-500"
          value={form.standardHours}
          onChange={(e) => setForm((f) => ({ ...f, standardHours: Number(e.target.value) }))}
        />
      </div>

      <div>
        <label className="text-gray-500 dark:text-gray-400 text-xs mb-1 block">割増賃金倍率</label>
        <input
          type="number"
          step="0.01"
          className="w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded px-3 py-2 text-gray-900 dark:text-white text-sm focus:outline-none focus:border-blue-500"
          value={form.overtimeMultiplier}
          onChange={(e) => setForm((f) => ({ ...f, overtimeMultiplier: Number(e.target.value) }))}
        />
      </div>


      <div>
        <label className="text-gray-500 dark:text-gray-400 text-xs mb-2 block">タブ表示</label>
        <button
          type="button"
          onClick={() => setForm((f) => ({ ...f, showTagTab: !f.showTagTab }))}
          className="w-full flex items-center justify-between bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded px-3 py-2"
        >
          <span className="text-gray-900 dark:text-white text-sm">タグ別集計タブ</span>
          <span
            className={`relative inline-flex h-5 w-9 shrink-0 rounded-full transition-colors ${
              form.showTagTab ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-500'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 mt-0.5 rounded-full bg-white shadow transition-transform ${
                form.showTagTab ? 'translate-x-4' : 'translate-x-0.5'
              }`}
            />
          </span>
        </button>
      </div>

      <div>
        <label className="text-gray-500 dark:text-gray-400 text-xs mb-2 block">表示モード</label>
        <button
          type="button"
          onClick={onToggleTheme}
          className="w-full flex items-center justify-between bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded px-3 py-2"
        >
          <span className="text-gray-900 dark:text-white text-sm">
            {theme === 'dark' ? '🌙 ダークモード' : '☀️ ライトモード'}
          </span>
          <span className="text-gray-500 dark:text-gray-400 text-xs">タップで切替</span>
        </button>
      </div>

      <div className="flex gap-2 mt-4">
        <button
          onClick={handleSave}
          className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded font-medium"
        >
          保存
        </button>
        <button
          onClick={onClose}
          className="flex-1 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-900 dark:text-white py-2 rounded font-medium"
        >
          閉じる
        </button>
      </div>
    </div>
  );
}
