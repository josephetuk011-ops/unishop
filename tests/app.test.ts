import request from 'supertest';
import app from '../src/app';

describe('E-Marketplace Application', () => {
  it('should return a 200 status for the home route', async () => {
    const response = await request(app).get('/');
    expect(response.status).toBe(200);
  });

  it('should return a 404 status for non-existent routes', async () => {
    const response = await request(app).get('/non-existent-route');
    expect(response.status).toBe(404);
  });

  it('should redirect the marketplace admin link to the separate console', async () => {
    const previousAdminUrl = process.env.ADMIN_APP_URL;
    process.env.ADMIN_APP_URL = 'https://admin.example.test';
    try {
      const response = await request(app).get('/admin');
      expect(response.status).toBe(302);
      expect(response.headers.location).toBe('https://admin.example.test');
    } finally {
      if (previousAdminUrl === undefined) delete process.env.ADMIN_APP_URL;
      else process.env.ADMIN_APP_URL = previousAdminUrl;
    }
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
      expect(audit.body.total).toBe(2);
      expect(audit.body.records.map((entry: { action: string }) => entry.action)).toEqual(expect.arrayContaining(['profile.updated', 'account.suspended']));

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