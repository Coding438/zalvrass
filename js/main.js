// ===== Zelvra – Storefront =====
// Loads products from Google Sheet (via config.js). Falls back to sample data.

let products = [];
let cart = JSON.parse(localStorage.getItem('zelvraCart')) || [];

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


// Sample fallback when Google Sheet is not configured
const fallbackProducts = [
  {
    id: 1, name: "Classic Leather Wallet", range: "Accessories", price: 2490, oldPrice: 3200,
    image: "https://images.unsplash.com/photo-1627123424574-724758594e93?w=500&q=80",
    badge: "Sale", description: "Slim leather wallet with card slots and a clean minimal design.",
    notes: [], stock: 40, active: true
  },
  {
    id: 2, name: "Wireless Earbuds Pro", range: "Electronics", price: 4990, oldPrice: null,
    image: "https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=500&q=80",
    badge: "New", description: "Clear sound, long battery life, and a compact charging case.",
    notes: [], stock: 55, active: true
  },
  {
    id: 3, name: "Minimal Desk Lamp", range: "Home", price: 3590, oldPrice: 4200,
    image: "https://images.unsplash.com/photo-1507473885765-e6ed057f782c?w=500&q=80",
    badge: "Sale", description: "Adjustable LED desk lamp for work, study, and late nights.",
    notes: [], stock: 30, active: true
  },
  {
    id: 4, name: "Cotton Everyday Tee", range: "Fashion", price: 1290, oldPrice: null,
    image: "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=500&q=80",
    badge: null, description: "Soft premium cotton tee in a comfortable everyday fit.",
    notes: [], stock: 80, active: true
  },
  {
    id: 5, name: "Ceramic Mug Set", range: "Home", price: 1890, oldPrice: 2400,
    image: "https://images.unsplash.com/photo-1514228742587-6b1558fcca3d?w=500&q=80",
    badge: "Sale", description: "Set of hand-finished ceramic mugs — simple and durable.",
    notes: [], stock: 45, active: true
  },
  {
    id: 6, name: "Travel Backpack", range: "Accessories", price: 5490, oldPrice: null,
    image: "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=500&q=80",
    badge: "New", description: "Laptop sleeve, water-resistant finish, built for daily commute.",
    notes: [], stock: 25, active: true
  },
  {
    id: 7, name: "Yoga Mat Pro", range: "Fitness", price: 2790, oldPrice: 3490,
    image: "https://images.unsplash.com/photo-1601925260368-ae2f83cf8b7f?w=500&q=80",
    badge: "Sale", description: "Non-slip yoga mat with comfortable cushioning for home workouts.",
    notes: [], stock: 40, active: true
  },
  {
    id: 8, name: "Skincare Glow Set", range: "Beauty", price: 3990, oldPrice: null,
    image: "https://images.unsplash.com/photo-1556228578-0d85b1a4d571?w=500&q=80",
    badge: "New", description: "Gentle cleanser and moisturizer duo for everyday skincare.",
    notes: [], stock: 35, active: true
  },
  {
    id: 9, name: "Stainless Water Bottle", range: "Lifestyle", price: 1590, oldPrice: 1990,
    image: "https://images.unsplash.com/photo-1602143407151-7111542de6e8?w=500&q=80",
    badge: "Sale", description: "Insulated bottle that keeps drinks cold or hot for hours.",
    notes: [], stock: 60, active: true
  },
  {
    id: 10, name: "Kids Story Book Pack", range: "Kids", price: 1890, oldPrice: null,
    image: "https://images.unsplash.com/photo-1512820790803-83ca734da794?w=500&q=80",
    badge: null, description: "Illustrated story pack to spark imagination and reading habits.",
    notes: [], stock: 50, active: true
  },
  {
    id: 11, name: "Kitchen Knife Set", range: "Kitchen", price: 4590, oldPrice: 5500,
    image: "https://images.unsplash.com/photo-1593618998160-e34014e67546?w=500&q=80",
    badge: "Sale", description: "Sharp, balanced knives for everyday cooking at home.",
    notes: [], stock: 28, active: true
  },
  {
    id: 12, name: "Desk Organizer", range: "Office", price: 1490, oldPrice: null,
    image: "https://images.unsplash.com/photo-1587825140708-dfaf72ae4b04?w=500&q=80",
    badge: "New", description: "Keep pens, notes, and gadgets tidy on any workspace.",
    notes: [], stock: 42, active: true
  }
];


