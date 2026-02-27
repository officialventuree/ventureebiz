'use client';

import { Sidebar } from '@/components/layout/sidebar';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useAuth } from '@/components/auth-context';
import { db } from '@/lib/store';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { TrendingUp, DollarSign, ShoppingBag, Users, ArrowUpRight } from 'lucide-react';

export default function CompanyDashboard() {
  const { user } = useAuth();
  const sales = db.getSales(user?.companyId || '');
  
  const totalRevenue = sales.reduce((acc, s) => acc + s.total, 0);
  const totalSales = sales.length;

  // Mock data for the chart based on current sales
  const chartData = [
    { name: 'Mon', total: Math.random() * 500 },
    { name: 'Tue', total: Math.random() * 500 },
    { name: 'Wed', total: Math.random() * 500 },
    { name: 'Thu', total: Math.random() * 500 },
    { name: 'Fri', total: Math.random() * 500 },
    { name: 'Sat', total: Math.random() * 500 },
    { name: 'Sun', total: totalRevenue || Math.random() * 100 },
  ];

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <main className="flex-1 overflow-auto p-8">
        <div className="max-w-6xl mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl font-bold font-headline">Business Overview</h1>
            <p className="text-muted-foreground">Welcome back, {user?.name}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <StatsCard icon={DollarSign} label="Total Revenue" value={`$${totalRevenue.toFixed(2)}`} trend="+12.5%" />
            <StatsCard icon={ShoppingBag} label="Sales volume" value={totalSales.toString()} trend="+5.2%" />
            <StatsCard icon={Users} label="Active Viewers" value="2" trend="0%" />
            <StatsCard icon={TrendingUp} label="Avg Order" value={`$${(totalRevenue / (totalSales || 1)).toFixed(2)}`} trend="+2.4%" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <Card className="lg:col-span-2 border-none shadow-sm">
              <CardHeader>
                <CardTitle>Revenue Forecast</CardTitle>
                <CardDescription>Sales performance over the last 7 days</CardDescription>
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
                    <Bar dataKey="total" radius={[4, 4, 0, 0]}>
                      {chartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={index === 6 ? 'hsl(var(--primary))' : 'hsl(var(--secondary))'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className="border-none shadow-sm">
              <CardHeader>
                <CardTitle>Recent Activity</CardTitle>
                <CardDescription>Latest transactions</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {sales.length === 0 ? (
                    <p className="text-sm text-center text-muted-foreground py-10">No transactions recorded yet.</p>
                  ) : (
                    sales.slice().reverse().map((sale) => (
                      <div key={sale.id} className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-secondary rounded-lg flex items-center justify-center">
                            <ShoppingBag className="w-5 h-5 text-primary" />
                          </div>
                          <div>
                            <p className="text-sm font-bold">New Sale</p>
                            <p className="text-[10px] text-muted-foreground uppercase">{new Date(sale.timestamp).toLocaleTimeString()}</p>
                          </div>
                        </div>
                        <p className="font-bold text-primary">+${sale.total.toFixed(2)}</p>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}

function StatsCard({ icon: Icon, label, value, trend }: any) {
  return (
    <Card className="border-none shadow-sm overflow-hidden">
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
            <Icon className="w-5 h-5 text-primary" />
          </div>
          <span className="flex items-center text-xs font-bold text-primary bg-primary/10 px-2 py-1 rounded-full">
            {trend}
            <ArrowUpRight className="w-3 h-3 ml-1" />
          </span>
        </div>
        <p className="text-sm text-muted-foreground font-medium">{label}</p>
        <h4 className="text-2xl font-bold mt-1">{value}</h4>
      </CardContent>
    </Card>
  );
}
