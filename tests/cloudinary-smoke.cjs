const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'local-integration-signing-secret';
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'unishop-cloudinary-'));
process.env.MARKETPLACE_DATA_PATH = path.join(dir, 'marketplace.json');
process.env.UPLOADS_DIRECTORY = path.join(dir, 'uploads');

// Mock Cloudinary: verifies the signature and compression settings, can be told to fail.
let failNext = false;
const received = [];
const cloudinary = http.createServer(async (req, res) => {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const form = await new Response(Buffer.concat(chunks), { headers: { 'content-type': req.headers['content-type'] } }).formData();
  const fields = Object.fromEntries([...form.entries()].filter(([, v]) => typeof v === 'string'));
  const kind = req.url.split('/')[3];
  const toSign = ['folder', 'timestamp', 'transformation'].map((k) => `${k}=${fields[k]}`).join('&');
  const expected = crypto.createHash('sha1').update(toSign + 'secretxyz').digest('hex');
  received.push({ url: req.url, fields, signatureOk: expected === fields.signature });
  if (failNext || expected !== fields.signature || fields.api_key !== 'key123') {
    res.writeHead(401, { 'content-type': 'application/json' });
    return res.end(JSON.stringify({ error: { message: 'Invalid Signature' } }));
  }
  res.writeHead(200, { 'content-type': 'application/json' });
  res.end(JSON.stringify({ secure_url: `https://res.cloudinary.com/democloud/${kind}/upload/v1/unishop/${kind}-${received.length}.${kind === 'image' ? 'jpg' : 'mp4'}` }));
});

cloudinary.listen(0, () => {
  process.env.cloud_name = 'democloud';
  process.env.api_key = 'key123';
  process.env.api_secret = 'secretxyz';
  process.env.CLOUDINARY_API_BASE = `http://127.0.0.1:${cloudinary.address().port}`;
  require('ts-node/register');
  const app = require('../src/app').default;
  const server = app.listen(0, async () => {
    const base = `http://127.0.0.1:${server.address().port}`;
    const send = async (method, route, body, token) => {
      const r = await fetch(base + route, { method, headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
      return { status: r.status, data: await r.json() };
    };
    const upload = async (route, field, name, type, bytes, token, extra = {}) => {
      const form = new FormData();
      Object.entries(extra).forEach(([k, v]) => form.append(k, String(v)));
      form.append(field, new Blob([bytes], { type }), name);
      const r = await fetch(base + route, { method: 'POST', headers: { authorization: `Bearer ${token}` }, body: form });
      return { status: r.status, data: await r.json() };
    };
    const jpeg = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(64, 1)]);
    const localFiles = () => (fs.existsSync(process.env.UPLOADS_DIRECTORY) ? fs.readdirSync(process.env.UPLOADS_DIRECTORY) : []);
    try {
      const stamp = Date.now();
      const seller = await send('POST', '/api/auth/register', { name: 'Cloud Seller', username: `cld${stamp}`, email: `cld${stamp}@example.com`, password: 'marketplacepassword123', role: 'seller', acceptTerms: true, businessName: 'Cloud Shop' });
      const token = seller.data.token;

      const photo = await upload('/api/uploads/portfolio', 'images', 'a.jpg', 'image/jpeg', jpeg, token);
      assert.equal(photo.status, 201);
      assert.match(photo.data.images[0], /^https:\/\/res\.cloudinary\.com\/democloud\/image\/upload\/f_auto,q_auto\/v1\/unishop\//);
      assert.ok(received[0].signatureOk && received[0].url === '/v1_1/democloud/image/upload');
      assert.match(received[0].fields.transformation, /q_auto/);
      assert.equal(localFiles().length, 0, 'local copy is removed after the Cloudinary upload');

      const video = await upload('/api/uploads/short-video', 'video', 'v.mp4', 'video/mp4', Buffer.from('....ftypmp42mock-video'), token, { duration: 5 });
      assert.equal(video.status, 201);
      assert.match(video.data.video, /^https:\/\/res\.cloudinary\.com\/democloud\/video\/upload\/f_auto,q_auto,vc_auto\//);
      assert.equal(received[1].url, '/v1_1/democloud/video/upload');
      assert.ok(received[1].signatureOk);

      assert.equal((await send('PATCH', '/api/profile', { name: 'Cloud Seller', businessName: 'Cloud Shop', position: 'Owner', phone: '08030000000', placeOfOperation: 'Uyo', aboutMe: 'A local shop selling clothes around Uyo.', profileImage: photo.data.images[0], ceoImage: photo.data.images[0] }, token)).status, 200);
      const product = await send('POST', '/api/seller/products', { name: 'Cloud shirt', category: 'Shoes and sandals', description: 'A nice shirt for you.', price: 5000, images: [photo.data.images[0]], video: video.data.video, videoDuration: 5, quantity: 2 }, token);
      assert.equal(product.status, 201, JSON.stringify(product.data));
      assert.equal(product.data.product.images[0], photo.data.images[0]);

      // Another Cloudinary account, or another host, is rejected.
      const foreign = photo.data.images[0].replace('/democloud/', '/someoneelse/');
      assert.equal((await send('POST', '/api/seller/products', { name: 'Foreign', category: 'Shoes and sandals', description: 'A nice shirt for you.', price: 5000, images: [foreign], quantity: 1 }, token)).status, 400);
      assert.equal((await send('POST', '/api/seller/products', { name: 'Evil', category: 'Shoes and sandals', description: 'A nice shirt for you.', price: 5000, images: ['https://evil.example/x.jpg'], quantity: 1 }, token)).status, 400);

      // When Cloudinary fails, the upload still works and stays on the volume.
      failNext = true;
      const fallback = await upload('/api/uploads/portfolio', 'images', 'b.jpg', 'image/jpeg', jpeg, token);
      assert.equal(fallback.status, 201);
      assert.match(fallback.data.images[0], /^\/uploads\//);
      assert.equal(localFiles().length, 1);
      console.log('cloudinary smoke passed');
    } catch (error) {
      console.error(error);
      process.exitCode = 1;
    } finally {
      server.close(); cloudinary.close(); setTimeout(() => process.exit(process.exitCode || 0), 100);
    }
  });
});
