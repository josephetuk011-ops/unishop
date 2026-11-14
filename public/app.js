const products = [];

const vendorProducts = [];
const providers = [];
// Service groups and their services come from /api/service-categories (src/serviceCategories.ts).
let serviceGroups = [];
const serviceNiches = [];
let activeServiceGroup = 'All';
const groupImages = {
  'Home Services': 'photo-1581578731548-c64695cc6952', 'Beauty and Personal Care': 'photo-1560066984-138dadb4c035', 'Transportation and Mobility': 'photo-1486262715619-67b85e0b08d3',
  'Events and Entertainment': 'photo-1511578314322-379afb476865', 'Food and Catering': 'photo-1556911220-bff31c812dba', 'Education and Training': 'photo-1606761568499-6d2451b23c66',
  'Technology and Digital Services': 'photo-1531403009284-440f080d1e12', 'Fashion and Tailoring': 'photo-1558618666-fcd25c85cd64', 'Automotive Services': 'photo-1486262715619-67b85e0b08d3',
  'Construction and Engineering': 'photo-1621905251189-08b45d6a269e', 'Creative and Media Services': 'photo-1542038784456-1ea8e935640e', 'Agriculture and Outdoor Services': 'photo-1585320806297-9794b3e4eeae'
};
function setServiceGroups(groups) {
  serviceGroups = groups;
  const seen = new Set();
  serviceNiches.length = 0;
  groups.forEach((group) => group.services.forEach((name) => { if (!seen.has(name)) { seen.add(name); serviceNiches.push([name, groupImages[group.name] || '/assets/unishop-logo.jpeg']); } }));
}
const groupsOfNiche = (niche) => serviceGroups.filter((group) => group.services.includes(niche)).map((group) => group.name);
let activeNiche = 'All';
let marketMode = 'all';

const formatPrice = (amount) => `₦${amount.toLocaleString('en-NG')}`;
const imageUrl = (id, width = 640) => id?.startsWith('/') || /^https:\/\/res\.cloudinary\.com\//.test(id || '') ? id : `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${width}&q=80`;
const readStorage = (key, fallback) => {
  try { return JSON.parse(localStorage.getItem(key)) || fallback; } catch { return fallback; }
};
let selectedCategory = 'All';
let selectedSub = 'All';
// Top-level groups come from the server (/api/product-categories). Products map to a group by category, services by niche.
let categoryGroups = [];
const legacyGroups = { Home: 'Home and living', Fashion: 'Fashion and accessories', Beauty: 'Beauty and health', Tech: 'Phones and electronics', Food: 'Food and drinks' };
const serviceToProductGroup = {
  'Home Services': 'Home and living', 'Beauty and Personal Care': 'Beauty and health', 'Health and Wellness': 'Beauty and health', 'Fashion and Tailoring': 'Fashion and accessories',
  'Technology and Digital Services': 'Phones and electronics', 'Food and Catering': 'Food and drinks', 'Automotive Services': 'Vehicles', 'Transportation and Mobility': 'Vehicles',
  'Construction and Engineering': 'Building and farming', 'Agriculture and Outdoor Services': 'Building and farming', 'Events and Entertainment': 'Arts, gifts and events',
  'Creative and Media Services': 'Arts, gifts and events', 'Education and Training': 'Baby, kids and school', 'Childcare and Domestic Assistance': 'Baby, kids and school', 'Pet Care Services': 'Pets and other'
};
const groupOfProduct = (product) => legacyGroups[product.category] || categoryGroups.find((entry) => entry.items.includes(product.category))?.group || 'Pets and other';
const groupOfService = (provider) => { const niche = provider.niche || provider.category || provider.trade; const hit = groupsOfNiche(niche).map((name) => serviceToProductGroup[name]).filter(Boolean); return hit.includes(selectedGroup()) ? selectedGroup() : (hit[0] || ''); };
const selectedGroup = () => legacyGroups[selectedCategory] || selectedCategory;
let searchTerm = '';
let selectedAuthRole = 'customer';
let selectedAuthMode = 'login';
let cart = readStorage('marketday-cart', {});
let saved = new Set(readStorage('marketday-saved', []));
let sessionToken = localStorage.getItem('unishop-token') || '';
let currentUser = readStorage('unishop-user', null);
let toastTimer;

const productGrid = document.querySelector('#product-grid');
const visionTrack = document.querySelector('.vision-track');
const shortsSection = document.createElement('section');
shortsSection.className = 'shorts-section page-width';
shortsSection.id = 'products-shorts';
shortsSection.innerHTML = '<div class="shorts-heading"><div><p class="eyebrow">QUICK LOOKS FROM UYO</p><h2>Products Shorts</h2><p>Watch a short, then add it to your bag or book a local pro.</p></div></div><div class="shorts-grid" id="shorts-grid"></div>';
document.querySelector('#join').before(shortsSection);
const shortsGrid = document.querySelector('#shorts-grid');
const cartDrawer = document.querySelector('#cart-drawer');
const backdrop = document.querySelector('#drawer-backdrop');
const toastNode = document.querySelector('#toast');
document.querySelector('.category-pill[data-category="All"] span').textContent = String(products.length);

