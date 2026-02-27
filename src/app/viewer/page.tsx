'use client';

import { Sidebar } from '@/components/layout/sidebar';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useAuth } from '@/components/auth-context';
import { db } from '@/lib/store';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { BarChart3, TrendingUp, DollarSign, ShoppingBag, Eye, Calendar } from 'lucide-react';

export default function ViewerDashboard() {
  const { user } = useAuth();
  const sales = db.getSales(user?.companyId || '');
  const company = db.getCompanyById(user?.companyId || '');
  
  const totalRevenue = sales.reduce((acc, s) => acc + s.total, 0);
  const totalSales = sales.length;

  const chartData = [
    { name: 'Mon', revenue: 120, sales: 5 },
    { name: 'Tue', revenue: 190, sales: 8 },
    { name: 'Wed', revenue: 150, sales: 6 },
    { name: 'Thu', revenue: 210, sales: 10 },
    { name: 'Fri', revenue: 250, sales: 12 },
    { name: 'Sat', revenue: 320, sales: 15 },
    { name: 'Sun', revenue: totalRevenue || 100, sales: totalSales || 4 },
  ];

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <main className="flex-1 overflow-auto p-8">
        <div className="max-w-6xl mx-auto">
          <div className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h1 className="text-3xl font-bold font-headline">{company?.name || 'Venturee Partner'}</h1>
                <div className="bg-primary/10 text-primary text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">Viewer Mode</div>
              </div>
              <p className="text-muted-foreground">Insightful overview of business performance</p>
            </div>
            <div className="flex items-center gap-3 bg-white px-4 py-2 rounded-xl shadow-sm border text-sm font-medium">
              <Calendar className="w-4 h-4 text-primary" />
              Latest Data: {new Date().toLocaleDateString()}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <StatsCard icon={DollarSign} label="Aggregate Revenue" value={`$${totalRevenue.toFixed(2)}`} />
            <StatsCard icon={ShoppingBag} label="Total Transactions" value={totalSales.toString()} />
            <StatsCard icon={TrendingUp} label="Efficiency Rate" value="94.2%" />
          </div>

          <div className="grid grid-cols-1 gap-8">
            <Card className="border-none shadow-sm overflow-hidden">
              <CardHeader className="flex flex-row items-center justify-between space-y-0">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="w-5 h-5 text-primary" />
                    Performance Growth
                  </CardTitle>
                  <CardDescription>Revenue trajectory across the active period</CardDescription>
                </div>
                <div className="flex items-center gap-4 text-xs font-bold">
                  <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-primary"></div> Revenue</div>
                </div>
              </CardHeader>
              <CardContent className="h-[400px] pt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eee" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} />
                    <YAxis axisLine={false} tickLine={false} tickFormatter={(val) => `$${val}`} />
                    <Tooltip 
                      contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                    />
                    <Area type="monotone" dataKey="revenue" stroke="hsl(var(--primary))" fillOpacity={1} fill="url(#colorRevenue)" strokeWidth={3} />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <Card className="border-none shadow-sm">
                <CardHeader>
                  <CardTitle>Sales Distribution</CardTitle>
                  <CardDescription>Frequency of customer purchases</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {['Product A', 'Product B', 'Product C'].map((p, i) => (
                      <div key={p} className="space-y-1.5">
                        <div className="flex justify-between text-sm">
                          <span className="font-medium">{p}</span>
                          <span className="text-muted-foreground">{[65, 42, 28][i]}%</span>
                        </div>
                        <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-primary rounded-full" 
                            style={{ width: `${[65, 42, 28][i]}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card className="border-none shadow-sm bg-primary text-primary-foreground">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Eye className="w-5 h-5" />
                    Observation Mode
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm opacity-90 leading-relaxed mb-6">
                    You are currently viewing data in read-only mode. All sensitive financial records are protected by Venturee's calm-security protocol. Performance metrics are updated in real-time.
                  </p>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-white/10 p-4 rounded-xl">
                      <p className="text-[10px] font-bold uppercase opacity-60">Status</p>
                      <p className="font-bold">Authorized</p>
                    </div>
                    <div className="bg-white/10 p-4 rounded-xl">
                      <p className="text-[10px] font-bold uppercase opacity-60">Level</p>
                      <p className="font-bold">Viewer+</p>
                    </div>
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

function StatsCard({ icon: Icon, label, value }: any) {
  return (
    <Card className="border-none shadow-sm bg-white">
      <CardContent className="p-6">
        <div className="w-12 h-12 bg-secondary/50 rounded-xl flex items-center justify-center mb-4">
          <Icon className="w-6 h-6 text-primary" />
        </div>
        <p className="text-sm text-muted-foreground font-medium">{label}</p>
        <h4 className="text-2xl font-bold mt-1">{value}</h4>
      </CardContent>
    </Card>
  );
}
