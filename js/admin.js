// ===== Zelvra Admin Panel =====

let productsCache = [];
let ordersCache = [];
let editingProductId = null;

/** Treat active flexibly: yes / true / 1 / visible / "Yes – Visible" etc. */
function parseActive(val) {
  if (val === true || val === 1) return true;
  if (val === false || val === 0) return false;
  const s = String(val ?? 'yes').toLowerCase().trim();
  if (!s) return true;
  if (s === 'no' || s === 'false' || s === '0' || s === 'hidden' || s.startsWith('no')) return false;
  // yes, true, 1, "yes – visible", "Yes – Visible", etc.
  return true;
}


// ---------- Auth ----------
function tryLogin() {
  const email = (document.getElementById('admin-email')?.value || '').trim().toLowerCase();
  const pass = document.getElementById('admin-pass')?.value || '';
  const okEmail = email === String(CONFIG.ADMIN_EMAIL || 'admin@zalvra.com').toLowerCase();
  const okPass = pass === String(CONFIG.ADMIN_PASSWORD || 'zalvra');
  if (okEmail && okPass) {
    sessionStorage.setItem('zelvra_admin', '1');
    document.getElementById('login-error').style.display = 'none';
    showAdmin();
  } else {
    const err = document.getElementById('login-error');
    if (err) {
      err.textContent = 'Wrong email or password';
      err.style.display = 'block';
    }
  }
}

function logout() {
  sessionStorage.removeItem('zelvra_admin');
  location.reload();
}

function showAdmin() {
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('admin-app').style.display = 'block';
  const cfgP = document.getElementById('cfg-products');
  const cfgO = document.getElementById('cfg-orders');
  const url = CONFIG.APPS_SCRIPT_URL || 'Not set';
  if (cfgP) cfgP.textContent = url.length > 48 ? url.slice(0, 48) + '…' : url;
  if (cfgO) cfgO.textContent = 'Same Apps Script URL (Orders)';
  const imgbbEl = document.getElementById('cfg-imgbb');
  if (imgbbEl) {
    imgbbEl.textContent = CONFIG.IMGBB_API_KEY
      ? (String(CONFIG.IMGBB_API_KEY).slice(0, 8) + '… (active)')
      : 'Not set – paste image URL instead';
  }
  checkConfig();
  refreshAll();
}

['admin-email', 'admin-pass'].forEach(id => {
  document.getElementById(id)?.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); tryLogin(); }
  });
});

if (sessionStorage.getItem('zelvra_admin') === '1') {
  showAdmin();
}

// ---------- Tabs ----------
function switchTab(name) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === name));
  document.querySelectorAll('.panel').forEach(p => p.classList.toggle('active', p.id === 'panel-' + name));
  if (name === 'products') renderProducts();
  if (name === 'orders') renderOrders();
}

// ---------- Config check ----------
function checkConfig() {
  const el = document.getElementById('config-warn');
  if (!CONFIG.APPS_SCRIPT_URL) {
    el.style.display = 'block';
    el.innerHTML = `<strong>Google Apps Script not configured.</strong> Set <code>APPS_SCRIPT_URL</code> in <code>js/config.js</code>.`;
  } else {
    el.style.display = 'none';
  }
}

// ---------- Toast ----------
function toast(msg, type = '') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'toast show ' + type;
  setTimeout(() => t.classList.remove('show'), 3000);
}

// ---------- API helpers (Google Apps Script) ----------
async function apiRequest(payload) {
  if (!CONFIG.apiUrl) throw new Error('APPS_SCRIPT_URL not set in config.js');
  const res = await fetch(CONFIG.apiUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(payload),
    redirect: 'follow'
  });
  const text = await res.text();
  if (text.trim().startsWith('<!DOCTYPE') || text.trim().startsWith('<html')) {
    throw new Error('Apps Script returned HTML — paste GOOGLE_APPS_SCRIPT.js and redeploy as Anyone');
  }
  let data;
  try { data = JSON.parse(text); } catch (e) { throw new Error('Invalid API response'); }
  if (data && data.success === false) throw new Error(data.error || 'API failed');
  return data;
}