function showToast(message) {
  toastNode.textContent = message;
  toastNode.classList.add('visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastNode.classList.remove('visible'), 2400);
}

function escapeShortText(value = '') {
  return String(value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
}

let shortLikes = { counts: {}, mine: [] };
const shortKeyOf = (item) => `${item.kind}:${item.id}`;
const heartIcon = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M12 21s-7.5-4.6-9.6-9.2C.8 8.200 2.800 4.500 6.400 4.500c2 0 3.600 1.100 4.600 2.700h2c1-1.600 2.600-2.700 4.600-2.700 3.600 0 5.600 3.700 4 7.300C19.500 16.400 12 21 12 21z"/></svg>';
function likeButton(key, className) {
  const liked = shortLikes.mine.includes(key);
  const count = shortLikes.counts[key] || 0;
  return `<button type="button" class="${className}${liked ? ' liked' : ''}" data-short-like="${escapeShortText(key)}" aria-pressed="${liked}" aria-label="${liked ? 'Unlike' : 'Like'} this short">${heartIcon}<span>${count || ''}</span></button>`;
}
function refreshShortLikes() {
  document.querySelectorAll('[data-short-like]').forEach((node) => {
    const key = node.dataset.shortLike;
    const liked = shortLikes.mine.includes(key);
    node.classList.toggle('liked', liked);
    node.setAttribute('aria-pressed', String(liked));
    node.querySelector('span').textContent = shortLikes.counts[key] || '';
  });
}
async function loadShortLikes() {
  try { shortLikes = await apiRequest('/api/shorts/likes'); refreshShortLikes(); } catch {}
}
async function toggleShortLike(key) {
  if (!sessionToken || !currentUser) { openAuth('customer', 'register'); showToast('Create an account or sign in to like shorts.'); return; }
  const was = shortLikes.mine.includes(key);
  shortLikes.mine = was ? shortLikes.mine.filter((k) => k !== key) : [...shortLikes.mine, key];
  shortLikes.counts[key] = Math.max(0, (shortLikes.counts[key] || 0) + (was ? -1 : 1));
  refreshShortLikes();
  try {
    const [kind, ...rest] = key.split(':');
    const result = await apiRequest(`/api/shorts/${kind}/${encodeURIComponent(rest.join(':'))}/like`, { method: 'POST' });
    shortLikes.counts[key] = result.count;
    shortLikes.mine = result.liked ? [...new Set([...shortLikes.mine, key])] : shortLikes.mine.filter((k) => k !== key);
    refreshShortLikes();
  } catch (error) {
    await loadShortLikes();
    showToast(error.message || 'Could not save your like.');
  }
}

function shortOverlay(seller, title, key = '') {
  return `${key ? likeButton(key, 'short-like') : ''}<button class="short-share" type="button" data-short-share="${escapeShortText(key)}" data-short-title="${escapeShortText(title)}" aria-label="Share this short"><svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M18 16a3 3 0 0 0-2.2 1l-6.6-3.3a3 3 0 0 0 0-1.4L15.800 8a3 3 0 1 0-.8-1.800L8.400 9.500a3 3 0 1 0 0 5l6.600 3.300A3 3 0 1 0 18 16z"/></svg></button><div class="short-watermark" aria-hidden="true"><img src="/assets/unishop-logo.jpeg" alt=""></div>`;
}

function stockBadge(product) {
  if (product.preorder) return `<span class="stock-note preorder-note">Delivered in ${Number(product.preorderDays)} day${Number(product.preorderDays) === 1 ? '' : 's'}</span>`;
  if (product.stock === undefined || product.stock === null) return '';
  if (product.stock === 0) return '<span class="stock-note sold-out">Sold out</span>';
  return product.stock <= 5 ? `<span class="stock-note">${product.stock} left</span>` : '';
}

let detailSize;
function renderDetailExtras(product) {
  const node = document.querySelector('#detail-extras');
  if (!node) return;
  detailSize = undefined;
  const parts = [];
  if (product.stock !== undefined && product.stock !== null) parts.push(product.stock === 0 ? '<p class="stock-note sold-out">Sold out</p>' : `<p class="stock-note">${product.stock} available</p>`);
  if (hasSizes(product)) parts.push(`<div class="size-picker" role="group" aria-label="Choose a size">${product.sizes.map((row) => `<button type="button" class="size-chip" data-size="${escapeShortText(row.label)}"${row.quantity === 0 ? ' disabled' : ''}>${escapeShortText(row.label)}<small>${row.quantity === 0 ? 'out' : row.quantity + ' left'}</small></button>`).join('')}</div>`);
  if (String(product.id).startsWith('seller-') && sessionToken) parts.push(`<div class="rate-row" data-rate-for="${escapeShortText(product.id)}"><span>Bought it? Rate it:</span>${[1, 2, 3, 4, 5].map((n) => `<button type="button" class="rate-star" data-rating="${n}" aria-label="${n} out of 5">★</button>`).join('')}</div>`);
  node.innerHTML = parts.join('');
  document.querySelector('#detail-add-to-bag').disabled = product.stock === 0;
}

// Read the shared-short parameter before anything else rewrites the address bar.
const sharedShortParam = new URLSearchParams(window.location.search).get('short');
let shortItems = [];
function renderShorts() {
  const shortProducts = products.filter((product) => product.video && Number(product.videoDuration) > 0 && Number(product.videoDuration) <= 30);
  const shortServices = providers.filter((provider) => provider.video && Number(provider.videoDuration) > 0 && Number(provider.videoDuration) <= 30);
  shortItems = [
    ...shortProducts.map((product) => ({ kind: 'product', id: product.id, video: product.video, poster: imageUrl(product.image, 640), seller: product.seller || 'Local vendor', userId: product.userId, title: product.name, price: Number(product.price) })),
    ...shortServices.map((provider) => {
      const image = provider.portfolio?.[0] || provider.image || serviceNiches.find(([name]) => name === (provider.niche || provider.category))?.[1];
      return { kind: 'service', id: provider.id, video: provider.video, poster: imageUrl(image, 640), seller: provider.provider || provider.name || 'Service provider', userId: provider.userId, title: provider.title || provider.trade || provider.niche || 'Local service' };
    })
  ];
  const cards = shortItems.map((item, index) => `<article class="short-card"><div class="short-media" data-short-open="${index}" role="button" tabindex="0" aria-label="Watch ${escapeShortText(item.title)}"><video src="${escapeShortText(item.video)}#t=0.1" poster="${escapeShortText(item.poster)}" muted playsinline preload="metadata"></video><span class="short-play" aria-hidden="true">▶</span>${shortOverlay(item.seller, item.title, shortKeyOf(item))}</div><div class="short-card-copy"><p class="short-card-source">${escapeShortText(item.seller)}</p><h3>${escapeShortText(item.title)}</h3><div class="short-card-action">${item.kind === 'product' ? `<strong>${formatPrice(item.price)}</strong><button class="add-button" data-short-add="${escapeShortText(item.id)}">Add to bag</button>` : `<button class="negotiate-button" data-short-book="${escapeShortText(item.id)}">View service</button>`}</div></div></article>`);
  shortsGrid.innerHTML = cards.join('') || '<p class="shorts-empty">No product or service shorts yet.</p>';
}

function renderVisionTicker() {
  const newestUnique = (listings, type, getName) => {
    const seen = new Set();
    return listings
      .map((listing) => ({ name: getName(listing), createdAt: listing.createdAt, type }))
      .filter((listing) => listing.name)
      .sort((first, second) => Date.parse(second.createdAt || '') - Date.parse(first.createdAt || ''))
      .filter((listing) => {
        const key = listing.name.trim().toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .slice(0, 3);
  };
  const latestGoods = newestUnique(vendorProducts, 'GOOD', (product) => product.name);
  const latestServices = newestUnique(providers, 'SERVICE', (provider) => provider.title || provider.trade || provider.niche);
  const latestUploads = [...latestGoods, ...latestServices]
    .sort((first, second) => Date.parse(second.createdAt || '') - Date.parse(first.createdAt || ''));
  const names = latestUploads.map((listing) => `${listing.type}: ${listing.name}`).join('  /  ');
  const message = names || 'New goods and services from Uyo vendors will appear here soon.';
  visionTrack.replaceChildren(...[false, true].map((isDuplicate) => {
    const item = document.createElement('p');
    const label = document.createElement('strong');
    const listingNames = document.createElement('span');
    label.textContent = 'LATEST GOODS & SERVICES';
    listingNames.textContent = message;
    item.append(label, listingNames);
    if (isDuplicate) item.setAttribute('aria-hidden', 'true');
    return item;
  }));
}

function renderCategoryPills() {
  const pills = document.querySelector('.category-pills');
  if (!pills || !categoryGroups.length) return;
  const goodsCount = (group) => products.filter((product) => groupOfProduct(product) === group).length;
  const serviceCount = (group) => ['goods', 'brands'].includes(marketMode) ? 0 : providers.filter((provider) => groupOfService(provider) === group).length;
  const present = categoryGroups.map((entry) => entry.group).filter((group) => goodsCount(group) + serviceCount(group) > 0);
  if (selectedCategory !== 'All' && !present.includes(selectedGroup())) selectedCategory = 'All';
  if (selectedCategory === 'All') selectedSub = 'All';
  const count = pills.querySelector('[data-category="All"] span')?.textContent || String(products.length);
  const group = selectedCategory === 'All' ? '' : selectedGroup();
  const subs = group ? [...new Set(products.filter((product) => groupOfProduct(product) === group).map((product) => product.category))].sort() : [];
  pills.innerHTML = `<button class="category-pill${selectedCategory === 'All' ? ' selected' : ''}" data-category="All">All categories <span>${count}</span></button>` + present.map((name) => `<button class="category-pill${group === name ? ' selected' : ''}" data-category="${escapeShortText(name)}">${escapeShortText(name)} <span>${goodsCount(name) + serviceCount(name)}</span></button>`).join('')
    + (subs.length > 1 ? `<div class="sub-pills" aria-label="Narrow by type">${subs.map((name) => `<button class="category-pill sub${selectedSub === name ? ' selected' : ''}" data-sub="${escapeShortText(name)}">${escapeShortText(name)}</button>`).join('')}</div>` : '');
}

function renderProducts() {
  renderCategoryPills();
  const goods = products.filter((product) => {
    const matchesCategory = selectedCategory === 'All' || (groupOfProduct(product) === selectedGroup() && (selectedSub === 'All' || product.category === selectedSub));
    const matchesSearch = `${product.name} ${product.seller} ${product.brandProfile?.businessName || ''} ${product.category}`.toLowerCase().includes(searchTerm);
    return matchesCategory && matchesSearch;
  });
  const categoryOrder = ['Home', 'Fashion', 'Beauty', 'Tech', 'Food'];
  const categoryLabels = { Home: 'Home & living', Fashion: 'Fashion', Beauty: 'Beauty', Tech: 'Tech', Food: 'Food & pantry' };
  const categoryRank = (name) => categoryOrder.includes(name) ? categoryOrder.indexOf(name) : categoryOrder.length;
  const isVendorProduct = (product) => String(product.id).startsWith('seller-');
  const addedAt = (product) => Date.parse(product.createdAt || '') || 0;
  goods.sort((left, right) => {
    const leftVendor = isVendorProduct(left);
    const rightVendor = isVendorProduct(right);
    if (leftVendor !== rightVendor) return leftVendor ? -1 : 1;
    if (leftVendor) return addedAt(right) - addedAt(left);
    return categoryRank(left.category) - categoryRank(right.category);
  });
  const groupHeading = (label, count, kind) => `<h3 class="category-heading" data-group="${escapeShortText(kind)}"><span>${escapeShortText(label)}</span><small>${count} ${count === 1 ? 'listing' : 'listings'}</small></h3>`;
  const goodsMarkup = marketMode === 'services' ? [] : goods.map((product, index) => `
    <article class="product-card goods-card" style="animation-delay:${index * 35}ms">
      <div class="product-image-wrap"><img class="product-image" src="${imageUrl(product.image)}" alt="${product.name}" loading="lazy"><button class="product-open-image" data-product-detail="${product.id}" aria-label="View ${product.name} details"></button><span class="product-badge ${product.preorder || product.category === 'Beauty' ? 'coral' : ''}">${product.preorder ? 'PRE-ORDER' : (product.badge || 'UYO SHOP')}</span>${product.video ? '<span class="product-video-badge">▶ VIDEO</span>' : ''}<button class="save-button ${saved.has(product.id) ? 'saved' : ''}" data-save="${product.id}" aria-label="${saved.has(product.id) ? 'Remove from' : 'Save to'} favourites">${saved.has(product.id) ? '♥' : '♡'}</button></div>
      <div class="product-details"><div class="product-vendor">${product.userId ? `<a class="vendor-link" href="/vendor.html?id=${encodeURIComponent(product.userId)}">${product.seller}</a>` : product.seller}</div><h3 class="product-name"><button class="product-title-open" data-product-detail="${product.id}">${product.name}</button></h3><div class="product-bottom"><span class="product-price">${formatPrice(product.price)}</span>${product.rating ? `<span class="product-rating"><b>★</b> ${Number(product.rating).toFixed(1)}/5 <span>(${product.reviews || 0})</span></span>` : '<span class="product-rating">★ Not rated yet</span>'}${stockBadge(product)}<button class="add-button" data-add="${product.id}" aria-label="Add ${product.name} to bag"${product.stock === 0 ? ' disabled' : ''}>+</button></div></div>
    </article>`);
  const services = providers.filter((provider) => {
    const matchesNiche = (activeNiche === 'All' || provider.niche === activeNiche || provider.category === activeNiche || provider.trade === activeNiche) && (activeServiceGroup === 'All' || groupsOfNiche(provider.niche || provider.category || provider.trade).includes(activeServiceGroup));
    const matchesSearch = `${provider.provider || provider.name} ${provider.title || provider.trade} ${provider.niche || ''} ${provider.neighbourhood || ''}`.toLowerCase().includes(searchTerm);
    const matchesGroup = selectedCategory === 'All' || (selectedSub === 'All' && groupOfService(provider) === selectedGroup());
    return matchesNiche && matchesSearch && matchesGroup;
  });
  const serviceMarkup = ['goods', 'brands'].includes(marketMode) ? [] : services.map((provider, index) => {
    const image = provider.portfolio?.[0] || provider.image || serviceNiches.find(([name]) => name === (provider.niche || provider.category))?.[1];
    return `<article class="product-card service-market-card" style="animation-delay:${(index + goodsMarkup.length) * 35}ms"><button class="service-market-image" data-view-service="${provider.id}" aria-label="View details of ${provider.title || provider.trade}"><img src="${imageUrl(image, 760)}" alt="${provider.title || provider.trade} by ${provider.provider || provider.name}" loading="lazy"><span class="service-image-tag">${provider.niche || provider.category || 'LOCAL SERVICE'}</span><span class="service-open-label">View service ↗</span></button><div class="product-details"><div class="product-vendor">${provider.provider || provider.name} · ${provider.neighbourhood || 'Uyo, Akwa Ibom'}</div><h3 class="product-name">${provider.title || provider.trade}</h3><div class="product-bottom"><span class="product-rating"><b>★</b> ${Number(provider.rating || 0).toFixed(1)} <span>(${provider.reviewCount || provider.reviews || 0})</span></span>${provider.online ? '<span class="online-dot">Online</span>' : ''}</div><div class="product-bottom"><button class="negotiate-button" data-book="${provider.id}">View service</button></div></div></article>`;
  });
  const withHeadings = (items, markup, labelFor, keyFor, kind) => {
    const output = [];
    let current;
    items.forEach((item, index) => {
      const key = keyFor(item) || 'Other';
      if (key !== current) {
        current = key;
        output.push(groupHeading(labelFor(key), items.filter((entry) => (keyFor(entry) || 'Other') === key).length, kind));
      }
      output.push(markup[index]);
    });
    return output;
  };
  // Items added by real vendors and providers come first, newest on top; the built-in demo listings follow.
  const isRealService = (provider) => Boolean(provider.userId);
  const serviceAddedAt = (provider) => Date.parse(provider.createdAt || '') || 0;
  const serviceMarkupByItem = new Map(services.map((provider, index) => [provider, serviceMarkup[index]]));
  const realGoods = marketMode === 'services' ? [] : goods.filter(isVendorProduct);
  const demoGoods = marketMode === 'services' ? [] : goods.filter((product) => !isVendorProduct(product));
  const realServices = ['goods', 'brands'].includes(marketMode) ? [] : services.filter(isRealService).sort((left, right) => serviceAddedAt(right) - serviceAddedAt(left));
  const demoServices = ['goods', 'brands'].includes(marketMode) ? [] : services.filter((provider) => !isRealService(provider)).sort((left, right) => String(left.niche || left.category || left.trade || '').localeCompare(String(right.niche || right.category || right.trade || '')));
  const goodsMarkupByItem = new Map(goods.map((product, index) => [product, goodsMarkup[index]]));
  const newest = [...realGoods.map((item) => ({ item, at: addedAt(item), html: goodsMarkupByItem.get(item) })), ...realServices.map((item) => ({ item, at: serviceAddedAt(item), html: serviceMarkupByItem.get(item) }))].sort((left, right) => right.at - left.at);
  const topLabel = selectedCategory !== 'All' ? `${selectedGroup()}${selectedSub !== 'All' ? ` · ${selectedSub}` : ''}` : marketMode === 'services' ? 'Service providers' : marketMode === 'goods' ? 'New from vendors' : 'New from vendors and providers';
  // Each section ranks its own listings on top: All alternates goods and services, Brands groups goods by shop.
  let groupedNew;
  if (marketMode === 'brands') {
    const byBrand = new Map();
    realGoods.slice().sort((left, right) => addedAt(right) - addedAt(left)).forEach((item) => {
      const brand = item.brandProfile?.businessName || item.seller || 'Other';
      if (!byBrand.has(brand)) byBrand.set(brand, []);
      byBrand.get(brand).push(item);
    });
    groupedNew = [...byBrand.entries()].sort((left, right) => right[1].length - left[1].length)
      .flatMap(([brand, items]) => [groupHeading(brand, items.length, 'brand'), ...items.map((item) => goodsMarkupByItem.get(item))]);
  } else if (marketMode === 'all' && realGoods.length && realServices.length) {
    const goodsFirst = newest.filter((entry) => realGoods.includes(entry.item));
    const servicesFirst = newest.filter((entry) => realServices.includes(entry.item));
    const mixed = [];
    for (let i = 0; i < Math.max(goodsFirst.length, servicesFirst.length); i += 1) {
      if (goodsFirst[i]) mixed.push(goodsFirst[i]);
      if (servicesFirst[i]) mixed.push(servicesFirst[i]);
    }
    groupedNew = [groupHeading(topLabel, mixed.length, 'new'), ...mixed.map((entry) => entry.html)];
  } else {
    groupedNew = newest.length ? [groupHeading(topLabel, newest.length, 'new'), ...newest.map((entry) => entry.html)] : [];
  }
  const groupedGoods = withHeadings(demoGoods, demoGoods.map((product) => goodsMarkupByItem.get(product)), (key) => categoryLabels[key] || key, (product) => product.category, 'goods');
  const groupedServices = withHeadings(demoServices, demoServices.map((provider) => serviceMarkupByItem.get(provider)), (key) => key, (provider) => provider.niche || provider.category || provider.trade, 'services');
  const listings = [...goodsMarkup, ...serviceMarkup];
  document.querySelector('.category-pill[data-category="All"] span').textContent = String(products.length + (['goods', 'brands'].includes(marketMode) ? 0 : providers.length));
  productGrid.innerHTML = [...groupedNew, ...groupedGoods, ...groupedServices].join('') || `<p class="no-results">${marketMode === 'services' && (activeNiche !== 'All' || activeServiceGroup !== 'All') ? `No ${(activeNiche !== 'All' ? activeNiche : activeServiceGroup).toLowerCase()} listings found yet.` : 'No listings match that search. Try another category.'}</p>`;
  const nicheGrid = document.querySelector('#marketplace-niches');
  nicheGrid.innerHTML = serviceNiches.map(([name, image]) => `<button class="service-niche-card ${activeNiche === name ? 'selected' : ''}" data-service-niche="${name}"><img src="${imageUrl(image, 640)}" alt="${name} service in Uyo" loading="lazy"><span>${name}</span><b>Explore ↗</b></button>`).join('');
  nicheGrid.hidden = true;
  const serviceBar = document.querySelector('#service-bar');
  if (serviceBar) {
    serviceBar.hidden = marketMode !== 'services';
    if (marketMode === 'services') {
      const chip = (attr, name, label, selected) => `<button type="button" role="tab" class="service-chip ${selected ? 'selected' : ''}" ${attr}="${escapeShortText(name)}" aria-selected="${selected}">${escapeShortText(label)}</button>`;
      const group = serviceGroups.find((entry) => entry.name === activeServiceGroup);
      serviceBar.innerHTML = `<div class="service-bar-row">${chip('data-service-group', 'All', 'All services', activeServiceGroup === 'All')}${serviceGroups.map((entry) => chip('data-service-group', entry.name, entry.name, activeServiceGroup === entry.name)).join('')}</div>${group ? `<div class="service-bar-row service-bar-subs">${chip('data-service-chip', 'All', `All ${group.name}`, activeNiche === 'All')}${group.services.map((name) => chip('data-service-chip', name, name, activeNiche === name)).join('')}</div>` : ''}`;
      serviceBar.querySelectorAll('.service-bar-row').forEach((row) => { const picked = row.querySelector('.selected'); if (picked) row.scrollLeft = Math.max(0, picked.offsetLeft - 16); });
    } else delete serviceBar.dataset.scrolled;
  }
  document.querySelector('.category-pills').hidden = marketMode === 'services';
}

function renderProviders(category = 'All') {
  activeNiche = category;
  renderProducts();
}
function selectServiceGroup(group) {
  activeServiceGroup = group;
  activeNiche = 'All';
  renderProducts();
}

function renderRelatedProducts(product) {
  const section = document.querySelector('#detail-related');
  const grid = document.querySelector('#detail-related-grid');
  if (!section || !grid) return;
  const pool = products.filter((item) => item.id !== product.id && item.stock !== 0);
  const score = (item) => (item.category === product.category ? 2 : 0) + (product.userId && item.userId === product.userId ? 1 : 0);
  const related = pool.map((item) => ({ item, score: score(item) })).sort((a, b) => b.score - a.score).slice(0, 12).map((row) => row.item);
  section.hidden = !related.length;
  grid.innerHTML = related.map((item) => `<button type="button" class="related-card" data-product-detail="${escapeShortText(item.id)}"><img src="${escapeShortText(imageUrl(item.image, 400))}" alt="${escapeShortText(item.name)}" loading="lazy"><span class="related-name">${escapeShortText(item.name)}</span><strong>${formatPrice(item.price)}</strong><small>${item.rating ? `★ ${Number(item.rating).toFixed(1)}/5` : escapeShortText(item.seller || '')}</small></button>`).join('');
}

function openProductDetail(productId) {
  window.location.assign(`/product.html?id=${encodeURIComponent(productId)}`);
  return;
  const product = products.find((item) => item.id === productId);
  if (!product) return;
  const media = document.querySelector('#detail-media');
  const gallery = Array.isArray(product.images) && product.images.length ? product.images.slice(0, 10) : [product.image];
  media.innerHTML = `<img class="detail-image" src="${imageUrl(gallery[0], 1200)}" alt="${product.name}">${gallery.length > 1 ? `<div class="detail-thumbs">${gallery.map((photo, index) => `<button type="button" class="detail-thumb${index === 0 ? ' active' : ''}" data-photo="${escapeShortText(imageUrl(photo, 1200))}" aria-label="Show photo ${index + 1} of ${gallery.length}"><img src="${escapeShortText(imageUrl(photo, 160))}" alt=""></button>`).join('')}</div>` : ''}${product.video ? `<div class="detail-video-wrap"><video class="detail-video" src="${imageUrl(product.video)}" controls playsinline preload="metadata" aria-label="Vendor or brand video showing ${product.name}"></video><div class="short-watermark wm-top" aria-hidden="true"><img src="/assets/unishop-logo.jpeg" alt=""></div></div>` : ''}`;
  document.querySelector('#detail-category').textContent = `${product.category} · UYO MARKETPLACE`;
  document.querySelector('#product-detail-title').textContent = product.name;
  document.querySelector('#detail-rating').innerHTML = product.rating ? `<strong>★ ${Number(product.rating).toFixed(1)}/5</strong> <span>${product.reviews || 0} customer ratings</span>` : '<span>New listing · No ratings yet</span>';
  const sellerLine = document.querySelector('#detail-seller');
  sellerLine.textContent = `From ${product.seller}`;
  if (product.userId) {
    const visit = document.createElement('a');
    visit.className = 'vendor-link';
    visit.href = `/vendor.html?id=${encodeURIComponent(product.userId)}`;
    visit.textContent = ' · Visit shop and see all products and ratings';
    sellerLine.append(visit);
  }
  const brandProfile = product.brandProfile;
  const brandTrigger = document.querySelector('#detail-brand-trigger');
  const brandCard = document.querySelector('#detail-brand-card');
  brandTrigger.hidden = !brandProfile?.businessName;
  brandTrigger.setAttribute('aria-expanded', 'false');
  brandCard.hidden = true;
  if (brandProfile?.businessName) {
    const avatar = document.querySelector('#detail-brand-avatar');
    avatar.src = brandProfile.profileImage ? imageUrl(brandProfile.profileImage, 120) : '';
    avatar.alt = `${brandProfile.businessName} brand photo`;
    document.querySelector('#detail-brand-name').textContent = brandProfile.businessName;
    document.querySelector('#detail-brand-position').textContent = [brandProfile.name, brandProfile.position, brandProfile.role === 'seller' ? 'Vendor' : 'Service provider'].filter(Boolean).join(' · ');
    document.querySelector('#detail-brand-about').textContent = brandProfile.aboutMe || 'Business profile coming soon.';
    document.querySelector('#detail-brand-location').textContent = brandProfile.placeOfOperation || 'Uyo, Akwa Ibom';
  }
  const description = product.description || ({
    'linen-set': 'A breathable everyday linen set from an independent Uyo home studio.',
    crossbody: 'A soft everyday crossbody bag from a local fashion label.',
    'face-oil': 'A small-batch botanical face oil made for a simple glow routine.',
    headphones: 'Wireless over-ear headphones for music, calls and everyday listening.',
    'ceramic-cup': 'A hand-finished ceramic cup for slow mornings and daily tea.',
    'woven-tote': 'A sturdy woven tote made for market runs and everyday carry.',
    'skin-kit': 'A gentle skincare starter bundle from a local beauty brand.',
    speaker: 'A compact wireless speaker for bringing music along.'
  }[product.id] || 'A locally listed product from a vendor or brand in Uyo. Contact the vendor or brand for more details.');
  document.querySelector('#detail-description').textContent = description;
  document.querySelector('#detail-price').textContent = formatPrice(product.price);
  document.querySelector('#detail-video-note').textContent = product.video ? 'Vendor- or brand-uploaded product video' : 'No product video uploaded by this vendor or brand.';
  document.querySelector('#detail-add-to-bag').dataset.add = product.id;
  renderDetailExtras(product);
  renderRelatedProducts(product);
  document.querySelector('.product-detail-modal').scrollTop = 0;
  document.querySelector('#product-detail-backdrop').classList.add('open');
  document.body.style.overflow = 'hidden';
}

let rewardInfo = null;
async function loadReward() {
  rewardInfo = null;
  if (sessionToken && currentUser && currentUser.role === 'customer') {
    try { rewardInfo = await apiRequest('/api/me/referral'); } catch {}
  }
  renderCart();
}
function rewardFor(subtotal) {
  if (!rewardInfo || subtotal < rewardInfo.minOrderNaira) return 0;
  const units = (rewardInfo.welcomeAvailable ? 1 : 0) + rewardInfo.credits;
  return Math.min(units * rewardInfo.rewardNaira, Math.floor(subtotal / 2 / rewardInfo.rewardNaira) * rewardInfo.rewardNaira);
}
function showCartReward(subtotal) {
  let node = document.querySelector('#cart-reward');
  if (!node) {
    node = document.createElement('div');
    node.id = 'cart-reward';
    node.className = 'cart-reward';
    document.querySelector('#cart-subtotal').parentElement.after(node);
  }
  const discount = rewardFor(subtotal);
  node.hidden = !discount;
  node.innerHTML = discount ? `<span>Referral reward</span><strong>−${formatPrice(discount)}</strong>` : '';
}

function renderCart() {
  const entries = Object.entries(cart).filter(([key, quantity]) => quantity > 0 && products.some((product) => product.id === cartParts(key).id));
  const totalItems = entries.reduce((sum, [, quantity]) => sum + quantity, 0);
  const subtotal = entries.reduce((sum, [key, quantity]) => sum + products.find((product) => product.id === cartParts(key).id).price * quantity, 0);
  document.querySelector('.cart-count').textContent = String(totalItems);
  document.querySelector('.drawer-item-count').textContent = `(${totalItems})`;
  document.querySelector('#cart-subtotal').textContent = formatPrice(subtotal);
  showCartReward(subtotal);
  document.querySelector('#cart-items').innerHTML = entries.map(([id, quantity]) => {
    const parts = cartParts(id);
    const product = products.find((item) => item.id === parts.id);
    return `<article class="cart-item"><img src="${imageUrl(product.image, 160)}" alt=""><div><div class="cart-item-name">${product.name}${parts.size ? ` · ${escapeShortText(parts.size)}` : ''}</div><div class="cart-item-vendor">${product.seller}</div>${product.preorder ? `<div class="stock-note preorder-note">Pre-order · delivered in ${Number(product.preorderDays)} day${Number(product.preorderDays) === 1 ? '' : 's'}</div>` : ''}<div class="quantity-controls"><button data-quantity="${id}" data-change="-1" aria-label="Remove one ${product.name}">−</button><span>${quantity}</span><button data-quantity="${id}" data-change="1" aria-label="Add one ${product.name}">+</button></div></div><div class="cart-item-price">${formatPrice(product.price * quantity)}</div></article>`;
  }).join('');
  document.querySelector('#cart-empty').classList.toggle('visible', totalItems === 0);
  document.querySelector('#cart-summary').style.display = totalItems ? '' : 'none';
  localStorage.setItem('marketday-cart', JSON.stringify(cart));
}

function openCart() {
  renderCart();
  cartDrawer.classList.add('open');
  cartDrawer.setAttribute('aria-hidden', 'false');
  backdrop.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeCart() {
  cartDrawer.classList.remove('open');
  cartDrawer.setAttribute('aria-hidden', 'true');
  backdrop.classList.remove('open');
  document.body.style.overflow = '';
}

const cartParts = (key) => { const [id, size] = String(key).split('::'); return { id, size: size || undefined }; };
const hasSizes = (product) => Array.isArray(product?.sizes) && product.sizes.length > 0;
function availableOf(product, size) {
  if (product.stock === undefined || product.stock === null) return Infinity;
  if (hasSizes(product)) return product.sizes.find((row) => row.label === size)?.quantity ?? 0;
  return product.stock;
}
function addToCart(id, size) {
  const product = products.find((item) => item.id === id);
  if (product && hasSizes(product) && !size) { openProductDetail(id); showToast('Choose a size first.'); return; }
  const key = size ? `${id}::${size}` : id;
  const available = product ? availableOf(product, size) : Infinity;
  if (available <= 0) { showToast('Sold out.'); return; }
  if ((cart[key] || 0) + 1 > available) { showToast(`Only ${available} left.`); return; }
  cart[key] = (cart[key] || 0) + 1;
  renderCart();
  showToast('Added to your bag');
}

async function openBooking(providerId) {
  // Service prices are negotiated in chat, so "book" now opens the negotiation with the provider.
  if (!sessionToken || currentUser?.role !== 'customer') {
    openAuth('customer', 'login');
    showToast('Sign in with a customer account to negotiate with a service provider.');
    return;
  }
  try {
    const result = await apiRequest('/api/chats', { method: 'POST', body: JSON.stringify({ listingId: providerId }) });
    window.UnishopChat.openModal(result.conversation.id);
  } catch (error) {
    showToast(error.message);
  }
}

const authRoleNames = { customer: 'Customer', seller: 'Vendors and Brands', provider: 'Service provider', dispatch: 'Dispatch rider' };
const authBackdrop = document.querySelector('#auth-backdrop');
const authForm = document.querySelector('#auth-form');
function addPasswordToggle(input) {
  const wrapper = document.createElement('span');
  wrapper.className = 'password-input-wrap';
  input.before(wrapper);
  wrapper.append(input);
  if (!input.id) input.id = 'account-password';
  const button = document.createElement('button');
  button.className = 'password-toggle';
  button.type = 'button';
  button.setAttribute('aria-label', 'Show password');
  button.setAttribute('aria-pressed', 'false');
  button.setAttribute('aria-controls', input.id);
  button.title = 'Show password';
  button.innerHTML = '<span aria-hidden="true">◉</span>';
  button.addEventListener('click', () => {
    const isVisible = input.type === 'password';
    input.type = isVisible ? 'text' : 'password';
    button.setAttribute('aria-pressed', String(isVisible));
    button.setAttribute('aria-label', isVisible ? 'Hide password' : 'Show password');
    button.title = isVisible ? 'Hide password' : 'Show password';
  });
  wrapper.append(button);
  return button;
}
const authPasswordToggle = addPasswordToggle(authForm.elements.password);
authForm.autocomplete = 'on';
authForm.elements.name.autocomplete = 'name';
authForm.elements.email.autocomplete = 'email';
authForm.elements.username.autocomplete = 'username';
authForm.elements.password.autocomplete = 'current-password';
const authError = document.createElement('p');
authError.className = 'auth-error';
authError.setAttribute('role', 'alert');
authError.hidden = true;
authForm.querySelector('.auth-submit').before(authError);
const authSwitch = document.createElement('p');
authSwitch.className = 'auth-switch';
authForm.after(authSwitch);
authSwitch.addEventListener('click', (event) => {
  if (!event.target.closest('button')) return;
  selectedAuthMode = selectedAuthMode === 'login' ? 'register' : 'login';
  updateAuthForm();
});
function showAuthError(message) { authError.textContent = message; authError.hidden = !message; }

function updateAuthForm() {
  const registering = selectedAuthMode === 'register';
  const roleNeedsBusiness = ['seller', 'provider', 'dispatch'].includes(selectedAuthRole);
  document.querySelectorAll('[data-auth-role-choice]').forEach((button) => {
    button.classList.toggle('active', button.dataset.authRoleChoice === selectedAuthRole);
    button.setAttribute('aria-pressed', String(button.dataset.authRoleChoice === selectedAuthRole));
  });
  document.querySelectorAll('[data-auth-mode]').forEach((button) => {
    button.classList.toggle('active', button.dataset.authMode === selectedAuthMode);
  });
  document.querySelector('.auth-roles').hidden = !registering;
  document.querySelector('.auth-name-field').hidden = !registering;
  document.querySelector('.auth-email-field').hidden = !registering;
  document.querySelector('.auth-business-field').hidden = !registering || !roleNeedsBusiness;
  document.querySelector('.auth-niche-field').hidden = !registering || selectedAuthRole !== 'provider';
  document.querySelector('.business-prompt').textContent = selectedAuthRole === 'dispatch' ? 'Preferred delivery area' : 'Shop or service name';
  authForm.elements.business.placeholder = selectedAuthRole === 'dispatch' ? 'e.g. Ewet Housing, Uyo' : 'Name customers will see';
  authForm.elements.username.placeholder = 'e.g. ada_uyo';
  authForm.elements.name.required = registering;
  authForm.elements.email.required = registering;
  authForm.elements.username.required = true;
  authForm.elements.business.required = registering && roleNeedsBusiness;
  authForm.elements.password.autocomplete = registering ? 'new-password' : 'current-password';
  authForm.elements.password.minLength = registering ? 10 : 1;
  authForm.elements.password.placeholder = registering ? 'At least 10 characters' : 'Your password';
  authSwitch.innerHTML = registering ? 'Already have an account? <button type="button">Sign in</button>' : 'New to Unishop? <button type="button">Create an account</button>';
  showAuthError('');
  document.querySelector('.auth-forgot').hidden = registering;
  document.querySelector('.auth-submit').innerHTML = registering ? `Create ${authRoleNames[selectedAuthRole]} account <span>→</span>` : 'Sign in <span>→</span>';
  document.querySelector('.auth-intro').textContent = registering ? `${authRoleNames[selectedAuthRole]} account · Uyo, Akwa Ibom` : 'Sign in with your username and password.';
}

function fillNicheSelect(select) {
  select.innerHTML = serviceGroups.map((group) => `<optgroup label="${escapeShortText(group.name)}">${group.services.map((name) => `<option value="${escapeShortText(name)}">${escapeShortText(name)}</option>`).join('')}</optgroup>`).join('');
}
function openAuth(role = 'customer', mode = 'login') {
  selectedAuthRole = authRoleNames[role] ? role : 'customer';
  selectedAuthMode = mode;
  authForm.reset();
  authForm.elements.username.value = mode === 'login' ? (localStorage.getItem('unishop-last-username') || '') : '';
  authForm.elements.password.type = 'password';
  authPasswordToggle.setAttribute('aria-pressed', 'false');
  authPasswordToggle.setAttribute('aria-label', 'Show password');
  authPasswordToggle.title = 'Show password';
  fillNicheSelect(authForm.elements.niche);
  updateAuthForm();
  authBackdrop.classList.add('open');
  document.body.style.overflow = 'hidden';
  const focusTarget = selectedAuthMode === 'register' ? authForm.elements.name : authForm.elements.username.value ? authForm.elements.password : authForm.elements.username;
  focusTarget.focus();
}

function closeAuth() {
  authBackdrop.classList.remove('open');
  document.body.style.overflow = '';
}

document.querySelector('.cart-button').addEventListener('click', openCart);
document.querySelector('.close-drawer').addEventListener('click', closeCart);
document.querySelector('.close-empty').addEventListener('click', closeCart);
backdrop.addEventListener('click', closeCart);

function describeRequestFailure(url, options, status, result) {
  const where = `${(options.method || 'GET').toUpperCase()} ${String(url).split('?')[0]}`;
  const message = result.error || 'The request could not be completed.';
  if (status === 401 || status === 403) return `${message} (Problem: your sign-in or account permission. Source: ${where}, HTTP ${status}.)`;
  if (status === 429) return `${message} (Problem: too many attempts from this device. Source: ${where}.)`;
  if (status >= 500) return `${message} (Problem: the Unishop server. Source: ${where}, HTTP ${status}.)`;
  return `${message} (Problem: what was entered. Source: ${where}, HTTP ${status}.)`;
}
function describeNetworkFailure(url, options) {
  const where = `${(options.method || 'GET').toUpperCase()} ${String(url).split('?')[0]}`;
  return navigator.onLine === false
    ? `Your device is offline. Reconnect to the internet and try again. (Source: ${where}.)`
    : `Could not reach the Unishop server, so nothing was saved. The problem is the network, a blocked connection, or the server being down, not your details. (Source: ${where}.)`;
}
function apiRequest(url, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (sessionToken) headers.Authorization = `Bearer ${sessionToken}`;
  return fetch(url, { ...options, headers }).catch(() => { throw new Error(describeNetworkFailure(url, options)); }).then(async (response) => {
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(describeRequestFailure(url, options, response.status, result));
    return result;
  });
}

const FREE_DELIVERY_BELOW = 3000;
function deliveryFeeFor(itemsTotal) { return itemsTotal >= FREE_DELIVERY_BELOW ? 500 : 0; }

function openCheckout() {
  const lines = Object.entries(cart).filter(([, quantity]) => quantity > 0);
  if (!lines.length) return;
  document.querySelector('#checkout-items').innerHTML = lines.map(([key, quantity]) => {
    const parts = cartParts(key);
    const product = products.find((item) => item.id === parts.id);
    if (!product) return '';
    return `<div class="checkout-line"><span>${quantity} × ${product.name}${parts.size ? ` (${escapeShortText(parts.size)})` : ''}</span><strong>${formatPrice(product.price * quantity)}</strong></div>`;
  }).join('') + '';
  const itemsTotal = lines.reduce((total, [key, quantity]) => total + (products.find((product) => product.id === cartParts(key).id)?.price || 0) * quantity, 0);
  const deliveryFee = deliveryFeeFor(itemsTotal);
  document.querySelector('#checkout-items').insertAdjacentHTML('beforeend', `<div class="checkout-line delivery-charge"><span>Uyo delivery</span><strong>${deliveryFee ? formatPrice(deliveryFee) : 'Free delivery'}</strong></div>`);
  const discount = rewardFor(itemsTotal);
  if (discount) document.querySelector('#checkout-items').insertAdjacentHTML('beforeend', `<div class="checkout-line cart-reward-line"><span>Referral reward</span><strong>−${formatPrice(discount)}</strong></div>`);
  document.querySelector('#checkout-total').textContent = formatPrice(itemsTotal + deliveryFee - discount);
  closeCart();
  document.querySelector('#checkout-backdrop').classList.add('open');
  document.body.style.overflow = 'hidden';
  document.querySelector('#checkout-form input').focus();
}

function closeCheckout() {
  document.querySelector('#checkout-backdrop').classList.remove('open');
  document.body.style.overflow = '';
}

function setPaymentStatus(state, reference, details = '', canTrack = false) {
  const labels = {
    checking: ['PAYMENT UPDATE', 'Checking your payment', 'We are confirming the transaction securely with Paystack.', '…'],
    paid: ['PAYMENT CONFIRMED', 'Payment successfully made', 'Your payment was verified and your order is in. Unishop will prepare it for delivery in Uyo. Track it at any time from your workspace.', '✓'],
    part: ['FIRST PART RECEIVED', 'Part payment successful', details, '✓'],
    pending: ['PAYMENT NOT CONFIRMED', 'Your order is still unpaid', details || 'No successful payment was confirmed. Your bag is still saved so you can try again.', '!'],
    error: ['PAYMENT CHECK FAILED', 'We could not verify that yet', details || 'Your order has not been marked as paid. Please retry the payment or contact support with this reference.', '!']
  }[state];
  document.querySelector('#payment-status-label').textContent = labels[0];
  document.querySelector('#payment-status-title').textContent = labels[1];
  document.querySelector('#payment-status-description').textContent = labels[2];
  document.querySelector('#payment-status-icon').textContent = labels[3];
  document.querySelector('#payment-reference').textContent = reference ? `Reference: ${reference}` : '';
  const trackButton = document.querySelector('#payment-track-product');
  trackButton.hidden = !(state === 'paid' && canTrack);
  trackButton.href = localStorage.getItem('unishop-token') ? '/dashboard.html#overview' : '/?signin=1';
  document.querySelector('#payment-status-backdrop').classList.add('open');
  loadReward();
  loadProducts();
  document.body.style.overflow = 'hidden';
}

document.querySelector('.checkout-button').addEventListener('click', openCheckout);
document.querySelector('.checkout-close').addEventListener('click', closeCheckout);
document.querySelector('#checkout-backdrop').addEventListener('click', (event) => {
  if (event.target.id === 'checkout-backdrop') closeCheckout();
});
document.querySelector('#checkout-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const submit = form.querySelector('button[type="submit"]');
  const original = submit.innerHTML;
  const checkoutLines = Object.entries(cart).filter(([, quantity]) => quantity > 0);
  const checkoutItems = checkoutLines.reduce((total, [key, quantity]) => total + (products.find((product) => product.id === cartParts(key).id)?.price || 0) * quantity, 0);
  const plan = await window.UnishopPayPlan.choose(checkoutItems + deliveryFeeFor(checkoutItems) - rewardFor(checkoutItems));
  if (!plan) return;
  submit.disabled = true;
  submit.textContent = 'Connecting securely…';
  try {
    const result = await apiRequest('/api/payments/initialize', {
      method: 'POST',
      body: JSON.stringify({
        paymentPlan: plan,
        email: form.elements.email.value,
        customer: { name: form.elements.name.value, phone: form.elements.phone.value },
        delivery: { address: form.elements.address.value, neighbourhood: form.elements.neighbourhood.value },
        items: Object.entries(cart).map(([key, quantity]) => ({ id: cartParts(key).id, size: cartParts(key).size, quantity }))
      })
    });
    window.location.assign(result.authorizationUrl);
  } catch (error) {
    showToast(error.message);
    submit.disabled = false;
    submit.innerHTML = original;
  }
});

document.querySelector('.payment-status-close').addEventListener('click', () => {
  document.querySelector('#payment-status-backdrop').classList.remove('open');
  document.body.style.overflow = '';
});

async function verifyPaymentReturn() {
  const params = new URLSearchParams(window.location.search);
  const reference = params.get('reference') || params.get('trxref');
  if (params.get('payment') !== 'return' || !reference) return;
  setPaymentStatus('checking', reference);
  try {
    const result = await apiRequest(`/api/payments/verify/${encodeURIComponent(reference)}`);
    if (result.order.paymentStatus === 'part-paid') {
      cart = {};
      localStorage.setItem('marketday-cart', JSON.stringify(cart));
      renderCart();
      setPaymentStatus('part', reference, `We received the first part. Pay the remaining ₦${Number(result.order.balanceNaira).toLocaleString('en-NG')} from Your orders in your workspace to confirm it.`);
    } else if (result.order.paymentStatus === 'paid') {
      cart = {};
      localStorage.setItem('marketday-cart', JSON.stringify(cart));
      renderCart();
      document.querySelector('#checkout-form').reset();
      setPaymentStatus('paid', reference, '', result.order.type !== 'service');
    } else {
      setPaymentStatus('pending', reference);
    }
  } catch (error) {
    setPaymentStatus('error', reference, error.message);
  } finally {
    window.history.replaceState({}, '', `${window.location.pathname}${window.location.hash || ''}`);
  }
}

document.querySelector('.search').addEventListener('submit', (event) => {
  event.preventDefault();
  searchTerm = document.querySelector('#search-input').value.trim().toLowerCase();
  selectedCategory = 'All';
  document.querySelectorAll('.category-pill').forEach((pill) => pill.classList.toggle('selected', pill.dataset.category === 'All'));
  renderProducts();
  document.querySelector('#products').scrollIntoView({ behavior: 'smooth' });
});
document.querySelector('#search-input').addEventListener('input', (event) => {
  searchTerm = event.target.value.trim().toLowerCase();
  selectedCategory = 'All';
  document.querySelectorAll('.category-pill').forEach((pill) => pill.classList.toggle('selected', pill.dataset.category === 'All'));
  renderProducts();
});

fetch('/api/product-categories').then((response) => response.ok ? response.json() : { groups: [] }).then((data) => { categoryGroups = data.groups || []; renderProducts(); }).catch(() => {});
document.querySelector('.category-pills').addEventListener('click', (event) => {
  const pill = event.target.closest('.category-pill');
  if (!pill) return;
  if (pill.dataset.sub !== undefined) {
    selectedSub = selectedSub === pill.dataset.sub ? 'All' : pill.dataset.sub;
    renderProducts();
    return;
  }
  selectedCategory = pill.dataset.category;
  selectedSub = 'All';
  activeNiche = 'All';
  activeServiceGroup = 'All';
  searchTerm = '';
  document.querySelector('#search-input').value = '';
  document.querySelectorAll('.category-pill').forEach((item) => item.classList.toggle('selected', item === pill));
  renderProducts();
});
document.querySelectorAll('[data-nav-mode]').forEach((link) => link.addEventListener('click', (event) => {
  event.preventDefault();
  const mode = link.dataset.navMode;
  marketMode = ['services', 'goods', 'brands'].includes(mode) ? mode : 'all';
  selectedCategory = 'All';
  activeNiche = 'All';
  activeServiceGroup = 'All';
  searchTerm = '';
  const searchInput = document.querySelector('#search-input');
  searchInput.value = '';
  searchInput.placeholder = mode === 'brands' ? 'Search brands and goods' : 'Search products, services and brands';
  document.querySelectorAll('[data-nav-mode]').forEach((item) => {
    const active = item === link;
    item.classList.toggle('active', active);
    if (active) item.setAttribute('aria-current', 'page');
    else item.removeAttribute('aria-current');
  });
  document.querySelectorAll('.category-pill').forEach((pill) => pill.classList.toggle('selected', pill.dataset.category === 'All'));
  renderProducts();
  document.querySelector(mode === 'shorts' ? '#products-shorts' : '#products').scrollIntoView({ behavior: 'smooth' });
  if (mode === 'brands') searchInput.focus();
}));

productGrid.addEventListener('click', (event) => {
  const addButton = event.target.closest('[data-add]');
  const saveButton = event.target.closest('[data-save]');
  const bookButton = event.target.closest('[data-book]');
  const productDetailButton = event.target.closest('[data-product-detail]');
  if (addButton) { event.stopPropagation(); addToCart(addButton.dataset.add); return; }
  if (saveButton) {
    event.stopPropagation();
    const id = saveButton.dataset.save;
    if (saved.has(id)) saved.delete(id); else saved.add(id);
    localStorage.setItem('marketday-saved', JSON.stringify([...saved]));
    renderProducts();
    showToast(saved.has(id) ? 'Saved to your favourites' : 'Removed from favourites');
    return;
  }
  const viewService = event.target.closest('[data-view-service]');
  if (viewService) { location.assign(`/service.html?id=${encodeURIComponent(viewService.dataset.viewService)}`); return; }
  // Viewing never needs an account: the button opens the service page, where signing in is only asked when negotiating.
  if (bookButton) { location.assign(`/service.html?id=${encodeURIComponent(bookButton.dataset.book)}`); return; }
  if (productDetailButton) openProductDetail(productDetailButton.dataset.productDetail);
});

document.querySelector('#detail-media').addEventListener('click', (event) => {
  const thumb = event.target.closest('.detail-thumb');
  if (!thumb) return;
  document.querySelector('#detail-media .detail-image').src = thumb.dataset.photo;
  document.querySelectorAll('#detail-media .detail-thumb').forEach((item) => item.classList.toggle('active', item === thumb));
});
async function shareShort(key, title = 'a short') {
  let base = `${window.location.origin}/`;
  if (sessionToken && currentUser) {
    try { const data = await apiRequest('/api/me/referral'); base = data.link; } catch {}
  }
  let link;
  try { const url = new URL(base, window.location.origin); url.searchParams.set('short', key.replace(':', '-')); link = url.toString(); } catch { link = `${window.location.origin}/?short=${encodeURIComponent(key.replace(':', '-'))}`; }
  const text = `${title} on Unishop, Uyo`;
  if (navigator.share) { navigator.share({ title: 'Unishop', text, url: link }).catch(() => {}); return; }
  try { await navigator.clipboard.writeText(link); showToast('Short link copied.'); } catch { showToast(link); }
}

// A shared link looks like /?short=product-<id>; open that short once it is loaded.
let sharedShortOpened = false;
function openSharedShort() {
  if (sharedShortOpened) return;
  const wanted = sharedShortParam;
  if (!wanted) { sharedShortOpened = true; return; }
  const index = shortItems.findIndex((item) => `${item.kind}-${item.id}` === wanted);
  if (index < 0) return;
  sharedShortOpened = true;
  openShortsViewer(index);
}

// Full-screen shorts feed: swipe or scroll up for the next short; seller account and add to bag sit under each video.
let shortsViewer;
function closeShortsViewer() {
  if (!shortsViewer) return;
  shortsViewer.querySelectorAll('video').forEach((video) => video.pause());
  shortsViewer.remove();
  shortsViewer = undefined;
  document.body.classList.remove('shorts-open');
}
function openShortsViewer(startIndex) {
  closeShortsViewer();
  let muted = true;
  const slide = (item, index) => `<section class="sv-slide" data-index="${index}"><video src="${escapeShortText(item.video)}" poster="${escapeShortText(item.poster)}" loop muted playsinline preload="${Math.abs(index - startIndex) <= 1 ? 'auto' : 'none'}"></video><div class="short-watermark sv-watermark" aria-hidden="true"><img src="/assets/unishop-logo.jpeg" alt=""></div><div class="sv-rail">${likeButton(shortKeyOf(item), 'sv-like')}<button type="button" class="sv-share" data-short-share="${escapeShortText(shortKeyOf(item))}" data-short-title="${escapeShortText(item.title)}" aria-label="Share this short"><svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path fill="currentColor" d="M18 16a3 3 0 0 0-2.2 1l-6.6-3.3a3 3 0 0 0 0-1.4L15.800 8a3 3 0 1 0-.8-1.800L8.400 9.500a3 3 0 1 0 0 5l6.600 3.300A3 3 0 1 0 18 16z"/></svg><span>Share</span></button></div><div class="sv-info"><a class="sv-seller" ${item.userId ? `href="/vendor.html?id=${encodeURIComponent(item.userId)}"` : ''}>@${escapeShortText(item.seller)}<small>View account</small></a><h3>${escapeShortText(item.title)}</h3><div class="sv-actions">${item.kind === 'product' ? `<strong>${formatPrice(item.price)}</strong><button type="button" class="add-button" data-sv-add="${escapeShortText(item.id)}">Add to bag</button>` : `<button type="button" class="negotiate-button" data-sv-book="${escapeShortText(item.id)}">View service</button>`}</div></div></section>`;
  shortsViewer = document.createElement('div');
  shortsViewer.className = 'shorts-viewer';
  shortsViewer.setAttribute('role', 'dialog');
  shortsViewer.setAttribute('aria-label', 'Shorts');
  shortsViewer.innerHTML = `<button type="button" class="sv-close" aria-label="Close shorts">×</button><button type="button" class="sv-sound" aria-label="Turn sound on">🔇</button><div class="sv-track">${shortItems.map(slide).join('')}</div><p class="sv-hint">Swipe up for the next short</p>`;
  document.body.append(shortsViewer);
  document.body.classList.add('shorts-open');
  const track = shortsViewer.querySelector('.sv-track');
  const slides = [...track.querySelectorAll('.sv-slide')];
  const observer = new IntersectionObserver((entries) => entries.forEach((entry) => {
    const video = entry.target.querySelector('video');
    if (entry.isIntersecting && entry.intersectionRatio > 0.6) {
      video.muted = muted;
      video.play().catch(() => {});
      slides.forEach((other, i) => { if (Math.abs(i - Number(entry.target.dataset.index)) <= 1) other.querySelector('video').preload = 'auto'; });
    } else video.pause();
  }), { root: track, threshold: [0, 0.6, 1] });
  slides.forEach((node) => observer.observe(node));
  slides[startIndex]?.scrollIntoView();
  shortsViewer.addEventListener('click', (event) => {
    if (event.target.closest('.sv-close')) { closeShortsViewer(); return; }
    const sound = event.target.closest('.sv-sound');
    if (sound) { muted = !muted; sound.textContent = muted ? '🔇' : '🔊'; shortsViewer.querySelectorAll('video').forEach((video) => { video.muted = muted; }); return; }
    const likeNode = event.target.closest('[data-short-like]');
    if (likeNode) { toggleShortLike(likeNode.dataset.shortLike); return; }
    const shareNode = event.target.closest('[data-short-share]');
    if (shareNode) { shareShort(shareNode.dataset.shortShare, shareNode.dataset.shortTitle); return; }
    const add = event.target.closest('[data-sv-add]');
    const book = event.target.closest('[data-sv-book]');
    if (add) {
      const product = products.find((item) => item.id === add.dataset.svAdd);
      if (product && hasSizes(product)) closeShortsViewer();
      addToCart(add.dataset.svAdd);
      if (!product || !hasSizes(product)) { add.textContent = 'Added ✓'; setTimeout(() => { add.textContent = 'Add to bag'; }, 1500); }
      return;
    }
    if (book) { closeShortsViewer(); openBooking(book.dataset.svBook); return; }
    const video = event.target.closest('.sv-slide video');
    if (video) { if (video.paused) video.play().catch(() => {}); else video.pause(); }
  });
}
document.addEventListener('keydown', (event) => {
  if (!shortsViewer) return;
  if (event.key === 'Escape') closeShortsViewer();
  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') shortsViewer.querySelector('.sv-track').scrollBy({ top: (event.key === 'ArrowDown' ? 1 : -1) * innerHeight, behavior: 'smooth' });
});

shortsGrid.addEventListener('click', (event) => {
  const openNode = event.target.closest('[data-short-open]');
  if (openNode && !event.target.closest('[data-short-share], [data-short-like]')) { openShortsViewer(Number(openNode.dataset.shortOpen)); return; }
  const likeNode = event.target.closest('[data-short-like]');
  if (likeNode) { toggleShortLike(likeNode.dataset.shortLike); return; }
  const shareNode = event.target.closest('[data-short-share]');
  if (shareNode) { shareShort(shareNode.dataset.shortShare, shareNode.dataset.shortTitle); return; }
  const addButton = event.target.closest('[data-short-add]');
  const bookButton = event.target.closest('[data-short-book]');
  if (addButton) addToCart(addButton.dataset.shortAdd);
  if (bookButton) openBooking(bookButton.dataset.shortBook);
});

document.querySelector('#cart-items').addEventListener('click', (event) => {
  const button = event.target.closest('[data-quantity]');
  if (!button) return;
  const id = button.dataset.quantity;
  cart[id] = Math.max(0, (cart[id] || 0) + Number(button.dataset.change));
  if (!cart[id]) delete cart[id];
  renderCart();
});

document.querySelector('#marketplace-niches').addEventListener('click', (event) => {
  const niche = event.target.closest('[data-service-niche]');
  if (niche) {
    marketMode = 'services';
    renderProviders(niche.dataset.serviceNiche);
  }
});
document.querySelector('#detail-related-grid').addEventListener('click', (event) => {
  const card = event.target.closest('[data-product-detail]');
  if (card) openProductDetail(card.dataset.productDetail);
});
function closeProductDetail() {
  document.querySelector('#product-detail-backdrop').classList.remove('open');
  document.querySelector('#detail-media').querySelector('video')?.pause();
  document.body.style.overflow = '';
}
document.querySelector('.product-detail-close').addEventListener('click', closeProductDetail);
document.querySelector('#detail-brand-trigger').addEventListener('click', (event) => {
  const card = document.querySelector('#detail-brand-card');
  card.hidden = !card.hidden;
  event.currentTarget.setAttribute('aria-expanded', String(!card.hidden));
});
document.querySelector('#product-detail-backdrop').addEventListener('click', (event) => {
  if (event.target.id === 'product-detail-backdrop') closeProductDetail();
});
document.querySelector('#detail-add-to-bag').addEventListener('click', (event) => {
  const id = event.currentTarget.dataset.add;
  const product = products.find((item) => item.id === id);
  if (hasSizes(product) && !detailSize) { showToast('Choose a size first.'); return; }
  addToCart(id, detailSize);
  closeProductDetail();
});
document.querySelector('#detail-extras')?.addEventListener('click', async (event) => {
  const chip = event.target.closest('[data-size]');
  if (chip && !chip.disabled) {
    detailSize = chip.dataset.size;
    document.querySelectorAll('.size-chip').forEach((node) => node.classList.toggle('active', node === chip));
    return;
  }
  const star = event.target.closest('[data-rating]');
  if (star) {
    try {
      await apiRequest(`/api/products/${star.closest('[data-rate-for]').dataset.rateFor}/reviews`, { method: 'POST', body: JSON.stringify({ rating: Number(star.dataset.rating) }) });
      showToast('Thanks for rating.');
      loadProducts();
    } catch (error) { showToast(error.message); }
  }
});
document.querySelector('.booking-close').addEventListener('click', () => {
  document.querySelector('#modal-backdrop').classList.remove('open');
  document.body.style.overflow = '';
});
document.querySelector('#modal-backdrop').addEventListener('click', (event) => {
  if (event.target.id === 'modal-backdrop') {
    event.currentTarget.classList.remove('open');
    document.body.style.overflow = '';
  }
});
document.querySelector('#booking-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  if (!sessionToken || currentUser?.role !== 'customer') {
    document.querySelector('#modal-backdrop').classList.remove('open');
    openAuth('customer', 'login');
    showToast('Sign in with a customer account to request a booking.');
    return;
  }
  const provider = providers.find((person) => person.id === form.dataset.provider);
  try {
    const result = await apiRequest('/api/bookings', { method: 'POST', body: JSON.stringify({ providerId: provider.id, neighbourhood: form.elements.neighbourhood.value, time: form.elements.time.value, note: form.elements.note.value }) });
    const plan = await window.UnishopPayPlan.choose(result.booking.amountNaira + 500, { askPhone: true, phone: currentUser?.phone });
    if (!plan) { notify('Your booking is saved. Pay from your dashboard when you are ready.'); return; }
    const payment = await apiRequest('/api/payments/initialize', { method: 'POST', body: JSON.stringify({ bookingId: result.booking.id, paymentPlan: plan, customer: { phone: window.UnishopPayPlan.phone } }) });
    window.location.assign(payment.authorizationUrl);
    return;
  } catch (error) {
    if (error.message.includes('temporarily unavailable')) {
      document.querySelector('#modal-backdrop').classList.remove('open');
      document.body.style.overflow = '';
      showToast('Booking saved. Payment is unavailable now; sign in to retry from your bookings.');
      return;
    }
    showToast(error.message);
  }
});
document.querySelector('.account-button').addEventListener('click', () => {
  if (sessionToken && currentUser) window.location.assign('/dashboard.html');
  else openAuth();
});
document.querySelector('#site-theme-toggle').addEventListener('click', () => {
  document.body.classList.toggle('dark-theme');
  localStorage.setItem('unishop-theme', document.body.classList.contains('dark-theme') ? 'dark' : 'light');
});
document.querySelectorAll('[data-auth-role]').forEach((button) => button.addEventListener('click', () => openAuth(button.dataset.authRole, 'register')));
document.querySelectorAll('[data-auth-role-choice]').forEach((button) => button.addEventListener('click', () => {
  selectedAuthRole = button.dataset.authRoleChoice;
  updateAuthForm();
}));
document.querySelectorAll('[data-auth-mode]').forEach((button) => button.addEventListener('click', () => {
  selectedAuthMode = button.dataset.authMode;
  updateAuthForm();
}));
document.querySelector('.auth-close').addEventListener('click', closeAuth);
authBackdrop.addEventListener('click', (event) => {
  if (event.target === authBackdrop) closeAuth();
});
authForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const submit = form.querySelector('button[type="submit"]');
  submit.disabled = true;
  showAuthError('');
  try {
    const registering = selectedAuthMode === 'register';
    if (registering && ['seller', 'provider'].includes(selectedAuthRole)) {
      if (!(await window.showVendorTerms(selectedAuthRole, 'Go back'))) { submit.disabled = false; return; }
    }
    const credentials = { username: form.elements.username.value, password: form.elements.password.value };
    if (registering) {
      credentials.name = form.elements.name.value;
      credentials.email = form.elements.email.value;
      credentials.role = selectedAuthRole;
      const businessName = form.elements.business.value.trim();
      if (businessName) credentials.businessName = businessName;
      if (selectedAuthRole === 'provider') credentials.niche = form.elements.niche.value;
      if (['seller', 'provider'].includes(selectedAuthRole)) credentials.acceptTerms = true;
      const referral = localStorage.getItem('unishop-ref');
      if (referral) credentials.ref = referral;
    }
    const result = await apiRequest(`/api/auth/${registering ? 'register' : 'login'}`, {
      method: 'POST',
      body: JSON.stringify(credentials)
    });
    sessionToken = result.token;
    currentUser = result.user;
    if (registering) localStorage.removeItem('unishop-ref');
    localStorage.setItem('unishop-token', sessionToken);
    localStorage.setItem('unishop-last-username', credentials.username.trim().toLowerCase());
    localStorage.setItem('unishop-user', JSON.stringify(currentUser));
    closeAuth();
    loadReward();
    showToast(`Welcome${registering ? ' to Unishop' : ' back'}, ${currentUser.name}.`);
    document.querySelector('.account-button span:last-child').textContent = currentUser.name.split(' ')[0];
    form.reset();
    if (['seller', 'provider', 'dispatch'].includes(currentUser.role)) window.location.assign('/dashboard.html');
  } catch (error) {
    showAuthError(error.message);
  } finally {
    submit.disabled = false;
  }
});
document.addEventListener('keydown', (event) => {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
    event.preventDefault();
    document.querySelector('#search-input').focus();
  }
  if (event.key === 'Escape') {
    closeCart();
    closeAuth();
    closeProductDetail();
    document.querySelector('#modal-backdrop').classList.remove('open');
    document.body.style.overflow = '';
  }
});

