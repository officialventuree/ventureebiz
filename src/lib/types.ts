export type Role = 'admin' | 'company' | 'viewer';

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
}

export interface Sale {
  id: string;
  companyId: string;
  items: { name: string; price: number; quantity: number }[];
  total: number;
  timestamp: string;
}

export interface AuthState {
  user: User | null;
}