/** Call Google Apps Script — POST first, GET fallback for orders */
async function apiRequest(payload) {
  if (!CONFIG.apiUrl) throw new Error('APPS_SCRIPT_URL not set');

  // 1) Try POST
  try {
    const res = await fetch(CONFIG.apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload),
      redirect: 'follow'
    });
    const text = await res.text();
    // If Google returns HTML, API is not deployed correctly
    if (text.trim().startsWith('<!DOCTYPE') || text.trim().startsWith('<html')) {
      throw new Error('Apps Script returned HTML — redeploy web app as Anyone');
    }
    const data = JSON.parse(text);
    if (data && data.success === false) throw new Error(data.error || 'API failed');
    return data;
  } catch (postErr) {
    // 2) Fallback: GET (works well for addOrder)
    if (payload && payload.action === 'addOrder') {
      const q = new URLSearchParams();
      Object.keys(payload).forEach(k => {
        let v = payload[k];
        if (v == null) v = '';
        if (typeof v === 'object') v = JSON.stringify(v);
        q.set(k, String(v));
      });
      const res = await fetch(CONFIG.apiUrl + '?' + q.toString(), {
        method: 'GET',
        cache: 'no-store',
        redirect: 'follow'
      });
      const text = await res.text();
      if (text.trim().startsWith('<!DOCTYPE') || text.trim().startsWith('<html')) {
        throw new Error('Apps Script not working. Paste GOOGLE_APPS_SCRIPT.js and redeploy (Anyone).');
      }
      const data = JSON.parse(text);
      if (data && data.success === false) throw new Error(data.error || 'API failed');
      return data;
    }
    throw postErr;
  }
}

// ---------- Load products from Google Sheet (Apps Script) ----------
function readProductsCache() {
  try {
    const raw = localStorage.getItem('zelvraProducts') || sessionStorage.getItem('zelvraProducts');
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length ? parsed : null;
  } catch (_) { return null; }
}

function writeProductsCache(list) {
  try {
    const s = JSON.stringify(list);
    localStorage.setItem('zelvraProducts', s);
    sessionStorage.setItem('zelvraProducts', s);
  } catch (_) {}
}

/** Save one product so product.html can show it instantly */
function stashProduct(p) {
  try {
    if (p) sessionStorage.setItem('zelvraLastProduct', JSON.stringify(p));
  } catch (_) {}
}

function readStashedProduct() {
  try {
    const raw = sessionStorage.getItem('zelvraLastProduct');
    return raw ? JSON.parse(raw) : null;
  } catch (_) { return null; }
}

async function loadProducts() {
  // Instant paint from local/session cache (no network wait)
  const cached = readProductsCache();
  if (cached) {
    products = cached;
    renderAllProductSections();
  }

  if (typeof CONFIG !== 'undefined' && CONFIG.productsUrl) {
    try {
      const res = await fetch(CONFIG.productsUrl, { cache: 'default', redirect: 'follow' });
      if (!res.ok) throw new Error('API error ' + res.status);
      const raw = await res.text();
      if (raw.trim().startsWith('<!DOCTYPE') || raw.trim().startsWith('<html')) {
        throw new Error('Apps Script returned HTML — redeploy web app');
      }
      let data = JSON.parse(raw);
      if (data && Array.isArray(data.products)) data = data.products;
      else if (data && Array.isArray(data.data)) data = data.data;
      // Build list, skip empty rows, always assign STABLE unique ids
      // Stable key = name slug (so same product always gets same link)
      const usedIds = new Set();
      let seq = 1;
      products = (Array.isArray(data) ? data : [])
        .map((p, idx) => {
          const name = (p.name || '').trim();
          if (!name) return null; // skip empty rows

          // Stable unique id: prefer sheet id if unique, else name slug, else sequence
          let id = String(p.id || '').trim();
          const nameSlug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || ('p' + idx);

          if (!id || usedIds.has(id)) {
            if (!usedIds.has(nameSlug)) {
              id = nameSlug;
            } else {
              let n = 2;
              while (usedIds.has(nameSlug + '-' + n)) n++;
              id = nameSlug + '-' + n;
            }
          }
          usedIds.add(id);

          return {
            id: id,
            name: name,
            range: (p.range || '').trim(),
            price: parseFloat(p.price) || 0,
            oldPrice: p.oldPrice && p.oldPrice !== '' ? parseFloat(p.oldPrice) : null,
            image: p.image || '',
            image2: p.image2 || '',
            image3: p.image3 || '',
            badge: p.badge && p.badge !== '' ? p.badge : null,
            description: p.description || '',
            notes: p.notes ? String(p.notes).split('|').map(n => n.trim()).filter(Boolean) : [],
            stock: parseInt(p.stock) || 0,
            active: parseActive(p.active)
          };
        })
        .filter(p => p && p.active);
      writeProductsCache(products);
    console.log('Loaded', products.length, 'products from Google Sheet');
      if (document.getElementById('product-detail')) renderProductPage();
      return;
    } catch (e) {
      console.warn('Sheet load failed, using fallback', e);
    }
  }
  products = [...fallbackProducts];
}

// ---------- Cart ----------
function saveCart() {
  localStorage.setItem('zelvraCart', JSON.stringify(cart));
  updateCartUI();
}

