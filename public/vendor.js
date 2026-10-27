const root = document.querySelector('#vendor-root');
const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const img = (id, width = 480) => !id ? '' : id.startsWith('/') ? id : `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${width}&q=80`;
const money = (n) => `₦${Number(n).toLocaleString('en-NG')}`;
const stars = (n) => '★'.repeat(Math.round(n)) + '☆'.repeat(5 - Math.round(n));
const id = new URLSearchParams(location.search).get('id') || '';

function render(data) {
  const { vendor, rating, products, services, reviews } = data;
  document.title = `${vendor.businessName || vendor.name} | Unishop`;
  const max = Math.max(1, ...rating.distribution.map((row) => row.count));
  const since = data.joinedAt ? new Date(data.joinedAt).toLocaleDateString('en-NG', { month: 'long', year: 'numeric' }) : '';
  root.innerHTML = `
    <section class="vendor-head">
      ${vendor.profileImage ? `<img class="vendor-avatar" src="${esc(img(vendor.profileImage, 240))}" alt="${esc(vendor.businessName)} photo">` : '<div class="vendor-avatar"></div>'}
      <div class="vendor-id">
        <h1>${esc(vendor.businessName || vendor.name)}</h1>
        <p class="vendor-meta">${esc([vendor.name, vendor.position, vendor.role === 'seller' ? 'Vendor' : 'Service provider'].filter(Boolean).join(' · '))}</p>
        <p>${esc(vendor.aboutMe || 'Business profile coming soon.')}</p>
        <p class="vendor-meta">${esc(vendor.placeOfOperation || 'Uyo, Akwa Ibom')}${since ? ` · On Unishop since ${esc(since)}` : ''}${data.ordersCompleted ? ` · ${data.ordersCompleted} paid ${data.ordersCompleted === 1 ? 'order' : 'orders'}` : ''}</p>
      </div>
      <div class="vendor-score">${rating.average ? `<strong>${rating.average.toFixed(1)}/5</strong><span class="vendor-stars">${stars(rating.average)}</span><span>${rating.count} ${rating.count === 1 ? 'rating' : 'ratings'} across the shop</span>
        <div class="vendor-bars">${rating.distribution.map((row) => `<div class="vendor-bar"><span>${row.stars}★</span><i><b style="width:${row.count / max * 100}%"></b></i><span>${row.count}</span></div>`).join('')}</div>` : '<strong>New</strong><span>No ratings yet</span>'}</div>
    </section>
    ${products.length ? `<section class="vendor-section"><h2>Products (${products.length})</h2><div class="vendor-grid">${products.map((p) => `
      <a class="vendor-card" href="/#product=${encodeURIComponent(p.id)}"><img src="${esc(img(p.image))}" alt="${esc(p.name)}" loading="lazy"><div><h3>${esc(p.name)}</h3><strong>${money(p.price)}</strong><br><small>${p.rating ? `★ ${p.rating}/5 (${p.reviews})` : 'Not rated yet'}${p.stock === 0 ? ' · Sold out' : ''}</small></div></a>`).join('')}</div></section>` : ''}
    ${services.length ? `<section class="vendor-section"><h2>Services (${services.length})</h2><div class="vendor-grid">${services.map((s) => `
      <a class="vendor-card" href="/#services"><img src="${esc(img(s.image))}" alt="${esc(s.title)}" loading="lazy"><div><h3>${esc(s.title)}</h3><strong>${money(s.price)}</strong><br><small>${esc(s.niche || '')}</small></div></a>`).join('')}</div></section>` : ''}
    ${!products.length && !services.length ? '<p class="vendor-empty">This shop has not listed anything yet.</p>' : ''}
    ${reviews.length ? `<section class="vendor-section"><h2>Recent reviews</h2>${reviews.map((r) => `<div class="vendor-review"><span class="vendor-stars">${stars(r.rating)}</span> <strong>${esc(r.reviewer)}</strong>${r.comment ? `<p>${esc(r.comment)}</p>` : ''}</div>`).join('')}</section>` : ''}`;
}

fetch(`/api/vendors/${encodeURIComponent(id)}`).then(async (response) => {
  if (!response.ok) throw new Error((await response.json().catch(() => ({}))).error || 'This shop was not found.');
  render(await response.json());
}).catch((error) => { root.innerHTML = `<p class="vendor-empty">${esc(error.message)} <a href="/">Back to the marketplace</a></p>`; });
