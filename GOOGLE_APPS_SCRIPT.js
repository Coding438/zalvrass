/**
 * ZELVRA — Google Apps Script Web App
 * ====================================
 * 1. Paste this FULL file into Apps Script (replace everything)
 * 2. Select setupZelvraSheets → Run → Allow permissions
 * 3. Deploy → New deployment → Type: Web app
 *      Execute as: Me
 *      Who has access: Anyone
 * 4. Copy /exec URL → js/config.js → APPS_SCRIPT_URL
 * 5. After ANY code change: Deploy → Manage deployments → Edit → New version
 */

var PRODUCT_HEADERS = ['id','name','range','price','oldPrice','image','image2','image3','badge','description','notes','stock','active'];
var ORDER_HEADERS = ['id','orderId','customerName','phone','email','address','city','items','total','status','createdAt','notes'];

function doGet(e) {
  try {
    e = e || {};
    var p = e.parameter || {};
    var action = String(p.action || 'getProducts');

    if (action === 'getProducts') {
      return jsonOut_({ success: true, products: getProducts_() });
    }
    if (action === 'getOrders') {
      return jsonOut_({ success: true, orders: getOrders_() });
    }
    // Allow placing order via GET (more reliable from browsers)
    if (action === 'addOrder') {
      var id = addOrder_({
        id: p.id || p.orderId,
        orderId: p.orderId || p.id,
        customerName: p.customerName || '',
        phone: p.phone || '',
        email: p.email || '',
        address: p.address || '',
        city: p.city || '',
        items: p.items || '[]',
        total: p.total || '0',
        status: p.status || 'pending',
        createdAt: p.createdAt || new Date().toISOString(),
        notes: p.notes || ''
      });
      return jsonOut_({ success: true, id: id });
    }
    if (action === 'ping') {
      return jsonOut_({ success: true, message: 'Zelvra API OK', time: new Date().toISOString() });
    }
    return jsonOut_({ success: false, error: 'Unknown action: ' + action });
  } catch (err) {
    return jsonOut_({ success: false, error: String(err && err.message ? err.message : err) });
  }
}

function doPost(e) {
  try {
    var body = {};
    if (e && e.postData && e.postData.contents) {
      try {
        body = JSON.parse(e.postData.contents);
      } catch (parseErr) {
        return jsonOut_({ success: false, error: 'Invalid JSON body' });
      }
    }
    var action = String(body.action || '');

    if (action === 'addOrder') {
      return jsonOut_({ success: true, id: addOrder_(body) });
    }
    if (action === 'addProduct') {
      return jsonOut_({ success: true, id: addProduct_(body) });
    }
    if (action === 'updateProduct') {
      updateProduct_(body);
      return jsonOut_({ success: true });
    }
    if (action === 'deleteProduct') {
      deleteProduct_(body.id);
      return jsonOut_({ success: true });
    }
    if (action === 'updateOrderStatus') {
      updateOrderStatus_(body.id, body.status);
      return jsonOut_({ success: true });
    }
    if (action === 'getProducts') {
      return jsonOut_({ success: true, products: getProducts_() });
    }
    if (action === 'getOrders') {
      return jsonOut_({ success: true, orders: getOrders_() });
    }
    return jsonOut_({ success: false, error: 'Unknown action: ' + action });
  } catch (err) {
    return jsonOut_({ success: false, error: String(err && err.message ? err.message : err) });
  }
}

function jsonOut_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function ss_() {
  return SpreadsheetApp.getActiveSpreadsheet();
}

function sheet_(name) {
  var s = ss_().getSheetByName(name);
  if (!s) {
    // auto-create if missing
    s = ss_().insertSheet(name);
    if (name === 'Products') {
      s.getRange(1, 1, 1, PRODUCT_HEADERS.length).setValues([PRODUCT_HEADERS]);
    } else if (name === 'Orders') {
      s.getRange(1, 1, 1, ORDER_HEADERS.length).setValues([ORDER_HEADERS]);
    }
  }
  return s;
}

function rowsToObjects_(sheet) {
  var values = sheet.getDataRange().getValues();
  if (!values || values.length < 2) return [];
  var headers = values[0].map(function (h) { return String(h).trim(); });
  var out = [];
  for (var i = 1; i < values.length; i++) {
    var row = values[i];
    if (!row || String(row.join('')).trim() === '') continue;
    var obj = {};
    for (var c = 0; c < headers.length; c++) {
      var v = row[c];
      obj[headers[c]] = v === null || v === undefined ? '' : v;
    }
    ['price','oldPrice','stock','total','id','orderId'].forEach(function (k) {
      if (obj[k] !== undefined && obj[k] !== '') obj[k] = String(obj[k]);
    });
    out.push(obj);
  }
  return out;
}