async function apiGetProducts() {
  const res = await fetch(CONFIG.productsUrl, { cache: 'no-store' });
  if (!res.ok) throw new Error('GET products failed: ' + res.status);
  let data = await res.json();
  if (data && Array.isArray(data.products)) return data.products;
  if (data && Array.isArray(data.data)) return data.data;
  if (Array.isArray(data)) return data;
  return [];
}

async function apiGetOrders() {
  const res = await fetch(CONFIG.ordersUrl, { cache: 'no-store' });
  if (!res.ok) throw new Error('GET orders failed: ' + res.status);
  let data = await res.json();
  if (data && Array.isArray(data.orders)) return data.orders;
  if (data && Array.isArray(data.data)) return data.data;
  if (Array.isArray(data)) return data;
  return [];
}

// ---------- Load data ----------
async function refreshAll() {
  await Promise.all([loadProducts(), loadOrders()]);
  updateStats();
  renderRecentOrders();
}

async function loadProducts() {
  if (!CONFIG.apiUrl) {
    productsCache = [];
    renderProducts();
    return;
  }
  try {
    const data = await apiGetProducts();
    productsCache = (Array.isArray(data) ? data : []).map(normalizeProduct);
    renderProducts();
  } catch (e) {
    console.error(e);
    toast('Failed to load products', 'error');
    productsCache = [];
    renderProducts();
  }
}

async function loadOrders() {
  if (!CONFIG.apiUrl) {
    ordersCache = [];
    renderOrders();
    return;
  }
  try {
    const data = await apiGetOrders();
    ordersCache = (Array.isArray(data) ? data : []).map(o => ({
      ...o,
      total: parseFloat(o.total) || 0
    })).sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    renderOrders();
  } catch (e) {
    console.error(e);
    toast('Failed to load orders', 'error');
    ordersCache = [];
    renderOrders();
  }
}

function normalizeProduct(p) {
  return {
    id: String(p.id || ''),
    name: p.name || '',
    range: p.range || '',
    price: parseFloat(p.price) || 0,
    oldPrice: p.oldPrice && p.oldPrice !== '' ? parseFloat(p.oldPrice) : null,
    image: p.image || '',
    image2: p.image2 || '',
    image3: p.image3 || '',
    badge: p.badge || '',
    description: p.description || '',
    notes: p.notes || '',
    stock: parseInt(p.stock) || 0,
    active: parseActive(p.active),
  };
}

// ---------- Stats ----------
function updateStats() {
  document.getElementById('stat-products').textContent = productsCache.length;
  document.getElementById('stat-orders').textContent = ordersCache.length;
  document.getElementById('stat-pending').textContent = ordersCache.filter(o => (o.status || '').toLowerCase() === 'pending').length;
  const revenue = ordersCache
    .filter(o => !['cancelled'].includes((o.status || '').toLowerCase()))
    .reduce((s, o) => s + (parseFloat(o.total) || 0), 0);
  document.getElementById('stat-revenue').textContent = revenue.toLocaleString();
}

// ---------- Render Products ----------
function renderProducts() {
  const list = document.getElementById('products-list');
  if (!productsCache.length) {
    list.innerHTML = `<div class="empty-state"><i class="fas fa-box-open"></i><p>No products yet. Click “Add Product”.</p></div>`;
    return;
  }
  list.innerHTML = productsCache.map(p => `
    <div class="item-card">
      <img src="${p.image || 'https://via.placeholder.com/90?text=No+Img'}" alt="${esc(p.name)}" onerror="this.src='https://via.placeholder.com/90?text=No+Img'">
      <div class="info">
        <h3>${esc(p.name)}</h3>
        <div class="meta">
          ${esc(p.range)} · Stock: ${p.stock}
          ${p.badge ? `<span class="badge badge-${p.badge.toLowerCase()}">${esc(p.badge)}</span>` : ''}
          <span class="badge ${p.active ? 'badge-active' : 'badge-inactive'}">${p.active ? 'Active' : 'Hidden'}</span>
        </div>
        <div class="price">Rs. ${p.price.toLocaleString()}${p.oldPrice ? ` <s style="color:#666;font-weight:400">Rs. ${p.oldPrice.toLocaleString()}</s>` : ''}</div>
      </div>
      <div class="actions">
        <button class="btn btn-outline btn-sm" onclick="editProduct('${p.id}')"><i class="fas fa-edit"></i> Edit</button>
        <button class="btn btn-danger btn-sm" onclick="deleteProduct('${p.id}')"><i class="fas fa-trash"></i></button>
      </div>
    </div>
  `).join('');
}

