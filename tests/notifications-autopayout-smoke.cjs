const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

process.env.NODE_ENV = 'test';
process.env.NIN_VERIFICATION_ENABLED = 'true';
process.env.DISPATCH_SIGNIN_ENABLED = 'true';
process.env.PAYSTACK_SECRET_KEY = 'sk_test_mock_only';
process.env.JWT_SECRET = 'local-integration-signing-secret';
process.env.RESEND_API_KEY = 're_mock';
process.env.ADMIN_EMAIL = 'admin@example.com';
process.env.ADMIN_PASSWORD = 'admin-password-for-tests';
process.env.ADMIN_NTFY_TOPIC = 'unishop-admin-test';
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'unishop-notify-'));
process.env.MARKETPLACE_DATA_PATH = path.join(dir, 'marketplace.json');
process.env.UPLOADS_DIRECTORY = path.join(dir, 'uploads');

const nativeFetch = global.fetch;
const emails = [];
const phoneAlerts = [];
const transfers = [];
let amount = 0;
const ok = (data) => new Response(JSON.stringify({ status: true, data }), { status: 200 });
global.fetch = async (url, options = {}) => {
  const target = String(url);
  if (target.startsWith('https://api.resend.com/')) { emails.push(JSON.parse(options.body)); return new Response('{}', { status: 200 }); }
  if (target.startsWith('https://ntfy.sh/')) { phoneAlerts.push(options.body); return new Response('{}', { status: 200 }); }
  if (!target.startsWith('https://api.paystack.co/')) return nativeFetch(url, options);
  if (target.includes('/bank/resolve?')) return ok({ account_name: 'Test Recipient', bank_name: 'Test Bank' });
  if (target.endsWith('/transferrecipient')) return ok({ recipient_code: 'RCP_test123', details: { bank_name: 'Test Bank' } });
  if (target.endsWith('/transfer')) { const body = JSON.parse(options.body); transfers.push(body); return ok({ reference: body.reference, status: 'success', transfer_code: 'TRF_1' }); }
  if (target.endsWith('transaction/initialize')) { const body = JSON.parse(options.body); amount = body.amount; return ok({ reference: body.reference, authorization_url: 'https://checkout.paystack.com/mock' }); }
  return ok({ status: 'success', amount, currency: 'NGN', customer: { email: 'buyer@example.com' } });
};

