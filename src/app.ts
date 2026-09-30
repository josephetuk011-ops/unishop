import express, { NextFunction, Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import crypto, { randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'crypto';
import { promisify } from 'util';
import dotenv from 'dotenv';
import multer from 'multer';

dotenv.config();

const app = express();
const bcrypt = require('bcryptjs') as {
  hash: (password: string, rounds: number) => Promise<string>;
  compare: (password: string, hash: string) => Promise<boolean>;
};
const scrypt = promisify(scryptCallback);
const roles = ['customer', 'seller', 'provider', 'dispatch'] as const;
type Role = typeof roles[number];
type User = { id: string; name: string; username?: string; email: string; role: Role; businessName?: string; niche?: string; payoutAccount?: { recipientCode: string; bankName: string; accountName: string; accountLast4: string }; passwordHash: string; createdAt: string };
type MarketplaceState = { users: User[]; orders: any[]; bookings: any[]; serviceListings: any[]; sellerProducts: any[]; reviews: any[]; payouts: any[] };
type ApiError = Error & { status?: number };

const catalog = [
  { id: 'linen-set', name: 'Everyday linen set', seller: 'Sunday Studio, Uyo', category: 'Home', price: 28500, image: 'photo-1616486338812-3dadae4b4ace' },
  { id: 'crossbody', name: 'The soft-side crossbody', seller: 'Moyo Atelier, Uyo', category: 'Fashion', price: 18900, image: 'photo-1548036328-c9fa89d128fa' },
  { id: 'face-oil', name: 'Glow ritual face oil', seller: 'Ora Botanics, Uyo', category: 'Beauty', price: 12500, image: 'photo-1608248543803-ba4f8c70ae0b' },
  { id: 'headphones', name: 'Studio wireless headphones', seller: 'Circuit & Co., Uyo', category: 'Tech', price: 47500, image: 'photo-1505740420928-5e560c06d30e' },
  { id: 'ceramic-cup', name: 'Sunday morning cup', seller: 'Clay Things, Uyo', category: 'Home', price: 8900, image: 'photo-1514228742587-6b1558fcca3d' },
  { id: 'woven-tote', name: 'Market day woven tote', seller: 'Abeni Goods, Uyo', category: 'Fashion', price: 14900, image: 'photo-1590874103328-eac38a683ce7' },
  { id: 'skin-kit', name: 'The soft-skin starter kit', seller: 'Ora Botanics, Uyo', category: 'Beauty', price: 22000, image: 'photo-1556229010-6c3f2c9ca5f8' },
  { id: 'speaker', name: 'Pocket-sized good tunes', seller: 'Circuit & Co., Uyo', category: 'Tech', price: 31500, image: 'photo-1608043152269-423dbba4e7e1' }
];
const providers: any[] = [];
const serviceNiches = [
  'Barbing', 'Cleaning', 'Cooking', 'Hair dressing', 'Decorating', 'Grass clearing', 'Mechanic',
  'Electrician', 'Plumber', 'Photographer', 'Makeup', 'Fashion designing', 'Manicure and pedicure', 'Therapist'
];
const nicheImages: Record<string, string> = {
  'Barbing': 'photo-1503951914875-452162b0f3f1', 'Cleaning': 'photo-1581578731548-c64695cc6952', 'Cooking': 'photo-1556911220-bff31c812dba',
  'Hair dressing': 'photo-1560066984-138dadb4c035', 'Decorating': 'photo-1616486338812-3dadae4b4ace', 'Grass clearing': 'photo-1585320806297-9794b3e4eeae',
  'Mechanic': 'photo-1486262715619-67b85e0b08d3', 'Electrician': 'photo-1621905251189-08b45d6a269e', 'Plumber': 'photo-1607472586893-edb57bdc0e39',
  'Photographer': 'photo-1542038784456-1ea8e935640e', 'Makeup': 'photo-1522335789203-aabd1fc54bc9', 'Fashion designing': 'photo-1558618666-fcd25c85cd64',
  'Manicure and pedicure': 'photo-1604654894610-df63bc536371', 'Therapist': 'photo-1544161515-4ab6ce6db874'
};
const dataPath = process.env.MARKETPLACE_DATA_PATH || path.join(__dirname, '..', '.data', 'marketplace.json');
const uploadDirectory = process.env.UPLOADS_DIRECTORY || path.join(__dirname, '..', 'public', 'uploads');
const imageUpload = multer({
  storage: multer.diskStorage({
    destination: (_request, _file, callback) => {
      fs.mkdirSync(uploadDirectory, { recursive: true });
      callback(null, uploadDirectory);
    },
    filename: (_request, file, callback) => {
      const extension = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' }[file.mimetype] || '.img';
      callback(null, `${Date.now()}-${randomBytes(10).toString('hex')}${extension}`);
    }
  }),
  limits: { fileSize: 5 * 1024 * 1024, files: 6 },
  fileFilter: (_request, file, callback) => {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) return callback(new Error('Upload JPG, PNG or WebP images only.'));
    callback(null, true);
  }
});
const productVideoUpload = multer({
  storage: multer.diskStorage({
    destination: (_request, _file, callback) => {
      fs.mkdirSync(uploadDirectory, { recursive: true });
      callback(null, uploadDirectory);
    },
    filename: (_request, file, callback) => {
      const extension = file.mimetype === 'video/webm' ? '.webm' : '.mp4';
      callback(null, `${Date.now()}-${randomBytes(10).toString('hex')}${extension}`);
    }
  }),
  limits: { fileSize: 40 * 1024 * 1024, files: 1 },
  fileFilter: (_request, file, callback) => {
    if (!['video/mp4', 'video/webm'].includes(file.mimetype)) return callback(new Error('Upload an MP4 or WebM product video.'));
    callback(null, true);
  }
});
const jwtSecret = process.env.JWT_SECRET || 'unishop-development-only-change-this-secret';
const paystackSecret = process.env.PAYSTACK_SECRET_KEY || '';
const callbackUrl = `${(process.env.PUBLIC_APP_URL || process.env.RENDER_EXTERNAL_URL || 'http://localhost:3000').replace(/\/$/, '')}/?payment=return`;

if (process.env.NODE_ENV === 'production' && (!process.env.JWT_SECRET || !process.env.PAYSTACK_SECRET_KEY)) {
  throw new Error('JWT_SECRET and PAYSTACK_SECRET_KEY must be configured in production.');
}

function loadState(): MarketplaceState {
  try {
    const parsed = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
    return { users: parsed.users || [], orders: parsed.orders || [], bookings: parsed.bookings || [], serviceListings: parsed.serviceListings || [], sellerProducts: parsed.sellerProducts || [], reviews: parsed.reviews || [], payouts: parsed.payouts || [] };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    return { users: [], orders: [], bookings: [], serviceListings: [], sellerProducts: [], reviews: [], payouts: [] };
  }
}

let state = loadState();
function saveState() {
  fs.mkdirSync(path.dirname(dataPath), { recursive: true });
  const temporaryPath = `${dataPath}.tmp`;
  fs.writeFileSync(temporaryPath, JSON.stringify(state, null, 2), { mode: 0o600 });
  fs.renameSync(temporaryPath, dataPath);
}

function fail(status: number, message: string): never {
  const error = new Error(message) as ApiError;
  error.status = status;
  throw error;
}

function asyncRoute(handler: (request: Request, response: Response) => Promise<unknown>) {
  return (request: Request, response: Response, next: NextFunction) => {
    handler(request, response).catch(next);
  };
}

function cleanUser(user: User) {
  return { id: user.id, name: user.name, username: user.username || legacyUsername(user), email: user.email, role: user.role, businessName: user.businessName, niche: user.niche, createdAt: user.createdAt };
}

function legacyUsername(user: User) {
  const emailName = user.email.split('@')[0].toLowerCase().replace(/[^a-z0-9._-]/g, '-').slice(0, 20) || 'unishop-user';
  return `${emailName}-${user.role}`;
}

function tokenFor(user: User) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({ sub: user.id, role: user.role, exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7 })).toString('base64url');
  const content = `${header}.${payload}`;
  return `${content}.${crypto.createHmac('sha256', jwtSecret).update(content).digest('base64url')}`;
}