function updateCartUI() {
  const countEls = document.querySelectorAll('.cart-count');
  const totalItems = cart.reduce((s, i) => s + i.qty, 0);
  countEls.forEach(el => {
    el.textContent = totalItems;
    el.setAttribute('data-count', String(totalItems));
  });

  const container = document.getElementById('cart-items');
  const totalEl = document.getElementById('cart-total');
  if (!container) return;

  if (!cart.length) {
    container.innerHTML = '<div class="empty-cart"><p>Your cart is empty</p></div>';
    if (totalEl) totalEl.textContent = 'Rs. 0';
    return;
  }

  container.innerHTML = cart.map((item, idx) => {
    const p = products.find(pr => String(pr.id) === String(item.id));
    if (!p) return '';
    const unit = p.price;
    const label = p.name;
    return `
      <div class="cart-item">
        <img src="${p.image}" alt="${p.name}">
        <div class="cart-item-info">
          <h4>${label}</h4>
          <div class="price">Rs. ${unit.toLocaleString()}</div>
          <div class="qty-controls">
            <button onclick="changeQtyByIndex(${idx}, -1)">−</button>
            <span>${item.qty}</span>
            <button onclick="changeQtyByIndex(${idx}, 1)">+</button>
            <button onclick="removeFromCartByIndex(${idx})" style="margin-left:10px;border:none;color:#b91c1c;background:none;cursor:pointer;">Remove</button>
          </div>
        </div>
      </div>`;
  }).join('');

  const total = cart.reduce((sum, item) => {
    const p = products.find(pr => String(pr.id) === String(item.id));
    if (!p) return sum;
    const unit = p.price;
    return sum + unit * item.qty;
  }, 0);
  if (totalEl) totalEl.textContent = `Rs. ${total.toLocaleString()}`;
}

function addToCart(id, qty = 1) {
  const existing = cart.find(i => String(i.id) === String(id));
  if (existing) existing.qty += qty;
  else cart.push({ id, qty });
  saveCart();
  showToast('Added to cart');
}

function changeQtyByIndex(idx, delta) {
  if (!cart[idx]) return;
  cart[idx].qty += delta;
  if (cart[idx].qty <= 0) cart.splice(idx, 1);
  saveCart();
}

function removeFromCartByIndex(idx) {
  cart.splice(idx, 1);
  saveCart();
}

function openCart() {
  document.getElementById('cart-overlay')?.classList.add('open');
}

function closeCart() {
  document.getElementById('cart-overlay')?.classList.remove('open');
}

