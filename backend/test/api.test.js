import assert from 'node:assert/strict';
import { once } from 'node:events';
import { randomUUID } from 'node:crypto';
import { after, before, beforeEach, describe, test } from 'node:test';
import pg from 'pg';
import { createApp } from '../src/app.js';
import { initializeDatabase } from '../src/db.js';

const connectionString = process.env.TEST_DATABASE_URL;
const item = {
  name: 'Proyektor Epson', code: 'BIN-ELE-001', category: 'Elektronik',
  location: 'Ruang 402', quantity: 8, status: 'available'
};

describe('API with PostgreSQL', { skip: !connectionString }, () => {
  const schema = `inventory_test_${randomUUID().replaceAll('-', '')}`;
  let admin;
  let pool;
  let server;
  let base;

  async function request(path, method = 'GET', body) {
    return fetch(`${base}${path}`, {
      method,
      headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body)
    });
  }

  before(async () => {
    admin = new pg.Pool({ connectionString, connectionTimeoutMillis: 5000 });
    await admin.query(`CREATE SCHEMA ${schema}`);
    pool = new pg.Pool({ connectionString, options: `-c search_path=${schema}`, connectionTimeoutMillis: 5000 });
    await initializeDatabase(pool);
    server = createApp(pool).listen(0, '127.0.0.1');
    await once(server, 'listening');
    base = `http://127.0.0.1:${server.address().port}`;
  });

  beforeEach(async () => {
    await pool.query('TRUNCATE items RESTART IDENTITY');
  });

  after(async () => {
    if (server) {
      server.closeAllConnections();
      await new Promise(resolve => server.close(resolve));
    }
    if (pool) await pool.end();
    if (admin) {
      await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
      await admin.end();
    }
  });

  test('serves the frontend and reports database health', async () => {
    const health = await request('/api/health');
    assert.equal(health.status, 200);
    assert.deepEqual(await health.json(), { status: 'ok', database: 'connected' });
    const page = await request('/');
    assert.equal(page.status, 200);
    assert.match(await page.text(), /BINUS Inventory/);
    const script = await request('/script.js');
    assert.match(await script.text(), /const DEMO_MODE = false;/);
    assert.equal((await request('/Dockerfile')).status, 404);
    assert.equal((await request('/api/unknown')).status, 404);
  });

  test('creates, lists, replaces and deletes a persistent item', async () => {
    assert.deepEqual(await (await request('/api/items')).json(), []);
    const created = await request('/api/items', 'POST', item);
    assert.equal(created.status, 201);
    const saved = await created.json();
    assert.deepEqual(saved, { id: 1, ...item });
    assert.equal(created.headers.get('location'), '/api/items/1');
    assert.deepEqual(await (await request('/api/items')).json(), [saved]);

    const updated = await request('/api/items/1', 'PUT', { ...item, quantity: 0, status: 'maintenance' });
    assert.equal(updated.status, 200);
    assert.deepEqual(await updated.json(), { ...saved, quantity: 0, status: 'maintenance' });
    const stored = await pool.query('SELECT quantity, status FROM items WHERE id = 1');
    assert.deepEqual(stored.rows[0], { quantity: 0, status: 'maintenance' });
    const deleted = await request('/api/items/1', 'DELETE');
    assert.equal(deleted.status, 204);
    assert.equal(await deleted.text(), '');
    assert.deepEqual(await (await request('/api/items')).json(), []);
  });

  test('keeps data across database connections and repeated initialization', async () => {
    await request('/api/items', 'POST', item);
    const secondPool = new pg.Pool({ connectionString, options: `-c search_path=${schema}` });
    try {
      await initializeDatabase(secondPool);
      const result = await secondPool.query('SELECT code FROM items');
      assert.deepEqual(result.rows, [{ code: item.code }]);
    } finally {
      await secondPool.end();
    }
  });

  test('returns field errors and does not write invalid items', async () => {
    for (const body of [{}, [], { ...item, quantity: '8' }, { ...item, status: 'unknown' }]) {
      const response = await request('/api/items', 'POST', body);
      assert.equal(response.status, 400);
      assert.ok((await response.json()).errors);
    }
    assert.deepEqual(await (await request('/api/items')).json(), []);
  });

  test('rejects duplicate codes even for concurrent requests and mixed case', async () => {
    const results = await Promise.all([
      request('/api/items', 'POST', item),
      request('/api/items', 'POST', { ...item, code: ' bin-ele-001 ' })
    ]);
    assert.deepEqual(results.map(result => result.status).sort(), [201, 409]);
    const duplicate = results.find(result => result.status === 409);
    assert.equal((await duplicate.json()).errors.code, 'Kode aset sudah digunakan.');
    assert.equal((await (await request('/api/items')).json()).length, 1);
  });

  test('rejects a duplicate update and preserves the previous record', async () => {
    await request('/api/items', 'POST', item);
    const second = await (await request('/api/items', 'POST', { ...item, code: 'BIN-ELE-002' })).json();
    assert.equal((await request(`/api/items/${second.id}`, 'PUT', item)).status, 409);
    const result = await pool.query('SELECT code FROM items WHERE id = $1', [second.id]);
    assert.equal(result.rows[0].code, 'BIN-ELE-002');
  });

  test('distinguishes invalid IDs from missing records', async () => {
    for (const id of ['abc', '0', '-1', '1.5', '2147483648']) {
      assert.equal((await request(`/api/items/${id}`, 'DELETE')).status, 400);
    }
    assert.equal((await request('/api/items/999', 'PUT', item)).status, 404);
    assert.equal((await request('/api/items/999', 'DELETE')).status, 404);
  });

  test('rejects malformed JSON, oversized bodies and incorrect content types', async () => {
    for (const [body, contentType, status] of [
      ['{', 'application/json', 400],
      [JSON.stringify({ ...item, name: 'x'.repeat(17000) }), 'application/json', 413],
      [JSON.stringify(item), 'text/plain', 415]
    ]) {
      const response = await fetch(`${base}/api/items`, { method: 'POST', headers: { 'Content-Type': contentType }, body });
      assert.equal(response.status, status);
      assert.match(response.headers.get('content-type'), /application\/json/);
    }
  });

  test('handles SQL-like input as data', async () => {
    const name = "Proyektor'; DROP TABLE items; --";
    const response = await request('/api/items', 'POST', { ...item, name });
    assert.equal(response.status, 201);
    assert.equal((await response.json()).name, name);
    assert.equal((await (await request('/api/items')).json()).length, 1);
  });

  test('database constraints also reject invalid direct writes', async () => {
    await assert.rejects(
      pool.query('INSERT INTO items (name, code, category, location, quantity, status) VALUES ($1, $2, $3, $4, $5, $6)',
        [item.name, item.code, item.category, item.location, -1, item.status]),
      { code: '23514' }
    );
  });

  test('reports database failures without exposing internal errors', async context => {
    const log = context.mock.method(console, 'error', () => {});
    await pool.query('ALTER TABLE items RENAME TO unavailable_items');
    try {
      const health = await request('/api/health');
      assert.equal(health.status, 503);
      assert.deepEqual(await health.json(), { status: 'error', message: 'Database tidak tersedia.' });
      const list = await request('/api/items');
      assert.equal(list.status, 500);
      assert.deepEqual(await list.json(), { message: 'Terjadi kesalahan pada server.' });
      assert.equal(log.mock.callCount(), 2);
    } finally {
      await pool.query('ALTER TABLE unavailable_items RENAME TO items');
    }
  });
});
