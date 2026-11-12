const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

process.env.NODE_ENV = 'test';
process.env.NIN_VERIFICATION_ENABLED = 'true';
process.env.PAYSTACK_SECRET_KEY = 'sk_test_mock_only';
process.env.RESEND_API_KEY = 're_test';
process.env.JWT_SECRET = 'local-integration-signing-secret';
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'unishop-delivery-'));
process.env.MARKETPLACE_DATA_PATH = path.join(dir, 'marketplace.json');
process.env.UPLOADS_DIRECTORY = path.join(dir, 'uploads');

const nativeFetch = global.fetch;
let amount = 0;
let email = '';
const sent = [];
global.fetch = async (url, options = {}) => {
  if (String(url).startsWith('https://api.resend.com/')) { sent.push(JSON.parse(options.body)); return new Response('{}', { status: 200 }); }
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
    const reg = (username, role = 'customer', extra = {}) => send('POST', '/api/auth/register', { name: 'Pay Person', username, email: `${username}@example.com`, password: 'marketplacepassword123', role, ...extra });
    const sellerReg = await reg(`partsel${stamp}`, 'seller', { businessName: 'Part Store' });
    assert.equal((await send('POST', '/api/profile/nin', { nin: '12345678904' }, sellerReg.data.token)).status, 200);
    assert.equal((await send('PATCH', '/api/profile', { name: 'Part Seller', businessName: 'Part Store', position: 'Owner', placeOfOperation: 'Ewet Housing, Uyo', aboutMe: 'A local shop sharing practical goods with customers around Uyo.', profileImage: '/uploads/a.jpg', ceoImage: '/uploads/b.jpg' }, sellerReg.data.token)).status, 200);
    const form = new FormData(); form.append('images', new Blob([Buffer.from([0xff, 0xd8, 0xff, 0xd9])], { type: 'image/jpeg' }), 'i.jpg');
    const up = await nativeFetch(base + '/api/uploads/portfolio', { method: 'POST', headers: { authorization: `Bearer ${sellerReg.data.token}` }, body: form });
    const image = (await up.json()).images[0];
    const product = await send('POST', '/api/seller/products', { name: 'Part pay chair', category: 'Home', description: 'A chair for delivery tests.', price: 28500, image }, sellerReg.data.token);
    assert.equal(product.status, 201);
    const productId = product.data.product.id;

    const rider = await reg(`rider${stamp}`, 'dispatch', { businessName: 'Uyo riders' });
    assert.equal(rider.status, 201, JSON.stringify(rider.data));
    const rider2 = await reg(`rider2${stamp}`, 'dispatch', { businessName: 'Other riders' });
    assert.equal(rider2.status, 201);
    const buyer = await reg(`delbuy${stamp}`);
    const pay = await send('POST', '/api/payments/initialize', { email: 'buyer@example.com', customer: { name: 'Pay Person', phone: '08000000000' }, delivery: { address: '12 Test Street', neighbourhood: 'Ewet Housing' }, items: [{ id: productId, quantity: 1 }], paymentPlan: 'full' }, buyer.data.token);
    assert.equal(pay.status, 201);
    const before = sent.length;
    assert.equal((await send('GET', `/api/payments/verify/${pay.data.reference}`)).data.order.paymentStatus, 'paid');
    await new Promise((resolve) => setTimeout(resolve, 200));
    const toRiders = sent.slice(before).filter((mail) => /rider/.test(mail.to[0]));
    assert.equal(toRiders.length, 2, 'both delivery accounts are emailed');
    assert.ok(/Part Store/.test(toRiders[0].html), 'the email names the vendor');
    assert.ok(!/12 Test Street/.test(toRiders[0].html), 'the email does not leak the customer address');
    const dash = await send('GET', '/api/dashboard', undefined, rider.data.token);
    assert.equal(dash.data.jobs.length, 1);
    assert.equal(dash.data.jobs[0].vendors[0].business, 'Part Store');
    assert.equal(dash.data.jobs[0].address, undefined, 'address hidden until accepted');
    assert.equal((await send('PATCH', `/api/dispatch/jobs/${pay.data.reference}`, { status: 'accept' }, rider.data.token)).status, 200);
    const mine = await send('GET', '/api/dashboard', undefined, rider.data.token);
    assert.equal(mine.data.jobs[0].address, '12 Test Street');
    assert.equal((await send('GET', '/api/dashboard', undefined, rider2.data.token)).data.jobs.length, 0, 'a taken job leaves the other rider list');
    assert.ok(Array.isArray(dash.data.serviceBookings));
    console.log('delivery dashboard smoke test passed');
    server.close(); process.exit(0);
  } catch (error) { console.error(error); server.close(); process.exit(1); }
});
