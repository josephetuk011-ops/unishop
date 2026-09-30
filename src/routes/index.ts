import { Router } from 'express';
import authRoutes from '../modules/auth/routes';
import customerRoutes from '../modules/customers/routes';
import vendorRoutes from '../modules/vendors/routes';
import productRoutes from '../modules/products/routes';
import serviceRoutes from '../modules/services/routes';
import bookingRoutes from '../modules/bookings/routes';
import orderRoutes from '../modules/orders/routes';
import paymentRoutes from '../modules/payments/routes';
import dispatchRiderRoutes from '../modules/dispatch-riders/routes';
import notificationRoutes from '../modules/notifications/routes';

const router = Router();

const setupRoutes = (app) => {
    app.use('/api/auth', authRoutes);
    app.use('/api/customers', customerRoutes);
    app.use('/api/vendors', vendorRoutes);
    app.use('/api/products', productRoutes);
    app.use('/api/services', serviceRoutes);
    app.use('/api/bookings', bookingRoutes);
    app.use('/api/orders', orderRoutes);
    app.use('/api/payments', paymentRoutes);
    app.use('/api/dispatch-riders', dispatchRiderRoutes);
    app.use('/api/notifications', notificationRoutes);
};

export default setupRoutes;