/* ==========================================================
   CALIVVS website: fills the menu, best sellers and offers
   with the data loaded from Google Sheets (calivvs-data.js).
   The HTML already contains a saved copy, so the pages still
   work if JavaScript is off.
   ========================================================== */

const esc = calivvsEscape;

function cardHTML(item) {
  const soldOut = !item.available;
  const badge = soldOut ? 'Sold out' : item.badge;
  const badgeClass = (badge === 'New' || badge === 'Vegetarian') ? ' badge-tan' : '';
  return '<article class="card' + (soldOut ? ' sold-out' : '') + '">' +
    '<img src="' + esc(item.image) + '" alt="' + esc(item.name) + '" width="800" height="600" loading="lazy">' +
    '<div class="card-body">' +
    (badge ? '<span class="badge' + badgeClass + '">' + esc(badge) + '</span>' : '') +
    '<h3>' + esc(item.name) + '</h3>' +
    '<p>' + esc(item.description) + '</p>' +
    '<p class="price-row"><span class="price">' + (soldOut ? 'Sold out' : item.price + ' SAR') + '</span> ' +
    '<span class="cal">' + item.calories + ' kcal</span></p>' +
    '</div></article>';
}

function rowHTML(item) {
  return '<tr' + (item.available ? '' : ' class="sold-out"') + '>' +
    '<th scope="row">' + esc(item.name) + '</th>' +
    '<td>' + esc(item.description) + '</td>' +
    '<td class="amount">' + (item.available ? item.price + ' SAR' : 'Sold out') + '</td>' +
    '<td class="amount">' + item.calories + ' kcal</td></tr>';
}

function offerHTML(offer) {
  return '<article class="card">' +
    '<img src="' + esc(offer.image) + '" alt="' + esc(offer.title) + '" width="800" height="600" loading="lazy">' +
    '<div class="card-body">' +
    '<span class="badge badge-tan">' + esc(offer.when) + '</span>' +
    '<h3>' + esc(offer.title) + '</h3>' +
    '<p class="offer-value">' + esc(offer.value) + '</p>' +
    '<p>' + esc(offer.description) + '</p>' +
    '</div></article>';
}

function showStatus(data) {
  const time = data.loadedAt.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  const text = data.source === 'sheet'
    ? 'Live menu · loaded from Google Sheets at ' + time
    : 'Showing our saved menu (live menu unavailable right now)';
  document.querySelectorAll('[data-status]').forEach(el => {
    el.classList.toggle('live', data.source === 'sheet');
    el.querySelector('.status-text').textContent = text;
  });
}

document.addEventListener('DOMContentLoaded', async () => {
  const data = await loadCalivvsData();

  // Menu page: one container (cards or table body) per category
  document.querySelectorAll('[data-category]').forEach(el => {
    const items = data.menu.filter(i => i.category === el.dataset.category);
    el.innerHTML = items.map(el.tagName === 'TBODY' ? rowHTML : cardHTML).join('');
  });

  // Home page: best sellers (featured = TRUE in the sheet)
  document.querySelectorAll('[data-render="featured"]').forEach(el => {
    el.innerHTML = data.menu.filter(i => i.featured).slice(0, 3).map(cardHTML).join('');
  });

  // Offers page: only offers marked active
  document.querySelectorAll('[data-render="offers"]').forEach(el => {
    el.innerHTML = data.offers.filter(o => o.active).map(offerHTML).join('');
  });

  showStatus(data);
});
