
'use client';

import { Sidebar } from '@/components/layout/sidebar';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useAuth } from '@/components/auth-context';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { BarChart3, TrendingUp, DollarSign, Download, Calendar, Filter, PieChart as PieChartIcon } from 'lucide-react';
import { SaleTransaction, CapitalPurchase, Product } from '@/lib/types';
import { Button } from '@/components/ui/button';

export default function ReportsPage() {
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

  const { data: transactions } = useCollection<SaleTransaction>(transactionsQuery);
  const { data: purchases } = useCollection<CapitalPurchase>(purchasesQuery);

  const totalRevenue = transactions?.reduce((acc, t) => acc + t.totalAmount, 0) || 0;
  const totalProfit = transactions?.reduce((acc, t) => acc + t.profit, 0) || 0;
  const totalSpending = purchases?.reduce((acc, p) => acc + p.amount, 0) || 0;
  const netPerformance = totalProfit - totalSpending;

  const modulePerformance = [
    { name: 'Mart', value: transactions?.filter(t => t.module === 'mart').reduce((acc, t) => acc + t.totalAmount, 0) || 0, color: 'hsl(var(--primary))' },
    { name: 'Laundry', value: transactions?.filter(t => t.module === 'laundry').reduce((acc, t) => acc + t.totalAmount, 0) || 0, color: 'hsl(var(--secondary))' },
    { name: 'Rent', value: transactions?.filter(t => t.module === 'rent').reduce((acc, t) => acc + t.totalAmount, 0) || 0, color: 'hsl(var(--accent))' },
    { name: 'Services', value: transactions?.filter(t => t.module === 'services').reduce((acc, t) => acc + t.totalAmount, 0) || 0, color: 'hsl(var(--chart-5))' },
  ].filter(m => m.value > 0);

  const profitTrend = transactions?.slice(-10).map(t => ({
    date: new Date(t.timestamp).toLocaleDateString([], { month: 'short', day: 'numeric' }),
    revenue: t.totalAmount,
    profit: t.profit
  })) || [];

  return (
    <div className="flex h-screen bg-background font-body">
      <Sidebar />
      <main className="flex-1 overflow-auto p-8">
        <div className="max-w-6xl mx-auto">
          <div className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-black font-headline text-foreground">Strategic Reports</h1>
              <p className="text-muted-foreground">Comprehensive Business Analytics & Financial Audits</p>
            </div>
            <div className="flex items-center gap-3">
               <Button variant="outline" className="rounded-xl font-bold bg-white border-2">
                  <Filter className="w-4 h-4 mr-2" /> Filter Period
               </Button>
               <Button className="rounded-xl font-black shadow-lg">
                  <Download className="w-4 h-4 mr-2" /> Export PDF
               </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
             <StatsCard label="Aggregate Revenue" value={`$${totalRevenue.toFixed(2)}`} icon={DollarSign} color="text-foreground" />
             <StatsCard label="Operating Profit" value={`$${totalProfit.toFixed(2)}`} icon={TrendingUp} color="text-primary" />
             <StatsCard label="Capital Burn" value={`$${totalSpending.toFixed(2)}`} icon={BarChart3} color="text-destructive" />
             <StatsCard label="Net Performance" value={`$${netPerformance.toFixed(2)}`} icon={TrendingUp} color={netPerformance >= 0 ? "text-primary" : "text-destructive"} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <Card className="lg:col-span-2 border-none shadow-sm bg-white rounded-3xl overflow-hidden">
              <CardHeader className="p-8">
                <CardTitle className="text-lg font-black flex items-center gap-2">
                   <TrendingUp className="w-5 h-5 text-primary" /> Financial Trajectory
                </CardTitle>
                <CardDescription className="font-bold">Recent Revenue vs. Profit Breakdown</CardDescription>
              </CardHeader>
              <CardContent className="h-[350px] p-8 pt-0">
                 <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={profitTrend}>
                       <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                       <XAxis dataKey="date" axisLine={false} tickLine={false} />
                       <YAxis axisLine={false} tickLine={false} tickFormatter={(v) => `$${v}`} />
                       <Tooltip contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 25px rgba(0,0,0,0.05)' }} />
                       <Legend verticalAlign="top" height={36}/>
                       <Bar dataKey="revenue" name="Revenue" fill="hsl(var(--secondary))" radius={[4, 4, 0, 0]} />
                       <Bar dataKey="profit" name="Profit" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                 </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className="lg:col-span-1 border-none shadow-sm bg-white rounded-3xl overflow-hidden">
               <CardHeader className="p-8">
                  <CardTitle className="text-lg font-black flex items-center gap-2">
                     <PieChartIcon className="w-5 h-5 text-primary" /> Module Share
                  </CardTitle>
               </CardHeader>
               <CardContent className="h-[300px] p-8 pt-0">
                  <ResponsiveContainer width="100%" height="100%">
                     <PieChart>
                        <Pie
                           data={modulePerformance}
                           cx="50%"
                           cy="50%"
                           innerRadius={60}
                           outerRadius={80}
                           paddingAngle={5}
                           dataKey="value"
                        >
                           {modulePerformance.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                           ))}
                        </Pie>
                        <Tooltip contentStyle={{ borderRadius: '12px', border: 'none' }} />
                        <Legend />
                     </PieChart>
                  </ResponsiveContainer>
               </CardContent>
               <CardFooter className="bg-secondary/10 p-6 flex-col gap-2 items-start">
                  <p className="text-[10px] font-black uppercase text-muted-foreground">Strategic Insight</p>
                  <p className="text-xs font-bold leading-relaxed">
                    {modulePerformance.length > 0 
                      ? `${modulePerformance.sort((a,b) => b.value - a.value)[0].name} is currently your most productive module.`
                      : 'No active module data found for this period.'}
                  </p>
               </CardFooter>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}

function StatsCard({ label, value, icon: Icon, color }: any) {
  return (
    <Card className="border-none shadow-sm bg-white rounded-2xl group overflow-hidden">
       <CardContent className="p-6">
          <div className="flex justify-between items-start mb-4">
             <div className="w-10 h-10 bg-secondary rounded-xl flex items-center justify-center text-primary">
                <Icon className="w-5 h-5" />
             </div>
             <div className="text-right">
                <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest leading-none mb-1">{label}</p>
                <h4 className={`text-2xl font-black ${color}`}>{value}</h4>
             </div>
          </div>
          <div className="h-1.5 w-full bg-secondary/30 rounded-full overflow-hidden">
             <div className="h-full bg-primary/20 w-3/4" />
          </div>
       </CardContent>
    </Card>
  );
}
