
'use client';

import { Sidebar } from '@/components/layout/sidebar';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  Plus, Building2, Mail, Key, Search, Trash2, 
  ShieldAlert, Layers, TrendingUp, 
  CreditCard, Banknote, QrCode, 
  Calendar, CheckCircle2, 
  ArrowRight, Landmark, Settings2, Briefcase, Globe,
  ShieldCheck, Upload
} from 'lucide-react';
import { createCompanyAction, renewCompanyAction } from '@/app/actions';
import { useState, useRef } from 'react';
import { 
  Company, User, ModuleType, 
  PlatformProfitEntry, 
  PricingCycle, ModulePricing, PaymentMethod 
} from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { useFirestore, useCollection, useMemoFirebase, useDoc } from '@/firebase';
import { collection, doc, setDoc, deleteDoc, updateDoc, addDoc } from 'firebase/firestore';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

const DEFAULT_MODULES: { id: ModuleType; label: string }[] = [
  { id: 'mart', label: 'Mart' },
  { id: 'laundry', label: 'Laundry' },
  { id: 'rent', label: 'Rent' },
  { id: 'services', label: 'Services' },
];

const DEFAULT_CYCLES: PricingCycle[] = [
  { id: 'daily', name: 'Daily', durationInDays: 1 },
  { id: 'weekly', name: 'Weekly', durationInDays: 7 },
  { id: 'monthly', name: 'Monthly', durationInDays: 30 },
  { id: 'yearly', name: 'Yearly', durationInDays: 365 },
];

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