function authenticatedUser(request: Request): User | undefined {
  const token = request.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return undefined;
  const parts = token.split('.');
  if (parts.length !== 3) return undefined;
  const content = `${parts[0]}.${parts[1]}`;
  const expected = crypto.createHmac('sha256', jwtSecret).update(content).digest();
  let actual: Buffer;
  try { actual = Buffer.from(parts[2], 'base64url'); } catch { return undefined; }
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return undefined;
  try {
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
    if (payload.exp < Date.now() / 1000) return undefined;
    return state.users.find((user) => user.id === payload.sub);
  } catch { return undefined; }
}

function requireUser(request: Request): User {
  const user = authenticatedUser(request);
  if (!user) fail(401, 'Sign in to continue.');
  return user;
}

function safeOrder(order: any) {
  const { email, phone, address, customerName, userId, authorizationUrl, accessCode, settlementLines, sellerDispatchContributionNaira, riderSettlementNaira, ...publicOrder } = order;
  return { ...publicOrder, items: publicOrder.items.map(({ sellerUserId, ...item }: any) => item) };
}

async function paystackRequest(endpoint: string, body?: Record<string, unknown>) {
  const response = await fetch(`https://api.paystack.co/${endpoint}`, {
    method: body ? 'POST' : 'GET',
    headers: { Authorization: `Bearer ${paystackSecret}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined
  });
  const result = await response.json() as any;
  if (!response.ok || !result.status) fail(502, result.message || 'Unable to reach Paystack. Please try again.');
  return result.data;
}

async function completePayment(reference: string, payment: any) {
  const order = state.orders.find((item) => item.reference === reference);
  if (!order) return undefined;
  if (payment.status !== 'success' || payment.currency !== 'NGN' || Number(payment.amount) !== order.amountKobo) return order;
  if (payment.customer?.email && payment.customer.email.toLowerCase() !== order.email.toLowerCase()) return order;
  if (order.paymentStatus !== 'paid') {
    order.paymentStatus = 'paid';
    order.orderStatus = 'confirmed';
    order.settlementStatus = 'held';
    order.paidAt = new Date().toISOString();
    if (order.bookingId) {
      const booking = state.bookings.find((item) => item.id === order.bookingId);
      if (booking) {
        booking.paymentStatus = 'paid';
        booking.status = 'confirmed';
        booking.paidAt = order.paidAt;
        booking.settlementStatus = 'held';
      }
    }
    saveState();
  }
  return order;
}

function commissionFor(subtotalNaira: number) {
  const rate = subtotalNaira < 10000 ? 0.05 : subtotalNaira < 30000 ? 0.10 : 0.15;
  return Math.round(subtotalNaira * rate);
}

function sellerSettlementLines(items: any[]) {
  const sellers = new Map<string, { subtotalNaira: number; items: any[] }>();
  items.forEach((item) => {
    if (!item.sellerUserId) return;
    const seller = sellers.get(item.sellerUserId) || { subtotalNaira: 0, items: [] };
    seller.subtotalNaira += item.lineTotal;
    seller.items.push(item);
    sellers.set(item.sellerUserId, seller);
  });
  return [...sellers].map(([userId, seller]) => {
    const commissionNaira = commissionFor(seller.subtotalNaira);
    const dispatchContributionNaira = 500;
    const netNaira = seller.subtotalNaira - commissionNaira - dispatchContributionNaira;
    if (netNaira < 0) fail(400, 'A seller subtotal must cover its ₦500 dispatch contribution and Unishop commission.');
    return { userId, role: 'seller', subtotalNaira: seller.subtotalNaira, commissionNaira, dispatchContributionNaira, netNaira };
  });
}

function releasedEarningsFor(userId: string) {
  return state.orders.reduce((total, order) => {
    if (!order.settlementReleasedAt) return total;
    const sellerEarnings = (order.settlementLines || []).filter((line: any) => line.userId === userId).reduce((sum: number, line: any) => sum + line.netNaira, 0);
    const riderEarnings = order.dispatchRiderId === userId ? Number(order.riderSettlementNaira || 0) : 0;
    return total + sellerEarnings + riderEarnings;
  }, 0);
}

function availableBalanceFor(userId: string) {
  const reservedAndPaidOut = state.payouts.filter((payout) => payout.userId === userId && !['failed', 'reversed'].includes(payout.status)).reduce((sum, payout) => sum + payout.amountNaira, 0);
  return Math.max(0, releasedEarningsFor(userId) - reservedAndPaidOut);
}

function releaseSettlement(order: any) {
  if (order.settlementReleasedAt) return false;
  order.settlementReleasedAt = new Date().toISOString();
  order.settlementStatus = 'available';
  if (order.bookingId) {
    const booking = state.bookings.find((item) => item.id === order.bookingId);
    if (booking) {
      booking.settlementStatus = 'available';
      booking.customerConfirmedAt = order.settlementReleasedAt;
    }
  }
  return true;
}

function payoutResponse(payout: any) {
  const { userId, transferCode, ...publicPayout } = payout;
  return publicPayout;
}

function updatePayoutFromTransfer(payout: any, transfer: any) {
  if (['success', 'failed', 'reversed'].includes(payout.status)) return;
  payout.status = transfer.status === 'success' ? 'success' : transfer.status === 'otp' ? 'otp-required' : 'pending';
  payout.transferCode = transfer.transfer_code;
  payout.updatedAt = new Date().toISOString();
}

app.disable('x-powered-by');
app.post('/api/payments/webhook', express.raw({ type: 'application/json', limit: '100kb' }), async (request: Request, response: Response) => {
  if (!paystackSecret) return response.sendStatus(503);
  const signature = request.get('x-paystack-signature') || '';
  const expected = crypto.createHmac('sha512', paystackSecret).update(request.body as Buffer).digest();
  let actual: Buffer;
  try { actual = Buffer.from(signature, 'hex'); } catch { return response.sendStatus(401); }
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return response.sendStatus(401);
  try {
    const event = JSON.parse((request.body as Buffer).toString('utf8'));
    if (event.event === 'charge.success' && event.data?.reference) await completePayment(event.data.reference, event.data);
    if (['transfer.success', 'transfer.failed', 'transfer.reversed'].includes(event.event) && event.data?.reference) {
      const payout = state.payouts.find((item) => item.reference === event.data.reference);
      if (payout) {
        payout.status = event.event === 'transfer.success' ? 'success' : event.event === 'transfer.failed' ? 'failed' : 'reversed';
        payout.updatedAt = new Date().toISOString();
        saveState();
      }
    }
    return response.sendStatus(200);
  } catch {
    return response.sendStatus(400);
  }
});

app.use(express.json({ limit: '100kb' }));
app.use(express.static(path.join(__dirname, '..', 'public')));
app.use('/uploads', express.static(uploadDirectory, { fallthrough: false, maxAge: '1d' }));

app.get('/api/health', (_request, response) => response.json({ status: 'ok', payments: paystackSecret ? 'configured' : 'not-configured' }));
app.get('/api/payout/banks', asyncRoute(async (request, response) => {
  const user = requireUser(request);
  if (!['seller', 'provider', 'dispatch'].includes(user.role)) fail(403, 'Payout accounts are only available to marketplace earners.');
  if (!paystackSecret) fail(503, 'Paystack payouts are not configured.');
  const banks = await paystackRequest('bank?currency=NGN&perPage=200');
  response.json({ banks: banks.filter((bank: any) => bank.active !== false).map((bank: any) => ({ name: bank.name, code: bank.code })) });
}));
app.get('/api/payout/account', (request, response) => {
  const user = requireUser(request);
  response.json({ account: user.payoutAccount ? { bankName: user.payoutAccount.bankName, accountName: user.payoutAccount.accountName, accountLast4: user.payoutAccount.accountLast4 } : null });
});
app.post('/api/payout/account', asyncRoute(async (request, response) => {
  const user = requireUser(request);
  if (!['seller', 'provider', 'dispatch'].includes(user.role)) fail(403, 'Payout accounts are only available to marketplace earners.');
  if (!paystackSecret) fail(503, 'Paystack payouts are not configured.');
  const accountNumber = request.body?.accountNumber;
  const bankCode = request.body?.bankCode;
  if (typeof accountNumber !== 'string' || !/^\d{10}$/.test(accountNumber) || typeof bankCode !== 'string' || !/^[\w-]{2,20}$/.test(bankCode)) fail(400, 'Enter a valid 10-digit account number and select a bank.');
  const resolved = await paystackRequest(`bank/resolve?account_number=${encodeURIComponent(accountNumber)}&bank_code=${encodeURIComponent(bankCode)}`);
  if (typeof resolved.account_name !== 'string' || !resolved.account_name.trim()) fail(400, 'Paystack could not verify that bank account.');
  const recipient = await paystackRequest('transferrecipient', {
    type: 'nuban', name: resolved.account_name, account_number: accountNumber, bank_code: bankCode, currency: 'NGN'
  });
  user.payoutAccount = {
    recipientCode: recipient.recipient_code,
    bankName: resolved.bank_name || recipient.details?.bank_name || 'Nigerian bank',
    accountName: resolved.account_name,
    accountLast4: accountNumber.slice(-4)
  };
  saveState();
  response.status(201).json({ account: { bankName: user.payoutAccount.bankName, accountName: user.payoutAccount.accountName, accountLast4: user.payoutAccount.accountLast4 } });
}));
app.get('/api/payouts', (request, response) => {
  const user = requireUser(request);
  response.json({ availableBalanceNaira: availableBalanceFor(user.id), payouts: state.payouts.filter((payout) => payout.userId === user.id).map(payoutResponse) });
});
app.post('/api/payouts/withdraw', asyncRoute(async (request, response) => {
  const user = requireUser(request);
  if (!['seller', 'provider', 'dispatch'].includes(user.role)) fail(403, 'Withdrawals are only available to marketplace earners.');
  if (!paystackSecret) fail(503, 'Paystack payouts are not configured.');
  if (!user.payoutAccount?.recipientCode) fail(409, 'Set up and verify a bank account before withdrawing.');
  const amountNaira = Number(request.body?.amountNaira);
  if (!Number.isSafeInteger(amountNaira) || amountNaira < 100) fail(400, 'Enter a withdrawal amount of at least ₦100.');
  if (amountNaira > availableBalanceFor(user.id)) fail(409, 'The withdrawal amount exceeds your available balance.');
  const payout: any = {
    id: randomBytes(12).toString('hex'), userId: user.id, reference: `uni-${Date.now()}-${randomBytes(8).toString('hex')}`,
    amountNaira, status: 'initializing', createdAt: new Date().toISOString()
  };
  state.payouts.push(payout);
  saveState();
  try {
    const transfer = await paystackRequest('transfer', {
      source: 'balance', amount: amountNaira * 100, recipient: user.payoutAccount.recipientCode,
      reference: payout.reference, reason: `Unishop earnings withdrawal for ${user.username || user.id}`
    });
    updatePayoutFromTransfer(payout, transfer);
    saveState();
    response.status(201).json({ payout: payoutResponse(payout), availableBalanceNaira: availableBalanceFor(user.id) });
  } catch (error) {
    if (!['success', 'failed', 'reversed'].includes(payout.status)) {
      payout.status = 'needs-review';
      payout.updatedAt = new Date().toISOString();
    }
    saveState();
    throw error;
  }
}));
app.post('/api/payouts/:reference/retry', asyncRoute(async (request, response) => {
  const user = requireUser(request);
  const payout = state.payouts.find((item) => item.reference === request.params.reference && item.userId === user.id);
  if (!payout || payout.status !== 'needs-review') fail(404, 'Retryable withdrawal not found.');
  if (!user.payoutAccount?.recipientCode || !paystackSecret) fail(503, 'Paystack payout details are unavailable.');
  const transfer = await paystackRequest('transfer', {
    source: 'balance', amount: payout.amountNaira * 100, recipient: user.payoutAccount.recipientCode,
    reference: payout.reference, reason: `Unishop earnings withdrawal for ${user.username || user.id}`
  });
  updatePayoutFromTransfer(payout, transfer);
  saveState();
  response.json({ payout: payoutResponse(payout), availableBalanceNaira: availableBalanceFor(user.id) });
}));
app.get('/api/products', (_request, response) => response.json([...catalog, ...state.sellerProducts]));
app.get('/api/services/niches', (_request, response) => response.json(serviceNiches.map((name) => ({ name, image: nicheImages[name] }))));
app.get('/api/services', (_request, response) => {
  const reviewsByListing: Record<string, any[]> = {};
  state.reviews.forEach((review) => { (reviewsByListing[review.listingId] ||= []).push(review); });
  const userListings = state.serviceListings.map((listing) => {
    const reviews = reviewsByListing[listing.id] || [];
    return { ...listing, reviews, reviewCount: reviews.length, rating: reviews.length ? reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length : 0 };
  });
  response.json([...userListings, ...providers]);
});

app.post('/api/uploads/portfolio', (request: Request, response: Response, next: NextFunction) => {
  const user = authenticatedUser(request);
  if (!user || !['provider', 'seller'].includes(user.role)) return response.status(403).json({ error: 'Sign in as a provider or seller to upload work.' });
  imageUpload.array('images', 6)(request, response, (error: any) => {
    if (error) return response.status(400).json({ error: error.code === 'LIMIT_FILE_SIZE' ? 'Each photo must be 5 MB or smaller.' : error.message || 'The photos could not be uploaded.' });
    const files = (request.files || []) as Express.Multer.File[];
    response.status(201).json({ images: files.map((file) => `/uploads/${file.filename}`) });
  });
});

app.post('/api/uploads/product-video', (request: Request, response: Response) => {
  const user = authenticatedUser(request);
  if (!user || user.role !== 'seller') return response.status(403).json({ error: 'Sign in as a seller to upload product videos.' });
  productVideoUpload.single('video')(request, response, (error: any) => {
    if (error) return response.status(400).json({ error: error.code === 'LIMIT_FILE_SIZE' ? 'Product video must be 40 MB or smaller.' : error.message || 'The video could not be uploaded.' });
    if (!request.file) return response.status(400).json({ error: 'Choose an MP4 or WebM product video.' });
    response.status(201).json({ video: `/uploads/${request.file.filename}` });
  });
});

app.get('/api/dashboard', (request: Request, response: Response) => {
  const user = requireUser(request);
  const payoutAccount = user.payoutAccount ? { bankName: user.payoutAccount.bankName, accountName: user.payoutAccount.accountName, accountLast4: user.payoutAccount.accountLast4 } : null;
  const payouts = state.payouts.filter((payout) => payout.userId === user.id).map(payoutResponse);
  const payoutMetrics = { availableBalanceNaira: availableBalanceFor(user.id), payoutAccount, payouts };
  if (user.role === 'provider') {
    const listings = state.serviceListings.filter((listing) => listing.userId === user.id);
    const listingIds = new Set(listings.map((listing) => listing.id));
    const bookings = state.bookings.filter((booking) => booking.providerUserId === user.id || listingIds.has(booking.providerId));
    const earnings = bookings.filter((booking) => booking.paymentStatus === 'paid').reduce((sum, booking) => sum + (booking.amountNaira || 0), 0);
    const reviews = state.reviews.filter((review) => listingIds.has(review.listingId));
    return response.json({ role: user.role, user: cleanUser(user), listings, bookings, reviews, ...payoutMetrics, metrics: { listingCount: listings.length, bookingCount: bookings.length, rating: reviews.length ? reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length : 0, grossEarnings: earnings, ...payoutMetrics }, niches: serviceNiches });
  }
  if (user.role === 'seller') {
    const products = state.sellerProducts.filter((product) => product.userId === user.id);
    const orders = state.orders.filter((order) => order.paymentStatus === 'paid' && order.items.some((item: any) => item.sellerUserId === user.id));
    const grossSales = orders.reduce((sum, order) => sum + order.items.filter((item: any) => item.sellerUserId === user.id).reduce((sub: number, item: any) => sub + item.lineTotal, 0), 0);
    return response.json({ role: user.role, user: cleanUser(user), products, orders: orders.map(safeOrder), ...payoutMetrics, metrics: { productCount: products.length, orderCount: orders.length, grossSales, ...payoutMetrics } });
  }
  if (user.role === 'dispatch') {
    const jobs = state.orders.filter((order) => order.type !== 'service' && order.paymentStatus === 'paid' && (!order.dispatchRiderId || order.dispatchRiderId === user.id));
    const completed = jobs.filter((order) => order.deliveryStatus === 'delivered' && order.dispatchRiderId === user.id);
    const earnings = completed.reduce((sum, order) => sum + (order.riderSettlementNaira || order.dispatchFeeNaira || 0), 0);
    const riderJobs = jobs.map((order) => {
      const { email, userId, authorizationUrl, ...job } = safeOrder(order);
      job.riderSettlementNaira = order.riderSettlementNaira;
      if (order.dispatchRiderId !== user.id) {
        delete job.address;
        delete job.phone;
        delete job.customerName;
      } else {
        job.address = order.address;
        job.phone = order.phone;
        job.customerName = order.customerName;
      }
      return job;
    });
    return response.json({ role: user.role, user: cleanUser(user), jobs: riderJobs, ...payoutMetrics, metrics: { availableJobs: jobs.filter((order) => !order.dispatchRiderId).length, activeJobs: jobs.filter((order) => order.dispatchRiderId === user.id && order.deliveryStatus !== 'delivered').length, completedJobs: completed.length, grossEarnings: earnings, ...payoutMetrics } });
  }
  return response.json({ role: user.role, user: cleanUser(user), orders: state.orders.filter((order) => order.userId === user.id).map(safeOrder), bookings: state.bookings.filter((booking) => booking.userId === user.id) });
});

app.post('/api/provider/listings', (request: Request, response: Response) => {
  const user = requireUser(request);
  if (user.role !== 'provider') fail(403, 'Use a service provider account to create a service listing.');
  const { niche, title, description, price, portfolio } = request.body || {};
  if (!serviceNiches.includes(niche)) fail(400, 'Choose one of the available service niches.');
  if (typeof title !== 'string' || title.trim().length < 3 || title.length > 100) fail(400, 'Enter a service title.');
  if (typeof description !== 'string' || description.trim().length < 10 || description.length > 1500) fail(400, 'Describe your service in at least 10 characters.');
  if (!Number.isInteger(Number(price)) || Number(price) < 500 || Number(price) > 100000000) fail(400, 'Enter a valid price in Naira.');
  if (!Array.isArray(portfolio) || portfolio.length < 1 || portfolio.length > 6 || portfolio.some((image) => typeof image !== 'string' || !/^\/uploads\/[\w.-]+$/.test(image))) fail(400, 'Upload 1 to 6 work photos first.');
  const listing = { id: randomBytes(12).toString('hex'), userId: user.id, provider: user.name, businessName: user.businessName, niche, title: title.trim(), description: description.trim(), price: Number(price), neighbourhood: 'Uyo, Akwa Ibom', portfolio, createdAt: new Date().toISOString() };
  state.serviceListings.push(listing);
  user.niche = niche;
  saveState();
  response.status(201).json({ listing });
});

app.post('/api/seller/products', (request: Request, response: Response) => {
  const user = requireUser(request);
  if (user.role !== 'seller') fail(403, 'Use a seller account to add a product.');
  const { name, category, description, price, image, video } = request.body || {};
  if (typeof name !== 'string' || name.trim().length < 3 || name.length > 100) fail(400, 'Enter a product name.');
  if (!['Home', 'Fashion', 'Beauty', 'Tech', 'Food'].includes(category)) fail(400, 'Choose a valid product category.');
  if (typeof description !== 'string' || description.trim().length < 5) fail(400, 'Add a short product description.');
  if (!Number.isInteger(Number(price)) || Number(price) < 100 || Number(price) > 100000000) fail(400, 'Enter a valid price in Naira.');
  if (typeof image !== 'string' || !/^\/uploads\/[\w.-]+$/.test(image)) fail(400, 'Upload a product image first.');
  if (video !== undefined && (typeof video !== 'string' || !/^\/uploads\/[\w.-]+\.(mp4|webm)$/.test(video))) fail(400, 'Upload a valid MP4 or WebM product video.');
  const product = { id: `seller-${randomBytes(10).toString('hex')}`, userId: user.id, name: name.trim(), seller: user.businessName, category, description: description.trim(), price: Number(price), image, video, rating: null, reviews: 0, createdAt: new Date().toISOString() };
  state.sellerProducts.push(product);
  saveState();
  response.status(201).json({ product });
});

app.post('/api/orders/:reference/confirm-delivery', (request: Request, response: Response) => {
  const user = requireUser(request);
  if (user.role !== 'customer') fail(403, 'Only the customer can confirm delivery.');
  const order = state.orders.find((item) => item.reference === request.params.reference && item.userId === user.id && item.type === 'product');
  if (!order || order.paymentStatus !== 'paid') fail(404, 'Paid order not found.');
  if (order.deliveryStatus !== 'delivered') fail(409, 'The rider must mark the order delivered before you can confirm it.');
  if (!releaseSettlement(order)) fail(409, 'This order has already been confirmed.');
  order.orderStatus = 'completed';
  saveState();
  response.json({ order: safeOrder(order) });
});

app.patch('/api/provider/bookings/:id', (request: Request, response: Response) => {
  const user = requireUser(request);
  if (user.role !== 'provider') fail(403, 'Only a service provider can update a booking.');
  const booking = state.bookings.find((item) => item.id === request.params.id && item.providerUserId === user.id);
  if (!booking) fail(404, 'Booking not found.');
  const status = request.body?.status;
  if (booking.paymentStatus !== 'paid') fail(409, 'This booking must be paid before it can be accepted.');
  if (!['accepted', 'declined', 'completed'].includes(status)) fail(400, 'Choose a valid booking status.');
  booking.status = status;
  booking.updatedAt = new Date().toISOString();
  saveState();
  response.json({ booking });
});

app.post('/api/bookings/:id/confirm-completion', (request: Request, response: Response) => {
  const user = requireUser(request);
  if (user.role !== 'customer') fail(403, 'Only the customer can confirm service completion.');
  const booking = state.bookings.find((item) => item.id === request.params.id && item.userId === user.id);
  if (!booking || booking.paymentStatus !== 'paid') fail(404, 'Paid service booking not found.');
  if (booking.status !== 'completed') fail(409, 'The provider must mark the service complete before you can confirm it.');
  const order = state.orders.find((item) => item.bookingId === booking.id && item.paymentStatus === 'paid');
  if (!order || !releaseSettlement(order)) fail(409, 'This booking has already been confirmed or has no payable settlement.');
  saveState();
  response.json({ booking });
});

app.post('/api/services/:id/reviews', (request: Request, response: Response) => {
  const user = requireUser(request);
  if (user.role !== 'customer') fail(403, 'Only customers can leave a service review.');
  const listing = state.serviceListings.find((item) => item.id === request.params.id);
  const booking = state.bookings.find((item) => item.userId === user.id && item.providerId === request.params.id && item.status === 'completed');
  if (!listing || !booking) fail(403, 'Complete a booking with this provider before reviewing.');
  if (booking.reviewedAt || state.reviews.some((review) => review.userId === user.id && review.listingId === listing.id)) fail(409, 'You have already reviewed this completed booking.');
  const rating = Number(request.body?.rating);
  const comment = request.body?.comment;
  if (!Number.isInteger(rating) || rating < 1 || rating > 5 || typeof comment !== 'string' || comment.trim().length < 2) fail(400, 'Add a rating and short comment.');
  const review = { id: randomBytes(10).toString('hex'), listingId: listing.id, userId: user.id, reviewer: user.name, rating, comment: comment.trim().slice(0, 500), createdAt: new Date().toISOString() };
  state.reviews.push(review);
  booking.reviewedAt = review.createdAt;
  saveState();
  response.status(201).json({ review });
});

app.patch('/api/dispatch/jobs/:reference', (request: Request, response: Response) => {
  const user = requireUser(request);
  if (user.role !== 'dispatch') fail(403, 'Use a dispatch rider account to update a delivery.');
  const order = state.orders.find((item) => item.reference === request.params.reference && item.paymentStatus === 'paid');
  if (!order) fail(404, 'Paid delivery job not found.');
  const status = request.body?.status;
  if (status === 'accept' && !order.dispatchRiderId) {
    order.dispatchRiderId = user.id;
    order.deliveryStatus = 'assigned';
  } else if (order.dispatchRiderId === user.id && ['picked-up', 'delivered'].includes(status)) {
    order.deliveryStatus = status;
    if (status === 'delivered') order.deliveredAt = new Date().toISOString();
  } else {
    fail(409, 'This delivery is assigned to another rider or the status is invalid.');
  }
  saveState();
  response.json({ order: safeOrder(order) });
});

app.post('/api/auth/register', asyncRoute(async (request: Request, response: Response) => {
  const { name, username, email, password, role, businessName, niche } = request.body || {};
  if (typeof name !== 'string' || name.trim().length < 2 || name.length > 100) fail(400, 'Enter your full name.');
  if (typeof username !== 'string' || !/^[a-zA-Z0-9._-]{3,30}$/.test(username.trim())) fail(400, 'Choose a username with 3–30 letters, numbers, dots, underscores or hyphens.');
  if (typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) fail(400, 'Enter a valid email address.');
  if (typeof password !== 'string' || password.length < 10 || password.length > 128) fail(400, 'Use a password with at least 10 characters.');
  if (!roles.includes(role)) fail(400, 'Choose a valid account type.');
  if (role === 'provider' && !serviceNiches.includes(niche)) fail(400, 'Choose an available service niche.');
  if (state.users.some((user) => (user.username || legacyUsername(user)).toLowerCase() === username.trim().toLowerCase())) fail(409, 'That username is already taken.');
  if (state.users.some((user) => user.email.toLowerCase() === email.toLowerCase() && user.role === role)) fail(409, 'This email already has an account for that role. Choose another role or sign in.');
  if (role !== 'customer' && (typeof businessName !== 'string' || businessName.trim().length < 2)) fail(400, 'Enter your shop, service or delivery area name.');
  const user: User = {
    id: randomBytes(16).toString('hex'), name: name.trim(), username: username.trim().toLowerCase(), email: email.trim().toLowerCase(), role,
    businessName: typeof businessName === 'string' ? businessName.trim() : undefined,
    niche: role === 'provider' ? niche : undefined,
    passwordHash: await bcrypt.hash(password, 12), createdAt: new Date().toISOString()
  };
  state.users.push(user);
  saveState();
  response.status(201).json({ token: tokenFor(user), user: cleanUser(user) });
}));

app.post('/api/auth/login', asyncRoute(async (request: Request, response: Response) => {
  const { username, password } = request.body || {};
  if (typeof username !== 'string' || typeof password !== 'string') fail(400, 'Enter your username and password.');
  const user = state.users.find((item) => (item.username || legacyUsername(item)).toLowerCase() === username.trim().toLowerCase());
  if (!user || !await bcrypt.compare(password, user.passwordHash)) fail(401, 'Username or password is incorrect.');
  response.json({ token: tokenFor(user), user: cleanUser(user) });
}));

app.get('/api/me', (request: Request, response: Response) => response.json({ user: cleanUser(requireUser(request)) }));
app.get('/api/me/orders', (request: Request, response: Response) => {
  const user = requireUser(request);
  response.json(state.orders.filter((order) => order.userId === user.id).map(safeOrder));
});
app.get('/api/me/bookings', (request: Request, response: Response) => {
  const user = requireUser(request);
  response.json(state.bookings.filter((booking) => booking.userId === user.id));
});

app.post('/api/bookings', (request: Request, response: Response) => {
  const user = requireUser(request);
  if (user.role !== 'customer') fail(403, 'Use a customer account to book a service.');
  const { providerId, neighbourhood, time, note } = request.body || {};
  const provider = state.serviceListings.find((person) => person.id === providerId) || providers.find((person) => person.id === providerId);
  if (!provider || typeof neighbourhood !== 'string' || neighbourhood.trim().length < 2 || typeof time !== 'string') fail(400, 'Complete the service booking details.');
  const providerUserId = provider.userId;
  const booking = { id: randomBytes(12).toString('hex'), userId: user.id, providerUserId, providerId, provider: provider.provider || provider.name, service: provider.title || provider.trade, amountNaira: provider.price, neighbourhood: neighbourhood.trim(), time, note: typeof note === 'string' ? note.slice(0, 1000) : '', status: 'requested', paymentStatus: 'unpaid', createdAt: new Date().toISOString() };
  state.bookings.push(booking);
  saveState();
  response.status(201).json({ booking });
});

app.post('/api/payments/initialize', asyncRoute(async (request: Request, response: Response) => {
  if (!paystackSecret) fail(503, 'Online payments are temporarily unavailable. Please try again later.');
  const { email, items, customer, delivery, bookingId } = request.body || {};
  const user = authenticatedUser(request);
  let orderItems: any[] = [];
  let settlementLines: any[] = [];
  let booking: any;
  let totalNaira: number;
  let customerName: string;
  let phone: string;
  let address: string;
  let neighbourhood: string;
  let receiptEmail: string;
  if (bookingId) {
    if (!user || user.role !== 'customer') fail(401, 'Sign in with a customer account to pay for this booking.');
    booking = state.bookings.find((item) => item.id === bookingId && item.userId === user.id && item.paymentStatus !== 'paid');
    if (!booking) fail(404, 'Unpaid service booking not found.');
    const serviceSubtotalNaira = Number(booking.amountNaira);
    const commissionNaira = commissionFor(serviceSubtotalNaira);
    const dispatchContributionNaira = 500;
    const providerNetNaira = serviceSubtotalNaira - commissionNaira - dispatchContributionNaira;
    if (providerNetNaira < 0) fail(400, 'The service price must cover its ₦500 dispatch contribution and Unishop commission.');
    settlementLines = booking.providerUserId ? [{ userId: booking.providerUserId, role: 'provider', subtotalNaira: serviceSubtotalNaira, commissionNaira, dispatchContributionNaira, netNaira: providerNetNaira }] : [];
    totalNaira = serviceSubtotalNaira + 500;
    orderItems = [{ productId: booking.providerId, name: booking.service, seller: booking.provider, unitPrice: totalNaira, quantity: 1, lineTotal: totalNaira, service: true }];
    customerName = user.name;
    phone = '';
    address = '';
    neighbourhood = booking.neighbourhood;
    receiptEmail = user.email;
  } else {
    if (!user || user.role !== 'customer') fail(401, 'Sign in with a customer account before checkout so you can confirm delivery.');
    if (typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail(400, 'Enter a valid email address for your receipt.');
    if (!Array.isArray(items) || items.length < 1 || items.length > 50) fail(400, 'Your bag is empty or invalid.');
    if (!customer || typeof customer.name !== 'string' || customer.name.trim().length < 2 || typeof customer.phone !== 'string' || customer.phone.trim().length < 7) fail(400, 'Enter your name and phone number.');
    if (!delivery || typeof delivery.address !== 'string' || delivery.address.trim().length < 5 || typeof delivery.neighbourhood !== 'string' || delivery.neighbourhood.trim().length < 2) fail(400, 'Enter your Uyo delivery address and neighbourhood.');
    orderItems = items.map((item: any) => {
      const product = catalog.find((entry) => entry.id === item.id) || state.sellerProducts.find((entry) => entry.id === item.id);
      const quantity = Number(item.quantity);
      if (!product || !Number.isInteger(quantity) || quantity < 1 || quantity > 10) fail(400, 'Your bag contains an invalid product or quantity.');
      return { productId: product.id, name: product.name, seller: product.seller || product.businessName, sellerUserId: product.userId, unitPrice: product.price, quantity, lineTotal: product.price * quantity };
    });
    settlementLines = sellerSettlementLines(orderItems);
    totalNaira = orderItems.reduce((sum: number, item: any) => sum + item.lineTotal, 0) + 500;
    customerName = customer.name.trim();
    phone = customer.phone.trim();
    address = delivery.address.trim();
    neighbourhood = delivery.neighbourhood.trim();
    receiptEmail = email.trim().toLowerCase();
  }
  const reference = `UNI-${Date.now()}-${randomBytes(6).toString('hex')}`;
  const order = {
    id: randomBytes(12).toString('hex'), reference, type: booking ? 'service' : 'product', bookingId: booking?.id, userId: user?.id, email: receiptEmail,
    customerName, phone, address, neighbourhood,
    items: orderItems, totalNaira, dispatchFeeNaira: booking ? 0 : 500,
    customerDispatchFeeNaira: booking ? 500 : 0,
    sellerDispatchContributionNaira: settlementLines.reduce((sum, line) => sum + line.dispatchContributionNaira, 0),
    riderSettlementNaira: booking ? 0 : 500 + settlementLines.reduce((sum, line) => sum + line.dispatchContributionNaira, 0),
    settlementLines, settlementStatus: 'held', amountKobo: totalNaira * 100, currency: 'NGN', paymentStatus: 'pending', orderStatus: 'awaiting-payment',
    authorizationUrl: undefined as string | undefined, createdAt: new Date().toISOString()
  };
  state.orders.push(order);
  saveState();

  try {
    const payment = await paystackRequest('transaction/initialize', {
      email: order.email, amount: order.amountKobo, currency: 'NGN', reference,
      callback_url: callbackUrl,
      metadata: { order_id: order.id, booking_id: order.bookingId, customer_name: order.customerName, phone: order.phone, neighbourhood: order.neighbourhood, custom_fields: [{ display_name: 'Unishop order', variable_name: 'unishop_order', value: reference }] }
    });
    order.authorizationUrl = payment.authorization_url;
    saveState();
    response.status(201).json({ reference, authorizationUrl: payment.authorization_url, order: safeOrder(order) });
  } catch (error) {
    order.paymentStatus = 'initialization-failed';
    saveState();
    throw error;
  }
}));

app.get('/api/payments/verify/:reference', asyncRoute(async (request: Request, response: Response) => {
  if (!paystackSecret) fail(503, 'Payments are not configured.');
  const reference = String(request.params.reference || '');
  const order = state.orders.find((item) => item.reference === reference);
  if (!order) fail(404, 'Order not found.');
  if (order.paymentStatus === 'paid') return response.json({ order: safeOrder(order) });
  const payment = await paystackRequest(`transaction/verify/${encodeURIComponent(reference)}`);
  await completePayment(reference, payment);
  response.json({ order: safeOrder(order) });
}));

app.get('/api/orders/:reference', (request: Request, response: Response) => {
  const order = state.orders.find((item) => item.reference === request.params.reference);
  if (!order) fail(404, 'Order not found.');
  const user = authenticatedUser(request);
  if (order.userId && order.userId !== user?.id) fail(403, 'Sign in to view this order.');
  response.json({ order: safeOrder(order) });
});

app.use('/api', (request: Request, _response: Response, next: NextFunction) => next(Object.assign(new Error(`API route not found: ${request.method} ${request.path}`), { status: 404 })));
app.use((error: ApiError, _request: Request, response: Response, _next: NextFunction) => {
  const status = error.status || 500;
  if (status >= 500) console.error('Request failed:', error.message);
  const publicMessage = status === 503 ? error.message : status >= 500 ? 'The request could not be completed. Please try again.' : error.message;
  response.status(status).json({ error: publicMessage });
});

const port = Number(process.env.PORT) || 3000;
if (require.main === module) {
  app.listen(port, () => console.log(`Unishop is running on http://localhost:${port}`));
}

export default app;