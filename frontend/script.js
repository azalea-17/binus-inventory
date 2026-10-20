/*
 * BINUS Inventory frontend
 * API contract:
 * GET    /api/items                 -> [{ id, name, code, category, location, quantity, status }]
 * POST   /api/items                 -> created item JSON
 * PUT    /api/items/:id             -> updated item JSON (or 204)
 * DELETE /api/items/:id             -> 204 (or success JSON)
 * GET    /api/health                 -> optional health endpoint
 *
 * Demo mode is optional for UI development; normal use connects to PostgreSQL through the API.
 */
const API_BASE = '/api';
const DEMO_MODE = false;
const STORAGE_KEY = 'binus-inventory-demo-v1';
const PROFILE_STORAGE_KEY = 'binus-inventory-profile-v1';
const DEFAULT_PROFILE = { name: 'Inventory Admin', department: 'Campus Operations' };
const STATUS = {
  available: { label: 'Tersedia', className: 'available' },
  borrowed: { label: 'Dipinjam', className: 'borrowed' },
  maintenance: { label: 'Perlu pemeriksaan', className: 'maintenance' }
};
const CATEGORY_CLASS = { Elektronik: 'electronics', Furnitur: 'furniture', Laboratorium: 'lab', Perlengkapan: 'supplies' };
const CATEGORY_ICON = { Elektronik: '▣', Furnitur: '▤', Laboratorium: '⌁', Perlengkapan: '▧' };
const seedItems = [
  { id: 1, name: 'Proyektor Epson EB-X51', code: 'BIN-ELE-001', category: 'Elektronik', location: 'Ruang Kelas 402', quantity: 8, status: 'available' },
  { id: 2, name: 'Laptop Lenovo ThinkPad', code: 'BIN-ELE-014', category: 'Elektronik', location: 'Lab Komputer 1', quantity: 24, status: 'borrowed' },
  { id: 3, name: 'Kursi Kuliah', code: 'BIN-FUR-032', category: 'Furnitur', location: 'Binus Paskal', quantity: 60, status: 'available' },
  { id: 4, name: 'Arduino Starter Kit', code: 'BIN-LAB-008', category: 'Laboratorium', location: 'Lab IoT', quantity: 12, status: 'maintenance' },
  { id: 5, name: 'Monitor Dell 24 inch', code: 'BIN-ELE-021', category: 'Elektronik', location: 'Lab Komputer 2', quantity: 18, status: 'available' },
  { id: 6, name: 'Whiteboard Portable', code: 'BIN-FUR-041', category: 'Furnitur', location: 'Ruang Meeting 3', quantity: 5, status: 'borrowed' },
  { id: 7, name: 'Kabel HDMI 5 meter', code: 'BIN-PRL-017', category: 'Perlengkapan', location: 'Ruang AV', quantity: 15, status: 'available' }
];
let items = [];
let editingId = null;
let pendingDeleteId = null;
let loadError = '';
let currentView = 'dashboard';
let accountTrigger = null;
let accountDialogTrigger = null;
let profile = readProfile();
let searchTerm = '';
let categoryValue = '';
let statusValue = '';
const $ = (id) => document.getElementById(id);

