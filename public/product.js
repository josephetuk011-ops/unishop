const root = document.querySelector('#pp-root');
const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const specLabels = { brand: 'Brand', deviceType: 'Kind of device', model: 'Model', condition: 'Condition', storage: 'Storage', ram: 'RAM', battery: 'Battery', batteryLife: 'Battery life', screen: 'Screen size', camera: 'Main camera', network: 'Network', sim: 'SIM', colour: 'Colour', warranty: 'Warranty', processor: 'Processor', storageType: 'Storage type', capacity: 'Battery capacity', connectivity: 'Connectivity', gender: 'For', style: 'Style', material: 'Fabric or material', madeToMeasure: 'Sewing option', sewingDays: 'Time to sew a custom order', chest: 'Chest or bust', waist: 'Waist', hip: 'Hip', shoulder: 'Shoulder', sleeve: 'Sleeve length', length: 'Length', inseam: 'Inseam', care: 'Care', footLength: 'Foot length it fits', width: 'Width', batteryHealth: 'Battery health', biometrics: 'Face ID or fingerprint', accessories: 'Accessories included', graphics: 'Graphics', keyboardLight: 'Keyboard light', charger: 'Charger', usedMonths: 'Months used', size: 'Size', fit: 'Fit', stretchy: 'Stretchy', transparent: 'Transparent', lined: 'Lined', setType: 'Set or single', occasion: 'Occasion', modelInfo: 'Model info', footType: 'Type', euSize: 'EU size', usSize: 'US size', ukSize: 'UK size', wideFeet: 'Wide feet friendly', heelHeight: 'Heel height', sole: 'Sole', hasBox: 'Comes with box', hairType: 'Hair type', wigLength: 'Length', density: 'Density', lace: 'Lace type', capSize: 'Cap size', strap: 'Adjustable strap', dyeable: 'Can be dyed or bleached', shedding: 'Shedding or tangling', comesWith: 'Comes with', bagType: 'Type', dimensions: 'Size (L x W x H in cm)', laptop: 'Can carry laptop', bagMaterial: 'Material', compartments: 'Compartments', closure: 'Closure', bagWeight: 'Weight', fragrance: 'Name', sizeMl: 'Size', perfumeType: 'Type', longevity: 'Longevity', projection: 'Projection', notes: 'Notes', authenticity: 'Original or inspired', sealed: 'Sealed', jewelryType: 'Type', jewelryMaterial: 'Material', tarnish: 'Fade or tarnish', waterproof: 'Safe in water', hypoallergenic: 'Hypoallergenic', jewelrySize: 'Size', deliveryTime: 'Delivery time', returnPolicy: 'Warranty or return', inBox: "What's in the box" };
const specUnits = { battery: ' mAh', screen: ' inches', camera: ' MP', capacity: ' mAh', batteryLife: '', sewingDays: ' days', chest: ' in', waist: ' in', hip: ' in', shoulder: ' in', sleeve: ' in', length: ' in', inseam: ' in', footLength: ' cm', width: ' in', wigLength: ' in', sizeMl: ' ml', batteryHealth: '%', usedMonths: ' months' };
function specTable(product) {
  const rows = Object.entries(product.specs || {}).filter(([key]) => specLabels[key]);
  if (!rows.length) return '';
  const unit = (key, value) => key === 'batteryLife' && typeof value === 'number' ? ' hours' : (specUnits[key] || '');
  return `<section class="pp-section"><h2>Specifications</h2><table class="pp-specs"><tbody>${rows.map(([key, value]) => `<tr><th>${esc(specLabels[key])}</th><td>${esc(String(value))}${unit(key, value)}</td></tr>`).join('')}</tbody></table></section>`;
}
const img = (id, width = 900) => !id ? '' : id.startsWith('/') || /^https:\/\/res\.cloudinary\.com\//.test(id) ? id : `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${width}&q=80`;
const money = (n) => `₦${Number(n).toLocaleString('en-NG')}`;
const stars = (n) => '★'.repeat(Math.round(n)) + '☆'.repeat(5 - Math.round(n));
const productId = new URLSearchParams(location.search).get('id') || '';
const defaultDescriptions = {
  'linen-set': 'A breathable everyday linen set from an independent Uyo home studio.',
  crossbody: 'A soft everyday crossbody bag from a local fashion label.',
  'face-oil': 'A small-batch botanical face oil made for a simple glow routine.',
  headphones: 'Wireless over-ear headphones for music, calls and everyday listening.',
  'ceramic-cup': 'A hand-finished ceramic cup for slow mornings and daily tea.',
  'woven-tote': 'A sturdy woven tote made for market runs and everyday carry.',
  'skin-kit': 'A gentle skincare starter bundle from a local beauty brand.',
  speaker: 'A compact wireless speaker for bringing music along.'
};
let product;
let all = [];
let chosenSize;
let quantity = 1;

