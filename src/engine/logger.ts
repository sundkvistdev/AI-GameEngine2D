/**
 * Vortex2D Game Engine - Robust Engine Logging System
 * Supports severity levels (Info, Warn, Error), timestamps, categories,
 * searching, filtering, clipboard export, and auto-scroll.
 * Zero emojis.
 */

export type LogLevel = 'info' | 'warn' | 'error';

export interface LogEntry {
  id: number;
  timestamp: string;
  level: LogLevel;
  category: string;
  message: string;
}

let nextLogId = 1;
export const engineLogEntries: LogEntry[] = [];
let hasUnreadLogs = false;

function formatTimestamp(): string {
  const d = new Date();
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  const s = String(d.getSeconds()).padStart(2, '0');
  const ms = String(d.getMilliseconds()).padStart(3, '0');
  return `${h}:${m}:${s}.${ms}`;
}

export function logInfo(message: string, category: string = 'Engine'): void {
  addLogEntry('info', message, category);
}

export function logWarn(message: string, category: string = 'Engine'): void {
  addLogEntry('warn', message, category);
}

export function logError(message: string, category: string = 'Engine'): void {
  addLogEntry('error', message, category);
}

export function addLogEntry(level: LogLevel, message: string, category: string = 'Engine'): void {
  engineLogEntries.push({
    id: nextLogId++,
    timestamp: formatTimestamp(),
    level,
    category,
    message,
  });

  // Keep log buffer bounded to 1000 items
  if (engineLogEntries.length > 1000) {
    engineLogEntries.shift();
  }
  hasUnreadLogs = true;
}

export function clearEngineLogs(): void {
  engineLogEntries.length = 0;
  addLogEntry('info', 'Log buffer cleared', 'System');
}

export function consumeUnreadLogFlag(): boolean {
  const flag = hasUnreadLogs;
  hasUnreadLogs = false;
  return flag;
}

// Initial bootstrap entries
addLogEntry('info', 'Vortex2D Engine 2.0 initialized', 'System');
addLogEntry('info', 'Coordinate specs: +X Right, -X Left, +Y Up, -Y Down', 'Transform');
addLogEntry('info', 'Rotation specs: 0 deg = Right / Upright, counterclockwise increase', 'Transform');