// ---------- Product Modal ----------
function openProductModal(product = null) {
  editingProductId = product ? product.id : null;
  document.getElementById('product-modal-title').textContent = product ? 'Edit Product' : 'Add Product';
  document.getElementById('p-id').value = product?.id || '';
  document.getElementById('p-name').value = product?.name || '';
  document.getElementById('p-range').value = product?.range || '';
  document.getElementById('p-badge').value = product?.badge || '';
  document.getElementById('p-price').value = product?.price || '';
  document.getElementById('p-oldPrice').value = product?.oldPrice || '';
  document.getElementById('p-stock').value = product?.stock ?? 100;
  document.getElementById('p-description').value = product?.description || '';
  document.getElementById('p-notes').value = product?.notes || '';
  document.getElementById('p-active').value = product?.active === false ? 'no' : 'yes';

  // Reset file inputs
  ['p-image-file', 'p-image2-file', 'p-image3-file'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });

  setImageSlot('p-image', 'preview1', 'status1', 'clear1', product?.image || '');
  setImageSlot('p-image2', 'preview2', 'status2', 'clear2', product?.image2 || '');
  setImageSlot('p-image3', 'preview3', 'status3', 'clear3', product?.image3 || '');

  document.getElementById('product-modal').classList.add('open');
}

function closeProductModal() {
  document.getElementById('product-modal').classList.remove('open');
  editingProductId = null;
}

function setImageSlot(urlInputId, previewId, statusId, clearId, url) {
  const urlInput = document.getElementById(urlInputId);
  const img = document.getElementById(previewId);
  const status = document.getElementById(statusId);
  const clearBtn = document.getElementById(clearId);
  if (urlInput) urlInput.value = url || '';
  if (status) status.innerHTML = '';
  if (url) {
    if (img) {
      img.src = url;
      img.style.display = 'block';
    }
    if (clearBtn) clearBtn.style.display = 'inline-flex';
    if (status) status.innerHTML = `<span class="upload-ok"><i class="fas fa-check-circle"></i> Image ready</span>`;
  } else {
    if (img) {
      img.src = '';
      img.style.display = 'none';
    }
    if (clearBtn) clearBtn.style.display = 'none';
  }
}

function previewImg(inputId, previewId) {
  const url = document.getElementById(inputId)?.value;
  const img = document.getElementById(previewId);
  if (!img) return;
  if (url) {
    img.src = url;
    img.style.display = 'block';
  } else {
    img.style.display = 'none';
  }
}

const ALLOWED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/jpg'];
const ALLOWED_IMAGE_EXT = ['.png', '.jpg', '.jpeg'];

function isAllowedImageFile(file) {
  if (!file) return false;
  const typeOk = ALLOWED_IMAGE_TYPES.includes((file.type || '').toLowerCase());
  const name = (file.name || '').toLowerCase();
  const extOk = ALLOWED_IMAGE_EXT.some(ext => name.endsWith(ext));
  return typeOk || extOk;
}

function clearImage(urlInputId, previewId, statusId, fileInputId, clearId) {
  setImageSlot(urlInputId, previewId, statusId, clearId, '');
  const fileInput = document.getElementById(fileInputId);
  if (fileInput) fileInput.value = '';
}

/**
 * Upload selected file to ImgBB and store public URL in the hidden field.
 * Admin never needs to paste a URL.
 */
