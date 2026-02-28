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
  AlertCircle
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
import { 
  AlertDialog, 
  AlertDialogAction, 
  AlertDialogCancel, 
  AlertDialogContent, 
  AlertDialogDescription, 
  AlertDialogFooter, 
  AlertDialogHeader, 
  AlertDialogTitle, 
  AlertDialogTrigger 
} from '@/components/ui/alert-dialog';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import Image from 'next/image';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

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

  const handleConfirmStartWork = () => {
    if (!firestore || !user?.companyId || !activeOrder) return;

    const totalMartSellingPrice = selectedMartItems.reduce((acc, item) => acc + (item.product.sellingPrice * item.qty), 0);
    const totalMaterialCost = selectedMaterials.reduce((acc, item) => acc + (item.product.costPrice * item.qty), 0);
    const totalMartCost = selectedMartItems.reduce((acc, item) => acc + (item.product.costPrice * item.qty), 0);

    const serviceRevenue = Math.max(0, activeOrder.totalAmount - totalMartSellingPrice);
    const martRevenue = totalMartSellingPrice;
    const netProfit = (serviceRevenue - totalMaterialCost) + (martRevenue - totalMartCost);

    const orderRef = doc(firestore, 'companies', user.companyId, 'transactions', activeOrder.id);
    const updateData = {
      status: 'in-progress',
      serviceRevenue,
      martRevenue,
      materialCost: totalMaterialCost,
      profit: netProfit,
      items: [
        ...activeOrder.items,
        ...selectedMaterials.map(m => ({ name: `[MAT] ${m.product.name}`, price: 0, quantity: m.qty, cost: m.product.costPrice })),
        ...selectedMartItems.map(m => ({ name: `[MART] ${m.product.name}`, price: m.product.sellingPrice, quantity: m.qty, cost: m.product.costPrice }))
      ]
    };

    updateDoc(orderRef, updateData).catch(async (err) => {
      errorEmitter.emit('permission-error', new FirestorePermissionError({
        path: orderRef.path,
        operation: 'update',
        requestResourceData: updateData
      }));
    });

    // Deduct materials
    for (const mat of selectedMaterials) {
      const matRef = doc(firestore, 'companies', user.companyId, 'products', mat.product.id);
      updateDoc(matRef, { stock: increment(-mat.qty) }).catch(async (err) => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({
          path: matRef.path,
          operation: 'update',
          requestResourceData: { stock: increment(-mat.qty) }
        }));
      });
    }

    // Deduct Mart Items
    for (const martItem of selectedMartItems) {
      const martRef = doc(firestore, 'companies', user.companyId, 'products', martItem.product.id);
      updateDoc(martRef, { stock: increment(-martItem.qty) }).catch(async (err) => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({
          path: martRef.path,
          operation: 'update',
          requestResourceData: { stock: increment(-martItem.qty) }
        }));
      });
    }

    toast({ title: "Work Commenced", description: "Order moved to In-Progress status." });
    setIsStartWorkOpen(false);
  };

  const handleUpdateStatus = (id: string, newStatus: string) => {
    if (!firestore || !user?.companyId) return;
    const docRef = doc(firestore, 'companies', user.companyId, 'transactions', id);
    updateDoc(docRef, { status: newStatus }).catch(async (err) => {
      errorEmitter.emit('permission-error', new FirestorePermissionError({
        path: docRef.path,
        operation: 'update',
        requestResourceData: { status: newStatus }
      }));
    });
    toast({ title: "Pipeline Updated", description: `Service status is now ${newStatus}.` });
  };

  const handleCancelOrder = (id: string) => {
    if (!firestore || !user?.companyId) return;
    const docRef = doc(firestore, 'companies', user.companyId, 'transactions', id);
    deleteDoc(docRef).catch(async (err) => {
      errorEmitter.emit('permission-error', new FirestorePermissionError({
        path: docRef.path,
        operation: 'delete'
      }));
    });
    toast({ title: "Order Cancelled", description: "The booking has been removed from the pipeline." });
  };

  const handleCreateBundle = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!firestore || !user?.companyId) return;
    const formData = new FormData(e.currentTarget);
    const bundleId = crypto.randomUUID();
    
    const bundleRef = doc(firestore, 'companies', user.companyId, 'serviceTypes', serviceId, 'priceBundles', bundleId);
    const newBundle: ServicePriceBundle = {
      id: bundleId,
      serviceTypeId: serviceId,
      companyId: user.companyId,
      name: formData.get('name') as string,
      price: Number(formData.get('price')),
      estimatedProfit: Number(formData.get('profit'))
    };

    setDoc(bundleRef, newBundle).catch(async (err) => {
      errorEmitter.emit('permission-error', new FirestorePermissionError({
        path: bundleRef.path,
        operation: 'create',
        requestResourceData: newBundle
      }));
    });

    toast({ title: "Package Added" });
    (e.target as HTMLFormElement).reset();
  };

  const handleAddMaterial = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!firestore || !user?.companyId) return;
    const formData = new FormData(e.currentTarget);
    const id = crypto.randomUUID();
    
    const qty = Number(matQuantity);
    const measure = Number(matMeasure) || 1;
    const costPerItem = Number(matCostPerItem);
    
    const totalVolume = qty * measure;
    const totalExpenditure = qty * costPerItem;
    const costPerUnit = totalExpenditure / totalVolume;

    const productRef = doc(firestore, 'companies', user.companyId, 'products', id);
    const material: Product = {
      id,
      companyId: user.companyId,
      serviceTypeId: serviceId,
      name: formData.get('name') as string,
      costPrice: costPerUnit,
      sellingPrice: costPerUnit * 1.5,
      stock: totalVolume,
      unit: matUnit
    };

    setDoc(productRef, material).catch(async (err) => {
      errorEmitter.emit('permission-error', new FirestorePermissionError({
        path: productRef.path,
        operation: 'create',
        requestResourceData: material
      }));
    });
    
    const purchaseData = {
      id: crypto.randomUUID(),
      companyId: user.companyId,
      amount: totalExpenditure,
      description: `Replenishment: ${qty}x ${material.name} (${measure}${matUnit})`,
      timestamp: new Date().toISOString()
    };

    addDoc(collection(firestore, 'companies', user.companyId, 'purchases'), purchaseData).catch(async (err) => {
      errorEmitter.emit('permission-error', new FirestorePermissionError({
        path: `companies/${user.companyId}/purchases`,
        operation: 'create',
        requestResourceData: purchaseData
      }));
    });

    toast({ title: "Inventory Updated", description: `Added ${totalVolume.toFixed(1)}${matUnit} to registry.` });
    (e.target as HTMLFormElement).reset();
    setMatQuantity('1');
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
               <ReportStat label="Segment Revenue" value={`$${totalRevenue.toFixed(2)}`} />
               <ReportStat label="Net Yield" value={`$${totalProfit.toFixed(2)}`} color="text-primary" />
               <Button asChild className="rounded-2xl h-14 px-8 font-black text-lg shadow-xl gap-2 bg-primary">
                 <Link href={`/company/services/${serviceId}/book`}>
                   <Plus className="w-5 h-5" /> New Booking
                 </Link>
               </Button>
            </div>
          </div>

          <Tabs defaultValue="pipeline" onValueChange={setActiveTab} className="space-y-8">
            <TabsList className="bg-white/50 border p-1 rounded-2xl shadow-sm self-start">
              <TabsTrigger value="pipeline" className="rounded-xl px-8 gap-2 font-black">
                <Package className="w-4 h-4" /> Pipeline
              </TabsTrigger>
              <TabsTrigger value="catalog" className="rounded-xl px-8 gap-2 font-black">
                <ClipboardList className="w-4 h-4" /> Price Catalog
              </TabsTrigger>
              <TabsTrigger value="inventory" className="rounded-xl px-8 gap-2 font-black">
                <Layers className="w-4 h-4" /> Inventory
              </TabsTrigger>
              <TabsTrigger value="profits" className="rounded-xl px-8 gap-2 font-black">
                <TrendingUp className="w-4 h-4" /> Analytics
              </TabsTrigger>
              <TabsTrigger value="billing" className="rounded-xl px-8 gap-2 font-black">
                <Settings2 className="w-4 h-4" /> Billing
              </TabsTrigger>
            </TabsList>

            <TabsContent value="pipeline" className="grid grid-cols-1 lg:grid-cols-3 gap-8">
               <PipelineColumn title="Pending Queue" color="bg-orange-500" orders={pipeline.pending} onAction={(id) => handleOpenStartWork(id)} actionLabel="Start Work" actionIcon={Play} onCancel={handleCancelOrder} />
               <PipelineColumn title="Production" color="bg-primary" orders={pipeline.inProgress} onAction={(id) => handleUpdateStatus(id, 'completed')} actionLabel="Finish Service" actionIcon={CheckCircle2} onCancel={handleCancelOrder} />
               <PipelineColumn title="Delivered" color="bg-green-600" orders={pipeline.completed} completed onCancel={handleCancelOrder} />
            </TabsContent>

            <TabsContent value="catalog" className="grid grid-cols-1 lg:grid-cols-4 gap-8">
               <Card className="lg:col-span-1 border-none shadow-sm rounded-3xl bg-white h-fit p-8">
                  <h3 className="text-xl font-black mb-6">Create Bundle</h3>
                  <form onSubmit={handleCreateBundle} className="space-y-4">
                    <Input name="name" placeholder="Bundle Name" required className="h-12 rounded-xl bg-secondary/10 border-none font-bold" />
                    <Input name="price" type="number" step="0.01" placeholder="Selling Price ($)" required className="h-12 rounded-xl bg-secondary/10 border-none font-bold" />
                    <Input name="profit" type="number" step="0.01" placeholder="Est. Profit ($)" required className="h-12 rounded-xl bg-secondary/10 border-none font-bold" />
                    <Button type="submit" className="w-full h-14 rounded-2xl font-black shadow-lg">Add Package</Button>
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
                        <Button variant="ghost" size="icon" onClick={() => {
                          if (confirm("Delete price bundle?")) {
                            const bundleRef = doc(firestore!, 'companies', user!.companyId!, 'serviceTypes', serviceId, 'priceBundles', bundle.id);
                            deleteDoc(bundleRef).catch(async (err) => {
                              errorEmitter.emit('permission-error', new FirestorePermissionError({
                                path: bundleRef.path,
                                operation: 'delete'
                              }));
                            });
                            toast({ title: "Package Removed" });
                          }
                        }} className="text-destructive opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 className="w-4 h-4" /></Button>
                      </CardHeader>
                      <CardContent className="p-8 pt-0">
                         <div className="p-4 bg-secondary/10 rounded-2xl mb-6">
                            <p className="text-[10px] font-black uppercase text-muted-foreground mb-1">Estimated Net Yield</p>
                            <p className="text-lg font-black text-foreground">${bundle.estimatedProfit.toFixed(2)}</p>
                         </div>
                         <Button asChild className="w-full h-12 rounded-xl font-black gap-2">
                           <Link href={`/company/services/${serviceId}/book`}>
                             <Plus className="w-4 h-4" /> Book Service
                           </Link>
                         </Button>
                      </CardContent>
                    </Card>
                  ))}
               </div>
            </TabsContent>

            <TabsContent value="inventory" className="grid grid-cols-1 lg:grid-cols-4 gap-8">
               <Card className="lg:col-span-1 border-none shadow-sm rounded-3xl bg-white h-fit p-8">
                  <div className="flex items-center gap-2 mb-6">
                    <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center text-primary">
                      <Calculator className="w-5 h-5" />
                    </div>
                    <h3 className="text-xl font-black">Procurement Entry</h3>
                  </div>
                  <form onSubmit={handleAddMaterial} className="space-y-5">
                    <div className="space-y-1.5">
                      <Label className="text-[10px] font-black uppercase tracking-widest px-1">Material/Item Name</Label>
                      <Input name="name" placeholder="Item/Chemical Name" required className="h-12 rounded-xl bg-secondary/10 border-none font-bold" />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label className="text-[10px] font-black uppercase tracking-widest px-1">Qty (Items)</Label>
                        <Input 
                          type="number" 
                          min="1" 
                          value={matQuantity} 
                          onChange={(e) => setMatQuantity(e.target.value)} 
                          placeholder="e.g. 5" 
                          required 
                          className="h-12 rounded-xl bg-secondary/10 border-none font-bold" 
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-[10px] font-black uppercase tracking-widest px-1">Unit</Label>
                        <Select value={matUnit} onValueChange={setMatUnit}>
                          <SelectTrigger className="h-12 rounded-xl bg-secondary/10 border-none font-bold">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="rounded-xl font-bold">
                            {UNITS.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-[10px] font-black uppercase tracking-widest px-1">Measure per Item ({matUnit})</Label>
                      <Input 
                        type="number" 
                        step="0.1" 
                        value={matMeasure} 
                        onChange={(e) => setMatMeasure(e.target.value)} 
                        placeholder="e.g. 500" 
                        required 
                        className="h-12 rounded-xl bg-secondary/10 border-none font-bold" 
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-[10px] font-black uppercase tracking-widest px-1">Cost per Unit/Item ($)</Label>
                      <Input 
                        type="number" 
                        step="0.01" 
                        value={matCostPerItem} 
                        onChange={(e) => setMatCostPerItem(e.target.value)} 
                        placeholder="e.g. 15.00" 
                        required 
                        className="h-12 rounded-xl bg-secondary/10 border-none font-bold" 
                      />
                    </div>

                    <div className="bg-primary/5 rounded-2xl p-4 space-y-2 border border-primary/10">
                       <div className="flex justify-between items-center text-[10px] font-black uppercase text-muted-foreground">
                          <span>Total Stock Added</span>
                          <span className="text-foreground font-black">{((Number(matQuantity) || 0) * (Number(matMeasure) || 0)).toFixed(1)} {matUnit}</span>
                       </div>
                       <div className="flex justify-between items-center text-[10px] font-black uppercase text-muted-foreground">
                          <span>Total Expenditure</span>
                          <span className="text-primary font-black">${((Number(matQuantity) || 0) * (Number(matCostPerItem) || 0)).toFixed(2)}</span>
                       </div>
                    </div>

                    <Button type="submit" className="w-full h-14 rounded-2xl font-black shadow-xl">Confirm Procurement</Button>
                  </form>
               </Card>

               <div className="lg:col-span-3">
                  <div className="bg-white rounded-[32px] border shadow-sm overflow-hidden">
                    <table className="w-full text-sm text-left">
                      <thead className="bg-secondary/10 border-b">
                        <tr>
                          <th className="p-6 font-black uppercase text-[10px] tracking-widest text-muted-foreground">Material Identity</th>
                          <th className="p-6 font-black uppercase text-[10px] tracking-widest text-muted-foreground">Available Stock</th>
                          <th className="p-6 font-black uppercase text-[10px] tracking-widest text-muted-foreground text-right">Value (Cost)</th>
                          <th className="p-6 text-center font-black uppercase text-[10px] tracking-widest text-muted-foreground">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {materials?.map(m => (
                          <tr key={m.id} className="hover:bg-secondary/5 transition-colors">
                            <td className="p-6 font-black text-lg">{m.name}</td>
                            <td className="p-6">
                               <Badge variant={m.stock < 10 ? "destructive" : "secondary"} className="font-black px-3 rounded-lg">{m.stock.toFixed(1)} {m.unit}</Badge>
                            </td>
                            <td className="p-6 font-black text-primary text-lg text-right">${(m.stock * m.costPrice).toFixed(2)}</td>
                            <td className="p-6 text-center">
                               <Button variant="ghost" size="icon" onClick={() => {
                                 if (confirm("Remove material record?")) {
                                   const matRef = doc(firestore!, 'companies', user!.companyId!, 'products', m.id);
                                   deleteDoc(matRef).catch(async (err) => {
                                     errorEmitter.emit('permission-error', new FirestorePermissionError({
                                       path: matRef.path,
                                       operation: 'delete'
                                     }));
                                   });
                                   toast({ title: "Material Removed" });
                                 }
                               }} className="text-destructive"><Trash2 className="w-4 h-4" /></Button>
                            </td>
                          </tr>
                        ))}
                        {(!materials || materials.length === 0) && (
                          <tr>
                            <td colSpan={4} className="py-24 text-center opacity-30">
                               <Layers className="w-12 h-12 mx-auto mb-2" />
                               <p className="font-black uppercase tracking-widest">Stock Registry Empty</p>
                            </td>
                          </tr>
                        )}
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
            </TabsContent>

            <TabsContent value="billing" className="max-w-xl mx-auto py-12">
               <Card className="border-none shadow-sm rounded-[32px] bg-white overflow-hidden p-10 text-center space-y-8">
                 <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center text-primary mx-auto"><QrCode className="w-8 h-8" /></div>
                 <h2 className="text-2xl font-black">Departmental Gateway</h2>
                 <p className="text-sm text-muted-foreground font-medium">Configure a dedicated DuitNow QR for the "{serviceType?.name}" department.</p>
                 {serviceType?.duitNowQr ? (
                   <div className="relative group mx-auto w-fit">
                     <Image src={serviceType.duitNowQr} alt="QR" width={250} height={250} className="rounded-3xl border-4" />
                     <label className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center rounded-3xl cursor-pointer transition-opacity">
                        <Upload className="text-white w-8 h-8" />
                        <input type="file" className="hidden" accept="image/*" onChange={(e) => {
                           const file = e.target.files?.[0];
                           if (!file || !firestore || !user?.companyId) return;
                           const reader = new FileReader();
                           reader.onloadend = () => {
                             const base64String = reader.result as string;
                             updateDoc(doc(firestore, 'companies', user.companyId, 'serviceTypes', serviceId), { duitNowQr: base64String });
                             toast({ title: "Billing QR Updated" });
                           };
                           reader.readAsDataURL(file);
                        }} />
                     </label>
                   </div>
                 ) : (
                   <label className="w-64 h-64 border-4 border-dashed rounded-[40px] flex flex-col items-center justify-center mx-auto cursor-pointer hover:bg-secondary/20 transition-all gap-4">
                      <Plus className="w-8 h-8 text-primary" />
                      <p className="text-xs font-black uppercase">Upload Settlement QR</p>
                      <input type="file" className="hidden" accept="image/*" onChange={(e) => {
                         const file = e.target.files?.[0];
                         if (!file || !firestore || !user?.companyId) return;
                         const reader = new FileReader();
                         reader.onloadend = () => {
                           const base64String = reader.result as string;
                           updateDoc(doc(firestore, 'companies', user.companyId, 'serviceTypes', serviceId), { duitNowQr: base64String });
                           toast({ title: "Billing QR Uploaded" });
                         };
                         reader.readAsDataURL(file);
                      }} />
                   </label>
                 )}
               </Card>
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
                   <p className="text-3xl font-black">${activeOrder?.totalAmount.toFixed(2)}</p>
                </div>
             </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 divide-x h-[600px]">
             {/* Left: Product/Material Selector */}
             <div className="flex flex-col p-8 overflow-hidden">
                <Tabs defaultValue="materials" className="flex-1 flex flex-col overflow-hidden">
                   <TabsList className="bg-secondary/20 p-1 rounded-xl mb-6">
                      <TabsTrigger value="materials" className="flex-1 rounded-lg font-black text-xs gap-2">
                         <Layers className="w-3 h-3" /> Service Materials
                      </TabsTrigger>
                      <TabsTrigger value="mart" className="flex-1 rounded-lg font-black text-xs gap-2">
                         <ShoppingCart className="w-3 h-3" /> Mart Inventory
                      </TabsTrigger>
                   </TabsList>

                   <TabsContent value="materials" className="flex-1 flex flex-col overflow-hidden m-0">
                      <div className="relative mb-4">
                         <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                         <Input 
                           placeholder="Search Materials..." 
                           className="pl-10 h-10 rounded-xl bg-secondary/10 border-none font-bold text-xs" 
                           value={materialSearch}
                           onChange={(e) => setMaterialSearch(e.target.value)}
                         />
                      </div>
                      <div className="flex-1 overflow-auto space-y-2">
                         {materials.filter(m => m.name.toLowerCase().includes(materialSearch.toLowerCase())).map(m => (
                           <ProductSelectorCard 
                             key={m.id} 
                             product={m} 
                             onAdd={() => {
                                const existing = selectedMaterials.find(item => item.product.id === m.id);
                                if (existing) setSelectedMaterials(selectedMaterials.map(item => item.product.id === m.id ? { ...item, qty: item.qty + 1 } : item));
                                else setSelectedMaterials([...selectedMaterials, { product: m, qty: 1 }]);
                             }}
                           />
                         ))}
                      </div>
                   </TabsContent>

                   <TabsContent value="mart" className="flex-1 flex flex-col overflow-hidden m-0">
                      <div className="relative mb-4">
                         <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                         <Input 
                           placeholder="Search Mart Products..." 
                           className="pl-10 h-10 rounded-xl bg-secondary/10 border-none font-bold text-xs" 
                           value={martSearch}
                           onChange={(e) => setMartSearch(e.target.value)}
                         />
                      </div>
                      <div className="flex-1 overflow-auto space-y-2">
                         {martProducts.filter(m => m.name.toLowerCase().includes(martSearch.toLowerCase())).map(m => (
                           <ProductSelectorCard 
                             key={m.id} 
                             product={m} 
                             isMart
                             onAdd={() => {
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

             {/* Right: Selected Summary & Revenue Split */}
             <div className="flex flex-col p-8 bg-secondary/5 overflow-hidden">
                <h4 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-4">Resource Consumption</h4>
                <div className="flex-1 overflow-auto space-y-4">
                   {selectedMaterials.length > 0 && (
                     <div className="space-y-2">
                        <p className="text-[9px] font-black text-primary uppercase">Service Materials (Internal)</p>
                        {selectedMaterials.map(item => (
                          <SelectedConsumptionRow 
                            key={item.product.id} 
                            item={item} 
                            onUpdate={(qty) => {
                               if (qty <= 0) setSelectedMaterials(selectedMaterials.filter(i => i.product.id !== item.product.id));
                               else setSelectedMaterials(selectedMaterials.map(i => i.product.id === item.product.id ? { ...i, qty } : i));
                            }}
                          />
                        ))}
                     </div>
                   )}

                   {selectedMartItems.length > 0 && (
                     <div className="space-y-2">
                        <p className="text-[9px] font-black text-accent-foreground uppercase">Mart Products (Internal Purchase)</p>
                        {selectedMartItems.map(item => (
                          <SelectedConsumptionRow 
                            key={item.product.id} 
                            item={item} 
                            isMart
                            onUpdate={(qty) => {
                               if (qty <= 0) setSelectedMartItems(selectedMartItems.filter(i => i.product.id !== item.product.id));
                               else setSelectedMartItems(selectedMartItems.map(i => i.product.id === item.product.id ? { ...i, qty } : i));
                            }}
                          />
                        ))}
                     </div>
                   )}

                   {selectedMaterials.length === 0 && selectedMartItems.length === 0 && (
                     <div className="h-full flex flex-col items-center justify-center text-center opacity-30">
                        <Zap className="w-12 h-12 mb-2" />
                        <p className="text-xs font-black uppercase">No Resources Selected</p>
                     </div>
                   )}
                </div>

                <div className="mt-6 space-y-4">
                   <div className="bg-white p-6 rounded-3xl border-2 border-primary/10 space-y-3">
                      <div className="flex justify-between items-center">
                         <span className="text-[10px] font-black text-muted-foreground uppercase">Mart Buy-In (Deduction)</span>
                         <span className="text-sm font-black text-destructive">-${selectedMartItems.reduce((acc, i) => acc + (i.product.sellingPrice * i.qty), 0).toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between items-center">
                         <span className="text-[10px] font-black text-muted-foreground uppercase">Service Revenue Split</span>
                         <span className="text-sm font-black text-foreground">${Math.max(0, (activeOrder?.totalAmount || 0) - selectedMartItems.reduce((acc, i) => acc + (i.product.sellingPrice * i.qty), 0)).toFixed(2)}</span>
                      </div>
                      <Separator />
                      <div className="flex justify-between items-end pt-1">
                         <div>
                            <p className="text-[10px] font-black text-primary uppercase">Estimated Net Profit</p>
                            <p className="text-xs font-bold text-muted-foreground leading-tight">After material & mart costs</p>
                         </div>
                         <p className="text-3xl font-black text-primary">
                            ${(
                              (Math.max(0, (activeOrder?.totalAmount || 0) - selectedMartItems.reduce((acc, i) => acc + (i.product.sellingPrice * i.qty), 0)) - selectedMaterials.reduce((acc, i) => acc + (i.product.costPrice * i.qty), 0)) + 
                              (selectedMartItems.reduce((acc, i) => acc + (i.product.sellingPrice * i.qty), 0) - selectedMartItems.reduce((acc, i) => acc + (i.product.costPrice * i.qty), 0))
                            ).toFixed(2)}
                         </p>
                      </div>
                   </div>
                   <Button 
                     className="w-full h-16 rounded-2xl font-black text-lg shadow-xl" 
                     onClick={handleConfirmStartWork}
                   >
                      Commit Materials & Start Service
                   </Button>
                </div>
             </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ProductSelectorCard({ product, onAdd, isMart }: { product: Product, onAdd: () => void, isMart?: boolean }) {
  return (
    <Card className="border-none shadow-sm bg-white p-4 group hover:shadow-md transition-all cursor-pointer" onClick={onAdd}>
       <div className="flex justify-between items-start">
          <div className="flex-1">
             <p className="font-black text-xs text-foreground leading-tight">{product.name}</p>
             <p className="text-[9px] font-bold text-muted-foreground uppercase mt-1">
                Stock: {product.stock.toFixed(1)} {product.unit} • {isMart ? `Price: $${product.sellingPrice.toFixed(2)}` : `Cost: $${product.costPrice.toFixed(2)}`}
             </p>
          </div>
          <div className="w-8 h-8 bg-secondary rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
             <Plus className="w-4 h-4 text-primary" />
          </div>
       </div>
    </Card>
  );
}

function SelectedConsumptionRow({ item, onUpdate, isMart }: { item: { product: Product, qty: number }, onUpdate: (qty: number) => void, isMart?: boolean }) {
  return (
    <div className="bg-white rounded-xl p-3 shadow-sm border flex items-center justify-between">
       <div className="flex-1 min-w-0 pr-4">
          <p className="text-[11px] font-black truncate">{item.product.name}</p>
          <p className="text-[9px] font-bold text-muted-foreground uppercase">
             {isMart ? `Buy-In Price: $${(item.product.sellingPrice * item.qty).toFixed(2)}` : `Internal Cost: $${(item.product.costPrice * item.qty).toFixed(2)}`}
          </p>
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
          <Card key={order.id} className={cn(
            "border-none shadow-sm rounded-[28px] overflow-hidden group hover:shadow-md transition-all relative",
            completed ? "bg-green-50/30" : "bg-white"
          )}>
            <div className="absolute top-4 right-4 z-10">
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent className="rounded-[32px]">
                  <AlertDialogHeader>
                    <AlertDialogTitle className="font-black">Cancel Service Booking?</AlertDialogTitle>
                    <AlertDialogDescription className="font-medium">
                      This will permanently remove the order for <strong>{order.customerName}</strong> from the pipeline. This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel className="rounded-xl font-bold">Abort</AlertDialogCancel>
                    <AlertDialogAction 
                      onClick={() => onCancel(order.id)}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-xl font-black"
                    >
                      Confirm Cancellation
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
            <CardContent className="p-6 pt-10">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <p className="font-black text-foreground text-lg leading-tight pr-8">{order.items[0].name}</p>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-1">
                    {order.customerName} {order.customerCompany ? `(${order.customerCompany})` : ''}
                  </p>
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
