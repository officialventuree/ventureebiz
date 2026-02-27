import { Company, User, Sale } from './types';

// In-memory store for simulation purposes
let companies: Company[] = [];
let users: User[] = [
  {
    id: 'admin-1',
    name: 'Platform Owner',
    email: 'admin@ventureebiz.com',
    password: 'admin',
    role: 'admin'
  }
];
let sales: Sale[] = [];

export const db = {
  getCompanies: () => companies,
  addCompany: (company: Company) => {
    companies.push(company);
    users.push({
      id: `user-${company.id}`,
      name: company.name,
      email: company.email,
      password: company.password,
      role: 'company',
      companyId: company.id
    });
  },
  getUsers: () => users,
  addUser: (user: User) => {
    users.push(user);
  },
  getSales: (companyId: string) => sales.filter(s => s.companyId === companyId),
  addSale: (sale: Sale) => {
    sales.push(sale);
  },
  getCompanyById: (id: string) => companies.find(c => c.id === id)
};
