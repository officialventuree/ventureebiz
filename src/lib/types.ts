
export type Role = 'PlatformAdmin' | 'CompanyOwner' | 'CompanyViewer';
export type CapitalPeriod = 'daily' | 'weekly' | 'monthly' | 'yearly';
export type ModuleType = 'mart' | 'laundry' | 'rent' | 'services';
export type TransactionStatus = 'completed' | 'pending' | 'in-progress' | 'cancelled';
export type RentalStatus = 'available' | 'rented' | 'maintenance';
export type CouponStatus = 'active' | 'exhausted';
export type PaymentMethod = 'cash' | 'card' | 'duitnow' | 'coupon';
export type CompanyStatus = 'Active' | 'Expired' | 'Suspended' | 'Pending';

export interface User {
  id: string; // Matches Firebase Auth UID
  name: string;
  username?: string;
  email: string;
  password?: string; // For manual login reference in prototype
  role: Role;
  companyId?: string;
  enabledModules?: ModuleType[];
}

export interface Company {
  id: string;
  name: string;
  email: string;
  password?: string;
  cancellationPassword: string;
  createdAt: string;
  registrationDate: string;
  expiryDate?: string;
  status: CompanyStatus;
  currentSubscriptionId?: string;
  capitalLimit?: number;
  injectedCapital?: number;
  capitalPeriod?: CapitalPeriod;
  capitalStartDate?: string;
  capitalEndDate?: string;
  duitNowQr?: string;
  nextCapitalAmount?: number;
  enabledModules?: ModuleType[];
}

export interface PricingCycle {
  id: string;
  name: string;
  durationInDays: number;
}

export interface ModulePricing {
  id: string;
  moduleId: string;
  pricingCycleId: string;
  price: number;
  currencyId: string;
}

export interface PlatformProfitEntry {
  id: string;
  paymentTransactionId: string;
  companyId: string;
  amount: number;
  currencyId: string;
  entryDate: string;
  type: 'InitialSubscription' | 'Renewal' | 'Refund';
}

export interface SaleTransaction {
  id: string;
  companyId: string;
  module: ModuleType;
  totalAmount: number;
  profit: number;
  totalCost?: number;
  isCapitalClaimed?: boolean;
  timestamp: string;
  items: any[];
  status?: TransactionStatus;
  customerName?: string;
  paymentMethod?: PaymentMethod;
  referenceNumber?: string;
  serviceTypeId?: string;
  discountApplied?: number;
  couponCode?: string;
}

export interface Product {
  id: string;
  companyId: string;
  serviceTypeId?: string;
  name: string;
  costPrice: number;
  sellingPrice: number;
  stock: number;
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

export interface Coupon {
  id: string;
  companyId: string;
  code: string;
  initialValue: number;
  balance: number;
  expiryDate: string;
  status: CouponStatus;
  customerName: string;
  createdAt: string;
  paymentMethod?: PaymentMethod;
  customerCompany?: string;
}

export interface CapitalPurchase {
  id: string;
  companyId: string;
  amount: number;
  description: string;
  timestamp: string;
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
