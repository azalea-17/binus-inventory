import express from 'express';
import { fileURLToPath } from 'node:url';
import { validateItem } from './items.js';

export function createApp(pool) {
  const app = express();
  app.disable('x-powered-by');
  app.use((req, res, next) => {
    res.set('X-Content-Type-Options', 'nosniff');
    if (req.path.startsWith('/api/')) res.set('Cache-Control', 'no-store');
    next();
  });
  app.use('/api', express.json({ limit: '16kb' }));

  app.get('/api/health', async (req, res) => {
    try {
      await pool.query('SELECT 1 FROM items LIMIT 1');
      res.json({ status: 'ok', database: 'connected' });
    } catch (error) {
      console.error('Pemeriksaan database gagal:', error);
      res.status(503).json({ status: 'error', message: 'Database tidak tersedia.' });
    }
  });

  app.get('/api/items', async (req, res) => {
    const result = await pool.query('SELECT id, name, code, category, location, quantity, status FROM items ORDER BY id DESC');
    res.json(result.rows);
  });

  app.param('id', (req, res, next, id) => {
    if (!/^[1-9]\d*$/.test(id) || Number(id) > 2147483647) {
      return res.status(400).json({ message: 'ID barang tidak valid.' });
    }
    next();
  });

  function checkItem(req, res, next) {
    if (!req.is('application/json')) {
      return res.status(415).json({ message: 'Gunakan Content-Type application/json.' });
    }
    const { item, errors } = validateItem(req.body);
    if (Object.keys(errors).length) {
      return res.status(400).json({ message: Object.values(errors)[0], errors });
    }
    res.locals.item = item;
    next();
  }

  app.post('/api/items', checkItem, async (req, res) => {
    const { name, code, category, location, quantity, status } = res.locals.item;
    const result = await pool.query(
      'INSERT INTO items (name, code, category, location, quantity, status) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, name, code, category, location, quantity, status',
      [name, code, category, location, quantity, status]
    );
    res.status(201).location(`/api/items/${result.rows[0].id}`).json(result.rows[0]);
  });

  app.put('/api/items/:id', checkItem, async (req, res) => {
    const { name, code, category, location, quantity, status } = res.locals.item;
    const result = await pool.query(
      'UPDATE items SET name = $1, code = $2, category = $3, location = $4, quantity = $5, status = $6 WHERE id = $7 RETURNING id, name, code, category, location, quantity, status',
      [name, code, category, location, quantity, status, req.params.id]
    );
    if (!result.rowCount) return res.status(404).json({ message: 'Barang tidak ditemukan.' });
    res.json(result.rows[0]);
  });

  app.delete('/api/items/:id', async (req, res) => {
    const result = await pool.query('DELETE FROM items WHERE id = $1', [req.params.id]);
    if (!result.rowCount) return res.status(404).json({ message: 'Barang tidak ditemukan.' });
    res.status(204).end();
  });

  // Jalur ini juga memungkinkan frontend dipakai lewat npm start tanpa Nginx.
  for (const file of ['index.html', 'style.css', 'script.js']) {
    const path = fileURLToPath(new URL(`../../frontend/${file}`, import.meta.url));
    app.get(file === 'index.html' ? ['/', '/index.html'] : `/${file}`, (req, res) => res.sendFile(path));
  }

  app.use((req, res) => res.status(404).json({ message: 'Endpoint tidak ditemukan.' }));
  app.use((error, req, res, next) => {
    if (res.headersSent) return next(error);
    if (error.type === 'entity.parse.failed') return res.status(400).json({ message: 'Format JSON tidak valid.' });
    if (error.type === 'entity.too.large') return res.status(413).json({ message: 'Data permintaan terlalu besar.' });
    if (error.code === '23505') {
      return res.status(409).json({ message: 'Kode aset sudah digunakan.', errors: { code: 'Kode aset sudah digunakan.' } });
    }
    console.error('Permintaan API gagal:', error);
    res.status(500).json({ message: 'Terjadi kesalahan pada server.' });
  });
  return app;
}
