const token = localStorage.getItem('unishop-token') || '';
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
async function api(url, options = {}) {
  const headers = { Authorization: `Bearer ${token}`, ...(options.headers || {}) };
  if (!(options.body instanceof FormData)) headers['Content-Type'] = 'application/json';
  const response = await fetch(url, { ...options, headers });
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
  return `${panel('Withdrawable balance', `<div class="payout-balance">${formatMoney(dashboardData.availableBalanceNaira || 0)}</div><p class="earnings-note">Commission: 5% below ₦10,000, 10% from ₦10,000 to ₦29,999, and 15% from ₦30,000. Rates apply to your subtotal before dispatch fees. Sellers contribute ₦500 per seller; service providers contribute ₦500. Product riders receive the buyer’s ₦500 plus seller contributions.</p>${bank}<form class="form-grid payout-form" id="payout-account-form"><label class="form-field">Bank<select name="bankCode" id="payout-bank" required><option value="">Loading banks…</option></select></label><label class="form-field">Account number<input name="accountNumber" inputmode="numeric" autocomplete="off" pattern="[0-9]{10}" minlength="10" maxlength="10" required></label><div class="form-actions"><button class="secondary-button" type="submit">${account ? 'Update bank account' : 'Verify bank account'}</button></div></form><form class="form-grid payout-form" id="payout-withdraw-form"><label class="form-field">Withdrawal amount (NGN)<input name="amountNaira" type="number" min="100" max="${Number(dashboardData.availableBalanceNaira || 0)}" step="1" required></label><div class="form-actions"><button class="primary-button" type="submit" ${!account || !(dashboardData.availableBalanceNaira > 0) ? 'disabled' : ''}>Withdraw</button></div></form>`, '')}${panel('Withdrawal history', table(['Reference', 'Amount', 'Status'], rows, 'No withdrawals yet.'))}`;
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
  if (selectedView === 'listings') return `${header('Your service portfolio', 'Only the 14 Unishop service niches can be listed.', '<button class="primary-button" data-open-form="service">+ Add service</button>')}${panel('Published services', serviceCards(listings))}${serviceForm()}`;
  if (selectedView === 'activity') return `${header('Booking requests', 'Accept work you can deliver around Uyo.')}${panel('Service bookings', table(['Customer request', 'Preferred time', 'Status', 'Quoted price', 'Actions'], bookingRows(bookings), 'No bookings yet. New customer requests will appear here.'))}${reviewsPanel(reviews)}`;
  if (selectedView === 'earnings') return `${header('Your earnings', 'Track booked value and verified payments.') }<div class="metric-grid">${metric('Paid service earnings', formatMoney(metrics.grossEarnings), 'Only paid bookings count')}${metric('Booking value', formatMoney(bookings.reduce((sum, item) => sum + (item.amountNaira || 0), 0)), 'Current listed-price requests')}${metric('Paid bookings', bookings.filter((item) => item.paymentStatus === 'paid').length, 'Verified by Paystack')}</div>${moneyNote()}${panel('Payment activity', table(['Service', 'Date', 'Status', 'Amount'], bookingRows(bookings).map((row) => row.replace(/<td><div class="row-actions">[\s\S]*?<\/div><\/td>/, '')), 'No service payments recorded yet.'))}`;
    if (selectedView === 'earnings') return `${header('Your earnings', 'Track completed work and withdraw available earnings.') }<div class="metric-grid">${metric('Paid service earnings', formatMoney(metrics.grossEarnings), 'Before commission and provider dispatch contribution')}${metric('Booking value', formatMoney(bookings.reduce((sum, item) => sum + (item.amountNaira || 0), 0)), 'Current listed-price requests')}${metric('Paid bookings', bookings.filter((item) => item.paymentStatus === 'paid').length, 'Verified by Paystack')}</div>${payoutPanel()}${panel('Payment activity', table(['Service', 'Date', 'Status', 'Amount'], bookingRows(bookings).map((row) => row.replace(/<td><div class="row-actions">[\s\S]*?<\/div><\/td>/, '')), 'No service payments recorded yet.'))}`;
  return `${header(`Welcome, ${user.name.split(' ')[0]}`, `Your niche: ${user.niche || 'Choose a service niche to get started.'}`, '<button class="primary-button" data-open-form="service">+ Add service</button>')}<div class="metric-grid">${metric('Published services', metrics.listingCount)}${metric('Booking requests', metrics.bookingCount)}${metric('Average rating', metrics.rating ? `${metrics.rating.toFixed(1)} / 5` : '—', `${reviews.length} customer reviews`)}${metric('Verified paid earnings', formatMoney(metrics.grossEarnings), 'Settlements are not enabled')}</div><div class="dashboard-grid">${panel('Recent bookings', table(['Request', 'Preferred time', 'Status', 'Price', 'Actions'], bookingRows(bookings.slice(-5)), 'No bookings yet. Add your work to be discovered.'))}${reviewsPanel(reviews.slice(-5))}</div><div class="panel-gap">${panel('Your work', serviceCards(listings.slice(0, 3)))}</div>${moneyNote()}${serviceForm()}`;
  return `${header(`Welcome, ${user.name.split(' ')[0]}`, `Your niche: ${user.niche || 'Choose a service niche to get started.'}`, '<button class="primary-button" data-open-form="service">+ Add service</button>')}<div class="metric-grid">${metric('Published services', metrics.listingCount)}${metric('Booking requests', metrics.bookingCount)}${metric('Average rating', metrics.rating ? `${metrics.rating.toFixed(1)} / 5` : '—', `${reviews.length} customer reviews`)}${metric('Verified paid earnings', formatMoney(metrics.grossEarnings), 'Before commission and provider dispatch contribution')}</div><div class="dashboard-grid">${panel('Recent bookings', table(['Request', 'Preferred time', 'Status', 'Price', 'Actions'], bookingRows(bookings.slice(-5)), 'No bookings yet. Add your work to be discovered.'))}${reviewsPanel(reviews.slice(-5))}</div><div class="panel-gap">${panel('Your work', serviceCards(listings.slice(0, 3)))}</div>${moneyNote()}${payoutPanel()}${serviceForm()}`;
}
function serviceForm() {
  const options = roleNiches.map((niche) => `<option value="${escapeHtml(niche)}" ${dashboardData.user.niche === niche ? 'selected' : ''}>${escapeHtml(niche)}</option>`).join('');
  return `<section class="panel editor-panel" id="service-editor" hidden><header class="panel-heading"><h3>Publish service and work photos</h3></header><div class="panel-body"><form class="form-grid" id="service-form"><label class="form-field">Choose your niche<select name="niche" required>${options}</select></label><label class="form-field">Starting price (NGN)<input name="price" type="number" required min="500" step="100" placeholder="12000"></label><label class="form-field full">Service title<input name="title" required minlength="3" maxlength="100" placeholder="e.g. Home hair styling and braids"></label><label class="form-field full">Description<textarea name="description" required minlength="10" maxlength="1500" placeholder="Describe the service, area covered and what customers can expect."></textarea></label><label class="form-field full">Photos of your work<input name="images" type="file" accept="image/jpeg,image/png,image/webp" multiple required><span class="form-help">Upload up to 6 JPG, PNG or WebP files, 5 MB each. Choose only your own work.</span></label><div class="upload-preview full" id="service-preview"></div><div class="form-actions"><button class="primary-button" type="submit">Publish service</button><button class="secondary-button" type="button" data-close-form>Cancel</button></div></form></div></section>`;
}
function sellerForm() {
  return `<section class="panel editor-panel" id="product-editor" hidden><header class="panel-heading"><h3>Add a product</h3></header><div class="panel-body"><form class="form-grid" id="product-form"><label class="form-field">Product name<input name="name" required minlength="3" maxlength="100"></label><label class="form-field">Category<select name="category" required><option>Home</option><option>Fashion</option><option>Beauty</option><option>Tech</option><option>Food</option></select></label><label class="form-field">Price in NGN<input name="price" type="number" required min="100" step="100"></label><label class="form-field">Product photo<input name="image" type="file" accept="image/jpeg,image/png,image/webp" required></label><label class="form-field full">Description<textarea name="description" required minlength="5" maxlength="1000"></textarea></label><label class="form-field full">Product video <span class="form-help">Optional · MP4 or WebM · up to 40 MB. Buyers can play it on the product page.</span><input name="video" type="file" accept="video/mp4,video/webm"></label><div class="form-actions"><button class="primary-button" type="submit">Publish product</button><button class="secondary-button" type="button" data-close-form>Cancel</button></div></form></div></section>`;
}
function sellerDashboard() {
  const { products, orders, metrics, user } = dashboardData;
  if (selectedView === 'listings') return `${header('Your product catalogue', 'Manage the products customers can order.', '<button class="primary-button" data-open-form="product">+ Add product</button>')}${panel('Published products', `<div class="portfolio-grid">${products.length ? products.map((product) => `<article class="work-card"><img src="${escapeHtml(product.image)}" alt="${escapeHtml(product.name)}"><div class="work-card-body"><h3>${escapeHtml(product.name)}</h3><p>${formatMoney(product.price)} · ${escapeHtml(product.category)}</p></div></article>`).join('') : '<div class="empty-state">Add your first product to start your catalogue.</div>'}</div>`)}${productForm()}`;
  if (selectedView === 'activity') return `${header('Customer orders', 'Only confirmed Paystack payments appear as paid orders.')}${panel('Orders containing your products', table(['Order', 'Products', 'Total', 'Payment'], orderRows(orders), 'No paid orders yet.'))}`;
  if (selectedView === 'earnings') return `${header('Sales and earnings', 'Track paid product sales for your shop.') }<div class="metric-grid">${metric('Verified gross sales', formatMoney(metrics.grossSales), 'Before fees and refunds')}${metric('Paid orders', metrics.orderCount)}${metric('Active products', metrics.productCount)}</div>${moneyNote()}${panel('Paid order history', table(['Order', 'Products', 'Total', 'Payment'], orderRows(orders), 'No confirmed sales yet.'))}`;
  if (selectedView === 'earnings') return `${header('Sales and earnings', 'Track sales and withdraw available earnings.') }<div class="metric-grid">${metric('Verified gross sales', formatMoney(metrics.grossSales), 'Before commission and dispatch contribution')}${metric('Paid orders', metrics.orderCount)}${metric('Active products', metrics.productCount)}</div>${payoutPanel()}${panel('Paid order history', table(['Order', 'Products', 'Total', 'Payment'], orderRows(orders), 'No confirmed sales yet.'))}`;
  return `${header(`Welcome, ${user.name.split(' ')[0]}`, user.businessName || 'Seller workspace', '<button class="primary-button" data-open-form="product">+ Add product</button>')}<div class="metric-grid">${metric('Active products', metrics.productCount)}${metric('Paid orders', metrics.orderCount)}${metric('Verified gross sales', formatMoney(metrics.grossSales), 'Before commission and dispatch contribution')}</div><div class="dashboard-grid">${panel('Recent orders', table(['Order', 'Products', 'Total', 'Payment'], orderRows(orders.slice(-5)), 'No paid orders yet.'))}${panel('Latest products', `<div class="compact-list">${products.slice(-4).reverse().map((product) => `<div class="compact-row"><img src="${escapeHtml(product.image)}" alt=""><span><strong>${escapeHtml(product.name)}</strong><small>${escapeHtml(product.category)}</small></span><b>${formatMoney(product.price)}</b></div>`).join('') || '<div class="empty-state">Your products will appear here.</div>'}</div>`)}</div>${moneyNote()}${payoutPanel()}${productForm()}`;
}
function productForm() { return '<div class="panel-gap">' + sellerForm() + '</div>'; }
function adminDashboard() {
  const { metrics, users, orders, bookings, breakdown = {} } = dashboardData;
  const userRows = (users || []).slice(0, 5).map((user) => `<div class="admin-list-row"><div><strong>${escapeHtml(user.name)}</strong><small>${escapeHtml(user.role)} · ${escapeHtml(user.email)}</small></div><span class="status-pill ${escapeHtml(user.role)}">${escapeHtml(user.role)}</span></div>`).join('') || '<div class="empty-state">No users recorded yet.</div>';
  const orderRows = (orders || []).slice(0, 4).map((order) => `<div class="admin-list-row"><div><strong>${escapeHtml(order.reference)}</strong><small>${formatDate(order.createdAt)}</small></div><div class="admin-mini-meta"><b>${formatMoney(order.totalNaira)}</b><span class="status-pill ${escapeHtml(order.paymentStatus)}">${escapeHtml(order.paymentStatus)}</span></div></div>`).join('') || '<div class="empty-state">No marketplace orders yet.</div>';
  const bookingRows = (bookings || []).slice(0, 4).map((booking) => `<div class="admin-list-row"><div><strong>${escapeHtml(booking.provider || booking.service || 'Service')}</strong><small>${escapeHtml(booking.userId || 'Customer')}</small></div><div class="admin-mini-meta"><b>${formatMoney(booking.amountNaira || 0)}</b><span class="status-pill ${escapeHtml(booking.status)}">${escapeHtml(booking.status)}</span></div></div>`).join('') || '<div class="empty-state">No bookings yet.</div>';
  const roleBreakdown = Object.entries(breakdown.roles || {}).map(([role, count]) => `
    <div class="compact-row"><span><strong>${escapeHtml(role)}</strong><small>Registered accounts</small></span><b>${count}</b></div>`).join('') || '<div class="empty-state">No role activity yet.</div>';
  const orderBreakdown = Object.entries(breakdown.orders || {}).map(([status, count]) => `
    <div class="compact-row"><span><strong>${escapeHtml(status)}</strong><small>Orders in this state</small></span><b>${count}</b></div>`).join('') || '<div class="empty-state">No order activity yet.</div>';
  const bookingBreakdown = Object.entries(breakdown.bookings || {}).map(([status, count]) => `
    <div class="compact-row"><span><strong>${escapeHtml(status)}</strong><small>Bookings in this state</small></span><b>${count}</b></div>`).join('') || '<div class="empty-state">No booking activity yet.</div>';
  const catalogBreakdown = Object.entries(breakdown.catalog || {}).map(([key, count]) => `
    <div class="compact-row"><span><strong>${escapeHtml(key)}</strong><small>Live marketplace items</small></span><b>${count}</b></div>`).join('') || '<div class="empty-state">No catalog data yet.</div>';
  return `${header('Marketplace admin', 'Platform overview, user activity, and order health.', '<button class="primary-button" type="button">Admin mode</button>')}
    <section class="admin-hero">
      <div>
        <span class="eyebrow">ADMIN OVERVIEW</span>
        <h3>Everything that matters is working from one place.</h3>
      </div>
      <div class="admin-quick-actions">
        <button class="secondary-button" type="button">Users</button>
        <button class="secondary-button" type="button">Orders</button>
        <button class="primary-button" type="button">Payouts</button>
      </div>
    </section>
    <div class="metric-grid admin-metric-grid">
      ${metric('Total users', metrics.totalUsers)}
      ${metric('Orders', metrics.totalOrders)}
      ${metric('Bookings', metrics.totalBookings)}
      ${metric('Revenue', formatMoney(metrics.totalRevenue), 'Paid marketplace orders')}
      ${metric('Paid orders', metrics.paidOrders)}
      ${metric('Pending payments', metrics.pendingPayments)}
    </div>
    <div class="dashboard-grid admin-grid">
      <section class="panel admin-panel">
        <header class="panel-heading"><h3>Recent users</h3></header>
        <div class="panel-body admin-list">${userRows}</div>
      </section>
      <section class="panel admin-panel">
        <header class="panel-heading"><h3>Recent orders</h3></header>
        <div class="panel-body admin-list">${orderRows}</div>
      </section>
    </div>
    <div class="dashboard-grid admin-grid">
      <section class="panel admin-panel">
        <header class="panel-heading"><h3>Recent bookings</h3></header>
        <div class="panel-body admin-list">${bookingRows}</div>
      </section>
      <section class="panel admin-panel">
        <header class="panel-heading"><h3>Platform health</h3></header>
        <div class="panel-body admin-health">
          <div class="compact-row"><span><strong>Marketplace listings</strong><small>Products plus service listings</small></span><b>${metrics.totalListings}</b></div>
          <div class="compact-row"><span><strong>Platform payouts</strong><small>Recent payout records</small></span><b>${metrics.availablePayouts}</b></div>
          <div class="compact-row"><span><strong>Active checkouts</strong><small>Orders awaiting payment confirmation</small></span><b>${metrics.pendingPayments}</b></div>
        </div>
      </section>
    </div>
    <div class="dashboard-grid admin-grid">
      <section class="panel admin-panel">
        <header class="panel-heading"><h3>Account breakdown</h3></header>
        <div class="panel-body admin-health">${roleBreakdown}</div>
      </section>
      <section class="panel admin-panel">
        <header class="panel-heading"><h3>Order status</h3></header>
        <div class="panel-body admin-health">${orderBreakdown}</div>
      </section>
    </div>
    <div class="dashboard-grid admin-grid">
      <section class="panel admin-panel">
        <header class="panel-heading"><h3>Booking status</h3></header>
        <div class="panel-body admin-health">${bookingBreakdown}</div>
      </section>
      <section class="panel admin-panel">
        <header class="panel-heading"><h3>Catalog activity</h3></header>
        <div class="panel-body admin-health">${catalogBreakdown}</div>
      </section>
    </div>`;
}
function dispatchDashboard() {
  const { jobs, metrics, user } = dashboardData;
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
  return `${header(`Welcome, ${dashboardData.user.name.split(' ')[0]}`, 'Your Unishop orders and service bookings.')}${panel('Your orders', table(['Order', 'Products', 'Total', 'Payment'], orderRows(dashboardData.orders || []), 'Your orders will appear here.'))}${panel('Your service bookings', table(['Provider', 'Service', 'Preferred time', 'Status', 'Price', 'Next step'], bookingRowsForCustomer, 'Your service bookings will appear here.'))}${reviewForm}`;
  const customerOrderRows = (dashboardData.orders || []).map((order) => {
    const confirmation = order.deliveryStatus === 'delivered' && order.settlementStatus !== 'available' ? `<button class="primary-button" data-confirm-delivery="${escapeHtml(order.reference)}">Confirm delivery</button>` : `<span class="status-pill ${escapeHtml(order.settlementStatus === 'available' ? 'released' : order.deliveryStatus || order.paymentStatus)}">${escapeHtml(order.settlementStatus === 'available' ? 'released' : order.deliveryStatus || order.paymentStatus)}</span>`;
    return `<tr><td><strong>${escapeHtml(order.reference)}</strong><br>${formatDate(order.createdAt)}</td><td>${order.items.map((item) => escapeHtml(item.name)).join(', ')}</td><td>${formatMoney(order.totalNaira)}</td><td><span class="status-pill ${escapeHtml(order.paymentStatus)}">${escapeHtml(order.paymentStatus)}</span><br>${confirmation}</td></tr>`;
  });
  return `${header(`Welcome, ${dashboardData.user.name.split(' ')[0]}`, 'Your Unishop orders and service bookings.')}${panel('Your orders', table(['Order', 'Products', 'Total', 'Payment and delivery'], customerOrderRows, 'Your orders will appear here.'))}${panel('Your service bookings', table(['Provider', 'Service', 'Preferred time', 'Status', 'Price', 'Next step'], bookingRowsForCustomer, 'Your service bookings will appear here.'))}${reviewForm}`;
}
function previewDashboardData() {
  return {
    role: 'admin',
    user: { name: 'Ada Okon', email: 'ada@unishop.ng', role: 'admin', businessName: 'Marketplace admin', niche: 'Operations' },
    metrics: {
      totalUsers: 268,
      totalOrders: 84,
      totalBookings: 36,
      totalRevenue: 4125000,
      paidOrders: 59,
      pendingPayments: 12,
      totalListings: 182,
      availablePayouts: 26
    },
    breakdown: {
      roles: { customer: 136, seller: 42, provider: 31, dispatch: 20, admin: 3 },
      orders: { paid: 59, pending: 12, processing: 8, failed: 5 },
      bookings: { confirmed: 18, requested: 9, completed: 7, pending: 2 },
      catalog: { products: 28, services: 54, reviews: 82, payouts: 18 }
    },
    users: [
      { name: 'Ada Okon', role: 'admin', email: 'ada@unishop.ng' },
      { name: 'Mfon Bassey', role: 'seller', email: 'mfon@unishop.ng' },
      { name: 'Daniel Enang', role: 'provider', email: 'daniel@unishop.ng' },
      { name: 'Udo Effiong', role: 'dispatch', email: 'udo@unishop.ng' },
      { name: 'Sarah Akpan', role: 'customer', email: 'sarah@unishop.ng' }
    ],
    orders: [
      { reference: 'UYO-2048', totalNaira: 28600, paymentStatus: 'paid', createdAt: '2026-10-01T09:00:00.000Z' },
      { reference: 'UYO-2041', totalNaira: 14900, paymentStatus: 'pending', createdAt: '2026-10-02T12:30:00.000Z' },
      { reference: 'UYO-2038', totalNaira: 38250, paymentStatus: 'paid', createdAt: '2026-10-03T07:10:00.000Z' },
      { reference: 'UYO-2029', totalNaira: 21600, paymentStatus: 'processing', createdAt: '2026-10-04T08:40:00.000Z' }
    ],
    bookings: [
      { provider: 'Nneoma Hair Studio', service: 'Hair styling', userId: 'Sarah Akpan', status: 'confirmed', amountNaira: 15000 },
      { provider: 'CleanEase Uyo', service: 'Cleaning', userId: 'Grace Udo', status: 'pending', amountNaira: 12000 },
      { provider: 'Aqua Fix', service: 'Plumbing', userId: 'Victor Etim', status: 'completed', amountNaira: 23500 }
    ]
  };
}
function renderDashboard() {
  document.querySelector('#workspace-role').textContent = roleLabels[dashboardData.role] || 'Marketplace';
  document.querySelector('#profile-name').textContent = dashboardData.user.name;
  document.querySelector('#profile-initials').textContent = dashboardData.user.name.split(' ').map((part) => part[0]).slice(0, 2).join('').toUpperCase();
  document.querySelector('#profile-detail').textContent = dashboardData.user.businessName || dashboardData.user.niche || 'Uyo, Akwa Ibom';
  document.querySelector('#welcome-title').textContent = `${roleLabels[dashboardData.role]} workspace`;
  document.querySelector('#today-label').textContent = new Intl.DateTimeFormat('en-NG', { dateStyle: 'full' }).format(new Date());
  const seller = dashboardData.role === 'seller';
  document.querySelector('#listing-nav-label').textContent = seller ? 'Products' : dashboardData.role === 'provider' ? 'Service portfolio' : dashboardData.role === 'dispatch' ? 'Delivery area' : dashboardData.role === 'admin' ? 'Marketplace' : 'Orders';
  document.querySelector('#activity-nav-label').textContent = dashboardData.role === 'provider' ? 'Bookings & reviews' : dashboardData.role === 'dispatch' ? 'Delivery jobs' : dashboardData.role === 'seller' ? 'Orders' : dashboardData.role === 'admin' ? 'Operations' : 'Bookings';
  workspace.innerHTML = dashboardData.role === 'admin'
    ? adminDashboard()
    : dashboardData.role === 'provider'
      ? providerDashboard()
      : seller ? sellerDashboard() : dashboardData.role === 'dispatch' ? dispatchDashboard() : customerDashboard();
  populatePayoutBanks();
  document.querySelectorAll('[data-view]').forEach((link) => link.classList.toggle('active', link.dataset.view === selectedView));
}
async function refreshDashboard() {
  try {
    dashboardData = await api('/api/dashboard');
  } catch (error) {
    dashboardData = previewDashboardData();
    const toast = document.querySelector('#workspace-toast');
    if (toast) {
      toast.textContent = 'Preview mode: showing a live admin layout demo.';
      toast.classList.add('visible');
      clearTimeout(toastTimer);
      toastTimer = setTimeout(() => toast.classList.remove('visible'), 3200);
    }
  }
  renderDashboard();
}
async function uploadFiles(files) {
  const body = new FormData();
  [...files].forEach((file) => body.append('images', file));
  return api('/api/uploads/portfolio', { method: 'POST', body });
}
async function uploadProductVideo(file) {
  if (!file) return undefined;
  const body = new FormData();
  body.append('video', file);
  return api('/api/uploads/product-video', { method: 'POST', body });
}

