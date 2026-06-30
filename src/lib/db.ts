import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const dbPath = process.env.DATABASE_PATH || './data/printer.db';

// Ensure the target directory exists
const dir = path.dirname(dbPath);
if (!fs.existsSync(dir)) {
  fs.mkdirSync(dir, { recursive: true });
}

// Initialize database
const db = new Database(dbPath);
db.pragma('journal_mode = WAL');

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS print_jobs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    filename TEXT NOT NULL,
    timestamp TEXT NOT NULL,
    status TEXT NOT NULL,
    pdf_data BLOB NOT NULL
  );
`);

export interface PrintJob {
  id: number;
  filename: string;
  timestamp: string;
  status: string;
}

// Settings Helpers
export function getSetting(key: string): string | null {
  const stmt = db.prepare('SELECT value FROM settings WHERE key = ?');
  const row = stmt.get(key) as { value: string } | undefined;
  return row ? row.value : null;
}

export function setSetting(key: string, value: string): void {
  const stmt = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');
  stmt.run(key, value);
}

export function isSetupCompleted(): boolean {
  return getSetting('setup_completed') === 'true';
}

export function getAppPin(): string | null {
  // Env var takes priority
  if (process.env.APP_PIN) {
    return process.env.APP_PIN;
  }
  return getSetting('app_pin');
}

// Print Jobs Helpers
export function insertPrintJob(filename: string, pdfData: Buffer, status: string): number {
  const stmt = db.prepare(`
    INSERT INTO print_jobs (filename, timestamp, status, pdf_data)
    VALUES (?, datetime('now', 'localtime'), ?, ?)
  `);
  const result = stmt.run(filename, status, pdfData);
  return result.lastInsertRowid as number;
}

export function getPrintJobs(): PrintJob[] {
  // Exclude pdf_data in listings for speed
  const stmt = db.prepare(`
    SELECT id, filename, timestamp, status
    FROM print_jobs
    ORDER BY id DESC
  `);
  return stmt.all() as PrintJob[];
}

export function getPrintJobPdf(id: number): Buffer | null {
  const stmt = db.prepare('SELECT pdf_data FROM print_jobs WHERE id = ?');
  const row = stmt.get(id) as { pdf_data: Buffer } | undefined;
  return row ? row.pdf_data : null;
}

export function updatePrintJobStatus(id: number, status: string): void {
  const stmt = db.prepare('UPDATE print_jobs SET status = ? WHERE id = ?');
  stmt.run(status, id);
}

export default db;