function readDemoItems() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return JSON.parse(saved);
  } catch (error) { console.warn('Demo storage unavailable:', error); }
  return seedItems.map(item => ({ ...item }));
}
function saveDemoItems() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(items)); }
  catch (error) { console.warn('Could not save demo items:', error); }
}
function readProfile() {
  try {
    const saved = JSON.parse(localStorage.getItem(PROFILE_STORAGE_KEY));
    if (typeof saved?.name === 'string' && saved.name.trim().length >= 2 && saved.name.length <= 60 &&
        typeof saved?.department === 'string' && saved.department.trim().length >= 2 && saved.department.length <= 80) {
      return { name: saved.name.trim(), department: saved.department.trim() };
    }
  } catch (error) { console.warn('Could not read profile:', error); }
  return { ...DEFAULT_PROFILE };
}
function renderProfile() {
  const initials = profile.name.split(/\s+/).slice(0, 2).map(word => Array.from(word)[0]).join('').toUpperCase();
  document.querySelectorAll('[data-profile-initials]').forEach(node => { node.textContent = initials; });
  document.querySelectorAll('[data-profile-name]').forEach(node => { node.textContent = profile.name; });
  document.querySelectorAll('[data-profile-department]').forEach(node => { node.textContent = profile.department; });
}
function closeAccountMenu({ restoreFocus = false } = {}) {
  $('accountMenu').hidden = true;
  document.querySelectorAll('[data-account-trigger]').forEach(button => button.setAttribute('aria-expanded', 'false'));
  if (restoreFocus) accountTrigger?.focus();
}
function toggleAccountMenu(button) {
  const menu = $('accountMenu');
  if (!menu.hidden && accountTrigger === button) {
    closeAccountMenu({ restoreFocus: true });
    return;
  }
  closeAccountMenu();
  accountTrigger = button;
  button.setAttribute('aria-expanded', 'true');
  menu.hidden = false;
  const rect = button.getBoundingClientRect();
  const left = Math.max(12, Math.min(rect.right - menu.offsetWidth, window.innerWidth - menu.offsetWidth - 12));
  const top = rect.bottom + menu.offsetHeight + 10 <= window.innerHeight - 12 ? rect.bottom + 10 : rect.top - menu.offsetHeight - 10;
  menu.style.left = `${left}px`;
  menu.style.top = `${Math.max(12, top)}px`;
  $('editProfileBtn').focus();
}
function openAccountDialog(id) {
  accountDialogTrigger = $('accountMenu').hidden ? document.activeElement : accountTrigger;
  closeAccountMenu();
  if (id === 'profileModal') {
    $('profileName').value = profile.name;
    $('profileDepartment').value = profile.department;
    $('profileName').setCustomValidity('');
    $('profileDepartment').setCustomValidity('');
  }
  $(id).hidden = false;
  document.body.style.overflow = 'hidden';
  $(id).querySelector('input, button').focus();
}
function closeAccountDialog() {
  $('profileModal').hidden = true;
  $('helpModal').hidden = true;
  document.body.style.overflow = '';
  accountDialogTrigger?.focus();
}
function saveProfile(event) {
  event.preventDefault();
  const name = $('profileName').value.trim();
  const department = $('profileDepartment').value.trim();
  $('profileName').setCustomValidity(name.length < 2 ? 'Nama tampilan minimal 2 karakter.' : '');
  $('profileDepartment').setCustomValidity(department.length < 2 ? 'Unit kerja minimal 2 karakter.' : '');
  if (!$('profileForm').reportValidity()) return;
  try {
    const updated = { name, department };
    localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(updated));
    profile = updated;
    renderProfile();
    closeAccountDialog();
    toast('Profil disimpan', 'Nama tampilan dan unit kerja diperbarui di browser ini.');
  } catch (error) {
    console.error('Could not save profile:', error);
    toast('Profil belum tersimpan', 'Penyimpanan browser tidak tersedia. Coba lagi setelah penyimpanan diizinkan.', 'error');
  }
}
function showView({ focus = false } = {}) {
  currentView = location.hash === '#inventory' ? 'inventory' : 'dashboard';
  const dashboard = currentView === 'dashboard';
  $('currentPage').textContent = dashboard ? 'Dashboard' : 'Data Inventaris';
  $('pageTitle').innerHTML = dashboard ? 'Inventory overview<span>.</span>' : 'Data inventaris<span>.</span>';
  $('pageDescription').textContent = dashboard ? 'Kelola dan pantau aset kampus dalam satu tempat.' : 'Cari, filter, dan kelola seluruh aset kampus.';
  $('dashboardStats').hidden = !dashboard;
  $('inventoryToolbar').hidden = dashboard;
  $('viewAllLink').hidden = !dashboard;
  $('inventoryTitle').textContent = dashboard ? 'Inventaris terbaru' : 'Daftar inventaris';
  $('inventoryDescription').textContent = dashboard ? 'Lima barang terakhir yang ditambahkan.' : 'Seluruh data aset dan perlengkapan kampus.';
  document.querySelectorAll('[data-view]').forEach(link => {
    const active = link.dataset.view === currentView;
    link.classList.toggle('active', active);
    if (active) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  });
  closeAccountMenu();
  $('sidebar').classList.remove('open');
  render();
  if (focus) {
    window.scrollTo(0, 0);
    $('pageTitle').focus({ preventScroll: true });
  }
}
async function apiRequest(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: { ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...(options.headers || {}) }
  });
  if (!response.ok) {
    let message = `Permintaan gagal (${response.status})`;
    try { const body = await response.json(); message = body.message || body.error || message; } catch (_) {}
    throw new Error(message);
  }
  if (response.status === 204) return null;
  const type = response.headers.get('content-type') || '';
  return type.includes('application/json') ? response.json() : null;
}
function normalizeItems(payload) {
  // Accept either a plain array or { items: [...] } response from the API.
  const list = Array.isArray(payload) ? payload : payload?.items;
  if (!Array.isArray(list)) throw new Error('Format data API tidak sesuai. Backend perlu mengembalikan array barang.');
  return list.map(item => ({
    ...item,
    id: item.id,
    name: String(item.name ?? ''),
    code: String(item.code ?? ''),
    category: String(item.category ?? 'Perlengkapan'),
    location: String(item.location ?? '-'),
    quantity: Number(item.quantity ?? 0),
    status: STATUS[item.status] ? item.status : 'available'
  }));
}
async function loadItems({ quiet = false } = {}) {
  if (DEMO_MODE) {
    items = readDemoItems();
    loadError = '';
    render();
    return;
  }
  try {
    const payload = await apiRequest('/items');
    items = normalizeItems(payload);
    loadError = '';
    render();
  } catch (error) {
    loadError = error.message;
    renderErrorState(error.message);
    if (!quiet) toast('Koneksi gagal', `${error.message}. Periksa backend dan konfigurasi Nginx.`, 'error');
  }
}
function renderErrorState(message) {
  $('inventoryBody').innerHTML = `<tr><td colspan="7" class="empty-cell"><div class="empty-state"><strong>Data belum dapat dimuat</strong><span>${escapeHTML(message)}</span><span>Pastikan backend aktif dan endpoint GET /api/items tersedia.</span></div></td></tr>`;
  $('statTotal').textContent = '—'; $('statAvailable').textContent = '—'; $('statBorrowed').textContent = '—'; $('statMaintenance').textContent = '—';
  $('recordCount').textContent = '— item'; $('tableSummary').textContent = 'Tidak dapat mengambil data';
}
function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
}
function filteredItems() {
  return items.filter(item => {
    const query = searchTerm.toLowerCase();
    const matchesText = !query || item.name.toLowerCase().includes(query) || item.code.toLowerCase().includes(query) || item.location.toLowerCase().includes(query);
    return matchesText && (!categoryValue || item.category === categoryValue) && (!statusValue || item.status === statusValue);
  });
}
function render() {
  if (loadError) { renderErrorState(loadError); return; }
  const available = items.filter(item => item.status === 'available').length;
  const borrowed = items.filter(item => item.status === 'borrowed').length;
  const maintenance = items.filter(item => item.status === 'maintenance').length;
  $('statTotal').textContent = items.length.toLocaleString('id-ID');
  $('statAvailable').textContent = available.toLocaleString('id-ID');
  $('statBorrowed').textContent = borrowed.toLocaleString('id-ID');
  $('statMaintenance').textContent = maintenance.toLocaleString('id-ID');
  const visible = currentView === 'dashboard' ? items.slice(0, 5) : filteredItems();
  $('recordCount').textContent = `${visible.length} item`;
  $('tableSummary').textContent = `Menampilkan ${visible.length} dari ${items.length} jenis barang`;
  if (!visible.length) {
    const title = items.length ? 'Barang tidak ditemukan' : 'Belum ada barang';
    const message = items.length ? 'Coba ubah kata kunci atau filter pencarian.' : 'Klik Tambah barang untuk mencatat aset pertama.';
    $('inventoryBody').innerHTML = `<tr><td colspan="7" class="empty-cell"><div class="empty-state"><strong>${title}</strong><span>${message}</span></div></td></tr>`;
    return;
  }
  $('inventoryBody').innerHTML = visible.map(item => {
    const status = STATUS[item.status] || STATUS.available;
    return `<tr>
      <td><div class="item-cell"><div><div class="item-name">${escapeHTML(item.name)}</div><div class="item-subtitle">Campus asset</div></div></div></td>
      <td><span class="code-text">${escapeHTML(item.code)}</span></td>
      <td><span class="category-pill">${escapeHTML(item.category)}</span></td>
      <td>${escapeHTML(item.location)}</td><td><strong>${Number(item.quantity).toLocaleString('id-ID')}</strong></td>
      <td><span class="status-pill ${status.className}">${status.label}</span></td>
      <td><div class="row-actions"><button class="small-action" data-action="edit" data-id="${escapeHTML(item.id)}" aria-label="Edit ${escapeHTML(item.name)}" title="Edit">✎</button><button class="small-action delete" data-action="delete" data-id="${escapeHTML(item.id)}" aria-label="Hapus ${escapeHTML(item.name)}" title="Hapus">⌫</button></div></td>
    </tr>`;
  }).join('');
}
function clearErrors() {
  ['name', 'code', 'category', 'location', 'quantity', 'status'].forEach(key => {
    const field = $(`item${key[0].toUpperCase()}${key.slice(1)}`);
    const error = $(`${key}Error`);
    if (field) field.removeAttribute('aria-invalid');
    if (error) error.textContent = '';
  });
}
function setFieldError(key, message) {
  const field = $(`item${key[0].toUpperCase()}${key.slice(1)}`);
  const error = $(`${key}Error`);
  if (field) field.setAttribute('aria-invalid', 'true');
  if (error) error.textContent = message;
}
function validateForm() {
  clearErrors();
  const values = {
    name: $('itemName').value.trim(), code: $('itemCode').value.trim().toUpperCase(),
    category: $('itemCategory').value, location: $('itemLocation').value.trim(),
    quantity: $('itemQuantity').value, status: $('itemStatus').value
  };
  let valid = true;
  if (values.name.length < 2) { setFieldError('name', 'Nama barang minimal 2 karakter.'); valid = false; }
  if (!values.code || !/^[A-Z0-9][A-Z0-9-]{1,29}$/.test(values.code)) { setFieldError('code', 'Gunakan 2–30 karakter: huruf, angka, atau tanda hubung.'); valid = false; }
  if (!['Elektronik','Furnitur','Laboratorium','Perlengkapan'].includes(values.category)) { setFieldError('category', 'Pilih kategori yang tersedia.'); valid = false; }
  if (values.location.length < 2) { setFieldError('location', 'Lokasi minimal 2 karakter.'); valid = false; }
  const quantity = Number(values.quantity);
  if (values.quantity === '' || !Number.isInteger(quantity) || quantity < 0 || quantity > 100000) { setFieldError('quantity', 'Jumlah harus bilangan bulat 0–100.000.'); valid = false; }
  if (!Object.hasOwn(STATUS, values.status)) { setFieldError('status', 'Pilih status yang valid.'); valid = false; }
  const duplicate = items.some(item => String(item.code).toUpperCase() === values.code && String(item.id) !== String(editingId));
  if (duplicate) { setFieldError('code', 'Kode aset sudah digunakan.'); valid = false; }
  if (valid) values.quantity = quantity;
  return valid ? values : null;
}
function openForm(item = null) {
  editingId = item ? item.id : null;
  $('modalTitle').textContent = item ? 'Edit barang' : 'Tambah barang';
  $('saveItemBtn').textContent = item ? 'Simpan perubahan' : 'Simpan barang';
  $('itemName').value = item?.name ?? '';
  $('itemCode').value = item?.code ?? '';
  $('itemCategory').value = item?.category ?? '';
  $('itemLocation').value = item?.location ?? '';
  $('itemQuantity').value = item?.quantity ?? 1;
  $('itemStatus').value = item?.status ?? 'available';
  clearErrors();
  $('itemModal').hidden = false;
  document.body.style.overflow = 'hidden';
  setTimeout(() => $('itemName').focus(), 0);
}
function closeForm() { $('itemModal').hidden = true; document.body.style.overflow = ''; editingId = null; }
function toast(title, message, type = 'success') {
  const node = document.createElement('div');
  node.className = `toast ${type}`;
  node.innerHTML = `<span class="toast-mark">${type === 'success' ? '✓' : '!'}</span><div><strong>${escapeHTML(title)}</strong><p>${escapeHTML(message)}</p></div>`;
  $('toastRegion').appendChild(node);
  setTimeout(() => node.remove(), 4200);
}
async function saveItem(values) {
  const wasEditing = editingId !== null;
  $('saveItemBtn').disabled = true;
  $('saveItemBtn').textContent = 'Menyimpan...';
  try {
    if (DEMO_MODE) {
      if (editingId !== null) items = items.map(item => String(item.id) === String(editingId) ? { ...item, ...values } : item);
      else items.unshift({ id: `demo-${Date.now()}`, ...values });
      saveDemoItems();
    } else if (editingId !== null) {
      await apiRequest(`/items/${encodeURIComponent(editingId)}`, { method: 'PUT', body: JSON.stringify(values) });
    } else {
      await apiRequest('/items', { method: 'POST', body: JSON.stringify(values) });
    }
    closeForm();
    if (DEMO_MODE) render(); else await loadItems({ quiet: true });
    toast(wasEditing ? 'Perubahan disimpan' : 'Barang ditambahkan', DEMO_MODE ? 'Berhasil di mode demo. Belum tersimpan di PostgreSQL.' : 'Data berhasil disimpan ke server.');
  } catch (error) {
    toast('Gagal menyimpan', error.message, 'error');
  } finally {
    $('saveItemBtn').disabled = false;
    $('saveItemBtn').textContent = wasEditing ? 'Simpan perubahan' : 'Simpan barang';
  }
}
function askDelete(id) {
  const item = items.find(entry => String(entry.id) === String(id));
  if (!item) return;
  pendingDeleteId = id;
  $('confirmText').textContent = `Barang “${item.name}” (${item.code}) akan dihapus dari inventaris.`;
  $('confirmModal').hidden = false;
  document.body.style.overflow = 'hidden';
}
function closeDelete() { $('confirmModal').hidden = true; pendingDeleteId = null; document.body.style.overflow = ''; }
async function deleteItem() {
  if (pendingDeleteId === null) return;
  const id = pendingDeleteId;
  $('confirmDelete').disabled = true;
  try {
    if (DEMO_MODE) { items = items.filter(item => String(item.id) !== String(id)); saveDemoItems(); }
    else await apiRequest(`/items/${encodeURIComponent(id)}`, { method: 'DELETE' });
    closeDelete();
    if (DEMO_MODE) render(); else await loadItems({ quiet: true });
    toast('Barang dihapus', DEMO_MODE ? 'Data demo berhasil dihapus dari browser.' : 'Data berhasil dihapus dari database.');
  } catch (error) { toast('Gagal menghapus', error.message, 'error'); }
  finally { $('confirmDelete').disabled = false; }
}

