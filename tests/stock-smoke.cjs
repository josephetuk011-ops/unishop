const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

process.env.NODE_ENV = 'test';
process.env.PAYSTACK_SECRET_KEY = 'sk_test_mock_only';
process.env.JWT_SECRET = 'local-integration-signing-secret';
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'unishop-stock-'));
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
    const seller = await send('POST', '/api/auth/register', { name: 'Stock Seller', username: `stk${stamp}`, email: `stk${stamp}@example.com`, password: 'marketplacepassword123', role: 'seller', businessName: 'Stock Shop' });
    const st = seller.data.token;
    assert.equal((await send('PATCH', '/api/profile', { name: 'Stock Seller', businessName: 'Stock Shop', position: 'Owner', placeOfOperation: 'Uyo', aboutMe: 'A local shop selling clothes around Uyo.', profileImage: '/uploads/p.jpg' }, st)).status, 200);
    const cats = (await send('GET', '/api/product-categories')).data.groups;
    assert.ok(cats.flatMap((g) => g.items).length >= 60, 'comprehensive category list');
    assert.equal((await send('POST', '/api/seller/products', { category: 'Made-up category', description: 'A nice shirt for you.', price: 5000, image: '/uploads/shirt.jpg', name: 'Bad category', quantity: 1 }, st)).status, 400);
    const sneakers = await send('POST', '/api/seller/products', { category: 'Shoes and sandals', description: 'Comfortable sneakers.', price: 9000, image: '/uploads/shirt.jpg', name: 'Sneakers', quantity: 4 }, st);
    assert.equal(sneakers.data.product.category, 'Shoes and sandals');
    const sneakerId = sneakers.data.product.id;
    const edited = await send('PATCH', `/api/seller/products/${sneakerId}`, { price: 9500, addQuantity: 6 }, st);
    assert.equal(edited.status, 200);
    assert.equal(edited.data.product.price, 9500);
    assert.equal(edited.data.product.stock, 10, 'restock adds to the existing quantity');
    assert.equal((await send('PATCH', `/api/seller/products/${sneakerId}`, { price: 5 }, st)).status, 400);
    assert.equal((await send('PATCH', `/api/seller/products/${sneakerId}`, { price: 9999, addQuantity: -1 }, st)).status, 400);
    const unchanged = (await send('GET', '/api/products')).data.find((item) => item.id === sneakerId);
    assert.equal(unchanged.price, 9500, 'a rejected edit changes nothing');
    assert.equal((await send('PATCH', `/api/seller/products/${sneakerId}`, { quantity: 3 }, st)).data.product.stock, 3);
    const sellerId = sneakers.data.product.userId;
    const shop = await send('GET', `/api/vendors/${sellerId}`);
    assert.equal(shop.status, 200);
    assert.ok(shop.data.products.some((item) => item.name === 'Sneakers'), 'shop lists its products');
    assert.equal(shop.data.rating.count, 0);
    assert.equal(shop.data.vendor.passwordHash, undefined);
    assert.equal(shop.data.vendor.email, undefined);
    assert.equal((await send('GET', '/api/vendors/does-not-exist')).status, 404);
    const shopPage = await fetch(`${base}/vendor.html?id=${sellerId}`).then((r) => r.text());
    assert.match(shopPage, /og:title" content="[^"]+ on Unishop"/, 'shop link has a share preview');
    assert.ok(!/<script>alert/.test(shopPage));
    // another account cannot edit this seller's product
    const intruder = await send('POST', '/api/auth/register', { name: 'Other Seller', username: 'otherseller1', email: 'other-seller1@example.com', password: 'marketplacepassword123', role: 'customer' });
    assert.equal((await send('PATCH', `/api/seller/products/${sneakerId}`, { price: 100 }, intruder.data.token)).status, 403);
    const base_ = { category: 'Fashion', description: 'A nice shirt for you.', price: 5000, image: '/uploads/shirt.jpg' };
    assert.equal((await send('POST', '/api/seller/products', { ...base_, name: 'Bad sizes', sizes: [{ label: 'S', quantity: -1 }] }, st)).status, 400);
    const shirt = (await send('POST', '/api/seller/products', { ...base_, name: 'Sized shirt', sizes: [{ label: 'S', quantity: 2 }, { label: 'M', quantity: 1 }] }, st)).data.product;
    assert.equal(shirt.stock, 3);
    const plain = (await send('POST', '/api/seller/products', { ...base_, name: 'Plain cap', quantity: 2 }, st)).data.product;
    assert.equal(plain.stock, 2);
    const buyer = await send('POST', '/api/auth/register', { name: 'Stock Buyer', username: `stb${stamp}`, email: `stb${stamp}@example.com`, password: 'marketplacepassword123', role: 'customer' });
    const bt = buyer.data.token;
    const pay = (items) => send('POST', '/api/payments/initialize', { email: `stb${stamp}@example.com`, customer: { name: 'Stock Buyer', phone: '08000000000' }, delivery: { address: '12 Test Street', neighbourhood: 'Ewet Housing' }, items }, bt);
    assert.equal((await pay([{ id: shirt.id, quantity: 1 }])).status, 400);
    assert.equal((await pay([{ id: shirt.id, size: 'S', quantity: 3 }])).status, 409);
    assert.equal((await pay([{ id: shirt.id, size: 'M', quantity: 1 }, { id: shirt.id, size: 'M', quantity: 1 }])).status, 409);
    const order = await pay([{ id: shirt.id, size: 'S', quantity: 1 }, { id: plain.id, quantity: 2 }]);
    assert.equal(order.status, 201);
    let list = (await send('GET', '/api/products')).data;
    assert.equal(list.find((p) => p.id === shirt.id).stock, 3, 'unpaid order must not reduce stock');
    await send('GET', `/api/payments/verify/${order.data.reference}`);
    await send('GET', `/api/payments/verify/${order.data.reference}`);
    list = (await send('GET', '/api/products')).data;
    const afterShirt = list.find((p) => p.id === shirt.id);
    assert.equal(afterShirt.stock, 2);
    assert.deepEqual(afterShirt.sizes, [{ label: 'S', quantity: 1 }, { label: 'M', quantity: 1 }]);
    assert.equal(list.find((p) => p.id === plain.id).stock, 0);
    assert.equal((await pay([{ id: plain.id, quantity: 1 }])).status, 409);
    assert.equal(afterShirt.rating, null);
    assert.equal((await send('POST', `/api/products/${shirt.id}/reviews`, { rating: 4 }, bt)).status, 201);
    assert.equal((await send('POST', `/api/products/${shirt.id}/reviews`, { rating: 5 }, bt)).status, 409);
    assert.equal((await send('GET', '/api/products')).data.find((p) => p.id === shirt.id).rating, '4.0');
    assert.equal((await send('PATCH', `/api/seller/products/${plain.id}/stock`, { quantity: 10 }, st)).data.product.stock, 10);
    console.log('stock smoke test passed');
    server.close(); process.exit(0);
  } catch (error) { console.error(error); server.close(); process.exit(1); }
});
