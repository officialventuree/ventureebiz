
'use client';

import { Sidebar } from '@/components/layout/sidebar';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Wallet, History, Settings, ArrowUpRight, ShieldCheck, Zap, Lock, Calendar, RefreshCw, Plus, Sparkles, Landmark, ArrowDownLeft, Info } from 'lucide-react';
import { useAuth } from '@/components/auth-context';
import { useFirestore, useCollection, useMemoFirebase, useDoc } from '@/firebase';
import { collection, doc, updateDoc, increment } from 'firebase/firestore';
import { useState, useMemo, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { CapitalPurchase, Company, CapitalPeriod } from '@/lib/types';
import { cn } from '@/lib/utils';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
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
      toast({ title: "Invalid Limit", variant: "destructive" });
      return;
    }

    if (formLimit > currentPool) {
      toast({ 
        title: "Insufficient Pool Funds", 
        description: `Your initial limit exceeds the verified pool balance (${currencySymbol}${currentPool.toFixed(2)}).`,
        variant: "destructive" 
      });
      return;
    }

    setIsUpdating(true);
    const updateData: any = {
      capitalLimit: formLimit,
      injectedCapital: 0,
      capitalPeriod: formPeriod,
      capitalStartDate: formStartDate,
      capitalEndDate: calculatedEndDate,
      nextCapitalAmount: increment(-formLimit)
    };

    updateDoc(doc(firestore, 'companies', user.companyId), updateData)
      .then(() => toast({ title: "Budget Locked" }))
      .finally(() => setIsUpdating(false));
  };

  const handleTopUpPool = async () => {
    if (!firestore || !user?.companyId) return;
    setIsToppingUpPool(true);
    const amount = Number(poolTopUpAmount) || 0;
    if (amount <= 0) { setIsToppingUpPool(false); return; }
    updateDoc(doc(firestore, 'companies', user.companyId), { nextCapitalAmount: increment(amount) })
      .then(() => { toast({ title: "Pool Expanded" }); setIsTopUpPoolOpen(false); setPoolTopUpAmount(''); })
      .finally(() => setIsToppingUpPool(false));
  };

  const handleInjectFunds = async () => {
    if (!firestore || !user?.companyId || !companyDoc) return;
    setIsInjecting(true);
    const amount = Number(injectAmount) || 0;
    if (amount <= 0 || amount > currentPool) { setIsInjecting(false); return; }
    updateDoc(doc(firestore, 'companies', user.companyId), { injectedCapital: increment(amount), nextCapitalAmount: increment(-amount) })
      .then(() => { toast({ title: "Capital Injected" }); setIsInjectDialogOpen(false); setInjectAmount(''); })
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
      <main className="flex-1 overflow-auto p-8">
        <div className="max-w-6xl mx-auto">
          <div className="mb-8 flex justify-between items-end">
            <div><h1 className="text-3xl font-black font-headline tracking-tight">Capital Control</h1><p className="text-muted-foreground font-medium">Precision Spending Limits & Guardrails</p></div>
            <div className="flex gap-4"><Button onClick={() => setIsTopUpPoolOpen(true)} variant="outline" className="rounded-2xl h-12 px-6 font-black"><Plus className="w-4 h-4 mr-2" /> Top-up Pool</Button>{isLocked && <Button onClick={() => setIsInjectDialogOpen(true)} className="rounded-2xl h-12 px-6 font-black bg-primary"><Zap className="w-4 h-4 mr-2" /> Inject from Pool</Button>}{isLocked && <Button onClick={() => setIsResetDialogOpen(true)} variant="outline" className="rounded-2xl h-12 px-6 font-black"><RefreshCw className="w-4 h-4 mr-2" /> Reset Configuration</Button>}</div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-8">
              <Card className="border-none shadow-2xl bg-white rounded-[40px] overflow-hidden relative">
                <CardHeader className="p-10 pb-0"><p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest mb-2">Live Capital Utilization</p><CardTitle className="text-6xl font-black tracking-tighter">{currencySymbol}{totalSpent.toFixed(2)}</CardTitle><CardDescription className="font-bold text-lg mt-2">Total Capacity Balance: {currencySymbol}{totalCapacity.toLocaleString()} (Base: {currencySymbol}{baseLimit} + Injected: {currencySymbol}{injectedFunds})</CardDescription></CardHeader>
                <CardContent className="p-10"><div className="space-y-6"><div className="flex justify-between text-xs font-black uppercase tracking-widest"><span>{utilization.toFixed(1)}% Consumed</span><span className="text-muted-foreground">Period: {companyDoc?.capitalStartDate || "Pending"} → {companyDoc?.capitalEndDate || "Pending"}</span></div><div className="relative h-6 w-full bg-secondary/50 rounded-2xl overflow-hidden"><div className="h-full bg-primary" style={{ width: `${Math.min(utilization, 100)}%` }} /></div></div><div className="grid grid-cols-2 md:grid-cols-3 gap-6 mt-12"><div className="bg-secondary/20 p-8 rounded-[32px] group"><ArrowUpRight className="w-8 h-8 text-primary mb-4" /><p className="text-[10px] font-black uppercase text-muted-foreground">Remaining Budget</p><p className="text-3xl font-black text-foreground">{currencySymbol}{remaining.toFixed(2)}</p></div><div className="bg-secondary/20 p-8 rounded-[32px] group"><Landmark className="w-8 h-8 text-accent mb-4" /><p className="text-[10px] font-black uppercase text-muted-foreground">Verified Pool</p><p className="text-3xl font-black text-foreground">{currencySymbol}{currentPool.toFixed(2)}</p></div><div className={cn("p-8 rounded-[32px] border-2", isLocked ? "bg-primary/5 border-primary/20" : "bg-orange-50 border-orange-200")}><ShieldCheck className="w-14 h-14 opacity-50" /><div><p className="text-[10px] font-black uppercase mb-1">Status</p><p className="text-lg font-black uppercase">{isLocked ? "Locked" : "Open"}</p></div></div></div></CardContent>
              </Card>
              <Card className="border-none shadow-sm bg-white rounded-[32px] overflow-hidden"><CardHeader className="bg-secondary/10 p-8"><CardTitle className="flex items-center gap-3 text-xl font-black"><History className="w-6 h-6 text-primary" /> Procurement Log</CardTitle></CardHeader><CardContent className="p-0"><div className="divide-y">{activePurchases?.map(p => (<div key={p.id} className="flex items-center justify-between p-6"><div><p className="font-black text-lg">{p.description}</p><p className="text-[10px] text-muted-foreground uppercase">{new Date(p.timestamp).toLocaleString()}</p></div><p className="text-2xl font-black text-destructive">-{currencySymbol}{p.amount.toFixed(2)}</p></div>))}</div></CardContent></Card>
            </div>

            <div className="lg:col-span-1 space-y-8">
              <Card className={cn("border-none shadow-2xl rounded-[40px] overflow-hidden", isLocked ? "bg-secondary/20 grayscale" : "bg-white")}>
                <CardHeader className="bg-primary/10 p-10"><CardTitle className="flex items-center gap-3 text-xl font-black"><Settings className="w-6 h-6 text-primary" /> Setup Base Limit</CardTitle></CardHeader>
                <CardContent className="p-10"><form onSubmit={handleUpdateSettings} className="space-y-8"><div className="space-y-2"><div className="flex justify-between items-center"><label className="text-[10px] font-black uppercase text-muted-foreground">Base Budget Limit ({currencySymbol})</label></div><Input type="number" value={formLimit} onChange={(e) => setFormLimit(Number(e.target.value))} disabled={isLocked} className="h-16 rounded-2xl bg-secondary/10 border-none text-2xl font-black" required /></div><div className="space-y-2"><label className="text-[10px] font-black uppercase text-muted-foreground">Period</label><Select value={formPeriod} onValueChange={(v) => setFormPeriod(v as CapitalPeriod)} disabled={isLocked}><SelectTrigger className="h-14 rounded-2xl bg-secondary/10 border-none font-black text-sm uppercase px-6"><SelectValue /></SelectTrigger><SelectContent className="rounded-xl font-black uppercase"><SelectItem value="daily">Daily Reset</SelectItem><SelectItem value="weekly">Weekly Reset</SelectItem><SelectItem value="monthly">Monthly Reset</SelectItem><SelectItem value="yearly">Yearly Reset</SelectItem></SelectContent></Select></div><div className="space-y-2"><label className="text-[10px] font-black uppercase text-muted-foreground">Start Date</label><Input type="date" value={formStartDate} onChange={(e) => setFormStartDate(e.target.value)} disabled={isLocked} className="h-14 rounded-2xl bg-secondary/10 border-none font-black" required /></div><Button type="submit" className="w-full h-20 rounded-[32px] font-black text-xl shadow-xl" disabled={isUpdating || isLocked || formLimit <= 0}>{isLocked ? "Config Locked" : "Allocate & Lock"}</Button></form></CardContent>
              </Card>
            </div>
          </div>
        </div>
      </main>

      <Dialog open={isTopUpPoolOpen} onOpenChange={setIsTopUpPoolOpen}><DialogContent className="rounded-[32px] max-w-md p-0 overflow-hidden bg-white"><div className="bg-primary p-10 text-primary-foreground"><DialogTitle className="text-2xl font-black">External Pool Inflow</DialogTitle></div><div className="p-8 space-y-6"><Label className="text-[10px] font-black uppercase">Amount ({currencySymbol})</Label><Input type="number" className="h-14 rounded-2xl font-black text-xl" value={poolTopUpAmount} onChange={(e) => setPoolTopUpAmount(e.target.value)}/><Button onClick={handleTopUpPool} disabled={isToppingUpPool} className="w-full h-16 rounded-[24px] font-black text-lg">Deposit to Pool</Button></div></DialogContent></Dialog>
      <Dialog open={isInjectDialogOpen} onOpenChange={setIsInjectDialogOpen}><DialogContent className="rounded-[32px] max-w-md p-0 overflow-hidden bg-white"><div className="bg-primary p-10 text-primary-foreground"><DialogTitle className="text-2xl font-black">Strategic Injection</DialogTitle></div><div className="p-8 space-y-6"><div className="p-6 bg-secondary/10 rounded-2xl"><p className="text-[10px] font-black uppercase">Pool Balance</p><p className="text-3xl font-black text-primary">{currencySymbol}{currentPool.toFixed(2)}</p></div><Label className="text-[10px] font-black uppercase">Injection Amount ({currencySymbol})</Label><Input type="number" className="h-14 rounded-2xl font-black text-xl" value={injectAmount} onChange={(e) => setInjectAmount(e.target.value)}/><Button onClick={handleInjectFunds} disabled={isInjecting} className="w-full h-16 rounded-[24px] font-black text-lg">Confirm Injection</Button></div></DialogContent></Dialog>
      <Dialog open={isResetDialogOpen} onOpenChange={setIsResetDialogOpen}><DialogContent className="rounded-[32px] max-w-md p-0 overflow-hidden bg-white"><div className="bg-destructive p-10 text-destructive-foreground"><DialogTitle className="text-2xl font-black">Emergency Unlock</DialogTitle></div><div className="p-8 space-y-6"><Label className="text-[10px] font-black uppercase">Reset Key</Label><Input value={resetKey} onChange={(e) => setResetKey(e.target.value.toUpperCase())} className="h-14 rounded-2xl font-black text-lg" /><Button onClick={handleResetCycle} disabled={isResetting || resetKey.length < 8} className="w-full h-14 rounded-2xl font-black text-lg bg-destructive">Unlock</Button></div></DialogContent></Dialog>
    </div>
  );
}
