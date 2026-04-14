export interface WorkEntry {
  id: string;
  projectName: string;
  startTime: string;
  endTime: string;
  breakMinutes: number;
  transportFee: number;
  otherFee: number;
  hourlyRate: number | null;
  stdHours: number | null;
  overtimeMult: number | null;
  withholdingTax: number;
  tags?: string[];
}

export interface DefaultSettings {
  hourlyRate: number;
  standardHours: number;
  overtimeMultiplier: number;
  showTagTab: boolean;
}

export interface CalcResult {
  workHours: number;
  regularHours: number;
  overtimeHours: number;
  deepNightHours: number;
  pay: number;
  transport: number;
  otherFee: number;
  withholdingTax: number;
  netPay: number;
}

export type EntriesMap = Record<string, WorkEntry[]>;

// key: "YYYY-MM"
export type ActualPaymentsMap = Record<string, number>;
