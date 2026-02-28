
'use client';

import { use, useEffect } from 'react';
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
  Play, 
  Package, 
  ChevronLeft,
  TrendingUp,
  Layers,
  ArrowRight,
  ShieldCheck,
  Zap,
  QrCode,
  Upload,
  Settings2,
  CreditCard,
  Banknote,
  User,
  Building2,
  Calculator,
  RefreshCw,
  ShoppingCart,
  Minus,
  AlertCircle,
  Info,
  BarChart3,
  DollarSign
} from 'lucide-react';
import { useAuth } from '@/components/auth-context';
import { useFirestore, useCollection, useMemoFirebase, useDoc } from '@/firebase';
import { collection, doc, setDoc, updateDoc, query, where, addDoc, increment, deleteDoc } from 'firebase/firestore';
import { useState, useMemo } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ServiceType, ServicePriceBundle, SaleTransaction, Product, PaymentMethod } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import Image from 'next/image';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';

const UNITS = ['pc', 'ml', 'litre', 'mm', 'cm', 'meter', 'kg', 'g', 'set'];

export default function ServiceDashboardPage({ params }: { params: Promise<{ serviceId: string }> }) {
  const { serviceId } = use(params);
  const { user } = useAuth();
  const firestore = useFirestore();
  const { toast } = useToast();
  
  const [activeTab, setActiveTab] = useState('pipeline');

  // Material Form State
  const [matQuantity, setMatQuantity] = useState<string>('1');
  const [matMeasure, setMatMeasure] = useState<string>('');
  const [matUnit, setMatUnit] = useState<string>('pc');
  const [matCostPerItem, setMatCostPerItem] = useState<string>('');

  // Start Service Workflow State
  const [isStartWorkOpen, setIsStartWorkOpen] = useState(false);
  const [activeOrderId, setActiveOrderId] = useState<string | null>(null);
  const [selectedMaterials, setSelectedMaterials] = useState<{ product: Product, qty: number }[]>([]);
  const [selectedMartItems, setSelectedMartItems] = useState<{ product: Product, qty: number }[]>([]);
  const [materialSearch, setMaterialSearch] = useState('');
  const [martSearch, setMartSearch] = useState('');

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

  const allProductsQuery = useMemoFirebase(() => {
    if (!firestore || !user?.companyId) return null;
    return collection(firestore, 'companies', user.companyId, 'products');
  }, [firestore, user?.companyId]);

  const configRef = useMemoFirebase(() => (!firestore ? null : doc(firestore, 'platform_config', 'localization')), [firestore]);
  const { data: platformConfig } = useDoc<any>(configRef);
  const currencySymbol = platformConfig?.currencySymbol || '$';

  const { data: serviceType } = useDoc<ServiceType>(serviceRef);
  const { data: bundles } = useCollection<ServicePriceBundle>(bundlesQuery);
  const { data: transactions } = useCollection<SaleTransaction>(transactionsQuery);
  const { data: allProducts } = useCollection<Product>(allProductsQuery);

  const materials = allProducts?.filter(p => p.serviceTypeId === serviceId) || [];
  const martProducts = allProducts?.filter(p => !p.serviceTypeId) || [];

  const pipeline = {
    pending: transactions?.filter(t => t.status === 'pending') || [],
    inProgress: transactions?.filter(t => t.status === 'in-progress') || [],
    completed: transactions?.filter(t => t.status === 'completed') || []
  };

  const activeOrder = transactions?.find(t => t.id === activeOrderId);

  // Handlers
  const handleOpenStartWork = (orderId: string) => {
    setActiveOrderId(orderId);
    setSelectedMaterials([]);
    setSelectedMartItems([]);
    setIsStartWorkOpen(true);
  };

  const handleConfirmStartWork = async () => {
    if (!firestore || !user?.companyId || !activeOrder) return;

    const totalMartSellingPrice = selectedMartItems.reduce((acc, item) => acc + (item.product.sellingPrice * item.qty), 0);
    const totalMaterialCost = selectedMaterials.reduce((acc, item) => acc + (item.product.costPrice * item.qty), 0);
    const totalMartCost = selectedMartItems.reduce((acc, item) => acc + (item.product.costPrice * item.qty), 0);

    const serviceRevenue = Math.max(0, activeOrder.totalAmount - totalMartSellingPrice);
    const martRevenue = totalMartSellingPrice;
    const netProfit = (serviceRevenue - totalMaterialCost) + (martRevenue - totalMartCost);
    const totalResourceCost = totalMaterialCost + totalMartCost;

    const orderRef = doc(firestore, 'companies', user.companyId, 'transactions', activeOrder.id);
    const updateData = {
      status: 'in-progress',
      profit: netProfit,
      totalCost: totalResourceCost,
      items: [
        ...activeOrder.items,
        ...selectedMaterials.map(m => ({ name: `[MAT] ${m.product.name}`, price: 0, quantity: m.qty, cost: m.product.costPrice })),
        ...selectedMartItems.map(m => ({ name: `[MART] ${m.product.name}`, price: m.product.sellingPrice, quantity: m.qty, cost: m.product.costPrice }))
      ]
    };

    try {
      await updateDoc(orderRef, updateData);

      for (const mat of selectedMaterials) {
        await updateDoc(doc(firestore, 'companies', user.companyId, 'products', mat.product.id), { stock: increment(-mat.qty) });
      }
      for (const martItem of selectedMartItems) {
        await updateDoc(doc(firestore, 'companies', user.companyId, 'products', martItem.product.id), { stock: increment(-martItem.qty) });
      }

      toast({ title: "Work Commenced", description: "Materials committed and work logged." });
      setIsStartWorkOpen(false);
    } catch (err: any) {
      toast({ title: "Operation failed", variant: "destructive" });
    }
  };

  const handleUpdateStatus = (id: string, newStatus: string) => {
    if (!firestore || !user?.companyId) return;
    const docRef = doc(firestore, 'companies', user.companyId, 'transactions', id);
    updateDoc(docRef, { status: newStatus });
    toast({ title: "Pipeline Updated" });
  };

  const handleCancelOrder = (id: string) => {
    if (!firestore || !user?.companyId) return;
    if (!confirm("Cancel this booking?")) return;
    deleteDoc(doc(firestore, 'companies', user.companyId, 'transactions', id));
    toast({ title: "Order Cancelled" });
  };

  const handleCreateBundle = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!firestore || !user?.companyId) return;
    const formData = new FormData(e.currentTarget);
    const bundleId = crypto.randomUUID();
    const newBundle = { 
      id: bundleId, 
      serviceTypeId: serviceId, 
      companyId: user.companyId, 
      name: formData.get('name') as string, 
      price: Number(formData.get('price')), 
      estimatedProfit: Number(formData.get('profit')) 
    };
    await setDoc(doc(firestore, 'companies', user.companyId, 'serviceTypes', serviceId, 'priceBundles', bundleId), newBundle);
    toast({ title: "Package Added" });
    (e.target as HTMLFormElement).reset();
  };

  const handleAddMaterial = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!firestore || !user?.companyId) return;
    const formData = new FormData(e.currentTarget);
    const id = crypto.randomUUID();
    const qty = Number(matQuantity);
    const measure = Number(matMeasure) || 1;
    const costPerItem = Number(matCostPerItem);
    const totalVolume = qty * measure;
    const totalExpenditure = qty * costPerItem;
    
    const material: Product = { 
      id, 
      companyId: user.companyId, 
      serviceTypeId: serviceId, 
      name: formData.get('name') as string, 
      costPrice: totalExpenditure / totalVolume, 
      sellingPrice: (totalExpenditure / totalVolume) * 1.5, 
      stock: totalVolume, 
      unit: matUnit 
    };

    await setDoc(doc(firestore, 'companies', user.companyId, 'products', id), material);
    await addDoc(collection(firestore, 'companies', user.companyId, 'purchases'), { 
      id: crypto.randomUUID(), 
      companyId: user.companyId, 
      amount: totalExpenditure, 
      description: `Replenishment: ${material.name}`, 
      timestamp: new Date().toISOString() 
    });
    
    toast({ title: "Inventory Updated" });
    (e.target as HTMLFormElement).reset();
    setMatMeasure('');
    setMatCostPerItem('');
  };

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
               <ReportStat label="Segment Revenue" value={`${currencySymbol}${totalRevenue.toFixed(2)}`} />
               <ReportStat label="Net Yield" value={`${currencySymbol}${totalProfit.toFixed(2)}`} color="text-primary" />
               <Button asChild className="rounded-2xl h-14 px-8 font-black text-lg shadow-xl gap-2 bg-primary">
                 <Link href={`/company/services/${serviceId}/book`}><Plus className="w-5 h-5" /> New Booking</Link>
               </Button>
            </div>
          </div>

          <Tabs defaultValue="pipeline" onValueChange={setActiveTab} className="space-y-8">
            <TabsList className="bg-white/50 border p-1 rounded-2xl shadow-sm self-start">
              <TabsTrigger value="pipeline" className="rounded-xl px-8 gap-2 font-black"><Package className="w-4 h-4" /> Pipeline</TabsTrigger>
              <TabsTrigger value="catalog" className="rounded-xl px-8 gap-2 font-black"><ClipboardList className="w-4 h-4" /> Price Catalog</TabsTrigger>
              <TabsTrigger value="inventory" className="rounded-xl px-8 gap-2 font-black"><Layers className="w-4 h-4" /> Inventory</TabsTrigger>
              <TabsTrigger value="profits" className="rounded-xl px-8 gap-2 font-black"><TrendingUp className="w-4 h-4" /> Analytics</TabsTrigger>
              <TabsTrigger value="billing" className="rounded-xl px-8 gap-2 font-black"><Settings2 className="w-4 h-4" /> Billing</TabsTrigger>
            </TabsList>

            <TabsContent value="pipeline" className="grid grid-cols-1 lg:grid-cols-3 gap-8">
               <PipelineColumn title="Pending Queue" color="bg-orange-500" orders={pipeline.pending} onAction={(id) => handleOpenStartWork(id)} actionLabel="Start Work" actionIcon={Play} onCancel={handleCancelOrder} />
               <PipelineColumn title="Production" color="bg-primary" orders={pipeline.inProgress} onAction={(id) => handleUpdateStatus(id, 'completed')} actionLabel="Finish Service" actionIcon={CheckCircle2} onCancel={handleCancelOrder} />
               <PipelineColumn title="Delivered" color="bg-green-600" orders={pipeline.completed} completed onCancel={handleCancelOrder} />
            </TabsContent>

            <TabsContent value="catalog" className="grid grid-cols-1 lg:grid-cols-4 gap-8">
               <div className="lg:col-span-1">
                  <Card className="border-none shadow-sm rounded-[32px] bg-white p-8 sticky top-8">
                     <h3 className="text-xl font-black mb-6">Add Bundle</h3>
                     <form onSubmit={handleCreateBundle} className="space-y-4">
                        <div className="space-y-1.5">
                           <Label className="text-[10px] font-black uppercase text-muted-foreground px-1">Package Name</Label>
                           <Input name="name" placeholder="Full Service" required className="h-12 rounded-xl bg-secondary/10 border-none font-bold" />
                        </div>
                        <div className="space-y-1.5">
                           <Label className="text-[10px] font-black uppercase text-muted-foreground px-1">Selling Price ({currencySymbol})</Label>
                           <Input name="price" type="number" step="0.01" required className="h-12 rounded-xl bg-secondary/10 border-none font-bold" />
                        </div>
                        <div className="space-y-1.5">
                           <Label className="text-[10px] font-black uppercase text-muted-foreground px-1">Target Profit ($)</Label>
                           <Input name="profit" type="number" step="0.01" required className="h-12 rounded-xl bg-secondary/10 border-none font-bold text-primary" />
                        </div>
                        <Button type="submit" className="w-full h-12 rounded-xl font-black shadow-lg">Save Package</Button>
                     </form>
                  </Card>
               </div>
               <div className="lg:col-span-3">
                  <div className="bg-white rounded-[32px] border shadow-sm overflow-hidden">
                     <table className="w-full text-sm text-left">
                        <thead className="bg-secondary/20">
                           <tr>
                              <th className="p-6 font-black uppercase text-[10px]">Service Package</th>
                              <th className="p-6 font-black uppercase text-[10px]">Standard Price</th>
                              <th className="p-6 font-black uppercase text-[10px]">Target Margin</th>
                              <th className="p-6 text-center font-black uppercase text-[10px]">Action</th>
                           </tr>
                        </thead>
                        <tbody className="divide-y">
                           {bundles?.map(bundle => (
                             <tr key={bundle.id} className="hover:bg-secondary/5 group">
                                <td className="p-6 font-black text-lg">{bundle.name}</td>
                                <td className="p-6 font-black text-foreground">{currencySymbol}{bundle.price.toFixed(2)}</td>
                                <td className="p-6 font-black text-primary">{currencySymbol}{bundle.estimatedProfit.toFixed(2)}</td>
                                <td className="p-6 text-center">
                                   <Button variant="ghost" size="icon" className="text-destructive opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => deleteDoc(doc(firestore!, 'companies', user!.companyId!, 'serviceTypes', serviceId, 'priceBundles', bundle.id))}><Trash2 className="w-4 h-4" /></Button>
                                </td>
                             </tr>
                           ))}
                        </tbody>
                     </table>
                  </div>
               </div>
            </TabsContent>

            <TabsContent value="inventory" className="grid grid-cols-1 lg:grid-cols-4 gap-8">
               <div className="lg:col-span-1">
                  <Card className="border-none shadow-sm rounded-[32px] bg-white p-8 sticky top-8">
                     <h3 className="text-xl font-black mb-6">Replenish Materials</h3>
                     <form onSubmit={handleAddMaterial} className="space-y-4">
                        <div className="space-y-1.5">
                           <Label className="text-[10px] font-black uppercase text-muted-foreground px-1">Material Name</Label>
                           <Input name="name" placeholder="Thermal Paste" required className="h-12 rounded-xl bg-secondary/10 border-none font-bold" />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                           <div className="space-y-1.5">
                              <Label className="text-[10px] font-black uppercase text-muted-foreground px-1">Qty Bought</Label>
                              <Input type="number" value={matQuantity} onChange={(e) => setMatQuantity(e.target.value)} className="h-12 rounded-xl bg-secondary/10 border-none font-bold" />
                           </div>
                           <div className="space-y-1.5">
                              <Label className="text-[10px] font-black uppercase text-muted-foreground px-1">Measure/Item</Label>
                              <Input type="number" value={matMeasure} onChange={(e) => setMatMeasure(e.target.value)} placeholder="1.0" className="h-12 rounded-xl bg-secondary/10 border-none font-bold" />
                           </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                           <div className="space-y-1.5">
                              <Label className="text-[10px] font-black uppercase text-muted-foreground px-1">Unit</Label>
                              <Select value={matUnit} onValueChange={setMatUnit}>
                                 <SelectTrigger className="h-12 rounded-xl bg-secondary/10 border-none font-bold"><SelectValue /></SelectTrigger>
                                 <SelectContent className="rounded-xl font-bold">{UNITS.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
                              </Select>
                           </div>
                           <div className="space-y-1.5">
                              <Label className="text-[10px] font-black uppercase text-muted-foreground px-1">Cost/Item ($)</Label>
                              <Input type="number" step="0.01" value={matCostPerItem} onChange={(e) => setMatCostPerItem(e.target.value)} className="h-12 rounded-xl bg-secondary/10 border-none font-bold" />
                           </div>
                        </div>
                        <Button type="submit" className="w-full h-12 rounded-xl font-black shadow-lg">Log Material</Button>
                     </form>
                  </Card>
               </div>
               <div className="lg:col-span-3">
                  <div className="bg-white rounded-[32px] border shadow-sm overflow-hidden">
                     <table className="w-full text-sm text-left">
                        <thead className="bg-secondary/20">
                           <tr>
                              <th className="p-6 font-black uppercase text-[10px]">Material / Resource</th>
                              <th className="p-6 font-black uppercase text-[10px]">Active Stock</th>
                              <th className="p-6 font-black uppercase text-[10px]">Avg Cost</th>
                              <th className="p-6 text-center font-black uppercase text-[10px]">Action</th>
                           </tr>
                        </thead>
                        <tbody className="divide-y">
                           {materials?.map(mat => (
                             <tr key={mat.id} className="hover:bg-secondary/5 group">
                                <td className="p-6 font-black text-lg">{mat.name}</td>
                                <td className="p-6"><Badge variant="secondary" className="font-bold">{mat.stock.toFixed(1)} {mat.unit}</Badge></td>
                                <td className="p-6 font-black text-primary">{currencySymbol}{mat.costPrice.toFixed(4)}/{mat.unit}</td>
                                <td className="p-6 text-center">
                                   <Button variant="ghost" size="icon" className="text-destructive opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => deleteDoc(doc(firestore!, 'companies', user!.companyId!, 'products', mat.id))}><Trash2 className="w-4 h-4" /></Button>
                                </td>
                             </tr>
                           ))}
                        </tbody>
                     </table>
                  </div>
               </div>
            </TabsContent>

            <TabsContent value="profits">
               <ServiceAnalytics transactions={transactions || []} currencySymbol={currencySymbol} />
            </TabsContent>

            <TabsContent value="billing">
               <div className="max-w-xl mx-auto py-12 text-center space-y-8">
                  <Card className="border-none shadow-sm rounded-[40px] bg-white p-12 space-y-8">
                     <div className="w-20 h-20 bg-primary/10 rounded-3xl flex items-center justify-center text-primary mx-auto"><QrCode className="w-10 h-10" /></div>
                     <h2 className="text-3xl font-black">Departmental Gateway</h2>
                     <p className="text-muted-foreground font-medium">Configure the DuitNow QR specifically for {serviceType?.name} settlements.</p>
                     {serviceType?.duitNowQr ? (
                       <div className="relative group w-fit mx-auto">
                          <Image src={serviceType.duitNowQr} alt="QR" width={200} height={200} className="rounded-3xl border-4" />
                          <label className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center rounded-3xl cursor-pointer transition-opacity">
                             <Upload className="text-white w-8 h-8" />
                             <input type="file" className="hidden" accept="image/*" onChange={async (e) => {
                                const file = e.target.files?.[0];
                                if(!file || !firestore || !user?.companyId) return;
                                const reader = new FileReader();
                                reader.onloadend = () => updateDoc(doc(firestore, 'companies', user.companyId!, 'serviceTypes', serviceId), { duitNowQr: reader.result as string });
                                reader.readAsDataURL(file);
                             }} />
                          </label>
                       </div>
                     ) : (
                       <label className="w-full h-64 border-4 border-dashed rounded-[40px] flex flex-col items-center justify-center cursor-pointer hover:bg-secondary/20 transition-all gap-4 border-secondary opacity-30">
                          <Plus className="w-10 h-10 text-primary" />
                          <p className="text-xs font-black uppercase tracking-widest">Upload Department QR</p>
                          <input type="file" className="hidden" accept="image/*" onChange={async (e) => {
                             const file = e.target.files?.[0];
                             if(!file || !firestore || !user?.companyId) return;
                             const reader = new FileReader();
                             reader.onloadend = () => updateDoc(doc(firestore, 'companies', user.companyId!, 'serviceTypes', serviceId), { duitNowQr: reader.result as string });
                             reader.readAsDataURL(file);
                          }} />
                       </label>
                     )}
                  </Card>
               </div>
            </TabsContent>
          </Tabs>
        </div>
      </main>

      {/* Start Service Workflow Dialog */}
      <Dialog open={isStartWorkOpen} onOpenChange={setIsStartWorkOpen}>
        <DialogContent className="rounded-[40px] max-w-4xl p-0 overflow-hidden bg-white border-none shadow-2xl">
          <div className="bg-primary p-10 text-primary-foreground">
             <div className="flex justify-between items-start">
                <div>
                   <p className="text-[10px] font-black uppercase tracking-widest opacity-80 mb-1">Production Command</p>
                   <DialogTitle className="text-3xl font-black tracking-tight">Configure Work Logistics</DialogTitle>
                   <p className="text-sm font-bold opacity-70 mt-1">{activeOrder?.customerName} • {activeOrder?.items[0].name}</p>
                </div>
                <div className="bg-black/10 px-6 py-3 rounded-2xl text-right backdrop-blur-md">
                   <p className="text-[10px] font-black uppercase opacity-60">Bundle Value</p>
                   <p className="text-3xl font-black">{currencySymbol}{activeOrder?.totalAmount.toFixed(2)}</p>
                </div>
             </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 divide-x h-[600px]">
             {/* Left: Product Selector */}
             <div className="flex flex-col p-8 overflow-hidden">
                <Tabs defaultValue="materials" className="flex-1 flex flex-col overflow-hidden">
                   <TabsList className="bg-secondary/20 p-1 rounded-xl mb-6">
                      <TabsTrigger value="materials" className="flex-1 rounded-lg font-black text-xs gap-2"><Layers className="w-3 h-3" /> Service Materials</TabsTrigger>
                      <TabsTrigger value="mart" className="flex-1 rounded-lg font-black text-xs gap-2"><ShoppingCart className="w-3 h-3" /> Mart Inventory</TabsTrigger>
                   </TabsList>
                   <TabsContent value="materials" className="flex-1 flex flex-col overflow-hidden m-0">
                      <div className="relative mb-4"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" /><Input placeholder="Search Materials..." className="pl-10 h-10 rounded-xl bg-secondary/10 border-none font-bold text-xs" value={materialSearch} onChange={(e) => setMaterialSearch(e.target.value)}/></div>
                      <div className="flex-1 overflow-auto space-y-2">
                         {materials.filter(m => m.name.toLowerCase().includes(materialSearch.toLowerCase())).map(m => (
                           <ProductSelectorCard key={m.id} product={m} currencySymbol={currencySymbol} onAdd={() => {
                                const existing = selectedMaterials.find(item => item.product.id === m.id);
                                if (existing) setSelectedMaterials(selectedMaterials.map(item => item.product.id === m.id ? { ...item, qty: item.qty + 1 } : item));
                                else setSelectedMaterials([...selectedMaterials, { product: m, qty: 1 }]);
                             }}
                           />
                         ))}
                      </div>
                   </TabsContent>
                   <TabsContent value="mart" className="flex-1 flex flex-col overflow-hidden m-0">
                      <div className="relative mb-4"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" /><Input placeholder="Search Mart Products..." className="pl-10 h-10 rounded-xl bg-secondary/10 border-none font-bold text-xs" value={martSearch} onChange={(e) => setMartSearch(e.target.value)}/></div>
                      <div className="flex-1 overflow-auto space-y-2">
                         {martProducts.filter(m => m.name.toLowerCase().includes(martSearch.toLowerCase())).map(m => (
                           <ProductSelectorCard key={m.id} product={m} isMart currencySymbol={currencySymbol} onAdd={() => {
                                const existing = selectedMartItems.find(item => item.product.id === m.id);
                                if (existing) setSelectedMartItems(selectedMartItems.map(item => item.product.id === m.id ? { ...item, qty: item.qty + 1 } : item));
                                else setSelectedMartItems([...selectedMartItems, { product: m, qty: 1 }]);
                             }}
                           />
                         ))}
                      </div>
                   </TabsContent>
                </Tabs>
             </div>
             {/* Right: Consumption Summary */}
             <div className="flex flex-col p-8 bg-secondary/5 overflow-hidden">
                <h4 className="text-[10px] font-black uppercase text-muted-foreground mb-4">Resource Consumption</h4>
                <div className="flex-1 overflow-auto space-y-4">
                   {selectedMaterials.map(item => <SelectedConsumptionRow key={item.product.id} item={item} currencySymbol={currencySymbol} onUpdate={(qty) => {
                       if (qty <= 0) setSelectedMaterials(selectedMaterials.filter(i => i.product.id !== item.product.id));
                       else setSelectedMaterials(selectedMaterials.map(i => i.product.id === item.product.id ? { ...i, qty } : i));
                   }} />)}
                   {selectedMartItems.map(item => <SelectedConsumptionRow key={item.product.id} item={item} isMart currencySymbol={currencySymbol} onUpdate={(qty) => {
                       if (qty <= 0) setSelectedMartItems(selectedMartItems.filter(i => i.product.id !== item.product.id));
                       else setSelectedMartItems(selectedMartItems.map(i => i.product.id === item.product.id ? { ...i, qty } : i));
                   }} />)}
                   {(selectedMaterials.length === 0 && selectedMartItems.length === 0) && (
                     <div className="h-full flex flex-col items-center justify-center opacity-20 text-center">
                        <Package className="w-12 h-12 mb-2" />
                        <p className="text-xs font-black uppercase">No Resources Added</p>
                     </div>
                   )}
                </div>
                <div className="mt-6 border-t pt-6">
                   <div className="flex justify-between items-end mb-6">
                      <p className="text-[10px] font-black uppercase text-muted-foreground">Resource Liability</p>
                      <p className="text-2xl font-black text-primary">
                        {currencySymbol}{(
                          selectedMaterials.reduce((acc, i) => acc + (i.product.costPrice * i.qty), 0) + 
                          selectedMartItems.reduce((acc, i) => acc + (i.product.costPrice * i.qty), 0)
                        ).toFixed(2)}
                      </p>
                   </div>
                   <Button className="w-full h-16 rounded-2xl font-black text-lg shadow-xl" onClick={handleConfirmStartWork} disabled={selectedMaterials.length === 0 && selectedMartItems.length === 0}>Commit Materials & Start Service</Button>
                </div>
             </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ServiceAnalytics({ transactions, currencySymbol }: { transactions: SaleTransaction[], currencySymbol: string }) {
  const chartData = useMemo(() => {
    const daily: Record<string, { date: string, revenue: number, profit: number }> = {};
    transactions.forEach(t => {
      const day = new Date(t.timestamp).toLocaleDateString([], { weekday: 'short' });
      if (!daily[day]) daily[day] = { date: day, revenue: 0, profit: 0 };
      daily[day].revenue += t.totalAmount;
      daily[day].profit += t.profit;
    });
    return Object.values(daily).slice(-7);
  }, [transactions]);

  const totalRevenue = transactions.reduce((acc, t) => acc + t.totalAmount, 0);
  const totalProfit = transactions.reduce((acc, t) => acc + t.profit, 0);

  return (
    <div className="space-y-8">
       <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="border-none shadow-sm p-8 bg-white rounded-[32px]">
             <p className="text-[10px] font-black uppercase text-muted-foreground mb-2 tracking-widest leading-none">Gross Department Revenue</p>
             <h4 className="text-4xl font-black tracking-tighter">{currencySymbol}{totalRevenue.toFixed(2)}</h4>
          </Card>
          <Card className="border-none shadow-sm p-8 bg-white rounded-[32px]">
             <p className="text-[10px] font-black uppercase text-muted-foreground mb-2 tracking-widest leading-none">Net Realized Margin</p>
             <h4 className="text-4xl font-black tracking-tighter text-primary">{currencySymbol}{totalProfit.toFixed(2)}</h4>
          </Card>
          <Card className="border-none shadow-sm p-8 bg-white rounded-[32px]">
             <p className="text-[10px] font-black uppercase text-muted-foreground mb-2 tracking-widest leading-none">Departmental Yield</p>
             <h4 className="text-4xl font-black tracking-tighter">{((totalProfit / (totalRevenue || 1)) * 100).toFixed(1)}%</h4>
          </Card>
       </div>

       <Card className="border-none shadow-sm p-10 bg-white rounded-[40px]">
          <CardHeader className="px-0 pt-0 mb-8"><CardTitle className="text-2xl font-black">Segment Trajectory (7 Days)</CardTitle></CardHeader>
          <div className="h-[350px]">
             <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                   <defs>
                      <linearGradient id="colorRev" x1="0" x2="0" y2="1"><stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/><stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/></linearGradient>
                   </defs>
                   <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                   <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontWeight: 700, fontSize: 10 }} />
                   <YAxis axisLine={false} tickLine={false} tick={{ fontWeight: 700, fontSize: 10 }} />
                   <Tooltip contentStyle={{ borderRadius: '24px', border: 'none', boxShadow: '0 20px 50px rgba(0,0,0,0.1)' }} />
                   <Area type="monotone" dataKey="revenue" stroke="hsl(var(--primary))" fillOpacity={1} fill="url(#colorRev)" strokeWidth={4} name="Revenue" />
                   <Area type="monotone" dataKey="profit" stroke="hsl(var(--secondary))" fillOpacity={0} strokeWidth={4} strokeDasharray="5 5" name="Profit" />
                </AreaChart>
             </ResponsiveContainer>
          </div>
       </Card>
    </div>
  );
}