$('addItemBtn').addEventListener('click', () => openForm());
$('closeModal').addEventListener('click', closeForm);
$('cancelModal').addEventListener('click', closeForm);
$('itemModal').addEventListener('click', event => { if (event.target === $('itemModal')) closeForm(); });
$('itemForm').addEventListener('submit', event => { event.preventDefault(); const values = validateForm(); if (values) saveItem(values); });
$('inventoryBody').addEventListener('click', event => {
  const button = event.target.closest('button[data-action]');
  if (!button) return;
  const item = items.find(entry => String(entry.id) === button.dataset.id);
  if (button.dataset.action === 'edit' && item) openForm(item);
  if (button.dataset.action === 'delete') askDelete(button.dataset.id);
});
$('searchInput').addEventListener('input', event => { searchTerm = event.target.value.trim(); render(); });
$('categoryFilter').addEventListener('change', event => { categoryValue = event.target.value; render(); });
$('statusFilter').addEventListener('change', event => { statusValue = event.target.value; render(); });
$('cancelDelete').addEventListener('click', closeDelete);
$('confirmDelete').addEventListener('click', deleteItem);
$('confirmModal').addEventListener('click', event => { if (event.target === $('confirmModal')) closeDelete(); });
$('mobileMenu').addEventListener('click', () => $('sidebar').classList.toggle('open'));
$('refreshItemsBtn').addEventListener('click', async () => {
  $('refreshItemsBtn').disabled = true;
  $('refreshItemsBtn').textContent = 'Memuat...';
  try { await loadItems(); }
  finally { $('refreshItemsBtn').disabled = false; $('refreshItemsBtn').textContent = 'Muat ulang'; }
});
document.querySelectorAll('[data-account-trigger]').forEach(button => {
  button.addEventListener('click', () => toggleAccountMenu(button));
});
$('editProfileBtn').addEventListener('click', () => openAccountDialog('profileModal'));
$('accountHelpBtn').addEventListener('click', () => openAccountDialog('helpModal'));
$('sidebarHelpBtn').addEventListener('click', () => openAccountDialog('helpModal'));
$('profileForm').addEventListener('submit', saveProfile);
['profileName', 'profileDepartment'].forEach(id => {
  $(id).addEventListener('input', () => $(id).setCustomValidity(''));
});
document.querySelectorAll('[data-close-account-dialog]').forEach(button => button.addEventListener('click', closeAccountDialog));
['profileModal', 'helpModal'].forEach(id => {
  $(id).addEventListener('click', event => { if (event.target === $(id)) closeAccountDialog(); });
});
$('helpInventoryBtn').addEventListener('click', () => {
  closeAccountDialog();
  location.hash = 'inventory';
  showView({ focus: true });
});
document.addEventListener('click', event => {
  if (!event.target.closest('[data-account-trigger], #accountMenu')) closeAccountMenu();
});
document.addEventListener('focusin', event => {
  if (!$('accountMenu').hidden && !event.target.closest('[data-account-trigger], #accountMenu')) closeAccountMenu();
});
window.addEventListener('resize', () => closeAccountMenu());
window.addEventListener('hashchange', () => showView({ focus: true }));
document.querySelectorAll('[data-view], .brand').forEach(link => {
  link.addEventListener('click', () => $('sidebar').classList.remove('open'));
});
document.addEventListener('keydown', event => {
  if (event.key === 'Escape') {
    if (!$('itemModal').hidden) closeForm();
    if (!$('confirmModal').hidden) closeDelete();
    if (!$('profileModal').hidden || !$('helpModal').hidden) closeAccountDialog();
    if (!$('accountMenu').hidden) closeAccountMenu({ restoreFocus: true });
    $('sidebar').classList.remove('open');
  }
  if (event.key === 'Tab') {
    const dialog = document.querySelector('.modal-backdrop:not([hidden]) [role="dialog"], .confirm-backdrop:not([hidden]) [role="alertdialog"]');
    if (!dialog) return;
    const fields = [...dialog.querySelectorAll('button:not(:disabled), input:not(:disabled), select:not(:disabled), a[href]')];
    const first = fields[0];
    const last = fields[fields.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }
});
renderProfile();
showView();
loadItems();
