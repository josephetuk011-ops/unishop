const tokenKey = 'unishop-admin-token';
const pageSize = 50;
const labels = { overview: 'Marketplace overview', users: 'Accounts', orders: 'Orders', bookings: 'Bookings', listings: 'Listings', payouts: 'Payouts', audit: 'Admin activity' };
const descriptions = {
  users: 'Review customer, seller, service provider and dispatch accounts. Suspensions delist sellers/providers and block their access.',
  orders: 'Marketplace order ledger, including customer, items, payment and delivery details.',
  bookings: 'Service requests, payment progress, provider and customer details.',
  listings: 'All product and service listings with current account availability.',
  payouts: 'Marketplace payout records and account ownership. Bank credentials are not exposed.',
  audit: 'Sign-ins and administrator actions recorded by the marketplace.'
};
let currentView = 'overview';
let currentOffset = 0;
let currentSearch = '';
let currentRecords = [];
let currentTotal = 0;
let dashboardData;
let toastTimer;
let searchTimer;

const escapeHtml = (value = '') => String(value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
const formatMoney = (value = 0) => `₦${Number(value || 0).toLocaleString('en-NG')}`;
const formatDate = (value) => value ? new Intl.DateTimeFormat('en-NG', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : '—';
const token = () => sessionStorage.getItem(tokenKey) || '';

async function api(url, options = {}) {
  const headers = { ...(options.headers || {}) };
  if (token()) headers.Authorization = `Bearer ${token()}`;
  if (options.body && !(options.body instanceof FormData)) headers['Content-Type'] = 'application/json';
  const response = await fetch(url, { ...options, headers, cache: 'no-store' });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401 && token()) signOut();
    throw new Error(result.error || 'The request could not be completed.');
  }
  return result;
}

