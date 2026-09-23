// ============================================================
// Zelvra – Google Apps Script Configuration
// ============================================================
// Deploy the script in GOOGLE_APPS_SCRIPT.js as a Web App:
//   Deploy → New deployment → Web app
//   Execute as: Me
//   Who has access: Anyone
// Then paste the /exec URL below.
// ============================================================

const CONFIG = {
  // Your Google Apps Script Web App URL
  APPS_SCRIPT_URL: 'https://script.google.com/macros/s/AKfycbw1va_D70XeA6SoK95MGRFmgn9BWz8vgawZbYzSkQX7MgbJn2GUmIi5jPX5vm7RZj-n7w/exec',

  // Admin login (change these!)
  ADMIN_EMAIL: 'admin@zalvra.com',
  ADMIN_PASSWORD: 'zalvra',

  // ImgBB API key for product image uploads (https://api.imgbb.com)
  IMGBB_API_KEY: '203fec11c1ddb198f0445772fcb4af5e',

  // Max upload size hint (images should be public URLs)
  IMAGE_MAX_MB: 8,

  // Site images
  HERO_IMAGE: 'assets/hero.jpg',
  ABOUT_IMAGE: 'https://images.unsplash.com/photo-1615634260167-c8cdede054de?w=700&q=80',

  // API helpers (do not edit)
  get productsUrl() {
    return this.APPS_SCRIPT_URL ? this.APPS_SCRIPT_URL + '?action=getProducts' : null;
  },
  get ordersUrl() {
    return this.APPS_SCRIPT_URL ? this.APPS_SCRIPT_URL + '?action=getOrders' : null;
  },
  get apiUrl() {
    return this.APPS_SCRIPT_URL || null;
  }
};
