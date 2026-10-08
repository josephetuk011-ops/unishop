const products = [
  { id: 'linen-set', name: 'Everyday linen set', seller: 'Sunday Studio, Uyo', category: 'Home', price: 28500, oldPrice: 36000, rating: '4.9', reviews: 84, badge: 'LOCAL FAVOURITE', image: 'photo-1616486338812-3dadae4b4ace' },
  { id: 'crossbody', name: 'The soft-side crossbody', seller: 'Moyo Atelier, Uyo', category: 'Fashion', price: 18900, rating: '4.8', reviews: 62, badge: 'JUST LANDED', image: 'photo-1548036328-c9fa89d128fa' },
  { id: 'face-oil', name: 'Glow ritual face oil', seller: 'Ora Botanics, Uyo', category: 'Beauty', price: 12500, rating: '5.0', reviews: 41, badge: 'SMALL BATCH', image: 'photo-1608248543803-ba4f8c70ae0b' },
  { id: 'headphones', name: 'Studio wireless headphones', seller: 'Circuit & Co., Uyo', category: 'Tech', price: 47500, rating: '4.7', reviews: 119, badge: 'GOOD FIND', image: 'photo-1505740420928-5e560c06d30e' },
  { id: 'ceramic-cup', name: 'Sunday morning cup', seller: 'Clay Things, Uyo', category: 'Home', price: 8900, rating: '4.9', reviews: 37, badge: 'HANDMADE', image: 'photo-1514228742587-6b1558fcca3d' },
  { id: 'woven-tote', name: 'Market day woven tote', seller: 'Abeni Goods, Uyo', category: 'Fashion', price: 14900, rating: '4.8', reviews: 55, badge: 'LOCAL FAVOURITE', image: 'photo-1590874103328-eac38a683ce7' },
  { id: 'skin-kit', name: 'The soft-skin starter kit', seller: 'Ora Botanics, Uyo', category: 'Beauty', price: 22000, rating: '4.9', reviews: 28, badge: 'BUNDLE & SAVE', image: 'photo-1556229010-6c3f2c9ca5f8' },
  { id: 'speaker', name: 'Pocket-sized good tunes', seller: 'Circuit & Co., Uyo', category: 'Tech', price: 31500, rating: '4.8', reviews: 93, badge: 'TRENDING', image: 'photo-1608043152269-423dbba4e7e1' }
];

const providers = [];
const serviceNiches = [
  ['Barbing', 'photo-1503951914875-452162b0f3f1'], ['Cleaning', 'photo-1581578731548-c64695cc6952'], ['Cooking', 'photo-1556911220-bff31c812dba'],
  ['Hair dressing', 'photo-1560066984-138dadb4c035'], ['Decorating', 'photo-1616486338812-3dadae4b4ace'], ['Grass clearing', 'photo-1585320806297-9794b3e4eeae'],
  ['Mechanic', 'photo-1486262715619-67b85e0b08d3'], ['Electrician', 'photo-1621905251189-08b45d6a269e'], ['Plumber', 'photo-1607472586893-edb57bdc0e39'],
  ['Photographer', 'photo-1542038784456-1ea8e935640e'], ['Makeup', 'photo-1522335789203-aabd1fc54bc9'], ['Fashion designing', 'photo-1558618666-fcd25c85cd64'],
  ['Manicure and pedicure', 'photo-1604654894610-df63bc536371'], ['Therapist', 'photo-1544161515-4ab6ce6db874']
];
let activeNiche = 'All';
let marketMode = 'all';

const formatPrice = (amount) => `₦${amount.toLocaleString('en-NG')}`;
const imageUrl = (id, width = 640) => id?.startsWith('/') ? id : `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${width}&q=80`;
const readStorage = (key, fallback) => {
  try { return JSON.parse(localStorage.getItem(key)) || fallback; } catch { return fallback; }
};
let selectedCategory = 'All';
let searchTerm = '';
let selectedAuthRole = 'customer';
let selectedAuthMode = 'login';
let cart = readStorage('marketday-cart', {});
let saved = new Set(readStorage('marketday-saved', []));
let sessionToken = localStorage.getItem('unishop-token') || '';
let currentUser = readStorage('unishop-user', null);
let toastTimer;

