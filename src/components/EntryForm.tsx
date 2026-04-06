import { useState, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { WorkEntry, CalcResult } from '../types';
import { useSalaryStore } from '../store/useSalaryStore';
import { calcEntry, formatCurrency } from '../utils/calc';

interface Props {
  dateKey: string;
  entry: WorkEntry | null;
  onClose: () => void;
}

const EMPTY: Omit<WorkEntry, 'id'> = {
  projectName: '',
  startTime: '09:00',
  endTime: '18:00',
  breakMinutes: 60,
  transportFee: 0,
  otherFee: 0,
  hourlyRate: null,
  stdHours: null,
  overtimeMult: null,
};

// "HH:MM" ↔ { h, m } 変換
const parseHM = (t: string) => {
  const [h, m] = t.split(':').map(Number);
  return { h: isNaN(h) ? 0 : h, m: isNaN(m) ? 0 : m };
};
const toTimeStr = (h: number, m: number) =>
  `${String(Math.max(0, h)).padStart(2, '0')}:${String(Math.min(59, Math.max(0, m))).padStart(2, '0')}`;

interface TimeInputProps {
  label: string;
  value: string;
  maxHour: number;
  onChange: (val: string) => void;
  labelClass: string;
  inputClass: string;
}

function TimeInput({ label, value, maxHour, onChange, labelClass, inputClass }: TimeInputProps) {
  const { h, m } = parseHM(value);
  return (
    <div className="flex-1">
      <label className={labelClass}>{label}</label>
      <div className="flex items-center gap-1">
        <input
          type="number"
          min={0}
          max={maxHour}
          className={`${inputClass} text-center px-1`}
          value={h}
          onChange={(e) => {
            const newH = Math.min(maxHour, Math.max(0, Number(e.target.value) || 0));
            onChange(toTimeStr(newH, m));
          }}
        />
        <span className="text-gray-500 dark:text-gray-400 font-bold">:</span>
        <input
          type="number"
          min={0}
          max={59}
          className={`${inputClass} text-center px-1`}
          value={m}
          onChange={(e) => {
            const newM = Math.min(59, Math.max(0, Number(e.target.value) || 0));
            onChange(toTimeStr(h, newM));
          }}
        />
      </div>
      {label.includes('終了') && h >= 24 && (
        <p className="text-purple-400 text-xs mt-0.5">翌{h - 24}時{m > 0 ? m + '分' : ''}</p>
      )}
    </div>
  );
}

export default function EntryForm({ dateKey, entry, onClose }: Props) {
  const { settings, addEntry, updateEntry } = useSalaryStore();
  const [form, setForm] = useState<Omit<WorkEntry, 'id'>>(entry ?? EMPTY);
  const [preview, setPreview] = useState<CalcResult | null>(null);

  useEffect(() => {
    const e: WorkEntry = { id: entry?.id ?? '', ...form };
    setPreview(calcEntry(e, settings));
  }, [form, settings]);

  const set = <K extends keyof typeof form>(key: K, val: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [key]: val }));

  const parseOptNum = (v: string): number | null => (v === '' ? null : Number(v));

  const handleSave = () => {
    if (!form.projectName || !form.startTime || !form.endTime) return;
    if (entry) {
      updateEntry(dateKey, { id: entry.id, ...form });
    } else {
      addEntry(dateKey, { id: uuidv4(), ...form });
    }
    onClose();
  };

  const inputClass = "w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded px-3 py-2 text-gray-900 dark:text-white text-sm placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:border-blue-500";
  const labelClass = "text-gray-500 dark:text-gray-400 text-xs mb-1 block";

  return (
    <div className="flex flex-col gap-3 overflow-y-auto">
      <h2 className="text-gray-900 dark:text-white font-semibold">{entry ? '勤務編集' : '勤務登録'}</h2>

      <div>
        <label className={labelClass}>案件名</label>
        <input
          className={inputClass}
          placeholder="案件名を入力"
          value={form.projectName}
          onChange={(e) => set('projectName', e.target.value)}
        />
      </div>

      <div className="flex gap-2">
        <TimeInput
          label="開始時刻"
          value={form.startTime}
          maxHour={35}
          onChange={(v) => set('startTime', v)}
          labelClass={labelClass}
          inputClass={inputClass}
        />
        <TimeInput
          label="終了時刻（最大36時）"
          value={form.endTime}
          maxHour={36}
          onChange={(v) => set('endTime', v)}
          labelClass={labelClass}
          inputClass={inputClass}
        />
      </div>

      <div className="flex gap-2">
        <div className="flex-1">
          <label className={labelClass}>休憩時間（分）</label>
          <input
            type="number"
            className={inputClass}
            value={form.breakMinutes}
            onChange={(e) => set('breakMinutes', Number(e.target.value))}
          />
        </div>
        <div className="flex-1">
          <label className={labelClass}>交通費（円）</label>
          <input
            type="number"
            className={inputClass}
            placeholder="0"
            value={form.transportFee === 0 ? '' : form.transportFee}
            onChange={(e) => set('transportFee', e.target.value === '' ? 0 : Number(e.target.value))}
          />
        </div>
      </div>

      <div>
        <label className={labelClass}>その他費用（円）</label>
        <input
          type="number"
          className={inputClass}
          placeholder="0"
          value={form.otherFee === 0 ? '' : form.otherFee}
          onChange={(e) => set('otherFee', e.target.value === '' ? 0 : Number(e.target.value))}
        />
      </div>

      <div className="text-gray-500 dark:text-gray-400 text-xs">賃金設定（空白=基本設定を使用）</div>
      <div className="flex gap-2">
        <div className="flex-1">
          <label className={labelClass}>時給（基本: ¥{settings.hourlyRate}）</label>
          <input
            type="number"
            className={inputClass}
            placeholder={String(settings.hourlyRate)}
            value={form.hourlyRate ?? ''}
            onChange={(e) => set('hourlyRate', parseOptNum(e.target.value))}
          />
        </div>
        <div className="flex-1">
          <label className={labelClass}>所定時間（基本: {settings.standardHours}h）</label>
          <input
            type="number"
            className={inputClass}
            placeholder={String(settings.standardHours)}
            value={form.stdHours ?? ''}
            onChange={(e) => set('stdHours', parseOptNum(e.target.value))}
          />
        </div>
      </div>

      <div>
        <label className={labelClass}>割増倍率（基本: ×{settings.overtimeMultiplier}）</label>
        <input
          type="number"
          step="0.01"
          className={inputClass}
          placeholder={String(settings.overtimeMultiplier)}
          value={form.overtimeMult ?? ''}
          onChange={(e) => set('overtimeMult', parseOptNum(e.target.value))}
        />
      </div>

      {preview && (
        <div className="bg-gray-50 dark:bg-gray-800 rounded p-3 space-y-1">
          <div className="text-gray-500 dark:text-gray-400 text-xs font-medium mb-2">計算プレビュー</div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500 dark:text-gray-400">勤務時間</span>
            <span className="text-gray-900 dark:text-white">{preview.workHours.toFixed(2)} h</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500 dark:text-gray-400">所定内</span>
            <span className="text-gray-900 dark:text-white">{preview.regularHours.toFixed(2)} h</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-orange-300">残業</span>
            <span className="text-orange-300">{preview.overtimeHours.toFixed(2)} h</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-purple-400">深夜割増（22〜4時）</span>
            <span className="text-purple-400">{preview.deepNightHours.toFixed(2)} h</span>
          </div>
          <div className="border-t border-gray-200 dark:border-gray-700 pt-1 mt-1 space-y-1">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500 dark:text-gray-400">給与</span>
              <span className="text-gray-900 dark:text-white">{formatCurrency(preview.pay)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500 dark:text-gray-400">交通費</span>
              <span className="text-gray-900 dark:text-white">{formatCurrency(preview.transport)}</span>
            </div>
            {preview.otherFee > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-500 dark:text-gray-400">その他費用</span>
                <span className="text-gray-900 dark:text-white">{formatCurrency(preview.otherFee)}</span>
              </div>
            )}
            <div className="flex justify-between text-sm font-bold">
              <span className="text-gray-600 dark:text-gray-300">合計</span>
              <span className="text-blue-400">{formatCurrency(preview.pay + preview.transport + preview.otherFee)}</span>
            </div>
          </div>
        </div>
      )}

      <div className="flex gap-2 mt-auto">
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
          キャンセル
        </button>
      </div>
    </div>
  );
}
