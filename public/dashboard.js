let token = localStorage.getItem('unishop-token') || '';
const workspace = document.querySelector('#workspace-content');
const roleLabels = { provider: 'Service provider', seller: 'Vendors and Brands', dispatch: 'Dispatch rider', customer: 'Customer', admin: 'Admin' };
const roleNiches = ['Barbing', 'Cleaning', 'Cooking', 'Hair dressing', 'Decorating', 'Grass clearing', 'Mechanic', 'Electrician', 'Plumber', 'Photographer', 'Makeup', 'Fashion designing', 'Manicure and pedicure', 'Therapist'];
let dashboardData;
let selectedView = 'overview';
let toastTimer;

function escapeHtml(value = '') {
  return String(value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
}
function formatMoney(amount = 0) {
  return `₦${Number(amount).toLocaleString('en-NG')}`;
}
function formatDate(value) {
  return value ? new Intl.DateTimeFormat('en-NG', { dateStyle: 'medium' }).format(new Date(value)) : '—';
}
function notify(message) {
  const element = document.querySelector('#workspace-toast');
  element.textContent = message;
  element.classList.add('visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => element.classList.remove('visible'), 3200);
}
async function refreshSession() {
  try {
    const response = await fetch('/api/auth/refresh', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
    if (!response.ok) return false;
    const result = await response.json();
    token = result.token;
    localStorage.setItem('unishop-token', token);
    localStorage.setItem('unishop-user', JSON.stringify(result.user));
    return true;
  } catch {
    return false;
  }
}
function endSession() {
  fetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
  localStorage.removeItem('unishop-token');
  localStorage.removeItem('unishop-user');
  window.location.assign('/?signin=1');
}
async function api(url, options = {}, retried = false) {
  const headers = { Authorization: `Bearer ${token}`, ...(options.headers || {}) };
  if (!(options.body instanceof FormData)) headers['Content-Type'] = 'application/json';
  const response = await fetch(url, { ...options, headers });
  if (response.status === 401 && !retried && url !== '/api/auth/refresh') {
    // The access token only lasts 15 minutes; renew it from the refresh cookie and retry once.
    if (await refreshSession()) return api(url, options, true);
    const error = new Error('Your session has expired. Sign in again.');
    error.sessionExpired = true;
    throw error;
  }
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || 'The request could not be completed.');
  return result;
}
function metric(label, value, detail = '') {
  return `<article class="metric"><span class="metric-label">${escapeHtml(label)}</span><strong class="metric-value">${escapeHtml(value)}</strong><span class="metric-foot">${escapeHtml(detail)}</span></article>`;
}
function table(headers, rows, empty) {
  if (!rows.length) return `<div class="empty-state">${escapeHtml(empty)}</div>`;
  return `<div class="table-wrap"><table><thead><tr>${headers.map((item) => `<th>${escapeHtml(item)}</th>`).join('')}</tr></thead><tbody>${rows.join('')}</tbody></table></div>`;
}
function panel(title, body, action = '') {
  return `<section class="panel"><header class="panel-heading"><h3>${escapeHtml(title)}</h3>${action}</header><div class="panel-body">${body}</div></section>`;
}
function header(title, subtitle, button = '') {
  return `<header class="dashboard-welcome"><div><h2>${escapeHtml(title)}</h2><p>${escapeHtml(subtitle)}</p></div>${button}</header>`;
}
function bookingRows(bookings) {
  return bookings.map((booking) => `<tr><td><strong>${escapeHtml(booking.provider || booking.service || 'Service booking')}</strong><br>${escapeHtml(booking.neighbourhood)}</td><td>${escapeHtml(booking.time)}</td><td><span class="status-pill ${escapeHtml(booking.status)}">${escapeHtml(booking.status)}</span><br><small>${escapeHtml(booking.paymentStatus || 'unpaid')}</small></td><td>${booking.amountNaira ? formatMoney(booking.amountNaira) : 'Quote pending'}</td>${dashboardData.role === 'provider' ? `<td><div class="row-actions">${['requested', 'confirmed'].includes(booking.status) && booking.paymentStatus === 'paid' ? `<button class="quiet-button" data-booking-action="accepted" data-id="${escapeHtml(booking.id)}">Accept</button><button class="danger-button" data-booking-action="declined" data-id="${escapeHtml(booking.id)}">Decline</button>` : booking.status === 'accepted' ? `<button class="secondary-button" data-booking-action="completed" data-id="${escapeHtml(booking.id)}">Mark complete</button>` : ''}</div></td>` : ''}</tr>`);
}
function orderRows(orders) {
  return orders.map((order) => `<tr><td><strong>${escapeHtml(order.reference)}</strong><br>${formatDate(order.createdAt)}</td><td>${order.items.map((item) => escapeHtml(item.name)).join(', ')}</td><td>${formatMoney(order.totalNaira)}</td><td><span class="status-pill ${escapeHtml(order.paymentStatus)}">${escapeHtml(order.paymentStatus)}</span></td></tr>`);
}
function serviceCards(listings) {
  if (!listings.length) return '<div class="empty-state">Your live service listings will appear here after you publish one.</div>';
  return `<div class="portfolio-grid">${listings.map((listing) => `<article class="work-card"><img src="${escapeHtml(listing.portfolio?.[0] || '')}" alt="${escapeHtml(listing.title)} work sample"><div class="work-card-body"><h3>${escapeHtml(listing.title)}</h3><p>${escapeHtml(listing.niche)} · ${formatMoney(listing.price)} · ${Number(listing.rating || 0).toFixed(1)} ★ (${listing.reviewCount || 0})</p><p>${escapeHtml(listing.description)}</p></div></article>`).join('')}</div>`;
}
function reviewsPanel(reviews) {
  const body = reviews.length ? reviews.slice().reverse().map((review) => `<article class="review-item"><strong>${escapeHtml(review.reviewer)} <span class="review-stars">${'★'.repeat(review.rating)}</span></strong><p>${escapeHtml(review.comment)}</p></article>`).join('') : '<div class="empty-state">Customer ratings and comments will appear here after completed bookings.</div>';
  return panel('Ratings & comments', body);
}
function moneyNote() {
  return '<div class="earnings-note">Payments remain held until the customer confirms delivery or service completion. Released earnings can be withdrawn to a verified bank account.</div>';
}
function payoutPanel() {
  const account = dashboardData.payoutAccount;
  const bank = account ? `<p class="payout-account-summary">${escapeHtml(account.accountName)} · ${escapeHtml(account.bankName)} · •••• ${escapeHtml(account.accountLast4)}</p>` : '<p class="payout-account-summary">No bank account saved.</p>';
  const rows = (dashboardData.payouts || []).map((payout) => `<tr><td><strong>${escapeHtml(payout.reference)}</strong><br>${formatDate(payout.createdAt)}</td><td>${formatMoney(payout.amountNaira)}</td><td><span class="status-pill ${escapeHtml(payout.status)}">${escapeHtml(payout.status)}</span>${payout.status === 'needs-review' ? `<br><button class="quiet-button" data-retry-payout="${escapeHtml(payout.reference)}">Retry transfer</button>` : ''}</td></tr>`);
  return `<div id="notification-panel">${panel('Notifications', '<div class="empty-state">Loading…</div>')}</div>${panel('Withdrawable balance', `<div class="payout-balance">${formatMoney(dashboardData.availableBalanceNaira || 0)}</div><p class="earnings-note">Commission: 5% below ₦10,000, 10% from ₦10,000 to ₦29,999, and 15% from ₦30,000. Rates apply to your subtotal before dispatch fees. Sellers contribute ₦500 per seller; service providers contribute ₦500. Product riders receive the buyer’s ₦500 plus seller contributions.</p>${bank}<form class="form-grid payout-form" id="payout-account-form"><label class="form-field">Bank<select name="bankCode" id="payout-bank" required><option value="">Loading banks…</option></select></label><label class="form-field">Account number<input name="accountNumber" inputmode="numeric" autocomplete="off" pattern="[0-9]{10}" minlength="10" maxlength="10" required></label><div class="form-actions"><button class="secondary-button" type="submit">${account ? 'Update bank account' : 'Verify bank account'}</button></div></form><form class="form-grid payout-form" id="payout-withdraw-form"><label class="form-field">Withdrawal amount (NGN)<input name="amountNaira" type="number" min="100" max="${Number(dashboardData.availableBalanceNaira || 0)}" step="1" required></label><div class="form-actions"><button class="primary-button" type="submit" ${!account || !(dashboardData.availableBalanceNaira > 0) ? 'disabled' : ''}>Withdraw</button></div></form>`, '')}${panel('Withdrawal history', table(['Reference', 'Amount', 'Status'], rows, 'No withdrawals yet.'))}`;
}
function urlBase64ToUint8Array(value) {
  const padded = value + '='.repeat((4 - value.length % 4) % 4);
  const raw = atob(padded.replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from([...raw].map((char) => char.charCodeAt(0)));
}
async function loadNotifications() {
  const host = document.querySelector('#notification-panel');
  if (!host) return;
  try {
    const result = await api('/api/notifications');
    const supported = 'serviceWorker' in navigator && 'PushManager' in window;
    const button = result.pushEnabled && supported
      ? `<button class="secondary-button" id="enable-push" ${result.subscribed && Notification.permission === 'granted' ? 'disabled' : ''}>${result.subscribed && Notification.permission === 'granted' ? 'Phone notifications on' : 'Turn on phone notifications'}</button>`
      : '<p class="earnings-note">Phone notifications are not available on this browser or have not been configured yet. Email alerts still work.</p>';
    const rows = result.notifications.map((item) => `<div class="compact-row"><span><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(item.body)} · ${formatDate(item.createdAt)}</small></span></div>`).join('') || '<div class="empty-state">New orders, bookings and payments will appear here.</div>';
    host.innerHTML = panel('Notifications', `<div class="compact-list">${rows}</div><div class="form-actions">${button}</div>`);
    if (result.unread) api('/api/notifications/read', { method: 'POST' }).catch(() => {});
  } catch {
    host.innerHTML = '';
  }
}
async function enablePushNotifications() {
  try {
    const { publicKey } = await api('/api/notifications/push-key');
    if (!publicKey) throw new Error('Phone notifications are not configured yet.');
    if (await Notification.requestPermission() !== 'granted') throw new Error('Notifications were blocked in your browser settings.');
    const registration = await navigator.serviceWorker.register('/sw.js');
    await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription() || await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(publicKey) });
    await api('/api/notifications/subscribe', { method: 'POST', body: JSON.stringify({ subscription: subscription.toJSON() }) });
    notify('Phone notifications are on.');
    loadNotifications();
  } catch (error) {
    notify(error.message);
  }
}
async function populatePayoutBanks() {
  const select = document.querySelector('#payout-bank');
  if (!select || select.dataset.loaded) return;
  try {
    const result = await api('/api/payout/banks');
    select.innerHTML = '<option value="">Choose a bank</option>' + result.banks.map((bank) => `<option value="${escapeHtml(bank.code)}">${escapeHtml(bank.name)}</option>`).join('');
    select.dataset.loaded = 'true';
  } catch {
    select.innerHTML = '<option value="">Bank list unavailable</option>';
  }
}
function providerDashboard() {
  const { listings, bookings, reviews, metrics, user } = dashboardData;
  if (selectedView === 'profile') return profileForm();
  if (selectedView === 'listings') return `${header('Your service portfolio', 'Only the 14 Unishop service niches can be listed.', '<button class="primary-button" data-open-form="service">+ Add service</button>')}${panel('Published services', serviceCards(listings))}${serviceForm()}`;
  if (selectedView === 'activity') return `${header('Booking requests', 'Accept work you can deliver around Uyo.')}${panel('Service bookings', table(['Customer request', 'Preferred time', 'Status', 'Quoted price', 'Actions'], bookingRows(bookings), 'No bookings yet. New customer requests will appear here.'))}${reviewsPanel(reviews)}`;
  if (selectedView === 'earnings') return `${header('Your earnings', 'Track booked value and verified payments.') }<div class="metric-grid">${metric('Paid service earnings', formatMoney(metrics.grossEarnings), 'Only paid bookings count')}${metric('Booking value', formatMoney(bookings.reduce((sum, item) => sum + (item.amountNaira || 0), 0)), 'Current listed-price requests')}${metric('Paid bookings', bookings.filter((item) => item.paymentStatus === 'paid').length, 'Verified by Paystack')}</div>${moneyNote()}${panel('Payment activity', table(['Service', 'Date', 'Status', 'Amount'], bookingRows(bookings).map((row) => row.replace(/<td><div class="row-actions">[\s\S]*?<\/div><\/td>/, '')), 'No service payments recorded yet.'))}`;
    if (selectedView === 'earnings') return `${header('Your earnings', 'Track completed work and withdraw available earnings.') }<div class="metric-grid">${metric('Paid service earnings', formatMoney(metrics.grossEarnings), 'Before commission and provider dispatch contribution')}${metric('Booking value', formatMoney(bookings.reduce((sum, item) => sum + (item.amountNaira || 0), 0)), 'Current listed-price requests')}${metric('Paid bookings', bookings.filter((item) => item.paymentStatus === 'paid').length, 'Verified by Paystack')}</div>${payoutPanel()}${panel('Payment activity', table(['Service', 'Date', 'Status', 'Amount'], bookingRows(bookings).map((row) => row.replace(/<td><div class="row-actions">[\s\S]*?<\/div><\/td>/, '')), 'No service payments recorded yet.'))}`;
  return `${header(`Welcome, ${user.name.split(' ')[0]}`, `Your niche: ${user.niche || 'Choose a service niche to get started.'}`, '<button class="primary-button" data-open-form="service">+ Add service</button>')}<div class="metric-grid">${metric('Published services', metrics.listingCount)}${metric('Booking requests', metrics.bookingCount)}${metric('Average rating', metrics.rating ? `${metrics.rating.toFixed(1)} / 5` : '—', `${reviews.length} customer reviews`)}${metric('Verified paid earnings', formatMoney(metrics.grossEarnings), 'Settlements are not enabled')}</div><div class="dashboard-grid">${panel('Recent bookings', table(['Request', 'Preferred time', 'Status', 'Price', 'Actions'], bookingRows(bookings.slice(-5)), 'No bookings yet. Add your work to be discovered.'))}${reviewsPanel(reviews.slice(-5))}</div><div class="panel-gap">${panel('Your work', serviceCards(listings.slice(0, 3)))}</div>${moneyNote()}${serviceForm()}`;
  return `${header(`Welcome, ${user.name.split(' ')[0]}`, `Your niche: ${user.niche || 'Choose a service niche to get started.'}`, '<button class="primary-button" data-open-form="service">+ Add service</button>')}<div class="metric-grid">${metric('Published services', metrics.listingCount)}${metric('Booking requests', metrics.bookingCount)}${metric('Average rating', metrics.rating ? `${metrics.rating.toFixed(1)} / 5` : '—', `${reviews.length} customer reviews`)}${metric('Verified paid earnings', formatMoney(metrics.grossEarnings), 'Before commission and provider dispatch contribution')}</div><div class="dashboard-grid">${panel('Recent bookings', table(['Request', 'Preferred time', 'Status', 'Price', 'Actions'], bookingRows(bookings.slice(-5)), 'No bookings yet. Add your work to be discovered.'))}${reviewsPanel(reviews.slice(-5))}</div><div class="panel-gap">${panel('Your work', serviceCards(listings.slice(0, 3)))}</div>${moneyNote()}${payoutPanel()}${serviceForm()}`;
}
function serviceForm() {
  const options = roleNiches.map((niche) => `<option value="${escapeHtml(niche)}" ${dashboardData.user.niche === niche ? 'selected' : ''}>${escapeHtml(niche)}</option>`).join('');
  return `<section class="panel editor-panel" id="service-editor" hidden><header class="panel-heading"><h3>Publish service and work photos</h3></header><div class="panel-body"><form class="form-grid" id="service-form"><label class="form-field">Choose your niche<select name="niche" required>${options}</select></label><label class="form-field">Starting price (NGN)<input name="price" type="number" required min="500" step="100" placeholder="12000"></label><label class="form-field full">Service title<input name="title" required minlength="3" maxlength="100" placeholder="e.g. Home hair styling and braids"></label><label class="form-field full">Description<textarea name="description" required minlength="10" maxlength="1500" placeholder="Describe the service, area covered and what customers can expect."></textarea></label><label class="form-field full">Photos of your work<input name="images" type="file" accept="image/jpeg,image/png,image/webp" multiple required><span class="form-help">Upload up to 6 JPG, PNG or WebP files, 5 MB each. Choose only your own work.</span></label><label class="form-field full">Short service video <span class="form-help">Optional · MP4 or WebM · maximum 30 seconds.</span><input name="video" type="file" accept="video/mp4,video/webm"></label><div class="upload-preview full" id="service-preview"></div><div class="form-actions"><button class="primary-button" type="submit">Publish service</button><button class="secondary-button" type="button" data-close-form>Cancel</button></div></form></div></section>`;
}
function sellerForm() {
  return `<section class="panel editor-panel" id="product-editor" hidden><header class="panel-heading"><h3>Add a product</h3></header><div class="panel-body"><form class="form-grid" id="product-form"><label class="form-field">Product name<input name="name" required minlength="3" maxlength="100"></label><label class="form-field">Category<select name="category" required><option value="" disabled selected>Choose a category</option>${categoryOptions()}</select></label><label class="form-field">Price in NGN<input name="price" type="number" required min="100" step="100"></label><label class="form-field">Quantity available<input name="quantity" type="number" min="0" max="100000" step="1" required value="1"></label><label class="form-field">Sizes <span class="form-help">Optional. Number available per size, like S:5, M:3, L:2. When filled, the quantity above is ignored.</span><input name="sizes" maxlength="200" placeholder="S:5, M:3, L:2"></label><label class="form-field">Product photos <span class="form-help">1 to 3 photos. The first is the cover.</span><input name="images" type="file" accept="image/jpeg,image/png,image/webp" multiple required></label><div class="upload-preview full" id="product-preview"></div><label class="form-field full">Description<textarea name="description" required minlength="5" maxlength="1000"></textarea></label><label class="form-field full">Product short video <span class="form-help">Optional · MP4 or WebM · maximum 30 seconds.</span><input name="video" type="file" accept="video/mp4,video/webm"></label><div class="form-actions"><button class="primary-button" type="submit">Publish product</button><button class="secondary-button" type="button" data-close-form>Cancel</button></div></form></div></section>`;
}
function sellerDashboard() {
  const { products, orders, metrics, user } = dashboardData;
  if (selectedView === 'profile') return profileForm();
  if (selectedView === 'listings') return `${header('Your product catalogue', 'Manage the products customers can order.', '<button class="primary-button" data-open-form="product">+ Add product</button>')}${panel('Published products', `<div class="portfolio-grid">${products.length ? products.map((product) => `<article class="work-card"><img src="${escapeHtml(product.image)}" alt="${escapeHtml(product.name)}"><div class="work-card-body"><h3>${escapeHtml(product.name)}</h3><p>${formatMoney(product.price)} · ${escapeHtml(product.category)}</p><p class="stock-line">${stockText(product)}</p><button class="secondary-button" type="button" data-restock="${escapeHtml(product.id)}">Update stock</button></div></article>`).join('') : '<div class="empty-state">Add your first product to start your catalogue.</div>'}</div>`)}${productForm()}`;
  if (selectedView === 'activity') return `${header('Customer orders', 'Only confirmed Paystack payments appear as paid orders.')}${panel('Orders containing your products', table(['Order', 'Products', 'Total', 'Payment'], orderRows(orders), 'No paid orders yet.'))}`;
  if (selectedView === 'earnings') return `${header('Sales and earnings', 'Track paid product sales for your shop.') }<div class="metric-grid">${metric('Verified gross sales', formatMoney(metrics.grossSales), 'Before fees and refunds')}${metric('Paid orders', metrics.orderCount)}${metric('Active products', metrics.productCount)}</div>${moneyNote()}${panel('Paid order history', table(['Order', 'Products', 'Total', 'Payment'], orderRows(orders), 'No confirmed sales yet.'))}`;
  if (selectedView === 'earnings') return `${header('Sales and earnings', 'Track sales and withdraw available earnings.') }<div class="metric-grid">${metric('Verified gross sales', formatMoney(metrics.grossSales), 'Before commission and dispatch contribution')}${metric('Paid orders', metrics.orderCount)}${metric('Active products', metrics.productCount)}</div>${payoutPanel()}${panel('Paid order history', table(['Order', 'Products', 'Total', 'Payment'], orderRows(orders), 'No confirmed sales yet.'))}`;
  return `${header(`Welcome, ${user.name.split(' ')[0]}`, user.businessName || 'Vendors and Brands workspace', '<button class="primary-button" data-open-form="product">+ Add product</button>')}<div class="metric-grid">${metric('Active products', metrics.productCount)}${metric('Paid orders', metrics.orderCount)}${metric('Verified gross sales', formatMoney(metrics.grossSales), 'Before commission and dispatch contribution')}</div><div class="dashboard-grid">${panel('Recent orders', table(['Order', 'Products', 'Total', 'Payment'], orderRows(orders.slice(-5)), 'No paid orders yet.'))}${panel('Latest products', `<div class="compact-list">${products.slice(-4).reverse().map((product) => `<div class="compact-row"><img src="${escapeHtml(product.image)}" alt=""><span><strong>${escapeHtml(product.name)}</strong><small>${escapeHtml(product.category)}</small></span><b>${formatMoney(product.price)}</b></div>`).join('') || '<div class="empty-state">Your products will appear here.</div>'}</div>`)}</div>${moneyNote()}${payoutPanel()}${productForm()}`;
}
let productCategoryGroups = [];
function categoryOptions() {
  return productCategoryGroups.map((entry) => `<optgroup label="${escapeHtml(entry.group)}">${entry.items.map((item) => `<option value="${escapeHtml(item)}">${escapeHtml(item)}</option>`).join('')}</optgroup>`).join('');
}
function stockText(product) {
  if (product.stock === undefined || product.stock === null) return 'Stock not tracked';
  if (Array.isArray(product.sizes) && product.sizes.length) return `${product.stock} left · ${product.sizes.map((row) => `${escapeHtml(row.label)}: ${row.quantity}`).join(', ')}`;
  return product.stock > 0 ? `${product.stock} left` : 'Sold out';
}
function parseSizes(text) {
  const rows = String(text || '').split(',').map((part) => part.trim()).filter(Boolean);
  return rows.map((row) => {
    const [label, count] = row.split(/[:=]/).map((value) => value.trim());
    if (!label || !/^\d+$/.test(count || '')) throw new Error('Write sizes like S:5, M:3, L:2.');
    return { label, quantity: Number(count) };
  });
}
function productForm() { return '<div class="panel-gap">' + sellerForm() + '</div>'; }
function profileForm() {
  const user = dashboardData.user;
  const complete = businessProfileComplete(user);
  const image = user.profileImage ? `<img class="profile-image-preview" id="profile-image-preview" src="${escapeHtml(user.profileImage)}" alt="Profile photo preview">` : '<img class="profile-image-preview" id="profile-image-preview" alt="Profile photo preview" hidden>';
  return `${header(complete ? 'Your business profile' : 'Complete your profile', complete ? 'Keep the details customers see about your business up to date.' : 'Add a few details before publishing. Your profile helps customers know who they are buying from.', '')}
    <section class="panel profile-editor"><header class="panel-heading"><h3>${escapeHtml(user.businessName || user.name)} · ${escapeHtml(user.role)}</h3></header><div class="panel-body"><form class="form-grid" id="profile-form">
      <label class="form-field">Your full name<input name="name" required minlength="2" maxlength="100" value="${escapeHtml(user.name)}" autocomplete="name"></label>
      <label class="form-field">Business or brand name<input name="businessName" required minlength="2" maxlength="120" value="${escapeHtml(user.businessName || '')}" placeholder="The name customers will see"></label>
      <label class="form-field">Your position<input name="position" required minlength="2" maxlength="80" value="${escapeHtml(user.position || '')}" placeholder="e.g. Founder, Store manager, Lead stylist"></label>
      <label class="form-field">Place of operation<input name="placeOfOperation" required minlength="2" maxlength="120" value="${escapeHtml(user.placeOfOperation || '')}" placeholder="e.g. Ewet Housing, Uyo"></label>
      <label class="form-field full">About you and your business<textarea name="aboutMe" required minlength="20" maxlength="1000" rows="5" placeholder="Tell customers what you do, what makes your business special and the areas you serve.">${escapeHtml(user.aboutMe || '')}</textarea><span class="form-help">This introduction is shown on your public brand profile.</span></label>
      <label class="form-field full profile-photo-field">Profile or brand photo<input name="profileImage" type="file" accept="image/jpeg,image/png,image/webp" ${user.profileImage ? '' : 'required'}><span class="form-help">JPG, PNG or WebP · maximum 5 MB. This image appears with your public profile.</span>${image}</label>
      <div class="form-actions"><button class="primary-button" type="submit">${complete ? 'Save profile' : 'Save and continue'}</button></div>
    </form></div></section>${ninPanel(user)}`;
}
function ninPanel(user) {
  if (!user.ninRequired) return '';
  const status = user.ninLast4 ? (user.ninStatus || 'pending') : 'none';
  const labels = { none: 'Not submitted', pending: 'Pending review', verified: 'Verified', failed: 'Not verified' };
  const colors = { none: '#8a6d1a', pending: '#8a6d1a', verified: '#1a7a3c', failed: '#b3261e' };
  const note = status === 'verified' ? 'Your identity is confirmed. Thank you.' : (user.ninNote || 'Add your 11-digit NIN. We check it automatically against the national identity records and match it to the name on your account.');
  const form = status === 'verified' ? '' : `<form class="form-grid" id="nin-form"><label class="form-field">National Identification Number (NIN)<input name="nin" required inputmode="numeric" pattern="[0-9]{11}" minlength="11" maxlength="11" autocomplete="off" placeholder="${user.ninLast4 ? `On file: •••••••${escapeHtml(user.ninLast4)}` : '11-digit NIN'}"><span class="form-help">Stored encrypted. Only used to verify who you are.</span></label><div class="form-actions"><button class="primary-button" type="submit">${user.ninLast4 ? 'Check again' : 'Verify my NIN'}</button></div></form>`;
  return `<div class="panel-gap"><section class="panel" id="nin-panel"><header class="panel-heading"><h3>Identity verification (NIN)</h3><b style="color:${colors[status]}">${labels[status]}</b></header><div class="panel-body"><p class="earnings-note">${escapeHtml(note)}</p>${form}</div></section></div>`;
}
function businessProfileComplete(user) {
  return Boolean(user.name && user.businessName && user.position && user.placeOfOperation && user.aboutMe && user.profileImage && (!user.ninRequired || (user.ninLast4 && user.ninStatus !== 'failed')));
}
function dispatchDashboard() {
  const { jobs, metrics, user } = dashboardData;
  if (selectedView === 'profile') return profileForm();
  if (selectedView === 'earnings') return `${header('Delivery earnings', 'Only completed rider jobs appear in delivery earnings.') }<div class="metric-grid">${metric('Completed deliveries', metrics.completedJobs)}${metric('Tracked rider earnings', formatMoney(metrics.grossEarnings), 'No rider payout fee configured')}</div>${moneyNote()}`;
    if (selectedView === 'earnings') return `${header('Delivery earnings', 'Withdraw dispatch earnings after customer confirmation.') }<div class="metric-grid">${metric('Completed deliveries', metrics.completedJobs)}${metric('Tracked rider earnings', formatMoney(metrics.grossEarnings), 'Buyer and seller dispatch contributions')}</div>${payoutPanel()}`;
    return `${header(`Welcome, ${user.name.split(' ')[0]}`, user.businessName || 'Dispatch rider workspace') }<div class="metric-grid">${metric('Available deliveries', metrics.availableJobs)}${metric('Your active deliveries', metrics.activeJobs)}${metric('Completed deliveries', metrics.completedJobs)}${metric('Tracked rider earnings', formatMoney(metrics.grossEarnings), 'Buyer and seller dispatch contributions')}</div>${panel('Delivery queue', table(['Order', 'Delivery area', 'Status', 'Rider fee', 'Actions'], jobRows(jobs.slice(0, 6)), 'No paid delivery jobs are available right now.'))}${moneyNote()}${payoutPanel()}`;
  if (selectedView === 'listings') return `${header('Delivery area', 'Your service area is set during rider registration.')}${panel('Current rider profile', `<p>${escapeHtml(user.businessName || 'Area not set')}</p><div class="tab-notice">Paid orders become delivery jobs. Accept a job to reserve it, then update pickup and delivered status from Activity.</div>`)}`;
  if (selectedView === 'activity') return `${header('Delivery jobs', 'Accept paid customer orders and keep their delivery status up to date.')}${panel('Available and assigned jobs', table(['Order', 'Delivery area', 'Status', 'Rider fee', 'Actions'], jobRows(jobs), 'No paid delivery jobs are available right now.'))}`;
  return `${header(`Welcome, ${user.name.split(' ')[0]}`, user.businessName || 'Dispatch rider workspace') }<div class="metric-grid">${metric('Available deliveries', metrics.availableJobs)}${metric('Your active deliveries', metrics.activeJobs)}${metric('Completed deliveries', metrics.completedJobs)}${metric('Tracked rider earnings', formatMoney(metrics.grossEarnings), 'No payout fee configured')}</div>${panel('Delivery queue', table(['Order', 'Delivery area', 'Status', 'Rider fee', 'Actions'], jobRows(jobs.slice(0, 6)), 'No paid delivery jobs are available.'))}${moneyNote()}`;
}
function jobRows(jobs) {
  return jobs.map((job) => {
    const action = !job.dispatchRiderId ? `<button class="quiet-button" data-job-action="accept" data-reference="${escapeHtml(job.reference)}">Accept job</button>` : job.deliveryStatus === 'assigned' ? `<button class="quiet-button" data-job-action="picked-up" data-reference="${escapeHtml(job.reference)}">Mark picked up</button>` : job.deliveryStatus === 'picked-up' ? `<button class="primary-button" data-job-action="delivered" data-reference="${escapeHtml(job.reference)}">Mark delivered</button>` : '<span class="status-pill delivered">Delivered</span>';
    const deliveryDetails = job.dispatchRiderId ? `<br><small>${escapeHtml(job.address || '')}<br>${escapeHtml(job.customerName || '')} · ${escapeHtml(job.phone || '')}</small>` : '';
    return `<tr><td><strong>${escapeHtml(job.reference)}</strong><br>${job.items.map((item) => escapeHtml(item.name)).join(', ')}</td><td>${escapeHtml(job.neighbourhood)}${deliveryDetails}</td><td><span class="status-pill ${escapeHtml(job.deliveryStatus || 'pending')}">${escapeHtml(job.deliveryStatus || 'available')}</span></td><td>${formatMoney(job.dispatchFeeNaira || 0)}</td><td>${action}</td></tr>`;
    return `<tr><td><strong>${escapeHtml(job.reference)}</strong><br>${job.items.map((item) => escapeHtml(item.name)).join(', ')}</td><td>${escapeHtml(job.neighbourhood)}${deliveryDetails}</td><td><span class="status-pill ${escapeHtml(job.deliveryStatus || 'pending')}">${escapeHtml(job.deliveryStatus || 'available')}</span></td><td>${formatMoney(job.riderSettlementNaira || job.dispatchFeeNaira || 0)}</td><td>${action}</td></tr>`;
  });
}
function trackingPanel(orders) {
  const goods = orders.filter((order) => order.type !== 'service' && order.paymentStatus === 'paid' && order.tracking).slice().reverse();
  if (!goods.length) return panel('Track goods', '<div class="empty-state">Paid orders appear here with live tracking: collected from the seller, on dispatch, then at your doorstep.</div>');
  const cards = goods.map((order) => {
    const steps = order.tracking.steps.map((step) => `<li class="track-step${step.done ? ' done' : ''}"><span class="track-dot"></span><strong>${escapeHtml(step.label)}</strong><small>${step.done && step.at ? formatDate(step.at) : 'Pending'}</small></li>`).join('');
    let action = '';
    if (order.orderStatus === 'completed') action = '<p class="track-done">Received. Thank you for confirming.</p>';
    else if (order.tracking.status === 'delivered') action = `<form class="receive-form" data-receive="${escapeHtml(order.reference)}"><p><strong>Your order is at your doorstep.</strong> Confirm you have it and rate your purchase.</p><div class="rate-stars" role="radiogroup" aria-label="Rate your purchase">${[5, 4, 3, 2, 1].map((n) => `<input type="radio" name="rating" id="r-${escapeHtml(order.reference)}-${n}" value="${n}"${n === 5 ? ' checked' : ''}><label for="r-${escapeHtml(order.reference)}-${n}" title="${n} out of 5">★</label>`).join('')}</div><label class="form-field">Comment (optional)<textarea name="comment" maxlength="500"></textarea></label><button class="primary-button" type="submit">Received, okay</button></form>`;
    return `<article class="track-card"><header><strong>${escapeHtml(order.reference)}</strong><span>${order.items.map((item) => escapeHtml(item.name)).join(', ')}</span></header><ol class="track-steps">${steps}</ol>${action}</article>`;
  }).join('');
  return panel('Track goods', `<div class="track-list">${cards}</div>`);
}
function customerDashboard() {
  const bookings = dashboardData.bookings || [];
  const bookingRowsForCustomer = bookings.map((booking) => {
    let followup = `<span class="status-pill ${escapeHtml(booking.paymentStatus || 'unpaid')}">${escapeHtml(booking.paymentStatus || 'unpaid')}</span>`;
    if (booking.paymentStatus !== 'paid') followup = `<button class="primary-button" data-pay-service="${escapeHtml(booking.id)}">Pay ${formatMoney(booking.amountNaira)}</button>`;
    if (booking.status === 'completed' && !booking.reviewedAt) followup = `<button class="secondary-button" data-review-booking="${escapeHtml(booking.providerId)}">Rate service</button>`;
    return `<tr><td><strong>${escapeHtml(booking.provider || 'Service provider')}</strong></td><td>${escapeHtml(booking.service || 'Service')}</td><td>${escapeHtml(booking.time)}</td><td><span class="status-pill ${escapeHtml(booking.status)}">${escapeHtml(booking.status)}</span></td><td>${formatMoney(booking.amountNaira)}</td><td>${followup}</td></tr>`;
    const followups = [];
    if (booking.paymentStatus !== 'paid') followups.push(`<button class="primary-button" data-pay-service="${escapeHtml(booking.id)}">Pay ${formatMoney(booking.amountNaira + 500)}</button>`);
    if (booking.status === 'completed' && booking.settlementStatus !== 'available') followups.push(`<button class="primary-button" data-confirm-booking="${escapeHtml(booking.id)}">Confirm service complete</button>`);
    if (booking.status === 'completed' && !booking.reviewedAt) followups.push(`<button class="secondary-button" data-review-booking="${escapeHtml(booking.providerId)}">Rate service</button>`);
    if (!followups.length) followups.push(`<span class="status-pill ${escapeHtml(booking.settlementStatus === 'available' ? 'released' : booking.paymentStatus || 'unpaid')}">${escapeHtml(booking.settlementStatus === 'available' ? 'released' : booking.paymentStatus || 'unpaid')}</span>`);
    return `<tr><td><strong>${escapeHtml(booking.provider || 'Service provider')}</strong></td><td>${escapeHtml(booking.service || 'Service')}</td><td>${escapeHtml(booking.time)}</td><td><span class="status-pill ${escapeHtml(booking.status)}">${escapeHtml(booking.status)}</span></td><td>${formatMoney(booking.amountNaira)}</td><td><div class="row-actions">${followups.join('')}</div></td></tr>`;
  });
  const reviewForm = '<form id="review-form" class="review-form" hidden><h3>Rate your completed service</h3><input type="hidden" name="listingId"><label class="form-field">Rating<select name="rating" required><option value="5">5 stars</option><option value="4">4 stars</option><option value="3">3 stars</option><option value="2">2 stars</option><option value="1">1 star</option></select></label><label class="form-field">Comment<textarea name="comment" required minlength="2" maxlength="500"></textarea></label><button class="primary-button" type="submit">Submit review</button></form>';
  return `${header(`Welcome, ${dashboardData.user.name.split(' ')[0]}`, 'Your Unishop orders and service bookings.')}${trackingPanel(dashboardData.orders || [])}${panel('Your orders', table(['Order', 'Products', 'Total', 'Payment'], orderRows(dashboardData.orders || []), 'Your orders will appear here.'))}${panel('Your service bookings', table(['Provider', 'Service', 'Preferred time', 'Status', 'Price', 'Next step'], bookingRowsForCustomer, 'Your service bookings will appear here.'))}${reviewForm}`;
  const customerOrderRows = (dashboardData.orders || []).map((order) => {
    const confirmation = order.deliveryStatus === 'delivered' && order.settlementStatus !== 'available' ? `<button class="primary-button" data-confirm-delivery="${escapeHtml(order.reference)}">Confirm delivery</button>` : `<span class="status-pill ${escapeHtml(order.settlementStatus === 'available' ? 'released' : order.deliveryStatus || order.paymentStatus)}">${escapeHtml(order.settlementStatus === 'available' ? 'released' : order.deliveryStatus || order.paymentStatus)}</span>`;
    return `<tr><td><strong>${escapeHtml(order.reference)}</strong><br>${formatDate(order.createdAt)}</td><td>${order.items.map((item) => escapeHtml(item.name)).join(', ')}</td><td>${formatMoney(order.totalNaira)}</td><td><span class="status-pill ${escapeHtml(order.paymentStatus)}">${escapeHtml(order.paymentStatus)}</span><br>${confirmation}</td></tr>`;
  });
  return `${header(`Welcome, ${dashboardData.user.name.split(' ')[0]}`, 'Your Unishop orders and service bookings.')}${panel('Your orders', table(['Order', 'Products', 'Total', 'Payment and delivery'], customerOrderRows, 'Your orders will appear here.'))}${panel('Your service bookings', table(['Provider', 'Service', 'Preferred time', 'Status', 'Price', 'Next step'], bookingRowsForCustomer, 'Your service bookings will appear here.'))}${reviewForm}`;
}
function renderDashboard() {
  document.querySelector('#workspace-role').textContent = roleLabels[dashboardData.role] || 'Marketplace';
  document.querySelector('#profile-name').textContent = dashboardData.user.name;
  document.querySelector('#profile-initials').textContent = dashboardData.user.name.split(' ').map((part) => part[0]).slice(0, 2).join('').toUpperCase();
  document.querySelector('#profile-detail').textContent = dashboardData.user.businessName || dashboardData.user.niche || 'Uyo, Akwa Ibom';
  document.querySelector('#welcome-title').textContent = `${roleLabels[dashboardData.role]} workspace`;
  document.querySelector('#today-label').textContent = new Intl.DateTimeFormat('en-NG', { dateStyle: 'full' }).format(new Date());
  document.querySelector('#profile-nav-link').hidden = !['seller', 'provider', 'dispatch'].includes(dashboardData.role);
  const seller = dashboardData.role === 'seller';
  document.querySelector('#listing-nav-label').textContent = seller ? 'Products' : dashboardData.role === 'provider' ? 'Service portfolio' : dashboardData.role === 'dispatch' ? 'Delivery area' : dashboardData.role === 'admin' ? 'Marketplace' : 'Orders';
  document.querySelector('#activity-nav-label').textContent = dashboardData.role === 'provider' ? 'Bookings & reviews' : dashboardData.role === 'dispatch' ? 'Delivery jobs' : dashboardData.role === 'seller' ? 'Orders' : dashboardData.role === 'admin' ? 'Operations' : 'Bookings';
  document.querySelector('#earnings-nav-label').textContent = 'Earnings';
  workspace.innerHTML = dashboardData.role === 'provider'
      ? providerDashboard()
      : seller ? sellerDashboard() : dashboardData.role === 'dispatch' ? dispatchDashboard() : customerDashboard();
  populatePayoutBanks();
  loadNotifications();
  document.querySelectorAll('[data-view]').forEach((link) => link.classList.toggle('active', link.dataset.view === selectedView));
}
async function refreshDashboard() {
  try {
    if (!productCategoryGroups.length) productCategoryGroups = (await api('/api/product-categories').catch(() => ({ groups: [] }))).groups;
    dashboardData = await api('/api/dashboard');
    if (dashboardData.role === 'admin') return endSession();
    if (['seller', 'provider', 'dispatch'].includes(dashboardData.role) && !businessProfileComplete(dashboardData.user)) selectedView = 'profile';
  } catch (error) {
    if (error.sessionExpired || !token) return endSession();
    workspace.innerHTML = `<div class="empty-state">We could not load your account. ${escapeHtml(error.message)} <button class="secondary-button" onclick="window.location.reload()">Try again</button></div>`;
    return;
  }
  renderDashboard();
}
async function uploadFiles(files) {
  const body = new FormData();
  [...files].forEach((file) => body.append('images', file));
  return api('/api/uploads/portfolio', { method: 'POST', body });
}
async function uploadShortVideo(file) {
  if (!file) return undefined;
  const videoDuration = await new Promise((resolve, reject) => {
    const video = document.createElement('video');
    const source = URL.createObjectURL(file);
    const finish = (callback, value) => { URL.revokeObjectURL(source); callback(value); };
    video.preload = 'metadata';
    video.onloadedmetadata = () => {
      const duration = Number(video.duration);
      if (!Number.isFinite(duration) || duration <= 0) return finish(reject, new Error('Could not read this video duration. Try another MP4 or WebM video.'));
      if (duration > 30) return finish(reject, new Error('Videos must be 30 seconds or shorter.'));
      finish(resolve, duration);
    };
    video.onerror = () => finish(reject, new Error('Could not read this video. Try an MP4 or WebM file.'));
    video.src = source;
  });
  const body = new FormData();
  body.append('duration', String(videoDuration));
  body.append('video', file);
  return api('/api/uploads/short-video', { method: 'POST', body });
}

if (localStorage.getItem('unishop-theme') === 'dark') document.body.classList.add('dark');
document.querySelector('#theme-toggle').addEventListener('click', () => {
  document.body.classList.toggle('dark');
  localStorage.setItem('unishop-theme', document.body.classList.contains('dark') ? 'dark' : 'light');
});
document.querySelector('#signout-button').addEventListener('click', async () => {
  await fetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
  localStorage.removeItem('unishop-token');
  localStorage.removeItem('unishop-user');
  window.location.assign('/');
});
document.addEventListener('click', (event) => {
  const link = event.target.closest('[data-view]');
  if (!link) return;
  event.preventDefault();
  selectedView = link.dataset.view;
  renderDashboard();
});

document.addEventListener('submit', async (event) => {
  const form = event.target.closest('[data-receive]');
  if (!form) return;
  event.preventDefault();
  const button = form.querySelector('[type="submit"]');
  button.disabled = true;
  try {
    await api(`/api/orders/${encodeURIComponent(form.dataset.receive)}/confirm-delivery`, { method: 'POST', body: JSON.stringify({ rating: Number(form.elements.rating.value), comment: form.elements.comment.value }) });
    await refreshDashboard();
    notify('Thanks. The vendor can now withdraw this payment.');
  } catch (error) { notify(error.message); button.disabled = false; }
});

document.addEventListener('click', async (event) => {
  const restock = event.target.closest('[data-restock]');
  if (restock) {
    const input = window.prompt('New quantity available, or sizes like S:5, M:3, L:2');
    if (input === null) return;
    try {
      const body = input.includes(':') || input.includes('=') ? { sizes: parseSizes(input) } : { quantity: input.trim() };
      await api(`/api/seller/products/${restock.dataset.restock}/stock`, { method: 'PATCH', body: JSON.stringify(body) });
      await refreshDashboard();
      notify('Stock updated.');
    } catch (error) { notify(error.message); }
    return;
  }
  const openForm = event.target.closest('[data-open-form]');
  if (openForm) {
    const form = document.querySelector(openForm.dataset.openForm === 'service' ? '#service-editor' : '#product-editor');
    if (form) { form.hidden = false; form.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
  }
  if (event.target.closest('[data-close-form]')) document.querySelectorAll('.editor-panel').forEach((form) => { form.hidden = true; });
  const bookingAction = event.target.closest('[data-booking-action]');
  if (bookingAction) {
    try { await api(`/api/provider/bookings/${bookingAction.dataset.id}`, { method: 'PATCH', body: JSON.stringify({ status: bookingAction.dataset.bookingAction }) }); await refreshDashboard(); notify('Booking status updated.'); }
    catch (error) { notify(error.message); }
  }
  const confirmDelivery = event.target.closest('[data-confirm-delivery]');
  if (confirmDelivery) {
    try { await api(`/api/orders/${encodeURIComponent(confirmDelivery.dataset.confirmDelivery)}/confirm-delivery`, { method: 'POST' }); await refreshDashboard(); notify('Delivery confirmed. Earnings are now available to withdraw.'); }
    catch (error) { notify(error.message); }
  }
  const confirmBooking = event.target.closest('[data-confirm-booking]');
  if (confirmBooking) {
    try { await api(`/api/bookings/${encodeURIComponent(confirmBooking.dataset.confirmBooking)}/confirm-completion`, { method: 'POST' }); await refreshDashboard(); notify('Service confirmed. Provider earnings are now available to withdraw.'); }
    catch (error) { notify(error.message); }
  }
  if (event.target.closest('#enable-push')) enablePushNotifications();
  const retryPayout = event.target.closest('[data-retry-payout]');
  if (retryPayout) {
    try {
      const result = await api(`/api/payouts/${encodeURIComponent(retryPayout.dataset.retryPayout)}/retry`, { method: 'POST' });
      await refreshDashboard();
      notify(result.payout.status === 'success' ? 'Withdrawal sent.' : `Withdrawal status: ${result.payout.status}.`);
    } catch (error) { notify(error.message); }
  }
  const payService = event.target.closest('[data-pay-service]');
  if (payService) {
    payService.disabled = true;
    try {
      const payment = await api('/api/payments/initialize', { method: 'POST', body: JSON.stringify({ bookingId: payService.dataset.payService }) });
      window.location.assign(payment.authorizationUrl);
    } catch (error) { notify(error.message); payService.disabled = false; }
  }
  const reviewButton = event.target.closest('[data-review-booking]');
  if (reviewButton) {
    const form = document.querySelector('#review-form');
    form.elements.listingId.value = reviewButton.dataset.reviewBooking;
    form.hidden = false;
    form.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
  const jobAction = event.target.closest('[data-job-action]');
  if (jobAction) {
    try { await api(`/api/dispatch/jobs/${encodeURIComponent(jobAction.dataset.reference)}`, { method: 'PATCH', body: JSON.stringify({ status: jobAction.dataset.jobAction }) }); await refreshDashboard(); notify('Delivery status updated.'); }
    catch (error) { notify(error.message); }
  }
});

document.addEventListener('change', (event) => {
  if (event.target.matches('#product-form [name="images"]')) {
    const files = [...event.target.files];
    const preview = document.querySelector('#product-preview');
    if (files.length > 3) {
      event.target.value = '';
      preview.innerHTML = '';
      notify('Choose up to 3 photos per product.');
    } else {
      preview.innerHTML = files.map((image) => `<img alt="Selected product photo" src="${URL.createObjectURL(image)}">`).join('');
    }
  }
  if (event.target.matches('#service-form [name="images"]')) {
    const images = [...event.target.files].slice(0, 6);
    document.querySelector('#service-preview').innerHTML = images.map((image) => `<img alt="Selected work photo" src="${URL.createObjectURL(image)}">`).join('');
  }
  if (event.target.matches('#profile-form [name="profileImage"]') && event.target.files[0]) {
    const preview = document.querySelector('#profile-image-preview');
    preview.src = URL.createObjectURL(event.target.files[0]);
    preview.hidden = false;
  }
});

document.addEventListener('submit', async (event) => {
  if (event.target.id === 'profile-form') {
    event.preventDefault();
    const form = event.target;
    const button = form.querySelector('[type="submit"]');
    button.disabled = true;
    try {
      let profileImage = dashboardData.user.profileImage;
      if (form.elements.profileImage.files[0]) {
        const uploaded = await uploadFiles([form.elements.profileImage.files[0]]);
        profileImage = uploaded.images[0];
      }
      await api('/api/profile', {
        method: 'PATCH',
        body: JSON.stringify({
          name: form.elements.name.value,
          businessName: form.elements.businessName.value,
          position: form.elements.position.value,
          placeOfOperation: form.elements.placeOfOperation.value,
          aboutMe: form.elements.aboutMe.value,
          profileImage
        })
      });
      await refreshDashboard();
      notify('Your business profile is saved.');
    } catch (error) { notify(error.message); }
    finally { button.disabled = false; }
  }
  if (event.target.id === 'nin-form') {
    event.preventDefault();
    const form = event.target;
    const button = form.querySelector('[type="submit"]');
    button.disabled = true;
    try {
      const result = await api('/api/profile/nin', { method: 'POST', body: JSON.stringify({ nin: form.elements.nin.value.trim() }) });
      await refreshDashboard();
      notify(result.status === 'verified' ? 'NIN verified.' : result.note);
    } catch (error) { notify(error.message); }
    finally { button.disabled = false; }
  }
  if (event.target.id === 'payout-account-form') {
    event.preventDefault();
    const form = event.target;
    const button = form.querySelector('[type="submit"]');
    button.disabled = true;
    try {
      await api('/api/payout/account', { method: 'POST', body: JSON.stringify({ bankCode: form.elements.bankCode.value, accountNumber: form.elements.accountNumber.value }) });
      await refreshDashboard();
      notify('Your bank account was verified with Paystack.');
    } catch (error) { notify(error.message); }
    finally { button.disabled = false; }
  }
  if (event.target.id === 'payout-withdraw-form') {
    event.preventDefault();
    const form = event.target;
    const button = form.querySelector('[type="submit"]');
    button.disabled = true;
    try {
      const result = await api('/api/payouts/withdraw', { method: 'POST', body: JSON.stringify({ amountNaira: form.elements.amountNaira.value }) });
      await refreshDashboard();
      notify(result.payout.status === 'success' ? 'Withdrawal sent.' : `Withdrawal status: ${result.payout.status}.`);
    } catch (error) { notify(error.message); }
    finally { button.disabled = false; }
  }
  if (event.target.id === 'review-form') {
    event.preventDefault();
    const form = event.target;
    try {
      await api(`/api/services/${encodeURIComponent(form.elements.listingId.value)}/reviews`, { method: 'POST', body: JSON.stringify({ rating: form.elements.rating.value, comment: form.elements.comment.value }) });
      await refreshDashboard();
      notify('Thanks for reviewing your service.');
    } catch (error) { notify(error.message); }
  }
  if (event.target.id === 'service-form') {
    event.preventDefault();
    const form = event.target;
    const button = form.querySelector('[type="submit"]');
    button.disabled = true;
    try {
      const upload = await uploadFiles(form.elements.images.files);
      const uploadedVideo = await uploadShortVideo(form.elements.video.files[0]);
      await api('/api/provider/listings', { method: 'POST', body: JSON.stringify({ niche: form.elements.niche.value, title: form.elements.title.value, description: form.elements.description.value, price: form.elements.price.value, portfolio: upload.images, video: uploadedVideo?.video, videoDuration: uploadedVideo?.videoDuration }) });
      selectedView = 'listings';
      await refreshDashboard();
      notify('Your service and work photos are published.');
    } catch (error) { notify(error.message); }
    finally { button.disabled = false; }
  }
  if (event.target.id === 'product-form') {
    event.preventDefault();
    const form = event.target;
    const button = form.querySelector('[type="submit"]');
    button.disabled = true;
    try {
      const photos = [...form.elements.images.files];
      if (photos.length < 1 || photos.length > 3) throw new Error('Choose 1 to 3 product photos.');
      const uploaded = await uploadFiles(photos);
      const uploadedVideo = await uploadShortVideo(form.elements.video.files[0]);
      await api('/api/seller/products', { method: 'POST', body: JSON.stringify({ name: form.elements.name.value, category: form.elements.category.value, description: form.elements.description.value, price: form.elements.price.value, quantity: form.elements.quantity.value, sizes: parseSizes(form.elements.sizes.value), images: uploaded.images, video: uploadedVideo?.video, videoDuration: uploadedVideo?.videoDuration }) });
      selectedView = 'listings';
      await refreshDashboard();
      notify('Product published to your catalogue.');
    } catch (error) { notify(error.message); }
    finally { button.disabled = false; }
  }
});

if (!token) window.location.replace('/');
else refreshDashboard().catch(() => {
  localStorage.removeItem('unishop-token');
  localStorage.removeItem('unishop-user');
  window.location.replace('/');
});
if ('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