const productGrid = document.querySelector('#product-grid');
const shortsSection = document.createElement('section');
shortsSection.className = 'shorts-section page-width';
shortsSection.id = 'products-shorts';
shortsSection.innerHTML = '<div class="shorts-heading"><div><p class="eyebrow">QUICK LOOKS FROM UYO</p><h2>Products Shorts</h2><p>Watch a short, then add it to your bag or book a local pro.</p></div></div><div class="shorts-grid" id="shorts-grid"></div>';
document.querySelector('#join').before(shortsSection);
const shortsGrid = document.querySelector('#shorts-grid');
const cartDrawer = document.querySelector('#cart-drawer');
const backdrop = document.querySelector('#drawer-backdrop');
const toastNode = document.querySelector('#toast');
const heroVideo = document.querySelector('.hero-video');
const heroMotionToggle = document.querySelector('.hero-motion-toggle');
if (heroVideo && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) heroVideo.play().catch(() => {});
heroMotionToggle?.addEventListener('click', () => {
  if (heroVideo.paused) {
    heroVideo.play().catch(() => {});
    heroMotionToggle.textContent = 'Ⅱ';
    heroMotionToggle.setAttribute('aria-label', 'Pause hero video');
    heroMotionToggle.title = 'Pause background video';
    heroMotionToggle.setAttribute('aria-pressed', 'true');
  } else {
    heroVideo.pause();
    heroMotionToggle.textContent = '▶';
    heroMotionToggle.setAttribute('aria-label', 'Play hero video');
    heroMotionToggle.title = 'Play background video';
    heroMotionToggle.setAttribute('aria-pressed', 'false');
  }
});
document.querySelector('#products .section-heading .eyebrow').textContent = 'SHOP GOODS · BOOK UYO SERVICES';
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

function renderShorts() {
  const shortProducts = products.filter((product) => product.video && Number(product.videoDuration) > 0 && Number(product.videoDuration) <= 30);
  const shortServices = providers.filter((provider) => provider.video && Number(provider.videoDuration) > 0 && Number(provider.videoDuration) <= 30);
  const productCards = shortProducts.map((product) => `<article class="short-card"><video src="${escapeShortText(product.video)}" poster="${escapeShortText(imageUrl(product.image, 640))}" controls muted playsinline preload="metadata"></video><div class="short-card-copy"><p class="short-card-source">${escapeShortText(product.seller || 'Local vendor')}</p><h3>${escapeShortText(product.name)}</h3><div class="short-card-action"><strong>${formatPrice(Number(product.price))}</strong><button class="add-button" data-short-add="${escapeShortText(product.id)}">Add to bag</button></div></div></article>`);
  const serviceCards = shortServices.map((provider) => {
    const image = provider.portfolio?.[0] || provider.image || serviceNiches.find(([name]) => name === (provider.niche || provider.category))?.[1];
    const title = provider.title || provider.trade || provider.niche || 'Local service';
    return `<article class="short-card"><video src="${escapeShortText(provider.video)}" poster="${escapeShortText(imageUrl(image, 640))}" controls muted playsinline preload="metadata"></video><div class="short-card-copy"><p class="short-card-source">${escapeShortText(provider.provider || provider.name || 'Service provider')}</p><h3>${escapeShortText(title)}</h3><div class="short-card-action"><strong>${formatPrice(Number(provider.price))}</strong><button class="book-button" data-short-book="${escapeShortText(provider.id)}">Book</button></div></div></article>`;
  });
  const cards = [...productCards, ...serviceCards];
  shortsGrid.innerHTML = cards.join('') || '<p class="shorts-empty">No product or service shorts yet.</p>';
}