function ProductSelectorCard({ product, onAdd, isMart, currencySymbol }: any) {
  return (
    <Card className="border-none shadow-sm bg-white p-4 group hover:shadow-md transition-all cursor-pointer" onClick={onAdd}>
       <div className="flex justify-between items-start">
          <div className="flex-1">
             <p className="font-black text-xs text-foreground leading-tight">{product.name}</p>
             <p className="text-[9px] font-bold text-muted-foreground uppercase mt-1">Stock: {product.stock.toFixed(1)} {product.unit} • {isMart ? `Price: ${currencySymbol}${product.sellingPrice.toFixed(2)}` : `Cost: ${currencySymbol}${product.costPrice.toFixed(2)}`}</p>
          </div>
          <div className="w-8 h-8 bg-secondary rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"><Plus className="w-4 h-4 text-primary" /></div>
       </div>
    </Card>
  );
}

function SelectedConsumptionRow({ item, onUpdate, isMart, currencySymbol }: any) {
  return (
    <div className="bg-white rounded-xl p-3 shadow-sm border flex items-center justify-between">
       <div className="flex-1 min-w-0 pr-4">
          <p className="text-[11px] font-black truncate">{item.product.name}</p>
          <p className="text-[9px] font-bold text-muted-foreground uppercase">{isMart ? `Buy-In Price: ${currencySymbol}${(item.product.sellingPrice * item.qty).toFixed(2)}` : `Internal Cost: ${currencySymbol}${(item.product.costPrice * item.qty).toFixed(2)}`}</p>
       </div>
       <div className="flex items-center gap-3 bg-secondary/20 p-1 rounded-lg">
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => onUpdate(item.qty - 1)}><Minus className="w-3 h-3" /></Button>
          <span className="text-xs font-black w-4 text-center">{item.qty}</span>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => onUpdate(item.qty + 1)}><Plus className="w-3 h-3" /></Button>
       </div>
    </div>
  );
}