if (localStorage.getItem('unishop-theme') === 'dark') document.body.classList.add('dark');
document.querySelector('#theme-toggle').addEventListener('click', () => {
  document.body.classList.toggle('dark');
  localStorage.setItem('unishop-theme', document.body.classList.contains('dark') ? 'dark' : 'light');
});
document.querySelector('#signout-button').addEventListener('click', () => {
  localStorage.removeItem('unishop-token');
  localStorage.removeItem('unishop-user');
  window.location.assign('/');
});
document.querySelectorAll('[data-view]').forEach((link) => link.addEventListener('click', (event) => {
  event.preventDefault();
  selectedView = link.dataset.view;
  renderDashboard();
}));

document.addEventListener('click', async (event) => {
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
  if (event.target.matches('#service-form [name="images"]')) {
    const images = [...event.target.files].slice(0, 6);
    document.querySelector('#service-preview').innerHTML = images.map((image) => `<img alt="Selected work photo" src="${URL.createObjectURL(image)}">`).join('');
  }
});

document.addEventListener('submit', async (event) => {
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
      await api('/api/provider/listings', { method: 'POST', body: JSON.stringify({ niche: form.elements.niche.value, title: form.elements.title.value, description: form.elements.description.value, price: form.elements.price.value, portfolio: upload.images }) });
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
      const uploaded = await uploadFiles([form.elements.image.files[0]]);
      const uploadedVideo = await uploadProductVideo(form.elements.video.files[0]);
      await api('/api/seller/products', { method: 'POST', body: JSON.stringify({ name: form.elements.name.value, category: form.elements.category.value, description: form.elements.description.value, price: form.elements.price.value, image: uploaded.images[0], video: uploadedVideo?.video }) });
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
