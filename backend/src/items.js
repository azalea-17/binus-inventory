const categories = ['Elektronik', 'Furnitur', 'Laboratorium', 'Perlengkapan'];
const statuses = ['available', 'borrowed', 'maintenance'];

export function validateItem(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { errors: { body: 'Data barang harus berupa objek JSON.' } };
  }

  const item = {
    name: typeof body.name === 'string' ? body.name.trim() : '',
    code: typeof body.code === 'string' ? body.code.trim().toUpperCase() : '',
    category: body.category,
    location: typeof body.location === 'string' ? body.location.trim() : '',
    quantity: body.quantity,
    status: body.status
  };
  const errors = {};
  if (item.name.length < 2 || item.name.length > 100) errors.name = 'Nama barang harus 2–100 karakter.';
  if (!/^[A-Z0-9][A-Z0-9-]{1,29}$/.test(item.code)) errors.code = 'Gunakan 2–30 karakter: huruf, angka, atau tanda hubung.';
  if (!categories.includes(item.category)) errors.category = 'Pilih kategori yang tersedia.';
  if (item.location.length < 2 || item.location.length > 100) errors.location = 'Lokasi harus 2–100 karakter.';
  if (!Number.isInteger(item.quantity) || item.quantity < 0 || item.quantity > 100000) errors.quantity = 'Jumlah harus bilangan bulat 0–100.000.';
  if (!statuses.includes(item.status)) errors.status = 'Pilih status yang valid.';
  return { item, errors };
}
