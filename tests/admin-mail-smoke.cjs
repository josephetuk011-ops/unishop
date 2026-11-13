const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

process.env.NODE_ENV = 'test';
process.env.RESEND_API_KEY = 're_test';
process.env.JWT_SECRET = 'local-integration-signing-secret';
process.env.ADMIN_PASSWORD = 'admin-password-for-tests';
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'unishop-adminmail-'));
process.env.MARKETPLACE_DATA_PATH = path.join(dir, 'marketplace.json');
process.env.UPLOADS_DIRECTORY = path.join(dir, 'uploads');
const nativeFetch = global.fetch;
const sent = [];
global.fetch = async (url, options = {}) => {
  if (String(url).startsWith('https://api.resend.com/')) {
    const body = JSON.parse(options.body);
    if (body.to[0].startsWith('bad@')) return new Response('{}', { status: 500 });
    sent.push(body);
    return new Response('{}', { status: 200 });
  }
  return nativeFetch(url, options);
};
require('ts-node/register');
const app = require('../src/app').default;
const server = app.listen(0, async () => {
  const base = `http://127.0.0.1:${server.address().port}`;
  const call = async (method, route, body, token) => {
    const r = await nativeFetch(base + route, { method, headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
    return { status: r.status, data: await r.json() };
  };
  try {
    const stamp = Date.now();
    const ids = [];
    for (const role of ['customer', 'seller']) {
      const username = `${role}${stamp}`;
      const reg = await call('POST', '/api/auth/register', { name: `Mail ${role}`, username, email: `${username}@example.com`, password: 'longpassword123', role, acceptTerms: true, ...(role === 'seller' ? { businessName: 'Mail Shop' } : {}) });
      assert.ok([200, 201].includes(reg.status), JSON.stringify(reg.data));
      ids.push({ id: reg.data.user.id, email: `${username}@example.com` });
    }
    assert.equal((await call('GET', '/api/admin/mail/recipients')).status, 401, 'needs admin');
    assert.ok((await call('POST', '/api/admin/mail', { subject: 'Hi there', message: 'Hello', userIds: [ids[0].id] }, 'not-a-token')).status >= 400);
    const login = await call('POST', '/api/admin/login', { password: 'admin-password-for-tests' });
    const token = login.data.token;
    const list = await call('GET', '/api/admin/mail/recipients', null, token);
    assert.equal(list.status, 200);
    assert.ok(list.data.recipients.some((person) => person.email === ids[0].email && person.role === 'customer'));
    assert.ok(list.data.recipients.every((person) => !('passwordHash' in person)));
    assert.equal((await call('POST', '/api/admin/mail', { subject: 'Hi there', message: 'Hello', userIds: [] }, token)).status, 400, 'needs a recipient');
    assert.equal((await call('POST', '/api/admin/mail', { subject: 'x', message: 'Hello', userIds: [ids[0].id] }, token)).status, 400, 'subject too short');
    const ok = await call('POST', '/api/admin/mail', { subject: 'Holiday notice', message: 'Hello <b>team</b>\nLine two\n\nSecond paragraph', userIds: [ids[0].id, ids[1].id, ids[0].id, 'nope'], extraEmails: ['outside@example.com', 'not-an-email', 'bad@example.com'] }, token);
    assert.equal(ok.status, 200, JSON.stringify(ok.data));
    assert.equal(ok.data.total, 4, 'deduped, invalid dropped');
    assert.equal(ok.data.sent, 3);
    assert.deepEqual(ok.data.failed, ['bad@example.com']);
    const mail = sent.find((item) => item.to[0] === ids[0].email);
    assert.equal(mail.subject, 'Holiday notice');
    assert.ok(mail.html.includes('&lt;b&gt;team&lt;/b&gt;<br>Line two'), 'message is escaped and keeps line breaks');
    assert.ok(mail.html.includes('<p>Second paragraph</p>'));
    assert.equal(sent.filter((item) => item.to[0] === ids[0].email).length, 1, 'one email per person');
    sent.length = 0;
    const toSellers = await call('POST', '/api/admin/mail', { subject: 'Sellers only', message: 'Hello sellers', audience: 'seller' }, token);
    assert.equal(toSellers.status, 200, JSON.stringify(toSellers.data));
    assert.ok(sent.length >= 1 && sent.some((m) => m.to[0] === ids[1].email) && !sent.some((m) => m.to[0] === ids[0].email), 'only sellers');
    sent.length = 0;
    const toAll = await call('POST', '/api/admin/mail', { subject: 'Everyone', message: 'Hello all', audience: 'all' }, token);
    assert.equal(toAll.status, 200);
    assert.ok(sent.some((m) => m.to[0] === ids[0].email) && sent.some((m) => m.to[0] === ids[1].email), 'everyone');
    console.log('admin mail smoke test passed');
    server.close(); process.exit(0);
  } catch (error) { console.error(error); server.close(); process.exit(1); }
});