function showToast(msg, type) {
  let el = document.querySelector('.toast');
  if (!el) {
    el = document.createElement('div');
    el.className = 'toast';
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.classList.remove('toast-ok', 'toast-err', 'show');
  if (type === 'ok') el.classList.add('toast-ok');
  if (type === 'err') el.classList.add('toast-err');
  // force reflow so animation restarts
  void el.offsetWidth;
  el.classList.add('show');
  clearTimeout(el._hideTimer);
  el._hideTimer = setTimeout(() => el.classList.remove('show'), 3500);
}


function renderAllProductSections() {
  if (document.getElementById('gifting-products')) renderProducts('gifting-products', products.slice(0, 8));
  if (document.getElementById('shop-products')) renderProducts('shop-products', products);
  if (document.getElementById('featured-products')) renderProducts('featured-products', products.slice(0, 8));
  if (document.getElementById('product-grid')) renderProducts('product-grid', products);
}

// ---------- Product render ----------
function renderProducts(containerId, list = products) {
  const el = document.getElementById(containerId);
  if (!el) return;
  if (!list.length) {
    el.innerHTML = '<p style="color:#6b6b6b;padding:20px 0;">No products in this section yet.</p>';
    return;
  }
  el.innerHTML = list.map(p => {
    const pid = encodeURIComponent(String(p.id));
    const pname = encodeURIComponent(String(p.name));
    const href = `product.html?id=${pid}&name=${pname}`;
    const safeId = String(p.id).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    const waMsg = encodeURIComponent(`Hi! I'm interested in ${p.name} (Rs. ${p.price.toLocaleString()}). Can you help me?`);
    const waUrl = `https://wa.me/923497414745?text=${waMsg}`;
    const dataAttr = escHtml(JSON.stringify({
      id: p.id, name: p.name, range: p.range, price: p.price, oldPrice: p.oldPrice,
      image: p.image, image2: p.image2 || '', image3: p.image3 || '',
      description: p.description || '', badge: p.badge || ''
    }));
    return `
    <div class="product-card">
      <div class="product-img">
        ${p.badge ? `<span class="badge ${p.badge === 'New' ? 'new' : ''}">${p.badge}</span>` : ''}
        <a href="${href}" class="product-link" data-product="${dataAttr}"><img src="${p.image}" alt="${escHtml(p.name)}" loading="lazy" decoding="async"></a>
        <button class="quick-view-btn" onclick="openProductPopup('${safeId}')">Quick View</button>
      </div>
      <div class="product-info">
        <div class="product-range">${escHtml(p.range)}</div>
        <a href="${href}" class="product-link" data-product="${dataAttr}"><h3 class="product-title">${escHtml(p.name)}</h3></a>
        <div class="product-price">
          ${p.oldPrice ? `<span class="old">Rs. ${p.oldPrice.toLocaleString()}</span>` : ''}
          <span class="${p.oldPrice ? 'sale' : ''}">Rs. ${p.price.toLocaleString()}</span>
        </div>
        <div class="card-actions">
          <button class="add-to-cart" onclick="openProductPopup('${safeId}')">Add to Cart</button>
          <a class="card-wa-btn" href="${waUrl}" target="_blank" title="Order via WhatsApp"><i class="fab fa-whatsapp"></i></a>
        </div>
      </div>
    </div>`;
  }).join('');
}

// ---------- Product Popup (quick view on same page) ----------
function ensureProductPopup() {
  if (document.getElementById('product-popup-overlay')) return;
  const overlay = document.createElement('div');
  overlay.id = 'product-popup-overlay';
  overlay.className = 'product-popup-overlay';
  overlay.onclick = function(e) { if (e.target === this) closeProductPopup(); };
  overlay.innerHTML = `
    <div class="product-popup" role="dialog" aria-modal="true">
      <button class="product-popup-close" onclick="closeProductPopup()" aria-label="Close">&times;</button>
      <div class="product-popup-body" id="product-popup-body"></div>
    </div>`;
  document.body.appendChild(overlay);
}

function openProductPopup(productId) {
  const product = products.find(p => String(p.id) === String(productId));
  if (!product) {
    showToast('Product not found');
    return;
  }
  ensureProductPopup();
  const safeId = String(product.id).replace(/\\/g, '\\\\').replace(/'/g, "\\'");

  const thumbs = [];
  if (product.image) thumbs.push(product.image);
  if (product.image2) thumbs.push(product.image2);
  if (product.image3) thumbs.push(product.image3);

  document.getElementById('product-popup-body').innerHTML = `
    <div class="product-popup-gallery">
      <img src="${product.image}" alt="${escHtml(product.name)}" id="popup-main-img">
      ${thumbs.length > 1 ? `
      <div class="product-popup-thumbs">
        ${thumbs.map((src, i) => `
          <img src="${src}" alt="" class="${i === 0 ? 'active' : ''}"
            onclick="document.getElementById('popup-main-img').src=this.src; this.parentElement.querySelectorAll('img').forEach(x=>x.classList.remove('active')); this.classList.add('active');">
        `).join('')}
      </div>` : ''}
    </div>
    <div class="product-popup-info">
      <div class="product-popup-range">${escHtml(product.range)}</div>
      <h2>${escHtml(product.name)}</h2>
      <div class="product-popup-price" id="popup-price">
        ${product.oldPrice ? `<span class="old">Rs. ${product.oldPrice.toLocaleString()}</span>` : ''}
        Rs. <span id="popup-price-value">${product.price.toLocaleString()}</span>
      </div>
      ${product.description ? `<p class="product-popup-desc">${escHtml(product.description)}</p>` : ''}
      <div class="product-popup-actions">
        <input type="number" id="popup-qty" value="1" min="1" style="width:70px;padding:12px;text-align:center;border:1px solid #ddd;border-radius:4px;">
        <button class="btn btn-gold" onclick="popupAddToCart('${safeId}')">Add to Cart</button>
        <button class="btn btn-buy-now" onclick="popupBuyNow('${safeId}')">Buy Now</button>
      </div>
      <p class="product-popup-perks">✓ Free shipping above Rs. 3,000 &nbsp;·&nbsp; ✓ 15 Days Returns</p>
    </div>`;

  const overlay = document.getElementById('product-popup-overlay');
  overlay.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeProductPopup() {
  const overlay = document.getElementById('product-popup-overlay');
  if (overlay) overlay.classList.remove('open');
  document.body.style.overflow = '';
}

function popupAddToCart(productId) {
  const qty = parseInt(document.getElementById('popup-qty')?.value) || 1;
  addToCart(productId, qty);
}

function popupBuyNow(productId) {
  const qty = parseInt(document.getElementById('popup-qty')?.value) || 1;
  closeProductPopup();
  buyNow(productId, qty);
}

// Close popup on Escape
document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape') {
    closeProductPopup();
    closeBuyNow?.();
  }
});

function escHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function toggleMenu() {
  document.querySelector('.nav')?.classList.toggle('open');
}


/** Find product by id or name (URL params) */
function findProduct(id, name) {
  if (id) {
    const want = String(id).trim();
    let p = products.find(x => String(x.id) === want);
    if (p) return p;
    // try decoded
    try {
      const dec = decodeURIComponent(want);
      p = products.find(x => String(x.id) === dec);
      if (p) return p;
    } catch (_) {}
  }
  if (name) {
    const want = String(name).toLowerCase().trim();
    let p = products.find(x => (x.name || '').toLowerCase().trim() === want);
    if (p) return p;
    try {
      const dec = decodeURIComponent(String(name)).toLowerCase().trim();
      p = products.find(x => (x.name || '').toLowerCase().trim() === dec);
      if (p) return p;
    } catch (_) {}
  }
  return null;
}