renderProducts();
renderProviders();
renderShorts();
fetch('/api/service-categories').then((response) => response.ok ? response.json() : null).then((data) => {
  if (!data?.groups) return;
  setServiceGroups(data.groups);
  window.renderServiceMenu?.();
  renderProducts();
  renderShorts();
}).catch(() => {});
loadShortLikes();
renderCart();
renderVisionTicker();
document.querySelectorAll('a[href="#services"], a[href="#providers"]').forEach((link) => link.setAttribute('href', '#products'));
document.querySelector('#services')?.remove();
if (currentUser?.name) document.querySelector('.account-button span:last-child').textContent = currentUser.name.split(' ')[0];
if (localStorage.getItem('unishop-theme') === 'dark') document.body.classList.add('dark-theme');
{ const welcome = document.querySelector('#welcome-strip'); if (welcome && !sessionToken) welcome.hidden = false; }
if (new URLSearchParams(window.location.search).get('signin') && !sessionToken) { history.replaceState(null, '', '/'); openAuth('customer', 'login'); }
fetch('/api/services').then((response) => response.ok ? response.json() : []).then((data) => {
  if (Array.isArray(data)) {
    providers.splice(0, providers.length, ...data);
    renderProviders(activeNiche);
    renderShorts();
    openSharedShort();
    renderVisionTicker();
  }
}).catch(() => {});
function loadProducts() {
  return fetch('/api/products').then((response) => response.ok ? response.json() : []).then((data) => {
    if (Array.isArray(data)) {
      const known = new Set(catalogIds);
      vendorProducts.forEach((old) => { const index = products.findIndex((product) => product.id === old.id); if (index >= 0) products.splice(index, 1); });
      vendorProducts.splice(0, vendorProducts.length, ...data.filter((product) => !known.has(product.id)));
      data.forEach((product) => { if (!known.has(product.id)) products.push({ ...product, badge: 'UYO SHOP' }); });
      renderProducts();
      renderShorts();
      openSharedShort();
      renderCart();
      renderVisionTicker();
      openProductFromLink();
    }
  }).catch(() => {});
}
function openProductFromLink() {
  const match = location.hash.match(/^#product=(.+)$/);
  if (!match) return;
  const productId = decodeURIComponent(match[1]);
  if (products.some((item) => item.id === productId)) { openProductDetail(productId); }
}
function openBagFromLink() {
  if (new URLSearchParams(location.search).get('bag') !== '1') return;
  history.replaceState(null, '', location.pathname + location.hash);
  renderCart();
  openCart();
}
const catalogIds = products.map((product) => product.id);
loadProducts().then(openBagFromLink);
verifyPaymentReturn();
if ('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));

// Referral links: remember ?ref= from a shared link, and let signed-in people copy and share their own.
(function referrals() {
  const incoming = new URLSearchParams(window.location.search).get('ref');
  if (incoming && /^[A-Za-z0-9]{6,12}$/.test(incoming)) {
    localStorage.setItem('unishop-ref', incoming.toUpperCase());
    const rest = new URLSearchParams(window.location.search);
    rest.delete('ref');
    history.replaceState(null, '', window.location.pathname + (rest.toString() ? `?${rest}` : '') + window.location.hash);
  }
  const backdropNode = document.querySelector('#referral-backdrop');
  const button = document.querySelector('#referral-button');
  if (!backdropNode || !button) return;
  const linkInput = document.querySelector('#referral-link');
  const countNode = document.querySelector('#referral-count');
  const shareButton = document.querySelector('#referral-share');
  const close = () => backdropNode.classList.remove('open');
  button.addEventListener('click', async () => {
    if (!sessionToken || !currentUser) {
      openAuth('customer', 'register');
      showToast('Create an account or sign in to get your referral link.');
      return;
    }
    try {
      const data = await apiRequest('/api/me/referral');
      linkInput.value = data.link;
      document.querySelector('#referral-whatsapp').href = `https://wa.me/?text=${encodeURIComponent(`Shop and book trusted services in Uyo on Unishop: ${data.link}`)}`;
      countNode.textContent = data.count ? `${data.count} ${data.count === 1 ? 'person has' : 'people have'} joined with your link.` : 'No one has joined with your link yet.';
      shareButton.hidden = !navigator.share;
      const rewardNode = document.querySelector('#referral-reward');
      if (rewardNode) rewardNode.textContent = data.credits ? `You have ${formatPrice(data.credits * data.rewardNaira)} off waiting for your next order.` : (data.welcomeAvailable ? `You have ${formatPrice(data.rewardNaira)} off your first order.` : '');
      backdropNode.classList.add('open');
    } catch (error) { showToast(error.message); }
  });
  document.querySelector('#referral-copy').addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(linkInput.value); }
    catch { linkInput.select(); document.execCommand('copy'); }
    showToast('Referral link copied.');
  });
  shareButton.addEventListener('click', () => navigator.share({ title: 'Unishop', text: 'Shop and book trusted services in Uyo on Unishop.', url: linkInput.value }).catch(() => {}));
  document.querySelector('#referral-close').addEventListener('click', close);
  backdropNode.addEventListener('click', (event) => { if (event.target === backdropNode) close(); });
  document.addEventListener('keydown', (event) => { if (event.key === 'Escape') close(); });
})();
loadReward();

