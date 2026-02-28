
'use client';

import { Sidebar } from '@/components/layout/sidebar';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Wallet, TrendingUp, AlertCircle, History, Settings, ArrowUpRight, ShieldCheck, Zap, Lock, Calendar, RefreshCw, Key } from 'lucide-react';
import { useAuth } from '@/components/auth-context';
import { useFirestore, useCollection, useMemoFirebase, useDoc } from '@/firebase';
import { collection, doc, updateDoc } from 'firebase/firestore';
import { useState, useMemo, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { CapitalPurchase, Company, CapitalPeriod } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Progress } from '@/components/ui/progress';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';

export default function CapitalControlPage() {
  const { user } = useAuth();
  const firestore = useFirestore();
  const { toast } = useToast();
  const [isUpdating, setIsUpdating] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [isResetDialogOpen, setIsResetDialogOpen] = useState(false);
  const [resetKey, setResetKey] = useState('');

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

  // Sync internal form states with DB when it loads
  useEffect(() => {
    if (companyDoc) {
      if (companyDoc.capitalLimit) setFormLimit(companyDoc.capitalLimit);
      if (companyDoc.capitalStartDate) setFormStartDate(companyDoc.capitalStartDate);
      if (companyDoc.capitalPeriod) setFormPeriod(companyDoc.capitalPeriod);
    }
  }, [companyDoc]);

  // Live Capital Calculation within active period
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
  const limit = companyDoc?.capitalLimit || 0;
  const remaining = Math.max(0, limit - totalSpent);
  const utilization = limit > 0 ? (totalSpent / limit) * 100 : 0;

  // Real-time End Date Detection logic
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

  // Lock-in feature logic: Lock if end date is in the future
  const isLocked = useMemo(() => {
    if (!companyDoc?.capitalEndDate) return false;
    const now = new Date();
    const end = new Date(companyDoc.capitalEndDate);
    // Add 23:59:59 to end date to ensure it lasts the full day
    end.setHours(23, 59, 59, 999);
    return now < end;
  }, [companyDoc]);

  const handleUpdateSettings = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!firestore || !user?.companyId || isLocked) return;
    setIsUpdating(true);
    
    const updateData = {
      capitalLimit: formLimit,
      capitalPeriod: formPeriod,
      capitalStartDate: formStartDate,
      capitalEndDate: calculatedEndDate
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

  const handleResetCycle = async () => {
    if (!firestore || !user?.companyId || !companyDoc) return;
    
    if (resetKey !== companyDoc.cancellationPassword) {
      toast({ title: "Invalid Authorization", description: "The Reset Key provided is incorrect.", variant: "destructive" });
      return;
    }

    setIsResetting(true);
    const docRef = doc(firestore, 'companies', user.companyId);
    const resetData = {
      capitalLimit: 0,
      capitalPeriod: null,
      capitalStartDate: null,
      capitalEndDate: null
    };

    updateDoc(docRef, resetData)
      .then(() => {
        toast({ title: "Cycle Unlocked", description: "Capital configuration has been successfully reset." });
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
              <p className="text-muted-foreground font-medium">Strategic Spending Limits & Procurement Guardrails</p>
            </div>
            {isLocked ? (
              <Dialog open={isResetDialogOpen} onOpenChange={setIsResetDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" className="rounded-2xl h-12 px-6 font-black gap-2 border-primary/20 bg-white hover:bg-primary/5 text-primary shadow-sm transition-all">
                    <RefreshCw className="w-4 h-4" /> Reset Configuration
                  </Button>
                </DialogTrigger>
                <DialogContent className="rounded-[32px] border-none shadow-2xl max-w-md p-0 overflow-hidden bg-white">
                  <div className="bg-destructive p-10 text-destructive-foreground">
                    <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center mb-4">
                      <Lock className="w-6 h-6" />
                    </div>
                    <DialogTitle className="text-2xl font-black tracking-tight leading-tight">Emergency Unlock</DialogTitle>
                    <DialogDescription className="text-destructive-foreground/80 font-bold mt-2">
                      An 8-character Reset Key (provided by your Admin) is required to override this locked budget cycle.
                    </DialogDescription>
                  </div>
                  <div className="p-8 space-y-6">
                    <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground px-1">Authorization Reset Key</Label>
                      <div className="relative">
                        <Key className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input 
                          placeholder="ENTER 8-CHAR KEY" 
                          value={resetKey}
                          onChange={(e) => setResetKey(e.target.value.toUpperCase())}
                          className="h-14 rounded-2xl bg-secondary/10 border-none pl-12 font-mono font-bold tracking-widest text-lg" 
                        />
                      </div>
                    </div>
                    <Button 
                      onClick={handleResetCycle} 
                      disabled={isResetting || resetKey.length < 8}
                      className="w-full h-14 rounded-2xl font-black text-lg shadow-xl bg-destructive hover:bg-destructive/90"
                    >
                      {isResetting ? "Authorizing..." : "Confirm & Unlock Configuration"}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            ) : null}
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
                    Cycle: {companyDoc?.capitalStartDate || "Pending"} → {companyDoc?.capitalEndDate || "Pending"}
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-10">
                  <div className="space-y-6">
                    <div className="flex justify-between text-xs font-black uppercase tracking-widest">
                      <span className={cn(utilization > 80 ? "text-destructive" : "text-primary")}>
                        {utilization.toFixed(1)}% Consumed
                      </span>
                      <span className="text-muted-foreground">Limit: ${limit.toLocaleString()}</span>
                    </div>
                    <Progress 
                      value={utilization} 
                      className={cn(
                        "h-6 bg-secondary/50 rounded-2xl",
                        utilization > 90 ? "[&>div]:bg-destructive" : utilization > 70 ? "[&>div]:bg-accent" : "[&>div]:bg-primary"
                      )} 
                    />
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-3 gap-6 mt-12">
                     <div className="bg-secondary/20 p-8 rounded-[32px] border-2 border-transparent hover:border-primary/20 transition-all group">
                        <ArrowUpRight className="w-8 h-8 text-primary mb-4 group-hover:scale-125 transition-transform" />
                        <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Remaining</p>
                        <p className="text-3xl font-black text-foreground tracking-tighter">${remaining.toFixed(2)}</p>
                     </div>
                     <div className="bg-secondary/20 p-8 rounded-[32px] border-2 border-transparent hover:border-primary/20 transition-all group">
                        <Zap className="w-8 h-8 text-accent mb-4 group-hover:scale-125 transition-transform" />
                        <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Burn Rate</p>
                        <p className="text-3xl font-black text-foreground tracking-tighter">${(totalSpent / Math.max(activePurchases.length, 1)).toFixed(2)}/tx</p>
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
                      Procurement Intelligence Log (Active Cycle)
                    </CardTitle>
                 </CardHeader>
                 <CardContent className="p-0">
                    <div className="divide-y">
                       {activePurchases?.sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).map(p => (
                         <div key={p.id} className="flex items-center justify-between p-6 hover:bg-secondary/10 transition-colors">
                            <div>
                               <p className="font-black text-foreground text-lg">{p.description}</p>
                               <p className="text-[10px] text-muted-foreground font-black uppercase tracking-widest mt-1">
                                 {new Date(p.timestamp).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })} at {new Date(p.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
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
                    Setup Limit
                  </CardTitle>
                  <CardDescription className="font-bold text-muted-foreground">Automatic end-date detection & lock-in</CardDescription>
                </CardHeader>
                <CardContent className="p-10">
                  <form onSubmit={handleUpdateSettings} className="space-y-8">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest px-1">Maximum Budget Limit ($)</label>
                      <Input 
                        type="number" 
                        value={formLimit} 
                        onChange={(e) => setFormLimit(Number(e.target.value))}
                        disabled={isLocked}
                        className="h-16 rounded-2xl bg-secondary/10 border-none text-2xl font-black px-6" 
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
                      disabled={isUpdating || isLocked}
                    >
                      {isLocked ? (
                        <span className="flex items-center gap-3">
                          <Lock className="w-5 h-5" /> Config Locked
                        </span>
                      ) : isUpdating ? "Locking Budget..." : "Confirm & Lock Budget"}
                    </Button>
                  </form>
                </CardContent>
              </Card>

              {isLocked && utilization > 75 && (
                <Card className="bg-destructive border-none text-destructive-foreground shadow-2xl rounded-[32px] animate-pulse">
                   <CardHeader className="p-8 pb-4">
                      <CardTitle className="flex items-center gap-3 text-sm font-black uppercase tracking-widest">
                        <AlertCircle className="w-6 h-6" />
                        Proximity Warning
                      </CardTitle>
                   </CardHeader>
                   <CardContent className="p-8 pt-0 space-y-6">
                      <p className="text-sm font-bold leading-relaxed opacity-90">
                        Consumption has reached {utilization.toFixed(0)}%. Procurement protocol will block all transactions exceeding the remaining ${remaining.toFixed(2)} balance.
                      </p>
                      <div className="h-2 w-full bg-black/20 rounded-full overflow-hidden">
                         <div className="h-full bg-white" style={{ width: `${utilization}%` }} />
                      </div>
                   </CardContent>
                </Card>
              )}

              <Card className="border-none shadow-sm bg-secondary/10 rounded-[32px] p-8">
                 <CardHeader className="p-0 mb-4">
                    <CardTitle className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Strategic Discipline</CardTitle>
                 </CardHeader>
                 <CardContent className="p-0">
                    <p className="text-xs font-bold leading-relaxed text-muted-foreground italic">
                      "Financial integrity requires consistent periods. Lock-in prevents emotional budget adjustments, enforcing strategic procurement discipline across all operational modules."
                    </p>
                 </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
