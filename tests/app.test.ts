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

  // Add more tests for other functionalities as needed
});