import request from 'supertest';
import app from '../src/app';

process.env.NIN_VERIFICATION_ENABLED = 'true';
process.env.DISPATCH_SIGNIN_ENABLED = 'true';
let ninCounter = 0;
const uniqueNin = () => String(30000000000 + (Date.now() % 1000000) * 1000 + (ninCounter++ % 1000));

describe('E-Marketplace Application', () => {
  it('should return a 200 status for the home route', async () => {
    const response = await request(app).get('/');
    expect(response.status).toBe(200);
  });

  it('should return a 404 status for non-existent routes', async () => {
    const response = await request(app).get('/non-existent-route');
    expect(response.status).toBe(404);
  });

  it.each(['http://localhost:3000', 'http://127.0.0.1:3000'])('should allow signup preflight from local storefront origin %s', async (origin) => {
    const response = await request(app)
      .options('/api/auth/register')
      .set('Origin', origin)
      .set('Access-Control-Request-Method', 'POST')
      .set('Access-Control-Request-Headers', 'content-type');

    expect(response.status).toBe(204);
    expect(response.headers['access-control-allow-origin']).toBe(origin);
  });

  it('should complete signup from the 127.0.0.1 storefront origin', async () => {
    const username = `loopback${Date.now()}`;
    const response = await request(app)
      .post('/api/auth/register')
      .set('Origin', 'http://127.0.0.1:3000')
      .send({ name: 'Loopback Customer', username, email: `${username}@example.com`, password: 'loopback-test-password', role: 'customer' });

    expect(response.status).toBe(201);
    expect(response.headers['access-control-allow-origin']).toBe('http://127.0.0.1:3000');
    expect(response.body.user.username).toBe(username);
  });

  it('should not allow signup preflight from an unrelated origin', async () => {
    const response = await request(app)
      .options('/api/auth/register')
      .set('Origin', 'https://attacker.example')
      .set('Access-Control-Request-Method', 'POST');

    expect(response.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('gives each account a referral link and links people who sign up with it', async () => {
    const stamp = Date.now();
    const mk = (username: string, extra: object = {}) => request(app).post('/api/auth/register').send({ name: 'Ref Person', username, email: `${username}@example.com`, password: 'marketplacepassword123', role: 'customer', ...extra });
    const owner = await mk(`refowner${stamp}`);
    const auth = { Authorization: `Bearer ${owner.body.token}` };
    expect((await request(app).get('/api/me/referral')).status).toBe(401);
    const first = await request(app).get('/api/me/referral').set(auth);
    expect(first.body.code).toMatch(/^[A-Z0-9]{8}$/);
    expect(first.body.link).toContain(`/?ref=${first.body.code}`);
    expect(first.body.count).toBe(0);
    expect((await request(app).get('/api/me/referral').set(auth)).body.code).toBe(first.body.code);
    expect((await mk(`refjoin${stamp}`, { ref: first.body.code.toLowerCase() })).status).toBe(201);
    expect((await mk(`refbad${stamp}`, { ref: 'nope!' })).status).toBe(201);
    const after = await request(app).get('/api/me/referral').set(auth);
    expect(after.body.count).toBe(1);
    expect(after.body.recent[0].name).toBe('Ref');
  });

  it('does not serve an admin dashboard from the storefront', async () => {
    expect((await request(app).get('/admin')).status).toBe(404);
    expect((await request(app).get('/')).text).not.toMatch(/Admin dashboard/);
  });

  it('gates admin access by password and audits reversible provider suspension', async () => {
    const previousAdminPassword = process.env.ADMIN_PASSWORD;
    process.env.ADMIN_PASSWORD = 'test-only-admin-password';
    try {
      const username = `provider${Date.now()}`;
      const registration = await request(app).post('/api/auth/register').send({
        name: 'Marketplace Provider',
        username,
        email: `${username}@example.com`,
        password: 'providerpassword123',
        role: 'provider',
        businessName: 'Test Barbershop',
        niche: 'Barbing'
      });
      expect(registration.status).toBe(201);
      expect((await request(app).post('/api/profile/nin').set('Authorization', `Bearer ${registration.body.token}`).send({ nin: uniqueNin() })).status).toBe(200);
      const profile = await request(app).patch('/api/profile')
        .set('Authorization', `Bearer ${registration.body.token}`)
        .send({ name: 'Marketplace Provider', businessName: 'Test Barbershop', position: 'Owner and barber', placeOfOperation: 'Ewet Housing, Uyo', aboutMe: 'I offer reliable barber appointments for homes and businesses across Uyo.', profileImage: '/uploads/test-profile.jpg' });
      expect(profile.status).toBe(200);
      expect(profile.body.complete).toBe(true);
      const publicAdminRegistration = await request(app).post('/api/auth/register').send({
        name: 'Unapproved Admin',
        username: `unapproved${Date.now()}`,
        email: `unapproved${Date.now()}@example.com`,
        password: 'unapprovedpassword123',
        role: 'admin'
      });
      expect(publicAdminRegistration.status).toBe(400);

      const listing = await request(app).post('/api/provider/listings')
        .set('Authorization', `Bearer ${registration.body.token}`)
        .send({ niche: 'Barbing', title: 'Uyo home barber', description: 'Barber appointments in Uyo homes.', price: 5000, portfolio: ['/uploads/test-barber.jpg'] });
      expect(listing.status).toBe(201);

      const noPassword = await request(app).get('/api/admin/dashboard');
      expect(noPassword.status).toBe(401);
      const invalidPassword = await request(app).post('/api/admin/login').send({ password: 'wrong-password' });
      expect(invalidPassword.status).toBe(401);
      const adminLogin = await request(app).post('/api/admin/login').send({ password: process.env.ADMIN_PASSWORD });
      expect(adminLogin.status).toBe(200);
      const adminToken = adminLogin.body.token;
      const dashboard = await request(app).get('/api/admin/dashboard').set('Authorization', `Bearer ${adminToken}`);
      expect(dashboard.status).toBe(200);
      expect(dashboard.body.metrics.totalUsers).toBeGreaterThan(0);

      const before = await request(app).get('/api/services');
      expect(before.body.some((service: { id: string }) => service.id === listing.body.listing.id)).toBe(true);
      const publicService = before.body.find((service: { id: string; providerProfile?: { aboutMe?: string; position?: string; placeOfOperation?: string } }) => service.id === listing.body.listing.id);
      expect(publicService.providerProfile).toMatchObject({
        aboutMe: 'I offer reliable barber appointments for homes and businesses across Uyo.',
        position: 'Owner and barber',
        placeOfOperation: 'Ewet Housing, Uyo'
      });
      const suspend = await request(app).patch(`/api/admin/users/${registration.body.user.id}/suspension`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ suspended: true, reason: 'Repeated customer safety reports' });
      expect(suspend.status).toBe(200);
      expect(suspend.body.user.suspendedAt).toBeTruthy();
      expect((await request(app).get('/api/dashboard').set('Authorization', `Bearer ${registration.body.token}`)).status).toBe(401);
      expect((await request(app).get('/api/services')).body.some((service: { id: string }) => service.id === listing.body.listing.id)).toBe(false);

      const users = await request(app).get(`/api/admin/records?kind=users&search=${username}`).set('Authorization', `Bearer ${adminToken}`);
      expect(users.body.total).toBe(1);
      expect(users.body.records[0].suspensionReason).toBe('Repeated customer safety reports');
      const audit = await request(app).get(`/api/admin/records?kind=audit&search=${registration.body.user.id}`).set('Authorization', `Bearer ${adminToken}`);
      expect(audit.body.total).toBe(3);
      expect(audit.body.records.map((entry: { action: string }) => entry.action)).toEqual(expect.arrayContaining(['nin.submitted', 'profile.updated', 'account.suspended']));

      const restore = await request(app).patch(`/api/admin/users/${registration.body.user.id}/suspension`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ suspended: false });
      expect(restore.status).toBe(200);
      expect((await request(app).get('/api/dashboard').set('Authorization', `Bearer ${registration.body.token}`)).status).toBe(200);
      expect((await request(app).get('/api/services')).body.some((service: { id: string }) => service.id === listing.body.listing.id)).toBe(true);
    } finally {
      if (previousAdminPassword === undefined) delete process.env.ADMIN_PASSWORD;
      else process.env.ADMIN_PASSWORD = previousAdminPassword;
    }
  }, 20000);

  it('should allow customer signup with an empty optional business name', async () => {
    const username = `customer${Date.now()}`;
    const registration = await request(app).post('/api/auth/register').send({
      name: 'Customer User',
      username,
      email: `${username}@example.com`,
      password: 'customerpassword123',
      role: 'customer',
      businessName: ''
    });

    expect(registration.status).toBe(201);
    expect(registration.body.emailVerificationRequired).toBe(false);
    const login = await request(app).post('/api/auth/login').send({ username, password: 'customerpassword123' });
    expect(login.status).toBe(200);
    expect(login.body.user.role).toBe('customer');
  });

  it('has NIN collection switched off by default', async () => {
    delete process.env.NIN_VERIFICATION_ENABLED;
    try {
      const username = `nooff${Date.now()}`;
      const reg = await request(app).post('/api/auth/register').send({ name: 'No Nin', username, email: `${username}@example.com`, password: 'marketplacepassword123', role: 'seller', businessName: 'Plain Shop' });
      expect(reg.status).toBe(201);
      expect(reg.body.user.ninRequired).toBe(false);
      expect((await request(app).post('/api/profile/nin').set('Authorization', `Bearer ${reg.body.token}`).send({ nin: uniqueNin() })).status).toBe(404);
    } finally { process.env.NIN_VERIFICATION_ENABLED = 'true'; }
  });

  it('does not ask for a NIN at signup; verifies it from the profile with the provider and never returns it', async () => {
    const username = `nin${Date.now()}`;
    const nin = uniqueNin();
    const body = { name: 'Ada Okon', username, email: `${username}@example.com`, password: 'marketplacepassword123', role: 'seller', businessName: 'Nin Shop' };
    const reg = await request(app).post('/api/auth/register').send(body);
    expect(reg.status).toBe(201);
    const auth = { Authorization: `Bearer ${reg.body.token}` };
    expect((await request(app).post('/api/profile/nin').set(auth).send({ nin: '123' })).status).toBe(400);
    const pending = await request(app).post('/api/profile/nin').set(auth).send({ nin: nin });
    expect(pending.body.status).toBe('pending');
    expect(pending.body.user.ninLast4).toBe(nin.slice(-4));
    expect(JSON.stringify(pending.body)).not.toContain(nin);
    process.env.DOJAH_APP_ID = 'app'; process.env.DOJAH_SECRET_KEY = 'secret';
    const realFetch = global.fetch;
    const entity = { current: { first_name: 'Someone', last_name: 'Else' } };
    global.fetch = (async (url: any, init: any) => {
      if (String(url).includes('/api/v1/kyc/nin')) {
        expect(init.headers.Authorization).toBe('secret');
        return new Response(JSON.stringify({ entity: entity.current }), { status: 200 });
      }
      return realFetch(url, init);
    }) as any;
    try {
      const failed = await request(app).post('/api/profile/nin').set(auth).send({ nin: nin });
      expect(failed.body.status).toBe('failed');
      entity.current = { first_name: 'Ada', last_name: 'Okon' };
      const verified = await request(app).post('/api/profile/nin').set(auth).send({ nin: nin });
      expect(verified.body.status).toBe('verified');
      expect((await request(app).post('/api/profile/nin').set(auth).send({ nin: nin })).status).toBe(409);
    } finally {
      global.fetch = realFetch;
      delete process.env.DOJAH_APP_ID; delete process.env.DOJAH_SECRET_KEY;
    }
  });

  it.each([
    { role: 'seller', businessName: 'Test Shop' },
    { role: 'provider', businessName: 'Test Service', niche: 'Barbing' },
    { role: 'dispatch', businessName: 'Ewet Housing' }
  ])('should sign in a $role account and return its dashboard data', async ({ role, businessName, niche }) => {
    const username = `${role}${Date.now()}${Math.floor(Math.random() * 1000)}`;
    const registration = await request(app).post('/api/auth/register').send({
      name: 'Marketplace User',
      username,
      email: `${username}@example.com`,
      password: 'marketplacepassword123',
      role,
      businessName,
      niche
    });

    expect(registration.status).toBe(201);
    if (role === 'seller' || role === 'provider') expect((await request(app).post('/api/profile/nin').set('Authorization', `Bearer ${registration.body.token}`).send({ nin: uniqueNin() })).status).toBe(200);
    const login = await request(app).post('/api/auth/login').send({ username, password: 'marketplacepassword123' });
    expect(login.status).toBe(200);
    expect(login.body.user.role).toBe(role);

    const dashboard = await request(app).get('/api/dashboard').set('Authorization', `Bearer ${login.body.token}`);
    expect(dashboard.status).toBe(200);
    expect(dashboard.body.role).toBe(role);
    expect(dashboard.body).toHaveProperty(role === 'seller' ? 'products' : role === 'provider' ? 'listings' : 'jobs');
    const profile = await request(app).patch('/api/profile').set('Authorization', `Bearer ${login.body.token}`).send({
      name: 'Marketplace User',
      businessName,
      position: 'Owner and operator',
      placeOfOperation: 'Ewet Housing, Uyo',
      aboutMe: 'Local marketplace business serving customers across Uyo.',
      profileImage: '/uploads/marketplace-user.jpg'
    });
    expect(profile.status).toBe(200);
    expect(profile.body.complete).toBe(true);
    if (role === 'seller') {
      const product = await request(app).post('/api/seller/products').set('Authorization', `Bearer ${login.body.token}`).send({
        name: 'Test marketplace product', category: 'Home', description: 'A useful local marketplace item.', price: 1200, image: '/uploads/marketplace-product.jpg'
      });
      expect(product.status).toBe(201);
      const publicProduct = await request(app).get('/api/products');
      const listedProduct = publicProduct.body.find((item: { id: string; brandProfile?: { businessName?: string; position?: string } }) => item.id === product.body.product.id);
      expect(listedProduct.brandProfile).toMatchObject({ businessName, position: 'Owner and operator' });
      expect(listedProduct.brandProfile).not.toHaveProperty('email');
    }
  });

  it('should lock repeated login failures and set a secure auth cookie', async () => {
    const username = `secure-${Date.now()}`;
    const email = `secure-${Date.now()}@example.com`;
    await request(app).post('/api/auth/register').send({
      name: 'Secure User',
      username,
      email,
      password: 'securepassword123',
      role: 'customer'
    });

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const failedLogin = await request(app).post('/api/auth/login').send({
        username,
        password: 'wrong-password'
      });
      expect(failedLogin.status).toBe(401);
    }

    const lockedLogin = await request(app).post('/api/auth/login').send({
      username,
      password: 'wrong-password'
    });
    expect(lockedLogin.status).toBe(429);

    const signedIn = await request(app).post('/api/auth/login').send({
      username,
      password: 'securepassword123'
    });
    expect(signedIn.status).toBe(429);
    expect(signedIn.headers['set-cookie']).toBeUndefined();
  });
});