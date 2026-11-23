/* ==========================================================
   CALIVVS mobile app logic
   - loads the menu and offers from Google Sheets (calivvs-data.js)
   - switches screens with the bottom tab bar (#home, #menu ...)
   - keeps the order (cart) on the phone with localStorage
   ========================================================== */

const IMG = path => '../' + path;          // data paths are relative to the site root
const $ = id => document.getElementById(id);
const esc = calivvsEscape;

const state = {
  menu: [],
  offers: [],
  source: 'backup',
  category: 'Burgers',
  search: '',
  cart: load('calivvs-cart', {}),          // { itemId: quantity }
  history: load('calivvs-orders', []),
  sheetItem: null,
  sheetQty: 1
};

/* ---------- small helpers ---------- */
function load(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) || fallback; } catch (e) { return fallback; }
}
function save(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* storage may be blocked */ }
}
function sar(n) { return (Math.round(n * 100) / 100).toString().replace(/\.0+$/, '') + ' SAR'; }
function findItem(id) { return state.menu.find(i => i.id === id); }
function toast(message) {
  const t = $('toast');
  t.textContent = message;
  t.classList.add('show');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => t.classList.remove('show'), 1800);
}

/* ---------- opening hours ---------- */
// Sat-Wed 12 PM - 2 AM, Thu-Fri 1 PM - 3 AM (closing hour past midnight = 24 + hour)
const HOURS = { 0: [12, 26], 1: [12, 26], 2: [12, 26], 3: [12, 26], 4: [13, 27], 5: [13, 27], 6: [12, 26] };
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
function fmtHour(h) { h = h % 24; return (h % 12 || 12) + (h < 12 ? ' AM' : ' PM'); }

function openStatus(now = new Date()) {
  const day = now.getDay();
  const hour = now.getHours() + now.getMinutes() / 60;
  const yesterday = (day + 6) % 7;
  if (hour < HOURS[yesterday][1] - 24) return { open: true, text: 'Open now · closes ' + fmtHour(HOURS[yesterday][1]) };
  const [o, c] = HOURS[day];
  if (hour >= o) return { open: true, text: 'Open now · closes ' + fmtHour(c) };
  return { open: false, text: 'Closed · opens ' + fmtHour(o) };
}

function isStudentDay(now = new Date()) { return now.getDay() <= 3; } // Sun (0) - Wed (3)

/* ---------- rendering ---------- */
function itemHTML(item) {
  const badge = !item.available ? 'Sold out' : item.badge;
  return '<div class="item' + (item.available ? '' : ' sold-out') + '" data-open="' + esc(item.id) + '" role="button" tabindex="0">' +
    '<img src="' + esc(IMG(item.image)) + '" alt="" width="800" height="600" loading="lazy">' +
    '<div><h3>' + esc(item.name) + (badge ? '<span class="mini-badge">' + esc(badge) + '</span>' : '') + '</h3>' +
    '<p class="desc">' + esc(item.description) + '</p>' +
    '<p class="meta"><b>' + sar(item.price) + '</b> · ' + item.calories + ' kcal</p></div>' +
    '<button class="add" type="button" data-add="' + esc(item.id) + '" aria-label="Add ' + esc(item.name) + '"' +
    (item.available ? '' : ' disabled') + '>+</button></div>';
}

function renderHome() {
  const h = new Date().getHours();
  $('greeting').textContent = h < 12 ? 'Good morning!' : h < 18 ? 'Good afternoon!' : 'Good evening!';
  $('home-popular').innerHTML = state.menu.filter(i => i.featured).map(itemHTML).join('');
  $('home-offers').innerHTML = state.offers.filter(o => o.active).map(o =>
    '<a class="offer-chip" href="#offers"><img src="' + esc(IMG(o.image)) + '" alt="" width="800" height="600">' +
    '<p><strong>' + esc(o.value) + '</strong>' + esc(o.title) + ' · ' + esc(o.when) + '</p></a>').join('');
}

function renderMenu() {
  const categories = [...new Set(state.menu.map(i => i.category))];
  if (!categories.includes(state.category)) state.category = categories[0];
  $('chips').innerHTML = categories.map(c =>
    '<button class="chip" type="button" role="tab" data-cat="' + esc(c) + '" aria-selected="' + (c === state.category && !state.search) + '">' + esc(c) + '</button>').join('');
  const q = state.search.toLowerCase();
  const items = q
    ? state.menu.filter(i => (i.name + ' ' + i.description + ' ' + i.category).toLowerCase().includes(q))
    : state.menu.filter(i => i.category === state.category);
  $('menu-list').innerHTML = items.map(itemHTML).join('');
  $('menu-empty').hidden = items.length > 0;
}

function cartLines() {
  return Object.entries(state.cart)
    .map(([id, qty]) => ({ item: findItem(id), qty }))
    .filter(l => l.item && l.qty > 0);
}

