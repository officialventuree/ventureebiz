
'use client';

import { Sidebar } from '@/components/layout/sidebar';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useAuth } from '@/components/auth-context';
import { useFirestore, useCollection, useMemoFirebase, useDoc } from '@/firebase';
import { collection, doc } from 'firebase/firestore';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { BarChart3, TrendingUp, DollarSign, Download, Search, Trophy, Landmark } from 'lucide-react';
import { SaleTransaction, LuckyDrawEntry, Company } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function ReportsPage() {
  const { user } = useAuth();
  const firestore = useFirestore();
  const [searchTerm, setSearchTerm] = useState('');

  const companyRef = useMemoFirebase(() => (!firestore || !user?.companyId) ? null : doc(firestore, 'companies', user.companyId), [firestore, user?.companyId]);
  const transactionsQuery = useMemoFirebase(() => (!firestore || !user?.companyId) ? null : collection(firestore, 'companies', user.companyId, 'transactions'), [firestore, user?.companyId]);
  const luckyDrawsQuery = useMemoFirebase(() => (!firestore || !user?.companyId) ? null : collection(firestore, 'companies', user.companyId, 'luckyDraws'), [firestore, user?.companyId]);

  const { data: companyDoc } = useDoc<Company>(companyRef);
  const { data: transactions } = useCollection<SaleTransaction>(transactionsQuery);
  const { data: luckyDraws } = useCollection<LuckyDrawEntry>(luckyDrawsQuery);

  const currencySymbol = companyDoc?.currencySymbol || '$';

  const totalRevenue = transactions?.reduce((acc, t) => acc + t.totalAmount, 0) || 0;
  const totalProfit = transactions?.reduce((acc, t) => acc + t.profit, 0) || 0;

  const moduleStats = [
    { name: 'Mart', value: transactions?.filter(t => t.module === 'mart').reduce((acc, t) => acc + t.totalAmount, 0) || 0, color: 'hsl(var(--primary))' },
    { name: 'Laundry', value: transactions?.filter(t => t.module === 'laundry').reduce((acc, t) => acc + t.totalAmount, 0) || 0, color: 'hsl(var(--secondary))' },
    { name: 'Rent', value: transactions?.filter(t => t.module === 'rent').reduce((acc, t) => acc + t.totalAmount, 0) || 0, color: 'hsl(var(--accent))' },
    { name: 'Services', value: transactions?.filter(t => t.module === 'services').reduce((acc, t) => acc + t.totalAmount, 0) || 0, color: 'hsl(var(--chart-5))' },
  ].filter(m => m.value > 0);

  const filteredTransactions = transactions?.filter(t => 
    t.items[0]?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.customerName?.toLowerCase().includes(searchTerm.toLowerCase())
  ).sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()) || [];

  return (
    <div className="flex h-screen bg-background font-body">
      <Sidebar />
      <main className="flex-1 overflow-auto p-10">
        <div className="max-w-7xl mx-auto">
          <div className="mb-12 flex flex-col md:flex-row md:items-end justify-between gap-6 px-2">
            <div>
               <h1 className="text-5xl font-black font-headline text-foreground tracking-tighter uppercase">Business Intelligence</h1>
               <p className="text-muted-foreground font-bold text-lg mt-2 tracking-tight">Standard Accounting Audit & Portfolio Analytics</p>
            </div>
            <Button className="rounded-2xl font-black h-16 px-10 shadow-2xl bg-primary text-white transition-all hover:scale-[1.02] active:scale-95 uppercase tracking-widest text-xs">
               <Download className="w-5 h-5 mr-3" /> Export Tactical CSV
            </Button>
          </div>

          <Tabs defaultValue="analysis" className="space-y-10">
             <TabsList className="bg-white/50 border-2 border-primary/5 p-1.5 rounded-[24px] shadow-sm">
                <TabsTrigger value="analysis" className="rounded-[18px] px-10 py-2 font-black text-xs uppercase tracking-widest">Performance Analysis</TabsTrigger>
                <TabsTrigger value="ledger" className="rounded-[18px] px-10 py-2 font-black text-xs uppercase tracking-widest">Strategic Ledger</TabsTrigger>
                <TabsTrigger value="events" className="rounded-[18px] px-10 py-2 font-black text-xs uppercase tracking-widest">Event Audit</TabsTrigger>
             </TabsList>

             <TabsContent value="analysis" className="space-y-10">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                  <SummaryCard label="Aggregate Revenue" value={`${currencySymbol}${totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}`} icon={DollarSign} />
                  <SummaryCard label="Realized Operating Profit" value={`${currencySymbol}${totalProfit.toLocaleString(undefined, { minimumFractionDigits: 2 })}`} icon={TrendingUp} color="text-primary" />
                  <SummaryCard label="Active Business Pillars" value={moduleStats.length.toString()} icon={BarChart3} />
                  <SummaryCard label="Verified Event Entries" value={luckyDraws?.length.toString() || '0'} icon={Trophy} />
                </div>
                <Card className="border-none shadow-xl bg-white rounded-[56px] p-12 border-2 border-primary/5">
                   <CardHeader className="p-0 mb-12">
                      <CardTitle className="text-3xl font-black tracking-tighter uppercase">Sector Contribution Matrix</CardTitle>
                      <p className="text-sm font-bold text-muted-foreground uppercase tracking-widest mt-2">Aggregated yield per business segment</p>
                   </CardHeader>
                   <div className="h-[450px]">
                      <ResponsiveContainer width="100%" height="100%">
                         <BarChart data={moduleStats}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontWeight: 900, fontSize: 14, fill: 'hsl(var(--muted-foreground))' }}/>
                            <YAxis axisLine={false} tickLine={false} tick={{ fontWeight: 900, fontSize: 14, fill: 'hsl(var(--muted-foreground))' }} tickFormatter={(v) => `${currencySymbol}${v}`}/>
                            <Tooltip contentStyle={{ borderRadius: '32px', border: 'none', boxShadow: '0 30px 60px rgba(0,0,0,0.15)', padding: '24px' }} cursor={{ fill: 'rgba(0,0,0,0.02)', radius: 12 }} />
                            <Bar dataKey="value" name="Segment Revenue" radius={[12, 12, 0, 0]} barSize={80}>
                               {moduleStats.map((entry, index) => (<Cell key={`cell-${index}`} fill={entry.color} />))}
                            </Bar>
                         </BarChart>
                      </ResponsiveContainer>
                   </div>
                </Card>
             </TabsContent>

             <TabsContent value="ledger" className="space-y-8">
                <div className="flex gap-6 mb-4 max-w-2xl px-2">
                   <div className="relative flex-1 group">
                      <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-6 h-6 text-primary z-10" />
                      <Input placeholder="SEARCH TRANSACTION LEDGER..." className="pl-14 h-16 rounded-3xl border-4 border-transparent bg-white shadow-xl text-lg font-black focus-visible:ring-primary/20 relative z-0 tracking-tight" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}/>
                   </div>
                </div>
                <div className="bg-white rounded-[48px] border-2 border-primary/5 shadow-sm overflow-hidden">
                   <table className="w-full text-sm text-left">
                      <thead className="bg-secondary/20 border-b-2">
                         <tr>
                            <th className="p-8 font-black uppercase text-[10px] tracking-widest text-muted-foreground">Ledger Event / Operational Date</th>
                            <th className="p-8 font-black uppercase text-[10px] tracking-widest text-muted-foreground text-center">Settlement Gateway</th>
                            <th className="p-8 font-black uppercase text-[10px] tracking-widest text-muted-foreground">Tactical Revenue</th>
                            <th className="p-8 font-black uppercase text-[10px] tracking-widest text-muted-foreground">Workflow Status</th>
                         </tr>
                      </thead>
                      <tbody className="divide-y">
                         {filteredTransactions.map(t => (
                            <tr key={t.id} className="hover:bg-secondary/10 transition-all">
                               <td className="p-8">
                                  <p className="font-black text-xl tracking-tight text-foreground">{t.items[0]?.name || 'Tactical Session'}</p>
                                  <div className="flex items-center gap-3 text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-2">
                                     <span className="text-primary font-black">{t.customerName || 'WALK-IN'}</span>
                                     <span className="opacity-30">|</span>
                                     <span>{new Date(t.timestamp).toLocaleDateString(undefined, { dateStyle: 'full' })}</span>
                                  </div>
                               </td>
                               <td className="p-8 text-center">
                                  <Badge className="font-black uppercase text-[9px] tracking-widest px-5 h-7 rounded-xl border-none bg-primary/10 text-primary">{t.paymentMethod || 'cash'}</Badge>
                               </td>
                               <td className="p-8">
                                  <p className="font-black text-foreground text-2xl tracking-tighter">{currencySymbol}{t.totalAmount.toFixed(2)}</p>
                               </td>
                               <td className="p-8">
                                  <Badge className={cn(
                                     "font-black uppercase text-[10px] tracking-widest h-7 px-5 rounded-xl border-none",
                                     t.status === 'completed' || !t.status ? "bg-green-600 text-white" : "bg-orange-500 text-white"
                                  )}>{t.status || 'completed'}</Badge>
                               </td>
                            </tr>
                         ))}
                         {filteredTransactions.length === 0 && (
                            <tr>
                               <td colSpan={4} className="py-32 text-center opacity-20">
                                  <Landmark className="w-24 h-24 mx-auto mb-6" />
                                  <p className="font-black uppercase tracking-[0.4em] text-sm">Ledger Registry Empty</p>
                               </td>
                            </tr>
                         )}
                      </tbody>
                   </table>
                </div>
             </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
}

function SummaryCard({ label, value, icon: Icon, color }: any) {
  return (
    <Card className="border-none shadow-xl bg-white rounded-[40px] group overflow-hidden hover:shadow-2xl transition-all duration-500 border-2 border-transparent hover:border-primary/10">
       <CardContent className="p-10">
          <div className="flex justify-between items-start mb-6">
             <div className="w-16 h-16 bg-secondary/50 rounded-2xl flex items-center justify-center text-primary group-hover:scale-[1.1] transition-transform duration-500 shadow-inner">
                <Icon className="w-8 h-8" />
             </div>
             <div className="text-right">
                <p className="text-[10px] font-black uppercase text-muted-foreground tracking-[0.2em] leading-none mb-2">{label}</p>
                <h4 className={cn("text-3xl font-black tracking-tighter leading-none", color)}>{value}</h4>
             </div>
          </div>
       </CardContent>
    </Card>
  );
}
