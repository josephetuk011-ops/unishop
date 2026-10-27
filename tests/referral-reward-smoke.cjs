const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

process.env.NODE_ENV = 'test';
process.env.PAYSTACK_SECRET_KEY = 'sk_test_mock_only';
process.env.JWT_SECRET = 'local-integration-signing-secret';
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'unishop-referral-'));
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
    const reg = (username, extra = {}) => send('POST', '/api/auth/register', { name: 'Ref Person', username, email: `${username}@example.com`, password: 'marketplacepassword123', role: 'customer', ...extra });
    const a = await reg(`rewa${stamp}`);
    const code = (await send('GET', '/api/me/referral', null, a.data.token)).data.code;
    const b = await reg(`rewb${stamp}`, { ref: code });
    const info = (await send('GET', '/api/me/referral', null, b.data.token)).data;
    assert.equal(info.welcomeAvailable, true);
    const pay = (token, mail) => send('POST', '/api/payments/initialize', { email: mail, customer: { name: 'Ref Person', phone: '08000000000' }, delivery: { address: '12 Test Street', neighbourhood: 'Ewet Housing' }, items: [{ id: 'linen-set', quantity: 1 }] }, token);
    const plain = await pay(a.data.token, 'a@example.com');
    const price = plain.data.order.totalNaira;
    assert.equal(plain.data.order.rewardDiscountNaira, 0);
    const first = await pay(b.data.token, 'b@example.com');
    assert.equal(first.status, 201);
    assert.equal(first.data.order.rewardDiscountNaira, 100);
    assert.equal(first.data.order.totalNaira, price - 100);
    assert.equal(amount, (price - 100) * 100);
    await send('GET', `/api/payments/verify/${first.data.reference}`);
    const bAfter = (await send('GET', '/api/me/referral', null, b.data.token)).data;
    assert.equal(bAfter.welcomeAvailable, false);
    const aAfter = (await send('GET', '/api/me/referral', null, a.data.token)).data;
    assert.equal(aAfter.credits, 1);
    const second = await pay(b.data.token, 'b@example.com');
    assert.equal(second.data.order.rewardDiscountNaira, 0);
    const credited = await pay(a.data.token, 'a@example.com');
    assert.equal(credited.data.order.rewardDiscountNaira, 100);
    await send('GET', `/api/payments/verify/${credited.data.reference}`);
    assert.equal((await send('GET', '/api/me/referral', null, a.data.token)).data.credits, 0);
    console.log('referral reward smoke test passed');
    server.close(); process.exit(0);
  } catch (error) { console.error(error); server.close(); process.exit(1); }
});
