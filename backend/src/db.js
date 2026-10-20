import { readFile } from 'node:fs/promises';
import pg from 'pg';

export function createPool() {
  const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    max: 10,
    connectionTimeoutMillis: 5000,
    idleTimeoutMillis: 30000,
    statement_timeout: 10000
  });
  pool.on('error', error => console.error('Koneksi PostgreSQL terputus:', error));
  return pool;
}

export async function initializeDatabase(pool) {
  const schema = await readFile(new URL('../sql/schema.sql', import.meta.url), 'utf8');
  await pool.query(schema);
}