function totals() {
  const lines = cartLines();
  const subtotal = lines.reduce((s, l) => s + l.item.price * l.qty, 0);
  const student = $('student').checked && isStudentDay();
  const discount = student ? Math.round(subtotal * 0.15 * 100) / 100 : 0;
  return { lines, subtotal, discount, total: subtotal - discount };
}

function renderCart() {
  const t = totals();
  const count = t.lines.reduce((s, l) => s + l.qty, 0);
  $('tab-count').hidden = count === 0;
  $('tab-count').textContent = count;
  $('cart-empty').hidden = count > 0;
  $('order-form').hidden = count === 0;
  $('cart-list').innerHTML = t.lines.map(l =>
    '<div class="cart-row"><img src="' + esc(IMG(l.item.image)) + '" alt="" width="800" height="600">' +
    '<div><p><strong>' + esc(l.item.name) + '</strong></p><p class="line">' + sar(l.item.price * l.qty) + '</p></div>' +
    '<div class="stepper"><button type="button" data-dec="' + esc(l.item.id) + '" aria-label="Remove one">−</button>' +
    '<span>' + l.qty + '</span><button type="button" data-inc="' + esc(l.item.id) + '" aria-label="Add one">+</button></div></div>').join('');
  $('student').disabled = !isStudentDay();
  $('student-hint').textContent = isStudentDay() ? '' : 'The student discount is available Sunday to Wednesday.';
  $('t-sub').textContent = sar(t.subtotal);
  $('t-disc-row').hidden = t.discount === 0;
  $('t-disc').textContent = '−' + sar(t.discount);
  $('t-total').textContent = sar(t.total);
}

function renderOffers() {
  $('offer-list').innerHTML = state.offers.filter(o => o.active).map(o =>
    '<article class="offer-card"><img src="' + esc(IMG(o.image)) + '" alt="' + esc(o.title) + '" width="800" height="600" loading="lazy">' +
    '<div><span class="tag">' + esc(o.when) + '</span><h3>' + esc(o.title) + '</h3><p class="value">' + esc(o.value) + '</p>' +
    '<p>' + esc(o.description) + '</p></div></article>').join('');
}

function renderInfo() {
  const status = openStatus();
  $('open-status').textContent = status.text;
  $('info-status').textContent = status.text;
  const today = new Date().getDay();
  $('hours').innerHTML = [6, 0, 1, 2, 3, 4, 5].map(d =>
    '<p class="' + (d === today ? 'today' : '') + '"><span>' + DAY_NAMES[d] + (d === today ? ' (today)' : '') + '</span>' +
    '<span>' + fmtHour(HOURS[d][0]) + ' – ' + fmtHour(HOURS[d][1]) + '</span></p>').join('');
  $('history').innerHTML = state.history.length
    ? state.history.slice(0, 5).map(o =>
      '<p class="history-row"><span><strong>' + esc(o.number) + '</strong> · ' + esc(o.date) + '</span><span>' + sar(o.total) + '</span></p>').join('')
    : '<p class="hint">No orders yet.</p>';
}

function renderDataLine() {
  const time = new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  const line = $('data-line');
  line.classList.toggle('live', state.source === 'sheet');
  line.textContent = state.source === 'sheet'
    ? 'Menu synced live from Google Sheets at ' + time
    : 'Showing the saved menu (live menu unavailable)';
}

/* ---------- navigation between screens ---------- */
function show(screen) {
  const valid = ['home', 'menu', 'order', 'offers', 'info', 'done'];
  if (!valid.includes(screen)) screen = 'home';
  document.querySelectorAll('.screen').forEach(s => { s.hidden = s.dataset.screen !== screen; });
  document.querySelectorAll('.tabbar a').forEach(a => a.classList.toggle('active', a.dataset.tab === screen));
  if (screen === 'info') renderInfo();
  if (screen === 'order') renderCart();
  window.scrollTo(0, 0);
}

function go(screen) {
  if (location.hash === '#' + screen) show(screen);
  else location.hash = screen;
}

/* ---------- cart actions ---------- */
function addToCart(id, qty = 1) {
  const item = findItem(id);
  if (!item || !item.available) return;
  state.cart[id] = (state.cart[id] || 0) + qty;
  save('calivvs-cart', state.cart);
  renderCart();
  toast(qty + ' × ' + item.name + ' added');
}

function changeQty(id, delta) {
  state.cart[id] = Math.max(0, (state.cart[id] || 0) + delta);
  if (state.cart[id] === 0) delete state.cart[id];
  save('calivvs-cart', state.cart);
  renderCart();
}

