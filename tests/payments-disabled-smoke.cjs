const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

delete process.env.PAYSTACK_SECRET_KEY;
const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'unishop-unconfigured-'));
process.env.MARKETPLACE_DATA_PATH = path.join(temporaryDirectory, 'marketplace.json');
require('ts-node/register');
const app = require('../src/app').default;

const server = app.listen(0, async () => {
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  try {
    const response = await fetch(`${baseUrl}/api/payments/initialize`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        email: 'buyer@example.com', customer: { name: 'Test Buyer', phone: '08000000000' },
        delivery: { address: '12 Test Street', neighbourhood: 'Ewet Housing' },
        items: [{ id: 'linen-set', quantity: 1 }]
      })
    });
    assert.equal(response.status, 503);
    assert.match((await response.json()).error, /Online payments are temporarily unavailable/);
    assert.equal((await fetch(`${baseUrl}/api/health`)).status, 200);
    console.log(JSON.stringify({ unconfiguredPayment: response.status, serverRemainsHealthy: true }));
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  } finally {
    server.close();
    fs.rmSync(temporaryDirectory, { recursive: true, force: true });
  }
});