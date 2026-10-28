const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

process.env.NODE_ENV = 'test';
process.env.PAYSTACK_SECRET_KEY = 'sk_test_mock_only';
process.env.ADMIN_PASSWORD = 'admin-test-password-123';
process.env.JWT_SECRET = 'local-integration-signing-secret';
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'unishop-tracking-'));
process.env.MARKETPLACE_DATA_PATH = path.join(dir, 'marketplace.json');
process.env.UPLOADS_DIRECTORY = path.join(dir, 'uploads');

const nativeFetch = global.fetch;
let amount = 0;
let email = '';
global.fetch = async (url, options = {}) => {
  if (!String(url).startsWith('https://api.paystack.co/')) return nativeFetch(url, options);
  if (String(url).endsWith('transaction/initialize')) {
    const body = JSON.parse(options.body);
    amount = body.amount; email = body.email;
    return new Response(JSON.stringify({ status: true, data: { reference: body.reference, authorization_url: 'https://checkout.paystack.com/mock' } }), { status: 200 });
  }
  return new Response(JSON.stringify({ status: true, data: { status: 'success', amount, currency: 'NGN', customer: { email } } }), { status: 200 });
};

require('ts-node/register');
const app = require('../src/app').default;
const server = app.listen(0, async () => {
  const base = `http://127.0.0.1:${server.address().port}`;
  const send = async (method, route, body, token) => {
    const r = await nativeFetch(base + route, { method, headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
    return { status: r.status, data: await r.json() };
  };
  try {
    const stamp = Date.now();
    const seller = await send('POST', '/api/auth/register', { name: 'Track Seller', username: `trs${stamp}`, email: `trs${stamp}@example.com`, password: 'marketplacepassword123', role: 'seller', businessName: 'Track Shop' });
    const st = seller.data.token;
    await send('PATCH', '/api/profile', { name: 'Track Seller', businessName: 'Track Shop', position: 'Owner', placeOfOperation: 'Uyo', aboutMe: 'A local shop selling things around Uyo.', profileImage: '/uploads/p.jpg', ceoImage: '/uploads/ceo.jpg' }, st);
    const product = (await send('POST', '/api/seller/products', { category: 'Fashion', description: 'A nice shirt for you.', price: 5000, image: '/uploads/shirt.jpg', name: 'Track shirt', quantity: 5 }, st)).data.product;
    assert.equal((await send('POST', '/api/auth/register', { name: 'Rider', username: `rid${stamp}`, email: `rid${stamp}@example.com`, password: 'marketplacepassword123', role: 'dispatch', businessName: 'Ewet' })).status, 403);
    const buyer = await send('POST', '/api/auth/register', { name: 'Track Buyer', username: `trb${stamp}`, email: `trb${stamp}@example.com`, password: 'marketplacepassword123', role: 'customer' });
    const bt = buyer.data.token;
    const order = await send('POST', '/api/payments/initialize', { email: `trb${stamp}@example.com`, customer: { name: 'Track Buyer', phone: '08000000000' }, delivery: { address: '12 Test Street', neighbourhood: 'Ewet Housing' }, items: [{ id: product.id, quantity: 1 }] }, bt);
    const ref = order.data.reference;
    await send('GET', `/api/payments/verify/${ref}`);
    const admin = (await send('POST', '/api/admin/login', { password: process.env.ADMIN_PASSWORD })).data.token;
    assert.ok(admin);
    const mine = () => send('GET', '/api/me/orders', null, bt).then((r) => r.data.find((o) => o.reference === ref));
    assert.equal((await mine()).tracking.status, 'awaiting-pickup');
    assert.equal((await send('PATCH', `/api/admin/orders/${ref}/tracking`, { status: 'delivered' }, bt)).status, 403);
    assert.equal((await send('POST', `/api/orders/${ref}/confirm-delivery`, {}, bt)).status, 409);
    assert.equal((await send('PATCH', `/api/admin/orders/${ref}/tracking`, { status: 'collected' }, admin)).status, 200);
    assert.equal((await send('PATCH', `/api/admin/orders/${ref}/tracking`, { status: 'collected' }, admin)).status, 409);
    assert.equal((await send('PATCH', `/api/admin/orders/${ref}/tracking`, { status: 'on-dispatch' }, admin)).status, 200);
    assert.equal((await send('POST', `/api/orders/${ref}/confirm-delivery`, {}, bt)).status, 409);
    await send('PATCH', `/api/admin/orders/${ref}/tracking`, { status: 'delivered' }, admin);
    const delivered = await mine();
    assert.deepEqual(delivered.tracking.steps.map((step) => step.done), [true, true, true, true]);
    assert.equal((await send('POST', `/api/orders/${ref}/confirm-delivery`, { rating: 9 }, bt)).status, 400);
    const before = (await send('GET', '/api/dashboard', null, st)).data;
    assert.equal((await send('POST', `/api/orders/${ref}/confirm-delivery`, { rating: 4, comment: 'Good' }, bt)).status, 200);
    assert.equal((await mine()).orderStatus, 'completed');
    assert.equal((await send('GET', '/api/products')).data.find((p) => p.id === product.id).rating, '4.0');
    const after = (await send('GET', '/api/dashboard', null, st)).data;
    assert.ok((after.availableBalanceNaira || 0) > (before.availableBalanceNaira || 0), 'vendor balance becomes withdrawable after the customer confirms');
    console.log('tracking smoke test passed');
    server.close(); process.exit(0);
  } catch (error) { console.error(error); server.close(); process.exit(1); }
});