function renderProducts() {
  const goods = products.filter((product) => {
    const matchesCategory = selectedCategory === 'All' || product.category === selectedCategory;
    const matchesSearch = `${product.name} ${product.seller} ${product.category}`.toLowerCase().includes(searchTerm);
    return matchesCategory && matchesSearch;
  });
  const goodsMarkup = marketMode === 'services' ? [] : goods.map((product, index) => `
    <article class="product-card goods-card" style="animation-delay:${index * 35}ms">
      <div class="product-image-wrap"><img class="product-image" src="${imageUrl(product.image)}" alt="${product.name}" loading="lazy"><button class="product-open-image" data-product-detail="${product.id}" aria-label="View ${product.name} details"></button><span class="product-badge ${product.category === 'Beauty' ? 'coral' : ''}">${product.badge || 'UYO SHOP'}</span>${product.video ? '<span class="product-video-badge">▶ VIDEO</span>' : ''}<button class="save-button ${saved.has(product.id) ? 'saved' : ''}" data-save="${product.id}" aria-label="${saved.has(product.id) ? 'Remove from' : 'Save to'} favourites">${saved.has(product.id) ? '♥' : '♡'}</button></div>
      <div class="product-details"><div class="product-vendor">${product.seller}</div><h3 class="product-name"><button class="product-title-open" data-product-detail="${product.id}">${product.name}</button></h3><div class="product-bottom"><span class="product-price">${formatPrice(product.price)}</span>${product.rating ? `<span class="product-rating"><b>★</b> ${product.rating} <span>(${product.reviews || 0})</span></span>` : '<span class="product-rating">New in Uyo</span>'}<button class="add-button" data-add="${product.id}" aria-label="Add ${product.name} to bag">+</button></div></div>
    </article>`);
  const services = providers.filter((provider) => {
    const matchesNiche = activeNiche === 'All' || provider.niche === activeNiche || provider.category === activeNiche || provider.trade === activeNiche;
    const matchesSearch = `${provider.provider || provider.name} ${provider.title || provider.trade} ${provider.niche || ''} ${provider.neighbourhood || ''}`.toLowerCase().includes(searchTerm);
    return matchesNiche && matchesSearch;
  });
  const serviceMarkup = marketMode === 'goods' ? [] : services.map((provider, index) => {
    const image = provider.portfolio?.[0] || provider.image || serviceNiches.find(([name]) => name === (provider.niche || provider.category))?.[1];
    return `<article class="product-card service-market-card" style="animation-delay:${(index + goodsMarkup.length) * 35}ms"><button class="service-market-image" data-book="${provider.id}" aria-label="View and book ${provider.title || provider.trade}"><img src="${imageUrl(image, 760)}" alt="${provider.title || provider.trade} by ${provider.provider || provider.name}" loading="lazy"><span class="service-image-tag">${provider.niche || provider.category || 'LOCAL SERVICE'}</span><span class="service-open-label">View service ↗</span></button><div class="product-details"><div class="product-vendor">${provider.provider || provider.name} · ${provider.neighbourhood || 'Uyo, Akwa Ibom'}</div><h3 class="product-name">${provider.title || provider.trade}</h3><div class="product-bottom"><span class="product-price">${formatPrice(Number(provider.price))}</span><span class="product-rating"><b>★</b> ${Number(provider.rating || 0).toFixed(1)} <span>(${provider.reviewCount || provider.reviews || 0})</span></span><button class="book-button" data-book="${provider.id}">Book</button></div></div></article>`;
  });
  const listings = [...goodsMarkup, ...serviceMarkup];
  document.querySelector('.category-pill[data-category="All"] span').textContent = String(listings.length);
  productGrid.innerHTML = listings.join('') || `<p class="no-results">${marketMode === 'services' && activeNiche !== 'All' ? `No ${activeNiche.toLowerCase()} listings found yet.` : 'No listings match that search. Try another category.'}</p>`;
  const nicheGrid = document.querySelector('#marketplace-niches');
  nicheGrid.innerHTML = serviceNiches.map(([name, image]) => `<button class="service-niche-card ${activeNiche === name ? 'selected' : ''}" data-service-niche="${name}"><img src="${imageUrl(image, 640)}" alt="${name} service in Uyo" loading="lazy"><span>${name}</span><b>Explore ↗</b></button>`).join('');
  nicheGrid.hidden = marketMode === 'goods';
  document.querySelector('.category-pills').hidden = marketMode === 'services';
  document.querySelectorAll('[data-market]').forEach((button) => button.classList.toggle('selected', button.dataset.market === marketMode));
}

