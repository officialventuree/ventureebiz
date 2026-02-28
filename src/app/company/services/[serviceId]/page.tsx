
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
  Play, 
  Package, 
  ChevronLeft,
  TrendingUp,
  Layers,
  Settings2,
  RefreshCw,
  ShoppingCart,
  Minus,
  AlertTriangle,
  Lock,
  Edit2,
  Wallet,
  XCircle,
  BarChart3,
  QrCode,
  Upload
} from 'lucide-react';
import { useAuth } from '@/components/auth-context';
import { useFirestore, useCollection, useMemoFirebase, useDoc, deleteDocumentNonBlocking } from '@/firebase';
import { collection, doc, setDoc, updateDoc, query, where, addDoc, increment } from 'firebase/firestore';
import { useState, useMemo, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ServiceType, ServicePriceBundle, SaleTransaction, Product, Company, CapitalPurchase } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
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

  const [editingMaterial, setEditingMaterial] = useState<Product | null>(null);
  const [matQuantity, setMatQuantity] = useState<string>('1');
  const [matMeasure, setMatMeasure] = useState<string>('');
  const [matUnit, setMatUnit] = useState<string>('pc');
  const [matCostPerItem, setMatCostPerItem] = useState<string>('');
  const [editingBundle, setEditingBundle] = useState<ServicePriceBundle | null>(null);
  const [isStartWorkOpen, setIsStartWorkOpen] = useState(false);
  const [activeOrderId, setActiveOrderId] = useState<string | null>(null);
  const [selectedMaterials, setSelectedMaterials] = useState<{ product: Product, qty: number }[]>([]);
  const [selectedMartItems, setSelectedMartItems] = useState<{ product: Product, qty: number }[]>([]);
  const [materialSearch, setMaterialSearch] = useState('');
  const [martSearch, setMartSearch] = useState('');

  const serviceRef = useMemoFirebase(() => (!firestore || !user?.companyId) ? null : doc(firestore, 'companies', user.companyId, 'serviceTypes', serviceId), [firestore, user?.companyId, serviceId]);
  const companyRef = useMemoFirebase(() => (!firestore || !user?.companyId) ? null : doc(firestore, 'companies', user.companyId), [firestore, user?.companyId]);
  const bundlesQuery = useMemoFirebase(() => (!firestore || !user?.companyId) ? null : collection(firestore, 'companies', user.companyId, 'serviceTypes', serviceId, 'priceBundles'), [firestore, user?.companyId, serviceId]);
  const transactionsQuery = useMemoFirebase(() => (!firestore || !user?.companyId) ? null : query(collection(firestore, 'companies', user.companyId, 'transactions'), where('module', '==', 'services'), where('serviceTypeId', '==', serviceId)), [firestore, user?.companyId, serviceId]);
  const allProductsQuery = useMemoFirebase(() => (!firestore || !user?.companyId) ? null : collection(firestore, 'companies', user.companyId, 'products'), [firestore, user?.companyId]);
  const purchasesQuery = useMemoFirebase(() => (!firestore || !user?.companyId) ? null : collection(firestore, 'companies', user.companyId, 'purchases'), [firestore, user?.companyId]);

  const { data: serviceType } = useDoc<ServiceType>(serviceRef);
  const { data: companyDoc } = useDoc<Company>(companyRef);
  const { data: bundles } = useCollection<ServicePriceBundle>(bundlesQuery);
  const { data: transactions } = useCollection<SaleTransaction>(transactionsQuery);
  const { data: allProducts } = useCollection<Product>(allProductsQuery);
  const { data: purchases } = useCollection<CapitalPurchase>(purchasesQuery);

  const currencySymbol = companyDoc?.currencySymbol || '$';

  const activePurchases = useMemo(() => {
    if (!purchases) return [];
    if (!companyDoc?.capitalStartDate || !companyDoc?.capitalEndDate) return purchases;
    const start = new Date(companyDoc.capitalStartDate);
    const end = new Date(companyDoc.capitalEndDate);
    end.setHours(23, 59, 59, 999);
    return purchases.filter(p => { const pDate = new Date(p.timestamp); return pDate >= start && pDate <= end; });
  }, [purchases, companyDoc]);

  const totalSpent = activePurchases.reduce((acc, p) => acc + p.amount, 0);
  const totalCapacity = (companyDoc?.capitalLimit || 0) + (companyDoc?.injectedCapital || 0);
  const remainingBudget = Math.max(0, totalCapacity - totalSpent);
  const isBudgetActive = useMemo(() => { if (!companyDoc?.capitalEndDate) return false; const now = new Date(); const end = new Date(companyDoc.capitalEndDate); end.setHours(23, 59, 59, 999); return now < end; }, [companyDoc]);
  const canProcure = isBudgetActive && remainingBudget > 0;

  const materials = allProducts?.filter(p => p.serviceTypeId === serviceId) || [];
  const martProducts = allProducts?.filter(p => !p.serviceTypeId) || [];
  const totalRevenue = transactions?.reduce((acc, s) => acc + s.totalAmount, 0) || 0;

  const pipeline = {
    pending: transactions?.filter(t => t.status === 'pending') || [],
    inProgress: transactions?.filter(t => t.status === 'in-progress') || [],
    completed: transactions?.filter(t => t.status === 'completed') || []
  };

  const handleOpenStartWork = (orderId: string) => { 
    setActiveOrderId(orderId); 
    setSelectedMaterials([]); 
    setSelectedMartItems([]); 
    setIsStartWorkOpen(true); 
  };

  const handleConfirmStartWork = () => {
    if (!firestore || !user?.companyId || !activeOrderId) return;

    const transRef = doc(firestore, 'companies', user.companyId, 'transactions', activeOrderId);
    const totalMaterials = [...selectedMaterials, ...selectedMartItems];
    const totalMaterialCost = totalMaterials.reduce((acc, item) => acc + (item.product.costPrice * item.qty), 0);

    updateDoc(transRef, { 
      status: 'in-progress',
      totalCost: increment(totalMaterialCost),
      profit: increment(-totalMaterialCost)
    }).catch(async (err) => {
      errorEmitter.emit('permission-error', new FirestorePermissionError({
        path: transRef.path,
        operation: 'update'
      }));
    });

    totalMaterials.forEach(item => {
      const productRef = doc(firestore, 'companies', user!.companyId!, 'products', item.product.id);
      updateDoc(productRef, { stock: increment(-item.qty) }).catch(async (err) => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({
          path: productRef.path,
          operation: 'update'
        }));
      });
    });

    toast({ title: "Work Commenced", description: "Inventory adjusted and order moved to production." });
    setIsStartWorkOpen(false);
    setActiveOrderId(null);
    setSelectedMaterials([]);
    setSelectedMartItems([]);
  };

  const handleUpdateStatus = (id: string, newStatus: string) => { 
    updateDoc(doc(firestore!, 'companies', user!.companyId!, 'transactions', id), { status: newStatus }); 
    toast({ title: "Order Finalized" }); 
  };

  const handleCancelOrder = (id: string) => { 
    if (confirm("Cancel order?")) {
      deleteDocumentNonBlocking(doc(firestore!, 'companies', user!.companyId!, 'transactions', id)); 
    }
  };

  const handleCreateBundle = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const id = editingBundle?.id || crypto.randomUUID();
    setDoc(doc(firestore!, 'companies', user!.companyId!, 'serviceTypes', serviceId, 'priceBundles', id), { 
      id, 
      serviceTypeId: serviceId, 
      companyId: user!.companyId, 
      name: formData.get('name') as string, 
      price: Number(formData.get('price')), 
      estimatedProfit: Number(formData.get('profit')) 
    }).then(() => { 
      toast({ title: "Package Saved" }); 
      setEditingBundle(null); 
      (e.target as HTMLFormElement).reset();
    });
  };

  const handleAddMaterial = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const qty = Number(matQuantity);
    const cpu = Number(matCostPerItem);
    if (!editingMaterial && (qty * cpu) > remainingBudget) { 
      toast({ title: "Insufficient Budget", variant: "destructive" }); 
      return; 
    }
    const id = editingMaterial?.id || crypto.randomUUID();
    const material: Product = editingMaterial ? { 
      ...editingMaterial, 
      name: formData.get('name') as string, 
      costPrice: cpu, 
      unit: matUnit, 
      stock: qty 
    } : { 
      id, 
      companyId: user!.companyId!, 
      serviceTypeId: serviceId, 
      name: formData.get('name') as string, 
      costPrice: cpu, 
      sellingPrice: cpu * 1.5, 
      stock: qty * (Number(matMeasure) || 1), 
      unit: matUnit 
    };
    setDoc(doc(firestore!, 'companies', user!.companyId!, 'products', id), material).then(() => {
      if (!editingMaterial && (qty * cpu) > 0) {
        addDoc(collection(firestore!, 'companies', user!.companyId!, 'purchases'), { 
          id: crypto.randomUUID(), 
          amount: qty * cpu, 
          description: `Material: ${material.name}`, 
          timestamp: new Date().toISOString() 
        });
      }
      toast({ title: "Saved" }); 
      setEditingMaterial(null); 
      (e.target as HTMLFormElement).reset();
    });
  };

  const handleUploadGateway = async (e: any) => {
    const file = e.target.files?.[0];
    if (!file || !firestore || !user?.companyId) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      updateDoc(doc(firestore, 'companies', user.companyId!, 'serviceTypes', serviceId), { 
        duitNowQr: reader.result as string 
      }).then(() => {
        toast({ title: "Gateway Updated", description: "Departmental payment QR is now active." });
      });
    };
    reader.readAsDataURL(file);
  };

  const activeOrder = transactions?.find(t => t.id === activeOrderId);

  const addMaterialSelection = (m: Product) => {
    const ex = selectedMaterials.find(i => i.product.id === m.id);
    if (ex) setSelectedMaterials(selectedMaterials.map(i => i.product.id === m.id ? { ...i, qty: i.qty + 1 } : i));
    else setSelectedMaterials([...selectedMaterials, { product: m, qty: 1 }]);
  };

  const addMartItemSelection = (m: Product) => {
    const ex = selectedMartItems.find(i => i.product.id === m.id);
    if (ex) setSelectedMartItems(selectedMartItems.map(i => i.product.id === m.id ? { ...i, qty: i.qty + 1 } : i));
    else setSelectedMartItems([...selectedMartItems, { product: m, qty: 1 }]);
  };

  return (
    <div className="flex h-screen bg-background font-body">
      <Sidebar />
      <main className="flex-1 overflow-auto p-8">
        <div className="max-w-6xl mx-auto">
          <Link href="/company/services" className="inline-flex items-center gap-2 text-muted-foreground hover:text-primary font-black text-[10px] uppercase mb-6"><ChevronLeft className="w-4 h-4" /> Overview</Link>
          <div className="mb-10 flex justify-between items-end">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-12 h-12 bg-primary rounded-2xl flex items-center justify-center text-primary-foreground shadow-lg">
                  <Wrench className="w-6 h-6" />
                </div>
                <h1 className="text-4xl font-black font-headline tracking-tighter">{serviceType?.name}</h1>
              </div>
            </div>
            <div className="flex gap-4">
               <Card className="p-3 bg-white/50 flex items-center gap-3 rounded-2xl mr-4">
                 <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center", remainingBudget > 0 ? "bg-primary/20 text-primary" : "bg-destructive/20 text-destructive")}>
                   <Wallet className="w-5 h-5" />
                 </div>
                 <div>
                   <p className="text-[10px] font-black uppercase text-muted-foreground">Cycle Budget</p>
                   <p className="text-lg font-black">{currencySymbol}{remainingBudget.toFixed(2)}</p>
                 </div>
               </Card>
               <Button asChild className="rounded-2xl h-14 px-8 font-black bg-primary">
                 <Link href={`/company/services/${serviceId}/book`}><Plus className="w-5 h-5 mr-2" /> New Booking</Link>
               </Button>
            </div>
          </div>

          <Tabs defaultValue="pipeline" onValueChange={setActiveTab} className="space-y-8">
            <TabsList className="bg-white/50 border p-1 rounded-2xl">
              <TabsTrigger value="pipeline" className="rounded-xl px-8 font-black">Pipeline</TabsTrigger>
              <TabsTrigger value="catalog" className="rounded-xl px-8 font-black">Prices</TabsTrigger>
              <TabsTrigger value="inventory" className="rounded-xl px-8 font-black">Inventory</TabsTrigger>
              <TabsTrigger value="profits" className="rounded-xl px-8 font-black">Analytics</TabsTrigger>
              <TabsTrigger value="billing" className="rounded-xl px-8 font-black">Gateway</TabsTrigger>
            </TabsList>

            <TabsContent value="pipeline" className="grid grid-cols-1 lg:grid-cols-3 gap-8">
               <PipelineColumn title="Pending" color="bg-orange-500" orders={pipeline.pending} onAction={(id) => handleOpenStartWork(id)} actionLabel="Start Work" actionIcon={Play} onCancel={handleCancelOrder} currencySymbol={currencySymbol}/>
               <PipelineColumn title="Production" color="bg-primary" orders={pipeline.inProgress} onAction={(id) => handleUpdateStatus(id, 'completed')} actionLabel="Finish" actionIcon={CheckCircle2} onCancel={handleCancelOrder} currencySymbol={currencySymbol}/>
               <PipelineColumn title="Delivered" color="bg-green-600" orders={pipeline.completed} completed onCancel={handleCancelOrder} currencySymbol={currencySymbol}/>
            </TabsContent>

            <TabsContent value="catalog" className="grid grid-cols-1 lg:grid-cols-4 gap-8">
               <div className="lg:col-span-1">
                 <Card className="p-8">
                   <h3 className="text-xl font-black mb-6">Add Bundle</h3>
                   <form onSubmit={handleCreateBundle} className="space-y-4">
                     <div>
                       <Label className="text-[10px] font-black uppercase">Package Name</Label>
                       <Input name="name" required className="h-12 bg-secondary/10 border-none" />
                     </div>
                     <div>
                       <Label className="text-[10px] font-black uppercase">Price ({currencySymbol})</Label>
                       <Input name="price" type="number" step="0.01" required className="h-12 bg-secondary/10 border-none" />
                     </div>
                     <div>
                       <Label className="text-[10px] font-black uppercase">Target Profit ($)</Label>
                       <Input name="profit" type="number" step="0.01" required className="h-12 bg-secondary/10 border-none" />
                     </div>
                     <Button type="submit" className="w-full h-12 rounded-xl font-black shadow-lg">Save Package</Button>
                   </form>
                 </Card>
               </div>
               <div className="lg:col-span-3">
                 <div className="bg-white rounded-[32px] border overflow-hidden">
                   <table className="w-full text-sm text-left">
                     <thead className="bg-secondary/20">
                       <tr>
                         <th className="p-6 font-black uppercase text-[10px]">Package</th>
                         <th className="p-6 font-black uppercase text-[10px]">Price</th>
                         <th className="p-6 font-black uppercase text-[10px]">Margin</th>
                         <th className="p-6 text-center font-black uppercase text-[10px]">Action</th>
                       </tr>
                     </thead>
                     <tbody className="divide-y">
                       {bundles?.map(bundle => (
                         <tr key={bundle.id} className="hover:bg-secondary/5"> 
                           <td className="p-6 font-black">{bundle.name}</td>
                           <td className="p-6 font-black">{currencySymbol}{bundle.price.toFixed(2)}</td>
                           <td className="p-6 font-black text-primary">{currencySymbol}{bundle.estimatedProfit.toFixed(2)}</td>
                           <td className="p-6 text-center">
                             <Button variant="ghost" size="icon" onClick={() => deleteDocumentNonBlocking(doc(firestore!, 'companies', user!.companyId!, 'serviceTypes', serviceId, 'priceBundles', bundle.id))}>
                               <Trash2 className="w-4 h-4" />
                             </Button>
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
                 <Card className={cn("p-8", !canProcure && !editingMaterial && "grayscale opacity-80")}>
                   <h3 className="text-xl font-black mb-6">Replenish</h3>
                   <form onSubmit={handleAddMaterial} className="space-y-4">
                     <div>
                       <Label className="text-[10px] font-black uppercase">Material Name</Label>
                       <Input name="name" required className="h-12 bg-secondary/10 border-none" />
                     </div>
                     <div className="grid grid-cols-2 gap-3">
                       <div>
                         <Label className="text-[10px] font-black uppercase">Qty</Label>
                         <Input type="number" value={matQuantity} onChange={(e) => setMatQuantity(e.target.value)} className="h-12 bg-secondary/10 border-none" />
                       </div>
                       <div>
                         <Label className="text-[10px] font-black uppercase">Cost/Item ({currencySymbol})</Label>
                         <Input type="number" step="0.01" value={matCostPerItem} onChange={(e) => setMatCostPerItem(e.target.value)} className="h-12 bg-secondary/10 border-none" />
                       </div>
                     </div>
                     <Button type="submit" className="w-full h-12 rounded-xl font-black shadow-lg" disabled={(!canProcure && !editingMaterial)}>Save</Button>
                   </form>
                 </Card>
               </div>
               <div className="lg:col-span-3">
                 <div className="bg-white rounded-[32px] border overflow-hidden">
                   <table className="w-full text-sm text-left">
                     <thead className="bg-secondary/20">
                       <tr>
                         <th className="p-6 font-black uppercase text-[10px]">Material</th>
                         <th className="p-6 font-black uppercase text-[10px]">Stock</th>
                         <th className="p-6 font-black uppercase text-[10px]">Cost</th>
                         <th className="p-6 text-center font-black uppercase text-[10px]">Action</th>
                       </tr>
                     </thead>
                     <tbody className="divide-y">
                       {materials?.map(mat => (
                         <tr key={mat.id} className="hover:bg-secondary/5">
                           <td className="p-6 font-black">{mat.name}</td>
                           <td className="p-6"><Badge variant="secondary">{mat.stock.toFixed(1)} {mat.unit}</Badge></td>
                           <td className="p-6 font-black">{currencySymbol}{mat.costPrice.toFixed(2)}</td>
                           <td className="p-6 text-center">
                             <Button variant="ghost" size="icon" onClick={() => deleteDocumentNonBlocking(doc(firestore!, 'companies', user!.companyId!, 'products', mat.id))}>
                               <Trash2 className="w-4 h-4" />
                             </Button>
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
                     <div className="w-20 h-20 bg-primary/10 rounded-3xl flex items-center justify-center text-primary mx-auto">
                        <QrCode className="w-10 h-10" />
                     </div>
                     <h2 className="text-3xl font-black tracking-tight">Departmental Gateway</h2>
                     <p className="text-sm text-muted-foreground font-medium">
                        Configure a specific DuitNow QR for this department. If not set, the global company QR will be used during booking.
                     </p>
                     
                     {serviceType?.duitNowQr ? (
                       <div className="relative group mx-auto w-fit">
                         <Image src={serviceType.duitNowQr} alt="QR" width={250} height={250} className="rounded-3xl border-4" />
                         <label className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center rounded-3xl cursor-pointer transition-opacity">
                            <Upload className="text-white w-8 h-8" />
                            <input type="file" className="hidden" accept="image/*" onChange={handleUploadGateway} />
                         </label>
                       </div>
                     ) : (
                       <label className="w-full h-64 border-4 border-dashed rounded-[40px] flex flex-col items-center justify-center cursor-pointer hover:bg-secondary/20 transition-all gap-4 border-secondary/30">
                          <Plus className="w-10 h-10 text-primary" />
                          <p className="text-xs font-black uppercase tracking-widest">Upload Department QR</p>
                          <input type="file" className="hidden" accept="image/*" onChange={handleUploadGateway} />
                       </label>
                     )}
                  </Card>
               </div>
            </TabsContent>
          </Tabs>
        </div>
      </main>

      <Dialog open={isStartWorkOpen} onOpenChange={setIsStartWorkOpen}>
        <DialogContent className="rounded-[40px] max-w-4xl p-0 overflow-hidden bg-white shadow-2xl">
          <div className="bg-primary p-10 text-primary-foreground flex justify-between items-start">
            <div>
              <DialogTitle className="text-3xl font-black">Work Logistics</DialogTitle>
              <DialogDescription className="text-primary-foreground/80 font-bold mt-1">Select materials consumed for this service order</DialogDescription>
            </div>
            <div className="bg-black/10 px-6 py-3 rounded-2xl text-right">
              <p className="text-[10px] font-black uppercase">Bundle Value</p>
              <p className="text-3xl font-black">{currencySymbol}{activeOrder?.totalAmount.toFixed(2)}</p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 divide-x h-[600px]">
            <div className="p-8 overflow-auto space-y-6">
              <Tabs defaultValue="materials">
                <TabsList className="bg-secondary/20 p-1 rounded-xl w-full">
                  <TabsTrigger value="materials" className="flex-1 rounded-lg">Department Materials</TabsTrigger>
                  <TabsTrigger value="mart" className="flex-1 rounded-lg">Mart Stock</TabsTrigger>
                </TabsList>
                <TabsContent value="materials" className="space-y-4 pt-4">
                   <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input placeholder="Search materials..." value={materialSearch} onChange={(e) => setMaterialSearch(e.target.value)} className="pl-10 h-10 rounded-xl" />
                   </div>
                   <div className="space-y-2">
                      {materials.filter(m => m.name.toLowerCase().includes(materialSearch.toLowerCase())).map(m => (
                        <ProductSelectorCard key={m.id} product={m} currencySymbol={currencySymbol} onAdd={() => addMaterialSelection(m)} />
                      ))}
                   </div>
                </TabsContent>
                <TabsContent value="mart" className="space-y-4 pt-4">
                   <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input placeholder="Search mart items..." value={martSearch} onChange={(e) => setMartSearch(e.target.value)} className="pl-10 h-10 rounded-xl" />
                   </div>
                   <div className="space-y-2">
                      {martProducts.filter(m => m.name.toLowerCase().includes(martSearch.toLowerCase())).map(m => (
                        <ProductSelectorCard key={m.id} product={m} currencySymbol={currencySymbol} onAdd={() => addMartItemSelection(m)} />
                      ))}
                   </div>
                </TabsContent>
              </Tabs>
            </div>
            <div className="p-8 bg-secondary/5 flex flex-col">
              <div className="flex justify-between items-center mb-6">
                <h4 className="font-black uppercase text-xs tracking-widest text-muted-foreground">Consumption List</h4>
                <Badge variant="outline" className="font-black">{selectedMaterials.length + selectedMartItems.length} Items</Badge>
              </div>
              <div className="flex-1 overflow-auto space-y-4">
                {[...selectedMaterials, ...selectedMartItems].map(item => (
                  <SelectedConsumptionRow 
                    key={item.product.id} 
                    item={item} 
                    currencySymbol={currencySymbol} 
                    onUpdate={(qty) => {
                      const isMart = !item.product.serviceTypeId;
                      const setter = isMart ? setSelectedMartItems : setSelectedMaterials;
                      const list = isMart ? selectedMartItems : selectedMaterials;
                      
                      if (qty <= 0) setter(list.filter(i => i.product.id !== item.product.id));
                      else setter(list.map(i => i.product.id === item.product.id ? { ...i, qty } : i));
                    }} 
                  />
                ))}
                {(selectedMaterials.length === 0 && selectedMartItems.length === 0) && (
                  <div className="h-full flex flex-col items-center justify-center text-center opacity-20 py-20">
                    <ShoppingCart className="w-12 h-12 mb-4" />
                    <p className="font-black text-xs uppercase">No materials selected</p>
                  </div>
                )}
              </div>
              <div className="mt-6 border-t pt-6">
                <Button 
                  className="w-full h-16 rounded-2xl font-black text-lg shadow-xl" 
                  onClick={handleConfirmStartWork} 
                  disabled={selectedMaterials.length === 0 && selectedMartItems.length === 0}
                >
                  Commence Work
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ServiceAnalytics({ transactions, currencySymbol }: { transactions: SaleTransaction[], currencySymbol: string }) {
  const totalRevenue = transactions.reduce((acc, t) => acc + t.totalAmount, 0);
  const totalProfit = transactions.reduce((acc, t) => acc + t.profit, 0);
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

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="p-8 border-none shadow-sm rounded-3xl bg-white">
          <p className="text-[10px] font-black uppercase text-muted-foreground mb-2">Revenue</p>
          <h4 className="text-4xl font-black">{currencySymbol}{totalRevenue.toFixed(2)}</h4>
        </Card>
        <Card className="p-8 border-none shadow-sm rounded-3xl bg-white">
          <p className="text-[10px] font-black uppercase text-muted-foreground mb-2">Margin</p>
          <h4 className="text-4xl font-black text-primary">{currencySymbol}{totalProfit.toFixed(2)}</h4>
        </Card>
        <Card className="p-8 border-none shadow-sm rounded-3xl bg-white">
          <p className="text-[10px] font-black uppercase text-muted-foreground mb-2">Yield</p>
          <h4 className="text-4xl font-black">{((totalProfit / (totalRevenue || 1)) * 100).toFixed(1)}%</h4>
        </Card>
      </div>
      <Card className="p-10 border-none shadow-sm rounded-[40px] bg-white">
        <div className="h-[350px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="date" axisLine={false} tickLine={false} />
              <YAxis axisLine={false} tickLine={false} tickFormatter={(v) => `${currencySymbol}${v}`} />
              <Tooltip />
              <Area type="monotone" dataKey="revenue" stroke="hsl(var(--primary))" fillOpacity={0.3} fill="hsl(var(--primary))" strokeWidth={4} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </div>
  );
}

function ProductSelectorCard({ product, onAdd, currencySymbol }: any) {
  return (
    <Card className="p-4 cursor-pointer hover:shadow-md transition-all group bg-white" onClick={onAdd}>
      <div className="flex justify-between items-center">
        <div>
          <p className="font-black text-xs group-hover:text-primary transition-colors">{product.name}</p>
          <p className="text-[9px] font-bold text-muted-foreground uppercase">{product.stock.toFixed(1)} {product.unit} Available</p>
        </div>
        <div className="text-right">
          <p className="text-[9px] font-bold text-muted-foreground">Cost: {currencySymbol}{product.costPrice.toFixed(2)}</p>
          <Button size="icon" variant="ghost" className="h-6 w-6 mt-1"><Plus className="w-3 h-3" /></Button>
        </div>
      </div>
    </Card>
  );
}

function SelectedConsumptionRow({ item, onUpdate, currencySymbol }: any) {
  return (
    <div className="bg-white rounded-xl p-3 border-2 border-primary/10 flex items-center justify-between shadow-sm">
      <div className="min-w-0">
        <p className="text-[11px] font-black truncate">{item.product.name}</p>
        <p className="text-[9px] font-bold text-muted-foreground uppercase">Unit Cost: {currencySymbol}{item.product.costPrice.toFixed(2)}</p>
      </div>
      <div className="flex items-center gap-3 bg-secondary/20 p-1 rounded-lg">
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => onUpdate(item.qty - 1)}><Minus className="w-3 h-3" /></Button>
        <span className="text-xs font-black w-4 text-center">{item.qty}</span>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => onUpdate(item.qty + 1)}><Plus className="w-3 h-3" /></Button>
      </div>
    </div>
  );
}

function PipelineColumn({ title, color, orders, onAction, actionLabel, actionIcon: Icon, completed, onCancel, currencySymbol }: any) {
  return (
    <div className="space-y-6">
      <h3 className="text-xs font-black uppercase flex items-center gap-2 px-2">
        <div className={cn("w-2.5 h-2.5 rounded-full", color)} /> 
        {title}
        <Badge variant="secondary" className="ml-auto bg-white border font-black">{orders.length}</Badge>
      </h3>
      <div className="space-y-4">
        {orders.map((order: any) => (
          <Card key={order.id} className="p-6 border-none shadow-sm relative group bg-white rounded-2xl hover:shadow-md transition-all">
            <div className="absolute top-4 right-4">
              <Button variant="ghost" size="icon" onClick={() => onCancel(order.id)} className="text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity">
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
            <div className="flex justify-between items-start mb-4">
              <div>
                <p className="font-black text-lg leading-tight">{order.items?.[0]?.name || 'Service Order'}</p>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant="outline" className="text-[9px] font-black uppercase">{order.customerName}</Badge>
                  <p className="text-[9px] font-bold text-muted-foreground">{new Date(order.timestamp).toLocaleDateString()}</p>
                </div>
              </div>
              <p className="font-black text-primary text-xl">{currencySymbol}{order.totalAmount.toFixed(2)}</p>
            </div>
            {!completed && (
              <Button onClick={() => onAction(order.id)} className="w-full h-12 rounded-xl font-black gap-2 text-xs shadow-lg">
                <Icon className="w-4 h-4" /> {actionLabel}
              </Button>
            )}
          </Card>
        ))}
        {orders.length === 0 && (
          <div className="py-12 text-center border-2 border-dashed rounded-2xl opacity-20">
            <ClipboardList className="w-8 h-8 mx-auto mb-2" />
            <p className="text-[10px] font-black uppercase">No items in {title}</p>
          </div>
        )}
      </div>
    </div>
  );
}
