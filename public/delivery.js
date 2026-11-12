let token = localStorage.getItem('unishop-delivery-token') || '';
const $ = (selector) => document.querySelector(selector);
const esc = (value = '') => String(value).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const money = (n = 0) => `₦${Number(n).toLocaleString('en-NG')}`;
const when = (v) => (v ? new Intl.DateTimeFormat('en-NG', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(v)) : '');
let toastTimer;
function toast(message) {
  const node = $('#dl-toast');
  node.textContent = message;
  node.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => node.classList.remove('show'), 3200);
}
async function refreshSession() {
  try {
    const response = await fetch('/api/auth/refresh', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
    if (!response.ok) return false;
    token = (await response.json()).token;
    localStorage.setItem('unishop-delivery-token', token);
    return true;
  } catch { return false; }
}
async function api(url, options = {}, retried = false) {
  const response = await fetch(url, { ...options, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) } });
  if (response.status === 401 && token && !retried && await refreshSession()) return api(url, options, true);
  const result = await response.json().catch(() => ({}));
  if (!response.ok) { const error = new Error(result.error || 'Something went wrong. Try again.'); error.status = response.status; throw error; }
  return result;
}
function showAuth(mode = 'login') {
  $('#dl-app').hidden = true; $('#dl-signout').hidden = true; $('#dl-auth').hidden = false;
  $('#dl-login').hidden = mode !== 'login'; $('#dl-register').hidden = mode !== 'register';
  $('#tab-login').classList.toggle('active', mode === 'login'); $('#tab-register').classList.toggle('active', mode === 'register');
  $('#dl-error').textContent = '';
}
const vendorLine = (vendors = []) => vendors.map((v) => `${esc(v.business)}${v.place ? ` · ${esc(v.place)}` : ''}`).join('; ') || 'Vendor';
function jobCard(job, mine) {
  const items = (job.items || []).map((item) => `${item.quantity} × ${esc(item.name)}`).join(', ');
  let action = '';
  if (!job.dispatchRiderId) action = `<button class="dl-btn dl-small" data-act="accept" data-ref="${esc(job.reference)}">Accept this delivery</button>`;
  else if (job.deliveryStatus === 'assigned') action = `<button class="dl-btn dl-small" data-act="picked-up" data-ref="${esc(job.reference)}">Mark collected from vendor</button>`;
  else if (job.deliveryStatus === 'picked-up') action = `<button class="dl-btn dl-small" data-act="delivered" data-ref="${esc(job.reference)}">Mark delivered</button>`;
  else action = '<span class="dl-pill">Delivered</span>';
  const customer = mine ? `<p><strong>Deliver to:</strong> ${esc(job.customerName || '')}, ${esc(job.phone || '')}, ${esc(job.address || '')}</p>` : '';
  return `<div class="dl-item"><h3>${esc(job.reference)}<span class="dl-pill">${esc(job.deliveryStatus || 'new')}</span></h3><p>${items}</p><p><strong>Pick up from:</strong> ${vendorLine(job.vendors)}</p><p><strong>Area:</strong> ${esc(job.neighbourhood || 'Uyo')} · ${esc(when(job.paidAt))}</p>${customer}<p>${action}</p></div>`;
}
function render(data) {
  const jobs = data.jobs || [];
  const open = jobs.filter((job) => !job.dispatchRiderId);
  const mine = jobs.filter((job) => job.dispatchRiderId);
  const m = data.metrics || {};
  $('#dl-metrics').innerHTML = `<div><strong>${open.length}</strong><span>Orders waiting</span></div><div><strong>${mine.filter((j) => j.deliveryStatus !== 'delivered').length}</strong><span>My active deliveries</span></div><div><strong>${m.completedJobs ?? 0}</strong><span>Delivered by me</span></div><div><strong>${(data.serviceBookings || []).length}</strong><span>Service bookings</span></div>`;
  $('#dl-open').innerHTML = open.map((job) => jobCard(job, false)).join('') || '<p class="dl-empty">No paid orders are waiting. You will get an email when one arrives.</p>';
  $('#dl-mine').innerHTML = mine.map((job) => jobCard(job, true)).join('') || '<p class="dl-empty">Accept an order to see the customer address and phone number.</p>';
  $('#dl-bookings').innerHTML = (data.serviceBookings || []).map((b) => `<div class="dl-item"><h3>${esc(b.service)}<span class="dl-pill">${esc(b.status || 'paid')}</span></h3><p><strong>Provider:</strong> ${vendorLine(b.vendors)}</p><p><strong>Area:</strong> ${esc(b.neighbourhood || 'Uyo')} · <strong>When:</strong> ${esc(b.time || 'to be agreed')}</p><p>${esc(b.reference)} · ${money(b.totalNaira)}</p></div>`).join('') || '<p class="dl-empty">No paid service bookings yet.</p>';
}
async function load() {
  try {
    const data = await api('/api/dashboard');
    if (data.role !== 'dispatch') { localStorage.removeItem('unishop-delivery-token'); token = ''; showAuth('login'); $('#dl-error').textContent = 'This page is for delivery team accounts. Create a delivery account here.'; return; }
    $('#dl-auth').hidden = true; $('#dl-app').hidden = false; $('#dl-signout').hidden = false;
    render(data);
  } catch (error) {
    if (error.status === 401 || error.status === 403) { localStorage.removeItem('unishop-delivery-token'); token = ''; showAuth('login'); }
    else toast(error.message);
  }
}
async function authenticate(path, body) {
  const result = await api(path, { method: 'POST', body: JSON.stringify(body) });
  if (result.user?.role !== 'dispatch') throw new Error('That account is not a delivery team account.');
  token = result.token;
  localStorage.setItem('unishop-delivery-token', token);
  await load();
}
$('#tab-login').onclick = () => showAuth('login');
$('#tab-register').onclick = () => showAuth('register');
$('#dl-login').addEventListener('submit', async (event) => {
  event.preventDefault();
  const f = event.target.elements;
  try { await authenticate('/api/auth/login', { username: f.username.value, password: f.password.value }); } catch (error) { $('#dl-error').textContent = error.message; }
});
$('#dl-register').addEventListener('submit', async (event) => {
  event.preventDefault();
  const f = event.target.elements;
  try { await authenticate('/api/auth/register', { name: f.name.value, username: f.username.value, email: f.email.value, password: f.password.value, role: 'dispatch', businessName: f.businessName.value }); toast('Account created. New orders and bookings will be emailed to you.'); } catch (error) { $('#dl-error').textContent = error.message; }
});
$('#dl-signout').onclick = async () => { await fetch('/api/auth/logout', { method: 'POST' }).catch(() => {}); localStorage.removeItem('unishop-delivery-token'); token = ''; showAuth('login'); };
document.addEventListener('click', async (event) => {
  const button = event.target.closest('[data-act]');
  if (!button) return;
  button.disabled = true;
  try { await api(`/api/dispatch/jobs/${encodeURIComponent(button.dataset.ref)}`, { method: 'PATCH', body: JSON.stringify({ status: button.dataset.act }) }); toast('Updated.'); await load(); }
  catch (error) { toast(error.message); button.disabled = false; }
});
if (token) load(); else showAuth('login');
setInterval(() => { if (token && !$('#dl-app').hidden) load(); }, 30000);
