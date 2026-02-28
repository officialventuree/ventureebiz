
'use client';

import { Sidebar } from '@/components/layout/sidebar';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useAuth } from '@/components/auth-context';
import { useFirestore, useCollection, useMemoFirebase, useDoc } from '@/firebase';
import { collection, doc, updateDoc, increment } from 'firebase/firestore';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { TrendingUp, DollarSign, ShoppingBag, Wallet, Waves, AlertTriangle, Package, ShieldCheck, Landmark, Zap } from 'lucide-react';
import { SaleTransaction, CapitalPurchase, Product, Company } from '@/lib/types';
import { cn } from '@/lib/utils';
import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Separator } from '@/components/ui/separator';

export default function CompanyDashboard() {
  const { user } = useAuth();
  const firestore = useFirestore();
  const { toast } = useToast();
  const [isClaiming, setIsClaiming] = useState(false);

  const companyRef = useMemoFirebase(() => {
    if (!firestore || !user?.companyId) return null;
    return doc(firestore, 'companies', user.companyId);
  }, [firestore, user?.companyId]);

  const transactionsQuery = useMemoFirebase(() => {
    if (!firestore || !user?.companyId) return null;
    return collection(firestore, 'companies', user.companyId, 'transactions');
  }, [firestore, user?.companyId]);

  const purchasesQuery = useMemoFirebase(() => {
    if (!firestore || !user?.companyId) return null;
    return collection(firestore, 'companies', user.companyId, 'purchases');
  }, [firestore, user?.companyId]);

  const productsQuery = useMemoFirebase(() => {
    if (!firestore || !user?.companyId) return null;
    return collection(firestore, 'companies', user.companyId, 'products');
  }, [firestore, user?.companyId]);

  const { data: companyDoc } = useDoc<Company>(companyRef);
  const { data: transactions } = useCollection<SaleTransaction>(transactionsQuery);
  const { data: purchases } = useCollection<CapitalPurchase>(purchasesQuery);
  const { data: products } = useCollection<Product>(productsQuery);

  const currencySymbol = companyDoc?.currencySymbol || '$';

  const totalRevenue = transactions?.reduce((acc, s) => acc + s.totalAmount, 0) || 0;
  const totalProfit = transactions?.reduce((acc, s) => acc + s.profit, 0) || 0;
  
  const totalCapitalUsed = useMemo(() => {
    if (!purchases) return 0;
    if (!companyDoc?.capitalStartDate || !companyDoc?.capitalEndDate) return purchases.reduce((acc, p) => acc + p.amount, 0);

    const start = new Date(companyDoc.capitalStartDate);
    const end = new Date(companyDoc.capitalEndDate);
    end.setHours(23, 59, 59, 999);

    return purchases
      .filter(p => {
        const pDate = new Date(p.timestamp);
        return pDate >= start && pDate <= end;
      })
      .reduce((acc, p) => acc + p.amount, 0);
  }, [purchases, companyDoc]);

  const inventoryValue = products?.reduce((acc, p) => acc + (p.stock * p.costPrice), 0) || 0;
  
  const baseLimit = companyDoc?.capitalLimit || 0;
  const injectedFunds = companyDoc?.injectedCapital || 0;
  const totalCapacity = baseLimit + injectedFunds;
  
  const remainingCapital = Math.max(0, totalCapacity - totalCapitalUsed);

  // Module Stats
  const modules = ['mart', 'laundry', 'rent', 'services'];
  const paymentMethods = ['cash', 'card', 'duitnow'];

  const flowStats = useMemo(() => {
    if (!transactions) return [];
    
    return modules.map(mod => {
      const modTrans = transactions.filter(t => t.module === mod);
      const unclaimed = modTrans.filter(t => !t.isCapitalClaimed);
      
      const breakdown = paymentMethods.map(pm => ({
        method: pm,
        profit: modTrans.filter(t => (t.paymentMethod || 'cash') === pm).reduce((acc, t) => acc + t.profit, 0)
      }));

      const totalCapitalToClaim = unclaimed.reduce((acc, t) => acc + (t.totalCost || 0), 0);

      return {
        name: mod.charAt(0).toUpperCase() + mod.slice(1),
        breakdown,
        totalProfit: modTrans.reduce((acc, t) => acc + t.profit, 0),
        capitalToClaim: totalCapitalToClaim,
        unclaimedCount: unclaimed.length
      };
    });
  }, [transactions]);

  const aggregateCapitalToClaim = flowStats.reduce((acc, s) => acc + s.capitalToClaim, 0);

  const handleClaimAllCapital = async () => {
    if (!firestore || !user?.companyId || !transactions) return;
    setIsClaiming(true);

    try {
      const unclaimed = transactions.filter(t => !t.isCapitalClaimed);
      if (unclaimed.length === 0) {
        toast({ title: "No unclaimed capital", description: "All operational costs are already recovered." });
        setIsClaiming(false);
        return;
      }

      const companyRef = doc(firestore, 'companies', user.companyId);
      await updateDoc(companyRef, {
        nextCapitalAmount: increment(aggregateCapitalToClaim)
      });

      for (const t of unclaimed) {
        const tRef = doc(firestore, 'companies', user.companyId, 'transactions', t.id);
        updateDoc(tRef, { isCapitalClaimed: true });
      }

      toast({ 
        title: "Capital Claimed Successfully", 
        description: `${currencySymbol}${aggregateCapitalToClaim.toFixed(2)} has been moved to your injection pool.` 
      });
    } catch (e: any) {
      toast({ title: "Claim failed", description: e.message, variant: "destructive" });
    } finally {
      setIsClaiming(false);
    }
  };

  const moduleData = [
    { name: 'Mart', total: transactions?.filter(t => t.module === 'mart').reduce((acc, t) => acc + t.totalAmount, 0) || 0 },
    { name: 'Laundry', total: transactions?.filter(t => t.module === 'laundry').reduce((acc, t) => acc + t.totalAmount, 0) || 0 },
    { name: 'Rent', total: transactions?.filter(t => t.module === 'rent').reduce((acc, t) => acc + t.totalAmount, 0) || 0 },
    { name: 'Services', total: transactions?.filter(t => t.module === 'services').reduce((acc, t) => acc + t.totalAmount, 0) || 0 },
  ];

  return (
    <div className="flex h-screen bg-background font-body">
      <Sidebar />
      <main className="flex-1 overflow-auto p-10">
        <div className="max-w-7xl mx-auto">
          <div className="mb-12 flex justify-between items-end">
            <div>
              <h1 className="text-5xl font-black font-headline text-foreground tracking-tighter">Strategic Command</h1>
              <p className="text-muted-foreground font-bold text-lg mt-2">Aggregated business intelligence for {user?.name}</p>
            </div>
            <div className="flex items-center gap-3 text-[10px] font-black bg-white px-6 py-3 rounded-full shadow-lg border-2 border-primary/10 text-primary tracking-[0.2em] uppercase">
              <div className="w-2.5 h-2.5 bg-primary rounded-full animate-pulse" />
              Tactical Sync Active
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-16">
            <StatsCard icon={DollarSign} label="Aggregate Revenue" value={`${currencySymbol}${totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}`} trend="Cumulative" />
            <StatsCard icon={TrendingUp} label="Net Realized Profit" value={`${currencySymbol}${totalProfit.toLocaleString(undefined, { minimumFractionDigits: 2 })}`} trend="Calculated Yield" color="text-primary" />
            <StatsCard icon={Package} label="Inventory Valuation" value={`${currencySymbol}${inventoryValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}`} trend="Net Assets" />
            <StatsCard 
              icon={Wallet} 
              label="Liquidity Guardrail" 
              value={`${currencySymbol}${remainingCapital.toLocaleString(undefined, { minimumFractionDigits: 2 })}`} 
              trend={`Max Cap: ${currencySymbol}${(totalCapacity/1000).toFixed(1)}k`} 
              color={remainingCapital < (totalCapacity * 0.1) ? "text-destructive" : "text-foreground"} 
            />
          </div>

          {/* Strategic Capital Recovery Section */}
          <div className="mb-16">
             <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4 px-2">
                <div>
                   <h2 className="text-2xl font-black flex items-center gap-3 uppercase tracking-tighter">
                      <Landmark className="w-8 h-8 text-primary" /> Modal Recovery & Reinvestment
                   </h2>
                   <p className="text-sm font-bold text-muted-foreground mt-1">Claim back cost-of-sale capital into your strategic injection pool</p>
                </div>
                <Button 
                  onClick={handleClaimAllCapital} 
                  disabled={isClaiming || aggregateCapitalToClaim <= 0}
                  className="rounded-2xl font-black h-16 px-10 shadow-2xl gap-3 transition-all hover:scale-[1.02] active:scale-95 text-lg"
                >
                   {isClaiming ? <Zap className="w-5 h-5 animate-spin" /> : <Zap className="w-5 h-5 fill-current" />}
                   Claim Restorable Capital ({currencySymbol}{aggregateCapitalToClaim.toFixed(2)})
                </Button>
             </div>

             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                {flowStats.map(stat => (
                  <Card key={stat.name} className="border-none shadow-sm rounded-[40px] bg-white overflow-hidden group hover:shadow-xl transition-all border-2 border-transparent hover:border-primary/10">
                     <CardHeader className="bg-secondary/20 p-8">
                        <div className="flex justify-between items-start">
                           <CardTitle className="text-2xl font-black tracking-tight">{stat.name}</CardTitle>
                           <Badge variant="outline" className="text-[10px] font-black tracking-widest h-6 px-3">{stat.unclaimedCount} SALES</Badge>
                        </div>
                        <CardDescription className="font-bold text-[10px] uppercase tracking-widest text-muted-foreground mt-2">Operational Segment</CardDescription>
                     </CardHeader>
                     <CardContent className="p-8 space-y-6">
                        <div className="space-y-3">
                           <p className="text-[10px] font-black uppercase text-muted-foreground tracking-[0.15em]">Profit Velocity</p>
                           {stat.breakdown.map(b => (
                             <div key={b.method} className="flex justify-between items-center text-xs">
                                <span className="font-bold text-muted-foreground capitalize">{b.method} Terminal</span>
                                <span className="font-black text-foreground">{currencySymbol}{b.profit.toFixed(2)}</span>
                             </div>
                           ))}
                        </div>
                        <Separator className="opacity-50" />
                        <div className="pt-2">
                           <div className="flex justify-between items-end">
                              <div>
                                 <p className="text-[10px] font-black uppercase text-primary tracking-widest">Restorable Modal</p>
                                 <p className="text-[9px] font-bold text-muted-foreground mt-1">Ready for reinvestment</p>
                              </div>
                              <p className="text-3xl font-black text-primary tracking-tighter">{currencySymbol}{stat.capitalToClaim.toFixed(2)}</p>
                           </div>
                        </div>
                     </CardContent>
                  </Card>
                ))}
             </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
            <Card className="lg:col-span-2 border-none shadow-sm bg-white rounded-[48px] overflow-hidden border-2 border-primary/5">
              <CardHeader className="flex flex-row items-center justify-between p-10">
                <div>
                  <CardTitle className="text-2xl font-black tracking-tight">Revenue Segment Analysis</CardTitle>
                  <CardDescription className="font-bold">Comparative yield across business pillars</CardDescription>
                </div>
                <div className="w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center text-primary">
                  <ShieldCheck className="w-8 h-8" />
                </div>
              </CardHeader>
              <CardContent className="h-[400px] p-10 pt-0">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={moduleData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontWeight: 800, fontSize: 12 }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontWeight: 800, fontSize: 12 }} tickFormatter={(val) => `${currencySymbol}${val}`} />
                    <Tooltip 
                      cursor={{ fill: 'rgba(0,0,0,0.02)', radius: 12 }}
                      contentStyle={{ borderRadius: '24px', border: 'none', boxShadow: '0 20px 50px rgba(0,0,0,0.1)', padding: '20px' }}
                    />
                    <Bar dataKey="total" radius={[12, 12, 0, 0]} barSize={60}>
                      {moduleData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={index === 0 ? 'hsl(var(--primary))' : 'hsl(var(--secondary))'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <div className="space-y-8">
              <Card className="border-none shadow-2xl bg-primary text-primary-foreground rounded-[40px] overflow-hidden relative">
                <div className="absolute top-0 right-0 p-10 opacity-10 rotate-12">
                   <AlertTriangle className="w-32 h-32" />
                </div>
                <CardHeader className="relative z-10">
                  <CardTitle className="text-xl flex items-center gap-3 font-black tracking-tight uppercase">
                    Tactical Intelligence
                  </CardTitle>
                  <p className="text-xs font-bold opacity-70">Real-time alerts & guardrail status</p>
                </CardHeader>
                <CardContent className="space-y-5 relative z-10">
                  <AlertItem label="Critical Stock Alerts" value={`${products?.filter(p => p.stock < 10).length || 0} Assets below threshold`} />
                  <AlertItem label="Budget Consumption" value={`${((totalCapitalUsed / (totalCapacity || 1)) * 100).toFixed(1)}% Velocity`} />
                  <AlertItem label="Unclaimed Restoration" value={`${currencySymbol}${aggregateCapitalToClaim.toFixed(2)} Restorable`} />
                </CardContent>
              </Card>

              <Card className="border-none shadow-sm bg-white rounded-[40px] border-2 border-secondary/20">
                <CardHeader className="p-8">
                  <CardTitle className="text-xl font-black tracking-tight">Recent Ledger Events</CardTitle>
                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Latest transactions</p>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="divide-y px-8 pb-4">
                    {transactions?.slice().reverse().slice(0, 5).map((t) => (
                      <div key={t.id} className="flex items-center justify-between py-5 group">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 bg-secondary rounded-2xl flex items-center justify-center group-hover:bg-primary/10 transition-all">
                            {t.module === 'mart' ? <ShoppingBag className="w-5 h-5 text-primary" /> : <Waves className="w-5 h-5 text-primary" />}
                          </div>
                          <div>
                            <p className="text-xs font-black uppercase tracking-tight text-foreground">{t.module} Operational</p>
                            <p className="text-[10px] text-muted-foreground font-black uppercase tracking-widest">{new Date(t.timestamp).toLocaleTimeString()}</p>
                          </div>
                        </div>
                        <p className="font-black text-lg text-primary tracking-tighter">+{currencySymbol}{t.totalAmount.toFixed(2)}</p>
                      </div>
                    ))}
                    {(!transactions || transactions.length === 0) && (
                      <div className="py-16 text-center opacity-30">
                         <Landmark className="w-12 h-12 mx-auto mb-4" />
                         <p className="text-xs font-black uppercase tracking-widest">Awaiting Events</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

function StatsCard({ icon: Icon, label, value, trend, color }: any) {
  return (
    <Card className="border-none shadow-sm overflow-hidden bg-white rounded-[32px] group hover:shadow-xl transition-all duration-300 border-2 border-transparent hover:border-primary/5">
      <CardContent className="p-8">
        <div className="flex items-center justify-between mb-6">
          <div className="w-14 h-14 bg-secondary/50 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
            <Icon className="w-7 h-7 text-primary" />
          </div>
          <span className="flex items-center text-[10px] font-black text-primary bg-primary/10 px-4 py-1.5 rounded-full uppercase tracking-widest border border-primary/10">
            {trend}
          </span>
        </div>
        <p className="text-[10px] text-muted-foreground font-black uppercase tracking-[0.2em] leading-none mb-2">{label}</p>
        <h4 className={cn("text-3xl font-black tracking-tighter leading-none", color)}>{value}</h4>
      </CardContent>
    </Card>
  );
}

function AlertItem({ label, value }: { label: string, value: string }) {
  return (
    <div className="bg-white/10 p-5 rounded-3xl backdrop-blur-sm hover:bg-white/20 transition-all border border-white/5">
      <p className="text-[9px] font-black uppercase opacity-60 leading-none mb-2 tracking-widest">{label}</p>
      <p className="font-black text-sm tracking-tight">{value}</p>
    </div>
  );
}