function PipelineColumn({ title, color, orders, onAction, actionLabel, actionIcon: Icon, completed, onCancel }: any) {
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
          <Card key={order.id} className={cn("border-none shadow-sm rounded-[28px] overflow-hidden group hover:shadow-md transition-all relative", completed ? "bg-green-50/30" : "bg-white")}>
            <div className="absolute top-4 right-4 z-10">
              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => onCancel(order.id)}><Trash2 className="w-4 h-4" /></Button>
            </div>
            <CardContent className="p-6 pt-10">
              <div className="flex justify-between items-start mb-4">
                <div><p className="font-black text-foreground text-lg leading-tight pr-8">{order.items[0].name}</p><p className="text-[10px] font-bold text-muted-foreground uppercase mt-1">{order.customerName}</p></div>
                <p className="font-black text-primary text-xl">${order.totalAmount.toFixed(2)}</p>
              </div>
              {!completed && <Button onClick={() => onAction(order.id)} className="w-full h-12 rounded-xl font-black gap-2 text-xs shadow-lg"><Icon className="w-4 h-4" /> {actionLabel}</Button>}
              {completed && <div className="flex items-center gap-2 text-[10px] font-black text-green-600 uppercase tracking-widest"><CheckCircle2 className="w-4 h-4" /> Order Fulfilled</div>}
            </CardContent>
          </Card>
        ))}
        {orders.length === 0 && (
          <div className="py-12 text-center opacity-20 border-2 border-dashed rounded-[28px]">
             <Package className="w-8 h-8 mx-auto mb-2" />
             <p className="text-[10px] font-black uppercase">No active records</p>
          </div>
        )}
      </div>
    </div>
  );
}

function ReportStat({ label, value, color = "text-foreground" }: any) {
  return (
    <Card className="border-none shadow-sm p-4 px-6 bg-white rounded-2xl h-fit min-w-[140px]">
       <p className="text-[9px] font-black uppercase text-muted-foreground mb-1 tracking-widest leading-none">{label}</p>
       <h4 className={cn("text-xl font-black tracking-tighter", color)}>{value}</h4>
    </Card>
  );
}
