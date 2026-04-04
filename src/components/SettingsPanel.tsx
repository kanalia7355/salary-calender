import { useState } from 'react';
import { useSalaryStore } from '../store/useSalaryStore';
import type { DefaultSettings } from '../types';

interface Props {
  onClose: () => void;
}

export default function SettingsPanel({ onClose }: Props) {
  const { settings, updateSettings } = useSalaryStore();
  const [form, setForm] = useState<DefaultSettings>({ ...settings });

  const handleSave = () => {
    updateSettings(form);
    onClose();
  };

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-white font-semibold">基本設定</h2>

      <div>
        <label className="text-gray-400 text-xs mb-1 block">基本時給（円）</label>
        <input
          type="number"
          className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
          value={form.hourlyRate}
          onChange={(e) => setForm((f) => ({ ...f, hourlyRate: Number(e.target.value) }))}
        />
      </div>

      <div>
        <label className="text-gray-400 text-xs mb-1 block">所定労働時間（h/日）</label>
        <input
          type="number"
          step="0.5"
          className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
          value={form.standardHours}
          onChange={(e) => setForm((f) => ({ ...f, standardHours: Number(e.target.value) }))}
        />
      </div>

      <div>
        <label className="text-gray-400 text-xs mb-1 block">割増賃金倍率</label>
        <input
          type="number"
          step="0.01"
          className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
          value={form.overtimeMultiplier}
          onChange={(e) => setForm((f) => ({ ...f, overtimeMultiplier: Number(e.target.value) }))}
        />
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
          className="flex-1 bg-gray-700 hover:bg-gray-600 text-white py-2 rounded font-medium"
        >
          閉じる
        </button>
      </div>
    </div>
  );
}
