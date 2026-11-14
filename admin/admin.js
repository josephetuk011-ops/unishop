const tokenKey = 'unishop-admin-token';
const pageSize = 50;
const labels = { overview: 'Marketplace overview', users: 'Accounts', orders: 'Orders', bookings: 'Bookings', listings: 'Listings', payouts: 'Payouts', audit: 'Admin activity', chats: 'Chats', mail: 'Send mail', sent: 'Sent mail' };
const descriptions = {
  users: 'Review customer, seller, service provider and dispatch accounts. Suspensions delist sellers/providers and block their access.',
  orders: 'Marketplace order ledger, including customer, items, payment and delivery details.',
  bookings: 'Service requests, payment progress, provider and customer details.',
  listings: 'All product and service listings with current account availability.',
  payouts: 'Marketplace payout records and account ownership. Bank credentials are not exposed.',
  audit: 'Sign-ins and administrator actions recorded by the marketplace.',
  chats: 'Every negotiation between customers and service providers, including messages that were blocked for sharing contact details. Open a chat to read it.'
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

const trackingNext = { 'awaiting-pickup': ['collected', 'Mark collected from seller'], collected: ['on-dispatch', 'Mark on dispatch'], 'on-dispatch': ['delivered', 'Mark delivered'] };
function trackingCell(record) {
  if (record.type === 'service' || record.paymentStatus !== 'paid' || !record.tracking) return status(record.deliveryStatus || record.orderStatus);
  const current = record.tracking.status;
  const next = trackingNext[current];
  const label = (record.tracking.steps.find((step) => step.key === current) || {}).label || current;
  return `${status(label)}${record.orderStatus === 'completed' ? '' : next ? `<br><button class="table-action" data-track-order="${escapeHtml(record.reference)}" data-track-status="${next[0]}">${next[1]}</button>` : ''}`;
}

function thumb(src, alt) {
  return src ? `<img class="thumb" src="${escapeHtml(src)}" alt="${escapeHtml(alt || '')}" loading="lazy">` : '<span class="thumb thumb-empty"></span>';
}
function contactLines(contact) {
  if (!contact) return '';
  const phone = contact.phone ? `<a href="tel:${escapeHtml(contact.phone)}">${escapeHtml(contact.phone)}</a>` : '<span class="muted">no phone</span>';
  const email = contact.email ? `<a href="mailto:${escapeHtml(contact.email)}">${escapeHtml(contact.email)}</a>` : '';
  return `${phone}${email ? `<br>${email}` : ''}`;
}
function payoutLines(contact, amount) {
  const payout = contact && contact.payout;
  const owed = amount ? `<small>Pay seller: <strong>${escapeHtml(formatMoney(amount))}</strong></small>` : '';
  if (!payout) return `<div class="payout-box missing">No bank account saved yet${owed}</div>`;
  if (!payout.accountNumber) return `<div class="payout-box missing">${escapeHtml(payout.bankName)} ending ${escapeHtml(payout.last4)}. Full number not shared yet; ask them to re-save it.${owed}</div>`;
  return `<div class="payout-box"><strong>${escapeHtml(payout.accountName)}</strong><br>${escapeHtml(payout.bankName)} · ${escapeHtml(payout.accountNumber)} <button type="button" class="table-action" data-copy="${escapeHtml(payout.accountNumber)}">Copy</button>${owed}</div>`;
}
function recordCells(record) {
  if (currentView === 'users') {
    const accountStatus = record.suspendedAt ? status('suspended') : status('active');
    const action = ['seller', 'provider', 'customer'].includes(record.role)
      ? `<button class="table-action ${record.suspendedAt ? 'restore' : ''}" data-moderate-user="${escapeHtml(record.id)}" data-suspended="${Boolean(record.suspendedAt)}">${record.suspendedAt ? 'Restore' : 'Suspend'}</button>`
      : '—';
    return `<td>${cell(record.name, record.businessName || record.niche || '')}</td><td><div class="contact">${contactLines({ phone: record.phone, email: record.email })}<small>${escapeHtml(record.ninLast4 ? `${record.username} · NIN ••••••• ${record.ninLast4} (${record.ninStatus || 'pending'})` : record.username)}${record.placeOfOperation ? ` · ${escapeHtml(record.placeOfOperation)}` : ''}</small></div></td><td>${status(record.role)}</td><td>${accountStatus}${record.suspensionReason ? `<small>${escapeHtml(record.suspensionReason)}</small>` : ''}</td><td>${escapeHtml(formatDate(record.createdAt))}</td><td>${action}</td>`;
  }
  if (currentView === 'orders') {
    const itemList = (record.items || []).map((item) => `<div class="order-line">${thumb(item.image, item.name)}<span>${escapeHtml(item.name)} ×${escapeHtml(item.quantity)}<small>${escapeHtml(item.seller || '')}</small></span></div>`).join('');
    const sellerList = (record.sellers || []).map((seller) => `<div class="contact"><strong>${escapeHtml(seller.businessName || seller.name)}</strong><br>${contactLines(seller)}${payoutLines(seller, seller.netNaira)}${seller.place ? `<small>${escapeHtml(seller.place)}</small>` : ''}</div>`).join('') || '—';
    return `<td>${cell(record.reference, formatDate(record.createdAt))}</td><td><div class="contact"><strong>${escapeHtml(record.customerName)}</strong><br>${contactLines({ phone: record.customerPhone, email: record.customerEmail })}<small>${escapeHtml(record.deliveryAddress || '')}</small></div></td><td class="row-detail">${itemList || '—'}</td><td>${sellerList}</td><td>${escapeHtml(formatMoney(record.totalNaira))}</td><td>${status(record.paymentStatus)}</td><td>${trackingCell(record)}</td>`;
  }
  if (currentView === 'bookings') {
    const provider = record.provider || {};
    return `<td><div class="order-line">${thumb(record.image, record.service)}<span>${escapeHtml(record.service)}<small>${escapeHtml(record.providerName)}</small></span></div></td><td><div class="contact"><strong>${escapeHtml(provider.businessName || provider.name || record.providerName)}</strong><br>${contactLines(provider)}${payoutLines(provider, record.providerNetNaira)}</div></td><td><div class="contact"><strong>${escapeHtml(record.customerName)}</strong><br>${contactLines({ phone: record.customerPhone, email: record.customerEmail })}</div></td><td>${cell(record.time, record.neighbourhood)}</td><td>${escapeHtml(record.amountNaira ? formatMoney(record.amountNaira) : 'Quote pending')}</td><td>${status(record.status)}</td><td>${status(record.paymentStatus)}</td>`;
  }
  if (currentView === 'listings') {
    const name = record.name || record.title;
    return `<td>${status(record.listingType)}</td><td>${cell(name, record.category || record.niche)}</td><td>${cell(record.ownerName, record.ownerRole)}</td><td>${escapeHtml(formatMoney(record.price))}</td><td>${record.isSuspended ? status('suspended') : status('active')}</td><td>${escapeHtml(formatDate(record.createdAt))}</td>`;
  }
  if (currentView === 'chats') {
    return `<td>${cell(record.listingTitle, formatDate(record.createdAt))}</td><td>${cell(record.customerName, record.customerEmail)}</td><td>${escapeHtml(record.providerName)}</td><td>${cell(`${record.messageCount} messages`, record.lastMessage ? record.lastMessage.slice(0, 70) : '')}</td><td>${status(record.status)}${record.violations ? `<br>${status('suspended')} ${record.violations} blocked` : ''}${record.offerNaira ? `<br><small>Offer ${escapeHtml(formatMoney(record.offerNaira))}</small>` : ''}</td><td><button class="table-action" data-open-chat="${escapeHtml(record.id)}">Read chat</button></td>`;
  }
  if (currentView === 'payouts') {
    return `<td>${cell(record.reference, formatDate(record.createdAt))}</td><td>${cell(record.ownerName, record.ownerEmail)}</td><td>${status(record.ownerRole)}</td><td>${escapeHtml(formatMoney(record.amountNaira))}</td><td>${status(record.status)}</td>`;
  }
  return `<td>${cell(record.action, `${formatDate(record.createdAt)} · ${record.actorId || 'system'}`)}</td><td class="activity-details">${escapeHtml(JSON.stringify(record.details || {}))}</td>`;
}

function headersForView() {
  if (currentView === 'users') return ['Account', 'Email and username', 'Role', 'Access', 'Joined', 'Action'];
  if (currentView === 'orders') return ['Order', 'Customer contact and delivery', 'Items', 'Seller contacts and bank', 'Total', 'Payment', 'Delivery tracking'];
  if (currentView === 'bookings') return ['Service', 'Provider contact and bank', 'Customer contact', 'Requested time', 'Price', 'Booking', 'Payment'];
  if (currentView === 'listings') return ['Type', 'Listing', 'Account owner', 'Price', 'Visibility', 'Created'];
  if (currentView === 'chats') return ['Service and last activity', 'Customer', 'Service provider', 'Messages', 'Status', 'Chat'];
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
    else if (view === 'mail') await loadMail();
    else if (view === 'sent') await loadSentMail();
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
  document.querySelector('#chat-dialog').hidden = true;
}

async function refresh() {
  if (!token()) return showLogin();
  showApp();
  await navigate(currentView);
}

function bindEvents() {
  const adminPassword = document.querySelector('#admin-password');
  const passwordToggle = document.querySelector('.password-toggle');
  passwordToggle.addEventListener('click', () => {
    const isVisible = adminPassword.type === 'password';
    adminPassword.type = isVisible ? 'text' : 'password';
    passwordToggle.setAttribute('aria-pressed', String(isVisible));
    passwordToggle.setAttribute('aria-label', isVisible ? 'Hide password' : 'Show password');
    passwordToggle.title = isVisible ? 'Hide password' : 'Show password';
  });
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
    const copy = event.target.closest('[data-copy]');
    if (copy) { try { await navigator.clipboard.writeText(copy.dataset.copy); copy.textContent = 'Copied'; setTimeout(() => { copy.textContent = 'Copy'; }, 1500); } catch { copy.textContent = copy.dataset.copy; } return; }
    const track = event.target.closest('[data-track-order]');
    if (track) {
      track.disabled = true;
      try { await api(`/api/admin/orders/${encodeURIComponent(track.dataset.trackOrder)}/tracking`, { method: 'PATCH', body: JSON.stringify({ status: track.dataset.trackStatus }) }); await loadRecords(); notify('Tracking updated. The customer was notified.'); }
      catch (error) { notify(error.message); track.disabled = false; }
      return;
    }
    const openChat = event.target.closest('[data-open-chat]');
    if (openChat) {
      try {
        const data = await api(`/api/admin/chats/${encodeURIComponent(openChat.dataset.openChat)}`);
        document.querySelector('#chat-title').textContent = `${data.conversation.customerName} and ${data.conversation.providerName}`;
        document.querySelector('#chat-subtitle').textContent = `${data.conversation.listingTitle} · ${data.conversation.status}${data.conversation.offerNaira ? ` · offer ${formatMoney(data.conversation.offerNaira)}` : ''}`;
        const external = (url) => /^https:\/\/res\.cloudinary\.com\//.test(url) ? url : '';
        document.querySelector('#chat-log').innerHTML = data.messages.map((message) => {
          const attachment = message.media ? (external(message.media.url) ? `<a href="${escapeHtml(message.media.url)}" target="_blank" rel="noopener">Open ${escapeHtml(message.media.kind)}</a>` : `<em>${escapeHtml(message.media.kind)} stored on the marketplace server (${escapeHtml(message.media.url)})</em>`) : '';
          return `<div class="chat-entry${message.violation ? ' chat-violation' : ''}"><div class="chat-meta"><strong>${escapeHtml(message.senderName)}</strong><span>${escapeHtml(formatDate(message.createdAt))}</span>${message.violation ? `<b>BLOCKED: shared ${escapeHtml(message.violationKind || 'contact details')}</b>` : ''}</div><p>${escapeHtml(message.kind === 'offer' || message.kind === 'system' ? message.text : message.text || '')}</p>${attachment}</div>`;
        }).join('') || '<div class="empty-state">No messages yet.</div>';
        document.querySelector('#chat-dialog').hidden = false;
      } catch (error) { notify(error.message); }
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


// ---- Send mail: write a message, tick recipients, send ----
let mailRecipients = [];
const mailRoleNames = { customer: 'Customers', seller: 'Vendors', provider: 'Service providers', dispatch: 'Delivery team' };
const mailSelected = new Set();

function mailVisible() {
  const role = document.querySelector('#mail-role')?.value || 'all';
  const term = (document.querySelector('#mail-search')?.value || '').trim().toLowerCase();
  return mailRecipients.filter((person) => (role === 'all' || person.role === role) && (!term || `${person.name} ${person.email}`.toLowerCase().includes(term)));
}

function renderMailList() {
  const visible = mailVisible();
  document.querySelector('#mail-list').innerHTML = visible.map((person) => `<label class="mail-person"><input type="checkbox" data-mail-id="${escapeHtml(person.id)}" ${mailSelected.has(person.id) ? 'checked' : ''}><span><strong>${escapeHtml(person.name)}</strong><small>${escapeHtml(person.email)} · ${escapeHtml(mailRoleNames[person.role] || person.role)}${person.suspended ? ' · suspended' : ''}</small></span></label>`).join('') || '<div class="empty-state">No accounts match.</div>';
  document.querySelector('#mail-count').textContent = `${mailSelected.size} selected`;
}

async function loadMail() {
  const data = await api('/api/admin/mail/recipients');
  mailRecipients = data.recipients;
  mailSelected.clear();
  const roleOptions = ['all', 'customer', 'seller', 'provider', 'dispatch'].map((role) => `<option value="${role}">${role === 'all' ? 'Everyone' : mailRoleNames[role]}</option>`).join('');
  document.querySelector('#main-content').innerHTML = `
    <header class="section-heading"><div><h2>Send mail</h2><p>Write a message, tick the people who should get it, and send. Each person gets their own email.</p></div></header>
    ${data.mailConfigured ? '' : '<div class="empty-note">Email is not set up on this deployment, so nothing can be sent yet.</div>'}
    <section class="panel"><div class="panel-content mail-grid">
      <form id="mail-form" class="mail-form">
        <label for="mail-subject">Subject</label><input id="mail-subject" maxlength="150" required placeholder="What is this about?">
        <label for="mail-message">Message</label><textarea id="mail-message" rows="10" maxlength="5000" required placeholder="Type your message here"></textarea>
        <label for="mail-audience">Send to</label><select id="mail-audience"><option value="selected">Only the people I tick on the right</option>${['all', 'customer', 'seller', 'provider', 'dispatch'].map((role) => { const n = mailRecipients.filter((person) => !person.suspended && (role === 'all' || person.role === role)).length; return `<option value="${role}">${role === 'all' ? 'Everyone' : 'All ' + mailRoleNames[role].toLowerCase()} (${n} active accounts)</option>`; }).join('')}</select>
        <label for="mail-extra">Other email addresses (optional, separated by commas)</label><input id="mail-extra" placeholder="name@example.com, other@example.com">
        <div class="dialog-actions"><span id="mail-count" class="record-count">0 selected</span><button id="mail-send" class="button button-primary" type="submit">Send mail</button></div>
        <p id="mail-result" class="form-error" role="status" hidden></p>
      </form>
      <div class="mail-pick">
        <div class="records-toolbar"><select id="mail-role" aria-label="Filter by account type">${roleOptions}</select><input id="mail-search" class="search-box" type="search" placeholder="Search name or email" aria-label="Search recipients"></div>
        <div class="mail-actions"><button type="button" class="button button-secondary" id="mail-all">Tick all shown</button><button type="button" class="button button-secondary" id="mail-none">Clear</button></div>
        <div id="mail-list" class="mail-list"></div>
      </div>
    </div></section>`;
  renderMailList();
  document.querySelector('#mail-role').addEventListener('change', renderMailList);
  document.querySelector('#mail-search').addEventListener('input', renderMailList);
  document.querySelector('#mail-all').addEventListener('click', () => { mailVisible().forEach((person) => mailSelected.add(person.id)); renderMailList(); });
  document.querySelector('#mail-none').addEventListener('click', () => { mailSelected.clear(); renderMailList(); });
  document.querySelector('#mail-list').addEventListener('change', (event) => {
    const box = event.target.closest('[data-mail-id]');
    if (!box) return;
    if (box.checked) mailSelected.add(box.dataset.mailId); else mailSelected.delete(box.dataset.mailId);
    document.querySelector('#mail-count').textContent = `${mailSelected.size} selected`;
  });
  document.querySelector('#mail-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const extraEmails = document.querySelector('#mail-extra').value.split(/[\s,;]+/).filter(Boolean);
    const audience = document.querySelector('#mail-audience').value;
    const group = audience === 'selected' ? '' : audience;
    const groupCount = group ? mailRecipients.filter((person) => !person.suspended && (group === 'all' || person.role === group)).length : 0;
    const count = groupCount + mailSelected.size + extraEmails.length;
    if (!count) { notify('Choose who to send to: tick people or pick a group.'); return; }
    const label = group ? document.querySelector('#mail-audience').selectedOptions[0].textContent.replace(/ \(.*/, '') : 'the people you ticked';
    if (!confirm(`Send this email to ${label} (up to ${count} addresses)?`)) return;
    const button = document.querySelector('#mail-send');
    const result = document.querySelector('#mail-result');
    button.disabled = true; button.textContent = 'Sending…'; result.hidden = true;
    try {
      const outcome = await api('/api/admin/mail', { method: 'POST', body: JSON.stringify({ subject: document.querySelector('#mail-subject').value, message: document.querySelector('#mail-message').value, userIds: [...mailSelected], audience: group, extraEmails }) });
      result.hidden = false;
      result.textContent = outcome.failed.length ? `Sent to ${outcome.sent} of ${outcome.total}. Failed: ${outcome.failed.join(', ')}` : `Sent to ${outcome.sent} recipient${outcome.sent === 1 ? '' : 's'}.`;
      notify(outcome.failed.length ? 'Some emails failed.' : 'Mail sent.');
    } catch (error) { result.hidden = false; result.textContent = error.message; }
    button.disabled = false; button.textContent = 'Send mail';
  });
}

const audienceNames = { all: 'Everyone', customer: 'Customers', seller: 'Vendors', provider: 'Service providers', dispatch: 'Delivery team', selected: 'Chosen people' };
async function loadSentMail() {
  const data = await api('/api/admin/mail/sent');
  const rows = data.mails.map((mail) => {
    const failedCount = mail.failedCount ?? (mail.failed || []).length;
    const status = failedCount ? `${mail.sent} of ${mail.total} delivered, ${failedCount} failed` : `Sent to ${mail.sent}`;
    const who = mail.detailsKept ? `${escapeHtml(audienceNames[mail.audience] || 'Chosen people')} · ${mail.total} address${mail.total === 1 ? '' : 'es'}` : `${mail.total} address${mail.total === 1 ? '' : 'es'}`;
    const body = mail.detailsKept
      ? `<details class="sent-mail"><summary>Read message and recipients</summary><pre class="sent-mail-body">${escapeHtml(mail.message)}</pre><p class="sent-mail-to"><strong>To:</strong> ${escapeHtml(mail.recipients.join(', '))}</p>${failedCount ? `<p class="sent-mail-to"><strong>Failed:</strong> ${escapeHtml(mail.failed.join(', '))}</p>` : ''}</details>`
      : '<span class="sent-mail-old">Sent before the message text was kept, so only the subject and counts are available.</span>';
    return `<tr><td>${escapeHtml(formatDate(mail.createdAt))}</td><td><strong>${escapeHtml(mail.subject)}</strong><br>${body}</td><td>${who}</td><td>${escapeHtml(status)}</td></tr>`;
  }).join('');
  document.querySelector('#main-content').innerHTML = `
    <header class="section-heading"><div><h2>Sent mail</h2><p>Every message sent from this dashboard, newest first.</p></div></header>
    <section class="panel"><div class="panel-content"><div class="table-scroll"><table class="data-table"><thead><tr><th>Sent</th><th>Subject</th><th>To</th><th>Result</th></tr></thead><tbody>${rows || '<tr><td colspan="4"><div class="empty-state">No mail has been sent yet.</div></td></tr>'}</tbody></table></div></div></section>`;
}
