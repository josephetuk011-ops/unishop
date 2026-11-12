const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

process.env.NODE_ENV = 'test';
process.env.RESEND_API_KEY = 're_test';
process.env.JWT_SECRET = 'local-integration-signing-secret';
process.env.PUBLIC_APP_URL = 'https://shop.example';
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'unishop-forgot-'));
process.env.MARKETPLACE_DATA_PATH = path.join(dir, 'marketplace.json');
process.env.UPLOADS_DIRECTORY = path.join(dir, 'uploads');
const nativeFetch = global.fetch;
const sent = [];
global.fetch = async (url, options = {}) => {
  if (String(url).startsWith('https://api.resend.com/')) { sent.push(JSON.parse(options.body)); return new Response('{}', { status: 200 }); }
  return nativeFetch(url, options);
};
require('ts-node/register');
const app = require('../src/app').default;
const server = app.listen(0, async () => {
  const base = `http://127.0.0.1:${server.address().port}`;
  const send = async (method, route, body) => {
    const r = await nativeFetch(base + route, { method, headers: { 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
    return { status: r.status, data: await r.json() };
  };
  try {
    const stamp = Date.now();
    const username = `forgot${stamp}`;
    const reg = await send('POST', '/api/auth/register', { name: 'Forgot Person', username, email: `${username}@example.com`, password: 'oldpassword12345', role: 'customer' });
    assert.equal(reg.status, 201);
    const unknown = await send('POST', '/api/auth/forgot-password', { identifier: 'nobody-here@example.com' });
    const known = await send('POST', '/api/auth/forgot-password', { identifier: `${username}@example.com` });
    assert.equal(unknown.status, 200);
    assert.deepEqual(unknown.data, known.data, 'the answer does not reveal whether an account exists');
    await new Promise((resolve) => setTimeout(resolve, 150));
    const mails = sent.filter((mail) => mail.to[0] === `${username}@example.com`);
    assert.equal(mails.length, 1);
    assert.equal(sent.filter((mail) => /nobody-here/.test(mail.to[0])).length, 0);
    const token = (mails[0].text.match(/reset=([a-f0-9]{64})/) || [])[1];
    assert.ok(token, 'the email carries a reset link');
    assert.ok(mails[0].text.includes('https://shop.example/?reset='));
    assert.equal((await send('POST', '/api/auth/reset-password', { token, password: 'short' })).status, 400);
    assert.equal((await send('POST', '/api/auth/reset-password', { token: 'a'.repeat(64), password: 'brandnewpassword1' })).status, 400);
    const done = await send('POST', '/api/auth/reset-password', { token, password: 'brandnewpassword1' });
    assert.equal(done.status, 200);
    assert.equal(done.data.username, username);
    assert.equal((await send('POST', '/api/auth/reset-password', { token, password: 'anotherpassword12' })).status, 400, 'a link works only once');
    assert.equal((await send('POST', '/api/auth/login', { username, password: 'oldpassword12345' })).status, 401);
    assert.equal((await send('POST', '/api/auth/login', { username, password: 'brandnewpassword1' })).status, 200);
    // lookup by username works too
    await send('POST', '/api/auth/forgot-password', { identifier: username });
    await new Promise((resolve) => setTimeout(resolve, 150));
    assert.equal(sent.filter((mail) => mail.to[0] === `${username}@example.com`).length, 2);
    console.log('forgot password smoke test passed');
    server.close(); process.exit(0);
  } catch (error) { console.error(error); server.close(); process.exit(1); }
});
