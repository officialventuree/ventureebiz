
export type Role = 'admin' | 'company' | 'viewer';
export type CapitalPeriod = 'daily' | 'weekly' | 'monthly' | 'yearly';
export type ModuleType = 'mart' | 'laundry' | 'rent' | 'services';

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
}

export interface SaleItem {
  name: string;
  price: number;
  quantity: number;
  cost?: number;
}

export interface SaleTransaction {
  id: string;
  companyId: string;
  module: ModuleType;
  totalAmount: number;
  profit: number;
  timestamp: string;
  items: SaleItem[];
}

export interface Product {
  id: string;
  companyId: string;
  name: string;
  costPrice: number;
  sellingPrice: number;
  stock: number;
  sku?: string;
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
