const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');

process.env.NODE_ENV = 'test';
process.env.PAYSTACK_SECRET_KEY = 'sk_test_mock_only';
process.env.JWT_SECRET = 'local-integration-signing-secret';
const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'unishop-payment-flow-'));
process.env.MARKETPLACE_DATA_PATH = path.join(temporaryDirectory, 'marketplace.json');
process.env.UPLOADS_DIRECTORY = path.join(temporaryDirectory, 'uploads');

const nativeFetch = global.fetch;
let initializedAmount = 0;
global.fetch = async (url, options = {}) => {
  if (!String(url).startsWith('https://api.paystack.co/')) return nativeFetch(url, options);
  if (String(url).includes('/bank?currency=NGN')) {
    return new Response(JSON.stringify({ status: true, data: [{ name: 'Test Bank', code: '058', active: true }] }), { status: 200 });
  }
  if (String(url).includes('/bank/resolve?')) {
    return new Response(JSON.stringify({ status: true, data: { account_name: 'Test Recipient', bank_name: 'Test Bank' } }), { status: 200 });
  }
  if (String(url).endsWith('/transferrecipient')) {
    return new Response(JSON.stringify({ status: true, data: { recipient_code: 'RCP_test123', details: { bank_name: 'Test Bank' } } }), { status: 200 });
  }
  if (String(url).endsWith('/transfer')) {
    const body = JSON.parse(options.body);
    assert.equal(body.source, 'balance');
    return new Response(JSON.stringify({ status: true, data: { reference: body.reference, status: 'success', transfer_code: 'TRF_test123' } }), { status: 200 });
  }
  if (String(url).endsWith('transaction/initialize')) {
    const body = JSON.parse(options.body);
    initializedAmount = body.amount;
    return new Response(JSON.stringify({
      status: true,
      data: { reference: body.reference, authorization_url: 'https://checkout.paystack.com/mock', access_code: 'mock-access' }
    }), { status: 200 });
  }
  return new Response(JSON.stringify({
    status: true,
    data: { status: 'success', amount: initializedAmount, currency: 'NGN', customer: { email: 'buyer@example.com' } }
  }), { status: 200 });
};

