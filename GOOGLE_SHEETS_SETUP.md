# Zelvra — Google Sheets Admin Setup (GitHub-ready)

Your website is static (GitHub Pages). It cannot talk to Google Sheets directly.
We use **SheetDB** (free) as a bridge:

```
Google Sheet  ←→  SheetDB API  ←→  Website (browser)
```

- Products in the **Products** sheet appear on the website as soon as the page opens.
- Every order is written to the **Orders** sheet.

---

## Step 1 — Create Google Sheets

### A) Products sheet

1. Go to [sheets.google.com](https://sheets.google.com) → Blank spreadsheet  
2. Name it: `Zelvra Products`  
3. In **Row 1** put these exact headers (one per column):

| id | name | range | price | oldPrice | image | image2 | image3 | badge | description | notes | stock | active |
|----|------|-------|-------|----------|-------|--------|--------|-------|-------------|-------|-------|--------|

4. Add a sample product in Row 2:

| id | name | range | price | oldPrice | image | badge | description | stock | active |
|----|------|-------|-------|----------|-------|-------|-------------|-------|--------|
| 1 | Classic Wallet | Accessories | 2490 | 3200 | https://images.unsplash.com/photo-1627123424574-724758594e93?w=500 | Sale | Slim leather wallet | 40 | yes |

**Column rules**
- `name`, `price`, `image` → required  
- `active` → `yes` to show on site, `no` to hide  
- `badge` → `Sale`, `New`, or empty  
- `range` → category (Fashion, Electronics, Home, Beauty, …)  
- `image` → public image URL (ImgBB / Postimages / Google Drive direct link)

### B) Orders sheet

1. New spreadsheet: `Zelvra Orders`  
2. Row 1 headers (exact):

| id | orderId | customerName | phone | email | address | city | items | total | status | createdAt | notes |
|----|---------|--------------|-------|-------|---------|------|-------|-------|--------|-----------|-------|

Leave rows empty — the website will add orders automatically.

---

## Step 2 — Connect SheetDB

1. Open [https://sheetdb.io](https://sheetdb.io) → Sign up (free)  
2. **Create API** → connect **Zelvra Products** sheet → copy the API ID  
   - Full URL looks like: `https://sheetdb.io/api/v1/XXXXX`  
   - You only need `XXXXX`  
3. Create a **second API** → connect **Zelvra Orders** sheet → copy that API ID  

---

## Step 3 — Put IDs in the website

Open `js/config.js` and paste:

```js
PRODUCTS_API_ID: 'paste_products_api_id_here',
ORDERS_API_ID: 'paste_orders_api_id_here',
ADMIN_PASSWORD: 'your_secret_password',
```

Save the file.

---

## Step 4 — Admin panel

1. Open `admin.html` on your site  
2. Login with `ADMIN_PASSWORD`  
3. Add / edit products (images upload via ImgBB if key is set)  
4. View orders and update status (pending → confirmed → shipped → delivered)

Products saved in admin go to the Products sheet and show on the storefront **immediately** (page loads with `cache: 'no-store'`).

---

## Step 5 — Upload to GitHub

1. Create a repo (e.g. `zelvra`)  
2. Upload the whole `zelvra` folder contents to the repo root  
3. Settings → Pages → Deploy from `main` branch `/` (root)  
4. Site URL: `https://YOUR_USER.github.io/zelvra/`

**Important for GitHub**
- Do not block SheetDB in browser extensions when testing  
- Sheet must be shared with the SheetDB service (SheetDB asks for access when you connect)  
- Product images must be **public HTTPS URLs** (not private Drive links)

---

## How data flows

| Action | What happens |
|--------|----------------|
| Open website | Browser fetches Products API → shows products |
| Place order | Browser POSTs to Orders API → new row in Orders sheet |
| Admin adds product | Admin POSTs to Products API → new row → visible on next page load |
| Admin changes status | Admin PATCHes Orders API → sheet updates |

---

## Test checklist

1. Open site → products from sheet appear (not only sample fallback)  
2. Add product in admin → refresh shop → product shows  
3. Place order on site → check Orders sheet for new row  
4. Set `active` = `no` → product disappears from storefront  

If the sheet is empty or API fails, the site shows built-in sample products so the store never looks broken.

---

## Sheet header copy-paste (Products)

```
id	name	range	price	oldPrice	image	image2	image3	badge	description	notes	stock	active
```

## Sheet header copy-paste (Orders)

```
id	orderId	customerName	phone	email	address	city	items	total	status	createdAt	notes
```