// Left menu: sections, service categories and referral live behind the three-line button.
(() => {
  const menu = document.querySelector('#site-menu');
  const backdrop = document.querySelector('#menu-backdrop');
  const toggle = document.querySelector('#menu-button');
  if (!menu || !toggle) return;
  const setOpen = (open) => {
    menu.classList.toggle('open', open);
    backdrop.classList.toggle('open', open);
    menu.setAttribute('aria-hidden', String(!open));
    toggle.setAttribute('aria-expanded', String(open));
  };
  const list = document.querySelector('#menu-niches');
  const renderMenuGroups = () => {
    list.innerHTML = serviceGroups.map((group) => `<details class="menu-group"><summary>${escapeShortText(group.name)}</summary><button type="button" data-menu-group="${escapeShortText(group.name)}">All ${escapeShortText(group.name)}</button>${group.services.map((name) => `<button type="button" data-menu-niche="${escapeShortText(name)}" data-menu-niche-group="${escapeShortText(group.name)}">${escapeShortText(name)}</button>`).join('')}</details>`).join('');
  };
  window.renderServiceMenu = renderMenuGroups;
  renderMenuGroups();
  toggle.addEventListener('click', () => setOpen(!menu.classList.contains('open')));
  backdrop.addEventListener('click', () => setOpen(false));
  document.querySelector('#menu-close').addEventListener('click', () => setOpen(false));
  document.addEventListener('keydown', (event) => { if (event.key === 'Escape') setOpen(false); });
  menu.addEventListener('click', (event) => {
    const niche = event.target.closest('[data-menu-niche], [data-menu-group]');
    if (niche) {
      marketMode = 'services';
      selectedCategory = 'All';
      searchTerm = '';
      document.querySelector('#search-input').value = '';
      document.querySelectorAll('[data-nav-mode]').forEach((item) => {
        const active = item.dataset.navMode === 'services';
        item.classList.toggle('active', active);
        if (active) item.setAttribute('aria-current', 'page'); else item.removeAttribute('aria-current');
      });
      activeServiceGroup = niche.dataset.menuGroup || niche.dataset.menuNicheGroup || 'All';
      renderProviders(niche.dataset.menuNiche || 'All');
      document.querySelector('#products').scrollIntoView({ behavior: 'smooth' });
      setOpen(false);
      return;
    }
    if (event.target.closest('[data-nav-mode], .referral-button, .sell-link')) setOpen(false);
  });
})();

document.querySelector('#service-bar')?.addEventListener('click', (event) => {
  const groupChip = event.target.closest('[data-service-group]');
  const chip = event.target.closest('[data-service-chip]');
  if (!groupChip && !chip) return;
  const rows = [...event.currentTarget.querySelectorAll('.service-bar-row')].map((row) => row.scrollLeft);
  if (groupChip) selectServiceGroup(groupChip.dataset.serviceGroup); else renderProviders(chip.dataset.serviceChip);
  const fresh = document.querySelector('#service-bar');
  fresh.querySelectorAll('.service-bar-row').forEach((row, i) => { if (!groupChip || i === 0) row.scrollLeft = rows[i] || 0; });
  fresh.querySelectorAll('.service-bar-row').forEach((row) => row.querySelector('.selected')?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' }));
});
