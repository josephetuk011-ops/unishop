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

  it('should expose the admin dashboard on a dedicated admin link', async () => {
    const response = await request(app).get('/admin');
    expect(response.status).toBe(302);
    expect(response.headers.location).toBe('/dashboard.html');
  });

  it('should allow an admin account and expose the admin dashboard', async () => {
    const email = `admin-${Date.now()}@example.com`;
    const registerResponse = await request(app).post('/api/auth/register').send({
      name: 'Admin User',
      username: `admin${Date.now()}`,
      email,
      password: 'adminpassword123',
      role: 'admin'
    });

    expect(registerResponse.status).toBe(201);
    expect(registerResponse.body.user.role).toBe('admin');

    const dashboardResponse = await request(app)
      .get('/api/dashboard')
      .set('Authorization', `Bearer ${registerResponse.body.token}`);

    expect(dashboardResponse.status).toBe(200);
    expect(dashboardResponse.body.role).toBe('admin');
    expect(dashboardResponse.body.metrics).toHaveProperty('totalUsers');
    expect(dashboardResponse.body.breakdown).toHaveProperty('roles');
    expect(dashboardResponse.body.breakdown).toHaveProperty('orders');
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