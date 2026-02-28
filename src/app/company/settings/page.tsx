
'use client';

import { Sidebar } from '@/components/layout/sidebar';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Globe, ShieldCheck, Settings2 } from 'lucide-react';
import { useAuth } from '@/components/auth-context';
import { useFirestore, useMemoFirebase, useDoc } from '@/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Company } from '@/lib/types';

const WORLD_CURRENCIES = [
  { code: 'USD', symbol: '$', name: 'USD - US Dollar' },
  { code: 'EUR', symbol: '€', name: 'EUR - Euro' },
  { code: 'GBP', symbol: '£', name: 'GBP - British Pound' },
  { code: 'JPY', symbol: '¥', name: 'JPY - Japanese Yen' },
  { code: 'MYR', symbol: 'RM', name: 'MYR - Malaysian Ringgit' },
  { code: 'AUD', symbol: 'A$', name: 'AUD - Australian Dollar' },
  { code: 'CAD', symbol: 'C$', name: 'CAD - Canadian Dollar' },
  { code: 'CHF', symbol: 'CHF', name: 'CHF - Swiss Franc' },
  { code: 'CNY', symbol: '¥', name: 'CNY - Chinese Yuan' },
  { code: 'INR', symbol: '₹', name: 'INR - Indian Rupee' },
  { code: 'SGD', symbol: 'S$', name: 'SGD - Singapore Dollar' },
  { code: 'NZD', symbol: 'NZ$', name: 'NZD - New Zealand Dollar' },
  { code: 'BRL', symbol: 'R$', name: 'BRL - Brazilian Real' },
  { code: 'ZAR', symbol: 'R', name: 'ZAR - South African Rand' },
  { code: 'IDR', symbol: 'Rp', name: 'IDR - Indonesian Rupiah' },
  { code: 'THB', symbol: '฿', name: 'THB - Thai Baht' },
  { code: 'PHP', symbol: '₱', name: 'PHP - Philippine Peso' },
  { code: 'VND', symbol: '₫', name: 'VND - Vietnamese Dong' },
  { code: 'KRW', symbol: '₩', name: 'KRW - South Korean Won' },
  { code: 'SAR', symbol: 'SR', name: 'SAR - Saudi Riyal' },
  { code: 'AED', symbol: 'DH', name: 'AED - UAE Dirham' },
];

export default function CompanySettingsPage() {
  const { user } = useAuth();
  const firestore = useFirestore();
  const { toast } = useToast();
  const [isUpdating, setIsUpdating] = useState(false);

  const companyRef = useMemoFirebase(() => {
    if (!firestore || !user?.companyId) return null;
    return doc(firestore, 'companies', user.companyId);
  }, [firestore, user?.companyId]);

  const { data: companyDoc } = useDoc<Company>(companyRef);

  const handleCurrencyChange = async (code: string) => {
    if (!firestore || !user?.companyId) return;
    setIsUpdating(true);

    const selected = WORLD_CURRENCIES.find(c => c.code === code);
    if (!selected) {
      setIsUpdating(false);
      return;
    }

    try {
      const docRef = doc(firestore, 'companies', user.companyId);
      await updateDoc(docRef, {
        currencyCode: selected.code,
        currencySymbol: selected.symbol
      });

      toast({ 
        title: "Preferences Updated", 
        description: `Dashboard currency set to ${selected.code} (${selected.symbol})` 
      });
    } catch (e: any) {
      toast({ title: "Update Failed", description: e.message, variant: "destructive" });
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="flex h-screen bg-background font-body">
      <Sidebar />
      <main className="flex-1 overflow-auto p-8">
        <div className="max-w-4xl mx-auto">
          <div className="mb-10">
            <h1 className="text-4xl font-black font-headline tracking-tighter">Business Settings</h1>
            <p className="text-muted-foreground font-medium">Localization & Regional Preferences</p>
          </div>

          <div className="grid grid-cols-1 gap-8">
            <Card className="border-none shadow-sm rounded-[40px] bg-white p-12 overflow-hidden relative">
              <div className="absolute top-0 right-0 p-12 opacity-5">
                <Globe className="w-40 h-40" />
              </div>
              <div className="relative z-10 space-y-8">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center text-primary">
                    <Globe className="w-8 h-8" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-black tracking-tight">Dashboard Localization</h2>
                    <p className="text-sm text-muted-foreground font-medium">Define your operating currency for financial statements and retail terminals.</p>
                  </div>
                </div>

                <div className="space-y-4 pt-4 max-w-md">
                  <Label className="text-[10px] font-black uppercase text-muted-foreground block px-1 tracking-widest">Select Dashboard Currency</Label>
                  <Select 
                    value={companyDoc?.currencyCode || 'USD'} 
                    onValueChange={handleCurrencyChange}
                    disabled={isUpdating}
                  >
                    <SelectTrigger className="h-16 rounded-2xl bg-secondary/10 border-none font-black text-lg px-6">
                      <SelectValue placeholder="Select currency" />
                    </SelectTrigger>
                    <SelectContent className="rounded-2xl font-black">
                      {WORLD_CURRENCIES.map(curr => (
                        <SelectItem key={curr.code} value={curr.code}>{curr.name} ({curr.symbol})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-[10px] font-bold text-muted-foreground italic px-1 mt-2">
                    Note: This updates the symbol shown across Mart, Laundry, Rent, and Service modules.
                  </p>
                </div>

                <div className="bg-primary/5 p-6 rounded-3xl border-2 border-primary/10 flex items-center gap-4 max-w-md">
                  <ShieldCheck className="w-8 h-8 text-primary" />
                  <div>
                    <p className="text-[10px] font-black uppercase text-primary tracking-widest">Preference Sync</p>
                    <p className="text-xs font-bold text-muted-foreground">Currency settings are synced across all authorized company viewers.</p>
                  </div>
                </div>
              </div>
            </Card>

            <Card className="border-none shadow-sm bg-secondary/10 rounded-[32px] p-8 max-w-4xl">
               <div className="flex items-center gap-3 mb-4">
                  <Settings2 className="w-5 h-5 text-primary" />
                  <h3 className="font-black uppercase text-xs tracking-widest">Regional Compliance</h3>
               </div>
               <p className="text-sm font-medium text-muted-foreground leading-relaxed">
                 Venturee Biz provides local-currency awareness for small business operations. While this changes visual representation, ensure your accounting entries remain consistent with your registered business jurisdiction.
               </p>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
