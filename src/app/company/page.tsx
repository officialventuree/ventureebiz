
'use client';

import { Sidebar } from '@/components/layout/sidebar';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useAuth } from '@/components/auth-context';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { TrendingUp, DollarSign, ShoppingBag, Users, ArrowUpRight, Wallet, Waves, AlertTriangle, Package } from 'lucide-react';
import { SaleTransaction, CapitalPurchase, Product } from '@/lib/types';
import { cn } from '@/lib/utils';

export default function CompanyDashboard() {
  const { user } = useAuth();
  const firestore = useFirestore();

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

  const { data: transactions } = useCollection<SaleTransaction>(transactionsQuery);
  const { data: purchases } = useCollection<CapitalPurchase>(purchasesQuery);
  const { data: products } = useCollection<Product>(productsQuery);

  const totalRevenue = transactions?.reduce((acc, s) => acc + s.totalAmount, 0) || 0;
  const totalProfit = transactions?.reduce((acc, s) => acc + s.profit, 0) || 0;
  const totalCapitalUsed = purchases?.reduce((acc, p) => acc + p.amount, 0) || 0;
  const inventoryValue = products?.reduce((acc, p) => acc + (p.stock * p.costPrice), 0) || 0;
  
  const capitalLimit = 10000; // Mock limit until settings implemented

  // Mock daily stats
  const chartData = [
    { name: 'Mon', total: 400 },
    { name: 'Tue', total: 300 },
    { name: 'Wed', total: 500 },
    { name: 'Thu', total: 200 },
    { name: 'Fri', total: 600 },
    { name: 'Sat', total: 750 },
    { name: 'Sun', total: totalRevenue % 1000 },
  ];

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <main className="flex-1 overflow-auto p-8">
        <div className="max-w-6xl mx-auto">
          <div className="mb-8 flex justify-between items-end">
            <div>
              <h1 className="text-3xl font-bold font-headline">Business Overview</h1>
              <p className="text-muted-foreground">Real-time performance metrics for {user?.name}</p>
            </div>
            <div className="flex items-center gap-2 text-xs font-bold bg-white px-3 py-1.5 rounded-full shadow-sm border">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              SYSTEM LIVE
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <StatsCard icon={DollarSign} label="Gross Revenue" value={`$${totalRevenue.toFixed(2)}`} trend="+12.5%" />
            <StatsCard icon={TrendingUp} label="Net Profit" value={`$${totalProfit.toFixed(2)}`} trend="+8.2%" color="text-green-600" />
            <StatsCard icon={Package} label="Inventory Value" value={`$${inventoryValue.toFixed(2)}`} trend="Live Stock" color="text-blue-600" />
            <StatsCard icon={Wallet} label="Capital Remaining" value={`$${(capitalLimit - totalCapitalUsed).toFixed(2)}`} trend="Limit: $10k" color="text-amber-600" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <Card className="lg:col-span-2 border-none shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Performance Forecast</CardTitle>
                  <CardDescription>Sales trajectory over the last 7 days</CardDescription>
                </div>
                <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center">
                  <TrendingUp className="w-4 h-4 text-primary" />
                </div>
              </CardHeader>
              <CardContent className="h-[350px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eee" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} />
                    <YAxis axisLine={false} tickLine={false} tickFormatter={(val) => `$${val}`} />
                    <Tooltip 
                      cursor={{ fill: 'transparent' }}
                      contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                    />
                    <Bar dataKey="total" radius={[6, 6, 0, 0]} barSize={40}>
                      {chartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={index === 6 ? 'hsl(var(--primary))' : 'hsl(var(--secondary))'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <div className="space-y-6">
              <Card className="border-none shadow-sm bg-primary text-primary-foreground overflow-hidden">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5" />
                    Smart Alerts
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <AlertItem label="Low Stock Alert" value={`${products?.filter(p => p.stock < 10).length || 0} items low`} />
                  <AlertItem label="Capital Limit" value={`${((totalCapitalUsed / capitalLimit) * 100).toFixed(1)}% utilized`} />
                  <AlertItem label="Total Transactions" value={`${transactions?.length || 0} processed`} />
                </CardContent>
              </Card>

              <Card className="border-none shadow-sm">
                <CardHeader>
                  <CardTitle className="text-lg">Recent Transactions</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {transactions?.slice().reverse().slice(0, 5).map((t) => (
                      <div key={t.id} className="flex items-center justify-between group">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-secondary rounded-xl flex items-center justify-center group-hover:bg-primary/10 transition-colors">
                            {t.module === 'mart' ? <ShoppingBag className="w-4 h-4 text-primary" /> : <Waves className="w-4 h-4 text-primary" />}
                          </div>
                          <div>
                            <p className="text-xs font-bold uppercase">{t.module}</p>
                            <p className="text-[10px] text-muted-foreground">{new Date(t.timestamp).toLocaleTimeString()}</p>
                          </div>
                        </div>
                        <p className="font-bold text-sm text-primary">+${t.totalAmount.toFixed(2)}</p>
                      </div>
                    ))}
                    {(!transactions || transactions.length === 0) && (
                      <p className="text-center py-10 text-muted-foreground text-sm">No sales data yet.</p>
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
    <Card className="border-none shadow-sm overflow-hidden bg-white">
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="w-10 h-10 bg-secondary rounded-xl flex items-center justify-center">
            <Icon className="w-5 h-5 text-primary" />
          </div>
          <span className="flex items-center text-[10px] font-bold text-primary bg-primary/10 px-2 py-1 rounded-full">
            {trend}
          </span>
        </div>
        <p className="text-xs text-muted-foreground font-bold uppercase tracking-wider">{label}</p>
        <h4 className={cn("text-2xl font-black mt-1", color)}>{value}</h4>
      </CardContent>
    </Card>
  );
}

function AlertItem({ label, value }: { label: string, value: string }) {
  return (
    <div className="bg-white/10 p-3 rounded-xl backdrop-blur-sm">
      <p className="text-[10px] font-bold uppercase opacity-60 leading-none mb-1">{label}</p>
      <p className="font-bold text-sm">{value}</p>
    </div>
  );
}
