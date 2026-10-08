const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const https = require('node:https');

const root = __dirname;
const apiBase = process.env.MARKETPLACE_API_URL;
const port = Number(process.env.PORT) || 4173;
const contentTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon'
};

function securityHeaders(response) {
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('X-Frame-Options', 'DENY');
  response.setHeader('Referrer-Policy', 'no-referrer');
  response.setHeader('Cache-Control', 'no-store');
  response.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'");
}

function proxyApi(request, response) {
  if (!apiBase) {
    response.writeHead(503, { 'Content-Type': 'application/json; charset=utf-8' });
    response.end(JSON.stringify({ error: 'MARKETPLACE_API_URL is not configured.' }));
    return;
  }
  let target;
  try {
    target = new URL(request.url, `${apiBase.replace(/\/$/, '')}/`);
    if (!['http:', 'https:'].includes(target.protocol)) throw new Error('Unsupported API protocol.');
  } catch {
    response.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
    response.end(JSON.stringify({ error: 'The marketplace API URL is invalid.' }));
    return;
  }
  const transport = target.protocol === 'https:' ? https : http;
  const headers = { host: target.host, accept: request.headers.accept || 'application/json' };
  for (const header of ['authorization', 'content-type', 'content-length']) {
    if (request.headers[header]) headers[header] = request.headers[header];
  }
  const upstream = transport.request(target, { method: request.method, headers }, (upstreamResponse) => {
    response.writeHead(upstreamResponse.statusCode || 502, {
      'Content-Type': upstreamResponse.headers['content-type'] || 'application/json; charset=utf-8',
      'Cache-Control': 'no-store'
    });
    upstreamResponse.pipe(response);
  });
  upstream.on('error', () => {
    if (!response.headersSent) response.writeHead(502, { 'Content-Type': 'application/json; charset=utf-8' });
    response.end(JSON.stringify({ error: 'Marketplace API is unavailable.' }));
  });
  request.pipe(upstream);
}

http.createServer((request, response) => {
  securityHeaders(response);
  const pathname = new URL(request.url, 'http://localhost').pathname;
  if (pathname === '/health' && ['GET', 'HEAD'].includes(request.method)) {
    response.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    response.end(request.method === 'HEAD' ? undefined : JSON.stringify({ status: 'ok' }));
    return;
  }
  if (pathname.startsWith('/api/')) return proxyApi(request, response);
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    response.writeHead(405, { Allow: 'GET, HEAD' });
    response.end();
    return;
  }
  let requestedPath;
  try {
    requestedPath = decodeURIComponent(pathname === '/' ? '/index.html' : pathname);
  } catch {
    response.writeHead(400);
    response.end();
    return;
  }
  const filePath = path.resolve(root, `.${requestedPath}`);
  if (!filePath.startsWith(`${root}${path.sep}`)) {
    response.writeHead(404);
    response.end();
    return;
  }
  fs.readFile(filePath, (error, contents) => {
    if (error) {
      response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      response.end('Not found');
      return;
    }
    response.writeHead(200, { 'Content-Type': contentTypes[path.extname(filePath)] || 'application/octet-stream' });
    response.end(request.method === 'HEAD' ? undefined : contents);
  });
}).listen(port, '0.0.0.0', () => console.log(`Unishop admin console listening on ${port}`));