function getProducts_() { return rowsToObjects_(sheet_('Products')); }
function getOrders_() { return rowsToObjects_(sheet_('Orders')); }

function findRowById_(sheet, id) {
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(id) || String(data[i][1]) === String(id)) return i + 1;
  }
  return -1;
}

function productRow_(b) {
  return [
    String(b.id || ''), String(b.name || ''), String(b.range || ''),
    String(b.price || ''), String(b.oldPrice || ''),
    String(b.image || ''), String(b.image2 || ''), String(b.image3 || ''),
    String(b.badge || ''), String(b.description || ''), String(b.notes || ''),
    String(b.stock || '0'), String(b.active || 'yes')
  ];
}

function addProduct_(b) {
  var sheet = sheet_('Products');
  if (!b.id) {
    var maxId = 0;
    getProducts_().forEach(function (p) {
      var n = parseInt(p.id, 10);
      if (!isNaN(n) && n > maxId) maxId = n;
    });
    b.id = String(maxId + 1);
  }
  sheet.appendRow(productRow_(b));
  return String(b.id);
}

function updateProduct_(b) {
  if (!b.id) throw new Error('Product id required');
  var sheet = sheet_('Products');
  var row = findRowById_(sheet, b.id);
  if (row < 0) throw new Error('Product not found');
  var existing = getProducts_().filter(function (p) { return String(p.id) === String(b.id); })[0] || {};
  var m = {
    id: b.id,
    name: b.name != null ? b.name : existing.name,
    range: b.range != null ? b.range : existing.range,
    price: b.price != null ? b.price : existing.price,
    oldPrice: b.oldPrice != null ? b.oldPrice : existing.oldPrice,
    image: b.image != null ? b.image : existing.image,
    image2: b.image2 != null ? b.image2 : existing.image2,
    image3: b.image3 != null ? b.image3 : existing.image3,
    badge: b.badge != null ? b.badge : existing.badge,
    description: b.description != null ? b.description : existing.description,
    notes: b.notes != null ? b.notes : existing.notes,
    stock: b.stock != null ? b.stock : existing.stock,
    active: b.active != null ? b.active : existing.active
  };
  sheet.getRange(row, 1, 1, PRODUCT_HEADERS.length).setValues([productRow_(m)]);
}

function deleteProduct_(id) {
  var sheet = sheet_('Products');
  var row = findRowById_(sheet, id);
  if (row < 0) throw new Error('Product not found');
  sheet.deleteRow(row);
}

function addOrder_(b) {
  var sheet = sheet_('Orders');
  // Ensure header exists
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, ORDER_HEADERS.length).setValues([ORDER_HEADERS]);
  }
  var id = String(b.id || b.orderId || ('ZLV' + new Date().getTime()));
  var orderId = String(b.orderId || id);
  var items = b.items;
  if (typeof items !== 'string') {
    try { items = JSON.stringify(items || []); } catch (e) { items = '[]'; }
  }
  sheet.appendRow([
    id, orderId,
    String(b.customerName || ''),
    String(b.phone || ''),
    String(b.email || ''),
    String(b.address || ''),
    String(b.city || ''),
    items,
    String(b.total || '0'),
    String(b.status || 'pending'),
    String(b.createdAt || new Date().toISOString()),
    String(b.notes || '')
  ]);
  return id;
}

function updateOrderStatus_(id, status) {
  var sheet = sheet_('Orders');
  var row = findRowById_(sheet, id);
  if (row < 0) throw new Error('Order not found');
  sheet.getRange(row, 10).setValue(String(status || 'pending'));
}

function setupZelvraSheets() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var products = ss.getSheetByName('Products') || ss.insertSheet('Products');
  products.clear();
  products.getRange(1, 1, 1, PRODUCT_HEADERS.length).setValues([PRODUCT_HEADERS]);
  products.getRange(1, 1, 1, PRODUCT_HEADERS.length)
    .setFontWeight('bold').setBackground('#2BAE66').setFontColor('#ffffff');
  products.appendRow(['1','Classic Wallet','Accessories','2490','3200',
    'https://images.unsplash.com/photo-1627123424574-724758594e93?w=500','','','Sale',
    'Slim leather wallet','','40','yes']);
  products.setFrozenRows(1);

  var orders = ss.getSheetByName('Orders') || ss.insertSheet('Orders');
  orders.clear();
  orders.getRange(1, 1, 1, ORDER_HEADERS.length).setValues([ORDER_HEADERS]);
  orders.getRange(1, 1, 1, ORDER_HEADERS.length)
    .setFontWeight('bold').setBackground('#2BAE66').setFontColor('#ffffff');
  orders.setFrozenRows(1);

  var s1 = ss.getSheetByName('Sheet1');
  if (s1 && ss.getSheets().length > 1) {
    try { ss.deleteSheet(s1); } catch (e) {}
  }
}
