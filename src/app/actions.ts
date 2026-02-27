'use server';

import { db } from '@/lib/store';
import { generateCompanyPasswordId } from '@/ai/flows/generate-company-password-id-flow';
import { generateViewerPasswordId } from '@/ai/flows/generate-viewer-password-id';
import { Company, User, Sale, Role } from '@/lib/types';
import { revalidatePath } from 'next/cache';

export async function createCompanyAction(formData: FormData) {
  const name = formData.get('name') as string;
  if (!name) return { error: 'Name is required' };

  const cleanName = name.toLowerCase().replace(/\s+/g, '');
  const email = `${cleanName}@ventureebiz.com`;
  
  const { uniqueId } = await generateCompanyPasswordId({});
  const password = `${cleanName}.venturee.${uniqueId}`;

  const company: Company = {
    id: crypto.randomUUID(),
    name,
    email,
    password,
    createdAt: new Date().toISOString(),
  };

  db.addCompany(company);
  revalidatePath('/admin');
  return { success: true, company };
}

export async function createViewerAction(formData: FormData, companyId: string, companyName: string) {
  const name = formData.get('name') as string;
  const username = formData.get('username') as string;

  if (!name || !username) return { error: 'Name and Username are required' };

  const cleanCompanyName = companyName.toLowerCase().replace(/\s+/g, '');
  const email = `${username}_${cleanCompanyName}@ventureebiz.com`;
  
  const uniqueId = await generateViewerPasswordId({});
  const password = uniqueId;

  const user: User = {
    id: crypto.randomUUID(),
    name,
    username,
    email,
    password,
    role: 'viewer',
    companyId,
  };

  db.addUser(user);
  revalidatePath('/company');
  return { success: true, user };
}

export async function recordSaleAction(companyId: string, items: { name: string; price: number; quantity: number }[]) {
  const total = items.reduce((acc, item) => acc + item.price * item.quantity, 0);
  
  const sale: Sale = {
    id: crypto.randomUUID(),
    companyId,
    items,
    total,
    timestamp: new Date().toISOString(),
  };

  db.addSale(sale);
  revalidatePath('/company');
  revalidatePath('/viewer');
  return { success: true };
}