function renderProductPage() {
  const el = document.getElementById('product-detail');
  if (!el) return;

  const params = new URLSearchParams(location.search);
  const productId = params.get('id') || '';
  const productName = params.get('name') || '';

  if (!productId && !productName) {
    el.innerHTML = '<p class="product-missing">No product selected. <a href="shop.html">Browse shop</a></p>';
    return;
  }

  // Instant: stashed product from click, then cache, then live list
  let product = null;
  const stashed = readStashedProduct();
  if (stashed) {
    const idMatch = productId && String(stashed.id) === String(productId);
    const nameMatch = productName && String(stashed.name).toLowerCase() === String(productName).toLowerCase();
    if (idMatch || nameMatch || (!productId && !productName)) product = stashed;
  }
  if (!product) product = findProduct(productId, productName);
  if (!product) {
    const cached = readProductsCache();
    if (cached && cached.length) {
      const prev = products;
      products = cached;
      product = findProduct(productId, productName);
      products = prev;
    }
  }
  if (!product) {
    el.innerHTML = '<p class="product-missing">Loading product…</p>';
    return;
  }
  stashProduct(product);

  const safeId = String(product.id).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  const oldPriceHtml = product.oldPrice
    ? `<span class="old-price">Rs. ${Number(product.oldPrice).toLocaleString()}</span>`
    : '';
  const thumbs = [product.image, product.image2, product.image3].filter(Boolean);

  el.innerHTML = `
    <div class="product-gallery">
      <img src="${escHtml(product.image || '')}" alt="${escHtml(product.name)}" id="main-product-img" loading="eager" fetchpriority="high">
      ${thumbs.length > 1 ? `
      <div class="product-thumbs">
        ${thumbs.map((src, i) => `
          <button type="button" class="product-thumb ${i === 0 ? 'active' : ''}" data-src="${escHtml(src)}" aria-label="View image ${i + 1}">
            <img src="${escHtml(src)}" alt="">
          </button>`).join('')}
      </div>` : ''}
    </div>
    <div class="product-details">
      <div class="range">${escHtml(product.range || '')}</div>
      <h1>${escHtml(product.name)}</h1>
      <div class="price" id="display-price">
        ${oldPriceHtml}
        Rs. <span id="price-value">${Number(product.price).toLocaleString()}</span>
      </div>
      ${product.description ? `<p class="description">${escHtml(product.description)}</p>` : ''}
      <div class="qty-add">
        <input type="number" id="qty" value="1" min="1" aria-label="Quantity">
        <button type="button" class="btn btn-gold" id="pd-add-cart">Add to Cart</button>
        <button type="button" class="btn btn-buy-now" id="pd-buy-now">Buy Now</button>
      </div>
      <p class="product-perks">✓ Free shipping on orders above Rs. 3,000<br>✓ 15 Days Hassle-Free Returns</p>
      <a class="product-wa-link" href="https://wa.me/923497414745?text=${encodeURIComponent('Hi! I want to order: ' + product.name + ' (Rs. ' + product.price + ')')}" target="_blank" rel="noopener">
        <i class="fab fa-whatsapp"></i> Order on WhatsApp
      </a>
    </div>`;

  document.title = product.name + ' | Zelvra';

  // Thumbnails
  el.querySelectorAll('.product-thumb').forEach(btn => {
    btn.addEventListener('click', () => {
      const main = document.getElementById('main-product-img');
      if (main) main.src = btn.getAttribute('data-src');
      el.querySelectorAll('.product-thumb').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });

  // Actions without fragile inline ids
  document.getElementById('pd-add-cart')?.addEventListener('click', () => {
    const qty = parseInt(document.getElementById('qty')?.value, 10) || 1;
    addToCart(product.id, qty);
  });
  document.getElementById('pd-buy-now')?.addEventListener('click', () => {
    const qty = parseInt(document.getElementById('qty')?.value, 10) || 1;
    buyNow(product.id, qty);
  });
}

// ---------- Product detail helpers ----------
function updatePrice(price) {
  const el = document.getElementById('price-value');
  if (el) el.textContent = Number(price).toLocaleString();
}

function addToCartWithSize(productId) {
  const qty = parseInt(document.getElementById('qty')?.value) || 1;
  addToCart(productId, qty);
}

let buyNowProductId = null;

function buyNow(productId, qtyOverride) {
  buyNowProductId = productId;
  const qty = qtyOverride != null ? qtyOverride : (parseInt(document.getElementById('qty')?.value) || 1);
  const p = products.find(pr => String(pr.id) === String(productId));
  if (!p) {
    showToast('Product not found');
    return;
  }
  const unit = p.price;
  const total = unit * qty;
  const label = p.name;

  // Ensure buy-now modal exists (centered in the middle of the page)
  let overlay = document.getElementById('buynow-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.className = 'buynow-overlay';
    overlay.id = 'buynow-overlay';
    overlay.onclick = function(e) { if (e.target === this) closeBuyNow(); };
    overlay.innerHTML = `
      <div class="buynow-modal" role="dialog" aria-modal="true" aria-label="Buy Now">
        <div class="buynow-header">
          <h3>Buy Now</h3>
          <button type="button" class="buynow-close" onclick="closeBuyNow()" aria-label="Close">&times;</button>
        </div>
        <div id="buynow-summary" class="buynow-summary"></div>
        <form id="buynow-form" class="buynow-form">
          <div class="buynow-field">
            <label for="bn-name">Full Name *</label>
            <input type="text" id="bn-name" required autocomplete="name">
          </div>
          <div class="buynow-field">
            <label for="bn-phone">Phone *</label>
            <input type="tel" id="bn-phone" required placeholder="03XX XXXXXXX" autocomplete="tel">
          </div>
          <div class="buynow-field">
            <label for="bn-address">Address *</label>
            <textarea id="bn-address" required rows="2" autocomplete="street-address"></textarea>
          </div>
          <div class="buynow-field">
            <label for="bn-city">City *</label>
            <input type="text" id="bn-city" required autocomplete="address-level2">
          </div>
          <button type="submit" id="bn-submit" class="checkout-btn">Place Order</button>
        </form>
      </div>`;
    document.body.appendChild(overlay);
    document.getElementById('buynow-form').addEventListener('submit', placeBuyNowOrder);
  }

  document.getElementById('buynow-summary').innerHTML = `
    <strong>${escHtml(label)}</strong><br>
    Qty: ${qty} &nbsp;·&nbsp; <span style="color:var(--gold);font-weight:600;">Rs. ${total.toLocaleString()}</span>
  `;
  overlay.dataset.qty = qty;
  overlay.dataset.total = total;
  overlay.dataset.unit = unit;
  overlay.dataset.name = p.name;
  overlay.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeBuyNow() {
  document.getElementById('buynow-overlay')?.classList.remove('open');
  document.body.style.overflow = '';
}

async function placeBuyNowOrder(e) {
  e.preventDefault();
  const name = document.getElementById('bn-name')?.value.trim();
  const phone = document.getElementById('bn-phone')?.value.trim();
  const address = document.getElementById('bn-address')?.value.trim();
  const city = document.getElementById('bn-city')?.value.trim();
  if (!name || !phone || !address || !city) {
    showToast('Please fill all required fields');
    return;
  }

  const overlay = document.getElementById('buynow-overlay');
  const qty = parseInt(overlay.dataset.qty) || 1;
  const unit = parseFloat(overlay.dataset.unit) || 0;
  const total = parseFloat(overlay.dataset.total) || 0;
  const productName = overlay.dataset.name || 'Product';

  const items = [{
    id: buyNowProductId,
    name: productName,
    qty,
    price: unit
  }];

  const orderId = 'ZLV' + Date.now().toString().slice(-8);
  const order = {
    id: orderId,
    orderId,
    customerName: name,
    phone,
    email: '',
    address,
    city,
    items: JSON.stringify(items),
    total: String(total),
    status: 'pending',
    createdAt: new Date().toISOString(),
    notes: 'Buy Now order'
  };

  const btn = document.getElementById('bn-submit');
  if (btn) { btn.disabled = true; btn.textContent = 'Placing…'; }

  try {
    const localOrders = JSON.parse(localStorage.getItem('zelvraOrders') || '[]');
    localOrders.push(order);
    localStorage.setItem('zelvraOrders', JSON.stringify(localOrders));
  } catch (_) {}

  let sent = false;
  try {
    if (typeof CONFIG !== 'undefined' && CONFIG.apiUrl) {
      await apiRequest({ action: 'addOrder', ...order });
      sent = true;
    }
  } catch (err) {
    console.error('BuyNow API error:', err);
  }

  closeBuyNow();
  document.getElementById('buynow-form')?.reset();
  showToast(sent ? ('Order placed! #' + orderId) : ('Order saved #' + orderId), 'ok');
  if (btn) { btn.disabled = false; btn.textContent = 'Place Order'; }
}

// ---------- Checkout / Place Order ----------
function openCheckout() {
  if (!cart.length) {
    showToast('Cart is empty');
    return;
  }
  document.getElementById('checkout-overlay')?.classList.add('open');
}

function closeCheckout() {
  document.getElementById('checkout-overlay')?.classList.remove('open');
}

async function placeOrder(e) {
  e.preventDefault();
  const name = document.getElementById('co-name')?.value.trim();
  const phone = document.getElementById('co-phone')?.value.trim();
  const email = document.getElementById('co-email')?.value.trim() || '';
  const address = document.getElementById('co-address')?.value.trim();
  const city = document.getElementById('co-city')?.value.trim();
  const notes = document.getElementById('co-notes')?.value.trim() || '';

  if (!name || !phone || !address || !city) {
    showToast('Please fill required fields');
    return;
  }

  const items = cart.map(item => {
    const p = products.find(pr => String(pr.id) === String(item.id));
    const unit = p?.price || 0;
    return {
      id: item.id,
      name: p?.name || 'Product',
      qty: item.qty,
      price: unit
    };
  });

  const total = items.reduce((s, i) => s + i.price * i.qty, 0);
  const orderId = 'ZLV' + Date.now().toString().slice(-8);

  const order = {
    id: orderId,
    orderId,
    customerName: name,
    phone,
    email,
    address,
    city,
    items: JSON.stringify(items),
    total: String(total),
    status: 'pending',
    createdAt: new Date().toISOString(),
    notes
  };

  const btn = document.getElementById('place-order-btn');
  if (btn) { btn.disabled = true; btn.textContent = 'Placing…'; }

  // Always keep a local copy
  try {
    const localOrders = JSON.parse(localStorage.getItem('zelvraOrders') || '[]');
    localOrders.push(order);
    localStorage.setItem('zelvraOrders', JSON.stringify(localOrders));
  } catch (_) {}

  let sentToSheet = false;
  let apiError = '';
  try {
    if (typeof CONFIG !== 'undefined' && CONFIG.apiUrl) {
      await apiRequest({ action: 'addOrder', ...order });
      sentToSheet = true;
    }
  } catch (err) {
    console.error('Order API error:', err);
    apiError = err && err.message ? err.message : 'Sheet sync failed';
  }

  // Complete the order on the site either way so the customer is not stuck
  cart = [];
  saveCart();
  closeCheckout();
  closeCart();
  if (document.getElementById('co-form')) document.getElementById('co-form').reset();

  if (sentToSheet) {
    showToast('Order placed! #' + orderId, 'ok');
  } else if (apiError) {
    showToast('Order saved #' + orderId + ' (sheet offline)', 'ok');
    console.warn('Sheet error:', apiError);
  } else {
    showToast('Order placed! #' + orderId, 'ok');
  }

  if (btn) { btn.disabled = false; btn.textContent = 'Place Order'; }
}

// ---------- Search ----------
function searchProducts(query) {
  const q = (query || '').trim().toLowerCase();
  if (!q) return [];
  const terms = q.split(/\s+/).filter(Boolean);
  return products.filter(p => {
    const hay = [
      p.name,
      p.range,
      p.description,
      p.badge,
      ...(Array.isArray(p.notes) ? p.notes : String(p.notes || '').split('|'))
    ].join(' ').toLowerCase();
    return terms.every(t => hay.includes(t));
  });
}

function ensureSearchDropdown() {
  let dd = document.getElementById('search-dropdown');
  if (dd) return dd;
  dd = document.createElement('div');
  dd.id = 'search-dropdown';
  dd.className = 'search-dropdown';
  dd.setAttribute('role', 'listbox');
  document.body.appendChild(dd);
  return dd;
}

function positionSearchDropdown(input) {
  const dd = ensureSearchDropdown();
  const rect = input.getBoundingClientRect();
  const isMobile = window.innerWidth <= 640;
  if (isMobile) {
    dd.style.left = '12px';
    dd.style.right = '12px';
    dd.style.width = 'auto';
    dd.style.top = (rect.bottom + 6 + window.scrollY) + 'px';
  } else {
    dd.style.left = rect.left + 'px';
    dd.style.right = 'auto';
    dd.style.width = Math.max(rect.width, 280) + 'px';
    dd.style.top = (rect.bottom + 6 + window.scrollY) + 'px';
  }
}

function hideSearchDropdown() {
  const dd = document.getElementById('search-dropdown');
  if (dd) {
    dd.classList.remove('open');
    dd.innerHTML = '';
  }
}

function showSearchResults(query, inputEl) {
  const dd = ensureSearchDropdown();
  const results = searchProducts(query);
  positionSearchDropdown(inputEl);

  if (!query.trim()) {
    hideSearchDropdown();
    return;
  }

  if (!results.length) {
    dd.innerHTML = `<div class="search-empty">No products found for “${escHtml(query.trim())}”</div>`;
    dd.classList.add('open');
    return;
  }

  const limit = 8;
  const shown = results.slice(0, limit);
  dd.innerHTML = shown.map(p => {
    const pid = encodeURIComponent(String(p.id));
    const pname = encodeURIComponent(String(p.name));
    const href = `product.html?id=${pid}&name=${pname}`;
    return `
      <a class="search-result" href="${href}" role="option">
        <img src="${p.image || ''}" alt="" onerror="this.style.display='none'">
        <div class="search-result-info">
          <div class="search-result-name">${escHtml(p.name)}</div>
          <div class="search-result-meta">${escHtml(p.range || '')} · Rs. ${Number(p.price).toLocaleString()}</div>
        </div>
      </a>`;
  }).join('') + (results.length > limit
    ? `<a class="search-view-all" href="shop.html?q=${encodeURIComponent(query.trim())}">View all ${results.length} results →</a>`
    : `<a class="search-view-all" href="shop.html?q=${encodeURIComponent(query.trim())}">View in Shop →</a>`);
  dd.classList.add('open');
}

function goToShopSearch(query) {
  const q = (query || '').trim();
  if (!q) {
    window.location.href = 'shop.html';
    return;
  }
  window.location.href = `shop.html?q=${encodeURIComponent(q)}`;
}

function initSearch() {
  const boxes = document.querySelectorAll('.search-box');
  boxes.forEach(box => {
    const input = box.querySelector('input');
    const btn = box.querySelector('button');
    if (!input) return;

    input.setAttribute('autocomplete', 'off');
    input.setAttribute('role', 'combobox');
    input.setAttribute('aria-autocomplete', 'list');

    let debounceTimer;
    input.addEventListener('input', () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => showSearchResults(input.value, input), 150);
    });

    input.addEventListener('focus', () => {
      if (input.value.trim()) showSearchResults(input.value, input);
    });

    input.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        e.preventDefault();
        hideSearchDropdown();
        goToShopSearch(input.value);
      } else if (e.key === 'Escape') {
        hideSearchDropdown();
        input.blur();
      }
    });

    if (btn) {
      btn.addEventListener('click', e => {
        e.preventDefault();
        hideSearchDropdown();
        goToShopSearch(input.value);
      });
    }
  });

  document.addEventListener('click', e => {
    if (!e.target.closest('.search-box') && !e.target.closest('.search-dropdown')) {
      hideSearchDropdown();
    }
  });

  window.addEventListener('resize', () => {
    const open = document.querySelector('.search-dropdown.open');
    const active = document.activeElement;
    if (open && active && active.closest('.search-box')) {
      positionSearchDropdown(active);
    }
  });
}

