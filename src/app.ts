import express, { NextFunction, Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import crypto, { randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'crypto';
import { promisify } from 'util';
import dotenv from 'dotenv';
import multer from 'multer';
import bcrypt from 'bcrypt';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import jwt from 'jsonwebtoken';
import { z } from 'zod';

dotenv.config();

const app = express();
const scrypt = promisify(scryptCallback);
const roles = ['customer', 'seller', 'provider', 'dispatch', 'admin'] as const;
const registrationRoles = ['customer', 'seller', 'provider', 'dispatch'] as const;
type Role = typeof roles[number];
type User = { id: string; name: string; username?: string; email: string; role: Role; businessName?: string; position?: string; placeOfOperation?: string; aboutMe?: string; profileImage?: string; niche?: string; payoutAccount?: { recipientCode: string; bankName: string; accountName: string; accountLast4: string }; passwordHash: string; createdAt: string; emailVerified?: boolean; otpCode?: string; otpExpiresAt?: number; lastLoginAt?: string; failedLoginCount?: number; suspendedAt?: string; suspensionReason?: string; };
type MarketplaceState = { users: User[]; orders: any[]; bookings: any[]; serviceListings: any[]; sellerProducts: any[]; reviews: any[]; payouts: any[]; auditLogs: any[] };
type ApiError = Error & { status?: number };
const accessTokenCookieName = 'unishop-access';
const refreshTokenCookieName = 'unishop-refresh';
const loginAttempts = new Map<string, { count: number; lockUntil: number }>();
const deleteHtmlTags = /<[^>]*>/g;
const corporateFrontendDomains = [
  process.env.FRONTEND_URL,
  'http://localhost:3000',
  'http://localhost:3001',
  'https://localhost:3000',
  'https://localhost:3001'
].filter(Boolean) as string[];
const registerSchema = z.object({
  name: z.string().trim().min(2).max(100),
  username: z.string().trim().min(3).max(30).regex(/^[A-Za-z0-9._-]+$/),
  email: z.string().trim().email().max(254),
  password: z.string().min(10).max(128),
  role: z.enum(registrationRoles),
  businessName: z.preprocess((value) => value === '' ? undefined : value, z.string().trim().min(2).max(120).optional()),
  niche: z.string().trim().max(80).optional()
});
const loginSchema = z.object({
  username: z.string().trim().min(3).max(30),
  password: z.string().min(10).max(128)
});
const sanitizeText = (value: unknown, fallback = '') => {
  if (typeof value !== 'string') return fallback;
  return value.replace(deleteHtmlTags, '').trim().slice(0, 2000);
};
function generateOtp() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}
function issueSignedToken(user: User, type: 'access' | 'refresh') {
  const expiresIn = type === 'access' ? '15m' : '7d';
  return jwt.sign({ sub: user.id, role: user.role, type }, jwtSecret, { expiresIn });
}
function setAuthCookies(response: Response, accessToken: string, refreshToken?: string) {
  const secureCookie = process.env.NODE_ENV === 'production';
  response.cookie(accessTokenCookieName, accessToken, { httpOnly: true, secure: secureCookie, sameSite: 'lax', maxAge: 15 * 60 * 1000 });
  if (refreshToken) {
    response.cookie(refreshTokenCookieName, refreshToken, { httpOnly: true, secure: secureCookie, sameSite: 'lax', maxAge: 7 * 24 * 60 * 60 * 1000 });
  }
}
function getTokenFromRequest(request: Request) {
  const cookieToken = request.cookies?.[accessTokenCookieName];
  if (cookieToken) return cookieToken;
  return request.get('authorization')?.replace(/^Bearer\s+/i, '');
}
function getLoginFailureKey(username: string) {
  return username.trim().toLowerCase();
}
function isLoginLocked(username: string) {
  const key = getLoginFailureKey(username);
  const current = loginAttempts.get(key);
  if (!current) return false;
  if (current.lockUntil > Date.now()) return true;
  loginAttempts.delete(key);
  return false;
}
function recordFailedLogin(username: string) {
  const key = getLoginFailureKey(username);
  const current = loginAttempts.get(key) || { count: 0, lockUntil: 0 };
  const updated = { count: current.count + 1, lockUntil: current.count + 1 >= 5 ? Date.now() + 15 * 60 * 1000 : 0 };
  loginAttempts.set(key, updated);
  return updated;
}
function clearLoginFailure(username: string) {
  loginAttempts.delete(getLoginFailureKey(username));
}
function requireAdmin(request: Request): User {
  const user = requireUser(request);
  if (user.id !== adminIdentity.id) fail(403, 'Admin access is required.');
  return user;
}

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
const adminIdentity: User = { id: 'railway-admin', name: 'Unishop Administrator', username: 'admin', email: 'admin@unishop.local', role: 'admin', passwordHash: '', createdAt: '2026-01-01T00:00:00.000Z' };
const paystackSecret = process.env.PAYSTACK_SECRET_KEY || '';
const callbackUrl = `${(process.env.PUBLIC_APP_URL || process.env.RENDER_EXTERNAL_URL || 'http://localhost:3000').replace(/\/$/, '')}/?payment=return`;

if (process.env.NODE_ENV === 'production' && (!process.env.JWT_SECRET || !process.env.PAYSTACK_SECRET_KEY)) {
  throw new Error('JWT_SECRET and PAYSTACK_SECRET_KEY must be configured in production.');
}

function loadState(): MarketplaceState {
  try {
    const parsed = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
    return { users: parsed.users || [], orders: parsed.orders || [], bookings: parsed.bookings || [], serviceListings: parsed.serviceListings || [], sellerProducts: parsed.sellerProducts || [], reviews: parsed.reviews || [], payouts: parsed.payouts || [], auditLogs: parsed.auditLogs || [] };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    return { users: [], orders: [], bookings: [], serviceListings: [], sellerProducts: [], reviews: [], payouts: [], auditLogs: [] };
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
  return { id: user.id, name: user.name, username: user.username || legacyUsername(user), email: user.email, role: user.role, businessName: user.businessName, position: user.position, placeOfOperation: user.placeOfOperation, aboutMe: user.aboutMe, profileImage: user.profileImage, niche: user.niche, createdAt: user.createdAt };
}

function publicBusinessProfile(userId: string | undefined) {
  const user = state.users.find((member) => member.id === userId && !member.suspendedAt);
  if (!user || !['seller', 'provider'].includes(user.role)) return undefined;
  return { name: user.name, businessName: user.businessName || '', position: user.position || '', placeOfOperation: user.placeOfOperation || '', aboutMe: user.aboutMe || '', profileImage: user.profileImage || '', role: user.role };
}

function hasCompleteBusinessProfile(user: User) {
  return Boolean(user.name.trim() && user.businessName?.trim() && user.position?.trim() && user.placeOfOperation?.trim() && user.aboutMe?.trim() && user.profileImage?.startsWith('/uploads/'));
}

function legacyUsername(user: User) {
  const emailName = user.email.split('@')[0].toLowerCase().replace(/[^a-z0-9._-]/g, '-').slice(0, 20) || 'unishop-user';
  return `${emailName}-${user.role}`;
}

function tokenFor(user: User) {
  return issueSignedToken(user, 'access');
}

function refreshTokenFor(user: User) {
  return issueSignedToken(user, 'refresh');
}

function authenticatedUser(request: Request): User | undefined {
  const token = getTokenFromRequest(request);
  if (!token) return undefined;
  try {
    const payload = jwt.verify(token, jwtSecret) as { sub: string; type?: 'access' | 'refresh'; role?: Role };
    if (payload.type && payload.type !== 'access') return undefined;
    if (payload.sub === adminIdentity.id && payload.role === 'admin') return adminIdentity;
    const user = state.users.find((member) => member.id === payload.sub);
    return !user || user.role === 'admin' || user.suspendedAt ? undefined : user;
  } catch {
    return undefined;
  }
}

function requireUser(request: Request): User {
  const user = authenticatedUser(request);
  if (!user) fail(401, 'Sign in to continue.');
  return user;
}

function auditAction(action: string, actorId: string | undefined, details: Record<string, unknown> = {}) {
  state.auditLogs = state.auditLogs || [];
  state.auditLogs.push({ id: randomBytes(8).toString('hex'), createdAt: new Date().toISOString(), action, actorId, details });
  saveState();
}

function isAccountSuspended(userId: string | undefined) {
  return Boolean(userId && state.users.some((user) => user.id === userId && user.suspendedAt));
}

function matchesAdminPassword(supplied: string, expected: string) {
  const suppliedDigest = crypto.createHash('sha256').update(supplied).digest();
  const expectedDigest = crypto.createHash('sha256').update(expected).digest();
  return timingSafeEqual(suppliedDigest, expectedDigest);
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
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      imgSrc: ["'self'", 'data:', 'blob:', 'https://images.unsplash.com', 'https://images.pexels.com'],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      fontSrc: ["'self'", 'data:', 'https://fonts.gstatic.com'],
      connectSrc: ["'self'", 'https://api.paystack.co'],
      objectSrc: ["'none'"]
    }
  },
  hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
  frameguard: { action: 'deny' },
  noSniff: true,
  xssFilter: true
}));
app.use(cors({
  origin: (origin: string | undefined, callback: (error: Error | null, allow?: boolean) => void) => {
    if (!origin || corporateFrontendDomains.includes(origin)) return callback(null, true);
    return callback(new Error('Origin not allowed by CORS policy.'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(cookieParser());
app.use(express.json({
  limit: '100kb',
  verify: (request: Request, _response: Response, body: Buffer) => {
    if (request.originalUrl === '/api/payments/webhook') (request as Request & { rawBody?: Buffer }).rawBody = Buffer.from(body);
  }
}));
app.use((request: Request, response: Response, next: NextFunction) => {
  if (process.env.NODE_ENV === 'production' && !request.secure && request.get('x-forwarded-proto') !== 'https') {
    return response.redirect(`https://${request.get('host')}${request.originalUrl}`);
  }
  response.setHeader('Cache-Control', 'no-store');
  response.setHeader('X-Content-Type-Options', 'nosniff');
  next();
});
const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  handler: (_request, response) => response.status(429).json({ error: 'Too many failed login attempts. Please try again in 15 minutes.' })
});
const adminRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  handler: (_request, response) => response.status(429).json({ error: 'Too many failed admin sign-in attempts. Please try again in 15 minutes.' })
});
app.use('/api/auth/login', authRateLimiter);
app.use('/api/admin/login', adminRateLimiter);
app.post('/api/payments/webhook', express.raw({ type: 'application/json', limit: '100kb' }), async (request: Request, response: Response) => {
  if (!paystackSecret) return response.sendStatus(503);
  const rawBody = (request as Request & { rawBody?: Buffer }).rawBody;
  if (!rawBody) return response.sendStatus(400);
  const signature = request.get('x-paystack-signature') || '';
  const expected = crypto.createHmac('sha512', paystackSecret).update(rawBody).digest();
  let actual: Buffer;
  try { actual = Buffer.from(signature, 'hex'); } catch { return response.sendStatus(401); }
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return response.sendStatus(401);
  try {
    const event = JSON.parse(rawBody.toString('utf8'));
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

app.use(express.static(path.join(__dirname, '..', 'public')));
app.use('/uploads', express.static(uploadDirectory, { fallthrough: false, maxAge: '1d' }));

app.get('/admin', (_request, response) => {
  if (!process.env.ADMIN_APP_URL) return response.status(503).send('The separate Unishop admin console has not been configured yet.');
  response.redirect(302, process.env.ADMIN_APP_URL);
});
app.get('/dashboard', (_request, response) => response.redirect('/dashboard.html'));

app.get('/api/health', (_request, response) => response.json({ status: 'ok', payments: paystackSecret ? 'configured' : 'not-configured' }));
app.post('/api/admin/login', (request: Request, response: Response) => {
  const expectedPassword = process.env.ADMIN_PASSWORD;
  const password = request.body?.password;
  if (!expectedPassword) fail(503, 'Admin access is not configured.');
  if (typeof password !== 'string' || password.length > 256 || !matchesAdminPassword(password, expectedPassword)) {
    auditAction('admin.login.failed', undefined, { ip: request.ip });
    fail(401, 'The admin password is incorrect.');
  }
  const token = tokenFor(adminIdentity);
  auditAction('admin.login.succeeded', adminIdentity.id, { ip: request.ip });
  response.json({ token, user: cleanUser(adminIdentity) });
});
app.get('/api/admin/dashboard', (request, response) => {
  const admin = requireAdmin(request);
  const nonAdminUsers = state.users.filter((user) => user.role !== 'admin');
  const paidOrders = state.orders.filter((order) => order.paymentStatus === 'paid');
  const activeListings = state.sellerProducts.filter((product) => !isAccountSuspended(product.userId)).length + state.serviceListings.filter((listing) => !isAccountSuspended(listing.userId)).length;
  const roleCounts: Record<string, number> = { customer: 0, seller: 0, provider: 0, dispatch: 0 };
  nonAdminUsers.forEach((user) => { roleCounts[user.role] = (roleCounts[user.role] || 0) + 1; });
  const countBy = (records: any[], key: string) => records.reduce((counts: Record<string, number>, record) => {
    const value = String(record[key] || 'unknown');
    counts[value] = (counts[value] || 0) + 1;
    return counts;
  }, {});
  response.json({
    user: cleanUser(admin),
    metrics: {
      totalUsers: nonAdminUsers.length,
      suspendedUsers: nonAdminUsers.filter((user) => user.suspendedAt).length,
      totalOrders: state.orders.length,
      paidOrders: paidOrders.length,
      totalBookings: state.bookings.length,
      totalRevenue: paidOrders.reduce((sum, order) => sum + Number(order.totalNaira || 0), 0),
      totalListings: state.sellerProducts.length + state.serviceListings.length,
      activeListings,
      totalPayouts: state.payouts.length,
      auditEntries: state.auditLogs.length,
      pendingPayments: state.orders.filter((order) => ['pending', 'initialization-failed'].includes(order.paymentStatus)).length
    },
    breakdown: {
      roles: roleCounts,
      orders: countBy(state.orders, 'paymentStatus'),
      bookings: countBy(state.bookings, 'status'),
      payouts: countBy(state.payouts, 'status'),
      catalog: { products: state.sellerProducts.length, services: state.serviceListings.length }
    }
  });
});
app.get('/api/admin/records', (request, response) => {
  requireAdmin(request);
  const kinds = ['users', 'orders', 'bookings', 'listings', 'payouts', 'audit'] as const;
  const kind = request.query.kind;
  if (typeof kind !== 'string' || !kinds.includes(kind as typeof kinds[number])) fail(400, 'Choose a valid admin record type.');
  const limit = Math.min(100, Math.max(1, Number.parseInt(String(request.query.limit || '50'), 10) || 50));
  const offset = Math.max(0, Number.parseInt(String(request.query.offset || '0'), 10) || 0);
  const search = typeof request.query.search === 'string' ? request.query.search.trim().toLowerCase().slice(0, 100) : '';
  const userById = new Map(state.users.map((user) => [user.id, user]));
  const records: any[] = kind === 'users'
    ? state.users.filter((user) => user.role !== 'admin').map((user) => ({ ...cleanUser(user), suspendedAt: user.suspendedAt, suspensionReason: user.suspensionReason }))
    : kind === 'orders'
      ? state.orders.map((order) => {
        const customer = userById.get(order.userId);
        return { ...safeOrder(order), customerName: order.customerName || customer?.name || 'Guest', customerEmail: order.email || customer?.email || '', customerPhone: order.phone || '', deliveryAddress: order.address || '', customerId: order.userId };
      })
      : kind === 'bookings'
        ? state.bookings.map((booking) => ({ ...booking, customerName: userById.get(booking.userId)?.name || 'Customer', customerEmail: userById.get(booking.userId)?.email || '', providerName: userById.get(booking.providerUserId)?.name || booking.provider || 'Provider' }))
        : kind === 'listings'
          ? [
            ...state.sellerProducts.map((product) => ({ ...product, listingType: 'Product', ownerId: product.userId, ownerName: userById.get(product.userId)?.name || product.seller || 'Seller', ownerRole: 'seller', isSuspended: isAccountSuspended(product.userId) })),
            ...state.serviceListings.map((listing) => ({ ...listing, listingType: 'Service', ownerId: listing.userId, ownerName: userById.get(listing.userId)?.name || listing.provider || 'Provider', ownerRole: 'provider', isSuspended: isAccountSuspended(listing.userId) }))
          ]
          : kind === 'payouts'
            ? state.payouts.map((payout) => {
              const owner = userById.get(payout.userId);
              return { ...payoutResponse(payout), ownerName: owner?.name || 'Account', ownerEmail: owner?.email || '', ownerRole: owner?.role || 'unknown' };
            })
            : state.auditLogs;
  records.sort((left, right) => (Date.parse(right.createdAt) || 0) - (Date.parse(left.createdAt) || 0));
  const filtered = search ? records.filter((record) => JSON.stringify(record).toLowerCase().includes(search)) : records;
  response.json({ kind, total: filtered.length, offset, limit, records: filtered.slice(offset, offset + limit) });
});
app.patch('/api/admin/users/:id/suspension', (request: Request, response: Response) => {
  const admin = requireAdmin(request);
  const user = state.users.find((member) => member.id === request.params.id);
  if (!user || !['seller', 'provider'].includes(user.role)) fail(404, 'Seller or service provider not found.');
  const suspended = request.body?.suspended;
  const reason = typeof request.body?.reason === 'string' ? sanitizeText(request.body.reason, '') : '';
  if (typeof suspended !== 'boolean') fail(400, 'Choose whether to suspend or restore this account.');
  if (suspended && reason.length < 5) fail(400, 'Enter a moderation reason of at least 5 characters.');
  if (reason.length > 500) fail(400, 'Keep the moderation reason under 500 characters.');
  if (suspended) {
    user.suspendedAt = new Date().toISOString();
    user.suspensionReason = reason;
  } else {
    user.suspendedAt = undefined;
    user.suspensionReason = undefined;
  }
  saveState();
  auditAction(suspended ? 'account.suspended' : 'account.restored', admin.id, { targetUserId: user.id, targetRole: user.role, reason });
  response.json({ user: { ...cleanUser(user), suspendedAt: user.suspendedAt, suspensionReason: user.suspensionReason } });
});
app.get('/api/admin/overview', (request, response) => {
  const user = requireAdmin(request);
  response.json({ user: cleanUser(user), metrics: { totalUsers: state.users.length, totalOrders: state.orders.length, totalBookings: state.bookings.length, totalRevenue: state.orders.filter((order) => order.paymentStatus === 'paid').reduce((sum, order) => sum + Number(order.totalNaira || 0), 0), auditEntries: state.auditLogs.length } });
});
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
app.get('/api/products', (_request, response) => response.json([
  ...catalog,
  ...state.sellerProducts.filter((product) => !isAccountSuspended(product.userId)).map((product) => {
    const brandProfile = publicBusinessProfile(product.userId);
    return { ...product, seller: brandProfile?.businessName || product.seller, brandProfile };
  })
]));
app.get('/api/services/niches', (_request, response) => response.json(serviceNiches.map((name) => ({ name, image: nicheImages[name] }))));
app.get('/api/services', (_request, response) => {
  const reviewsByListing: Record<string, any[]> = {};
  state.reviews.forEach((review) => { (reviewsByListing[review.listingId] ||= []).push(review); });
  const userListings = state.serviceListings.filter((listing) => !isAccountSuspended(listing.userId)).map((listing) => {
    const reviews = reviewsByListing[listing.id] || [];
    const providerProfile = publicBusinessProfile(listing.userId);
    return { ...listing, provider: providerProfile?.businessName || listing.provider, providerProfile, reviews, reviewCount: reviews.length, rating: reviews.length ? reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length : 0 };
  });
  response.json([...userListings, ...providers]);
});

app.post('/api/uploads/portfolio', (request: Request, response: Response, next: NextFunction) => {
  const user = authenticatedUser(request);
  if (!user || !['provider', 'seller', 'dispatch'].includes(user.role)) return response.status(403).json({ error: 'Sign in as a seller, service provider or dispatch rider to upload photos.' });
  imageUpload.array('images', 6)(request, response, (error: any) => {
    if (error) return response.status(400).json({ error: error.code === 'LIMIT_FILE_SIZE' ? 'Each photo must be 5 MB or smaller.' : error.message || 'The photos could not be uploaded.' });
    const files = (request.files || []) as Express.Multer.File[];
    response.status(201).json({ images: files.map((file) => `/uploads/${file.filename}`) });
  });
});

app.post(['/api/uploads/short-video', '/api/uploads/product-video'], (request: Request, response: Response) => {
  const user = authenticatedUser(request);
  if (!user || !['seller', 'provider'].includes(user.role)) return response.status(403).json({ error: 'Sign in as a vendor or service provider to upload short videos.' });
  productVideoUpload.single('video')(request, response, (error: any) => {
    if (error) return response.status(400).json({ error: error.code === 'LIMIT_FILE_SIZE' ? 'Short video must be 40 MB or smaller.' : error.message || 'The video could not be uploaded.' });
    if (!request.file) return response.status(400).json({ error: 'Choose an MP4 or WebM short video.' });
    const videoDuration = Number(request.body?.duration);
    if (!Number.isFinite(videoDuration) || videoDuration <= 0 || videoDuration > 30) {
      fs.unlink(request.file.path, () => {});
      return response.status(400).json({ error: 'Short video must be 30 seconds or less.' });
    }
    response.status(201).json({ video: `/uploads/${request.file.filename}`, videoDuration });
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
  if (user.role === 'admin') {
    const paidOrders = state.orders.filter((order) => order.paymentStatus === 'paid');
    const totalRevenue = paidOrders.reduce((sum, order) => sum + Number(order.totalNaira || 0), 0);
    const totalUsers = state.users.length;
    const totalListings = state.serviceListings.length + state.sellerProducts.length;
    const roleBreakdown = { customer: 0, seller: 0, provider: 0, dispatch: 0, admin: 0 };
    state.users.forEach((member) => { if (roleBreakdown[member.role] !== undefined) roleBreakdown[member.role] += 1; });
    const orderBreakdown = state.orders.reduce((summary: Record<string, number>, order) => {
      const status = order.paymentStatus || 'unknown';
      summary[status] = (summary[status] || 0) + 1;
      return summary;
    }, {});
    const bookingBreakdown = state.bookings.reduce((summary: Record<string, number>, booking) => {
      const status = booking.status || 'unknown';
      summary[status] = (summary[status] || 0) + 1;
      return summary;
    }, {});
    const payoutBreakdown = state.payouts.reduce((summary: Record<string, number>, payout) => {
      const status = payout.status || 'unknown';
      summary[status] = (summary[status] || 0) + 1;
      return summary;
    }, {});
    const catalogBreakdown = {
      products: state.sellerProducts.length,
      services: state.serviceListings.length,
      reviews: state.reviews.length,
      payouts: state.payouts.length
    };
    return response.json({
      role: user.role,
      user: cleanUser(user),
      metrics: {
        totalUsers,
        totalOrders: state.orders.length,
        totalBookings: state.bookings.length,
        totalListings,
        totalRevenue,
        paidOrders: paidOrders.length,
        pendingPayments: state.orders.filter((order) => ['pending', 'initialization-failed'].includes(order.paymentStatus)).length,
        availablePayouts: state.payouts.filter((payout) => ['success', 'pending', 'otp-required', 'needs-review'].includes(payout.status)).length
      },
      breakdown: {
        roles: roleBreakdown,
        orders: orderBreakdown,
        bookings: bookingBreakdown,
        payouts: payoutBreakdown,
        catalog: catalogBreakdown
      },
      users: state.users.slice(-10).map(cleanUser),
      orders: state.orders.slice(-10).map(safeOrder),
      bookings: state.bookings.slice(-10),
      payouts: state.payouts.slice(-10)
    });
  }
  return response.json({ role: user.role, user: cleanUser(user), orders: state.orders.filter((order) => order.userId === user.id).map(safeOrder), bookings: state.bookings.filter((booking) => booking.userId === user.id) });
});

app.post('/api/provider/listings', (request: Request, response: Response) => {
  const user = requireUser(request);
  if (user.role !== 'provider') fail(403, 'Use a service provider account to create a service listing.');
  if (!hasCompleteBusinessProfile(user)) fail(409, 'Complete your public business profile before publishing a service.');
  const { niche, title, description, price, portfolio, video, videoDuration } = request.body || {};
  if (!serviceNiches.includes(niche)) fail(400, 'Choose one of the available service niches.');
  if (typeof title !== 'string' || title.trim().length < 3 || title.length > 100) fail(400, 'Enter a service title.');
  if (typeof description !== 'string' || description.trim().length < 10 || description.length > 1500) fail(400, 'Describe your service in at least 10 characters.');
  if (!Number.isInteger(Number(price)) || Number(price) < 500 || Number(price) > 100000000) fail(400, 'Enter a valid price in Naira.');
  if (!Array.isArray(portfolio) || portfolio.length < 1 || portfolio.length > 6 || portfolio.some((image) => typeof image !== 'string' || !/^\/uploads\/[\w.-]+$/.test(image))) fail(400, 'Upload 1 to 6 work photos first.');
  if (video !== undefined && (typeof video !== 'string' || !/^\/uploads\/[\w.-]+\.(mp4|webm)$/.test(video) || !Number.isFinite(Number(videoDuration)) || Number(videoDuration) <= 0 || Number(videoDuration) > 30)) fail(400, 'Upload a short video of 30 seconds or less.');
  if (video === undefined && videoDuration !== undefined) fail(400, 'Upload a short video before setting its duration.');
  const listing = { id: randomBytes(12).toString('hex'), userId: user.id, provider: user.name, businessName: user.businessName, niche, title: title.trim(), description: description.trim(), price: Number(price), neighbourhood: 'Uyo, Akwa Ibom', portfolio, video, videoDuration: video === undefined ? undefined : Number(videoDuration), createdAt: new Date().toISOString() };
  state.serviceListings.push(listing);
  user.niche = niche;
  saveState();
  response.status(201).json({ listing });
});

app.post('/api/seller/products', (request: Request, response: Response) => {
  const user = requireUser(request);
  if (user.role !== 'seller') fail(403, 'Use a seller account to add a product.');
  if (!hasCompleteBusinessProfile(user)) fail(409, 'Complete your public business profile before publishing a product.');
  const { name, category, description, price, image, video, videoDuration } = request.body || {};
  if (typeof name !== 'string' || name.trim().length < 3 || name.length > 100) fail(400, 'Enter a product name.');
  if (!['Home', 'Fashion', 'Beauty', 'Tech', 'Food'].includes(category)) fail(400, 'Choose a valid product category.');
  if (typeof description !== 'string' || description.trim().length < 5) fail(400, 'Add a short product description.');
  if (!Number.isInteger(Number(price)) || Number(price) < 100 || Number(price) > 100000000) fail(400, 'Enter a valid price in Naira.');
  if (typeof image !== 'string' || !/^\/uploads\/[\w.-]+$/.test(image)) fail(400, 'Upload a product image first.');
  if (video !== undefined && (typeof video !== 'string' || !/^\/uploads\/[\w.-]+\.(mp4|webm)$/.test(video) || !Number.isFinite(Number(videoDuration)) || Number(videoDuration) <= 0 || Number(videoDuration) > 30)) fail(400, 'Upload a short video of 30 seconds or less.');
  if (video === undefined && videoDuration !== undefined) fail(400, 'Upload a short video before setting its duration.');
  const product = { id: `seller-${randomBytes(10).toString('hex')}`, userId: user.id, name: name.trim(), seller: user.businessName, category, description: description.trim(), price: Number(price), image, video, videoDuration: video === undefined ? undefined : Number(videoDuration), rating: null, reviews: 0, createdAt: new Date().toISOString() };
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
  const parsed = registerSchema.safeParse(request.body || {});
  if (!parsed.success) fail(400, parsed.error.issues.map((issue) => issue.message).join(', '));
  const { name, username, email, password, role, businessName, niche } = parsed.data;
  const sanitizedName = sanitizeText(name, '');
  const sanitizedUsername = sanitizeText(username, '').toLowerCase();
  const sanitizedEmail = sanitizeText(email, '').toLowerCase();
  const sanitizedBusiness = businessName ? sanitizeText(businessName, '') : undefined;
  const sanitizedNiche = niche ? sanitizeText(niche, '') : undefined;
  if (role === 'provider' && !serviceNiches.includes(sanitizedNiche || '')) fail(400, 'Choose an available service niche.');
  if (state.users.some((user) => (user.username || legacyUsername(user)).toLowerCase() === sanitizedUsername)) fail(409, 'That username is already taken.');
  if (state.users.some((user) => user.email.toLowerCase() === sanitizedEmail && user.role === role)) fail(409, 'This email already has an account for that role. Choose another role or sign in.');
  if (role !== 'customer' && (!sanitizedBusiness || sanitizedBusiness.length < 2)) fail(400, 'Enter your shop, service or delivery area name.');
  const autoVerifyEmail = process.env.NODE_ENV === 'test' || process.env.AUTO_VERIFY_EMAIL !== 'false';
  const otpCode = autoVerifyEmail ? undefined : generateOtp();
  const user: User = {
    id: randomBytes(16).toString('hex'),
    name: sanitizedName,
    username: sanitizedUsername,
    email: sanitizedEmail,
    role,
    businessName: sanitizedBusiness,
    niche: role === 'provider' ? sanitizedNiche : undefined,
    passwordHash: await bcrypt.hash(password, 12),
    createdAt: new Date().toISOString(),
    emailVerified: autoVerifyEmail,
    otpCode,
    otpExpiresAt: autoVerifyEmail ? undefined : Date.now() + 10 * 60 * 1000
  };
  state.users.push(user);
  saveState();
  const accessToken = tokenFor(user);
  const refreshToken = refreshTokenFor(user);
  setAuthCookies(response, accessToken, refreshToken);
  response.status(201).json({ token: accessToken, refreshToken, user: cleanUser(user), emailVerificationRequired: !user.emailVerified });
}));

app.post('/api/auth/send-otp', asyncRoute(async (request: Request, response: Response) => {
  const target = typeof request.body?.email === 'string' ? request.body.email : typeof request.body?.username === 'string' ? request.body.username : '';
  const user = state.users.find((item) => item.email.toLowerCase() === target.toLowerCase() || (item.username || legacyUsername(item)).toLowerCase() === target.toLowerCase());
  if (!user) fail(404, 'No matching account was found.');
  const otpCode = generateOtp();
  user.otpCode = otpCode;
  user.otpExpiresAt = Date.now() + 10 * 60 * 1000;
  saveState();
  auditAction('otp.sent', user.id, { email: user.email, requestedBy: 'self' });
  response.json({ message: 'A one-time code has been sent to your email address.', otpCode: process.env.NODE_ENV === 'test' ? otpCode : undefined });
}));

app.post('/api/auth/verify-otp', asyncRoute(async (request: Request, response: Response) => {
  const { email, otp } = request.body || {};
  if (typeof email !== 'string' || typeof otp !== 'string') fail(400, 'Enter your email and one-time code.');
  const user = state.users.find((item) => item.email.toLowerCase() === email.toLowerCase());
  if (!user || !user.otpCode || !user.otpExpiresAt || Date.now() > user.otpExpiresAt) fail(400, 'The OTP is invalid or has expired.');
  if (user.otpCode !== otp.trim()) fail(400, 'The one-time code is incorrect.');
  user.emailVerified = true;
  user.otpCode = undefined;
  user.otpExpiresAt = undefined;
  saveState();
  auditAction('otp.verified', user.id, { email: user.email });
  response.json({ message: 'Email verified successfully.', user: cleanUser(user) });
}));

app.post('/api/auth/login', asyncRoute(async (request: Request, response: Response) => {
  const parsed = loginSchema.safeParse(request.body || {});
  if (!parsed.success) fail(400, parsed.error.issues.map((issue) => issue.message).join(', '));
  const { username, password } = parsed.data;
  const normalizedUsername = sanitizeText(username, '').toLowerCase();
  const user = state.users.find((item) => (item.username || legacyUsername(item)).toLowerCase() === normalizedUsername);
  if (isLoginLocked(normalizedUsername)) fail(429, 'Too many failed login attempts. Please try again in 15 minutes.');
  if (!user) {
    const failedAttempt = recordFailedLogin(normalizedUsername);
    if (failedAttempt.lockUntil > Date.now()) fail(429, 'Too many failed login attempts. Please try again in 15 minutes.');
    fail(401, 'Username or password is incorrect.');
  }
  const passwordMatches = await bcrypt.compare(password, user.passwordHash);
  if (!passwordMatches) {
    const failedAttempt = recordFailedLogin(normalizedUsername);
    auditAction('login.failed', user.id, { username: normalizedUsername, reason: 'invalid_password' });
    if (failedAttempt.lockUntil > Date.now()) fail(429, 'Too many failed login attempts. Please try again in 15 minutes.');
    fail(401, 'Username or password is incorrect.');
  }
  if (user.role === 'admin') fail(403, 'Use the admin portal password to sign in.');
  if (user.suspendedAt) fail(403, 'This account is suspended. Contact Unishop support for assistance.');
  if (!user.emailVerified && process.env.NODE_ENV !== 'test' && process.env.AUTO_VERIFY_EMAIL === 'false') {
    fail(403, 'Verify your email with the one-time code before logging in.');
  }
  if (!user.emailVerified) {
    user.emailVerified = true;
    user.otpCode = undefined;
    user.otpExpiresAt = undefined;
  }
  clearLoginFailure(normalizedUsername);
  user.lastLoginAt = new Date().toISOString();
  saveState();
  const accessToken = tokenFor(user);
  const refreshToken = refreshTokenFor(user);
  setAuthCookies(response, accessToken, refreshToken);
  response.json({ token: accessToken, refreshToken, user: cleanUser(user) });
}));

app.patch('/api/profile', (request: Request, response: Response) => {
  const user = requireUser(request);
  if (!['seller', 'provider', 'dispatch'].includes(user.role)) fail(403, 'Business profiles are only available to sellers, service providers and dispatch riders.');
  const profileSchema = z.object({
    name: z.string().trim().min(2).max(100),
    businessName: z.string().trim().min(2).max(120),
    position: z.string().trim().min(2).max(80),
    placeOfOperation: z.string().trim().min(2).max(120),
    aboutMe: z.string().trim().min(20).max(1000),
    profileImage: z.string().regex(/^\/uploads\/[\w.-]+$/)
  });
  const parsed = profileSchema.safeParse(request.body || {});
  if (!parsed.success) fail(400, parsed.error.issues.map((issue) => issue.message).join(', '));
  user.name = sanitizeText(parsed.data.name, '');
  user.businessName = sanitizeText(parsed.data.businessName, '');
  user.position = sanitizeText(parsed.data.position, '');
  user.placeOfOperation = sanitizeText(parsed.data.placeOfOperation, '');
  user.aboutMe = sanitizeText(parsed.data.aboutMe, '');
  user.profileImage = parsed.data.profileImage;
  saveState();
  auditAction('profile.updated', user.id, { role: user.role });
  response.json({ user: cleanUser(user), complete: hasCompleteBusinessProfile(user) });
});
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
  const provider = state.serviceListings.find((person) => person.id === providerId && !isAccountSuspended(person.userId)) || providers.find((person) => person.id === providerId);
  if (!provider || typeof neighbourhood !== 'string' || neighbourhood.trim().length < 2 || typeof time !== 'string') fail(400, 'Complete the service booking details.');
  const providerUserId = provider.userId;
  const booking = { id: randomBytes(12).toString('hex'), userId: user.id, providerUserId, providerId, provider: provider.provider || provider.name, service: provider.title || provider.trade, amountNaira: provider.price, neighbourhood: neighbourhood.trim(), time, note: typeof note === 'string' ? note.slice(0, 1000) : '', status: 'requested', paymentStatus: 'unpaid', createdAt: new Date().toISOString() };
  state.bookings.push(booking);
  saveState();
  response.status(201).json({ booking });
});

app.post('/api/payments/initialize', asyncRoute(async (request: Request, response: Response) => {
  if (!paystackSecret) fail(503, 'Online payments are temporarily unavailable. Please try again later.');
  const { email, items, customer, delivery, bookingId, idempotencyKey } = request.body || {};
  const user = authenticatedUser(request);
  const resolvedIdempotencyKey = typeof idempotencyKey === 'string' && idempotencyKey.trim() ? idempotencyKey.trim() : `pay-${Date.now()}-${randomBytes(8).toString('hex')}`;
  const existingOrder = state.orders.find((order) => order.userId === user?.id && order.idempotencyKey === resolvedIdempotencyKey && order.paymentStatus !== 'failed');
  if (existingOrder) return response.status(200).json({ reference: existingOrder.reference, authorizationUrl: existingOrder.authorizationUrl, order: safeOrder(existingOrder) });
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
    if (isAccountSuspended(booking.providerUserId)) fail(409, 'This service provider is currently unavailable.');
    const serviceSubtotalNaira = Number(booking.amountNaira);
    const commissionNaira = commissionFor(serviceSubtotalNaira);
    const dispatchContributionNaira = 500;
    const providerNetNaira = serviceSubtotalNaira - commissionNaira - dispatchContributionNaira;
    if (providerNetNaira < 0) fail(400, 'The service price must cover its ₦500 dispatch contribution and Unishop commission.');
    settlementLines = booking.providerUserId ? [{ userId: booking.providerUserId, role: 'provider', subtotalNaira: serviceSubtotalNaira, commissionNaira, dispatchContributionNaira, netNaira: providerNetNaira }] : [];
    totalNaira = serviceSubtotalNaira + 500;
    orderItems = [{ productId: booking.providerId, name: booking.service, seller: booking.provider, sellerUserId: booking.providerUserId, unitPrice: serviceSubtotalNaira, quantity: 1, lineTotal: totalNaira, service: true }];
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
    const serverItems = items.map((item: any) => {
      const product = catalog.find((entry) => entry.id === item.id) || state.sellerProducts.find((entry) => entry.id === item.id && !isAccountSuspended(entry.userId));
      const quantity = Number(item.quantity);
      if (!product || !Number.isInteger(quantity) || quantity < 1 || quantity > 10) fail(400, 'Your bag contains an invalid product or quantity.');
      return { product, quantity };
    });
    orderItems = serverItems.map(({ product, quantity }) => ({
      productId: product.id,
      name: product.name,
      seller: product.seller || product.businessName,
      sellerUserId: product.userId,
      unitPrice: product.price,
      quantity,
      lineTotal: product.price * quantity,
      service: false
    }));
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
    id: randomBytes(12).toString('hex'),
    reference,
    type: booking ? 'service' : 'product',
    bookingId: booking?.id,
    userId: user?.id,
    email: receiptEmail,
    customerName,
    phone,
    address,
    neighbourhood,
    items: orderItems,
    totalNaira,
    dispatchFeeNaira: booking ? 0 : 500,
    customerDispatchFeeNaira: booking ? 500 : 0,
    sellerDispatchContributionNaira: settlementLines.reduce((sum, line) => sum + line.dispatchContributionNaira, 0),
    riderSettlementNaira: booking ? 0 : 500 + settlementLines.reduce((sum, line) => sum + line.dispatchContributionNaira, 0),
    settlementLines,
    settlementStatus: 'held',
    amountKobo: totalNaira * 100,
    currency: 'NGN',
    paymentStatus: 'pending',
    orderStatus: 'awaiting-payment',
    authorizationUrl: undefined as string | undefined,
    idempotencyKey: resolvedIdempotencyKey,
    createdAt: new Date().toISOString()
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