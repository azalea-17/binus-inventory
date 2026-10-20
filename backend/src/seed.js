import { createPool, initializeDatabase } from './db.js';

const items = [
  ['Proyektor Epson EB-X51', 'BIN-ELE-001', 'Elektronik', 'Ruang Kelas 402', 8, 'available'],
  ['Laptop Lenovo ThinkPad', 'BIN-ELE-014', 'Elektronik', 'Lab Komputer 1', 24, 'borrowed'],
  ['Kursi Kuliah', 'BIN-FUR-032', 'Furnitur', 'Binus Paskal', 60, 'available'],
  ['Arduino Starter Kit', 'BIN-LAB-008', 'Laboratorium', 'Lab IoT', 12, 'maintenance'],
  ['Monitor Dell 24 inch', 'BIN-ELE-021', 'Elektronik', 'Lab Komputer 2', 18, 'available'],
  ['Whiteboard Portable', 'BIN-FUR-041', 'Furnitur', 'Ruang Meeting 3', 5, 'borrowed'],
  ['Kabel HDMI 5 meter', 'BIN-PRL-017', 'Perlengkapan', 'Ruang AV', 15, 'available']
];
const pool = createPool();

try {
  await initializeDatabase(pool);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    let inserted = 0;
    for (const item of items) {
      const result = await client.query(
        'INSERT INTO items (name, code, category, location, quantity, status) VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (code) DO NOTHING',
        item
      );
      inserted += result.rowCount;
    }
    await client.query('COMMIT');
    console.log(`${inserted} contoh barang ditambahkan.`);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
} catch (error) {
  console.error('Gagal menambahkan contoh barang:', error);
  process.exitCode = 1;
} finally {
  await pool.end();
}