/** Filter shop grid by ?q= search query */
function applyShopSearchFilter() {
  const params = new URLSearchParams(location.search);
  const q = params.get('q');
  const grid = document.getElementById('all-products');
  if (!grid) return;

  // Pre-fill search inputs
  if (q) {
    document.querySelectorAll('.search-box input').forEach(inp => { inp.value = q; });
  }

  if (!q || !q.trim()) {
    renderProducts('all-products', products);
    updateShopCount(products.length);
    return;
  }

  const filtered = searchProducts(q);
  renderProducts('all-products', filtered);
  updateShopCount(filtered.length, q.trim());
}

function updateShopCount(count, query) {
  // Update "Showing X products" text if present
  const shopMain = document.querySelector('.shop-layout > div');
  if (!shopMain) return;
  let countEl = shopMain.querySelector('.shop-count');
  if (!countEl) {
    const p = shopMain.querySelector('p');
    if (p && /showing/i.test(p.textContent || '')) {
      p.className = 'shop-count';
      countEl = p;
    }
  }
  if (countEl) {
    if (query) {
      countEl.innerHTML = `Showing <strong>${count}</strong> result${count === 1 ? '' : 's'} for “${escHtml(query)}”` +
        (count === 0 ? '' : '') +
        ` · <a href="shop.html" style="color:var(--gold);">Clear</a>`;
    } else {
      countEl.textContent = `Showing ${count} products`;
    }
  }
}

