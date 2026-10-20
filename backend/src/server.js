import { createApp } from './app.js';
import { createPool, initializeDatabase } from './db.js';

const pool = createPool();
const port = Number(process.env.PORT || 3000);
let server;

try {
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT harus berupa angka 1–65535.');
  await initializeDatabase(pool);
  server = createApp(pool).listen(port, '0.0.0.0', () => {
    console.log(`BINUS Inventory berjalan di http://localhost:${port}`);
  });
  server.on('error', async error => {
    console.error('Server gagal dijalankan:', error);
    await pool.end();
    process.exitCode = 1;
  });
} catch (error) {
  console.error('Backend gagal dijalankan:', error);
  await pool.end();
  process.exitCode = 1;
}

function shutdown() {
  if (!server?.listening) return;
  console.log('Menghentikan backend...');
  const timeout = setTimeout(() => process.exit(1), 10000);
  timeout.unref();
  server.close(async () => {
    await pool.end();
    clearTimeout(timeout);
  });
  server.closeIdleConnections();
}

process.once('SIGTERM', shutdown);
process.once('SIGINT', shutdown);
