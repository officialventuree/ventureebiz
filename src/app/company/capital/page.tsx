
'use client';

import { Sidebar } from '@/components/layout/sidebar';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Wallet, TrendingUp, AlertCircle, History, Settings, ArrowUpRight, ShieldCheck, Zap, Lock, Calendar, RefreshCw, Key, Plus, Sparkles, Landmark, ArrowDownLeft, Info } from 'lucide-react';
import { useAuth } from '@/components/auth-context';
import { useFirestore, useCollection, useMemoFirebase, useDoc } from '@/firebase';
import { collection, doc, updateDoc, increment } from 'firebase/firestore';
import { useState, useMemo, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { CapitalPurchase, Company, CapitalPeriod } from '@/lib/types';
import { cn } from '@/lib/utils';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
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
      toast({ title: "Invalid Limit", description: "Base budget limit must be more than 0.", variant: "destructive" });
      return;
    }

    if (formLimit > currentPool) {
      toast({ 
        title: "Insufficient Pool Funds", 
        description: `Your initial limit exceeds the verified pool balance ($${currentPool.toFixed(2)}).`,
        variant: "destructive" 
      });
      return;
    }

    setIsUpdating(true);
    const updateData: any = {
      capitalLimit: formLimit,
      injectedCapital: 0, // Reset injections for new cycle
      capitalPeriod: formPeriod,
      capitalStartDate: formStartDate,
      capitalEndDate: calculatedEndDate,
      nextCapitalAmount: increment(-formLimit)
    };

    const docRef = doc(firestore, 'companies', user.companyId);
    
    updateDoc(docRef, updateData)
      .then(() => {
        toast({ title: "Configuration Locked", description: `Budget cycle active until ${calculatedEndDate}.` });
      })
      .catch(async (err) => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({
          path: docRef.path,
          operation: 'update',
          requestResourceData: updateData
        }));
      })
      .finally(() => {
        setIsUpdating(false);
      });
  };

  const handleTopUpPool = async () => {
    if (!firestore || !user?.companyId) return;
    setIsToppingUpPool(true);

    const amount = Number(poolTopUpAmount) || 0;
    if (amount <= 0) {
      toast({ title: "Invalid Amount", variant: "destructive" });
      setIsToppingUpPool(false);
      return;
    }

    const docRef = doc(firestore, 'companies', user.companyId);
    const updateData = {
      nextCapitalAmount: increment(amount)
    };

    updateDoc(docRef, updateData)
      .then(() => {
        toast({ title: "Pool Expanded", description: `$${amount.toFixed(2)} added to reinvestment pool.` });
        setIsTopUpPoolOpen(false);
        setPoolTopUpAmount('');
      })
      .catch(async (err) => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({
          path: docRef.path,
          operation: 'update',
          requestResourceData: updateData
        }));
      })
      .finally(() => {
        setIsToppingUpPool(false);
      });
  };

  const handleInjectFunds = async () => {
    if (!firestore || !user?.companyId || !companyDoc) return;
    setIsInjecting(true);

    const amount = Number(injectAmount) || 0;

    if (amount <= 0) {
      toast({ title: "Enter a valid amount", variant: "destructive" });
      setIsInjecting(false);
      return;
    }

    if (amount > currentPool) {
      toast({ title: "Insufficient Pool Balance", variant: "destructive" });
      setIsInjecting(false);
      return;
    }

    const docRef = doc(firestore, 'companies', user.companyId);
    const updateData = {
      injectedCapital: increment(amount), // Increment separate bucket
      nextCapitalAmount: increment(-amount)
    };

    updateDoc(docRef, updateData)
      .then(() => {
        toast({ title: "Capital Injected", description: `Spending capacity expanded by $${amount.toFixed(2)}.` });
        setIsInjectDialogOpen(false);
        setInjectAmount('');
      })
      .catch(async (err) => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({
          path: docRef.path,
          operation: 'update',
          requestResourceData: updateData
        }));
      })
      .finally(() => {
        setIsInjecting(false);
      });
  };

  const handleResetCycle = async () => {
    if (!firestore || !user?.companyId || !companyDoc) return;
    
    if (resetKey !== companyDoc.cancellationPassword) {
      toast({ title: "Invalid Authorization", variant: "destructive" });
      return;
    }

    setIsResetting(true);
    const docRef = doc(firestore, 'companies', user.companyId);
    const resetData = {
      capitalLimit: 0,
      injectedCapital: 0,
      capitalPeriod: null,
      capitalStartDate: null,
      capitalEndDate: null
    };

    updateDoc(docRef, resetData)
      .then(() => {
        toast({ title: "Cycle Unlocked", description: "Capital configuration reset." });
        setIsResetDialogOpen(false);
        setResetKey('');
      })
      .catch(async (err) => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({
          path: docRef.path,
          operation: 'update',
          requestResourceData: resetData
        }));
      })
      .finally(() => {
        setIsResetting(false);
      });
  };

  return (
    <div className="flex h-screen bg-background text-foreground font-body">
      <Sidebar />
      <main className="flex-1 overflow-auto p-8">
        <div className="max-w-6xl mx-auto">
          <div className="mb-8 flex justify-between items-end">
            <div>
              <h1 className="text-3xl font-black font-headline tracking-tight">Capital Control</h1>
              <p className="text-muted-foreground font-medium">Precision Spending Limits & Procurement Guardrails</p>
            </div>
            <div className="flex gap-4">
              <Button onClick={() => setIsTopUpPoolOpen(true)} variant="outline" className="rounded-2xl h-12 px-6 font-black gap-2 border-primary/20 bg-white hover:bg-primary/5 text-primary shadow-sm">
                <Plus className="w-4 h-4" /> Top-up Pool
              </Button>

              {isLocked && (
                <Button onClick={() => setIsInjectDialogOpen(true)} className="rounded-2xl h-12 px-6 font-black gap-2 shadow-xl bg-primary" disabled={currentPool <= 0}>
                  <Zap className="w-4 h-4" /> Inject from Pool
                </Button>
              )}

              {isLocked && (
                <Button onClick={() => setIsResetDialogOpen(true)} variant="outline" className="rounded-2xl h-12 px-6 font-black gap-2 border-primary/20 bg-white hover:bg-primary/5 text-primary shadow-sm">
                  <RefreshCw className="w-4 h-4" /> Reset Configuration
                </Button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-8">
              <Card className="border-none shadow-2xl bg-white rounded-[40px] overflow-hidden relative">
                <div className="absolute top-0 right-0 p-10 opacity-5">
                  <Wallet className="w-40 h-40" />
                </div>
                <CardHeader className="p-10 pb-0">
                  <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest mb-2">Live Capital Utilization</p>
                  <CardTitle className="text-6xl font-black tracking-tighter">${totalSpent.toFixed(2)}</CardTitle>
                  <CardDescription className="font-bold text-lg mt-2">
                    Total Capacity: ${totalCapacity.toLocaleString()} (Base: ${baseLimit} + Injected: ${injectedFunds})
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-10">
                  <div className="space-y-6">
                    <div className="flex justify-between text-xs font-black uppercase tracking-widest">
                      <span className={cn(utilization > 80 ? "text-destructive" : "text-primary")}>
                        {utilization.toFixed(1)}% Consumed
                      </span>
                      <span className="text-muted-foreground">Period: {companyDoc?.capitalStartDate || "Pending"} → {companyDoc?.capitalEndDate || "Pending"}</span>
                    </div>
                    <div className="relative h-6 w-full bg-secondary/50 rounded-2xl overflow-hidden">
                       <div 
                        className={cn(
                          "h-full transition-all duration-500 rounded-2xl",
                          utilization > 90 ? "bg-destructive" : utilization > 70 ? "bg-accent" : "bg-primary"
                        )}
                        style={{ width: `${Math.min(utilization, 100)}%` }}
                       />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-3 gap-6 mt-12">
                     <div className="bg-secondary/20 p-8 rounded-[32px] border-2 border-transparent hover:border-primary/20 transition-all group">
                        <ArrowUpRight className="w-8 h-8 text-primary mb-4 group-hover:scale-125 transition-transform" />
                        <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Remaining Limit</p>
                        <p className="text-3xl font-black text-foreground tracking-tighter">${remaining.toFixed(2)}</p>
                     </div>
                     <div className="bg-secondary/20 p-8 rounded-[32px] border-2 border-transparent hover:border-primary/20 transition-all group">
                        <Landmark className="w-8 h-8 text-accent mb-4 group-hover:scale-125 transition-transform" />
                        <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Verified Pool</p>
                        <p className="text-3xl font-black text-foreground tracking-tighter">${currentPool.toFixed(2)}</p>
                     </div>
                     <div className={cn(
                       "p-8 rounded-[32px] border-2 md:col-span-1 col-span-2 flex items-center gap-6",
                       isLocked ? "bg-primary/5 border-primary/20" : "bg-orange-50 border-orange-200"
                     )}>
                        {isLocked ? <ShieldCheck className="w-14 h-14 text-primary opacity-50" /> : <AlertCircle className="w-14 h-14 text-orange-500 opacity-50" />}
                        <div>
                          <p className={cn("text-[10px] font-black uppercase tracking-widest mb-1", isLocked ? "text-primary" : "text-orange-600")}>Status</p>
                          <p className="text-lg font-black text-foreground uppercase tracking-tight">{isLocked ? "Active Guard" : "Setup Required"}</p>
                        </div>
                     </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-none shadow-sm bg-white rounded-[32px] overflow-hidden">
                 <CardHeader className="bg-secondary/10 p-8">
                    <CardTitle className="flex items-center gap-3 text-xl font-black">
                      <History className="w-6 h-6 text-primary" />
                      Procurement Log (Active Cycle)
                    </CardTitle>
                 </CardHeader>
                 <CardContent className="p-0">
                    <div className="divide-y">
                       {activePurchases?.sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).map(p => (
                         <div key={p.id} className="flex items-center justify-between p-6 hover:bg-secondary/10 transition-colors">
                            <div>
                               <p className="font-black text-foreground text-lg">{p.description}</p>
                               <p className="text-[10px] text-muted-foreground font-black uppercase tracking-widest mt-1">
                                 {new Date(p.timestamp).toLocaleDateString()} at {new Date(p.timestamp).toLocaleTimeString()}
                               </p>
                            </div>
                            <p className="text-2xl font-black text-destructive tracking-tighter">-${p.amount.toFixed(2)}</p>
                         </div>
                       ))}
                       {(activePurchases.length === 0) && (
                         <div className="py-24 text-center text-muted-foreground">
                            <History className="w-16 h-16 mx-auto mb-4 opacity-10" />
                            <p className="font-black uppercase tracking-widest text-sm">No transaction history found for this cycle</p>
                         </div>
                       )}
                    </div>
                 </CardContent>
              </Card>
            </div>

            <div className="lg:col-span-1 space-y-8">
              <Card className={cn(
                "border-none shadow-2xl rounded-[40px] transition-all overflow-hidden",
                isLocked ? "bg-secondary/20 grayscale" : "bg-white"
              )}>
                <CardHeader className="bg-primary/10 p-10">
                  <CardTitle className="flex items-center gap-3 text-xl font-black">
                    <Settings className="w-6 h-6 text-primary" />
                    Setup Base Limit
                  </CardTitle>
                  <CardDescription className="font-bold text-muted-foreground">Allocate initial capital from verified pool.</CardDescription>
                </CardHeader>
                <CardContent className="p-10">
                  <form onSubmit={handleUpdateSettings} className="space-y-8">
                    <div className="space-y-2">
                      <div className="flex justify-between items-center px-1">
                        <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Base Budget Limit ($)</label>
                        {!isLocked && currentPool > 0 && (
                          <button 
                            type="button"
                            onClick={() => setFormLimit(currentPool)}
                            className="flex items-center gap-1 text-[9px] font-black text-primary uppercase hover:bg-primary/10 px-2 py-1 rounded-md transition-colors animate-pulse"
                          >
                            <Sparkles className="w-2.5 h-2.5" /> Max Pool: ${currentPool.toFixed(2)}
                          </button>
                        )}
                      </div>
                      <Input 
                        type="number" 
                        value={formLimit} 
                        onChange={(e) => setFormLimit(Number(e.target.value))}
                        disabled={isLocked}
                        min="0.01"
                        step="0.01"
                        className={cn(
                          "h-16 rounded-2xl bg-secondary/10 border-none text-2xl font-black px-6",
                          !isLocked && formLimit > currentPool && "text-destructive ring-2 ring-destructive"
                        )} 
                        required 
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest px-1">Spending Period</label>
                      <Select 
                        value={formPeriod} 
                        onValueChange={(v) => setFormPeriod(v as CapitalPeriod)}
                        disabled={isLocked}
                      >
                        <SelectTrigger className="h-14 rounded-2xl bg-secondary/10 border-none font-black text-sm uppercase px-6">
                          <SelectValue placeholder="Select period" />
                        </SelectTrigger>
                        <SelectContent className="rounded-2xl font-black uppercase">
                          <SelectItem value="daily">Daily Reset</SelectItem>
                          <SelectItem value="weekly">Weekly Reset</SelectItem>
                          <SelectItem value="monthly">Monthly Reset</SelectItem>
                          <SelectItem value="yearly">Yearly Reset</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest px-1">Cycle Start Date</label>
                      <div className="relative">
                        <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                        <Input 
                          type="date" 
                          value={formStartDate} 
                          onChange={(e) => setFormStartDate(e.target.value)}
                          disabled={isLocked}
                          className="h-14 rounded-2xl bg-secondary/10 border-none font-black px-12" 
                          required 
                        />
                      </div>
                    </div>

                    <div className="p-6 bg-primary/5 rounded-[28px] border-2 border-primary/10 space-y-2 animate-in zoom-in-95">
                       <div className="flex justify-between items-center text-[10px] font-black uppercase text-muted-foreground tracking-widest">
                          <span>Calculated End Date</span>
                          <span className="text-foreground">System Generated</span>
                       </div>
                       <p className="text-xl font-black text-primary tracking-tight">
                         {calculatedEndDate ? new Date(calculatedEndDate).toLocaleDateString([], { dateStyle: 'full' }) : "Select Start Date"}
                       </p>
                    </div>

                    <Button 
                      type="submit" 
                      className="w-full h-20 rounded-[32px] font-black text-xl shadow-xl transition-all" 
                      disabled={isUpdating || isLocked || (!isLocked && formLimit > currentPool) || formLimit <= 0}
                    >
                      {isLocked ? (
                        <span className="flex items-center gap-3">
                          <Lock className="w-5 h-5" /> Config Locked
                        </span>
                      ) : isUpdating ? "Authorizing Setup..." : "Allocate & Lock Budget"}
                    </Button>
                  </form>
                </CardContent>
              </Card>

              <Card className="border-none shadow-sm bg-secondary/10 rounded-[32px] p-8">
                 <CardHeader className="p-0 mb-4">
                    <CardTitle className="text-[10px] font-black uppercase text-muted-foreground tracking-widest flex items-center gap-2">
                      <Info className="w-3 h-3" /> Reinvestment Discipline
                    </CardTitle>
                 </CardHeader>
                 <CardContent className="p-0">
                    <p className="text-xs font-bold leading-relaxed text-muted-foreground italic">
                      "Injected funds allow mid-cycle scaling without disrupting original strategic dates. Total capacity is the sum of base and extra funding."
                    </p>
                 </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </main>

      {/* Dialogs */}
      <Dialog open={isTopUpPoolOpen} onOpenChange={setIsTopUpPoolOpen}>
        <DialogContent className="rounded-[32px] max-w-md p-0 overflow-hidden bg-white border-none shadow-2xl">
          <div className="bg-primary p-10 text-primary-foreground">
             <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center mb-4">
                <Landmark className="w-6 h-6" />
             </div>
             <DialogTitle className="text-2xl font-black">External Pool Inflow</DialogTitle>
             <DialogDescription className="text-primary-foreground/80 font-bold mt-2">
                Add external business injections into your Reinvestment Pool.
             </DialogDescription>
          </div>
          <div className="p-8 space-y-6">
             <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground px-1">Amount ($)</Label>
                <Input 
                  type="number" 
                  placeholder="0.00" 
                  className="h-14 rounded-2xl bg-secondary/10 border-none font-black text-xl"
                  value={poolTopUpAmount}
                  onChange={(e) => setPoolTopUpAmount(e.target.value)}
                />
             </div>
             <Button 
              onClick={handleTopUpPool} 
              disabled={isToppingUpPool || !poolTopUpAmount}
              className="w-full h-16 rounded-[24px] font-black text-lg shadow-xl"
             >
                {isToppingUpPool ? "Authorizing..." : `Deposit to Pool`}
             </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isInjectDialogOpen} onOpenChange={setIsInjectDialogOpen}>
        <DialogContent className="rounded-[32px] max-w-md p-0 overflow-hidden bg-white border-none shadow-2xl">
          <div className="bg-primary p-10 text-primary-foreground">
             <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center mb-4">
                <ArrowDownLeft className="w-6 h-6" />
             </div>
             <DialogTitle className="text-2xl font-black">Strategic Injection</DialogTitle>
             <DialogDescription className="text-primary-foreground/80 font-bold mt-2">
                Withdraw funds from pool into active spending capacity.
             </DialogDescription>
          </div>
          <div className="p-8 space-y-6">
             <div className="p-6 bg-secondary/10 rounded-2xl space-y-2 border-2 border-dashed border-primary/20">
                <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest leading-none">Available Pool Balance</p>
                <p className="text-3xl font-black text-primary">${currentPool.toFixed(2)}</p>
             </div>

             <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground px-1">Injection Amount ($)</Label>
                <Input 
                  type="number" 
                  placeholder="0.00" 
                  max={currentPool}
                  className="h-14 rounded-2xl bg-secondary/10 border-none font-black text-xl"
                  value={injectAmount}
                  onChange={(e) => setInjectAmount(e.target.value)}
                />
             </div>

             <Button 
              onClick={handleInjectFunds} 
              disabled={isInjecting || Number(injectAmount) > currentPool || !injectAmount}
              className="w-full h-16 rounded-[24px] font-black text-lg shadow-xl"
             >
                {isInjecting ? "Processing..." : `Confirm Injection`}
             </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isResetDialogOpen} onOpenChange={setIsResetDialogOpen}>
        <DialogContent className="rounded-[32px] border-none shadow-2xl max-w-md p-0 overflow-hidden bg-white">
          <div className="bg-destructive p-10 text-destructive-foreground">
            <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center mb-4">
              <Lock className="w-6 h-6" />
            </div>
            <DialogTitle className="text-2xl font-black tracking-tight leading-tight">Emergency Unlock</DialogTitle>
            <DialogDescription className="text-destructive-foreground/80 font-bold mt-2">
              An 8-character Reset Key is required to override this locked budget cycle.
            </DialogDescription>
          </div>
          <div className="p-8 space-y-6">
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground px-1">Authorization Reset Key</Label>
              <Input 
                placeholder="ENTER 8-CHAR KEY" 
                value={resetKey}
                onChange={(e) => setResetKey(e.target.value.toUpperCase())}
                className="h-14 rounded-2xl bg-secondary/10 border-none font-mono font-bold tracking-widest text-lg" 
              />
            </div>
            <Button 
              onClick={handleResetCycle} 
              disabled={isResetting || resetKey.length < 8}
              className="w-full h-14 rounded-2xl font-black text-lg shadow-xl bg-destructive hover:bg-destructive/90"
            >
              {isResetting ? "Authorizing..." : "Confirm & Unlock"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
