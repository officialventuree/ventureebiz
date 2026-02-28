
export type Role = 'admin' | 'company' | 'viewer';
export type CapitalPeriod = 'daily' | 'weekly' | 'monthly' | 'yearly';
export type ModuleType = 'mart' | 'laundry' | 'rent' | 'services';
export type TransactionStatus = 'completed' | 'pending' | 'in-progress' | 'cancelled';
export type RentalStatus = 'available' | 'rented' | 'maintenance';
export type CouponStatus = 'active' | 'exhausted';
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
  cancellationPassword: string;
  createdAt: string;
  capitalLimit?: number;
  capitalPeriod?: CapitalPeriod;
  capitalStartDate?: string;
  capitalEndDate?: string;
  duitNowQr?: string;
  nextCapitalAmount?: number; // Accumulated pool from claimed capital
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
  soapUsedMl?: number;
}

export interface SaleTransaction {
  id: string;
  companyId: string;
  module: ModuleType;
  serviceTypeId?: string;
  totalAmount: number; // Revenue
  profit: number;
  totalCost?: number; // Actual expenditure for capital recovery
  isCapitalClaimed?: boolean; // Tracking if capital portion has been recovered
  timestamp: string;
  items: SaleItem[];
  status?: TransactionStatus;
  customerName?: string;
  customerCompany?: string;
  couponCode?: string;
  discountApplied?: number;
  paymentMethod?: PaymentMethod;
  referenceNumber?: string;
  luckyDrawEventId?: string;
  // Advanced Service Fields
  serviceRevenue?: number;
  martRevenue?: number;
  materialCost?: number;
}

export interface Product {
  id: string;
  companyId: string;
  serviceTypeId?: string;
  name: string;
  costPrice: number;
  sellingPrice: number;
  stock: number;
  sku?: string;
  barcode?: string;
  unit?: string;
  itemsPerUnit?: number;
}

export interface RentalItem {
  id: string;
  companyId: string;
  name: string;
  hourlyRate?: number;
  dailyRate?: number;
  weeklyRate?: number;
  monthlyRate?: number;
  yearlyRate?: number;
  unit: 'hour' | 'day' | 'week' | 'month' | 'year';
  status: RentalStatus;
}

export interface ServiceType {
  id: string;
  companyId: string;
  name: string;
  description?: string;
  duitNowQr?: string;
}

export interface ServicePriceBundle {
  id: string;
  serviceTypeId: string;
  companyId: string;
  name: string;
  price: number;
  estimatedProfit: number;
}

export interface LaundryStudent {
  id: string;
  companyId: string;
  name: string;
  matrixNumber: string;
  balance: number;
  level: number;
  class: string;
}

export interface LaundryInventory {
  id: string;
  companyId: string;
  soapStockMl: number;
  soapCostPerLitre: number;
  capacityMl: number;
  category: 'student' | 'payable';
  lastBottleCost?: number;
  lastBottleVolume?: number;
}

export interface LaundryLevelConfig {
  id: string;
  companyId: string;
  level: number;
  subscriptionFee: number;
  totalWashesAllowed: number;
}

export interface LaundrySchedule {
  id: string;
  companyId: string;
  date: string;
  level: number;
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
  initialValue: number;
  balance: number;
  expiryDate: string;
  status: CouponStatus;
  customerName: string;
  customerCompany?: string;
  createdAt: string;
  paymentMethod?: PaymentMethod;
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