async function handleImageSelect(event, urlInputId, previewId, statusId) {
  const file = event.target.files && event.target.files[0];
  const status = document.getElementById(statusId);
  const clearId = statusId === 'status1' ? 'clear1' : statusId === 'status2' ? 'clear2' : 'clear3';

  if (!file) return;

  if (!isAllowedImageFile(file)) {
    if (status) status.innerHTML = `<span class="upload-err"><i class="fas fa-times-circle"></i> Only PNG, JPG, JPEG allowed</span>`;
    event.target.value = '';
    toast('Only PNG, JPG, and JPEG images are allowed', 'error');
    return;
  }

  const maxMb = Number(CONFIG.IMAGE_MAX_MB) || 8;
  if (file.size > maxMb * 1024 * 1024) {
    if (status) status.innerHTML = `<span class="upload-err"><i class="fas fa-times-circle"></i> Max ${maxMb} MB</span>`;
    event.target.value = '';
    toast(`Image must be under ${maxMb} MB`, 'error');
    return;
  }

  if (!CONFIG.IMGBB_API_KEY) {
    if (status) status.innerHTML = `<span class="upload-err"><i class="fas fa-times-circle"></i> Paste an image URL in the field, or add IMGBB_API_KEY</span>`;
    toast('Paste a public image URL, or add IMGBB_API_KEY in config.js for uploads', 'error');
    event.target.value = '';
    return;
  }

  if (status) status.innerHTML = `<span class="upload-busy"><i class="fas fa-spinner fa-spin"></i> Uploading…</span>`;

  // Local preview while uploading
  const img = document.getElementById(previewId);
  if (img) {
    img.src = URL.createObjectURL(file);
    img.style.display = 'block';
  }

  try {
    const publicUrl = await uploadImageToStorage(file);
    const urlInput = document.getElementById(urlInputId);
    if (urlInput) urlInput.value = publicUrl;
    if (img) img.src = publicUrl;
    if (status) status.innerHTML = `<span class="upload-ok"><i class="fas fa-check-circle"></i> Uploaded – URL saved</span>`;
    const clearBtn = document.getElementById(clearId);
    if (clearBtn) clearBtn.style.display = 'inline-flex';
    toast('Image uploaded', 'success');
  } catch (err) {
    console.error(err);
    if (status) status.innerHTML = `<span class="upload-err"><i class="fas fa-times-circle"></i> ${esc(err.message || 'Upload failed')}</span>`;
    if (img) {
      img.src = '';
      img.style.display = 'none';
    }
    const urlInput = document.getElementById(urlInputId);
    if (urlInput) urlInput.value = '';
    toast('Image upload failed: ' + (err.message || 'error'), 'error');
  }
}

/** Store image via ImgBB and return a public HTTPS URL */
async function uploadImageToStorage(file) {
  const key = CONFIG.IMGBB_API_KEY;
  if (!key) throw new Error('IMGBB_API_KEY not set');

  const form = new FormData();
  form.append('image', file);
  form.append('name', (file.name || 'product').replace(/\.[^.]+$/, '').slice(0, 64));

  const res = await fetch(`https://api.imgbb.com/1/upload?key=${encodeURIComponent(key)}`, {
    method: 'POST',
    body: form
  });

  let json;
  try {
    json = await res.json();
  } catch {
    throw new Error('Invalid response from image storage');
  }

  if (!res.ok || !json.success) {
    const msg = json?.error?.message || json?.error?.code || ('HTTP ' + res.status);
    throw new Error(String(msg));
  }

  const url = json.data?.display_url || json.data?.url || json.data?.image?.url;
  if (!url) throw new Error('No URL returned from storage');
  return url;
}

// Expose for inline handlers
window.handleImageSelect = handleImageSelect;
window.clearImage = clearImage;

function editProduct(id) {
  const p = productsCache.find(x => String(x.id) === String(id));
  if (p) openProductModal(p);
}