const readCart = () => { try { return JSON.parse(localStorage.getItem('marketday-cart')) || {}; } catch { return {}; } };
function updateBagCount() {
  document.querySelector('#pp-bag-count').textContent = String(Object.values(readCart()).reduce((sum, n) => sum + (Number(n) > 0 ? Number(n) : 0), 0));
}
function toast(message) {
  const node = document.querySelector('#pp-toast');
  node.textContent = message;
  node.classList.add('show');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => node.classList.remove('show'), 2200);
}
const hasSizes = () => Array.isArray(product.sizes) && product.sizes.length > 0;
function available() {
  if (product.preorder) return Infinity;
  if (product.stock === undefined || product.stock === null) return Infinity;
  if (hasSizes()) return product.sizes.find((row) => row.label === chosenSize)?.quantity ?? 0;
  return product.stock;
}
function addToBag() {
  if (hasSizes() && !chosenSize) { toast('Choose a size first.'); return false; }
  const key = chosenSize ? `${product.id}::${chosenSize}` : product.id;
  const cart = readCart();
  const max = available();
  if (max <= 0) { toast('Sold out.'); return false; }
  const next = (Number(cart[key]) || 0) + quantity;
  if (next > max) { toast(`Only ${max} left.`); return false; }
  cart[key] = next;
  localStorage.setItem('marketday-cart', JSON.stringify(cart));
  updateBagCount();
  return true;
}

function relatedProducts() {
  const others = all.filter((item) => item.id !== product.id && item.stock !== 0);
  const score = (item) => (item.category === product.category ? 2 : 0) + (product.userId && item.userId === product.userId ? 1 : 0);
  return others.map((item) => ({ item, s: score(item) })).sort((a, b) => b.s - a.s).slice(0, 12).map((row) => row.item);
}
const card = (item) => `<a class="pp-card" href="/product.html?id=${encodeURIComponent(item.id)}"><img src="${esc(img(item.image, 420))}" alt="${esc(item.name)}" loading="lazy"><span>${esc(item.name)}</span><strong>${money(item.price)}</strong><small>${item.rating ? `★ ${Number(item.rating).toFixed(1)}/5` : esc(item.seller || '')}</small></a>`;