export default function AdminDashboard() {
  const firestore = useFirestore();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  
  // Platform Config
  const configRef = useMemoFirebase(() => (!firestore ? null : doc(firestore, 'platform_config', 'localization')), [firestore]);
  const { data: platformConfig } = useDoc<any>(configRef);
  const currencySymbol = platformConfig?.currencySymbol || '$';

  // New Company / Renewal Form State
  const [selectedModules, setSelectedModules] = useState<ModuleType[]>(['mart', 'laundry', 'rent', 'services']);
  const [selectedCycle, setSelectedCycle] = useState<string>('monthly');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [cashReceived, setCashReceived] = useState<string>('');
  const [referenceCode, setReferenceCode] = useState<string>('');
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('companies');

  // Queries
  const companiesQuery = useMemoFirebase(() => (!firestore ? null : collection(firestore, 'companies')), [firestore]);
  const pricingQuery = useMemoFirebase(() => (!firestore ? null : collection(firestore, 'module_pricings')), [firestore]);
  const profitsQuery = useMemoFirebase(() => (!firestore ? null : collection(firestore, 'platform_profit_entries')), [firestore]);
  
  const { data: companies } = useCollection<Company>(companiesQuery);
  const { data: pricings } = useCollection<ModulePricing>(pricingQuery);
  const { data: platformProfits } = useCollection<PlatformProfitEntry>(profitsQuery);

  const filteredCompanies = companies?.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const calculateTotal = (modules: ModuleType[], cycleId: string) => {
    if (!pricings) return modules.length * 50;
    return modules.reduce((acc, modId) => {
      const p = pricings.find(p => p.moduleId === modId && p.pricingCycleId === cycleId);
      return acc + (p?.price || 50);
    }, 0);
  };

  const totalDue = calculateTotal(selectedModules, selectedCycle);
  const durationDays = DEFAULT_CYCLES.find(c => c.id === selectedCycle)?.durationInDays || 30;
  const changeDue = paymentMethod === 'cash' ? Math.max(0, (Number(cashReceived) || 0) - totalDue) : 0;

  const handleRegister = async () => {
    if (!firestore || !formRef.current) return;
    setIsCreating(true);
    
    const formData = new FormData(formRef.current);
    // Ensure modules are appended correctly for the action
    selectedModules.forEach(mod => formData.append('modules', mod));
    formData.append('periodId', selectedCycle);
    formData.append('totalAmount', totalDue.toString());
    formData.append('durationDays', durationDays.toString());
    formData.append('paymentMethod', paymentMethod);
    formData.append('referenceCode', referenceCode);
    
    try {
      const result = await createCompanyAction(formData);
      
      if (result.success && result.company && result.subscription && result.transaction) {
        // 1. Save Company Core
        await setDoc(doc(firestore, 'companies', result.company.id), result.company);
        
        // 2. Save Owner Account (Linked by Email/Password for Manual Auth)
        await setDoc(doc(firestore, 'company_users', result.company.id), {
          id: result.company.id,
          name: result.company.name,
          email: result.company.email,
          password: result.company.password,
          role: 'CompanyOwner',
          companyId: result.company.id,
          enabledModules: selectedModules
        });
        
        // 3. Log Profit Entry
        await addDoc(collection(firestore, 'platform_profit_entries'), {
          id: crypto.randomUUID(),
          paymentTransactionId: result.transaction.id,
          companyId: result.company.id,
          amount: result.transaction.amount,
          currencyId: platformConfig?.currencyCode || 'USD',
          entryDate: new Date().toISOString(),
          type: 'InitialSubscription'
        });

        toast({ 
          title: "Partner Provisioned", 
          description: `${result.company.name} is now active. Login ID: ${result.company.email}` 
        });
        
        setIsCheckoutOpen(false);
        setSelectedModules(['mart', 'laundry', 'rent', 'services']);
        formRef.current.reset();
      } else {
        toast({ title: "Action Failed", description: result.error || "Unknown error", variant: "destructive" });
      }
    } catch (e: any) {
      toast({ title: "Provisioning Error", description: e.message, variant: "destructive" });
    } finally {
      setIsCreating(false);
    }
  };

  const handleRenew = async (company: Company) => {
    if (!firestore) return;
    setIsCreating(true);

    const formData = new FormData();
    selectedModules.forEach(mod => formData.append('modules', mod));
    formData.append('periodId', selectedCycle);
    formData.append('totalAmount', totalDue.toString());
    formData.append('durationDays', durationDays.toString());
    formData.append('paymentMethod', paymentMethod);
    formData.append('referenceCode', referenceCode);

    const result = await renewCompanyAction(formData, company);

    if (result.success && result.subscription && result.transaction) {
      try {
        await updateDoc(doc(firestore, 'companies', company.id), {
          expiryDate: result.newExpiry,
          status: 'Active',
          enabledModules: selectedModules
        });
        await updateDoc(doc(firestore, 'company_users', company.id), {
          enabledModules: selectedModules
        });
        
        await addDoc(collection(firestore, 'platform_profit_entries'), {
          id: crypto.randomUUID(),
          paymentTransactionId: result.transaction.id,
          companyId: company.id,
          amount: result.transaction.amount,
          currencyId: platformConfig?.currencyCode || 'USD',
          entryDate: new Date().toISOString(),
          type: 'Renewal'
        });

        toast({ title: "Subscription Renewed" });
        setIsCheckoutOpen(false);
      } catch (err: any) {
        toast({ title: "Renewal Failed", variant: "destructive" });
      }
    }
    setIsCreating(false);
  };

  const handleRevokeLicense = (companyId: string, companyName: string) => {
    if (!firestore) return;
    
    if (!confirm(`Revoke license for ${companyName}? This will permanently delete the partner dashboard and all associated login credentials.`)) {
      return;
    }

    const companyRef = doc(firestore, 'companies', companyId);
    const userRef = doc(firestore, 'company_users', companyId);

    deleteDoc(companyRef).catch(async (err) => {
      errorEmitter.emit('permission-error', new FirestorePermissionError({
        path: companyRef.path,
        operation: 'delete'
      }));
    });

    deleteDoc(userRef).catch(async (err) => {
      errorEmitter.emit('permission-error', new FirestorePermissionError({
        path: userRef.path,
        operation: 'delete'
      }));
    });

    toast({ 
      title: "License Revoked", 
      description: `Dashboard for ${companyName} has been removed from the platform.` 
    });
  };

  return (
    <div className="flex h-screen bg-background font-body">
      <Sidebar />
      <main className="flex-1 overflow-auto p-8">
        <div className="max-w-6xl mx-auto">
          <div className="mb-10">
            <h1 className="text-4xl font-black font-headline tracking-tighter">SaaS Management</h1>
            <p className="text-muted-foreground font-medium">Platform Operations & Partner Billing</p>
          </div>

          <Tabs defaultValue="companies" onValueChange={setActiveTab} className="space-y-8">
            <TabsList className="bg-white/50 border p-1 rounded-2xl shadow-sm self-start">
              <TabsTrigger value="companies" className="rounded-xl px-8 font-black gap-2"><Briefcase className="w-4 h-4" /> Partner Directory</TabsTrigger>
              <TabsTrigger value="modules" className="rounded-xl px-8 gap-2 font-black"><Layers className="w-4 h-4" /> Module Pricing</TabsTrigger>
              <TabsTrigger value="profits" className="rounded-xl px-8 gap-2 font-black"><TrendingUp className="w-4 h-4" /> Platform Profits</TabsTrigger>
              <TabsTrigger value="billing" className="rounded-xl px-8 gap-2 font-black"><Settings2 className="w-4 h-4" /> Gateway Settings</TabsTrigger>
            </TabsList>

            <TabsContent value="companies" className="grid grid-cols-1 lg:grid-cols-4 gap-8">
              <div className="lg:col-span-1">
                <Card className="border-none shadow-sm rounded-[32px] bg-white p-8 sticky top-8">
                  <h3 className="text-xl font-black mb-6">New Partnership</h3>
                  <form 
                    ref={formRef}
                    onSubmit={(e) => { e.preventDefault(); setIsCheckoutOpen(true); }} 
                    className="space-y-6"
                  >
                    <div className="space-y-1.5">
                      <Label className="text-[10px] font-black uppercase text-muted-foreground">Legal Name</Label>
                      <Input name="name" placeholder="Acme Corp" required className="h-12 rounded-xl bg-secondary/10 border-none font-bold" />
                    </div>
                    <div className="space-y-3">
                      <Label className="text-[10px] font-black uppercase text-muted-foreground">Provisioning</Label>
                      <div className="grid grid-cols-1 gap-2 p-4 bg-secondary/10 rounded-2xl">
                        {DEFAULT_MODULES.map(mod => (
                          <div key={mod.id} className="flex items-center space-x-2">
                            <Checkbox 
                              id={`mod-${mod.id}`} 
                              checked={selectedModules.includes(mod.id)} 
                              onCheckedChange={(checked) => {
                                if (checked) setSelectedModules([...selectedModules, mod.id]);
                                else setSelectedModules(selectedModules.filter(m => m !== mod.id));
                              }}
                            />
                            <Label htmlFor={`mod-${mod.id}`} className="text-xs font-bold uppercase">{mod.label}</Label>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[10px] font-black uppercase text-muted-foreground">Billing Cycle</Label>
                      <Select value={selectedCycle} onValueChange={setSelectedCycle}>
                        <SelectTrigger className="h-12 rounded-xl bg-secondary/10 border-none font-bold">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl font-bold">
                          {DEFAULT_CYCLES.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="bg-primary/5 p-6 rounded-2xl border-2 border-primary/10 flex justify-between items-center">
                       <span className="text-[10px] font-black text-primary uppercase">Total Value</span>
                       <span className="text-2xl font-black">{currencySymbol}{totalDue.toFixed(2)}</span>
                    </div>
                    <Button type="submit" className="w-full h-14 rounded-2xl font-black shadow-xl" disabled={selectedModules.length === 0}>
                      Proceed to Checkout
                    </Button>
                  </form>
                </Card>
              </div>

              <div className="lg:col-span-3 space-y-6">
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-primary w-5 h-5" />
                  <Input 
                    placeholder="SEARCH PARTNERS..." 
                    className="pl-16 h-16 rounded-[24px] border-none bg-white shadow-lg text-lg font-black"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>

                <div className="grid gap-4">
                  {filteredCompanies?.map(company => (
                    <Card key={company.id} className="border-none shadow-sm rounded-[32px] bg-white overflow-hidden group hover:shadow-md transition-all">
                      <CardContent className="p-8">
                        <div className="flex justify-between items-start mb-6">
                          <div>
                            <div className="flex items-center gap-3">
                              <h4 className="text-2xl font-black tracking-tight">{company.name}</h4>
                            </div>
                            <p className="text-[10px] font-bold text-muted-foreground uppercase mt-1">ID: {company.id}</p>
                            <div className="flex gap-1 mt-3">
                              {company.enabledModules?.map(m => (
                                <Badge key={m} variant="secondary" className="text-[8px] font-black uppercase px-2 py-0 border-none bg-primary/10 text-primary">{m}</Badge>
                              ))}
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-2">
                             <Badge className={cn(
                               "font-black text-[10px] uppercase h-6 px-3",
                               company.status === 'Active' ? "bg-green-600" : "bg-destructive"
                             )}>{company.status}</Badge>
                             <p className="text-[9px] font-black text-muted-foreground uppercase">Expires: {company.expiryDate ? new Date(company.expiryDate).toLocaleDateString() : 'N/A'}</p>
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                           <InfoTile icon={Mail} label="Login Entry" value={company.email} />
                           <InfoTile icon={Key} label="Dashboard Key" value={company.password || '••••••'} />
                           <InfoTile icon={ShieldAlert} label="Reset Authority" value={company.cancellationPassword} color="text-destructive" />
                        </div>

                        <div className="pt-6 border-t flex justify-between items-center">
                           <Button 
                            variant="ghost" 
                            className="text-destructive font-black text-xs uppercase" 
                            onClick={() => handleRevokeLicense(company.id, company.name)}
                           >
                             <Trash2 className="w-4 h-4 mr-2" /> Revoke License
                           </Button>
                           
                           <Dialog>
                              <DialogTrigger asChild>
                                 <Button className="rounded-xl font-black text-xs h-10 px-6 bg-primary shadow-lg">Renew / Upgrade</Button>
                              </DialogTrigger>
                              <DialogContent className="rounded-[40px] max-w-xl p-0 overflow-hidden">
                                 <div className="bg-primary p-10 text-primary-foreground text-center">
                                    <DialogTitle className="text-3xl font-black">Renew Partnership</DialogTitle>
                                    <p className="text-sm font-bold opacity-80 mt-2">Adjust terms for {company.name}</p>
                                 </div>
                                 <div className="p-8 space-y-6">
                                    <div className="space-y-4">
                                       <Label className="text-[10px] font-black uppercase">Adjust Provisioning</Label>
                                       <div className="grid grid-cols-2 gap-2">
                                          {DEFAULT_MODULES.map(mod => (
                                            <div key={mod.id} className="flex items-center space-x-2">
                                              <Checkbox 
                                                id={`renew-mod-${mod.id}`} 
                                                checked={selectedModules.includes(mod.id)} 
                                                onCheckedChange={(checked) => {
                                                  if (checked) setSelectedModules([...selectedModules, mod.id]);
                                                  else setSelectedModules(selectedModules.filter(m => m !== mod.id));
                                                }}
                                              />
                                              <Label htmlFor={`renew-mod-${mod.id}`} className="text-xs font-bold uppercase">{mod.label}</Label>
                                            </div>
                                          ))}
                                       </div>
                                    </div>
                                    <div className="space-y-1.5">
                                       <Label className="text-[10px] font-black uppercase">Extension Period</Label>
                                       <Select value={selectedCycle} onValueChange={setSelectedCycle}>
                                          <SelectTrigger className="h-12 rounded-xl bg-secondary/10 border-none font-bold">
                                            <SelectValue />
                                          </SelectTrigger>
                                          <SelectContent className="rounded-xl font-bold">
                                            {DEFAULT_CYCLES.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                                          </SelectContent>
                                       </Select>
                                    </div>
                                    <div className="bg-primary/5 p-6 rounded-2xl border-2 border-primary/10 flex justify-between items-center">
                                       <span className="text-[10px] font-black text-primary uppercase">Total Renewal Fee</span>
                                       <span className="text-2xl font-black">{currencySymbol}{totalDue.toFixed(2)}</span>
                                    </div>
                                    <Button className="w-full h-14 rounded-2xl font-black shadow-xl" onClick={() => handleRenew(company)}>Apply Renewal</Button>
                                 </div>
                              </DialogContent>
                           </Dialog>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="modules">
               <ModulePricingConfig pricings={pricings} currencySymbol={currencySymbol} />
            </TabsContent>

            <TabsContent value="profits">
               <PlatformProfits profits={platformProfits} currencySymbol={currencySymbol} />
            </TabsContent>

            <TabsContent value="billing">
               <PlatformBillingSettings platformConfig={platformConfig} />
            </TabsContent>
          </Tabs>
        </div>
      </main>

      {/* Global Checkout Dialog for Registration */}
      <Dialog open={isCheckoutOpen} onOpenChange={setIsCheckoutOpen}>
         <DialogContent className="rounded-[40px] max-w-2xl p-0 overflow-hidden bg-white border-none shadow-2xl">
            <div className="bg-primary p-12 text-primary-foreground text-center">
               <DialogTitle className="text-xs font-black uppercase opacity-80 mb-2">Checkout Verification</DialogTitle>
               <h2 className="text-7xl font-black tracking-tighter">{currencySymbol}{totalDue.toFixed(2)}</h2>
            </div>
            <div className="p-12 space-y-10">
               <div className="space-y-4">
                  <Label className="text-[10px] font-black uppercase tracking-widest px-1">Settlement Method</Label>
                  <RadioGroup value={paymentMethod} onValueChange={(v) => setPaymentMethod(v as any)} className="grid grid-cols-3 gap-4">
                     <PaymentOption value="cash" label="Cash" icon={Banknote} id="adm_cash" />
                     <PaymentOption value="card" label="Card" icon={CreditCard} id="adm_card" />
                     <PaymentOption value="duitnow" label="DuitNow" icon={QrCode} id="adm_qr" />
                  </RadioGroup>
               </div>

               {paymentMethod === 'cash' && (
                 <div className="space-y-6 animate-in fade-in slide-in-from-top-2">
                    <div className="space-y-2">
                       <Label className="text-[10px] font-black uppercase text-muted-foreground px-1">Cash Received ({currencySymbol})</Label>
                       <Input type="number" className="h-20 rounded-[28px] font-black text-4xl bg-secondary/20 border-none text-center" value={cashReceived} onChange={(e) => setCashReceived(e.target.value)} />
                    </div>
                    {Number(cashReceived) >= totalDue && (
                      <div className="bg-primary/5 p-8 rounded-[32px] border-4 border-primary/20 flex justify-between items-center">
                         <span className="text-[10px] font-black uppercase text-primary">Balance to Return</span>
                         <span className="text-5xl font-black">{currencySymbol}{changeDue.toFixed(2)}</span>
                      </div>
                    )}
                 </div>
               )}

               {(paymentMethod === 'card' || paymentMethod === 'duitnow') && (
                 <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
                    <Label className="text-[10px] font-black uppercase text-muted-foreground px-1">Transaction Ref / Trace ID</Label>
                    <Input placeholder="Enter reference code..." className="h-16 rounded-[24px] font-black text-xl bg-secondary/20 border-none px-8" value={referenceCode} onChange={(e) => setReferenceCode(e.target.value)} />
                 </div>
               )}

               <Button 
                className="w-full h-20 rounded-[32px] font-black text-2xl shadow-2xl" 
                disabled={isCreating || (paymentMethod === 'cash' && Number(cashReceived) < totalDue)} 
                onClick={handleRegister}
               >
                  {isCreating ? "Authorizing..." : "Complete Provisioning"}
               </Button>
            </div>
         </DialogContent>
      </Dialog>
    </div>
  );
}

function ModulePricingConfig({ pricings, currencySymbol }: { pricings: ModulePricing[] | null, currencySymbol: string }) {
  const firestore = useFirestore();
  const { toast } = useToast();
  const [editing, setEditing] = useState<string | null>(null);
  const [editPrice, setEditPrice] = useState<string>('');

  const savePrice = async (moduleId: string, cycleId: string) => {
    if (!firestore) return;
    const id = `${moduleId}_${cycleId}`;
    const pricing: ModulePricing = {
      id,
      moduleId,
      pricingCycleId: cycleId,
      price: Number(editPrice),
      currencyId: 'GLOBAL'
    };
    await setDoc(doc(firestore, 'module_pricings', id), pricing);
    toast({ title: "Pricing Updated" });
    setEditing(null);
  };

  return (
    <div className="bg-white rounded-[40px] border shadow-sm overflow-hidden">
       <table className="w-full text-sm text-left">
          <thead className="bg-secondary/20">
             <tr>
                <th className="p-8 font-black uppercase text-[10px]">Business Module</th>
                {DEFAULT_CYCLES.map(c => <th key={c.id} className="p-8 font-black uppercase text-[10px] text-center">{c.name}</th>)}
             </tr>
          </thead>
          <tbody className="divide-y">
             {DEFAULT_MODULES.map(mod => (
               <tr key={mod.id} className="hover:bg-secondary/5">
                  <td className="p-8">
                     <p className="font-black text-lg">{mod.label}</p>
                     <p className="text-[10px] font-bold text-muted-foreground uppercase">Software Pillar</p>
                  </td>
                  {DEFAULT_CYCLES.map(cycle => {
                    const price = pricings?.find(p => p.moduleId === mod.id && p.pricingCycleId === cycle.id)?.price || 0;
                    const id = `${mod.id}_${cycle.id}`;
                    return (
                      <td key={cycle.id} className="p-8 text-center">
                         {editing === id ? (
                           <div className="flex items-center gap-2 justify-center">
                              <Input type="number" value={editPrice} onChange={(e) => setEditPrice(e.target.value)} className="w-20 h-10 rounded-lg text-center font-black" />
                              <Button size="icon" className="h-10 w-10" onClick={() => savePrice(mod.id, cycle.id)}><CheckCircle2 className="w-4 h-4" /></Button>
                           </div>
                         ) : (
                           <div className="group flex flex-col items-center gap-1 cursor-pointer" onClick={() => { setEditing(id); setEditPrice(price.toString()); }}>
                              <p className="font-black text-xl text-primary">{currencySymbol}{price.toFixed(2)}</p>
                              <p className="text-[10px] font-bold text-muted-foreground uppercase group-hover:text-primary transition-colors">Edit Price</p>
                           </div>
                         )}
                      </td>
                    );
                  })}
               </tr>
             ))}
          </tbody>
       </table>
    </div>
  );
}

function PlatformProfits({ profits, currencySymbol }: { profits: PlatformProfitEntry[] | null, currencySymbol: string }) {
  const totalRevenue = profits?.reduce((acc, p) => acc + p.amount, 0) || 0;
  
  return (
    <div className="space-y-8">
       <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <ReportStat label="Platform Revenue" value={`${currencySymbol}${totalRevenue.toFixed(2)}`} icon={Landmark} />
          <ReportStat label="Active Partners" value="12" icon={Building2} color="text-primary" />
          <ReportStat label="Avg. MRR" value={`${currencySymbol}${(totalRevenue / 12).toFixed(2)}`} icon={TrendingUp} />
       </div>

       <div className="bg-white rounded-[40px] border shadow-sm overflow-hidden">
          <CardHeader className="bg-secondary/10 p-8 border-b">
             <CardTitle className="font-black">Profit Ledger</CardTitle>
             <CardDescription className="font-bold">Real-time SaaS billing history</CardDescription>
          </CardHeader>
          <table className="w-full text-sm text-left">
             <thead className="bg-secondary/5">
                <tr>
                   <th className="p-6 font-black uppercase text-[10px]">Date</th>
                   <th className="p-6 font-black uppercase text-[10px]">Type</th>
                   <th className="p-6 font-black uppercase text-[10px]">Partner ID</th>
                   <th className="p-6 text-right font-black uppercase text-[10px]">Amount</th>
                </tr>
             </thead>
             <tbody className="divide-y">
                {profits?.sort((a,b) => new Date(b.entryDate).getTime() - new Date(a.entryDate).getTime()).map(p => (
                  <tr key={p.id} className="hover:bg-secondary/5">
                     <td className="p-6 font-bold">{new Date(p.entryDate).toLocaleString()}</td>
                     <td className="p-6"><Badge variant="outline" className="font-black uppercase text-[9px]">{p.type}</Badge></td>
                     <td className="p-6 font-mono text-[10px]">{p.companyId}</td>
                     <td className="p-6 text-right font-black text-primary text-lg">{currencySymbol}{p.amount.toFixed(2)}</td>
                  </tr>
                ))}
             </tbody>
          </table>
       </div>
    </div>
  );
}

function PlatformBillingSettings({ platformConfig }: { platformConfig: any }) {
  const firestore = useFirestore();
  const { toast } = useToast();

  const handleCurrencyChange = async (code: string) => {
    if (!firestore) return;
    const selected = WORLD_CURRENCIES.find(c => c.code === code);
    if (!selected) return;

    const localizationRef = doc(firestore, 'platform_config', 'localization');
    await setDoc(localizationRef, {
      currencyCode: selected.code,
      currencySymbol: selected.symbol,
      updatedAt: new Date().toISOString()
    }, { merge: true });

    toast({ title: "Localization Updated", description: `Platform currency set to ${selected.code} (${selected.symbol})` });
  };

  const handleUpload = async (e: any) => {
    const file = e.target.files?.[0];
    if (!file || !firestore) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      setDoc(doc(firestore, 'platform_config', 'localization'), { duitNowQr: reader.result as string }, { merge: true });
      toast({ title: "Platform Gateway Updated" });
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 py-12 max-w-5xl mx-auto">
       <Card className="border-none shadow-sm rounded-[40px] bg-white p-12 text-center space-y-8">
          <div className="w-20 h-20 bg-primary/10 rounded-3xl flex items-center justify-center text-primary mx-auto"><QrCode className="w-10 h-10" /></div>
          <h2 className="text-3xl font-black tracking-tight">Platform Gateway</h2>
          <p className="text-sm text-muted-foreground font-medium">Configure the DuitNow QR where partners will settle their dashboard subscription fees.</p>
          
          {platformConfig?.duitNowQr ? (
            <div className="relative group mx-auto w-fit">
              <Image src={platformConfig.duitNowQr} alt="QR" width={200} height={200} className="rounded-3xl border-4" />
              <label className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center rounded-3xl cursor-pointer transition-opacity">
                 <Upload className="text-white w-8 h-8" />
                 <input type="file" className="hidden" accept="image/*" onChange={handleUpload} />
              </label>
            </div>
          ) : (
            <label className="w-full h-64 border-4 border-dashed rounded-[40px] flex flex-col items-center justify-center cursor-pointer hover:bg-secondary/20 transition-all gap-4 border-secondary">
               <Plus className="w-10 h-10 text-primary" />
               <p className="text-xs font-black uppercase tracking-widest">Upload Platform QR Code</p>
               <input type="file" className="hidden" accept="image/*" onChange={handleUpload} />
            </label>
          )}
       </Card>

       <Card className="border-none shadow-sm rounded-[40px] bg-white p-12 text-center space-y-8">
          <div className="w-20 h-20 bg-primary/10 rounded-3xl flex items-center justify-center text-primary mx-auto"><Globe className="w-10 h-10" /></div>
          <h2 className="text-3xl font-black tracking-tight">Platform Localization</h2>
          <p className="text-sm text-muted-foreground font-medium">Define the global operating currency for all partner transactions and SaaS billing.</p>
          
          <div className="space-y-4 pt-4 text-left">
             <Label className="text-[10px] font-black uppercase text-muted-foreground block px-1 tracking-widest">Selected Operating Currency</Label>
             <Select value={platformConfig?.currencyCode || 'USD'} onValueChange={handleCurrencyChange}>
                <SelectTrigger className="h-16 rounded-2xl bg-secondary/10 border-none font-black text-lg px-6"><SelectValue /></SelectTrigger>
                <SelectContent className="rounded-2xl font-black">
                   {WORLD_CURRENCIES.map(curr => (
                     <SelectItem key={curr.code} value={curr.code}>{curr.name} ({curr.symbol})</SelectItem>
                   ))}
                </SelectContent>
             </Select>
             <p className="text-[10px] font-bold text-muted-foreground italic px-1 mt-2">Note: Changing this will update the symbol shown on all financial statements platform-wide.</p>
          </div>

          <div className="bg-primary/5 p-6 rounded-3xl border-2 border-primary/10 flex items-center gap-4 text-left">
             <ShieldCheck className="w-8 h-8 text-primary" />
             <div>
                <p className="text-[10px] font-black uppercase text-primary tracking-widest">Financial Guardrail</p>
                <p className="text-xs font-bold text-muted-foreground">Currency settings are enforced globally across all SaaS tiers.</p>
             </div>
          </div>
       </Card>
    </div>
  );
}

function InfoTile({ icon: Icon, label, value, color }: any) {
  return (
    <div className="flex items-center gap-3 p-4 bg-secondary/20 rounded-2xl">
       <Icon className="w-4 h-4 text-primary" />
       <div className="min-w-0">
          <p className="text-[9px] font-black text-muted-foreground uppercase leading-none mb-1">{label}</p>
          <p className={cn("text-xs font-bold truncate", color)}>{value}</p>
       </div>
    </div>
  );
}

function PaymentOption({ value, label, icon: Icon, id }: any) {
  return (
    <div className="flex-1">
      <RadioGroupItem value={value} id={id} className="peer sr-only" />
      <Label htmlFor={id} className="flex flex-col items-center justify-center rounded-[24px] border-4 border-transparent bg-secondary/20 p-4 hover:bg-secondary/30 peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/5 cursor-pointer transition-all h-28 text-center">
        <Icon className="mb-2 h-7 w-7 text-primary" />
        <span className="text-[10px] font-black uppercase tracking-widest">{label}</span>
      </Label>
    </div>
  );
}

function ReportStat({ label, value, icon: Icon, color = "text-foreground" }: any) {
  return (
    <Card className="border-none shadow-sm p-8 bg-white rounded-[32px] flex justify-between items-start">
       <div>
          <p className="text-[10px] font-black uppercase text-muted-foreground mb-2 tracking-widest">{label}</p>
          <h4 className={cn("text-4xl font-black tracking-tighter", color)}>{value}</h4>
       </div>
       <div className="w-12 h-12 bg-secondary/50 rounded-2xl flex items-center justify-center text-primary"><Icon className="w-6 h-6" /></div>
    </Card>
  );
}
