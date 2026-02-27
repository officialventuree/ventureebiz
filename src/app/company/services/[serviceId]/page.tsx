
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
  Star,
  QrCode,
  Upload,
  Settings2,
  CreditCard,
  Banknote,
  User,
  Building2,
  Wallet,
  Calculator
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
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import Image from 'next/image';

const UNITS = ['pc', 'ml', 'litre', 'mm', 'cm', 'meter', 'kg', 'g', 'set'];

export default function ServiceDashboardPage({ params }: { params: Promise<{ serviceId: string }> }) {
  const { serviceId } = use(params);
  const { user } = useAuth();
  const firestore = useFirestore();
  const { toast } = useToast();
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeTab, setActiveTab] = useState('pipeline');

  // Booking Form State
  const [isBookingOpen, setIsBookingOpen] = useState(false);
  const [selectedBundle, setSelectedBundle] = useState<ServicePriceBundle | null>(null);
  const [customerName, setCustomerName] = useState('');
  const [customerCompany, setCustomerCompany] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [cashReceived, setCashReceived] = useState<number | string>('');

  // Material Form State (Advanced)
  const [matQuantity, setMatQuantity] = useState<string>('1');
  const [matMeasure, setMatMeasure] = useState<string>('');
  const [matUnit, setMatUnit] = useState<string>('pc');
  const [matCostPerItem, setMatCostPerItem] = useState<string>('');

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

  const handlePlaceOrder = async () => {
    if (!firestore || !user?.companyId || !customerName || !selectedBundle) return;
    setIsProcessing(true);

    try {
      const transactionId = crypto.randomUUID();
      const transactionData: SaleTransaction = {
        id: transactionId,
        companyId: user.companyId,
        module: 'services',
        serviceTypeId: serviceId,
        totalAmount: selectedBundle.price,
        profit: selectedBundle.estimatedProfit,
        timestamp: new Date().toISOString(),
        customerName,
        customerCompany: customerCompany || undefined,
        paymentMethod,
        referenceNumber: referenceNumber || undefined,
        items: [{ name: selectedBundle.name, price: selectedBundle.price, quantity: 1 }],
        status: 'pending'
      };

      await setDoc(doc(firestore, 'companies', user.companyId, 'transactions', transactionId), transactionData);
      toast({ title: "Booking Confirmed", description: `Pending order created for ${customerName}.` });
      setIsBookingOpen(false);
      resetBookingForm();
    } catch (e) {
      toast({ title: "Order failed", variant: "destructive" });
    } finally {
      setIsProcessing(false);
    }
  };

  const resetBookingForm = () => {
    setCustomerName('');
    setCustomerCompany('');
    setPaymentMethod('cash');
    setReferenceNumber('');
    setCashReceived('');
    setSelectedBundle(null);
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

  const handleQrUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !firestore || !user?.companyId) return;

    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64String = reader.result as string;
      try {
        await updateDoc(doc(firestore, 'companies', user.companyId, 'serviceTypes', serviceId), {
          duitNowQr: base64String
        });
        toast({ title: "Billing QR Updated", description: "Payment gateway is now active for this department." });
      } catch (err: any) {
        toast({ title: "Upload failed", description: err.message, variant: "destructive" });
      }
    };
    reader.readAsDataURL(file);
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
    const costPerUnit = totalExpenditure / totalVolume;

    const material: Product = {
      id,
      companyId: user.companyId,
      serviceTypeId: serviceId,
      name: formData.get('name') as string,
      costPrice: costPerUnit, // Store cost per basic measurement unit (ml, pc, etc.)
      sellingPrice: costPerUnit * 1.5,
      stock: totalVolume,
      unit: matUnit
    };

    try {
      await setDoc(doc(firestore, 'companies', user.companyId, 'products', id), material);
      
      // Log the purchase
      await addDoc(collection(firestore, 'companies', user.companyId, 'purchases'), {
        id: crypto.randomUUID(),
        companyId: user.companyId,
        amount: totalExpenditure,
        description: `Service Material: ${qty}x ${material.name} (${measure}${matUnit})`,
        timestamp: new Date().toISOString()
      });

      toast({ title: "Material Registered", description: "Added to service inventory and logged as purchase." });
      (e.target as HTMLFormElement).reset();
      setMatQuantity('1');
      setMatMeasure('');
      setMatCostPerItem('');
    } catch (e) {
      toast({ title: "Failed to add material", variant: "destructive" });
    }
  };

  const totalRevenue = transactions?.reduce((acc, t) => acc + t.totalAmount, 0) || 0;
  const totalProfit = transactions?.reduce((acc, t) => acc + t.profit, 0) || 0;

  const changeAmount = paymentMethod === 'cash' ? Math.max(0, (Number(cashReceived) || 0) - (selectedBundle?.price || 0)) : 0;

  // Derived Values for Material Form
  const totalMatVolume = (Number(matQuantity) || 0) * (Number(matMeasure) || 0);
  const totalMatCost = (Number(matQuantity) || 0) * (Number(matCostPerItem) || 0);

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
                          if (confirm("Delete price bundle?")) {
                            await deleteDoc(doc(firestore!, 'companies', user!.companyId!, 'serviceTypes', serviceId, 'priceBundles', bundle.id));
                          }
                        }} className="text-destructive opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 className="w-4 h-4" /></Button>
                      </CardHeader>
                      <CardContent className="p-8 pt-0">
                         <div className="p-4 bg-secondary/10 rounded-2xl mb-6">
                            <p className="text-[10px] font-black uppercase text-muted-foreground mb-1">Estimated Net Yield</p>
                            <p className="text-lg font-black text-foreground">${bundle.estimatedProfit.toFixed(2)}</p>
                         </div>
                         <Button className="w-full h-12 rounded-xl font-black gap-2" onClick={() => {
                           setSelectedBundle(bundle);
                           setIsBookingOpen(true);
                         }}>
                           <Plus className="w-4 h-4" /> Book Service
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
                    <h3 className="text-xl font-black">Material Entry</h3>
                  </div>
                  <form onSubmit={handleAddMaterial} className="space-y-5">
                    <div className="space-y-1.5">
                      <Label className="text-[10px] font-black uppercase tracking-widest px-1">Material Name</Label>
                      <Input name="name" placeholder="Item/Chemical Name" required className="h-12 rounded-xl bg-secondary/10 border-none font-bold" />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label className="text-[10px] font-black uppercase tracking-widest px-1">Quantity (Items)</Label>
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
                      <Label className="text-[10px] font-black uppercase tracking-widest px-1">Amount per Item ({matUnit})</Label>
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
                      <Label className="text-[10px] font-black uppercase tracking-widest px-1">Cost per Item ($)</Label>
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
                          <span>Stock to Add</span>
                          <span className="text-foreground">{totalMatVolume.toFixed(1)} {matUnit}</span>
                       </div>
                       <div className="flex justify-between items-center text-[10px] font-black uppercase text-muted-foreground">
                          <span>Total Expenditure</span>
                          <span className="text-primary font-black">${totalMatCost.toFixed(2)}</span>
                       </div>
                    </div>

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
                               <Badge variant={m.stock < 10 ? "destructive" : "secondary"} className="font-black px-3 rounded-lg">{m.stock.toFixed(1)} {m.unit}</Badge>
                            </td>
                            <td className="p-6 font-black text-primary text-lg">${(m.stock * m.costPrice).toFixed(2)}</td>
                            <td className="p-6 text-center">
                               <Button variant="ghost" size="icon" onClick={async () => {
                                 if (confirm("Remove material?")) {
                                   await deleteDoc(doc(firestore!, 'companies', user!.companyId!, 'products', m.id));
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
                        <input type="file" className="hidden" accept="image/*" onChange={handleQrUpload} />
                     </label>
                   </div>
                 ) : (
                   <label className="w-64 h-64 border-4 border-dashed rounded-[40px] flex flex-col items-center justify-center mx-auto cursor-pointer hover:bg-secondary/20 transition-all gap-4">
                      <Plus className="w-8 h-8 text-primary" />
                      <p className="text-xs font-black uppercase">Upload Settlement QR</p>
                      <input type="file" className="hidden" accept="image/*" onChange={handleQrUpload} />
                   </label>
                 )}
               </Card>
            </TabsContent>
          </Tabs>
        </div>
      </main>

      {/* New Booking Dialog */}
      <Dialog open={isBookingOpen} onOpenChange={setIsBookingOpen}>
        <DialogContent className="rounded-[40px] max-w-xl p-0 overflow-hidden bg-white border-none shadow-2xl">
          <div className="bg-primary p-12 text-primary-foreground text-center relative overflow-hidden">
             <div className="absolute -top-4 -left-4 opacity-10 rotate-12"><Briefcase className="w-24 h-24" /></div>
             <p className="text-xs font-black uppercase tracking-widest opacity-80 mb-2 relative z-10">Service Settlement</p>
             <h2 className="text-6xl font-black tracking-tighter relative z-10">${selectedBundle?.price.toFixed(2)}</h2>
             <div className="mt-4 inline-flex items-center gap-2 bg-black/10 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest backdrop-blur-sm relative z-10">
                {selectedBundle?.name}
             </div>
          </div>
          
          <div className="p-10 space-y-8 max-h-[60vh] overflow-y-auto">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
               <div className="space-y-1.5">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground px-1">Customer Name</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input placeholder="John Doe" value={customerName} onChange={(e) => setCustomerName(e.target.value)} className="pl-10 h-12 rounded-xl font-bold bg-secondary/10 border-none" />
                  </div>
               </div>
               <div className="space-y-1.5">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground px-1">Organization (Optional)</Label>
                  <div className="relative">
                    <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input placeholder="Acme Corp" value={customerCompany} onChange={(e) => setCustomerCompany(e.target.value)} className="pl-10 h-12 rounded-xl font-bold bg-secondary/10 border-none" />
                  </div>
               </div>
            </div>

            <div className="space-y-4">
               <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground px-1">Settlement Method</Label>
               <RadioGroup value={paymentMethod} onValueChange={(v) => setPaymentMethod(v as PaymentMethod)} className="grid grid-cols-3 gap-3">
                  <PaymentOption value="cash" label="Cash" icon={Banknote} id="service_cash" />
                  <PaymentOption value="card" label="Card" icon={CreditCard} id="service_card" />
                  <PaymentOption value="duitnow" label="DuitNow" icon={QrCode} id="service_qr" />
               </RadioGroup>
            </div>

            {paymentMethod === 'cash' && (
              <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
                 <div className="space-y-1.5">
                    <Label className="text-[10px] font-black uppercase tracking-widest px-1">Cash Received ($)</Label>
                    <Input type="number" placeholder="0.00" value={cashReceived} onChange={(e) => setCashReceived(e.target.value)} className="h-14 rounded-2xl font-black text-2xl text-center" />
                 </div>
                 {Number(cashReceived) >= (selectedBundle?.price || 0) && (
                   <div className="p-6 bg-primary/5 rounded-[32px] border-2 border-primary/20 flex justify-between items-center">
                      <span className="text-[10px] font-black uppercase text-primary">Balance to Return</span>
                      <span className="text-4xl font-black">${changeAmount.toFixed(2)}</span>
                   </div>
                 )}
              </div>
            )}

            {(paymentMethod === 'card' || paymentMethod === 'duitnow') && (
              <div className="space-y-6 animate-in fade-in slide-in-from-top-2 text-center">
                 {paymentMethod === 'duitnow' && serviceType?.duitNowQr && (
                   <div className="space-y-4">
                      <Image src={serviceType.duitNowQr} alt="DuitNow" width={200} height={200} className="rounded-2xl mx-auto shadow-xl border-4 border-white" />
                      <p className="text-[10px] font-black text-primary uppercase tracking-widest">Point to Scan & Pay</p>
                   </div>
                 )}
                 <div className="space-y-1.5 text-left">
                    <Label className="text-[10px] font-black uppercase tracking-widest px-1">Transaction Ref / Trace ID</Label>
                    <Input placeholder="Enter trace ID..." value={referenceNumber} onChange={(e) => setReferenceNumber(e.target.value)} className="h-12 rounded-xl font-bold bg-secondary/10 border-none" />
                 </div>
              </div>
            )}
          </div>

          <div className="p-10 pt-0">
             <Button className="w-full h-18 rounded-[28px] font-black text-xl shadow-2xl" onClick={handlePlaceOrder} disabled={isProcessing || !customerName}>
                {isProcessing ? "Finalizing Booking..." : "Log & Authorize Service"}
             </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PaymentOption({ value, label, icon: Icon, id }: any) {
  return (
    <div className="flex-1">
      <RadioGroupItem value={value} id={id} className="peer sr-only" />
      <Label htmlFor={id} className="flex flex-col items-center justify-center rounded-[24px] border-4 border-transparent bg-secondary/20 p-4 hover:bg-secondary/30 peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/5 cursor-pointer transition-all h-28 text-center">
        <Icon className="mb-2 h-6 w-6 text-primary" />
        <span className="text-[10px] font-black uppercase tracking-widest">{label}</span>
      </Label>
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