function render() {
  document.title = `${product.name} | Unishop`;
  const gallery = Array.isArray(product.images) && product.images.length ? product.images.slice(0, 10) : [product.image];
  const slides = gallery.map((photo) => ({ type: 'image', src: photo }));
  if (product.video) slides.push({ type: 'video', src: product.video });
  const brand = product.brandProfile;
  const out = !product.preorder && product.stock === 0;
  const preorderDays = Number(product.preorderDays);
  const stockLine = product.preorder ? `<p class="pp-preorder"><strong>Pre-order</strong> · Delivered in ${preorderDays} day${preorderDays === 1 ? '' : 's'} after you order. You pay now and the vendor prepares it for you.</p>` : product.stock === undefined || product.stock === null ? '' : out ? '<p class="pp-stock out">Sold out</p>' : `<p class="pp-stock">${hasSizes() ? 'In stock' : `${product.stock} available`}</p>`;
  const ratingLine = product.rating ? `<strong>★ ${Number(product.rating).toFixed(1)}/5</strong> · ${product.reviews || 0} customer ratings` : 'New listing · No ratings yet';
  const description = product.description || defaultDescriptions[product.id] || 'A locally listed product from a vendor or brand in Uyo. Contact the vendor or brand for more details.';
  const related = relatedProducts();
  const fromShop = product.userId ? all.filter((item) => item.userId === product.userId && item.id !== product.id).slice(0, 8) : [];
  const token = localStorage.getItem('unishop-token');
  const buttons = `<button class="button button-light pp-add" type="button"${out ? ' disabled' : ''}>Add to bag</button><button class="button button-dark pp-buy" type="button"${out ? ' disabled' : ''}>Buy now</button>`;
  root.innerHTML = `
    <div class="pp-top">
      <div class="pp-gallery">
        <div class="pp-stage" id="pp-stage"></div>
        ${slides.length > 1 ? `<div class="pp-thumbs">${slides.map((slide, index) => `<button class="pp-thumb${index === 0 ? ' active' : ''}" data-slide="${index}" aria-label="Show ${slide.type} ${index + 1}"><img src="${esc(img(slide.type === 'video' ? product.image : slide.src, 160))}" alt="">${slide.type === 'video' ? '<span>▶</span>' : ''}</button>`).join('')}</div>` : ''}
      </div>
      <div class="pp-info">
        <p class="eyebrow">${esc(product.category || '')} · UYO MARKETPLACE</p>
        <h1>${esc(product.name)}</h1>
        <div class="pp-rating">${ratingLine}</div>
        <div class="pp-price">${money(product.price)}</div>
        ${stockLine}
        ${hasSizes() ? `<div class="pp-label">Size</div><div class="pp-sizes">${product.sizes.map((row) => `<button class="pp-size" data-size="${esc(row.label)}"${row.quantity === 0 ? ' disabled' : ''}>${esc(row.label)}<small>${row.quantity === 0 ? 'out' : `${row.quantity} left`}</small></button>`).join('')}</div>` : ''}
        <div class="pp-label">Quantity</div>
        <div class="pp-qty"><button type="button" data-q="-1" aria-label="Fewer">−</button><span id="pp-qty">1</span><button type="button" data-q="1" aria-label="More">+</button></div>
        <div class="pp-actions pp-inline">${buttons}</div>
        ${product.userId ? `<a class="pp-vendor" href="/vendor.html?id=${encodeURIComponent(product.userId)}">${brand?.profileImage ? `<img src="${esc(img(brand.profileImage, 120))}" alt="">` : '<i></i>'}<div><strong>${esc(brand?.businessName || product.seller)}</strong><small>${esc(brand?.placeOfOperation || 'Uyo, Akwa Ibom')}</small></div><b>Visit shop ›</b></a>` : `<div class="pp-vendor"><i></i><div><strong>${esc(product.seller || 'Unishop vendor')}</strong><small>Uyo, Akwa Ibom</small></div></div>`}
        ${String(product.id).startsWith('seller-') && token ? `<div class="pp-rate" id="pp-rate"><span>Bought it? Rate it:</span>${[1, 2, 3, 4, 5].map((n) => `<button type="button" data-rating="${n}" aria-label="${n} out of 5">★</button>`).join('')}</div>` : ''}
      </div>
    </div>
    <section class="pp-section"><h2>Product details</h2><p class="pp-desc">${esc(description)}</p></section>
    ${specTable(product)}
    ${fromShop.length ? `<section class="pp-section"><h2>More from ${esc(brand?.businessName || product.seller)}</h2><div class="pp-grid">${fromShop.map(card).join('')}</div></section>` : ''}
    ${related.length ? `<section class="pp-section"><h2>You may also like</h2><div class="pp-grid">${related.map(card).join('')}</div></section>` : ''}
    <div class="pp-sticky"><div class="pp-actions" style="margin:0;flex:1">${buttons}</div></div>`;
  showSlide(0, slides);
  root.querySelectorAll('.pp-thumb').forEach((thumb) => thumb.addEventListener('click', () => {
    root.querySelectorAll('.pp-thumb').forEach((item) => item.classList.toggle('active', item === thumb));
    showSlide(Number(thumb.dataset.slide), slides);
  }));
  root.querySelectorAll('.pp-size').forEach((button) => button.addEventListener('click', () => {
    chosenSize = button.dataset.size;
    root.querySelectorAll('.pp-size').forEach((item) => item.classList.toggle('active', item === button));
    quantity = 1;
    document.querySelector('#pp-qty').textContent = '1';
  }));
  root.querySelectorAll('[data-q]').forEach((button) => button.addEventListener('click', () => {
    const next = quantity + Number(button.dataset.q);
    const max = hasSizes() && !chosenSize ? 10 : Math.min(10, available());
    if (next < 1) return;
    if (next > max) { toast(hasSizes() && !chosenSize ? 'Choose a size first.' : `Only ${max} left.`); return; }
    quantity = next;
    document.querySelector('#pp-qty').textContent = String(quantity);
  }));
  root.querySelectorAll('.pp-add').forEach((button) => button.addEventListener('click', () => { if (addToBag()) toast('Added to your bag'); }));
  root.querySelectorAll('.pp-buy').forEach((button) => button.addEventListener('click', () => { if (addToBag()) location.assign('/?bag=1'); }));
  document.querySelector('#pp-rate')?.addEventListener('click', async (event) => {
    const star = event.target.closest('[data-rating]');
    if (!star) return;
    try {
      const response = await fetch(`/api/products/${encodeURIComponent(product.id)}/reviews`, { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` }, body: JSON.stringify({ rating: Number(star.dataset.rating) }) });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || 'Could not save your rating.');
      toast('Thanks for rating.');
    } catch (error) { toast(error.message); }
  });
}
function showSlide(index, slides) {
  const stage = document.querySelector('#pp-stage');
  stage.querySelector('video')?.pause();
  const slide = slides[index];
  stage.innerHTML = slide.type === 'video'
    ? `<video src="${esc(img(slide.src))}" controls playsinline autoplay muted aria-label="Video of ${esc(product.name)}"></video>`
    : `<img src="${esc(img(slide.src, 1200))}" alt="${esc(product.name)}">`;
}

updateBagCount();
fetch('/api/products').then((response) => response.ok ? response.json() : []).then((data) => {
  all = Array.isArray(data) ? data : [];
  product = all.find((item) => item.id === productId);
  if (!product) throw new Error('This product was not found.');
  render();
}).catch((error) => { root.innerHTML = `<p class="pp-empty">${esc(error.message)} <a href="/">Back to the marketplace</a></p>`; });
