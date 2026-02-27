
'use server';

import { generateCompanyPasswordId } from '@/ai/flows/generate-company-password-id-flow';
import { generateViewerPasswordId } from '@/ai/flows/generate-viewer-password-id';
import { Company, User } from '@/lib/types';
import { revalidatePath } from 'next/cache';
import { initializeFirebase } from '@/firebase';
import { doc, setDoc, collection, addDoc } from 'firebase/firestore';

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
    capitalLimit: 10000,
    capitalPeriod: 'monthly'
  };

  // Here we would normally use the Firebase SDK on the server,
  // but for the sake of this architectural request, 
  // we will rely on client-side writes as specified in guidelines 
  // when possible, or simple return the object for the client to handle.
  
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
