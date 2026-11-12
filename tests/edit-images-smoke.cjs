const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

process.env.NODE_ENV = 'test';
process.env.NIN_VERIFICATION_ENABLED = 'true';
process.env.PAYSTACK_SECRET_KEY = 'sk_test_mock_only';
process.env.JWT_SECRET = 'local-integration-signing-secret';
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'unishop-part-payment-'));
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
    const reg = (username, role = 'customer', extra = {}) => send('POST', '/api/auth/register', { name: 'Pay Person', username, email: `${username}@example.com`, password: 'marketplacepassword123', role, ...extra });
    const sellerReg = await reg(`partsel${stamp}`, 'seller', { businessName: 'Part Store' });
    assert.equal((await send('POST', '/api/profile/nin', { nin: '12345678904' }, sellerReg.data.token)).status, 200);
    assert.equal((await send('PATCH', '/api/profile', { name: 'Part Seller', businessName: 'Part Store', position: 'Owner', placeOfOperation: 'Ewet Housing, Uyo', aboutMe: 'A local shop sharing practical goods with customers around Uyo.', profileImage: '/uploads/a.jpg', ceoImage: '/uploads/b.jpg' }, sellerReg.data.token)).status, 200);
    const form = new FormData(); form.append('images', new Blob([Buffer.from([0xff, 0xd8, 0xff, 0xd9])], { type: 'image/jpeg' }), 'i.jpg');
    const up = await nativeFetch(base + '/api/uploads/portfolio', { method: 'POST', headers: { authorization: `Bearer ${sellerReg.data.token}` }, body: form });
    const image = (await up.json()).images[0];
    const product = await send('POST', '/api/seller/products', { name: 'Part pay chair', category: 'Home', description: 'A chair for edit images tests.', price: 28500, image }, sellerReg.data.token);
    assert.equal(product.status, 201);
    const productId = product.data.product.id;

    const up2 = await nativeFetch(base + '/api/uploads/portfolio', { method: 'POST', headers: { authorization: `Bearer ${sellerReg.data.token}` }, body: (() => { const f = new FormData(); f.append('images', new Blob([Buffer.from([0xff, 0xd8, 0xff, 0xd9])], { type: 'image/jpeg' }), 'j.jpg'); return f; })() });
    const second = (await up2.json()).images[0];
    assert.notEqual(second, image);
    const t = sellerReg.data.token;
    // add a photo and make it the cover
    let r = await send('PATCH', `/api/seller/products/${productId}`, { images: [second, image] }, t);
    assert.equal(r.status, 200);
    assert.equal(r.data.product.image, second);
    assert.deepEqual(r.data.product.images, [second, image]);
    // remove one
    r = await send('PATCH', `/api/seller/products/${productId}`, { images: [image] }, t);
    assert.deepEqual(r.data.product.images, [image]);
    assert.equal(r.data.product.image, image);
    // cannot empty or use outside links
    assert.equal((await send('PATCH', `/api/seller/products/${productId}`, { images: [] }, t)).status, 400);
    r = await send('PATCH', `/api/seller/products/${productId}`, { images: [image, image] }, t);
    assert.deepEqual(r.data.product.images, [image]);
    assert.equal((await send('PATCH', `/api/seller/products/${productId}`, { images: ['https://evil.example/x.jpg'] }, t)).status, 400);
    // another seller cannot edit it
    const other = await reg(`edimoth${stamp}`, 'seller', { businessName: 'Other' });
    assert.ok([403, 404].includes((await send('PATCH', `/api/seller/products/${productId}`, { images: [image] }, other.data.token)).status));
    console.log('edit images smoke test passed');
    server.close(); process.exit(0);
  } catch (error) { console.error(error); server.close(); process.exit(1); }
});
