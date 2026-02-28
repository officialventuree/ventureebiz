
'use client';

import { Sidebar } from '@/components/layout/sidebar';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Globe, ShieldCheck, Settings2, Landmark } from 'lucide-react';
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
        title: "Strategic Preferences Synced", 
        description: `Global dashboard currency updated to ${selected.code} (${selected.symbol})` 
      });
    } catch (e: any) {
      toast({ title: "Update Protocol Failed", description: e.message, variant: "destructive" });
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="flex h-screen bg-background font-body">
      <Sidebar />
      <main className="flex-1 overflow-auto p-10">
        <div className="max-w-5xl mx-auto">
          <div className="mb-12">
            <h1 className="text-5xl font-black font-headline tracking-tighter uppercase">Regional Config</h1>
            <p className="text-muted-foreground font-bold text-lg mt-2">Localization & Global Operating Preferences</p>
          </div>

          <div className="grid grid-cols-1 gap-10">
            <Card className="border-none shadow-2xl rounded-[56px] bg-white p-16 overflow-hidden relative border-4 border-primary/5">
              <div className="absolute top-0 right-0 p-16 opacity-5 rotate-12">
                <Globe className="w-64 h-64" />
              </div>
              <div className="relative z-10 space-y-12">
                <div className="flex items-center gap-6">
                  <div className="w-20 h-20 bg-primary/10 rounded-[32px] flex items-center justify-center text-primary shadow-inner">
                    <Landmark className="w-10 h-10" />
                  </div>
                  <div>
                    <h2 className="text-3xl font-black tracking-tighter">Dashboard Localization</h2>
                    <p className="text-muted-foreground font-bold text-lg">Define your tactical operating currency</p>
                  </div>
                </div>

                <div className="space-y-6 pt-4 max-w-xl">
                  <Label className="text-[10px] font-black uppercase text-muted-foreground block px-2 tracking-[0.3em]">Selected Monetary Protocol</Label>
                  <Select 
                    value={companyDoc?.currencyCode || 'USD'} 
                    onValueChange={handleCurrencyChange}
                    disabled={isUpdating}
                  >
                    <SelectTrigger className="h-20 rounded-[32px] bg-secondary/10 border-none font-black text-2xl px-10 shadow-inner tracking-tight">
                      <SelectValue placeholder="Select monetary unit" />
                    </SelectTrigger>
                    <SelectContent className="rounded-[24px] font-black">
                      {WORLD_CURRENCIES.map(curr => (
                        <SelectItem key={curr.code} value={curr.code} className="h-12 text-sm">{curr.name} ({curr.symbol})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div className="p-6 bg-secondary/20 rounded-[24px] border border-secondary/30">
                     <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary mb-2">Architectural Note</p>
                     <p className="text-sm font-bold text-muted-foreground italic leading-relaxed">
                       Changing this value updates the currency symbol projection across Mart, Facility, Rent, and Service modules in real-time.
                     </p>
                  </div>
                </div>

                <div className="bg-primary/5 p-8 rounded-[40px] border-4 border-dashed border-primary/20 flex items-center gap-8 max-w-xl">
                  <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center shadow-xl text-primary shrink-0">
                     <ShieldCheck className="w-8 h-8" />
                  </div>
                  <div>
                    <p className="text-xs font-black uppercase text-primary tracking-[0.3em]">Sync Protocol</p>
                    <p className="text-sm font-bold text-muted-foreground mt-1 leading-relaxed">Regional settings are strictly enforced and synchronized across all provisioned access terminals for this business segment.</p>
                  </div>
                </div>
              </div>
            </Card>

            <Card className="border-none shadow-sm bg-secondary/10 rounded-[40px] p-10 max-w-5xl border-2 border-secondary/20">
               <div className="flex items-center gap-4 mb-6">
                  <Settings2 className="w-6 h-6 text-primary" />
                  <h3 className="font-black uppercase text-xs tracking-[0.4em] text-foreground">Strategic Compliance Protocol</h3>
               </div>
               <p className="text-sm font-bold text-muted-foreground leading-loose max-w-4xl">
                 Venturee Studio provides currency-aware abstraction for localized business operations. While this adjustment updates the visual projection of financial data, operational accounting entries must remain consistent with the verified jurisdiction of your registered enterprise. Dynamic currency switching does not perform real-time FX conversion on historical data.
               </p>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