require('ts-node/register');
const app = require('../src/app').default;
const server = app.listen(0, async () => {
  const base = `http://127.0.0.1:${server.address().port}`;
  const send = async (method, route, body, token) => {
    const result = await nativeFetch(base + route, { method, headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
    return { status: result.status, data: await result.json() };
  };
  const settle = () => new Promise((resolve) => setTimeout(resolve, 200));
  const password = 'A-secure-test-password';
  try {
    const provider = await send('POST', '/api/auth/register', { name: 'Pro Vider', username: 'notifprovider', email: 'provider@example.com', password, role: 'provider', acceptTerms: true, businessName: 'Notif Barbing', niche: 'Barbing' });
    await send('POST', '/api/profile/nin', { nin: '12345678903' }, provider.data.token);
    await send('PATCH', '/api/profile', { name: 'Pro Vider', businessName: 'Notif Barbing', position: 'Owner', phone: '08030000000', placeOfOperation: 'Uyo', aboutMe: 'Barbing appointments and home visits for customers across Uyo.', profileImage: '/uploads/p.jpg', ceoImage: '/uploads/ceo.jpg' }, provider.data.token);
    const listing = await send('POST', '/api/provider/listings', { niche: 'Barbing', title: 'Fades', description: 'Barbing service with home visits in Uyo.', portfolio: ['/uploads/x.jpg'] }, provider.data.token);
    const customer = await send('POST', '/api/auth/register', { name: 'Cus Tomer', username: 'notifcustomer', email: 'buyer@example.com', password, role: 'customer' });

    // Provider saves a bank account: a Paystack recipient code is created and stored.
    const account = await send('POST', '/api/payout/account', { accountNumber: '0123456789', bankCode: '058' }, provider.data.token);
    assert.equal(account.status, 201);

    // Booking request notifies the provider and the admin.
    const negotiate = async (customerToken, providerToken, listingId, amount, where = { neighbourhood: 'Ewet', time: 'Tomorrow' }) => {
      const chat = await send('POST', '/api/chats', { listingId }, customerToken);
      assert.equal(chat.status, 201);
      assert.equal((await send('POST', `/api/chats/${chat.data.conversation.id}/messages`, { text: 'Hello, how much for this service?' }, customerToken)).status, 201);
      assert.equal((await send('POST', `/api/chats/${chat.data.conversation.id}/offer`, { amount }, providerToken)).status, 201);
      return send('POST', `/api/chats/${chat.data.conversation.id}/book`, where, customerToken);
    };
    const booking = await negotiate(customer.data.token, provider.data.token, listing.data.listing.id, 18000);
    assert.equal(booking.status, 201);
    await settle();
    let inbox = await send('GET', '/api/notifications', undefined, provider.data.token);
    assert.equal(inbox.data.notifications[0].title, 'Customer agreed to your price');
    assert(inbox.data.notifications.some((item) => /New customer message/.test(item.title)), 'first chat message notifies the provider');
    assert(emails.some((mail) => mail.to[0] === 'provider@example.com' && /dashboard\.html#messages\?chat=/.test(`${mail.html}${mail.text}`)), 'the email carries the chat link');
    assert(emails.some((mail) => mail.to[0] === 'provider@example.com'));
    assert(emails.some((mail) => mail.to[0] === 'admin@example.com'));
    assert(phoneAlerts.length >= 1);

    // Payment notifies again.
    const pay = await send('POST', '/api/payments/initialize', { bookingId: booking.data.booking.id, customer: { phone: '08051112222' } }, customer.data.token);
    await send('GET', `/api/payments/verify/${pay.data.reference}`);
    await settle();
    inbox = await send('GET', '/api/notifications', undefined, provider.data.token);
    assert(inbox.data.notifications.some((item) => item.title === 'New paid booking'));
    assert.equal(transfers.length, 0, 'nothing is transferred before the customer confirms');

    // Confirmation releases the escrowed money straight to the provider recipient.
    await send('PATCH', `/api/provider/bookings/${booking.data.booking.id}`, { status: 'completed' }, provider.data.token);
    assert.equal((await send('POST', `/api/bookings/${booking.data.booking.id}/confirm-completion`, undefined, customer.data.token)).status, 200);
    await settle();
    assert.equal(transfers.length, 1);
    assert.equal(transfers[0].recipient, 'RCP_test123');
    assert.equal(transfers[0].amount, 1570000);
    const dashboard = await send('GET', '/api/dashboard', undefined, provider.data.token);
    assert.equal(dashboard.data.availableBalanceNaira, 0);
    assert.equal(dashboard.data.payouts[0].status, 'success');
    inbox = await send('GET', '/api/notifications', undefined, provider.data.token);
    assert(inbox.data.notifications.some((item) => item.title === 'Payment on its way'));

    assert.equal((await send('POST', '/api/payouts/request-release', undefined, provider.data.token)).status, 409, 'nothing to release after an automatic payout');
    // Admin can read the provider's phone and full bank details from the bookings list.
    const adminLogin = await send('POST', '/api/admin/login', { password: 'admin-password-for-tests' });
    const adminBookings = await send('GET', '/api/admin/records?kind=bookings', undefined, adminLogin.data.token);
    const seen = adminBookings.data.records[0].provider;
    assert.equal(seen.phone, '08030000000');
    assert.equal(seen.payout.accountNumber, '0123456789');
    assert.equal(adminBookings.data.records[0].customerPhone, '08051112222');

    // Push subscription validation.
    assert.equal((await send('POST', '/api/notifications/subscribe', { subscription: { endpoint: 'https://push.example/1', keys: { p256dh: 'a', auth: 'b' } } }, provider.data.token)).status, 503);
    console.log(JSON.stringify({ notifications: 'ok', emails: emails.length, phoneAlerts: phoneAlerts.length, autoTransferKobo: transfers[0].amount }));
  } catch (error) { console.error(error); process.exitCode = 1; }
  finally { server.close(); }
});
