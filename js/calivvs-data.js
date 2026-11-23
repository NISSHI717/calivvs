/* ==========================================================
   CALIVVS data loader (shared by the website and the app)

   The menu and offers live in a Google Sheet with two tabs,
   "Menu" and "Offers". This file downloads each tab as CSV,
   turns the rows into JavaScript objects, and hands them to
   the page. If the sheet cannot be reached, it falls back to
   the saved copy in data/menu-backup.js.
   ========================================================== */

const CALIVVS_CONFIG = {
  // The ID is the long code between /d/ and /edit in the sheet's link.
  sheetId: '1h65pRxK5DQvAvp0GsVK5-t4gUDoCORq0XZO1sUDha9s',
  timeoutMs: 7000
};

/* Build the CSV download address for one tab of the sheet. */
function calivvsSheetUrl(tabName) {
  return 'https://docs.google.com/spreadsheets/d/' + CALIVVS_CONFIG.sheetId +
    '/gviz/tq?tqx=out:csv&headers=1&sheet=' + encodeURIComponent(tabName) +
    '&cachebust=' + Date.now();
}

/* Split CSV text into rows and cells, respecting "quoted, values". */
function calivvsParseCSV(text) {
  const rows = [];
  let row = [], cell = '', inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') { inQuotes = false; }
      else { cell += ch; }
    } else if (ch === '"') { inQuotes = true; }
    else if (ch === ',') { row.push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(cell); rows.push(row); row = []; cell = '';
    } else { cell += ch; }
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
  return rows.filter(r => r.some(c => c.trim() !== ''));
}

/* Turn [[headers], [values], ...] into [{header: value}, ...]. */
function calivvsToObjects(rows) {
  const headers = rows[0].map(h => h.trim().toLowerCase());
  return rows.slice(1).map(r => {
    const obj = {};
    headers.forEach((h, i) => { obj[h] = (r[i] || '').trim(); });
    return obj;
  });
}

function calivvsYes(v) {
  return v === true || /^(true|yes|1)$/i.test(String(v).trim());
}

/* Give every field the right type (numbers, true/false). */
function calivvsCleanItem(item) {
  return {
    id: String(item.id || ''),
    category: String(item.category || ''),
    name: String(item.name || ''),
    description: String(item.description || ''),
    price: Number(item.price) || 0,
    calories: Number(item.calories) || 0,
    badge: String(item.badge || ''),
    image: String(item.image || ''),
    available: calivvsYes(item.available),
    featured: calivvsYes(item.featured)
  };
}

function calivvsCleanOffer(offer) {
  return {
    id: String(offer.id || ''),
    title: String(offer.title || ''),
    value: String(offer.value || ''),
    description: String(offer.description || ''),
    when: String(offer.when || ''),
    image: String(offer.image || ''),
    active: calivvsYes(offer.active)
  };
}

/* Download one tab, giving up after a few seconds. */
async function calivvsFetchTab(tabName) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), CALIVVS_CONFIG.timeoutMs);
  try {
    const response = await fetch(calivvsSheetUrl(tabName), { signal: controller.signal, cache: 'no-store' });
    if (!response.ok) throw new Error('Sheet returned ' + response.status);
    const text = await response.text();
    if (text.trim().startsWith('<')) throw new Error('Sheet is not shared publicly');
    return calivvsToObjects(calivvsParseCSV(text));
  } finally {
    clearTimeout(timer);
  }
}

/* Main entry point: returns { menu, offers, source, loadedAt }. */
async function loadCalivvsData() {
  if (CALIVVS_CONFIG.sheetId) {
    try {
      const [menuRows, offerRows] = await Promise.all([calivvsFetchTab('Menu'), calivvsFetchTab('Offers')]);
      const menu = menuRows.map(calivvsCleanItem).filter(i => i.name);
      if (!menu.length) throw new Error('Menu tab is empty');
      return {
        menu: menu,
        offers: offerRows.map(calivvsCleanOffer).filter(o => o.title),
        source: 'sheet',
        loadedAt: new Date()
      };
    } catch (error) {
      console.warn('CALIVVS: using saved menu because the Google Sheet could not be loaded.', error);
    }
  }
  const backup = window.CALIVVS_BACKUP || { menu: [], offers: [] };
  return {
    menu: backup.menu.map(calivvsCleanItem),
    offers: backup.offers.map(calivvsCleanOffer),
    source: 'backup',
    loadedAt: new Date()
  };
}

/* Escape text from the sheet before putting it into HTML. */
function calivvsEscape(value) {
  return String(value).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}
