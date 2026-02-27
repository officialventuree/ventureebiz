
'use client';

import { Sidebar } from '@/components/layout/sidebar';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Wallet, TrendingUp, AlertCircle, History, Settings, ArrowUpRight, ShieldCheck, Zap } from 'lucide-react';
import { useAuth } from '@/components/auth-context';
import { useFirestore, useCollection, useMemoFirebase, useDoc } from '@/firebase';
import { collection, doc, updateDoc, setDoc } from 'firebase/firestore';
import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { CapitalPurchase, Company } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Progress } from '@/components/ui/progress';

export default function CapitalControlPage() {
  const { user } = useAuth();
  const firestore = useFirestore();
  const { toast } = useToast();
  const [isUpdating, setIsUpdating] = useState(false);

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

  const totalSpent = purchases?.reduce((acc, p) => acc + p.amount, 0) || 0;
  const limit = companyDoc?.capitalLimit || 0;
  const period = companyDoc?.capitalPeriod || 'monthly';
  const remaining = Math.max(0, limit - totalSpent);
  const utilization = limit > 0 ? (totalSpent / limit) * 100 : 0;

  const handleUpdateSettings = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!firestore || !user?.companyId) return;
    setIsUpdating(true);
    
    const formData = new FormData(e.currentTarget);
    const newLimit = Number(formData.get('limit'));
    const newPeriod = formData.get('period') as any;

    try {
      await updateDoc(doc(firestore, 'companies', user.companyId), {
        capitalLimit: newLimit,
        capitalPeriod: newPeriod
      });
      toast({ title: "Settings Saved", description: "Capital limits updated across all modules." });
    } catch (e) {
      toast({ title: "Update Failed", variant: "destructive" });
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="flex h-screen bg-background text-foreground font-body">
      <Sidebar />
      <main className="flex-1 overflow-auto p-8">
        <div className="max-w-6xl mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl font-black font-headline">Capital Control</h1>
            <p className="text-muted-foreground">Strategic Spending Limits & Procurement Guardrails</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Visual spending indicator */}
            <div className="lg:col-span-2 space-y-8">
              <Card className="border-none shadow-2xl bg-white rounded-3xl overflow-hidden relative">
                <div className="absolute top-0 right-0 p-8 opacity-5">
                  <Wallet className="w-32 h-32" />
                </div>
                <CardHeader className="p-8 pb-0">
                  <p className="text-xs font-black uppercase text-muted-foreground tracking-widest mb-1">Live Capital Utilization</p>
                  <CardTitle className="text-4xl font-black">${totalSpent.toFixed(2)}</CardTitle>
                  <CardDescription className="font-bold">Spent this {period} from total ${limit.toFixed(2)} budget</CardDescription>
                </CardHeader>
                <CardContent className="p-8">
                  <div className="space-y-4">
                    <div className="flex justify-between text-sm font-black uppercase">
                      <span className={cn(utilization > 80 ? "text-destructive" : "text-primary")}>
                        {utilization.toFixed(1)}% Consumed
                      </span>
                      <span className="text-muted-foreground">Budget: ${limit.toLocaleString()}</span>
                    </div>
                    <Progress 
                      value={utilization} 
                      className={cn(
                        "h-4 bg-secondary/50",
                        utilization > 90 ? "[&>div]:bg-destructive" : utilization > 70 ? "[&>div]:bg-accent" : "[&>div]:bg-primary"
                      )} 
                    />
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-3 gap-6 mt-12">
                     <div className="bg-secondary/20 p-6 rounded-3xl border-2 border-transparent hover:border-primary/20 transition-all group">
                        <ArrowUpRight className="w-6 h-6 text-primary mb-3 group-hover:scale-125 transition-transform" />
                        <p className="text-[10px] font-black uppercase text-muted-foreground">Remaining</p>
                        <p className="text-2xl font-black text-foreground">${remaining.toFixed(2)}</p>
                     </div>
                     <div className="bg-secondary/20 p-6 rounded-3xl border-2 border-transparent hover:border-primary/20 transition-all group">
                        <Zap className="w-6 h-6 text-accent mb-3 group-hover:scale-125 transition-transform" />
                        <p className="text-[10px] font-black uppercase text-muted-foreground">Burn Rate</p>
                        <p className="text-2xl font-black text-foreground">${(totalSpent / 7).toFixed(2)}/day</p>
                     </div>
                     <div className="bg-primary/5 p-6 rounded-3xl border-2 border-primary/20 md:col-span-1 col-span-2 flex items-center gap-4">
                        <ShieldCheck className="w-10 h-10 text-primary opacity-50" />
                        <div>
                          <p className="text-[10px] font-black uppercase text-primary">System Status</p>
                          <p className="text-sm font-black text-foreground">Active Guard</p>
                        </div>
                     </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-none shadow-sm bg-white rounded-2xl">
                 <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg font-black">
                      <History className="w-5 h-5 text-primary" />
                      Procurement Log
                    </CardTitle>
                 </CardHeader>
                 <CardContent>
                    <div className="space-y-4">
                       {purchases?.map(p => (
                         <div key={p.id} className="flex items-center justify-between p-4 rounded-xl bg-secondary/10 group hover:bg-secondary/20 transition-colors">
                            <div>
                               <p className="font-black text-foreground">{p.description}</p>
                               <p className="text-[10px] text-muted-foreground font-bold">{new Date(p.timestamp).toLocaleDateString()} at {new Date(p.timestamp).toLocaleTimeString()}</p>
                            </div>
                            <p className="text-lg font-black text-destructive">-${p.amount.toFixed(2)}</p>
                         </div>
                       ))}
                       {(!purchases || purchases.length === 0) && (
                         <div className="py-12 text-center text-muted-foreground">
                            <History className="w-12 h-12 mx-auto mb-2 opacity-20" />
                            <p className="font-bold">No purchase history in this period.</p>
                         </div>
                       )}
                    </div>
                 </CardContent>
              </Card>
            </div>

            {/* Proximity alerts and Settings */}
            <div className="lg:col-span-1 space-y-6">
              <Card className="border-none shadow-xl bg-white rounded-3xl">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg font-black">
                    <Settings className="w-5 h-5 text-primary" />
                    Limit Config
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleUpdateSettings} className="space-y-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest px-1">Spending Period</label>
                      <Select name="period" defaultValue={period}>
                        <SelectTrigger className="h-12 rounded-xl bg-secondary/30 border-none font-bold">
                          <SelectValue placeholder="Select period" />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl">
                          <SelectItem value="daily">Daily Reset</SelectItem>
                          <SelectItem value="weekly">Weekly Reset</SelectItem>
                          <SelectItem value="monthly">Monthly Reset</SelectItem>
                          <SelectItem value="yearly">Yearly Reset</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest px-1">Maximum Budget ($)</label>
                      <Input name="limit" type="number" defaultValue={limit} className="h-12 rounded-xl bg-secondary/30 border-none text-lg font-black" required />
                    </div>

                    <Button type="submit" className="w-full h-12 rounded-xl font-black shadow-lg" disabled={isUpdating}>
                      {isUpdating ? "Applying Changes..." : "Sync Budget Limits"}
                    </Button>
                  </form>
                </CardContent>
              </Card>

              {utilization > 75 && (
                <Card className="bg-destructive border-none text-destructive-foreground shadow-2xl rounded-3xl animate-pulse">
                   <CardHeader className="pb-2">
                      <CardTitle className="flex items-center gap-2 text-sm font-black uppercase">
                        <AlertCircle className="w-5 h-5" />
                        Proximity Warning
                      </CardTitle>
                   </CardHeader>
                   <CardContent className="space-y-4">
                      <p className="text-sm font-bold opacity-90">You have consumed {utilization.toFixed(0)}% of your capital limit. Future purchases may be blocked if limit is exceeded.</p>
                      <div className="h-2 w-full bg-black/20 rounded-full overflow-hidden">
                         <div className="h-full bg-white" style={{ width: `${utilization}%` }} />
                      </div>
                   </CardContent>
                </Card>
              )}

              <Card className="border-none shadow-sm bg-secondary/10 rounded-2xl">
                 <CardHeader className="pb-2">
                    <CardTitle className="text-[10px] font-black uppercase text-muted-foreground">Strategic Insight</CardTitle>
                 </CardHeader>
                 <CardContent>
                    <p className="text-xs font-bold leading-relaxed">System automatically flags purchases that exceed the remaining balance. Procurement approvals are required for capital override.</p>
                 </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