/* ---------- item sheet ---------- */
function openSheet(id) {
  const item = findItem(id);
  if (!item) return;
  state.sheetItem = item;
  state.sheetQty = 1;
  $('sheet-img').src = IMG(item.image);
  $('sheet-img').alt = item.name;
  $('sheet-name').textContent = item.name;
  $('sheet-desc').textContent = item.description;
  $('sheet-meta').textContent = item.calories + ' kcal · ' + item.category;
  updateSheet();
  $('sheet').hidden = false;
  $('sheet-backdrop').hidden = false;
}

function updateSheet() {
  const item = state.sheetItem;
  $('sheet-qty').textContent = state.sheetQty;
  $('sheet-add').disabled = !item.available;
  $('sheet-add').textContent = item.available ? 'Add to order · ' + sar(item.price * state.sheetQty) : 'Sold out today';
}

function closeSheet() {
  $('sheet').hidden = true;
  $('sheet-backdrop').hidden = true;
}

/* ---------- placing an order ---------- */
function placeOrder(event) {
  event.preventDefault();
  if (!$('customer-name').value.trim()) { $('customer-name').focus(); return; }
  const t = totals();
  const type = document.querySelector('input[name="type"]:checked').value;
  const when = $('pickup-time').value;
  const ready = new Date(Date.now() + (when === 'ASAP' ? 7 : Number(when)) * 60000);
  const number = '#C-' + (1000 + Math.floor(Math.random() * 9000));
  const readyText = ready.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

  $('done-number').textContent = number;
  $('done-text').textContent = 'Thanks, ' + $('customer-name').value.trim() + '! Your ' + type.toLowerCase() +
    ' order will be ready at about ' + readyText + '.';
  $('done-items').innerHTML = t.lines.map(l =>
    '<p><span>' + l.qty + ' × ' + esc(l.item.name) + '</span><span>' + sar(l.item.price * l.qty) + '</span></p>').join('') +
    (t.discount ? '<p><span>Student discount</span><span>−' + sar(t.discount) + '</span></p>' : '') +
    '<p><strong>Total</strong><strong>' + sar(t.total) + '</strong></p>';

  state.history.unshift({ number, total: t.total, date: new Date().toLocaleDateString([], { day: 'numeric', month: 'short' }) + ' ' + readyText });
  save('calivvs-orders', state.history.slice(0, 20));
  state.cart = {};
  save('calivvs-cart', state.cart);
  $('order-note').value = '';
  renderCart();
  go('done');
}

/* ---------- install button (Android / desktop Chrome) ---------- */
let installEvent = null;
window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  installEvent = e;
  $('install-btn').hidden = false;
});
function installApp() {
  if (!installEvent) return;
  installEvent.prompt();
  installEvent = null;
  $('install-btn').hidden = true;
}

/* ---------- start ---------- */
document.addEventListener('DOMContentLoaded', async () => {
  // one click handler for the whole app
  document.addEventListener('click', e => {
    const t = e.target.closest('[data-add],[data-open],[data-inc],[data-dec],[data-cat],[data-go]');
    if (!t) return;
    if (t.dataset.add) { e.stopPropagation(); addToCart(t.dataset.add); }
    else if (t.dataset.open) openSheet(t.dataset.open);
    else if (t.dataset.inc) changeQty(t.dataset.inc, 1);
    else if (t.dataset.dec) changeQty(t.dataset.dec, -1);
    else if (t.dataset.cat) { state.category = t.dataset.cat; state.search = ''; $('search').value = ''; renderMenu(); }
    else if (t.dataset.go) go(t.dataset.go);
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeSheet();
    if (e.key === 'Enter' && e.target.dataset && e.target.dataset.open) openSheet(e.target.dataset.open);
  });
  $('search').addEventListener('input', e => { state.search = e.target.value.trim(); renderMenu(); });
  $('sheet-minus').addEventListener('click', () => { state.sheetQty = Math.max(1, state.sheetQty - 1); updateSheet(); });
  $('sheet-plus').addEventListener('click', () => { state.sheetQty = Math.min(20, state.sheetQty + 1); updateSheet(); });
  $('sheet-add').addEventListener('click', () => { addToCart(state.sheetItem.id, state.sheetQty); closeSheet(); });
  $('sheet-backdrop').addEventListener('click', closeSheet);
  $('student').addEventListener('change', renderCart);
  $('order-form').addEventListener('submit', placeOrder);
  $('clear-btn').addEventListener('click', () => { state.cart = {}; save('calivvs-cart', state.cart); renderCart(); });
  $('install-btn').addEventListener('click', installApp);
  window.addEventListener('hashchange', () => show(location.hash.slice(1)));

  $('open-status').textContent = openStatus().text;
  show(location.hash.slice(1) || 'home');

  const data = await loadCalivvsData();
  state.menu = data.menu;
  state.offers = data.offers;
  state.source = data.source;
  renderHome();
  renderMenu();
  renderOffers();
  renderCart();
  renderInfo();
  renderDataLine();

  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
});