function renderProviders(category = 'All') {
  activeNiche = category;
  renderProducts();
}

function openProductDetail(productId) {
  const product = products.find((item) => item.id === productId);
  if (!product) return;
  const media = document.querySelector('#detail-media');
  media.innerHTML = `<img class="detail-image" src="${imageUrl(product.image, 1200)}" alt="${product.name}">${product.video ? `<video class="detail-video" src="${imageUrl(product.video)}" controls playsinline preload="metadata" aria-label="Vendor or brand video showing ${product.name}"></video>` : ''}`;
  document.querySelector('#detail-category').textContent = `${product.category} · UYO MARKETPLACE`;
  document.querySelector('#product-detail-title').textContent = product.name;
  document.querySelector('#detail-rating').innerHTML = product.rating ? `<strong>★ ${product.rating}</strong> <span>${product.reviews || 0} customer ratings</span>` : '<span>New listing · No ratings yet</span>';
  document.querySelector('#detail-seller').textContent = `From ${product.seller}`;
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
  document.querySelector('#product-detail-backdrop').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function renderCart() {
  const entries = Object.entries(cart).filter(([id, quantity]) => quantity > 0 && products.some((product) => product.id === id));
  const totalItems = entries.reduce((sum, [, quantity]) => sum + quantity, 0);
  const subtotal = entries.reduce((sum, [id, quantity]) => sum + products.find((product) => product.id === id).price * quantity, 0);
  document.querySelector('.cart-count').textContent = String(totalItems);
  document.querySelector('.drawer-item-count').textContent = `(${totalItems})`;
  document.querySelector('#cart-subtotal').textContent = formatPrice(subtotal);
  document.querySelector('#cart-items').innerHTML = entries.map(([id, quantity]) => {
    const product = products.find((item) => item.id === id);
    return `<article class="cart-item"><img src="${imageUrl(product.image, 160)}" alt=""><div><div class="cart-item-name">${product.name}</div><div class="cart-item-vendor">${product.seller}</div><div class="quantity-controls"><button data-quantity="${id}" data-change="-1" aria-label="Remove one ${product.name}">−</button><span>${quantity}</span><button data-quantity="${id}" data-change="1" aria-label="Add one ${product.name}">+</button></div></div><div class="cart-item-price">${formatPrice(product.price * quantity)}</div></article>`;
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

function addToCart(id) {
  cart[id] = (cart[id] || 0) + 1;
  renderCart();
  showToast('Added to your bag');
}

function openBooking(providerId) {
  const provider = providers.find((person) => person.id === providerId);
  if (!provider) return;
  const modal = document.querySelector('#modal-backdrop');
  const providerName = provider.provider || provider.name;
  const serviceName = provider.title || provider.trade || provider.niche;
  document.querySelector('#booking-pro').innerHTML = `<img src="${imageUrl(provider.portfolio?.[0] || provider.image, 120)}" alt=""><div><strong>${providerName}</strong><span>${serviceName} · ${formatPrice(Number(provider.price))}</span></div>`;
  document.querySelector('#booking-form').dataset.provider = provider.id;
  modal.classList.add('open');
  document.body.style.overflow = 'hidden';
  document.querySelector('#booking-form input').focus();
}

const authRoleNames = { customer: 'Customer', seller: 'Vendors and Brands', provider: 'Service provider', dispatch: 'Dispatch rider' };
const authBackdrop = document.querySelector('#auth-backdrop');
const authForm = document.querySelector('#auth-form');
authForm.autocomplete = 'off';
authForm.elements.name.autocomplete = 'off';
authForm.elements.email.autocomplete = 'off';
authForm.elements.username.autocomplete = 'username';
authForm.elements.password.autocomplete = 'new-password';

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
  document.querySelector('.auth-submit').innerHTML = registering ? `Create ${authRoleNames[selectedAuthRole]} account <span>→</span>` : 'Sign in <span>→</span>';
  document.querySelector('.auth-intro').textContent = registering ? `${authRoleNames[selectedAuthRole]} account · Uyo, Akwa Ibom` : 'Sign in with your username and password.';
}

function openAuth(role = 'customer', mode = 'login') {
  selectedAuthRole = authRoleNames[role] ? role : 'customer';
  selectedAuthMode = mode;
  authForm.reset();
  authForm.elements.niche.innerHTML = serviceNiches.map(([name]) => `<option value="${name}">${name}</option>`).join('');
  updateAuthForm();
  authBackdrop.classList.add('open');
  document.body.style.overflow = 'hidden';
  (selectedAuthMode === 'register' ? authForm.elements.name : authForm.elements.username).focus();
}

function closeAuth() {
  authBackdrop.classList.remove('open');
  document.body.style.overflow = '';
}

document.querySelector('.announcement-close').addEventListener('click', () => document.querySelector('.announcement').remove());
document.querySelector('.cart-button').addEventListener('click', openCart);
document.querySelector('.close-drawer').addEventListener('click', closeCart);
document.querySelector('.close-empty').addEventListener('click', closeCart);
backdrop.addEventListener('click', closeCart);

function apiRequest(url, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (sessionToken) headers.Authorization = `Bearer ${sessionToken}`;
  return fetch(url, { ...options, headers }).then(async (response) => {
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || 'The request could not be completed.');
    return result;
  });
}

function openCheckout() {
  const lines = Object.entries(cart).filter(([, quantity]) => quantity > 0);
  if (!lines.length) return;
  document.querySelector('#checkout-items').innerHTML = lines.map(([id, quantity]) => {
    const product = products.find((item) => item.id === id);
    if (!product) return '';
    return `<div class="checkout-line"><span>${quantity} × ${product.name}</span><strong>${formatPrice(product.price * quantity)}</strong></div>`;
  }).join('') + '<div class="checkout-line delivery-charge"><span>Uyo delivery</span><strong>₦500</strong></div>';
  const subtotal = lines.reduce((total, [id, quantity]) => total + (products.find((product) => product.id === id)?.price || 0) * quantity, 0) + 500;
  document.querySelector('#checkout-total').textContent = formatPrice(subtotal);
  closeCart();
  document.querySelector('#checkout-backdrop').classList.add('open');
  document.body.style.overflow = 'hidden';
  document.querySelector('#checkout-form input').focus();
}

function closeCheckout() {
  document.querySelector('#checkout-backdrop').classList.remove('open');
  document.body.style.overflow = '';
}

function setPaymentStatus(state, reference, details = '') {
  const labels = {
    checking: ['PAYMENT UPDATE', 'Checking your payment', 'We are confirming the transaction securely with Paystack.', '…'],
    paid: ['PAYMENT CONFIRMED', 'Your order is in!', 'Payment was verified. Unishop will prepare your order for delivery in Uyo.', '✓'],
    pending: ['PAYMENT NOT CONFIRMED', 'Your order is still unpaid', details || 'No successful payment was confirmed. Your bag is still saved so you can try again.', '!'],
    error: ['PAYMENT CHECK FAILED', 'We could not verify that yet', details || 'Your order has not been marked as paid. Please retry the payment or contact support with this reference.', '!']
  }[state];
  document.querySelector('#payment-status-label').textContent = labels[0];
  document.querySelector('#payment-status-title').textContent = labels[1];
  document.querySelector('#payment-status-description').textContent = labels[2];
  document.querySelector('#payment-status-icon').textContent = labels[3];
  document.querySelector('#payment-reference').textContent = reference ? `Reference: ${reference}` : '';
  document.querySelector('#payment-status-backdrop').classList.add('open');
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
  submit.disabled = true;
  submit.textContent = 'Connecting securely…';
  try {
    const result = await apiRequest('/api/payments/initialize', {
      method: 'POST',
      body: JSON.stringify({
        email: form.elements.email.value,
        customer: { name: form.elements.name.value, phone: form.elements.phone.value },
        delivery: { address: form.elements.address.value, neighbourhood: form.elements.neighbourhood.value },
        items: Object.entries(cart).map(([id, quantity]) => ({ id, quantity }))
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
    if (result.order.paymentStatus === 'paid') {
      cart = {};
      localStorage.setItem('marketday-cart', JSON.stringify(cart));
      renderCart();
      document.querySelector('#checkout-form').reset();
      setPaymentStatus('paid', reference);
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

document.querySelectorAll('.category-pill').forEach((pill) => pill.addEventListener('click', () => {
  selectedCategory = pill.dataset.category;
  activeNiche = 'All';
  searchTerm = '';
  document.querySelector('#search-input').value = '';
  document.querySelectorAll('.category-pill').forEach((item) => item.classList.toggle('selected', item === pill));
  renderProducts();
}));
document.querySelectorAll('[data-nav-category]').forEach((link) => link.addEventListener('click', () => {
  selectedCategory = link.dataset.navCategory;
  searchTerm = '';
  document.querySelector('#search-input').value = '';
  document.querySelectorAll('.category-pill').forEach((pill) => pill.classList.toggle('selected', pill.dataset.category === selectedCategory));
  renderProducts();
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
  if (bookButton) { openBooking(bookButton.dataset.book); return; }
  if (productDetailButton) openProductDetail(productDetailButton.dataset.productDetail);
});

shortsGrid.addEventListener('click', (event) => {
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
document.querySelectorAll('[data-market]').forEach((button) => button.addEventListener('click', () => {
  marketMode = button.dataset.market;
  activeNiche = 'All';
  selectedCategory = 'All';
  document.querySelectorAll('.category-pill').forEach((pill) => pill.classList.toggle('selected', pill.dataset.category === 'All'));
  renderProducts();
}));

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
  addToCart(event.currentTarget.dataset.add);
  closeProductDetail();
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
    const payment = await apiRequest('/api/payments/initialize', { method: 'POST', body: JSON.stringify({ bookingId: result.booking.id }) });
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
  try {
    const registering = selectedAuthMode === 'register';
    const credentials = { username: form.elements.username.value, password: form.elements.password.value };
    if (registering) {
      credentials.name = form.elements.name.value;
      credentials.email = form.elements.email.value;
      credentials.role = selectedAuthRole;
      const businessName = form.elements.business.value.trim();
      if (businessName) credentials.businessName = businessName;
      if (selectedAuthRole === 'provider') credentials.niche = form.elements.niche.value;
    }
    const result = await apiRequest(`/api/auth/${registering ? 'register' : 'login'}`, {
      method: 'POST',
      body: JSON.stringify(credentials)
    });
    sessionToken = result.token;
    currentUser = result.user;
    localStorage.setItem('unishop-token', sessionToken);
    localStorage.setItem('unishop-user', JSON.stringify(currentUser));
    closeAuth();
    showToast(`Welcome${registering ? ' to Unishop' : ' back'}, ${currentUser.name}.`);
    document.querySelector('.account-button span:last-child').textContent = currentUser.name.split(' ')[0];
    form.reset();
    if (['seller', 'provider', 'dispatch'].includes(currentUser.role)) window.location.assign('/dashboard.html');
  } catch (error) {
    showToast(error.message);
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
renderCart();
document.querySelectorAll('a[href="#services"], a[href="#providers"]').forEach((link) => link.setAttribute('href', '#products'));
document.querySelector('#services')?.remove();
if (currentUser?.name) document.querySelector('.account-button span:last-child').textContent = currentUser.name.split(' ')[0];
if (localStorage.getItem('unishop-theme') === 'dark') document.body.classList.add('dark-theme');
fetch('/api/services').then((response) => response.ok ? response.json() : []).then((data) => {
  if (Array.isArray(data) && data.length) {
    providers.splice(0, providers.length, ...data);
    renderProviders(activeNiche);
    renderShorts();
  }
}).catch(() => {});
fetch('/api/products').then((response) => response.ok ? response.json() : []).then((data) => {
  if (Array.isArray(data) && data.length) {
    const known = new Set(products.map((product) => product.id));
    data.forEach((product) => { if (!known.has(product.id)) products.push({ ...product, badge: 'UYO SHOP' }); });
    renderProducts();
    renderShorts();
    renderCart();
  }
}).catch(() => {});
verifyPaymentReturn();