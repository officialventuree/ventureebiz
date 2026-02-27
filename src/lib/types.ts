export type Role = 'admin' | 'company' | 'viewer';
export type CapitalPeriod = 'daily' | 'weekly' | 'monthly' | 'yearly';
export type ModuleType = 'mart' | 'laundry' | 'rent' | 'services';
export type TransactionStatus = 'completed' | 'pending' | 'in-progress' | 'cancelled';
export type RentalStatus = 'available' | 'rented' | 'maintenance';
export type CouponStatus = 'unused' | 'used';
export type PaymentMethod = 'cash' | 'card' | 'duitnow' | 'coupon';

export interface User {
  id: string;
  name: string;
  username?: string;
  email: string;
  password?: string;
  role: Role;
  companyId?: string;
}

export interface Company {
  id: string;
  name: string;
  email: string;
  password?: string;
  createdAt: string;
  capitalLimit?: number;
  capitalPeriod?: CapitalPeriod;
  duitNowQr?: string;
}

export interface SaleItem {
  productId?: string;
  name: string;
  price: number;
  quantity: number;
  cost?: number;
  duration?: number;
  startDate?: string;
  endDate?: string;
  unit?: string;
}

export interface SaleTransaction {
  id: string;
  companyId: string;
  module: ModuleType;
  totalAmount: number;
  profit: number;
  timestamp: string;
  items: SaleItem[];
  status?: TransactionStatus;
  customerName?: string;
  couponCode?: string;
  discountApplied?: number;
  paymentMethod?: PaymentMethod;
  referenceNumber?: string;
  luckyDrawEventId?: string;
}

export interface Product {
  id: string;
  companyId: string;
  name: string;
  costPrice: number;
  sellingPrice: number;
  stock: number;
  sku?: string;
  barcode?: string;
  unit?: string;
}

export interface RentalItem {
  id: string;
  companyId: string;
  name: string;
  hourlyRate?: number;
  dailyRate?: number;
  monthlyRate?: number;
  unit: 'hour' | 'day' | 'month';
  status: RentalStatus;
}

export interface ServiceItem {
  id: string;
  companyId: string;
  name: string;
  basePrice: number;
  estimatedProfit: number;
}

export interface LaundryStudent {
  id: string;
  companyId: string;
  name: string;
  matrixNumber: string;
  balance: number;
}

export interface CapitalPurchase {
  id: string;
  companyId: string;
  amount: number;
  description: string;
  timestamp: string;
}

export interface Coupon {
  id: string;
  companyId: string;
  code: string;
  value: number;
  expiryDate: string;
  status: CouponStatus;
}

export interface LuckyDrawEntry {
  id: string;
  companyId: string;
  customerName: string;
  transactionId: string;
  timestamp: string;
  amount: number;
  eventId: string;
}

export interface LuckyDrawEvent {
  id: string;
  companyId: string;
  name: string;
  minSpend: number;
  isActive: boolean;
  createdAt: string;
}
