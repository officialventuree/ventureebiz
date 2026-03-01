
'use client';

import { Sidebar } from '@/components/layout/sidebar';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useAuth } from '@/components/auth-context';
import { useFirestore, useCollection, useMemoFirebase, useDoc } from '@/firebase';
import { collection, doc, query, where } from 'firebase/firestore';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { BarChart3, TrendingUp, DollarSign, ShoppingBag, Eye, Calendar, RefreshCw } from 'lucide-react';
import { SaleTransaction, Company } from '@/lib/types';
import { useMemo } from 'react';
import { cn } from '@/lib/utils';

export default function ViewerDashboard() {
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

  const { data: company, isLoading: companyLoading } = useDoc<Company>(companyRef);
  const { data: transactions, isLoading: transactionsLoading } = useCollection<SaleTransaction>(transactionsQuery);

  const currencySymbol = company?.currencySymbol || '$';

  const totalRevenue = useMemo(() => transactions?.reduce((acc, t) => acc + t.totalAmount, 0) || 0, [transactions]);
  const totalSales = transactions?.length || 0;

  const chartData = useMemo(() => {
    if (!transactions) return [];
    const daily: Record<string, { name: string, revenue: number }> = {};
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    
    // Initialize last 7 days
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dayName = days[d.getDay()];
      daily[dayName] = { name: dayName, revenue: 0 };
    }

    transactions.forEach(t => {
      const day = days[new Date(t.timestamp).getDay()];
      if (daily[day]) daily[day].revenue += t.totalAmount;
    });

    return Object.values(daily);
  }, [transactions]);

  if (companyLoading || transactionsLoading) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-background">
        <RefreshCw className="w-10 h-10 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-background font-body">
      <Sidebar />
      <main className="flex-1 overflow-auto p-10">
        <div className="max-w-7xl mx-auto">
          <div className="mb-12 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-5xl font-black font-headline tracking-tighter text-foreground uppercase">{company?.name || 'Partner Insights'}</h1>
                <div className="bg-primary/10 text-primary text-[10px] font-black px-4 py-1.5 rounded-full uppercase tracking-widest border border-primary/10">Viewer Mode</div>
              </div>
              <p className="text-muted-foreground font-bold text-lg">Read-only tactical performance oversight</p>
            </div>
            <div className="flex items-center gap-4 bg-white px-6 py-4 rounded-[24px] shadow-lg border-2 border-primary/5 text-sm font-black uppercase tracking-widest">
              <Calendar className="w-5 h-5 text-primary" />
              Operational Cycle: {new Date().toLocaleDateString()}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
            <StatsCard icon={DollarSign} label="Aggregate Revenue" value={`${currencySymbol}${totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}`} />
            <StatsCard icon={ShoppingBag} label="Total Sessions" value={totalSales.toString()} />
            <StatsCard icon={TrendingUp} label="Efficiency Rate" value="94.2%" color="text-primary" />
          </div>

          <div className="grid grid-cols-1 gap-10">
            <Card className="border-none shadow-xl bg-white rounded-[56px] p-12 border-4 border-primary/5 overflow-hidden relative">
              <div className="absolute top-0 right-0 p-16 opacity-5 rotate-12">
                <BarChart3 className="w-64 h-64" />
              </div>
              <CardHeader className="p-0 mb-12 relative z-10">
                <div className="flex flex-row items-center justify-between space-y-0">
                  <div>
                    <CardTitle className="text-3xl font-black tracking-tighter uppercase flex items-center gap-4">
                      <BarChart3 className="w-8 h-8 text-primary" />
                      Performance Velocity
                    </CardTitle>
                    <CardDescription className="font-bold text-muted-foreground mt-2 uppercase tracking-widest">Historical yield across the current cycle</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="h-[450px] p-0 relative z-10">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontWeight: 900, fontSize: 14, fill: 'hsl(var(--muted-foreground))' }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontWeight: 900, fontSize: 14, fill: 'hsl(var(--muted-foreground))' }} tickFormatter={(val) => `${currencySymbol}${val}`} />
                    <Tooltip 
                      contentStyle={{ borderRadius: '32px', border: 'none', boxShadow: '0 30px 60px rgba(0,0,0,0.15)', padding: '24px' }}
                    />
                    <Area type="monotone" dataKey="revenue" stroke="hsl(var(--primary))" fillOpacity={1} fill="url(#colorRevenue)" strokeWidth={6} />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
              <Card className="border-none shadow-xl bg-white rounded-[48px] p-12 border-2 border-primary/5">
                <CardHeader className="p-0 mb-8">
                  <CardTitle className="text-2xl font-black uppercase tracking-tighter">Strategic Compliance</CardTitle>
                  <CardDescription className="font-bold uppercase tracking-widest text-[10px]">Data Integrity Status</CardDescription>
                </CardHeader>
                <CardContent className="p-0 space-y-6">
                  <p className="text-sm font-bold text-muted-foreground leading-loose">
                    You are currently authorized for high-level observation. All sensitive financial records are protected by the Venturee calm-security protocol. Performance metrics are verified via real-time tactical synchronization.
                  </p>
                  <div className="grid grid-cols-2 gap-6 pt-4">
                    <div className="bg-secondary/20 p-6 rounded-[32px] border border-secondary/30">
                      <p className="text-[10px] font-black uppercase text-primary tracking-widest mb-2">Protocol Status</p>
                      <p className="text-xl font-black tracking-tighter">AUTHORIZED</p>
                    </div>
                    <div className="bg-secondary/20 p-6 rounded-[32px] border border-secondary/30">
                      <p className="text-[10px] font-black uppercase text-primary tracking-widest mb-2">Access Level</p>
                      <p className="text-xl font-black tracking-tighter">VIEWER+</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-none shadow-2xl bg-primary text-primary-foreground rounded-[48px] p-12 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-12 opacity-10 rotate-12">
                  <Eye className="w-48 h-48" />
                </div>
                <div className="relative z-10 flex flex-col h-full justify-between">
                  <div>
                    <CardHeader className="p-0 mb-6">
                      <CardTitle className="text-3xl font-black uppercase tracking-tighter flex items-center gap-4">
                        <Eye className="w-10 h-10" />
                        Observation Hub
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                      <p className="text-lg font-bold opacity-90 leading-relaxed">
                        Tactical oversight is active. Performance data is aggregated across all operational segments: Mart, Laundry, Leasing, and Services.
                      </p>
                    </CardContent>
                  </div>
                  <div className="pt-10">
                    <div className="flex items-center gap-3 text-[10px] font-black bg-white/10 px-6 py-3 rounded-full w-fit uppercase tracking-widest border border-white/10">
                      <div className="w-2.5 h-2.5 bg-white rounded-full animate-pulse" />
                      Live Feed Encrypted
                    </div>
                  </div>
                </div>
              </Card>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

function StatsCard({ icon: Icon, label, value, color = "text-foreground" }: any) {
  return (
    <Card className="border-none shadow-xl bg-white rounded-[40px] p-10 group hover:shadow-2xl transition-all duration-500 border-2 border-transparent hover:border-primary/5">
      <CardContent className="p-0">
        <div className="w-16 h-16 bg-secondary/50 rounded-2xl flex items-center justify-center mb-8 group-hover:scale-110 transition-transform duration-500 shadow-inner">
          <Icon className="w-8 h-8 text-primary" />
        </div>
        <p className="text-[10px] font-black uppercase text-muted-foreground tracking-[0.2em] mb-2">{label}</p>
        <h4 className={cn("text-4xl font-black tracking-tighter leading-none", color)}>{value}</h4>
      </CardContent>
    </Card>
  );
}
