const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

process.env.NODE_ENV = 'test';
process.env.PAYSTACK_SECRET_KEY = 'sk_test_mock_only';
process.env.JWT_SECRET = 'local-integration-signing-secret';
process.env.ADMIN_PASSWORD = 'admin-test-password-123';
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'unishop-negotiation-'));
process.env.MARKETPLACE_DATA_PATH = path.join(dir, 'marketplace.json');
process.env.UPLOADS_DIRECTORY = path.join(dir, 'uploads');

require('ts-node/register');
const { detectContactInfo } = require('../src/chatGuard');
const caught = ['acct 0123456789 gtb', '0 1 2 3 4 5 6 7 8 9', 'zero one two three four five six seven eight nine', 'send to 2012-345-678 zenith', '3012345678'];
const allowed = ['call me on 08031234567', 'my number is +234 803 123 4567', '080-3123-4567', 'mail me joe@gmail.com', 'I need 3 chairs and 2 tables for 5 days', 'Can you do 25,000 naira?', 'Price is 1,500,000 for the whole job', 'Come at 4pm on 12/11/2026', 'one or two hours is fine'];
caught.forEach((text) => assert.ok(detectContactInfo(text).found, `should catch: ${text}`));
allowed.forEach((text) => assert.ok(!detectContactInfo(text).found, `should allow: ${text}`));

const app = require('../src/app').default;
const server = app.listen(0, async () => {
  const base = `http://127.0.0.1:${server.address().port}`;
  const send = async (method, route, body, token) => {
    const r = await fetch(base + route, { method, headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
    return { status: r.status, data: await r.json() };
  };
  const password = 'marketplacepassword123';
  try {
    const stamp = Date.now();
    const provider = await send('POST', '/api/auth/register', { name: 'Pro Vider', username: `pro${stamp}`, email: `pro${stamp}@example.com`, password, role: 'provider', acceptTerms: true, businessName: 'Pro Studio', niche: 'Barbing' });
    await send('PATCH', '/api/profile', { name: 'Pro Vider', businessName: 'Pro Studio', position: 'Owner', placeOfOperation: 'Uyo', aboutMe: 'Barbing appointments and home visits for customers across Uyo.', profileImage: '/uploads/p.jpg', ceoImage: '/uploads/c.jpg' }, provider.data.token);
    const listing = (await send('POST', '/api/provider/listings', { niche: 'Barbing', title: 'Home barbing', description: 'Barbing with home visits in Uyo.', portfolio: ['/uploads/w.jpg'] }, provider.data.token)).data.listing;
    assert.equal(listing.price, null);
    const services = (await send('GET', '/api/services')).data;
    assert.equal(services.find((item) => item.id === listing.id).online, true, 'provider is online after using the API');
    const vendor = await send('POST', '/api/auth/register', { name: 'Ven Dor', username: `ven${stamp}`, email: `ven${stamp}@example.com`, password, role: 'seller', acceptTerms: true, businessName: 'Ven Shop' });
    const online = await send('GET', '/api/online-providers', undefined, vendor.data.token);
    assert.ok(online.data.some((item) => item.name === 'Pro Studio'), 'vendors can see online providers');
    const customer = await send('POST', '/api/auth/register', { name: 'Cus Tomer', username: `cus${stamp}`, email: `cus${stamp}@example.com`, password, role: 'customer' });
    const stranger = await send('POST', '/api/auth/register', { name: 'Stranger', username: `str${stamp}`, email: `str${stamp}@example.com`, password, role: 'customer' });
    const ct = customer.data.token, pt = provider.data.token;

    assert.equal((await send('POST', '/api/chats', { listingId: listing.id }, pt)).status, 403, 'providers cannot start a chat as customers');
    const chat = (await send('POST', '/api/chats', { listingId: listing.id }, ct)).data.conversation;
    assert.equal((await send('GET', `/api/chats/${chat.id}`, undefined, stranger.data.token)).status, 404, 'outsiders cannot read a chat');
    assert.equal((await send('POST', `/api/chats/${chat.id}/book`, { neighbourhood: 'Ewet', time: 'Tomorrow' }, ct)).status, 400, 'no payment before an offer');
    assert.equal((await send('POST', `/api/chats/${chat.id}/messages`, { text: 'How much for a haircut?' }, ct)).status, 201);
    assert.equal((await send('POST', `/api/chats/${chat.id}/offer`, { amount: 5000 }, ct)).status, 403, 'only the provider sends a price');
    assert.equal((await send('POST', `/api/chats/${chat.id}/messages`, { text: 'It is a fair deal', media: { kind: 'image', url: 'https://evil.example/x.jpg' } }, pt)).status, 400, 'foreign media rejected');
    assert.equal((await send('POST', `/api/chats/${chat.id}/messages`, { text: 'Sure, here is my work', media: { kind: 'image', url: '/uploads/work.jpg' } }, pt)).status, 201);
    assert.equal((await send('POST', `/api/chats/${chat.id}/offer`, { amount: 6000 }, pt)).status, 201);
    const inbox = (await send('GET', '/api/chats', undefined, pt)).data;
    assert.equal(inbox.conversations.length, 1);
    assert.ok(inbox.unread >= 1);
    const thread = (await send('GET', `/api/chats/${chat.id}`, undefined, ct)).data;
    assert.equal(thread.conversation.offerNaira, 6000);
    assert.equal(thread.messages.filter((m) => m.kind === 'image').length, 1);
    assert.match(thread.warning, /suspended automatically/);
    const booking = await send('POST', `/api/chats/${chat.id}/book`, { neighbourhood: 'Ewet', time: 'Tomorrow' }, ct);
    assert.equal(booking.status, 201);
    assert.equal(booking.data.booking.amountNaira, 6000);

    // Sharing contact details suspends the sender, hides the message from the other side, and keeps it for admin.
    const bad = await send('POST', `/api/chats/${chat.id}/messages`, { text: 'Pay me directly, account 0123456789 GTBank' }, ct);
    assert.equal(bad.status, 403);
    assert.equal(bad.data.suspended, true);
    assert.equal((await send('GET', '/api/chats', undefined, ct)).status, 401, 'the suspended customer is signed out');
    assert.ok(!JSON.stringify((await send('GET', `/api/chats/${chat.id}`, undefined, pt)).data).includes('0123456789'), 'the provider never sees the blocked message');
    const admin = (await send('POST', '/api/admin/login', { password: process.env.ADMIN_PASSWORD })).data.token;
    const list = (await send('GET', '/api/admin/records?kind=chats', undefined, admin)).data;
    assert.equal(list.records[0].violations, 1);
    const full = (await send('GET', `/api/admin/chats/${chat.id}`, undefined, admin)).data;
    assert.ok(full.messages.some((m) => m.violation && m.text.includes('0123456789')), 'admin sees the blocked message');
    const restored = await send('PATCH', `/api/admin/users/${customer.data.user.id}/suspension`, { suspended: false }, admin);
    assert.equal(restored.status, 200, 'admin can restore a customer');
    assert.equal((await send('GET', '/api/chats', undefined, ct)).status, 200);

    assert.equal((await send('POST', `/api/chats/${chat.id}/end`, {}, pt)).data.conversation.status, 'ended');
    assert.equal((await send('POST', `/api/chats/${chat.id}/messages`, { text: 'hello again' }, ct)).status, 409);
    console.log('negotiation smoke passed');
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  } finally {
    server.close();
    setTimeout(() => process.exit(process.exitCode || 0), 100);
  }
});
