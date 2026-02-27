
'use client';

import { use } from 'react';
import { Sidebar } from '@/components/layout/sidebar';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Wrench, 
  Plus, 
  Search, 
  ClipboardList, 
  CheckCircle2, 
  Clock, 
  Trash2, 
  TrendingUp, 
  Play, 
  Package, 
  ChevronLeft,
  DollarSign,
  Briefcase,
  Layers,
  ArrowRight,
  ShieldCheck,
  Zap,
  BarChart3,
  Star
} from 'lucide-react';
import { useAuth } from '@/components/auth-context';
import { useFirestore, useCollection, useMemoFirebase, useDoc } from '@/firebase';
import { collection, doc, setDoc, updateDoc, query, where, addDoc, increment, deleteDoc } from 'firebase/firestore';
import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ServiceType, ServicePriceBundle, SaleTransaction, Product } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export default function ServiceDashboardPage({ params }: { params: Promise<{ serviceId: string }> }) {
  const { serviceId } = use(params);
  const { user } = useAuth();
  const firestore = useFirestore();
  const { toast } = useToast();
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeTab, setActiveTab] = useState('pipeline');

  // Queries
  const serviceRef = useMemoFirebase(() => {
    if (!firestore || !user?.companyId) return null;
    return doc(firestore, 'companies', user.companyId, 'serviceTypes', serviceId);
  }, [firestore, user?.companyId, serviceId]);

  const bundlesQuery = useMemoFirebase(() => {
    if (!firestore || !user?.companyId) return null;
    return collection(firestore, 'companies', user.companyId, 'serviceTypes', serviceId, 'priceBundles');
  }, [firestore, user?.companyId, serviceId]);

  const transactionsQuery = useMemoFirebase(() => {
    if (!firestore || !user?.companyId) return null;
    return query(
      collection(firestore, 'companies', user.companyId, 'transactions'),
      where('module', '==', 'services'),
      where('serviceTypeId', '==', serviceId)
    );
  }, [firestore, user?.companyId, serviceId]);

  const inventoryQuery = useMemoFirebase(() => {
    if (!firestore || !user?.companyId) return null;
    return query(
      collection(firestore, 'companies', user.companyId, 'products'),
      where('serviceTypeId', '==', serviceId)
    );
  }, [firestore, user?.companyId, serviceId]);

  const { data: serviceType } = useDoc<ServiceType>(serviceRef);
  const { data: bundles } = useCollection<ServicePriceBundle>(bundlesQuery);
  const { data: transactions } = useCollection<SaleTransaction>(transactionsQuery);
  const { data: materials } = useCollection<Product>(inventoryQuery);

  const pipeline = {
    pending: transactions?.filter(t => t.status === 'pending') || [],
    inProgress: transactions?.filter(t => t.status === 'in-progress') || [],
    completed: transactions?.filter(t => t.status === 'completed') || []
  };

  const handleCreateBundle = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!firestore || !user?.companyId) return;
    const formData = new FormData(e.currentTarget);
    const bundleId = crypto.randomUUID();
    
    const newBundle: ServicePriceBundle = {
      id: bundleId,
      serviceTypeId: serviceId,
      companyId: user.companyId,
      name: formData.get('name') as string,
      price: Number(formData.get('price')),
      estimatedProfit: Number(formData.get('profit'))
    };

    try {
      await setDoc(doc(firestore, 'companies', user.companyId, 'serviceTypes', serviceId, 'priceBundles', bundleId), newBundle);
      toast({ title: "Package Added", description: `${newBundle.name} is now in your catalog.` });
      (e.target as HTMLFormElement).reset();
    } catch (e) {
      toast({ title: "Creation failed", variant: "destructive" });
    }
  };

  const handlePlaceOrder = async (bundle: ServicePriceBundle, customerName: string) => {
    if (!firestore || !user?.companyId || !customerName) return;
    setIsProcessing(true);

    try {
      const transactionId = crypto.randomUUID();
      const transactionData: SaleTransaction = {
        id: transactionId,
        companyId: user.companyId,
        module: 'services',
        serviceTypeId: serviceId,
        totalAmount: bundle.price,
        profit: bundle.estimatedProfit,
        timestamp: new Date().toISOString(),
        customerName,
        items: [{ name: bundle.name, price: bundle.price, quantity: 1 }],
        status: 'pending'
      };

      await setDoc(doc(firestore, 'companies', user.companyId, 'transactions', transactionId), transactionData);
      toast({ title: "Order Logged", description: `Pending order created for ${customerName}.` });
    } catch (e) {
      toast({ title: "Order failed", variant: "destructive" });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleUpdateStatus = async (id: string, newStatus: string) => {
    if (!firestore || !user?.companyId) return;
    try {
      await updateDoc(doc(firestore, 'companies', user.companyId, 'transactions', id), { status: newStatus });
      toast({ title: "Pipeline Updated", description: `Order is now ${newStatus}.` });
    } catch (e) {
      toast({ title: "Update failed", variant: "destructive" });
    }
  };

  const handleAddMaterial = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!firestore || !user?.companyId) return;
    const formData = new FormData(e.currentTarget);
    const id = crypto.randomUUID();
    
    const material: Product = {
      id,
      companyId: user.companyId,
      serviceTypeId: serviceId,
      name: formData.get('name') as string,
      costPrice: Number(formData.get('cost')),
      sellingPrice: Number(formData.get('cost')) * 1.5,
      stock: Number(formData.get('stock')),
      unit: formData.get('unit') as string
    };

    try {
      await setDoc(doc(firestore, 'companies', user.companyId, 'products', id), material);
      toast({ title: "Material Registered", description: "Added to service inventory." });
      (e.target as HTMLFormElement).reset();
    } catch (e) {
      toast({ title: "Failed to add material", variant: "destructive" });
    }
  };

  // Analytics
  const totalRevenue = transactions?.reduce((acc, t) => acc + t.totalAmount, 0) || 0;
  const totalProfit = transactions?.reduce((acc, t) => acc + t.profit, 0) || 0;

  return (
    <div className="flex h-screen bg-background font-body">
      <Sidebar />
      <main className="flex-1 overflow-auto p-8">
        <div className="max-w-6xl mx-auto">
          <Link href="/company/services" className="inline-flex items-center gap-2 text-muted-foreground hover:text-primary transition-colors font-black text-[10px] uppercase tracking-widest mb-6">
            <ChevronLeft className="w-4 h-4" /> Portfolio Overview
          </Link>

          <div className="mb-10 flex justify-between items-end">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-12 h-12 bg-primary rounded-2xl flex items-center justify-center text-primary-foreground shadow-lg">
                  <Wrench className="w-6 h-6" />
                </div>
                <h1 className="text-4xl font-black font-headline text-foreground tracking-tighter">{serviceType?.name}</h1>
              </div>
              <p className="text-muted-foreground font-medium">{serviceType?.description || "Specialized Command Center active."}</p>
            </div>
            <div className="flex gap-4">
               <ReportStat label="Segment Revenue" value={`$${totalRevenue.toFixed(2)}`} />
               <ReportStat label="Net Yield" value={`$${totalProfit.toFixed(2)}`} color="text-primary" />
            </div>
          </div>

          <Tabs defaultValue="pipeline" onValueChange={setActiveTab} className="space-y-8">
            <TabsList className="bg-white/50 border p-1 rounded-2xl shadow-sm self-start">
              <TabsTrigger value="pipeline" className="rounded-xl px-8 gap-2 font-black">
                <Package className="w-4 h-4" /> Orders
              </TabsTrigger>
              <TabsTrigger value="catalog" className="rounded-xl px-8 gap-2 font-black">
                <ClipboardList className="w-4 h-4" /> Pricing
              </TabsTrigger>
              <TabsTrigger value="inventory" className="rounded-xl px-8 gap-2 font-black">
                <Layers className="w-4 h-4" /> Materials
              </TabsTrigger>
              <TabsTrigger value="profits" className="rounded-xl px-8 gap-2 font-black">
                <TrendingUp className="w-4 h-4" /> Analytics
              </TabsTrigger>
            </TabsList>

            <TabsContent value="pipeline" className="grid grid-cols-1 lg:grid-cols-3 gap-8">
               <PipelineColumn title="Pending" color="bg-orange-500" orders={pipeline.pending} onAction={(id) => handleUpdateStatus(id, 'in-progress')} actionLabel="Start Work" actionIcon={Play} />
               <PipelineColumn title="In-Progress" color="bg-primary" orders={pipeline.inProgress} onAction={(id) => handleUpdateStatus(id, 'completed')} actionLabel="Deliver" actionIcon={CheckCircle2} />
               <PipelineColumn title="Delivered" color="bg-green-600" orders={pipeline.completed} completed />
            </TabsContent>

            <TabsContent value="catalog" className="grid grid-cols-1 lg:grid-cols-4 gap-8">
               <Card className="lg:col-span-1 border-none shadow-sm rounded-3xl bg-white h-fit p-8">
                  <h3 className="text-xl font-black mb-6">Create Bundle</h3>
                  <form onSubmit={handleCreateBundle} className="space-y-4">
                    <Input name="name" placeholder="Bundle Name" required className="h-12 rounded-xl bg-secondary/10 border-none font-bold" />
                    <Input name="price" type="number" step="0.01" placeholder="Selling Price ($)" required className="h-12 rounded-xl bg-secondary/10 border-none font-bold" />
                    <Input name="profit" type="number" step="0.01" placeholder="Est. Profit ($)" required className="h-12 rounded-xl bg-secondary/10 border-none font-bold" />
                    <Button type="submit" className="w-full h-14 rounded-2xl font-black">Add Package</Button>
                  </form>
               </Card>

               <div className="lg:col-span-3 grid grid-cols-1 md:grid-cols-2 gap-6">
                  {bundles?.map(bundle => (
                    <Card key={bundle.id} className="border-none shadow-sm rounded-[32px] bg-white group hover:shadow-md transition-all">
                      <CardHeader className="p-8 pb-4 flex flex-row justify-between items-start">
                        <div>
                          <CardTitle className="text-xl font-black">{bundle.name}</CardTitle>
                          <p className="text-3xl font-black text-primary mt-2">${bundle.price.toFixed(2)}</p>
                        </div>
                        <Button variant="ghost" size="icon" onClick={async () => {
                          await deleteDoc(doc(firestore!, 'companies', user!.companyId!, 'serviceTypes', serviceId, 'priceBundles', bundle.id));
                        }} className="text-destructive opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 className="w-4 h-4" /></Button>
                      </CardHeader>
                      <CardContent className="p-8 pt-0">
                         <div className="p-4 bg-secondary/10 rounded-2xl mb-6">
                            <p className="text-[10px] font-black uppercase text-muted-foreground mb-1">Estimated Net Yield</p>
                            <p className="text-lg font-black text-foreground">${bundle.estimatedProfit.toFixed(2)}</p>
                         </div>
                         <form onSubmit={(e) => {
                           e.preventDefault();
                           const name = new FormData(e.currentTarget).get('customer') as string;
                           handlePlaceOrder(bundle, name);
                           (e.target as HTMLFormElement).reset();
                         }} className="flex gap-2">
                           <Input name="customer" placeholder="Customer Identity..." required className="h-12 rounded-xl bg-secondary/10 border-none text-xs font-bold px-4" />
                           <Button type="submit" className="h-12 rounded-xl font-black px-6">Log Sale</Button>
                         </form>
                      </CardContent>
                    </Card>
                  ))}
               </div>
            </TabsContent>

            <TabsContent value="inventory" className="grid grid-cols-1 lg:grid-cols-4 gap-8">
               <Card className="lg:col-span-1 border-none shadow-sm rounded-3xl bg-white h-fit p-8">
                  <h3 className="text-xl font-black mb-6">Add Material</h3>
                  <form onSubmit={handleAddMaterial} className="space-y-4">
                    <Input name="name" placeholder="Item Name" required className="h-12 rounded-xl bg-secondary/10 border-none font-bold" />
                    <div className="grid grid-cols-2 gap-2">
                      <Input name="stock" type="number" placeholder="Stock" required className="h-12 rounded-xl bg-secondary/10 border-none font-bold" />
                      <Input name="unit" placeholder="Unit (pc)" required className="h-12 rounded-xl bg-secondary/10 border-none font-bold" />
                    </div>
                    <Input name="cost" type="number" step="0.01" placeholder="Cost per Unit ($)" required className="h-12 rounded-xl bg-secondary/10 border-none font-bold" />
                    <Button type="submit" className="w-full h-14 rounded-2xl font-black shadow-lg">Register Stock</Button>
                  </form>
               </Card>

               <div className="lg:col-span-3">
                  <div className="bg-white rounded-[32px] border shadow-sm overflow-hidden">
                    <table className="w-full text-sm text-left">
                      <thead className="bg-secondary/10 border-b">
                        <tr>
                          <th className="p-6 font-black uppercase text-[10px] tracking-widest text-muted-foreground">Material Identity</th>
                          <th className="p-6 font-black uppercase text-[10px] tracking-widest text-muted-foreground">Current Stock</th>
                          <th className="p-6 font-black uppercase text-[10px] tracking-widest text-muted-foreground">Inventory Value</th>
                          <th className="p-6 text-center font-black uppercase text-[10px] tracking-widest text-muted-foreground">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {materials?.map(m => (
                          <tr key={m.id} className="hover:bg-secondary/5 transition-colors">
                            <td className="p-6 font-black text-lg">{m.name}</td>
                            <td className="p-6">
                               <Badge variant={m.stock < 10 ? "destructive" : "secondary"} className="font-black px-3 rounded-lg">{m.stock} {m.unit}</Badge>
                            </td>
                            <td className="p-6 font-black text-primary text-lg">${(m.stock * m.costPrice).toFixed(2)}</td>
                            <td className="p-6 text-center">
                               <Button variant="ghost" size="icon" onClick={async () => {
                                 await deleteDoc(doc(firestore!, 'companies', user!.companyId!, 'products', m.id));
                               }} className="text-destructive"><Trash2 className="w-4 h-4" /></Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
               </div>
            </TabsContent>

            <TabsContent value="profits" className="space-y-8">
               <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <Card className="p-10 border-none shadow-sm bg-white rounded-[40px] relative overflow-hidden">
                     <div className="absolute top-0 right-0 p-8 opacity-5"><TrendingUp className="w-20 h-24" /></div>
                     <p className="text-[10px] font-black uppercase text-muted-foreground mb-2 tracking-widest leading-none">Aggregate Revenue</p>
                     <h4 className="text-5xl font-black tracking-tighter text-foreground">${totalRevenue.toFixed(2)}</h4>
                  </Card>
                  <Card className="p-10 border-none shadow-sm bg-white rounded-[40px] relative overflow-hidden">
                     <div className="absolute top-0 right-0 p-8 opacity-5"><ShieldCheck className="w-20 h-24" /></div>
                     <p className="text-[10px] font-black uppercase text-muted-foreground mb-2 tracking-widest leading-none">Net Segment Yield</p>
                     <h4 className="text-5xl font-black tracking-tighter text-primary">${totalProfit.toFixed(2)}</h4>
                  </Card>
                  <Card className="p-10 border-none shadow-sm bg-primary text-primary-foreground rounded-[40px] relative overflow-hidden">
                     <div className="absolute top-0 right-0 p-8 opacity-10"><Zap className="w-20 h-24" /></div>
                     <p className="text-[10px] font-black uppercase opacity-60 mb-2 tracking-widest leading-none">Pipeline Efficiency</p>
                     <h4 className="text-5xl font-black tracking-tighter">100%</h4>
                  </Card>
               </div>

               <Card className="border-none shadow-sm p-10 bg-white rounded-[40px]">
                  <CardHeader className="px-0 pt-0 mb-8 flex flex-row justify-between items-end">
                    <div>
                      <CardTitle className="text-2xl font-black">Growth Trajectory</CardTitle>
                      <CardDescription className="font-bold">Daily financial performance for {serviceType?.name}</CardDescription>
                    </div>
                    <div className="flex items-center gap-4 text-[10px] font-black uppercase tracking-widest">
                       <div className="flex items-center gap-2"><div className="w-3 h-3 bg-primary rounded-full" /> Revenue</div>
                       <div className="flex items-center gap-2"><div className="w-3 h-3 bg-secondary rounded-full" /> Profit</div>
                    </div>
                  </CardHeader>
                  <div className="h-[400px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={[]}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                        <XAxis dataKey="date" axisLine={false} tickLine={false} />
                        <YAxis axisLine={false} tickLine={false} />
                        <Tooltip />
                        <Area type="monotone" dataKey="revenue" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.1} strokeWidth={4} />
                      </AreaChart>
                    </ResponsiveContainer>
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-20">
                       <p className="font-black text-sm uppercase tracking-widest">Awaiting significant data volume...</p>
                    </div>
                  </div>
               </Card>
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
}

function PipelineColumn({ title, color, orders, onAction, actionLabel, actionIcon: Icon, completed }: any) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between px-2">
        <h3 className="text-xs font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
          <div className={cn("w-2.5 h-2.5 rounded-full animate-pulse", color)} /> {title}
        </h3>
        <Badge variant="secondary" className="font-black text-[10px] px-2">{orders.length}</Badge>
      </div>
      <div className="space-y-4">
        {orders.map((order: any) => (
          <Card key={order.id} className={cn(
            "border-none shadow-sm rounded-[28px] overflow-hidden group hover:shadow-md transition-all",
            completed ? "bg-green-50/30" : "bg-white"
          )}>
            <CardContent className="p-6">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <p className="font-black text-foreground text-lg leading-tight">{order.items[0].name}</p>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-1">{order.customerName}</p>
                </div>
                <p className="font-black text-primary text-xl">${order.totalAmount.toFixed(2)}</p>
              </div>
              {!completed && (
                <Button onClick={() => onAction(order.id)} className="w-full h-12 rounded-xl font-black gap-2 text-xs shadow-lg">
                  <Icon className="w-4 h-4" /> {actionLabel}
                </Button>
              )}
              {completed && (
                <div className="flex items-center gap-2 text-[10px] font-black text-green-600 uppercase tracking-widest">
                  <CheckCircle2 className="w-4 h-4" /> Order Fulfilled
                </div>
              )}
            </CardContent>
          </Card>
        ))}
        {orders.length === 0 && (
          <div className="py-12 text-center border-2 border-dashed rounded-[32px] bg-secondary/5 opacity-30">
            <p className="text-[10px] font-black uppercase tracking-widest">Queue Empty</p>
          </div>
        )}
      </div>
    </div>
  );
}

function ReportStat({ label, value, color = "text-foreground" }: any) {
  return (
    <Card className="border-none shadow-sm p-4 px-6 bg-white rounded-2xl h-fit">
       <p className="text-[9px] font-black uppercase text-muted-foreground mb-1 tracking-widest leading-none">{label}</p>
       <h4 className={cn("text-xl font-black tracking-tighter", color)}>{value}</h4>
    </Card>
  );
}
