
'use server';

import { generateCompanyPasswordId } from '@/ai/flows/generate-company-password-id-flow';
import { generateViewerPasswordId } from '@/ai/flows/generate-viewer-password-id';
import { Company, User, ModuleType } from '@/lib/types';

export async function createCompanyAction(formData: FormData) {
  const name = formData.get('name') as string;
  if (!name) return { error: 'Name is required' };

  const enabledModules = formData.getAll('modules') as ModuleType[];

  const cleanName = name.toLowerCase().replace(/\s+/g, '');
  const email = `${cleanName}@ventureebiz.com`;
  
  // Generate Login Password ID
  const { uniqueId: loginId } = await generateCompanyPasswordId({});
  const password = `${cleanName}.venturee.${loginId}`;

  // Generate Cancellation Password ID
  const { uniqueId: cancelId } = await generateCompanyPasswordId({});
  const cancellationPassword = cancelId;

  const company: Company = {
    id: crypto.randomUUID(),
    name,
    email,
    password,
    cancellationPassword,
    createdAt: new Date().toISOString(),
    capitalLimit: 10000,
    capitalPeriod: 'monthly',
    enabledModules: enabledModules.length > 0 ? enabledModules : ['mart', 'laundry', 'rent', 'services']
  };
  
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

  return { success: true, user };
}

export async function recordSaleAction(companyId: string, items: any[]) {
  // This action returns a success response for client-side processing
  return { success: true };
}