async function saveProduct(e) {
  e.preventDefault();
  if (!CONFIG.apiUrl) {
    toast('Set APPS_SCRIPT_URL in config.js first', 'error');
    return;
  }

  const imageUrl = document.getElementById('p-image').value.trim();
  if (!imageUrl) {
    toast('Please upload a main product image (PNG / JPG)', 'error');
    return;
  }

  const btn = document.getElementById('save-product-btn');
  btn.disabled = true;
  btn.textContent = 'Saving…';

  const payload = {
    name: document.getElementById('p-name').value.trim(),
    range: document.getElementById('p-range').value.trim(),
    badge: document.getElementById('p-badge').value,
    price: document.getElementById('p-price').value,
    oldPrice: document.getElementById('p-oldPrice').value || '',
    stock: document.getElementById('p-stock').value || '0',
    image: imageUrl,
    image2: document.getElementById('p-image2').value.trim(),
    image3: document.getElementById('p-image3').value.trim(),
    description: document.getElementById('p-description').value.trim(),
    notes: document.getElementById('p-notes').value.trim(),
    active: document.getElementById('p-active').value
  };

  try {
    if (editingProductId) {
      payload.id = String(editingProductId);
      await apiRequest({ action: 'updateProduct', ...payload });
      toast('Product updated', 'success');
    } else {
      const maxId = productsCache.reduce((m, p) => Math.max(m, parseInt(p.id) || 0), 0);
      payload.id = String(maxId + 1);
      await apiRequest({ action: 'addProduct', ...payload });
      toast('Product added', 'success');
    }
    closeProductModal();
    await loadProducts();
    updateStats();
  } catch (err) {
    console.error(err);
    toast('Save failed: ' + err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Save Product';
  }
}

async function deleteProduct(id) {
  if (!confirm('Delete this product?')) return;
  if (!CONFIG.apiUrl) {
    toast('Apps Script not configured', 'error');
    return;
  }
  try {
    await apiRequest({ action: 'deleteProduct', id: String(id) });
    toast('Product deleted', 'success');
    await loadProducts();
    updateStats();
  } catch (err) {
    toast('Delete failed: ' + err.message, 'error');
  }
}

// ---------- Orders ----------
function renderOrders() {
  const filter = document.getElementById('order-filter')?.value || 'all';
  let list = ordersCache;
  if (filter !== 'all') {
    list = list.filter(o => (o.status || '').toLowerCase() === filter);
  }

  const el = document.getElementById('orders-list');
  if (!list.length) {
    el.innerHTML = `<div class="empty-state"><i class="fas fa-receipt"></i><p>No orders found.</p></div>`;
    return;
  }

  el.innerHTML = list.map(o => `
    <div class="item-card" style="grid-template-columns:1fr auto;">
      <div class="info">
        <h3>#${esc(o.orderId || o.id)} — ${esc(o.customerName || 'Guest')}</h3>
        <div class="meta">
          ${esc(o.phone || '')} · ${esc(o.city || '')} · ${formatDate(o.createdAt)}
          <span class="status status-${(o.status || 'pending').toLowerCase()}">${esc(o.status || 'pending')}</span>
        </div>
        <div class="price">Rs. ${(parseFloat(o.total) || 0).toLocaleString()}</div>
      </div>
      <div class="actions">
        <button class="btn btn-outline btn-sm" onclick="viewOrder('${o.id}')"><i class="fas fa-eye"></i> View</button>
      </div>
    </div>
  `).join('');
}

function renderRecentOrders() {
  const el = document.getElementById('recent-orders');
  const recent = ordersCache.slice(0, 5);
  if (!recent.length) {
    el.innerHTML = `<div class="empty-state"><p>No orders yet.</p></div>`;
    return;
  }
  el.innerHTML = recent.map(o => `
    <div class="item-card" style="grid-template-columns:1fr auto;">
      <div class="info">
        <h3>#${esc(o.orderId || o.id)} — ${esc(o.customerName || 'Guest')}</h3>
        <div class="meta">${formatDate(o.createdAt)} · <span class="status status-${(o.status || 'pending').toLowerCase()}">${esc(o.status || 'pending')}</span></div>
        <div class="price">Rs. ${(parseFloat(o.total) || 0).toLocaleString()}</div>
      </div>
      <div class="actions">
        <button class="btn btn-outline btn-sm" onclick="viewOrder('${o.id}')">View</button>
      </div>
    </div>
  `).join('');
}

function viewOrder(id) {
  const o = ordersCache.find(x => String(x.id) === String(id));
  if (!o) return;

  let itemsHtml = '';
  try {
    const items = typeof o.items === 'string' ? JSON.parse(o.items) : (o.items || []);
    itemsHtml = (Array.isArray(items) ? items : []).map(i =>
      `<div>${esc(i.name || 'Item')} × ${i.qty || 1} — Rs. ${((i.price || 0) * (i.qty || 1)).toLocaleString()}</div>`
    ).join('') || '<div>No item details</div>';
  } catch {
    itemsHtml = `<div>${esc(String(o.items || ''))}</div>`;
  }

  document.getElementById('order-detail-body').innerHTML = `
    <div class="form-group"><label>Order ID</label><p>#${esc(o.orderId || o.id)}</p></div>
    <div class="form-row">
      <div class="form-group"><label>Customer</label><p>${esc(o.customerName || '–')}</p></div>
      <div class="form-group"><label>Phone</label><p>${esc(o.phone || '–')}</p></div>
    </div>
    <div class="form-group"><label>Email</label><p>${esc(o.email || '–')}</p></div>
    <div class="form-group"><label>Address</label><p>${esc(o.address || '–')}, ${esc(o.city || '')}</p></div>
    <div class="form-group"><label>Items</label><div class="order-items">${itemsHtml}</div></div>
    <div class="form-group"><label>Total</label><p style="font-size:1.2rem;color:var(--gold);font-weight:700;">Rs. ${(parseFloat(o.total)||0).toLocaleString()}</p></div>
    <div class="form-group"><label>Notes</label><p>${esc(o.notes || '–')}</p></div>
    <div class="form-group">
      <label>Status</label>
      <select id="order-status" style="width:100%;padding:12px;border-radius:8px;background:#0f0f0f;color:#fff;border:1px solid #2a2a2a;">
        ${['pending','confirmed','shipped','delivered','cancelled'].map(s =>
          `<option value="${s}" ${(o.status||'pending').toLowerCase()===s?'selected':''}>${s.charAt(0).toUpperCase()+s.slice(1)}</option>`
        ).join('')}
      </select>
    </div>
    <div class="form-actions">
      <button class="btn btn-outline" onclick="closeOrderModal()">Close</button>
      <button class="btn btn-gold" onclick="updateOrderStatus('${o.id}')">Update Status</button>
    </div>
  `;
  document.getElementById('order-modal').classList.add('open');
}

function closeOrderModal() {
  document.getElementById('order-modal').classList.remove('open');
}

async function updateOrderStatus(id) {
  if (!CONFIG.apiUrl) {
    toast('Apps Script not configured', 'error');
    return;
  }
  const status = document.getElementById('order-status').value;
  try {
    await apiRequest({ action: 'updateOrderStatus', id: String(id), status });
    toast('Status updated', 'success');
    closeOrderModal();
    await loadOrders();
    updateStats();
    renderRecentOrders();
  } catch (err) {
    toast('Update failed: ' + err.message, 'error');
  }
}

// ---------- Utils ----------
function esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatDate(iso) {
  if (!iso) return '–';
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('en-PK', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch {
    return iso;
  }
}

// ---------- Bulk Upload (Excel / CSV) ----------
const PRODUCT_HEADERS = [
  'id', 'name', 'range', 'price', 'oldPrice', 'image', 'image2', 'image3',
  'badge', 'description', 'notes', 'stock', 'active'
];

const TEMPLATE_SAMPLE = [
  {
    id: '',
    name: 'Amber Oud',
    range: 'Executive Range',
    price: 2750,
    oldPrice: '',
    image: 'https://images.unsplash.com/photo-1594035910387-fea47794261f?w=500&q=80',
    image2: '',
    image3: '',
    badge: '',
    description: 'A classic amber-spicy fragrance with warm oud, citrus and rose.',
    notes: 'Lemon|Fig|Rose|Oud|Amber',
    stock: 50,
    active: 'yes',
  },
  {
    id: '',
    name: 'Catch 22',
    range: 'Executive Range',
    price: 1990,
    oldPrice: 2390,
    image: 'https://images.unsplash.com/photo-1587017539504-67cfbddac569?w=500&q=80',
    image2: '',
    image3: '',
    badge: 'Sale',
    description: 'Chypre fruity fragrance with bergamot, pineapple and woody base.',
    notes: 'Bergamot|Pineapple|Apple|Patchouli|Musk|Vanilla',
    stock: 40,
    active: 'yes',
  }
];

/** Trigger browser download from a Blob */
function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 200);
}