require('ts-node/register');
const app = require('../src/app').default;
const server = app.listen(0, async () => {
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const send = async (method, route, body, token) => {
    const result = await nativeFetch(`${baseUrl}${route}`, {
      method,
      headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
      body: body ? JSON.stringify(body) : undefined
    });
    return { status: result.status, data: await result.json() };
  };

  try {
    const niches = await send('GET', '/api/services/niches');
    assert.equal(niches.data.length, 14);
    const invalidProvider = await send('POST', '/api/auth/register', {
      name: 'Invalid Niche', username: 'invalidniche', email: 'buyer@example.com', password: 'A-secure-test-password', role: 'provider', businessName: 'Bad listing', niche: 'Car washing'
    });
    assert.equal(invalidProvider.status, 400);

    const provider = await send('POST', '/api/auth/register', {
      name: 'Test Provider', username: 'uyoprovider', email: 'buyer@example.com', password: 'A-secure-test-password', role: 'provider', businessName: 'Test Barbing Studio', niche: 'Barbing'
    });
    assert.equal(provider.status, 201);
    const providerLogin = await send('POST', '/api/auth/login', { username: 'uyoprovider', password: 'A-secure-test-password' });
    assert.equal(providerLogin.data.user.role, 'provider');
    const listing = await send('POST', '/api/provider/listings', {
      niche: 'Barbing', title: 'Uyo fades', description: 'Barbing service with home visits in Uyo.', price: 18000, portfolio: ['/uploads/test-portfolio.jpg']
    }, provider.data.token);
    assert.equal(listing.status, 201);

    const registration = await send('POST', '/api/auth/register', {
      name: 'Test Customer', username: 'uyocustomer', email: 'buyer@example.com', password: 'A-secure-test-password', role: 'customer'
    });
    assert.equal(registration.status, 201);
    const customerLogin = await send('POST', '/api/auth/login', { username: 'uyocustomer', password: 'A-secure-test-password' });
    assert.equal(customerLogin.data.user.role, 'customer');

    const booking = await send('POST', '/api/bookings', {
      providerId: listing.data.listing.id, neighbourhood: 'Ewet Housing', time: 'Tomorrow morning'
    }, registration.data.token);
    assert.equal(booking.status, 201);

    const seller = await send('POST', '/api/auth/register', {
      name: 'Test Seller', username: 'uyoseller', email: 'buyer@example.com', password: 'A-secure-test-password', role: 'seller', businessName: 'Test Uyo Store'
    });
    assert.equal(seller.status, 201);
    assert.equal((await send('POST', '/api/auth/login', { username: 'uyoseller', password: 'A-secure-test-password' })).data.user.role, 'seller');
    const uploadMedia = async (route, field, filename, mimeType, bytes, token, fields = {}) => {
      const form = new FormData();
      Object.entries(fields).forEach(([key, value]) => form.append(key, String(value)));
      form.append(field, new Blob([bytes], { type: mimeType }), filename);
      const result = await nativeFetch(`${baseUrl}${route}`, { method: 'POST', headers: { authorization: `Bearer ${token}` }, body: form });
      return { status: result.status, data: await result.json() };
    };
    const longProviderVideo = await uploadMedia('/api/uploads/short-video', 'video', 'long.mp4', 'video/mp4', Buffer.from('mock-mp4-content'), provider.data.token, { duration: 31 });
    assert.equal(longProviderVideo.status, 400);
    const providerVideo = await uploadMedia('/api/uploads/short-video', 'video', 'service.mp4', 'video/mp4', Buffer.from('mock-mp4-content'), provider.data.token, { duration: 30 });
    assert.equal(providerVideo.status, 201);
    const shortService = await send('POST', '/api/provider/listings', {
      niche: 'Barbing', title: 'Short video barbing service', description: 'A barbing service listing with a short video.', price: 18000, portfolio: ['/uploads/test-portfolio.jpg'], video: providerVideo.data.video, videoDuration: providerVideo.data.videoDuration
    }, provider.data.token);
    assert.equal(shortService.status, 201);
    assert.equal(shortService.data.listing.video, providerVideo.data.video);
    const uploadedImage = await uploadMedia('/api/uploads/portfolio', 'images', 'item.jpg', 'image/jpeg', Buffer.from([0xff, 0xd8, 0xff, 0xd9]), seller.data.token);
    assert.equal(uploadedImage.status, 201);
    const longProductVideo = await uploadMedia('/api/uploads/short-video', 'video', 'long.mp4', 'video/mp4', Buffer.from('mock-mp4-content'), seller.data.token, { duration: 31 });
    assert.equal(longProductVideo.status, 400);
    const uploadedVideo = await uploadMedia('/api/uploads/short-video', 'video', 'item.mp4', 'video/mp4', Buffer.from('mock-mp4-content'), seller.data.token, { duration: 12 });
    assert.equal(uploadedVideo.status, 201);
    const sellerProduct = await send('POST', '/api/seller/products', {
      name: 'Locally made tote', category: 'Fashion', description: 'A locally made woven market tote.', price: 12345, image: uploadedImage.data.images[0], video: uploadedVideo.data.video, videoDuration: uploadedVideo.data.videoDuration
    }, seller.data.token);
    assert.equal(sellerProduct.status, 201);
    assert.equal(sellerProduct.data.product.video, uploadedVideo.data.video);

    const initialized = await send('POST', '/api/payments/initialize', {
      email: 'buyer@example.com',
      customer: { name: 'Test Customer', phone: '08000000000' },
      delivery: { address: '12 Test Street', neighbourhood: 'Ewet Housing' },
      items: [{ id: 'linen-set', quantity: 1, price: 1 }, { id: sellerProduct.data.product.id, quantity: 1, price: 1 }]
    }, registration.data.token);
    assert.equal(initialized.status, 201);
    assert.equal(initializedAmount, 4134500);
    assert.equal(initialized.data.authorizationUrl, 'https://checkout.paystack.com/mock');

    const verified = await send('GET', `/api/payments/verify/${initialized.data.reference}`);
    assert.equal(verified.status, 200);
    assert.equal(verified.data.order.paymentStatus, 'paid');
    assert.equal(verified.data.order.orderStatus, 'confirmed');
    assert.equal(verified.data.order.address, undefined);
    assert.equal(verified.data.order.email, undefined);
    assert.equal(verified.data.order.authorizationUrl, undefined);
    assert.equal(verified.data.order.userId, undefined);
    assert.equal(verified.data.order.settlementStatus, 'held');
    const verifiedAgain = await send('GET', `/api/payments/verify/${initialized.data.reference}`);
    assert.equal(verifiedAgain.data.order.paymentStatus, 'paid');

    const servicePayment = await send('POST', '/api/payments/initialize', { bookingId: booking.data.booking.id }, registration.data.token);
    assert.equal(servicePayment.status, 201);
    assert.equal(initializedAmount, 1850000);
    const serviceVerified = await send('GET', `/api/payments/verify/${servicePayment.data.reference}`);
    assert.equal(serviceVerified.data.order.type, 'service');
    assert.equal(serviceVerified.data.order.paymentStatus, 'paid');
    assert.equal(serviceVerified.data.order.totalNaira, 18500);

    const acceptedBooking = await send('PATCH', `/api/provider/bookings/${booking.data.booking.id}`, { status: 'accepted' }, provider.data.token);
    assert.equal(acceptedBooking.status, 200);
    const completedBooking = await send('PATCH', `/api/provider/bookings/${booking.data.booking.id}`, { status: 'completed' }, provider.data.token);
    assert.equal(completedBooking.status, 200);
    assert.equal((await send('GET', '/api/dashboard', undefined, provider.data.token)).data.availableBalanceNaira, 0);
    const confirmedBooking = await send('POST', `/api/bookings/${booking.data.booking.id}/confirm-completion`, undefined, registration.data.token);
    assert.equal(confirmedBooking.status, 200);
    assert.equal((await send('GET', '/api/dashboard', undefined, provider.data.token)).data.availableBalanceNaira, 15700);
    assert.equal((await send('POST', `/api/bookings/${booking.data.booking.id}/confirm-completion`, undefined, registration.data.token)).status, 409);
    const review = await send('POST', `/api/services/${listing.data.listing.id}/reviews`, { rating: 5, comment: 'Clean, careful service.' }, registration.data.token);
    assert.equal(review.status, 201);
    const providerDashboard = await send('GET', '/api/dashboard', undefined, provider.data.token);
    assert.equal(providerDashboard.data.metrics.grossEarnings, 18000);
    assert.equal(providerDashboard.data.reviews.length, 1);

    const rider = await send('POST', '/api/auth/register', {
      name: 'Test Rider', username: 'uyorider', email: 'buyer@example.com', password: 'A-secure-test-password', role: 'dispatch', businessName: 'Ewet Housing'
    });
    assert.equal(rider.status, 201);
    assert.equal((await send('POST', '/api/auth/login', { username: 'uyorider', password: 'A-secure-test-password' })).data.user.role, 'dispatch');
    assert.equal((await send('POST', '/api/auth/login', { username: 'missing-user', password: 'A-secure-test-password' })).status, 401);
    const riderDashboard = await send('GET', '/api/dashboard', undefined, rider.data.token);
    const deliveryReference = initialized.data.reference;
    assert.equal(riderDashboard.data.metrics.availableJobs, 1);
    assert.equal(riderDashboard.data.jobs[0].address, undefined);
    assert.equal((await send('PATCH', `/api/dispatch/jobs/${deliveryReference}`, { status: 'accept' }, rider.data.token)).status, 200);
    const claimedRiderDashboard = await send('GET', '/api/dashboard', undefined, rider.data.token);
    assert.equal(claimedRiderDashboard.data.jobs[0].address, '12 Test Street');
    assert.equal(claimedRiderDashboard.data.jobs[0].phone, '08000000000');
    assert.equal((await send('PATCH', `/api/dispatch/jobs/${deliveryReference}`, { status: 'picked-up' }, rider.data.token)).status, 200);
    assert.equal((await send('PATCH', `/api/dispatch/jobs/${deliveryReference}`, { status: 'delivered' }, rider.data.token)).status, 200);
    const completedRiderDashboard = await send('GET', '/api/dashboard', undefined, rider.data.token);
    assert.equal(completedRiderDashboard.data.metrics.grossEarnings, 1000);
    assert.equal(completedRiderDashboard.data.availableBalanceNaira, 0);
    const confirmedDelivery = await send('POST', `/api/orders/${deliveryReference}/confirm-delivery`, undefined, registration.data.token);
    assert.equal(confirmedDelivery.status, 200);
    assert.equal(confirmedDelivery.data.order.settlementStatus, 'available');
    assert.equal((await send('POST', `/api/orders/${deliveryReference}/confirm-delivery`, undefined, registration.data.token)).status, 409);
    assert.equal((await send('GET', '/api/dashboard', undefined, rider.data.token)).data.availableBalanceNaira, 1000);
    const sellerReleased = await send('GET', '/api/dashboard', undefined, seller.data.token);
    assert.equal(sellerReleased.data.availableBalanceNaira, 10610);

    const highPriceProduct = await send('POST', '/api/seller/products', {
      name: 'High tier test item', category: 'Home', description: 'Commission tier test product.', price: 40000, image: uploadedImage.data.images[0]
    }, seller.data.token);
    const lowPriceProduct = await send('POST', '/api/seller/products', {
      name: 'Low tier test item', category: 'Home', description: 'Commission tier test product.', price: 6000, image: uploadedImage.data.images[0]
    }, seller.data.token);
    const purchaseAndConfirm = async (productId, expectedAmountKobo) => {
      const nextOrder = await send('POST', '/api/payments/initialize', {
        email: 'buyer@example.com', customer: { name: 'Test Customer', phone: '08000000000' },
        delivery: { address: '12 Test Street', neighbourhood: 'Ewet Housing' }, items: [{ id: productId, quantity: 1 }]
      }, registration.data.token);
      assert.equal(nextOrder.status, 201);
      assert.equal(initializedAmount, expectedAmountKobo);
      await send('GET', `/api/payments/verify/${nextOrder.data.reference}`);
      await send('PATCH', `/api/dispatch/jobs/${nextOrder.data.reference}`, { status: 'accept' }, rider.data.token);
      await send('PATCH', `/api/dispatch/jobs/${nextOrder.data.reference}`, { status: 'picked-up' }, rider.data.token);
      await send('PATCH', `/api/dispatch/jobs/${nextOrder.data.reference}`, { status: 'delivered' }, rider.data.token);
      const confirmation = await send('POST', `/api/orders/${nextOrder.data.reference}/confirm-delivery`, undefined, registration.data.token);
      assert.equal(confirmation.status, 200);
    };
    await purchaseAndConfirm(highPriceProduct.data.product.id, 4050000);
    assert.equal((await send('GET', '/api/dashboard', undefined, seller.data.token)).data.availableBalanceNaira, 44110);
    await purchaseAndConfirm(lowPriceProduct.data.product.id, 650000);
    assert.equal((await send('GET', '/api/dashboard', undefined, seller.data.token)).data.availableBalanceNaira, 49310);

    const banks = await send('GET', '/api/payout/banks', undefined, seller.data.token);
    assert.equal(banks.data.banks[0].code, '058');
    const payoutAccount = await send('POST', '/api/payout/account', { bankCode: '058', accountNumber: '0123456789' }, seller.data.token);
    assert.equal(payoutAccount.status, 201);
    assert.equal(payoutAccount.data.account.accountLast4, '6789');
    const withdrawal = await send('POST', '/api/payouts/withdraw', { amountNaira: 5000 }, seller.data.token);
    assert.equal(withdrawal.status, 201);
    assert.equal(withdrawal.data.payout.status, 'success');
    assert.equal(withdrawal.data.availableBalanceNaira, 44310);
    const transferWebhookBody = JSON.stringify({ event: 'transfer.reversed', data: { reference: withdrawal.data.payout.reference } });
    const transferWebhook = await nativeFetch(`${baseUrl}/api/payments/webhook`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-paystack-signature': crypto.createHmac('sha512', process.env.PAYSTACK_SECRET_KEY).update(transferWebhookBody).digest('hex') },
      body: transferWebhookBody
    });
    assert.equal(transferWebhook.status, 200);
    assert.equal((await send('GET', '/api/dashboard', undefined, seller.data.token)).data.availableBalanceNaira, 49310);

    const invalidWebhook = await nativeFetch(`${baseUrl}/api/payments/webhook`, {
      method: 'POST', headers: { 'content-type': 'application/json', 'x-paystack-signature': 'not-a-valid-signature' }, body: '{}'
    });
    assert.equal(invalidWebhook.status, 401);

    const orders = await send('GET', '/api/me/orders', undefined, registration.data.token);
    assert.equal(orders.data.length, 4);
    const bookings = await send('GET', '/api/me/bookings', undefined, registration.data.token);
    assert.equal(bookings.data.length, 1);
    assert.equal(bookings.data[0].paymentStatus, 'paid');

    console.log(JSON.stringify({
      registered: registration.status,
      sharedEmailProfiles: [provider.data.user.email, registration.data.user.email, seller.data.user.email, rider.data.user.email].every((email) => email === 'buyer@example.com'),
      usernameOnlyLogins: [providerLogin, customerLogin].every((result) => Boolean(result.data.token)),
      allowedServiceNiches: niches.data.length,
      sellerGrossSales: (await send('GET', '/api/dashboard', undefined, seller.data.token)).data.metrics.grossSales,
      sellerProductVideo: sellerProduct.data.product.video,
      riderFeeEarnings: completedRiderDashboard.data.metrics.grossEarnings,
      providerRating: providerDashboard.data.metrics.rating,
      booking: booking.status,
      initialized: initialized.status,
      serverAmountKobo: initializedAmount,
      paymentStatus: verified.data.order.paymentStatus,
      servicePayment: serviceVerified.data.order.paymentStatus,
      orderResponsePrivateFields: false,
      invalidWebhookRejected: invalidWebhook.status === 401,
      customerOrders: orders.data.length,
      customerBookings: bookings.data.length
    }));
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  } finally {
    server.close();
    fs.rmSync(temporaryDirectory, { recursive: true, force: true });
  }
});