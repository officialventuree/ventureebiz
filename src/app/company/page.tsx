
'use client';

import { Sidebar } from '@/components/layout/sidebar';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useAuth } from '@/components/auth-context';
import { useFirestore, useCollection, useMemoFirebase, useDoc } from '@/firebase';
import { collection, doc } from 'firebase/firestore';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { TrendingUp, DollarSign, ShoppingBag, Wallet, Waves, AlertTriangle, Package, ShieldCheck } from 'lucide-react';
import { SaleTransaction, CapitalPurchase, Product, Company } from '@/lib/types';
import { cn } from '@/lib/utils';
import { useMemo } from 'react';

export default function CompanyDashboard() {
  const { user } = useAuth();
  const firestore = useFirestore();

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

  const totalRevenue = transactions?.reduce((acc, s) => acc + s.totalAmount, 0) || 0;
  const totalProfit = transactions?.reduce((acc, s) => acc + s.profit, 0) || 0;
  
  // Calculate capital used within the current active budget period
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
  
  const capitalLimit = companyDoc?.capitalLimit || 10000;
  const remainingCapital = Math.max(0, capitalLimit - totalCapitalUsed);

  // Profit per module for the chart
  const moduleData = [
    { name: 'Mart', total: transactions?.filter(t => t.module === 'mart').reduce((acc, t) => acc + t.totalAmount, 0) || 0 },
    { name: 'Laundry', total: transactions?.filter(t => t.module === 'laundry').reduce((acc, t) => acc + t.totalAmount, 0) || 0 },
    { name: 'Rent', total: transactions?.filter(t => t.module === 'rent').reduce((acc, t) => acc + t.totalAmount, 0) || 0 },
    { name: 'Services', total: transactions?.filter(t => t.module === 'services').reduce((acc, t) => acc + t.totalAmount, 0) || 0 },
  ];

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <main className="flex-1 overflow-auto p-8">
        <div className="max-w-6xl mx-auto">
          <div className="mb-8 flex justify-between items-end">
            <div>
              <h1 className="text-3xl font-black font-headline text-foreground">Operational Overview</h1>
              <p className="text-muted-foreground font-medium">Monitoring real-time business health for {user?.name}</p>
            </div>
            <div className="flex items-center gap-2 text-[10px] font-black bg-white px-4 py-2 rounded-full shadow-sm border text-primary tracking-widest uppercase">
              <div className="w-2 h-2 bg-primary rounded-full animate-pulse" />
              Secure Sync Active
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <StatsCard icon={DollarSign} label="Gross Revenue" value={`$${totalRevenue.toFixed(2)}`} trend="Total" />
            <StatsCard icon={TrendingUp} label="Net Profit" value={`$${totalProfit.toFixed(2)}`} trend="Calculated" color="text-primary" />
            <StatsCard icon={Package} label="Inventory Value" value={`$${inventoryValue.toFixed(2)}`} trend="On Hand" color="text-foreground" />
            <StatsCard icon={Wallet} label="Capital Balance" value={`$${remainingCapital.toFixed(2)}`} trend={`Limit: $${capitalLimit/1000}k`} color="text-foreground" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <Card className="lg:col-span-2 border-none shadow-sm bg-white rounded-3xl overflow-hidden">
              <CardHeader className="flex flex-row items-center justify-between p-8">
                <div>
                  <CardTitle className="text-lg font-black">Revenue by Module</CardTitle>
                  <CardDescription className="font-bold">Comparative performance across departments</CardDescription>
                </div>
                <div className="w-10 h-10 bg-secondary/50 rounded-xl flex items-center justify-center">
                  <ShieldCheck className="w-5 h-5 text-primary" />
                </div>
              </CardHeader>
              <CardContent className="h-[350px] p-8 pt-0">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={moduleData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} />
                    <YAxis axisLine={false} tickLine={false} tickFormatter={(val) => `$${val}`} />
                    <Tooltip 
                      cursor={{ fill: 'transparent' }}
                      contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 25px rgba(0,0,0,0.05)' }}
                    />
                    <Bar dataKey="total" radius={[8, 8, 0, 0]} barSize={50}>
                      {moduleData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={index === 0 ? 'hsl(var(--primary))' : 'hsl(var(--secondary))'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <div className="space-y-6">
              <Card className="border-none shadow-xl bg-primary text-primary-foreground rounded-3xl overflow-hidden">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2 font-black">
                    <AlertTriangle className="w-5 h-5" />
                    Insights & Alerts
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <AlertItem label="Low Stock Warning" value={`${products?.filter(p => p.stock < 10).length || 0} items below threshold`} />
                  <AlertItem label="Cycle Consumption" value={`${((totalCapitalUsed / capitalLimit) * 100).toFixed(1)}% utilized`} />
                  <AlertItem label="Active Students" value={`${transactions?.filter(t => t.module === 'laundry').length || 0} laundry uses`} />
                </CardContent>
              </Card>

              <Card className="border-none shadow-sm bg-white rounded-3xl">
                <CardHeader>
                  <CardTitle className="text-lg font-black">Latest Activity</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="divide-y px-6">
                    {transactions?.slice().reverse().slice(0, 5).map((t) => (
                      <div key={t.id} className="flex items-center justify-between py-4 group">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-secondary rounded-xl flex items-center justify-center group-hover:bg-primary/10 transition-colors">
                            {t.module === 'mart' ? <ShoppingBag className="w-4 h-4 text-primary" /> : <Waves className="w-4 h-4 text-primary" />}
                          </div>
                          <div>
                            <p className="text-[10px] font-black uppercase text-foreground">{t.module}</p>
                            <p className="text-[10px] text-muted-foreground font-bold">{new Date(t.timestamp).toLocaleTimeString()}</p>
                          </div>
                        </div>
                        <p className="font-black text-sm text-primary">+${t.totalAmount.toFixed(2)}</p>
                      </div>
                    ))}
                    {(!transactions || transactions.length === 0) && (
                      <p className="text-center py-12 text-muted-foreground text-sm font-medium">Awaiting first transaction...</p>
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
    <Card className="border-none shadow-sm overflow-hidden bg-white rounded-2xl group hover:shadow-md transition-shadow">
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="w-12 h-12 bg-secondary rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
            <Icon className="w-6 h-6 text-primary" />
          </div>
          <span className="flex items-center text-[10px] font-black text-primary bg-primary/10 px-3 py-1 rounded-full uppercase tracking-tighter">
            {trend}
          </span>
        </div>
        <p className="text-[10px] text-muted-foreground font-black uppercase tracking-widest">{label}</p>
        <h4 className={cn("text-2xl font-black mt-1", color)}>{value}</h4>
      </CardContent>
    </Card>
  );
}

function AlertItem({ label, value }: { label: string, value: string }) {
  return (
    <div className="bg-white/10 p-4 rounded-2xl backdrop-blur-sm hover:bg-white/20 transition-colors">
      <p className="text-[10px] font-black uppercase opacity-60 leading-none mb-1 tracking-widest">{label}</p>
      <p className="font-black text-sm">{value}</p>
    </div>
  );
}
