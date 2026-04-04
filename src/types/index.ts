export interface WorkEntry {
  id: string;
  projectName: string;
  startTime: string;
  endTime: string;
  breakMinutes: number;
  transportFee: number;
  hourlyRate: number | null;
  stdHours: number | null;
  overtimeMult: number | null;
}

export interface DefaultSettings {
  hourlyRate: number;
  standardHours: number;
  overtimeMultiplier: number;
}

export interface CalcResult {
  workHours: number;
  regularHours: number;
  overtimeHours: number;
  pay: number;
  transport: number;
}

export type EntriesMap = Record<string, WorkEntry[]>;

// key: "YYYY-MM"
export type ActualPaymentsMap = Record<string, number>;