// ---------- Init ----------

document.addEventListener('click', function (e) {
  const link = e.target.closest && e.target.closest('a.product-link');
  if (!link) return;
  const raw = link.getAttribute('data-product');
  if (!raw) return;
  try {
    stashProduct(JSON.parse(raw));
  } catch (_) {}
}, true);

document.addEventListener('DOMContentLoaded', async () => {
  // Apply configurable site images from CONFIG
  if (typeof CONFIG !== 'undefined') {
    const hero = document.getElementById('hero-section');
    // Prefer HTML video hero; only fall back to HERO_IMAGE when no video is present
    if (hero && CONFIG.HERO_IMAGE && !hero.querySelector('.hero-video')) {
      hero.style.backgroundImage = `linear-gradient(rgba(0,0,0,0.35), rgba(0,0,0,0.45)), url('${CONFIG.HERO_IMAGE}')`;
      hero.style.backgroundSize = 'cover';
      hero.style.backgroundPosition = 'center';
    }
    const aboutImg = document.getElementById('about-teaser-img');
    if (aboutImg && CONFIG.ABOUT_IMAGE) {
      aboutImg.src = CONFIG.ABOUT_IMAGE;
    }
  }

  // Show product page immediately from cache/stash (no wait)
  if (document.getElementById('product-detail')) {
    const cached = readProductsCache();
    if (cached) products = cached;
    renderProductPage();
  }

  await loadProducts();
  updateCartUI();
  initSearch();

  // Match range flexibly (case-insensitive, partial match)
  function matchRange(p, keywords) {
    const r = (p.range || '').toLowerCase();
    return keywords.some(k => r.includes(k.toLowerCase()));
  }

  if (document.getElementById('featured-products')) {
    renderProducts('featured-products', products.slice(0, 4));
  }

  // Featured (first products)
  if (document.getElementById('gifting-products')) {
    renderProducts('gifting-products', products.slice(0, 4));
  }

  // New arrivals
  if (document.getElementById('executive-products')) {
    const news = products.filter(p => (p.badge || '').toLowerCase() === 'new');
    renderProducts('executive-products', news.length ? news : products.slice(0, 4));
  }

  // On sale
  if (document.getElementById('poetic-products')) {
    const sale = products.filter(p => (p.badge || '').toLowerCase() === 'sale' || p.oldPrice);
    renderProducts('poetic-products', sale.length ? sale : products.slice(4, 8));
  }

  // Shop page: filter by ?q= or show all
  if (document.getElementById('all-products')) {
    applyShopSearchFilter();
  }

  // Product detail page
  if (document.getElementById('product-detail')) {
    renderProductPage();
  }

  document.getElementById('newsletter-form')?.addEventListener('submit', e => {
    e.preventDefault();
    showToast('Thank you for subscribing!');
    e.target.reset();
  });

  document.getElementById('contact-form')?.addEventListener('submit', e => {
    e.preventDefault();
    showToast('Message sent!');
    e.target.reset();
  });

  document.getElementById('co-form')?.addEventListener('submit', placeOrder);
});

window.openProductPopup = openProductPopup;
window.closeProductPopup = closeProductPopup;
window.popupAddToCart = popupAddToCart;
window.popupBuyNow = popupBuyNow;