/** CSV escape */
function csvCell(v) {
  const s = String(v ?? '');
  if (/[",\n\r]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

/** Always-works CSV template (no library needed) */
function downloadCsvTemplate() {
  const lines = [];
  lines.push(PRODUCT_HEADERS.join(','));
  TEMPLATE_SAMPLE.forEach(row => {
    lines.push(PRODUCT_HEADERS.map(h => csvCell(row[h] ?? '')).join(','));
  });
  const blob = new Blob(['\uFEFF' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
  triggerDownload(blob, 'zelvra-products-template.csv');
  toast('CSV template downloaded', 'success');
}

/** Excel (.xlsx) template via SheetJS, falls back to CSV */
function downloadProductTemplate() {
  try {
    if (typeof XLSX === 'undefined') {
      console.warn('SheetJS not loaded – downloading CSV instead');
      downloadCsvTemplate();
      return;
    }

    const instructions = [
      ['Zelvra – Product Bulk Upload Template'],
      [''],
      ['INSTRUCTIONS'],
      ['1. Fill the "Products" sheet. Keep the header row exactly as provided.'],
      ['2. Leave "id" empty for new products (auto-generated). Or set a unique number to update existing.'],
      ['3. Required: name, price, image'],
      ['4. notes – separate fragrance notes with |  e.g. Bergamot|Rose|Oud'],
      ['5. active – yes or no (only yes shows on website)'],
      ['6. badge – Sale, New, or leave empty'],
      ['7. oldPrice / testerPrice – leave empty if not needed'],
      ['8. Save as .xlsx and upload via Bulk Upload button'],
      [''],
      ['HEADERS (exact)'],
      [PRODUCT_HEADERS.join(' | ')]
    ];

    const wb = XLSX.utils.book_new();
    const wsInfo = XLSX.utils.aoa_to_sheet(instructions);
    wsInfo['!cols'] = [{ wch: 90 }];
    XLSX.utils.book_append_sheet(wb, wsInfo, 'Instructions');

    const rows = [PRODUCT_HEADERS, ...TEMPLATE_SAMPLE.map(r => PRODUCT_HEADERS.map(h => r[h] ?? ''))];
    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = PRODUCT_HEADERS.map(h => ({ wch: Math.max(12, h.length + 2) }));
    XLSX.utils.book_append_sheet(wb, ws, 'Products');

    // Prefer write + blob (more reliable than writeFile in some environments)
    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([wbout], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    });
    triggerDownload(blob, 'zelvra-products-template.xlsx');
    toast('Excel template downloaded', 'success');
  } catch (err) {
    console.error('Excel template failed, falling back to CSV', err);
    try {
      downloadCsvTemplate();
    } catch (e2) {
      toast('Download failed: ' + (err.message || e2.message), 'error');
    }
  }
}

function normalizeBulkRow(row) {
  const get = (...keys) => {
    for (const k of keys) {
      if (row[k] !== undefined && row[k] !== null && String(row[k]).trim() !== '') {
        return String(row[k]).trim();
      }
      const found = Object.keys(row).find(
        rk => rk.toLowerCase().replace(/\s+/g, '') === k.toLowerCase().replace(/\s+/g, '')
      );
      if (found && row[found] !== undefined && row[found] !== null && String(row[found]).trim() !== '') {
        return String(row[found]).trim();
      }
    }
    return '';
  };

  const name = get('name');
  const price = get('price');
  const image = get('image');
  if (!name || !price || !image) return null;

  return {
    id: get('id'),
    name,
    range: get('range'),
    price,
    oldPrice: get('oldPrice', 'oldprice', 'old_price'),
    image,
    image2: get('image2', 'image_2'),
    image3: get('image3', 'image_3'),
    badge: get('badge'),
    description: get('description', 'desc'),
    notes: get('notes'),
    stock: get('stock') || '0',
    active: parseActive(get('active') || 'yes') ? 'yes' : 'no'
  };
}

async function handleBulkUpload(event) {
  const file = event.target.files?.[0];
  event.target.value = '';
  if (!file) return;

  if (!CONFIG.apiUrl) {
    toast('Set APPS_SCRIPT_URL in config.js first', 'error');
    return;
  }

  const progress = document.getElementById('bulk-progress');
  progress.style.display = 'block';
  progress.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Reading file…';

  try {
    let rawRows = [];
    const name = (file.name || '').toLowerCase();

    if (name.endsWith('.csv')) {
      // Parse CSV without SheetJS
      const text = await file.text();
      rawRows = parseCsv(text);
    } else {
      if (typeof XLSX === 'undefined') {
        progress.innerHTML = 'Excel library not loaded. Please upload a <strong>.csv</strong> file, or refresh the page and try again.';
        toast('Use CSV or refresh page', 'error');
        return;
      }
      const data = await file.arrayBuffer();
      const wb = XLSX.read(data, { type: 'array' });
      const sheetName = wb.SheetNames.find(n => n.toLowerCase() === 'products') || wb.SheetNames[0];
      const sheet = wb.Sheets[sheetName];
      rawRows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
    }

    if (!rawRows.length) {
      progress.innerHTML = 'No data rows found in the file.';
      toast('Empty file', 'error');
      return;
    }

    const products = rawRows.map(normalizeBulkRow).filter(Boolean);
    if (!products.length) {
      progress.innerHTML = 'No valid products found. Required columns: <strong>name</strong>, <strong>price</strong>, <strong>image</strong>.';
      toast('No valid rows', 'error');
      return;
    }

    progress.innerHTML = `Found ${products.length} product(s). Uploading…`;

    let maxId = productsCache.reduce((m, p) => Math.max(m, parseInt(p.id) || 0), 0);
    let ok = 0;
    let fail = 0;
    const errors = [];

    for (let i = 0; i < products.length; i++) {
      const p = products[i];
      progress.innerHTML = `Uploading ${i + 1} / ${products.length}… <span style="color:#666">(${esc(p.name)})</span>`;

      try {
        if (p.id && productsCache.some(x => String(x.id) === String(p.id))) {
          await apiRequest({ action: 'updateProduct', ...p });
        } else {
          if (!p.id) {
            maxId += 1;
            p.id = String(maxId);
          } else {
            maxId = Math.max(maxId, parseInt(p.id) || 0);
          }
          await apiRequest({ action: 'addProduct', ...p });
        }
        ok++;
      } catch (err) {
        fail++;
        errors.push(`${p.name}: ${err.message}`);
        console.error('Bulk row failed', p, err);
      }
    }

    await loadProducts();
    updateStats();

    let msg = `Done. ${ok} saved`;
    if (fail) msg += `, ${fail} failed`;
    progress.innerHTML = msg + (errors.length
      ? `<br><span style="color:#f87171;font-size:12px;">${errors.slice(0, 5).map(esc).join('<br>')}</span>`
      : '');
    toast(msg, fail ? 'error' : 'success');
    setTimeout(() => { progress.style.display = 'none'; }, 8000);
  } catch (err) {
    console.error(err);
    progress.innerHTML = 'Failed to read file: ' + esc(err.message);
    toast('Upload failed', 'error');
  }
}

/** Simple CSV parser (handles quoted fields) */
function parseCsv(text) {
  const rows = [];
  let i = 0;
  const len = text.length;

  function readRow() {
    const cells = [];
    let cell = '';
    let inQuotes = false;
    while (i < len) {
      const ch = text[i];
      if (inQuotes) {
        if (ch === '"') {
          if (text[i + 1] === '"') { cell += '"'; i += 2; continue; }
          inQuotes = false; i++; continue;
        }
        cell += ch; i++; continue;
      }
      if (ch === '"') { inQuotes = true; i++; continue; }
      if (ch === ',') { cells.push(cell); cell = ''; i++; continue; }
      if (ch === '\r') { i++; continue; }
      if (ch === '\n') { i++; cells.push(cell); return cells; }
      cell += ch; i++;
    }
    if (cell.length || cells.length) { cells.push(cell); return cells; }
    return null;
  }

  const header = readRow();
  if (!header) return [];
  const keys = header.map(h => h.trim());
  while (true) {
    const cells = readRow();
    if (!cells) break;
    if (cells.every(c => !String(c).trim())) continue;
    const obj = {};
    keys.forEach((k, idx) => { obj[k] = cells[idx] ?? ''; });
    rows.push(obj);
  }
  return rows;
}


// Expose for inline onclick handlers
window.downloadProductTemplate = downloadProductTemplate;
window.downloadCsvTemplate = downloadCsvTemplate;
window.handleBulkUpload = handleBulkUpload;
