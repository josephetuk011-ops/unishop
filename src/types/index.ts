export interface User {
    id: string;
    username: string;
    email: string;
    password: string;
    role: 'customer' | 'vendor' | 'admin';
}

export interface Product {
    id: string;
    name: string;
    description: string;
    price: number;
    vendorId: string;
    category: string;
    stock: number;
}

export interface Service {
    id: string;
    name: string;
    description: string;
    price: number;
    vendorId: string;
}

export interface Order {
    id: string;
    customerId: string;
    productId: string;
    quantity: number;
    totalPrice: number;
    status: 'pending' | 'completed' | 'canceled';
}

export interface Booking {
    id: string;
    customerId: string;
    serviceId: string;
    date: Date;
    time: string;
    status: 'pending' | 'confirmed' | 'canceled';
}

export interface Payment {
    id: string;
    orderId: string;
    amount: number;
    method: 'credit_card' | 'paypal' | 'bank_transfer';
    status: 'pending' | 'completed' | 'failed';
}

export interface DispatchRide {
    id: string;
    orderId: string;
    riderId: string;
    status: 'pending' | 'in_progress' | 'completed';
}

export interface Notification {
    id: string;
    userId: string;
    message: string;
    read: boolean;
    createdAt: Date;
}