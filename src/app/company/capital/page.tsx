
'use client';

import { Sidebar } from '@/components/layout/sidebar';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Wallet, History, Settings, ArrowUpRight, ShieldCheck, Zap, Lock, Calendar, RefreshCw, Plus, Landmark } from 'lucide-react';
import { useAuth } from '@/components/auth-context';
import { useFirestore, useCollection, useMemoFirebase, useDoc } from '@/firebase';
import { collection, doc, updateDoc, increment } from 'firebase/firestore';
import { useState, useMemo, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { CapitalPurchase, Company, CapitalPeriod } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';

export default function CapitalControlPage() {
  const { user } = useAuth();
  const firestore = useFirestore();
  const { toast } = useToast();
  const [isUpdating, setIsUpdating] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [isResetDialogOpen, setIsResetDialogOpen] = useState(false);
  const [isInjectDialogOpen, setIsInjectDialogOpen] = useState(false);
  const [isTopUpPoolOpen, setIsTopUpPoolOpen] = useState(false);
  const [resetKey, setResetKey] = useState('');
  
  // Injection State (From Pool to Injected Bucket)
  const [injectAmount, setInjectAmount] = useState<number | string>('');
  const [isInjecting, setIsInjecting] = useState(false);

  // Pool Top-Up State (External to Pool)
  const [poolTopUpAmount, setPoolTopUpAmount] = useState<number | string>('');
  const [isToppingUpPool, setIsToppingUpPool] = useState(false);

  // Form states for live calculation
  const [formLimit, setFormLimit] = useState<number>(0);
  const [formStartDate, setFormStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [formPeriod, setFormPeriod] = useState<CapitalPeriod>('monthly');

  const companyRef = useMemoFirebase(() => {
    if (!firestore || !user?.companyId) return null;
    return doc(firestore, 'companies', user.companyId);
  }, [firestore, user?.companyId]);

  const purchasesQuery = useMemoFirebase(() => {
    if (!firestore || !user?.companyId) return null;
    return collection(firestore, 'companies', user.companyId, 'purchases');
  }, [firestore, user?.companyId]);

  const { data: companyDoc } = useDoc<Company>(companyRef);
  const { data: purchases } = useCollection<CapitalPurchase>(purchasesQuery);

  const currencySymbol = companyDoc?.currencySymbol || '$';

  useEffect(() => {
    if (companyDoc) {
      if (companyDoc.capitalLimit) setFormLimit(companyDoc.capitalLimit);
      if (companyDoc.capitalStartDate) setFormStartDate(companyDoc.capitalStartDate);
      if (companyDoc.capitalPeriod) setFormPeriod(companyDoc.capitalPeriod);
    }
  }, [companyDoc]);

  const activePurchases = useMemo(() => {
    if (!purchases) return [];
    if (!companyDoc?.capitalStartDate || !companyDoc?.capitalEndDate) return purchases;

    const start = new Date(companyDoc.capitalStartDate);
    const end = new Date(companyDoc.capitalEndDate);
    end.setHours(23, 59, 59, 999);

    return purchases.filter(p => {
      const pDate = new Date(p.timestamp);
      return pDate >= start && pDate <= end;
    });
  }, [purchases, companyDoc]);

  const totalSpent = activePurchases.reduce((acc, p) => acc + p.amount, 0);
  const baseLimit = companyDoc?.capitalLimit || 0;
  const injectedFunds = companyDoc?.injectedCapital || 0;
  const totalCapacity = baseLimit + injectedFunds;
  
  const remaining = Math.max(0, totalCapacity - totalSpent);
  const utilization = totalCapacity > 0 ? (totalSpent / totalCapacity) * 100 : 0;
  const currentPool = companyDoc?.nextCapitalAmount || 0;

  const calculatedEndDate = useMemo(() => {
    if (!formStartDate) return "";
    const date = new Date(formStartDate);
    switch (formPeriod) {
      case 'daily': date.setDate(date.getDate() + 1); break;
      case 'weekly': date.setDate(date.getDate() + 7); break;
      case 'monthly': date.setMonth(date.getMonth() + 1); break;
      case 'yearly': date.setFullYear(date.getFullYear() + 1); break;
    }
    return date.toISOString().split('T')[0];
  }, [formStartDate, formPeriod]);

  const isLocked = useMemo(() => {
    if (!companyDoc?.capitalEndDate) return false;
    const now = new Date();
    const end = new Date(companyDoc.capitalEndDate);
    end.setHours(23, 59, 59, 999);
    return now < end;
  }, [companyDoc]);

  const handleUpdateSettings = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!firestore || !user?.companyId || isLocked) return;

    if (formLimit <= 0) {
      toast({ title: "Invalid Limit", description: "Base budget limit must be greater than 0.", variant: "destructive" });
      return;
    }

    setIsUpdating(true);
    const updateData: any = {
      capitalLimit: formLimit,
      injectedCapital: 0,
      capitalPeriod: formPeriod,
      capitalStartDate: formStartDate,
      capitalEndDate: calculatedEndDate,
    };

    updateDoc(doc(firestore, 'companies', user.companyId), updateData)
      .then(() => toast({ title: "Cycle Protocol Locked", description: "Strategic procurement cycle is now active." }))
      .finally(() => setIsUpdating(false));
  };

  const handleTopUpPool = async () => {
    if (!firestore || !user?.companyId) return;
    setIsToppingUpPool(true);
    const amount = Number(poolTopUpAmount) || 0;
    if (amount <= 0) { setIsToppingUpPool(false); return; }
    updateDoc(doc(firestore, 'companies', user.companyId), { nextCapitalAmount: increment(amount) })
      .then(() => { toast({ title: "Pool Reservoir Expanded" }); setIsTopUpPoolOpen(false); setPoolTopUpAmount(''); })
      .finally(() => setIsToppingUpPool(false));
  };

  const handleInjectFunds = async () => {
    if (!firestore || !user?.companyId || !companyDoc) return;
    setIsInjecting(true);
    const amount = Number(injectAmount) || 0;
    if (amount <= 0 || amount > currentPool) { 
      toast({ title: "Insufficient Pool Assets", variant: "destructive" });
      setIsInjecting(false); 
      return; 
    }
    updateDoc(doc(firestore, 'companies', user.companyId), { 
      injectedCapital: increment(amount), 
      nextCapitalAmount: increment(-amount) 
    })
      .then(() => { 
        toast({ title: "Strategic Injection Confirmed", description: `Cycle capacity increased by ${currencySymbol}${amount}` }); 
        setIsInjectDialogOpen(false); 
        setInjectAmount(''); 
      })
      .finally(() => setIsInjecting(false));
  };

  const handleResetCycle = async () => {
    if (!firestore || !user?.companyId || !companyDoc || resetKey !== companyDoc.cancellationPassword) return;
    setIsResetting(true);
    updateDoc(doc(firestore, 'companies', user.companyId), { capitalLimit: 0, injectedCapital: 0, capitalPeriod: null, capitalStartDate: null, capitalEndDate: null })
      .then(() => { toast({ title: "Cycle Unlocked" }); setIsResetDialogOpen(false); setResetKey(''); })
      .finally(() => setIsResetting(false));
  };

  return (
    <div className="flex h-screen bg-background text-foreground font-body">
      <Sidebar />
      <main className="flex-1 overflow-auto p-10">
        <div className="max-w-7xl mx-auto">
          <div className="mb-12 flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div>
               <h1 className="text-5xl font-black font-headline tracking-tighter uppercase">Capital Guardrails</h1>
               <p className="text-muted-foreground font-bold text-lg mt-2">Strategic Liquidity & Procurement Control</p>
            </div>
            <div className="flex flex-wrap gap-4">
               <Button onClick={() => setIsTopUpPoolOpen(true)} variant="outline" className="rounded-2xl h-16 px-8 font-black border-2 border-primary/20 hover:bg-primary/5 transition-all text-sm uppercase tracking-widest"><Plus className="w-5 h-5 mr-3 text-primary" /> External Pool Deposit</Button>
               {isLocked && <Button onClick={() => setIsInjectDialogOpen(true)} className="rounded-2xl h-16 px-8 font-black bg-primary shadow-2xl transition-all hover:scale-[1.02] text-sm uppercase tracking-widest"><Zap className="w-5 h-5 mr-3 fill-current" /> Tactical Injection</Button>}
               {isLocked && <Button onClick={() => setIsResetDialogOpen(true)} variant="outline" className="rounded-2xl h-16 px-8 font-black border-2 border-destructive/20 hover:bg-destructive/5 transition-all text-sm uppercase tracking-widest"><RefreshCw className="w-5 h-5 mr-3 text-destructive" /> Reset Cycle</Button>}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
            <div className="lg:col-span-2 space-y-10">
              <Card className="border-none shadow-2xl bg-white rounded-[56px] overflow-hidden relative border-4 border-primary/5">
                <CardHeader className="p-12 pb-0">
                   <p className="text-[10px] font-black uppercase text-primary tracking-[0.3em] mb-3">Live Utilization Matrix</p>
                   <CardTitle className="text-8xl font-black tracking-tighter leading-none">{currencySymbol}{totalSpent.toLocaleString(undefined, { minimumFractionDigits: 2 })}</CardTitle>
                   <CardDescription className="font-bold text-xl mt-6 text-foreground flex items-center gap-3">
                      <div className="w-2 h-2 bg-primary rounded-full animate-pulse" />
                      Current Cycle Total Capacity: {currencySymbol}{totalCapacity.toLocaleString()}
                   </CardDescription>
                   <p className="text-sm font-bold text-muted-foreground mt-2">(Baseline: {currencySymbol}{baseLimit} + Strategic Injection: {currencySymbol}{injectedFunds})</p>
                </CardHeader>
                <CardContent className="p-12 pt-16">
                   <div className="space-y-8">
                      <div className="flex justify-between text-xs font-black uppercase tracking-[0.2em]">
                         <span className="text-primary">{utilization.toFixed(1)}% Velocity</span>
                         <span className="text-muted-foreground">Period ID: {companyDoc?.capitalStartDate || "STANDBY"} → {companyDoc?.capitalEndDate || "STANDBY"}</span>
                      </div>
                      <div className="relative h-10 w-full bg-secondary/30 rounded-[20px] overflow-hidden shadow-inner p-1">
                         <div className="h-full bg-primary rounded-[16px] shadow-lg transition-all duration-1000 ease-out" style={{ width: `${Math.min(utilization, 100)}%` }} />
                      </div>
                   </div>
                   <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-16">
                      <div className="bg-secondary/20 p-10 rounded-[40px] group border-2 border-transparent hover:border-primary/10 transition-all">
                         <ArrowUpRight className="w-10 h-10 text-primary mb-6 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
                         <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest mb-2">Available Budget</p>
                         <p className="text-4xl font-black text-foreground tracking-tighter">{currencySymbol}{remaining.toFixed(2)}</p>
                      </div>
                      <div className="bg-secondary/20 p-10 rounded-[40px] group border-2 border-transparent hover:border-accent/20 transition-all">
                         <Landmark className="w-10 h-10 text-accent mb-6 group-hover:scale-110 transition-transform" />
                         <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest mb-2">Verified Reinvestment Pool</p>
                         <p className="text-4xl font-black text-foreground tracking-tighter">{currencySymbol}{currentPool.toFixed(2)}</p>
                      </div>
                      <div className={cn("p-10 rounded-[40px] border-4 flex flex-col justify-center", isLocked ? "bg-primary/5 border-primary/20 shadow-inner" : "bg-orange-50 border-orange-200 animate-pulse")}>
                         <ShieldCheck className={cn("w-16 h-16 mb-4 opacity-40", isLocked ? "text-primary" : "text-orange-500")} />
                         <div>
                            <p className="text-[10px] font-black uppercase tracking-widest mb-1">Guardrail Status</p>
                            <p className="text-2xl font-black uppercase tracking-tight">{isLocked ? "ENFORCED" : "OPEN"}</p>
                         </div>
                      </div>
                   </div>
                </CardContent>
              </Card>
              <Card className="border-none shadow-sm bg-white rounded-[48px] overflow-hidden border-2 border-primary/5">
                 <CardHeader className="bg-secondary/10 p-10 flex flex-row items-center justify-between">
                    <div>
                       <CardTitle className="flex items-center gap-4 text-2xl font-black tracking-tight"><History className="w-8 h-8 text-primary" /> Procurement Log</CardTitle>
                       <CardDescription className="font-bold text-xs uppercase tracking-widest mt-2">Cycle-Aware Transaction Audit</CardDescription>
                    </div>
                    <Badge variant="outline" className="font-black text-xs h-10 px-6 border-2">{activePurchases.length} ENTRIES</Badge>
                 </CardHeader>
                 <CardContent className="p-0">
                    <div className="divide-y-2 divide-secondary/10">
                       {activePurchases?.slice().reverse().map(p => (
                          <div key={p.id} className="flex items-center justify-between p-8 hover:bg-secondary/5 transition-colors">
                             <div>
                                <p className="font-black text-2xl tracking-tighter text-foreground">{p.description}</p>
                                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-1.5">{new Date(p.timestamp).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}</p>
                             </div>
                             <p className="text-3xl font-black text-destructive tracking-tighter">-{currencySymbol}{p.amount.toFixed(2)}</p>
                          </div>
                       ))}
                       {(!activePurchases || activePurchases.length === 0) && (
                          <div className="py-24 text-center opacity-20">
                             <History className="w-16 h-16 mx-auto mb-4" />
                             <p className="font-black uppercase tracking-[0.3em] text-xs">No Records in current cycle</p>
                          </div>
                       )}
                    </div>
                 </CardContent>
              </Card>
            </div>

            <div className="lg:col-span-1">
              <Card className={cn("border-none shadow-2xl rounded-[56px] overflow-hidden sticky top-10 border-4", isLocked ? "bg-secondary/20 grayscale opacity-60 border-transparent" : "bg-white border-primary/10")}>
                <CardHeader className="bg-primary/10 p-12 relative overflow-hidden">
                   <div className="absolute top-0 right-0 p-8 opacity-10 rotate-12"><Settings className="w-24 h-24" /></div>
                   <CardTitle className="flex items-center gap-4 text-2xl font-black tracking-tight relative z-10"><Settings className="w-8 h-8 text-primary" /> Setup Base Cap</CardTitle>
                   <p className="text-[10px] font-black uppercase tracking-widest opacity-60 mt-2 relative z-10">Monthly Strategic Allocation</p>
                </CardHeader>
                <CardContent className="p-12">
                   <form onSubmit={handleUpdateSettings} className="space-y-10">
                      <div className="space-y-3">
                         <div className="flex justify-between items-center px-1">
                            <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Base Budget Target ({currencySymbol})</label>
                         </div>
                         <Input type="number" value={formLimit} onChange={(e) => setFormLimit(Number(e.target.value))} disabled={isLocked} className="h-20 rounded-[28px] bg-secondary/10 border-none text-4xl font-black tracking-tighter text-center shadow-inner" placeholder="0.00" required />
                      </div>
                      <div className="space-y-3">
                         <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest px-1">Cycle Protocol Period</label>
                         <Select value={formPeriod} onValueChange={(v) => setFormPeriod(v as CapitalPeriod)} disabled={isLocked}>
                            <SelectTrigger className="h-16 rounded-[24px] bg-secondary/10 border-none font-black text-sm uppercase tracking-widest px-8 shadow-inner"><SelectValue /></SelectTrigger>
                            <SelectContent className="rounded-2xl font-black uppercase text-xs tracking-widest">
                               <SelectItem value="daily">Daily Reset</SelectItem>
                               <SelectItem value="weekly">Weekly Reset</SelectItem>
                               <SelectItem value="monthly">Monthly Reset</SelectItem>
                               <SelectItem value="yearly">Yearly reset</SelectItem>
                            </SelectContent>
                         </Select>
                      </div>
                      <div className="space-y-3">
                         <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest px-1">Tactical Commencement</label>
                         <Input type="date" value={formStartDate} onChange={(e) => setFormStartDate(e.target.value)} disabled={isLocked} className="h-16 rounded-[24px] bg-secondary/10 border-none font-black text-lg px-8 shadow-inner" required />
                      </div>
                      <Button type="submit" className="w-full h-24 rounded-[32px] font-black text-xl shadow-2xl transition-all hover:scale-[1.02] uppercase tracking-[0.2em]" disabled={isUpdating || isLocked || formLimit <= 0}>
                         {isLocked ? "PROTOCOL LOCKED" : "Authorize & Lock"}
                      </Button>
                      {isLocked && <p className="text-center text-[10px] font-black text-primary uppercase tracking-[0.2em] opacity-60">Cycle in progress. Use Reset to reconfigure.</p>}
                   </form>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </main>

      <Dialog open={isTopUpPoolOpen} onOpenChange={setIsTopUpPoolOpen}>
         <DialogContent className="rounded-[48px] max-md p-0 overflow-hidden bg-white shadow-3xl">
            <div className="bg-primary p-12 text-primary-foreground relative">
               <div className="absolute top-0 right-0 p-8 opacity-10"><Plus className="w-20 h-20" /></div>
               <DialogTitle className="text-4xl font-black tracking-tighter">Pool Inflow</DialogTitle>
               <p className="text-xs font-bold opacity-70 mt-3 uppercase tracking-widest">External Reinvestment Protocol</p>
            </div>
            <div className="p-12 space-y-10">
               <div className="space-y-3">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground px-1">Inbound Deposit Volume ({currencySymbol})</Label>
                  <Input type="number" className="h-20 rounded-[28px] font-black text-5xl tracking-tighter text-center bg-secondary/10 border-none shadow-inner" value={poolTopUpAmount} onChange={(e) => setPoolTopUpAmount(e.target.value)}/>
               </div>
               <Button onClick={handleTopUpPool} disabled={isToppingUpPool} className="w-full h-20 rounded-[32px] font-black text-xl shadow-2xl transition-all hover:scale-[1.02]">Authorize Reservoir Deposit</Button>
            </div>
         </DialogContent>
      </Dialog>

      <Dialog open={isInjectDialogOpen} onOpenChange={setIsInjectDialogOpen}>
         <DialogContent className="rounded-[48px] max-md p-0 overflow-hidden bg-white shadow-3xl">
            <div className="bg-primary p-12 text-primary-foreground relative">
               <div className="absolute top-0 right-0 p-8 opacity-10"><Zap className="w-20 h-20" /></div>
               <DialogTitle className="text-4xl font-black tracking-tighter">Strategic Injection</DialogTitle>
               <p className="text-xs font-bold opacity-70 mt-3 uppercase tracking-widest">Capital Deployment Protocol</p>
            </div>
            <div className="p-12 space-y-10">
               <div className="p-8 bg-secondary/10 rounded-[32px] border-2 border-primary/10 shadow-inner">
                  <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2">Available Reservoir Assets</p>
                  <p className="text-5xl font-black text-primary tracking-tighter">{currencySymbol}{currentPool.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
               </div>
               <div className="space-y-3">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground px-1">Tactical Deployment Volume ({currencySymbol})</Label>
                  <Input type="number" className="h-20 rounded-[28px] font-black text-5xl tracking-tighter text-center bg-secondary/10 border-none shadow-inner" value={injectAmount} onChange={(e) => setInjectAmount(e.target.value)}/>
               </div>
               <Button onClick={handleInjectFunds} disabled={isInjecting} className="w-full h-20 rounded-[32px] font-black text-xl shadow-2xl transition-all hover:scale-[1.02]">Authorize Capital Injection</Button>
            </div>
         </DialogContent>
      </Dialog>

      <Dialog open={isResetDialogOpen} onOpenChange={setIsResetDialogOpen}>
         <DialogContent className="rounded-[48px] max-md p-0 overflow-hidden bg-white shadow-3xl">
            <div className="bg-destructive p-12 text-destructive-foreground relative">
               <div className="absolute top-0 right-0 p-8 opacity-10"><Lock className="w-20 h-20" /></div>
               <DialogTitle className="text-4xl font-black tracking-tighter">Emergency Unlock</DialogTitle>
               <p className="text-xs font-bold opacity-70 mt-3 uppercase tracking-widest">Protocol Override Authorization</p>
            </div>
            <div className="p-12 space-y-10">
               <div className="space-y-3">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground px-1">Reset Authority Key (8-CHARS)</Label>
                  <Input value={resetKey} onChange={(e) => setResetKey(e.target.value.toUpperCase())} className="h-20 rounded-[28px] font-black text-4xl tracking-[0.5em] text-center bg-secondary/10 border-none shadow-inner font-mono" placeholder="********" />
               </div>
               <Button onClick={handleResetCycle} disabled={isResetting || resetKey.length < 8} className="w-full h-20 rounded-[32px] font-black text-xl shadow-2xl bg-destructive hover:bg-destructive/90 transition-all uppercase tracking-widest">Decommission Protocol</Button>
            </div>
         </DialogContent>
      </Dialog>
    </div>
  );
}