function notify(message) {
  const toast = document.querySelector('#toast');
  toast.textContent = message;
  toast.classList.add('visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('visible'), 3500);
}

function showLogin(error = '') {
  document.querySelector('#login-view').hidden = false;
  document.querySelector('#app-view').hidden = true;
  const message = document.querySelector('#login-error');
  message.textContent = error;
  message.hidden = !error;
  if (error) document.querySelector('#admin-password').focus();
}

function showApp() {
  document.querySelector('#login-view').hidden = true;
  document.querySelector('#app-view').hidden = false;
}

function signOut() {
  sessionStorage.removeItem(tokenKey);
  showLogin();
}

function metric(label, value, detail, tone = '') {
  return `<article class="metric ${tone}"><span class="metric-label">${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong><small>${escapeHtml(detail)}</small></article>`;
}

function statusBars(statuses = {}) {
  const entries = Object.entries(statuses);
  const total = entries.reduce((sum, [, count]) => sum + Number(count || 0), 0);
  if (!entries.length) return '<div class="empty-state">No activity recorded yet.</div>';
  return `<div class="bar-list">${entries.map(([name, count]) => `<div class="bar-row"><div class="bar-row-head"><span>${escapeHtml(name.replace(/-/g, ' '))}</span><strong>${Number(count).toLocaleString()}</strong></div><progress class="bar-progress" max="100" value="${Math.max(3, (Number(count) / Math.max(total, 1)) * 100)}" aria-label="${escapeHtml(name)}: ${Number(count)}"></progress></div>`).join('')}</div>`;
}

function previewRows(records, kind) {
  if (!records.length) return '<div class="empty-state">No records yet.</div>';
  return `<div class="preview-list">${records.slice(0, 5).map((record) => {
    const title = kind === 'users' ? record.name : kind === 'orders' ? record.reference : record.service || record.providerName || 'Service booking';
    const detail = kind === 'users' ? `${record.email} · ${record.role}` : kind === 'orders' ? `${record.customerName} · ${formatDate(record.createdAt)}` : `${record.providerName} · ${record.status || 'requested'}`;
    const meta = kind === 'orders' ? formatMoney(record.totalNaira) : kind === 'bookings' ? (record.status || 'requested') : record.suspendedAt ? 'Suspended' : 'Active';
    return `<div class="preview-row"><div class="preview-primary"><strong>${escapeHtml(title)}</strong><small>${escapeHtml(detail)}</small></div><span class="preview-meta">${escapeHtml(meta)}</span></div>`;
  }).join('')}</div>`;
}

async function loadOverview() {
  const [summary, users, orders, bookings] = await Promise.all([
    api('/api/admin/dashboard'),
    api('/api/admin/records?kind=users&limit=5'),
    api('/api/admin/records?kind=orders&limit=5'),
    api('/api/admin/records?kind=bookings&limit=5')
  ]);
  dashboardData = summary;
  const { metrics, breakdown } = summary;
  document.querySelector('#suspended-count').textContent = metrics.suspendedUsers;
  document.querySelector('#last-updated').textContent = `Updated ${new Date().toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit' })}`;
  document.querySelector('#main-content').innerHTML = `
    <section class="hero-strip"><div><p class="eyebrow">MARKETPLACE CONTROL ROOM</p><h2>Good morning, Admin.</h2><p>${metrics.pendingPayments ? `${metrics.pendingPayments} payment${metrics.pendingPayments === 1 ? '' : 's'} pending confirmation` : 'Payments and marketplace records are up to date'} · ${metrics.activeListings} live listings</p></div><span class="live-tag"><i></i> LIVE DATA</span></section>
    <div class="metrics-grid">${metric('Marketplace accounts', metrics.totalUsers, `${metrics.suspendedUsers} suspended`)}${metric('Paid order volume', formatMoney(metrics.totalRevenue), `${metrics.paidOrders} of ${metrics.totalOrders} orders paid`)}${metric('Service bookings', metrics.totalBookings, 'All recorded states')}${metric('Live listings', metrics.activeListings, `${metrics.totalListings} total catalog records`)}</div>
    <div class="two-column"><section class="panel"><header class="panel-heading"><h3>Payment status</h3><button data-view="orders">Open order ledger ↗</button></header><div class="panel-content">${statusBars(breakdown.orders)}</div></section><section class="panel"><header class="panel-heading"><h3>Marketplace accounts</h3><button data-view="users">Review accounts ↗</button></header><div class="panel-content">${statusBars(breakdown.roles)}</div></section></div>
    <div class="two-column"><section class="panel"><header class="panel-heading"><h3>Recent orders</h3><button data-view="orders">All orders ↗</button></header><div class="panel-content">${previewRows(orders.records, 'orders')}</div></section><section class="panel"><header class="panel-heading"><h3>Recent service bookings</h3><button data-view="bookings">All bookings ↗</button></header><div class="panel-content">${previewRows(bookings.records, 'bookings')}</div></section></div>
    <div class="two-column"><section class="panel"><header class="panel-heading"><h3>New accounts</h3><button data-view="users">Account directory ↗</button></header><div class="panel-content">${previewRows(users.records, 'users')}</div></section><section class="panel"><header class="panel-heading"><h3>Platform activity</h3><button data-view="audit">Open audit log ↗</button></header><div class="panel-content"><div class="preview-row"><div class="preview-primary"><strong>${Number(metrics.auditEntries).toLocaleString()} recorded events</strong><small>Admin sign-ins, moderation and marketplace security events</small></div><span class="preview-meta">${Number(metrics.totalPayouts).toLocaleString()} payouts</span></div><div class="preview-row"><div class="preview-primary"><strong>${Number(metrics.totalListings).toLocaleString()} catalog records</strong><small>${Number(breakdown.catalog.products || 0)} products · ${Number(breakdown.catalog.services || 0)} services</small></div><span class="preview-meta">${metrics.pendingPayments} pending payments</span></div></div></section></div>`;
}

function cell(value, detail = '') {
  return `<strong>${escapeHtml(value || '—')}</strong>${detail ? `<small>${escapeHtml(detail)}</small>` : ''}`;
}

function status(value) {
  const label = String(value || 'unknown');
  return `<span class="status ${escapeHtml(label.toLowerCase().replace(/[^a-z0-9-]/g, '-'))}">${escapeHtml(label.replace(/-/g, ' '))}</span>`;
}

function recordCells(record) {
  if (currentView === 'users') {
    const accountStatus = record.suspendedAt ? status('suspended') : status('active');
    const action = ['seller', 'provider'].includes(record.role)
      ? `<button class="table-action ${record.suspendedAt ? 'restore' : ''}" data-moderate-user="${escapeHtml(record.id)}" data-suspended="${Boolean(record.suspendedAt)}">${record.suspendedAt ? 'Restore' : 'Suspend'}</button>`
      : '—';
    return `<td>${cell(record.name, record.businessName || record.niche || '')}</td><td>${cell(record.email, record.username)}</td><td>${status(record.role)}</td><td>${accountStatus}${record.suspensionReason ? `<small>${escapeHtml(record.suspensionReason)}</small>` : ''}</td><td>${escapeHtml(formatDate(record.createdAt))}</td><td>${action}</td>`;
  }
  if (currentView === 'orders') {
    const itemNames = (record.items || []).map((item) => `${item.name} ×${item.quantity}`).join(', ');
    return `<td>${cell(record.reference, formatDate(record.createdAt))}</td><td>${cell(record.customerName, record.customerEmail)}<small>${escapeHtml(record.customerPhone)} · ${escapeHtml(record.deliveryAddress)}</small></td><td class="row-detail">${escapeHtml(itemNames || '—')}</td><td>${escapeHtml(formatMoney(record.totalNaira))}</td><td>${status(record.paymentStatus)}</td><td>${status(record.deliveryStatus || record.orderStatus)}</td>`;
  }
  if (currentView === 'bookings') {
    return `<td>${cell(record.service, record.providerName)}</td><td>${cell(record.customerName, record.customerEmail)}</td><td>${cell(record.time, record.neighbourhood)}</td><td>${escapeHtml(record.amountNaira ? formatMoney(record.amountNaira) : 'Quote pending')}</td><td>${status(record.status)}</td><td>${status(record.paymentStatus)}</td>`;
  }
  if (currentView === 'listings') {
    const name = record.name || record.title;
    return `<td>${status(record.listingType)}</td><td>${cell(name, record.category || record.niche)}</td><td>${cell(record.ownerName, record.ownerRole)}</td><td>${escapeHtml(formatMoney(record.price))}</td><td>${record.isSuspended ? status('suspended') : status('active')}</td><td>${escapeHtml(formatDate(record.createdAt))}</td>`;
  }
  if (currentView === 'payouts') {
    return `<td>${cell(record.reference, formatDate(record.createdAt))}</td><td>${cell(record.ownerName, record.ownerEmail)}</td><td>${status(record.ownerRole)}</td><td>${escapeHtml(formatMoney(record.amountNaira))}</td><td>${status(record.status)}</td>`;
  }
  return `<td>${cell(record.action, `${formatDate(record.createdAt)} · ${record.actorId || 'system'}`)}</td><td class="activity-details">${escapeHtml(JSON.stringify(record.details || {}))}</td>`;
}

function headersForView() {
  if (currentView === 'users') return ['Account', 'Email and username', 'Role', 'Access', 'Joined', 'Action'];
  if (currentView === 'orders') return ['Order', 'Customer and delivery', 'Items', 'Total', 'Payment', 'Delivery'];
  if (currentView === 'bookings') return ['Service', 'Customer', 'Requested time', 'Price', 'Booking', 'Payment'];
  if (currentView === 'listings') return ['Type', 'Listing', 'Account owner', 'Price', 'Visibility', 'Created'];
  if (currentView === 'payouts') return ['Transfer', 'Account owner', 'Role', 'Amount', 'Status'];
  return ['Admin event', 'Details'];
}

async function loadRecords() {
  const params = new URLSearchParams({ kind: currentView, limit: String(pageSize), offset: String(currentOffset) });
  if (currentSearch) params.set('search', currentSearch);
  const result = await api(`/api/admin/records?${params}`);
  currentRecords = result.records;
  currentTotal = result.total;
  const headings = headersForView().map((heading) => `<th>${escapeHtml(heading)}</th>`).join('');
  const rows = currentRecords.map((record) => `<tr>${recordCells(record)}</tr>`).join('');
  const pages = Math.max(1, Math.ceil(currentTotal / pageSize));
  const currentPage = Math.floor(currentOffset / pageSize) + 1;
  document.querySelector('#main-content').innerHTML = `
    <header class="section-heading"><div><h2>${escapeHtml(labels[currentView])}</h2><p>${escapeHtml(descriptions[currentView])}</p></div></header>
    <section class="panel"><div class="panel-content"><div class="records-toolbar"><input id="record-search" class="search-box" type="search" placeholder="Search ${escapeHtml(currentView)}" value="${escapeHtml(currentSearch)}" aria-label="Search ${escapeHtml(currentView)}"><span class="record-count">${currentTotal.toLocaleString()} records</span></div></div>
      <div class="table-scroll"><table class="data-table"><thead><tr>${headings}</tr></thead><tbody>${rows || `<tr><td colspan="${headersForView().length}"><div class="empty-state">No ${escapeHtml(currentView)} records found.</div></td></tr>`}</tbody></table></div>
      <footer class="pager"><span>Page ${currentPage} of ${pages} · ${currentTotal.toLocaleString()} records</span><button data-page="previous" ${currentOffset <= 0 ? 'disabled' : ''}>Previous</button><button data-page="next" ${currentOffset + pageSize >= currentTotal ? 'disabled' : ''}>Next</button></footer>
    </section>`;
}

async function navigate(view) {
  currentView = view;
  currentOffset = 0;
  currentSearch = '';
  document.querySelector('#page-title').textContent = labels[view];
  document.querySelectorAll('.nav-link').forEach((button) => button.classList.toggle('active', button.dataset.view === view));
  try {
    if (view === 'overview') await loadOverview();
    else await loadRecords();
  } catch (error) {
    document.querySelector('#main-content').innerHTML = `<div class="empty-note">${escapeHtml(error.message)}</div>`;
  }
}

function openModeration(userId, suspended) {
  const user = currentRecords.find((record) => record.id === userId);
  if (!user) return;
  const dialog = document.querySelector('#moderation-dialog');
  const form = document.querySelector('#moderation-form');
  form.elements.userId.value = user.id;
  form.elements.suspended.value = String(!suspended);
  form.elements.reason.value = '';
  form.elements.reason.required = !suspended;
  document.querySelector('#moderation-title').textContent = suspended ? 'Restore account' : 'Suspend account';
  document.querySelector('#moderation-description').textContent = suspended
    ? `Restore ${user.name}'s marketplace access and listings?`
    : `Suspend ${user.name}? Their existing listings will be hidden and current sign-in sessions revoked. Orders and payouts remain in the ledger.`;
  document.querySelector('#moderation-submit').textContent = suspended ? 'Restore account' : 'Suspend account';
  document.querySelector('#moderation-submit').classList.toggle('button-danger', !suspended);
  document.querySelector('#moderation-submit').classList.toggle('button-primary', suspended);
  dialog.hidden = false;
  document.querySelector('#moderation-reason').focus();
}

function closeDialog() {
  document.querySelector('#moderation-dialog').hidden = true;
}

async function refresh() {
  if (!token()) return showLogin();
  showApp();
  await navigate(currentView);
}

function bindEvents() {
  document.querySelector('#login-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const button = form.querySelector('button[type="submit"]');
    const error = document.querySelector('#login-error');
    button.disabled = true;
    error.hidden = true;
    try {
      const result = await api('/api/admin/login', { method: 'POST', body: JSON.stringify({ password: form.elements.password.value }) });
      sessionStorage.setItem(tokenKey, result.token);
      form.reset();
      showApp();
      await navigate('overview');
    } catch (reason) {
      error.textContent = reason.message;
      error.hidden = false;
    } finally {
      button.disabled = false;
    }
  });

  document.addEventListener('click', async (event) => {
    const viewButton = event.target.closest('[data-view]');
    if (viewButton) {
      event.preventDefault();
      return navigate(viewButton.dataset.view);
    }
    const pageButton = event.target.closest('[data-page]');
    if (pageButton && !pageButton.disabled) {
      currentOffset = Math.max(0, currentOffset + (pageButton.dataset.page === 'next' ? pageSize : -pageSize));
      try { await loadRecords(); } catch (error) { notify(error.message); }
      return;
    }
    const moderate = event.target.closest('[data-moderate-user]');
    if (moderate) return openModeration(moderate.dataset.moderateUser, moderate.dataset.suspended === 'true');
    if (event.target.closest('[data-close-dialog]')) return closeDialog();
    if (event.target.id === 'signout-button') return signOut();
    if (event.target.id === 'refresh-button') {
      try { await refresh(); notify('Marketplace records refreshed.'); } catch (error) { notify(error.message); }
      return;
    }
    if (event.target.id === 'theme-button') {
      document.body.classList.toggle('dark');
      localStorage.setItem('unishop-admin-theme', document.body.classList.contains('dark') ? 'dark' : 'light');
    }
  });

  document.addEventListener('input', (event) => {
    if (event.target.id !== 'record-search') return;
    const searchInput = event.target;
    clearTimeout(searchTimer);
    searchTimer = setTimeout(async () => {
      currentOffset = 0;
      currentSearch = searchInput.value.trim();
      const cursor = searchInput.selectionStart;
      try {
        await loadRecords();
        const refreshedInput = document.querySelector('#record-search');
        refreshedInput.focus();
        refreshedInput.setSelectionRange(cursor, cursor);
      } catch (error) { notify(error.message); }
    }, 220);
  });

  document.querySelector('#moderation-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const button = document.querySelector('#moderation-submit');
    button.disabled = true;
    try {
      await api(`/api/admin/users/${encodeURIComponent(form.elements.userId.value)}/suspension`, {
        method: 'PATCH',
        body: JSON.stringify({ suspended: form.elements.suspended.value === 'true', reason: form.elements.reason.value })
      });
      closeDialog();
      await navigate('users');
      notify(form.elements.suspended.value === 'true' ? 'Account suspended and listings hidden.' : 'Account restored.');
    } catch (error) {
      notify(error.message);
    } finally {
      button.disabled = false;
    }
  });

  document.querySelector('#moderation-dialog').addEventListener('click', (event) => {
    if (event.target.id === 'moderation-dialog') closeDialog();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeDialog();
  });
}

bindEvents();
if (localStorage.getItem('unishop-admin-theme') === 'dark') document.body.classList.add('dark');
if (token()) refresh();
else showLogin();
setInterval(() => {
  if (token() && currentView === 'overview') loadOverview().catch(() => {});
}, 60000);
