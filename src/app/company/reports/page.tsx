
'use client';

import { Sidebar } from '@/components/layout/sidebar';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useAuth } from '@/components/auth-context';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { BarChart3, TrendingUp, DollarSign, Download, Calendar, Filter, PieChart as PieChartIcon, Search, ListFilter, ShieldCheck } from 'lucide-react';
import { SaleTransaction, CapitalPurchase, Product } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export default function ReportsPage() {
  const { user } = useAuth();
  const firestore = useFirestore();
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'dashboard' | 'ledger'>('dashboard');

  const transactionsQuery = useMemoFirebase(() => {
    if (!firestore || !user?.companyId) return null;
    return collection(firestore, 'companies', user.companyId, 'transactions');
  }, [firestore, user?.companyId]);

  const { data: transactions } = useCollection<SaleTransaction>(transactionsQuery);

  const totalRevenue = transactions?.reduce((acc, t) => acc + t.totalAmount, 0) || 0;
  const totalProfit = transactions?.reduce((acc, t) => acc + t.profit, 0) || 0;

  const moduleStats = [
    { name: 'Mart', value: transactions?.filter(t => t.module === 'mart').reduce((acc, t) => acc + t.totalAmount, 0) || 0, color: 'hsl(var(--primary))' },
    { name: 'Laundry', value: transactions?.filter(t => t.module === 'laundry').reduce((acc, t) => acc + t.totalAmount, 0) || 0, color: 'hsl(var(--secondary))' },
    { name: 'Rent', value: transactions?.filter(t => t.module === 'rent').reduce((acc, t) => acc + t.totalAmount, 0) || 0, color: 'hsl(var(--accent))' },
    { name: 'Services', value: transactions?.filter(t => t.module === 'services').reduce((acc, t) => acc + t.totalAmount, 0) || 0, color: 'hsl(var(--chart-5))' },
  ].filter(m => m.value > 0);

  const filteredTransactions = transactions?.filter(t => 
    t.items[0].name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.customerName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.module.toLowerCase().includes(searchTerm.toLowerCase())
  ).sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()) || [];

  const handleExportCSV = () => {
    if (!filteredTransactions.length) return;
    const headers = ['Date', 'Module', 'Item', 'Customer', 'Total', 'Profit', 'Status'];
    const rows = filteredTransactions.map(t => [
      new Date(t.timestamp).toLocaleString(),
      t.module,
      t.items[0].name,
      t.customerName || 'N/A',
      t.totalAmount,
      t.profit,
      t.status || 'Completed'
    ]);

    const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `venturee_report_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="flex h-screen bg-background font-body">
      <Sidebar />
      <main className="flex-1 overflow-auto p-8">
        <div className="max-w-6xl mx-auto">
          <div className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-black font-headline text-foreground tracking-tight">Strategic Intelligence</h1>
              <p className="text-muted-foreground font-medium">Cross-Module Financial Performance & Auditing</p>
            </div>
            <div className="flex items-center gap-2">
               <Button 
                variant={activeTab === 'dashboard' ? 'default' : 'outline'} 
                onClick={() => setActiveTab('dashboard')} 
                className="rounded-xl font-black h-11 px-6 shadow-sm"
               >
                 Analysis
               </Button>
               <Button 
                variant={activeTab === 'ledger' ? 'default' : 'outline'} 
                onClick={() => setActiveTab('ledger')} 
                className="rounded-xl font-black h-11 px-6 shadow-sm"
               >
                 Ledger
               </Button>
               <div className="w-px h-8 bg-border mx-2" />
               <Button onClick={handleExportCSV} className="rounded-xl font-black h-11 px-6 shadow-lg bg-primary">
                 <Download className="w-4 h-4 mr-2" /> Export CSV
               </Button>
            </div>
          </div>

          {activeTab === 'dashboard' ? (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <SummaryCard label="Aggregate Revenue" value={`$${totalRevenue.toFixed(2)}`} icon={DollarSign} color="text-foreground" />
                <SummaryCard label="Operating Profit" value={`$${totalProfit.toFixed(2)}`} icon={TrendingUp} color="text-primary" />
                <SummaryCard label="Module Reach" value={`${moduleStats.length} Active`} icon={BarChart3} color="text-foreground" />
                <SummaryCard label="Data Integrity" value="Syncing" icon={ShieldCheck} color="text-primary" />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <Card className="lg:col-span-2 border-none shadow-sm bg-white rounded-3xl overflow-hidden">
                   <CardHeader className="p-8 pb-0">
                      <CardTitle className="text-lg font-black flex items-center gap-2">
                        <TrendingUp className="w-5 h-5 text-primary" /> Performance Shares
                      </CardTitle>
                   </CardHeader>
                   <CardContent className="h-[350px] p-8 pt-0">
                      <ResponsiveContainer width="100%" height="100%">
                         <BarChart data={moduleStats}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                            <XAxis dataKey="name" axisLine={false} tickLine={false} />
                            <YAxis axisLine={false} tickLine={false} tickFormatter={(v) => `$${v}`} />
                            <Tooltip contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 25px rgba(0,0,0,0.05)' }} />
                            <Bar dataKey="value" name="Revenue" radius={[8, 8, 0, 0]} barSize={60}>
                               {moduleStats.map((entry, index) => (
                                 <Cell key={`cell-${index}`} fill={entry.color} />
                               ))}
                            </Bar>
                         </BarChart>
                      </ResponsiveContainer>
                   </CardContent>
                </Card>

                <Card className="lg:col-span-1 border-none shadow-sm bg-white rounded-3xl overflow-hidden">
                   <CardHeader className="p-8">
                      <CardTitle className="text-lg font-black flex items-center gap-2">
                        <PieChartIcon className="w-5 h-5 text-primary" /> Sector Revenue
                      </CardTitle>
                   </CardHeader>
                   <CardContent className="h-[300px] p-8 pt-0">
                      <ResponsiveContainer width="100%" height="100%">
                         <PieChart>
                            <Pie data={moduleStats} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                               {moduleStats.map((entry, index) => (
                                 <Cell key={`cell-${index}`} fill={entry.color} />
                               ))}
                            </Pie>
                            <Tooltip contentStyle={{ borderRadius: '12px', border: 'none' }} />
                         </PieChart>
                      </ResponsiveContainer>
                   </CardContent>
                   <CardFooter className="bg-secondary/10 p-6">
                      <p className="text-xs font-bold leading-relaxed opacity-60">Revenue is categorized by active modules in the current billing cycle.</p>
                   </CardFooter>
                </Card>
              </div>
            </div>
          ) : (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
               <div className="flex gap-4">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input 
                      placeholder="Search items, customers, or sectors..." 
                      className="pl-10 h-12 rounded-xl bg-white border-none shadow-sm font-bold"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                  </div>
                  <Button variant="outline" className="rounded-xl h-12 px-6 bg-white font-bold gap-2">
                    <ListFilter className="w-4 h-4" /> Filter
                  </Button>
               </div>

               <div className="bg-white rounded-3xl border shadow-sm overflow-hidden">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-secondary/20 border-b">
                      <tr>
                        <th className="p-4 font-black uppercase text-muted-foreground tracking-tighter">Event Details</th>
                        <th className="p-4 font-black uppercase text-muted-foreground tracking-tighter">Sector</th>
                        <th className="p-4 font-black uppercase text-muted-foreground tracking-tighter">Revenue</th>
                        <th className="p-4 font-black uppercase text-muted-foreground tracking-tighter">Profit</th>
                        <th className="p-4 font-black uppercase text-muted-foreground tracking-tighter">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                       {filteredTransactions.map(t => (
                         <tr key={t.id} className="hover:bg-secondary/5 transition-colors">
                           <td className="p-4">
                              <p className="font-black text-foreground">{t.items[0].name}</p>
                              <div className="flex items-center gap-2 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                                {t.customerName || 'Standard User'} | {new Date(t.timestamp).toLocaleDateString()}
                              </div>
                           </td>
                           <td className="p-4">
                              <Badge variant="outline" className="font-black uppercase text-[9px] tracking-widest">{t.module}</Badge>
                           </td>
                           <td className="p-4 font-black text-foreground">${t.totalAmount.toFixed(2)}</td>
                           <td className="p-4 font-black text-primary">${t.profit.toFixed(2)}</td>
                           <td className="p-4">
                              <Badge className={cn(
                                "font-black uppercase text-[9px] tracking-widest",
                                t.status === 'completed' || !t.status ? "bg-green-600" : "bg-orange-500"
                              )}>
                                {t.status || 'completed'}
                              </Badge>
                           </td>
                         </tr>
                       ))}
                       {filteredTransactions.length === 0 && (
                         <tr>
                           <td colSpan={5} className="py-20 text-center opacity-30">
                              <ListFilter className="w-12 h-12 mx-auto mb-2" />
                              <p className="font-bold">No ledger activities found.</p>
                           </td>
                         </tr>
                       )}
                    </tbody>
                  </table>
               </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function SummaryCard({ label, value, icon: Icon, color }: any) {
  return (
    <Card className="border-none shadow-sm bg-white rounded-2xl group overflow-hidden hover:shadow-md transition-all">
       <CardContent className="p-6">
          <div className="flex justify-between items-start mb-4">
             <div className="w-10 h-10 bg-secondary rounded-xl flex items-center justify-center text-primary">
                <Icon className="w-5 h-5" />
             </div>
             <div className="text-right">
                <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest leading-none mb-1">{label}</p>
                <h4 className={cn("text-2xl font-black", color)}>{value}</h4>
             </div>
          </div>
          <div className="h-1.5 w-full bg-secondary/30 rounded-full overflow-hidden">
             <div className="h-full bg-primary/20 w-3/4" />
          </div>
       </CardContent>
    </Card>
  );
}
