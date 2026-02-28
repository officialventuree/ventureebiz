
'use server';

import { generateCompanyPasswordId } from '@/ai/flows/generate-company-password-id-flow';
import { generateViewerPasswordId } from '@/ai/flows/generate-viewer-password-id';
import { Company, User, ModuleType } from '@/lib/types';

export async function createCompanyAction(formData: FormData) {
  const name = formData.get('name') as string;
  if (!name) return { error: 'Name is required' };

  const enabledModules = formData.getAll('modules') as ModuleType[];
  const periodId = formData.get('periodId') as string;
  const totalAmount = Number(formData.get('totalAmount'));
  const durationDays = Number(formData.get('durationDays')) || 30;

  const cleanName = name.toLowerCase().replace(/\s+/g, '');
  const email = `${cleanName}@ventureebiz.com`;
  
  const { uniqueId: loginId } = await generateCompanyPasswordId({});
  const password = `${cleanName}.venturee.${loginId}`;

  const { uniqueId: cancelId } = await generateCompanyPasswordId({});
  const cancellationPassword = cancelId;

  const companyId = crypto.randomUUID();
  const now = new Date();
  const expiry = new Date(now);
  expiry.setDate(expiry.getDate() + durationDays);

  const company: Company = {
    id: companyId,
    name,
    email,
    password,
    cancellationPassword,
    createdAt: now.toISOString(),
    registrationDate: now.toISOString(),
    expiryDate: expiry.toISOString(),
    status: 'Active',
    nextCapitalAmount: 0,
    enabledModules: enabledModules.length > 0 ? enabledModules : ['mart', 'laundry', 'rent', 'services']
  };

  const subscriptionId = crypto.randomUUID();
  const transactionId = crypto.randomUUID();

  const subscription = {
    id: subscriptionId,
    companyId,
    pricingCycleId: periodId,
    startDate: now.toISOString(),
    endDate: expiry.toISOString(),
    totalAmount,
    status: 'Active',
    selectedModuleIds: enabledModules,
    paymentTransactionId: transactionId,
    isRenewal: false,
    createdAt: now.toISOString()
  };

  const transaction = {
    id: transactionId,
    companyId,
    amount: totalAmount,
    currencyId: 'USD',
    paymentMethod: formData.get('paymentMethod') as any || 'cash',
    referenceCode: formData.get('referenceCode') as string || undefined,
    transactionDate: now.toISOString(),
    status: 'Success',
    description: `Initial Provisioning: ${name}`,
    createdAt: now.toISOString()
  };
  
  return { success: true, company, subscription, transaction };
}

export async function renewCompanyAction(formData: FormData, company: Company) {
  const periodId = formData.get('periodId') as string;
  const totalAmount = Number(formData.get('totalAmount'));
  const durationDays = Number(formData.get('durationDays')) || 30;
  const enabledModules = formData.getAll('modules') as ModuleType[];

  const now = new Date();
  const currentExpiry = company.expiryDate ? new Date(company.expiryDate) : now;
  const baseDate = currentExpiry > now ? currentExpiry : now;
  const newExpiry = new Date(baseDate);
  newExpiry.setDate(newExpiry.getDate() + durationDays);

  const subscriptionId = crypto.randomUUID();
  const transactionId = crypto.randomUUID();

  const subscription = {
    id: subscriptionId,
    companyId: company.id,
    pricingCycleId: periodId,
    startDate: baseDate.toISOString(),
    endDate: newExpiry.toISOString(),
    totalAmount,
    status: 'Active',
    selectedModuleIds: enabledModules,
    paymentTransactionId: transactionId,
    isRenewal: true,
    createdAt: now.toISOString()
  };

  const transaction = {
    id: transactionId,
    companyId: company.id,
    amount: totalAmount,
    currencyId: 'USD',
    paymentMethod: formData.get('paymentMethod') as any || 'cash',
    referenceCode: formData.get('referenceCode') as string || undefined,
    transactionDate: now.toISOString(),
    status: 'Success',
    description: `Renewal for ${company.name}`,
    createdAt: now.toISOString()
  };

  return { success: true, newExpiry: newExpiry.toISOString(), subscription, transaction };
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
    role: 'CompanyViewer',
    companyId,
  };

  return { success: true, user };
}
