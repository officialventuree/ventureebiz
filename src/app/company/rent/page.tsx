
'use client';

import { Sidebar } from '@/components/layout/sidebar';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { 
  CalendarDays, 
  Plus, 
  Search, 
  Clock, 
  Trash2, 
  ArrowRightLeft, 
  User, 
  LayoutGrid, 
  Settings2, 
  CreditCard, 
  Banknote, 
  QrCode, 
  Upload,
  ShieldCheck,
  Wallet,
  ArrowRight,
  Edit2,
  AlertTriangle,
  Lock,
  BarChart3,
  DollarSign,
  TrendingUp,
  XCircle
} from 'lucide-react';
import { useAuth } from '@/components/auth-context';
import { useFirestore, useCollection, useMemoFirebase, useDoc, deleteDocumentNonBlocking } from '@/firebase';
import { collection, doc, setDoc, updateDoc, addDoc, increment } from 'firebase/firestore';
import { useState, useMemo, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RentalItem, SaleTransaction, Company, PaymentMethod, CapitalPurchase } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import Link from 'next/link';
import Image from 'next/image';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export default function RentPage() {
  const { user } = useAuth();
  const firestore = useFirestore();
  const { toast } = useToast();
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAssetForAgreement, setSelectedAssetForAgreement] = useState<RentalItem | null>(null);
  const [editingAsset, setEditingAsset] = useState<RentalItem | null>(null);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [showCheckoutDialog, setShowCheckoutDialog] = useState(false);
  
  // Agreement Form State
  const [customerName, setCustomerName] = useState('');
  const [customerCompany, setCustomerCompany] = useState('');
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [startTime, setStartTime] = useState("09:00");
  const [endDate, setEndDate] = useState("");
  const [endTime, setEndTime] = useState("");
  const [duration, setDuration] = useState(1);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [selectedBillingPeriod, setSelectedBillingPeriod] = useState<RentalItem['unit']>('day');
  
  // Verification State
  const [referenceNumber, setReferenceNumber] = useState('');
  const [cashReceived, setCashReceived] = useState<number | string>('');

  const companyRef = useMemoFirebase(() => {
    if (!firestore || !user?.companyId) return null;
    return doc(firestore, 'companies', user.companyId);
  }, [firestore, user?.companyId]);

  const rentalItemsQuery = useMemoFirebase(() => {
    if (!firestore || !user?.companyId) return null;
    return collection(firestore, 'companies', user.companyId, 'rentalItems');
  }, [firestore, user?.companyId]);

  const transactionsQuery = useMemoFirebase(() => {
    if (!firestore || !user?.companyId) return null;
    return collection(firestore, 'companies', user.companyId, 'transactions');
  }, [firestore, user?.companyId]);

  const purchasesQuery = useMemoFirebase(() => {
    if (!firestore || !user?.companyId) return null;
    return collection(firestore, 'companies', user.companyId, 'purchases');
  }, [firestore, user?.companyId]);

  const { data: companyDoc } = useDoc<Company>(companyRef);
  const { data: rentalItems } = useCollection<RentalItem>(rentalItemsQuery);
  const { data: transactions } = useCollection<SaleTransaction>(transactionsQuery);
  const { data: purchases } = useCollection<CapitalPurchase>(purchasesQuery);

  const currencySymbol = companyDoc?.currencySymbol || '$';

  const activePurchases = useMemo(() => {
    if (!purchases) return [];
    if (!companyDoc?.capitalStartDate || !companyDoc?.capitalEndDate) return purchases;
    const start = new Date(companyDoc.capitalStartDate);
    const end = new Date(companyDoc.capitalEndDate);
    end.setHours(23, 59, 59, 999);
    return purchases.filter(p => {
      const pDate = new Date(p.timestamp);
      return pDate >= start && pDate <= end;
    });
  }, [purchases, companyDoc]);

  const totalSpent = activePurchases.reduce((acc, p) => acc + p.amount, 0);
  const totalCapacity = (companyDoc?.capitalLimit || 0) + (companyDoc?.injectedCapital || 0);
  const remainingBudget = Math.max(0, totalCapacity - totalSpent);

  const isBudgetActive = useMemo(() => {
    if (!companyDoc?.capitalEndDate) return false;
    const now = new Date();
    const end = new Date(companyDoc.capitalEndDate);
    end.setHours(23, 59, 59, 999);
    return now < end;
  }, [companyDoc]);

  const canProcure = isBudgetActive && remainingBudget > 0;

  const filteredItems = rentalItems?.filter(item => 
    item.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const rentTransactions = transactions?.filter(t => t.module === 'rent') || [];
  const activeRentals = rentTransactions.filter(t => t.status === 'in-progress');

  // AUTO-RETURN LOGIC
  useEffect(() => {
    if (!firestore || !user?.companyId || !activeRentals || !rentalItems) return;
    const now = new Date();
    activeRentals.forEach(rental => {
      if (rental.items && rental.items[0] && rental.items[0].endDate) {
        if (now > new Date(rental.items[0].endDate)) {
          updateDoc(doc(firestore, 'companies', user.companyId!, 'transactions', rental.id), { status: 'completed' });
          const item = rentalItems.find(i => i.name === rental.items[0].name);
          if (item) updateDoc(doc(firestore, 'companies', user.companyId!, 'rentalItems', item.id), { status: 'available' });
          toast({ title: "Auto-Return Executed" });
        }
      }
    });
  }, [activeRentals, rentalItems, firestore, user?.companyId]);

  useEffect(() => {
    if (selectedAssetForAgreement) {
      if (selectedAssetForAgreement.dailyRate) setSelectedBillingPeriod('day');
      else if (selectedAssetForAgreement.hourlyRate) setSelectedBillingPeriod('hour');
      else if (selectedAssetForAgreement.weeklyRate) setSelectedBillingPeriod('week');
      else if (selectedAssetForAgreement.monthlyRate) setSelectedBillingPeriod('month');
      else if (selectedAssetForAgreement.yearlyRate) setSelectedBillingPeriod('year');
    }
  }, [selectedAssetForAgreement]);

  useEffect(() => {
    if (!startDate || !startTime) return;
    const start = new Date(`${startDate}T${startTime}`);
    let end = new Date(start);
    switch (selectedBillingPeriod) {
      case 'hour': end.setHours(end.getHours() + duration); break;
      case 'day': end.setDate(end.getDate() + duration); break;
      case 'week': end.setDate(end.getDate() + (duration * 7)); break;
      case 'month': end.setMonth(end.getMonth() + duration); break;
      case 'year': end.setFullYear(end.getFullYear() + duration); break;
    }
    setEndDate(end.toISOString().split('T')[0]);
    setEndTime(end.toTimeString().split(' ')[0].substring(0, 5));
  }, [selectedBillingPeriod, startDate, startTime, duration]);

  const calculatedAgreement = useMemo(() => {
    if (!selectedAssetForAgreement) return { totalAmount: 0, duration: 0, rate: 0 };
    let rate = 0;
    switch (selectedBillingPeriod) {
      case 'hour': rate = selectedAssetForAgreement.hourlyRate || 0; break;
      case 'day': rate = selectedAssetForAgreement.dailyRate || 0; break;
      case 'week': rate = selectedAssetForAgreement.weeklyRate || 0; break;
      case 'month': rate = selectedAssetForAgreement.monthlyRate || 0; break;
      case 'year': rate = selectedAssetForAgreement.yearlyRate || 0; break;
    }
    return { totalAmount: rate * duration, duration, rate };
  }, [selectedAssetForAgreement, selectedBillingPeriod, duration]);

  const changeAmount = paymentMethod === 'cash' ? Math.max(0, (Number(cashReceived) || 0) - calculatedAgreement.totalAmount) : 0;
  const isInsufficientCash = paymentMethod === 'cash' && (Number(cashReceived) || 0) < calculatedAgreement.totalAmount;
  const isMissingReference = (paymentMethod === 'card' || paymentMethod === 'duitnow') && !referenceNumber;

  const handleLaunchAgreement = () => {
    if (!selectedAssetForAgreement || !firestore || !user?.companyId) return;
    setIsProcessing(true);
    const accumulated = selectedAssetForAgreement.accumulatedRevenue || 0;
    const cost = selectedAssetForAgreement.costPrice || 0;
    const remainingCostBefore = Math.max(0, cost - accumulated);
    const currentTotal = calculatedAgreement.totalAmount;
    const profitForThisTrans = Math.max(0, currentTotal - remainingCostBefore);
    const costForThisTrans = currentTotal - profitForThisTrans;
    const transactionId = crypto.randomUUID();
    const transactionData: SaleTransaction = { id: transactionId, companyId: user.companyId, module: 'rent', totalAmount: currentTotal, profit: profitForThisTrans, totalCost: costForThisTrans, timestamp: new Date().toISOString(), customerName: customerName || null, customerCompany: customerCompany || null, paymentMethod, referenceNumber: referenceNumber || null, status: 'in-progress', items: [{ name: selectedAssetForAgreement.name, price: calculatedAgreement.rate, quantity: 1, duration: calculatedAgreement.duration, unit: selectedBillingPeriod, startDate: new Date(`${startDate}T${startTime}`).toISOString(), endDate: new Date(`${endDate}T${endTime}`).toISOString() }] };
    setDoc(doc(firestore, 'companies', user.companyId, 'transactions', transactionId), transactionData).then(() => {
      updateDoc(doc(firestore, 'companies', user.companyId!, 'rentalItems', selectedAssetForAgreement.id), { status: 'rented', accumulatedRevenue: increment(currentTotal) });
      toast({ title: "Agreement Launched" });
      setSelectedAssetForAgreement(null);
      setCustomerName('');
      setCashReceived('');
      setReferenceNumber('');
      setShowCheckoutDialog(false);
    }).finally(() => setIsProcessing(false));
  };

  const handleCheckIn = (transactionId: string) => {
    if (!firestore || !user?.companyId) return;
    const transaction = transactions?.find(t => t.id === transactionId);
    if (!transaction) return;
    updateDoc(doc(firestore, 'companies', user.companyId, 'transactions', transactionId), { status: 'completed' });
    const item = rentalItems?.find(i => i.name === transaction.items[0].name);
    if (item) updateDoc(doc(firestore, 'companies', user.companyId!, 'rentalItems', item.id), { status: 'available' });
    toast({ title: "Asset Returned" });
  };

  const handleSaveAsset = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!firestore || !user?.companyId) return;
    const formData = new FormData(e.currentTarget);
    const itemId = editingAsset?.id || crypto.randomUUID();
    const costPrice = Number(formData.get('costPrice')) || 0;
    if (!editingAsset && costPrice > remainingBudget) { toast({ title: "Insufficient Budget", variant: "destructive" }); return; }
    const newItem: RentalItem = { id: itemId, companyId: user.companyId, name: formData.get('name') as string, unit: editingAsset?.unit || 'day', hourlyRate: formData.get('hourlyEnabled') === 'on' ? Number(formData.get('hourlyRate')) : null, dailyRate: formData.get('dailyEnabled') === 'on' ? Number(formData.get('dailyRate')) : null, weeklyRate: formData.get('weeklyEnabled') === 'on' ? Number(formData.get('weeklyRate')) : null, monthlyRate: formData.get('monthlyEnabled') === 'on' ? Number(formData.get('monthlyRate')) : null, yearlyRate: formData.get('yearlyEnabled') === 'on' ? Number(formData.get('yearlyRate')) : null, status: editingAsset?.status || 'available', costPrice: costPrice, accumulatedRevenue: editingAsset?.accumulatedRevenue || 0 };
    setDoc(doc(firestore, 'companies', user.companyId, 'rentalItems', itemId), newItem).then(() => {
      if (!editingAsset && costPrice > 0) addDoc(collection(firestore, 'companies', user.companyId!, 'purchases'), { id: crypto.randomUUID(), amount: costPrice, description: `Asset Registry: ${newItem.name}`, timestamp: new Date().toISOString() });
      toast({ title: editingAsset ? "Asset Updated" : "Asset Registered" });
      setIsAddDialogOpen(false);
      setEditingAsset(null);
    });
  };

  const handleDeleteItem = (itemId: string) => {
    if (!firestore || !user?.companyId || !confirm("Delete this asset?")) return;
    deleteDocumentNonBlocking(doc(firestore, 'companies', user.companyId, 'rentalItems', itemId));
    toast({ title: "Asset Removed" });
  };

  const sliderMax = useMemo(() => { switch (selectedBillingPeriod) { case 'hour': return 48; case 'day': return 31; case 'week': return 12; case 'month': return 12; case 'year': return 5; default: return 30; } }, [selectedBillingPeriod]);

  return (
    <div className="flex h-screen bg-background font-body">
      <Sidebar />
      <main className="flex-1 overflow-auto p-10 flex flex-col">
        <div className="mb-10 flex justify-between items-end">
          <div>
            <h1 className="text-4xl font-black font-headline text-foreground tracking-tighter uppercase">Leasing Terminal</h1>
            <p className="text-muted-foreground font-bold text-lg mt-1">Asset Management & Time-Aware Billing</p>
          </div>
          <div className="flex gap-4">
             <Card className="p-4 border-none shadow-xl bg-white/80 flex items-center gap-4 rounded-[24px]">
                <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg", remainingBudget > 0 ? "bg-primary text-white" : "bg-destructive text-white")}><Wallet className="w-6 h-6" /></div>
                <div><p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest leading-none">Procurement Cap</p><p className={cn("text-xl font-black tracking-tighter mt-1", remainingBudget <= 0 && "text-destructive")}>{currencySymbol}{remainingBudget.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p></div>
             </Card>
             <Card className="p-4 border-none shadow-xl bg-white/80 flex items-center gap-4 rounded-[24px]">
                <div className="w-12 h-12 bg-primary/20 rounded-2xl flex items-center justify-center text-primary shadow-sm"><Clock className="w-6 h-6" /></div>
                <div><p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest leading-none">Active Leases</p><p className="text-xl font-black tracking-tighter mt-1">{activeRentals.length} Agreements</p></div>
             </Card>
          </div>
        </div>

        {!isBudgetActive && <Alert variant="destructive" className="mb-10 rounded-[24px] bg-destructive/5 border-2 border-destructive/10 animate-in slide-in-from-top-4"><AlertTriangle className="h-5 w-5" /><AlertTitle className="font-black uppercase text-[10px] tracking-[0.2em] mb-1">Financial Guardrail Alert</AlertTitle><AlertDescription className="text-sm font-bold opacity-80">Your <strong>Capital Base Limit</strong> is not set. <Link href="/company/capital" className="underline font-black hover:opacity-100 ml-2">Configure Strategic Budget</Link></AlertDescription></Alert>}

        <Tabs defaultValue="workflow" className="flex-1 flex flex-col">
          <TabsList className="bg-white/50 border-2 border-primary/5 p-1.5 rounded-[24px] shadow-sm self-start mb-10 shrink-0">
            <TabsTrigger value="workflow" className="rounded-[18px] px-8 py-2 font-black text-xs uppercase tracking-widest gap-2"><ArrowRightLeft className="w-4 h-4" /> Operations</TabsTrigger>
            <TabsTrigger value="pos" className="rounded-[18px] px-8 py-2 font-black text-xs uppercase tracking-widest gap-2"><CalendarDays className="w-4 h-4" /> Create Agreement</TabsTrigger>
            <TabsTrigger value="registry" className="rounded-[18px] px-8 py-2 font-black text-xs uppercase tracking-widest gap-2"><LayoutGrid className="w-4 h-4" /> Asset Registry</TabsTrigger>
            <TabsTrigger value="analysis" className="rounded-[18px] px-8 py-2 font-black text-xs uppercase tracking-widest gap-2"><BarChart3 className="w-4 h-4" /> Performance</TabsTrigger>
            <TabsTrigger value="settings" className="rounded-[18px] px-8 py-2 font-black text-xs uppercase tracking-widest gap-2"><Settings2 className="w-4 h-4" /> Gateway</TabsTrigger>
          </TabsList>

          <TabsContent value="workflow" className="flex-1 space-y-8">
            {activeRentals.length === 0 ? <div className="py-32 text-center border-4 border-dashed rounded-[56px] bg-white/50 shadow-inner"><CalendarDays className="w-24 h-24 mx-auto mb-6 text-primary opacity-10" /><p className="font-black text-muted-foreground text-lg uppercase tracking-[0.3em]">No Active Agreements</p></div> : activeRentals.map(rental => (
              <Card key={rental.id} className="border-none shadow-sm rounded-[40px] bg-white overflow-hidden border-2 border-transparent hover:border-primary/10 transition-all">
                <CardContent className="p-10 flex flex-col md:flex-row items-center justify-between gap-8">
                  <div className="flex items-center gap-8">
                    <div className="w-20 h-20 bg-primary/10 rounded-[32px] flex items-center justify-center text-primary shadow-inner">
                      <CalendarDays className="w-10 h-10" />
                    </div>
                    <div>
                      <p className="font-black text-3xl tracking-tighter text-foreground">{rental.items[0].name}</p>
                      <div className="flex flex-wrap items-center gap-6 mt-3">
                        <div className="flex items-center gap-2 text-[10px] font-black text-muted-foreground uppercase tracking-widest">
                          <User className="w-4 h-4 text-primary" /> {rental.customerName}
                        </div>
                        <div className="flex items-center gap-2 text-[10px] font-black text-destructive uppercase tracking-widest">
                          <Clock className="w-4 h-4" /> Expiry: {new Date(rental.items[0].endDate!).toLocaleString()}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-10">
                    <div className="text-right">
                      <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1">Contract Value ({rental.paymentMethod})</p>
                      <p className="text-4xl font-black text-primary tracking-tighter">{currencySymbol}{rental.totalAmount.toFixed(2)}</p>
                    </div>
                    <Button onClick={() => handleCheckIn(rental.id)} className="rounded-[24px] font-black h-16 px-10 shadow-2xl transition-all hover:scale-[1.02] text-lg">Return Asset</Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          <TabsContent value="pos" className="flex-1">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
              <div className="lg:col-span-2 space-y-6">
                <div className="relative group">
                  <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-primary w-7 h-7 relative z-10" />
                  <Input placeholder="FILTER AVAILABLE ASSETS..." className="pl-16 h-20 rounded-[32px] border-4 border-transparent bg-white shadow-xl text-2xl font-black focus-visible:ring-primary/20 transition-all relative z-0 tracking-tight" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}/>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-6 custom-scrollbar pr-2">
                  {filteredItems?.filter(i => i.status === 'available').map(item => (
                    <Card key={item.id} className={cn(
                      "border-4 transition-all cursor-pointer rounded-[40px] overflow-hidden group hover:shadow-2xl h-fit",
                      selectedAssetForAgreement?.id === item.id ? "border-primary bg-primary/5" : "border-transparent bg-white shadow-sm"
                    )} onClick={() => setSelectedAssetForAgreement(item)}>
                      <CardContent className="p-10">
                        <div className="flex justify-between items-start mb-6">
                          <div className="w-16 h-16 bg-secondary rounded-[24px] flex items-center justify-center group-hover:scale-[1.1] transition-transform duration-500 shadow-inner">
                            <CalendarDays className="w-8 h-8 text-primary" />
                          </div>
                          <Badge variant="secondary" className="font-black uppercase text-[10px] tracking-widest px-4 h-7 bg-green-600 text-white border-none">Available</Badge>
                        </div>
                        <p className="font-black text-foreground text-2xl tracking-tighter leading-none">{item.name}</p>
                        <div className="mt-6 space-y-2 pt-6 border-t-2 border-secondary/20">
                          {item.hourlyRate && <p className="text-xs font-black text-muted-foreground uppercase tracking-widest flex justify-between">Hourly Rate: <span className="text-foreground">{currencySymbol}{item.hourlyRate.toFixed(2)}</span></p>}
                          {item.dailyRate && <p className="text-xs font-black text-muted-foreground uppercase tracking-widest flex justify-between">Daily Rate: <span className="text-foreground">{currencySymbol}{item.dailyRate.toFixed(2)}</span></p>}
                          {item.weeklyRate && <p className="text-xs font-black text-muted-foreground uppercase tracking-widest flex justify-between">Weekly Rate: <span className="text-foreground">{currencySymbol}{item.weeklyRate.toFixed(2)}</span></p>}
                          {item.monthlyRate && <p className="text-xs font-black text-muted-foreground uppercase tracking-widest flex justify-between">Monthly Rate: <span className="text-foreground">{currencySymbol}{item.monthlyRate.toFixed(2)}</span></p>}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
              <div className="lg:col-span-1">
                <Card className="sticky top-10 border-none shadow-2xl bg-white rounded-[56px] overflow-hidden flex flex-col border-4 border-primary/5 max-h-[calc(100vh-120px)]">
                  <CardHeader className="bg-secondary/20 p-10">
                    <CardTitle className="flex items-center gap-4 font-black text-2xl tracking-tight"><ArrowRightLeft className="w-8 h-8 text-primary" /> Agreement Engine</CardTitle>
                    <CardDescription className="font-bold text-[10px] uppercase tracking-widest mt-2">Deploy New Rental Contract</CardDescription>
                  </CardHeader>
                  <CardContent className="flex-1 p-10 overflow-y-auto space-y-10 custom-scrollbar">
                    {selectedAssetForAgreement ? (
                      <div className="space-y-10 pb-6 animate-in fade-in">
                        <div className="p-8 bg-primary/5 border-4 border-primary/10 rounded-[32px] relative">
                          <p className="text-[10px] font-black text-primary uppercase tracking-[0.2em] mb-2">Target Asset</p>
                          <p className="text-2xl font-black tracking-tighter leading-none">{selectedAssetForAgreement.name}</p>
                        </div>
                        <div className="space-y-4"><Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground px-1">Customer Identity</Label><Input placeholder="Full Name" value={customerName} onChange={(e) => setCustomerName(e.target.value)} className="h-14 rounded-2xl font-black text-lg bg-secondary/10 border-none px-6" /></div>
                        <div className="space-y-4">
                           <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground px-1">Billing Period Protocol</Label>
                           <Select value={selectedBillingPeriod} onValueChange={(v) => setSelectedBillingPeriod(v as any)}>
                              <SelectTrigger className="h-14 rounded-2xl bg-secondary/10 border-none font-black text-sm uppercase px-6 tracking-widest shadow-inner"><SelectValue /></SelectTrigger>
                              <SelectContent className="rounded-2xl font-black text-xs uppercase tracking-widest">
                                 {selectedAssetForAgreement.hourlyRate && <SelectItem value="hour">Hourly Plan ({currencySymbol}{selectedAssetForAgreement.hourlyRate.toFixed(2)})</SelectItem>}
                                 {selectedAssetForAgreement.dailyRate && <SelectItem value="day">Daily Plan ({currencySymbol}{selectedAssetForAgreement.dailyRate.toFixed(2)})</SelectItem>}
                                 {selectedAssetForAgreement.weeklyRate && <SelectItem value="week">Weekly Plan ({currencySymbol}{selectedAssetForAgreement.weeklyRate.toFixed(2)})</SelectItem>}
                                 {selectedAssetForAgreement.monthlyRate && <SelectItem value="month">Monthly Plan ({currencySymbol}{selectedAssetForAgreement.monthlyRate.toFixed(2)})</SelectItem>}
                              </SelectContent>
                           </Select>
                        </div>
                        <div className="space-y-6">
                           <div className="flex justify-between items-center px-1">
                              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Agreement Duration</Label>
                              <Badge variant="secondary" className="font-black text-[10px] uppercase tracking-widest h-7 px-4 rounded-xl border-none">{duration} {selectedBillingPeriod}(s)</Badge>
                           </div>
                           <div className="flex items-center gap-6 p-6 bg-secondary/5 rounded-[24px] shadow-inner border border-secondary/20">
                              <Input type="number" min="1" value={duration} onChange={(e) => setDuration(Math.max(1, Number(e.target.value)))} className="w-24 h-14 rounded-2xl bg-white border-none text-center shadow-md font-black text-xl tracking-tighter" />
                              <Slider value={[duration]} min={1} max={sliderMax} step={1} onValueChange={(v) => setDuration(v[0])} className="flex-1" />
                           </div>
                        </div>
                        <div className="space-y-4">
                           <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground px-1">Settlement Method Protocol</Label>
                           <RadioGroup value={paymentMethod} onValueChange={(v) => { setPaymentMethod(v as PaymentMethod); setCashReceived(''); setReferenceNumber(''); }} className="grid grid-cols-3 gap-4">
                              <PaymentOption value="cash" label="Cash" icon={Banknote} id="rent_cash_main" />
                              <PaymentOption value="card" label="Card" icon={CreditCard} id="rent_card_main" />
                              <PaymentOption value="duitnow" label="Digital" icon={QrCode} id="rent_qr_main" />
                           </RadioGroup>
                        </div>
                        <div className="bg-primary/5 p-10 rounded-[40px] border-4 border-primary/10 flex flex-col justify-center items-center text-center">
                           <p className="text-xs font-black uppercase text-primary tracking-[0.3em] mb-2">Projected Revenue</p>
                           <p className="text-7xl font-black tracking-tighter leading-none">{currencySymbol}{calculatedAgreement.totalAmount.toFixed(2)}</p>
                        </div>
                      </div>
                    ) : <div className="py-32 text-center opacity-20 space-y-6"><CalendarDays className="w-24 h-24 mx-auto" /><p className="font-black text-sm uppercase tracking-[0.3em]">Protocol Standby: Select an asset</p></div>}
                  </CardContent>
                  {selectedAssetForAgreement && <CardFooter className="p-10 border-t-2 bg-secondary/5"><Button onClick={() => setShowCheckoutDialog(true)} disabled={!customerName} className="w-full h-24 text-2xl font-black rounded-[32px] shadow-2xl transition-all hover:scale-[1.02] active:scale-95">Authorize & Verify Settlement</Button></CardFooter>}
                </Card>
              </div>
            </div>
            
            <Dialog open={showCheckoutDialog} onOpenChange={setShowCheckoutDialog}>
              <DialogContent className="rounded-[56px] max-xl p-0 overflow-hidden bg-white border-none shadow-2xl">
                <div className="bg-primary p-16 text-primary-foreground text-center relative">
                   <div className="absolute top-0 right-0 p-10 opacity-10"><ShieldCheck className="w-24 h-24" /></div>
                   <DialogTitle className="text-xs font-black uppercase tracking-[0.3em] opacity-80 mb-3">Tactical Settlement Verification</DialogTitle>
                   <h2 className="text-8xl font-black tracking-tighter">{currencySymbol}{calculatedAgreement.totalAmount.toFixed(2)}</h2>
                </div>
                <div className="p-16 space-y-12">
                  {paymentMethod === 'cash' && (
                    <div className="space-y-8">
                       <div className="space-y-3">
                          <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground px-1">Physical Cash Inbound ({currencySymbol})</Label>
                          <Input type="number" className="h-24 rounded-[32px] font-black text-6xl tracking-tighter bg-secondary/10 border-none text-center shadow-inner" value={cashReceived} onChange={(e) => setCashReceived(e.target.value)} />
                       </div>
                       {Number(cashReceived) >= calculatedAgreement.totalAmount && (
                         <div className="bg-primary/5 p-10 rounded-[40px] border-4 border-primary/10 flex justify-between items-center animate-in zoom-in-95">
                            <div>
                               <p className="text-[10px] font-black uppercase text-primary tracking-[0.2em] mb-1">Settlement Change Due</p>
                               <p className="text-xs font-bold text-muted-foreground">In-vault verified</p>
                            </div>
                            <p className="text-6xl font-black tracking-tighter text-foreground">{currencySymbol}{changeAmount.toFixed(2)}</p>
                         </div>
                       )}
                    </div>
                  )}
                  {(paymentMethod === 'card' || paymentMethod === 'duitnow') && (
                    <div className="space-y-3">
                       <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground px-1">Gateway Auth Reference / Trace ID</Label>
                       <Input placeholder="ENTER REFERENCE CODE..." className="h-20 rounded-[32px] font-black text-2xl tracking-tight bg-secondary/10 border-none px-10 shadow-inner" value={referenceNumber} onChange={(e) => setReferenceNumber(e.target.value)} />
                    </div>
                  )}
                  <Button onClick={handleLaunchAgreement} className="w-full h-24 rounded-[40px] font-black text-3xl shadow-2xl transition-all hover:scale-[1.02] active:scale-95" disabled={isProcessing || isInsufficientCash || isMissingReference}>
                    {isProcessing ? "PROCESSING PROTOCOL..." : "Authorize & Launch Contract"}
                  </Button>
                  <p className="text-center text-[10px] font-black text-muted-foreground uppercase tracking-[0.3em] opacity-40">Secured Agreement Protocol Active</p>
                </div>
              </DialogContent>
            </Dialog>
          </TabsContent>

          <TabsContent value="registry" className="grid grid-cols-1 lg:grid-cols-4 gap-10">
             <div className="lg:col-span-1">
                <Card className={cn(
                   "border-none shadow-sm rounded-[40px] bg-white p-10 sticky top-10 border-2 border-transparent transition-all",
                   !canProcure && !editingAsset ? "grayscale opacity-80 border-destructive/10" : "hover:border-primary/10"
                )}>
                   <div className="flex items-center gap-3 mb-8">
                      <div className={cn("w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg", canProcure ? "bg-primary text-white" : "bg-destructive text-white")}>
                         {canProcure ? <Plus className="w-7 h-7" /> : <Lock className="w-7 h-7" />}
                      </div>
                      <div>
                         <h3 className="text-xl font-black tracking-tight">{editingAsset ? 'Edit Asset' : 'New Registry'}</h3>
                         <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest mt-1">Asset Commissioning</p>
                      </div>
                   </div>
                   <form onSubmit={handleSaveAsset} className="space-y-6">
                      <div className="space-y-2"><Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground px-1">Asset Identity</Label><Input name="name" defaultValue={editingAsset?.name} required className="h-14 rounded-2xl bg-secondary/10 border-none font-black text-lg px-6" /></div>
                      <div className="space-y-2"><Label className="text-[10px] font-black uppercase tracking-widest text-primary px-1">Baseline Cost Price ({currencySymbol})</Label><Input name="costPrice" type="number" step="0.01" defaultValue={editingAsset?.costPrice} required disabled={!!editingAsset} className="h-14 rounded-2xl border-4 border-primary/10 font-black text-2xl tracking-tighter px-6 text-primary" /></div>
                      <Separator className="opacity-50" />
                      <p className="text-[10px] font-black uppercase text-primary tracking-[0.2em] px-1 mb-4">Tactical Operating Rates</p>
                      <div className="space-y-4">
                         <RateInput id="hourly" label="Hourly Rate" enabled={!!editingAsset?.hourlyRate} defaultValue={editingAsset?.hourlyRate} currencySymbol={currencySymbol} />
                         <RateInput id="daily" label="Daily Rate" enabled={!!editingAsset?.dailyRate || !editingAsset} defaultValue={editingAsset?.dailyRate} currencySymbol={currencySymbol} />
                         <RateInput id="weekly" label="Weekly Rate" enabled={!!editingAsset?.weeklyRate} defaultValue={editingAsset?.weeklyRate} currencySymbol={currencySymbol} />
                         <RateInput id="monthly" label="Monthly Rate" enabled={!!editingAsset?.monthlyRate} defaultValue={editingAsset?.monthlyRate} currencySymbol={currencySymbol} />
                      </div>
                      <Button type="submit" className="w-full h-20 rounded-[32px] font-black shadow-2xl mt-6 uppercase tracking-[0.2em] text-xs" disabled={(!canProcure && !editingAsset)}>{editingAsset ? "Update Registry" : "Commission Asset"}</Button>
                   </form>
                </Card>
             </div>
             <div className="lg:col-span-3">
                <div className="bg-white rounded-[48px] border-2 border-primary/5 shadow-sm overflow-hidden">
                   <table className="w-full text-sm text-left">
                      <thead className="bg-secondary/20 border-b-2">
                         <tr>
                            <th className="p-8 font-black uppercase text-[10px] tracking-widest text-muted-foreground">Asset Identity</th>
                            <th className="p-8 font-black uppercase text-[10px] tracking-widest text-muted-foreground">Operational Rates</th>
                            <th className="p-8 font-black uppercase text-[10px] tracking-widest text-muted-foreground">ROI Performance</th>
                            <th className="p-8 font-black uppercase text-[10px] tracking-widest text-muted-foreground text-center">Status</th>
                            <th className="p-8 text-center font-black uppercase text-[10px] tracking-widest text-muted-foreground">Action</th>
                         </tr>
                      </thead>
                      <tbody className="divide-y">
                         {rentalItems?.map(item => { 
                            const cost = item.costPrice || 0; 
                            const rev = item.accumulatedRevenue || 0; 
                            const isPaidOff = rev >= cost; 
                            return (<tr key={item.id} className="hover:bg-secondary/10 transition-all group">
                               <td className="p-8"><p className="font-black text-xl tracking-tight text-foreground">{item.name}</p><p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-1.5">ID: {item.id.split('-')[0]}</p></td>
                               <td className="p-8">
                                  <div className="flex flex-wrap gap-2">
                                     {item.dailyRate && <Badge variant="outline" className="text-[9px] font-black uppercase tracking-widest bg-white h-6 px-3 border-2">D: {currencySymbol}{item.dailyRate}</Badge>}
                                     {item.hourlyRate && <Badge variant="outline" className="text-[9px] font-black uppercase tracking-widest bg-white h-6 px-3 border-2">H: {currencySymbol}{item.hourlyRate}</Badge>}
                                  </div>
                               </td>
                               <td className="p-8">
                                  <div>
                                     <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1">Net Cost: {currencySymbol}{cost.toFixed(2)}</p>
                                     <div className="flex items-center gap-2">
                                        <p className={cn("text-2xl font-black tracking-tighter", isPaidOff ? "text-primary" : "text-orange-600")}>{currencySymbol}{rev.toFixed(2)} REV</p>
                                        {isPaidOff && <CheckCircle2 className="w-4 h-4 text-primary" />}
                                     </div>
                                  </div>
                               </td>
                               <td className="p-8 text-center">
                                  <Badge className={cn(
                                     "font-black uppercase text-[10px] tracking-widest h-7 px-5 rounded-xl border-none transition-all", 
                                     item.status === 'available' ? "bg-green-600 text-white" : "bg-primary text-white"
                                  )}>{item.status}</Badge>
                               </td>
                               <td className="p-8 text-center">
                                  <div className="flex justify-center gap-3">
                                     <Button variant="ghost" size="icon" onClick={() => setEditingAsset(item)} className="h-12 w-12 rounded-2xl text-primary hover:bg-primary/10 transition-all border-2 border-transparent hover:border-primary/20"><Edit2 className="w-5 h-5" /></Button>
                                     <Button variant="ghost" size="icon" onClick={() => handleDeleteItem(item.id)} className="h-12 w-12 rounded-2xl text-destructive hover:bg-destructive/10 transition-all border-2 border-transparent hover:border-destructive/20"><Trash2 className="w-5 h-5" /></Button>
                                  </div>
                               </td>
                            </tr>); 
                         })}
                         {rentalItems?.length === 0 && (
                            <tr>
                               <td colSpan={5} className="py-32 text-center opacity-20">
                                  <LayoutGrid className="w-24 h-24 mx-auto mb-6" />
                                  <p className="font-black uppercase tracking-[0.4em] text-sm">Registry Empty</p>
                               </td>
                            </tr>
                         )}
                      </tbody>
                   </table>
                </div>
             </div>
          </TabsContent>

          <TabsContent value="analysis" className="space-y-10"><RentAnalytics transactions={rentTransactions} currencySymbol={currencySymbol} /></TabsContent>

          <TabsContent value="settings">
             <div className="max-w-3xl mx-auto py-16 text-center space-y-10">
                <Card className="border-none shadow-2xl rounded-[56px] bg-white p-16 space-y-10 border-4 border-primary/5">
                   <div className="w-24 h-24 bg-primary/10 rounded-[32px] flex items-center justify-center text-primary mx-auto shadow-inner"><QrCode className="w-12 h-12" /></div>
                   <div>
                      <h2 className="text-4xl font-black tracking-tighter">Digital Leasing Gateway</h2>
                      <p className="text-muted-foreground font-bold text-lg mt-3">Managed In-Agreement Payment Protocols</p>
                   </div>
                   {companyDoc?.duitNowQr ? (
                      <div className="relative group w-fit mx-auto">
                         <div className="absolute inset-0 bg-primary/20 rounded-[48px] blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                         <Image src={companyDoc.duitNowQr} alt="QR" width={300} height={300} className="rounded-[48px] border-8 border-white shadow-2xl relative z-10" />
                         <label className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center rounded-[48px] cursor-pointer transition-all duration-300 z-20">
                            <Upload className="text-white w-12 h-12 mb-4" />
                            <p className="text-white font-black uppercase tracking-[0.2em] text-xs">Update Protocol</p>
                            <input type="file" className="hidden" accept="image/*" onChange={(e) => { const file = e.target.files?.[0]; if(file) { const reader = new FileReader(); reader.onloadend = () => updateDoc(doc(firestore!, 'companies', user!.companyId!), { duitNowQr: reader.result as string }); reader.readAsDataURL(file); } }} />
                         </label>
                      </div>
                   ) : <label className="py-32 border-8 border-dashed rounded-[64px] opacity-30 cursor-pointer flex flex-col items-center justify-center gap-6 border-secondary/30 hover:bg-secondary/10 transition-all"><Plus className="w-16 h-16 text-primary" /><p className="font-black uppercase tracking-[0.3em] text-xs">Authorize Gateway Protocol</p><input type="file" className="hidden" accept="image/*" /></label>}
                   <div className="bg-secondary/20 p-8 rounded-[32px] text-left border border-secondary/30">
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary mb-2">Technical Note</p>
                      <p className="text-sm font-bold text-muted-foreground leading-relaxed">This gateway protocol is automatically projected to customers for digital lease settlement during agreement creation.</p>
                   </div>
                </Card>
             </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

function RateInput({ id, label, enabled, defaultValue, currencySymbol, disabled }: { id: string, label: string, enabled: boolean, defaultValue?: number, currencySymbol: string, disabled?: boolean }) {
  const [isChecked, setIsChecked] = useState(enabled);
  return (
    <div className="flex items-center justify-between gap-6 p-5 bg-secondary/10 rounded-[20px] border border-secondary/20 transition-all hover:bg-secondary/20">
       <div className="flex items-center gap-3">
          <Checkbox id={`${id}Enabled`} name={`${id}Enabled`} checked={isChecked} onCheckedChange={(v) => setIsChecked(!!v)} disabled={disabled} className="h-5 w-5 rounded-lg border-2" />
          <Label htmlFor={`${id}Enabled`} className="text-xs font-black uppercase tracking-widest cursor-pointer">{label}</Label>
       </div>
       <div className="relative w-32">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-black opacity-40">{currencySymbol}</span>
          <Input name={`${id}Rate`} type="number" step="0.01" defaultValue={defaultValue || 0} disabled={!isChecked || disabled} className="h-10 pl-8 pr-3 rounded-xl text-lg font-black text-right tracking-tighter bg-white shadow-inner border-none focus-visible:ring-primary/20" />
       </div>
    </div>
  );
}

function RentAnalytics({ transactions, currencySymbol }: { transactions: SaleTransaction[], currencySymbol: string }) {
  const totalRevenue = transactions.reduce((acc, t) => acc + t.totalAmount, 0);
  const totalProfit = transactions.reduce((acc, t) => acc + t.profit, 0);
  const chartData = useMemo(() => { const daily: Record<string, { date: string, revenue: number, profit: number }> = {}; transactions.forEach(t => { const day = new Date(t.timestamp).toLocaleDateString([], { weekday: 'short' }); if (!daily[day]) daily[day] = { date: day, revenue: 0, profit: 0 }; daily[day].revenue += t.totalAmount; daily[day].profit += t.profit; }); return Object.values(daily).slice(-7); }, [transactions]);
  
  return (
    <div className="space-y-12 pb-16">
       <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <Card className="border-none shadow-xl p-10 bg-white rounded-[40px] flex justify-between items-start group border-2 border-transparent hover:border-primary/10 transition-all"><div><p className="text-[10px] font-black uppercase text-muted-foreground mb-3 tracking-[0.2em]">Aggregate Lease Revenue</p><h4 className="text-4xl font-black tracking-tighter">{currencySymbol}{totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</h4></div><div className="w-14 h-14 bg-secondary/50 rounded-2xl flex items-center justify-center text-primary group-hover:scale-110 transition-transform"><DollarSign className="w-7 h-7" /></div></Card>
          <Card className="border-none shadow-xl p-10 bg-white rounded-[40px] flex justify-between items-start group border-2 border-transparent hover:border-primary/10 transition-all"><div><p className="text-[10px] font-black uppercase text-muted-foreground mb-3 tracking-[0.2em]">Net Rental Yield</p><h4 className="text-4xl font-black text-primary tracking-tighter">{currencySymbol}{totalProfit.toLocaleString(undefined, { minimumFractionDigits: 2 })}</h4></div><div className="w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center text-primary group-hover:scale-110 transition-transform"><TrendingUp className="w-7 h-7" /></div></Card>
          <Card className="border-none shadow-xl p-10 bg-white rounded-[40px] flex justify-between items-start group border-2 border-transparent hover:border-primary/10 transition-all"><div><p className="text-[10px] font-black uppercase text-muted-foreground mb-3 tracking-[0.2em]">Portfolio Performance</p><h4 className="text-4xl font-black tracking-tighter">{totalRevenue > 0 ? ((totalProfit/totalRevenue)*100).toFixed(1) : 0}%</h4></div><div className="w-14 h-14 bg-secondary/50 rounded-2xl flex items-center justify-center text-primary group-hover:scale-110 transition-transform"><ShieldCheck className="w-7 h-7" /></div></Card>
       </div>
       <Card className="border-none shadow-xl p-12 bg-white rounded-[56px] border-4 border-primary/5">
          <CardHeader className="p-0 mb-12">
             <CardTitle className="text-3xl font-black tracking-tighter">Agreement Yield Matrix</CardTitle>
             <p className="text-sm font-bold text-muted-foreground uppercase tracking-widest mt-2">Historical Lease Lifecycle Performance</p>
          </CardHeader>
          <div className="h-[450px]">
             <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                   <defs>
                      <linearGradient id="colorRev" x1="0" x2="0" y2="1">
                         <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                         <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                      </linearGradient>
                   </defs>
                   <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                   <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontWeight: 900, fontSize: 14, fill: 'hsl(var(--muted-foreground))' }}/>
                   <YAxis axisLine={false} tickLine={false} tick={{ fontWeight: 900, fontSize: 14, fill: 'hsl(var(--muted-foreground))' }} tickFormatter={(v) => `${currencySymbol}${v}`}/>
                   <Tooltip contentStyle={{ borderRadius: '32px', border: 'none', boxShadow: '0 30px 60px rgba(0,0,0,0.15)', padding: '24px' }} />
                   <Area type="monotone" dataKey="revenue" stroke="hsl(var(--primary))" fillOpacity={1} fill="url(#colorRev)" strokeWidth={6} name="Lease Revenue"/>
                   <Area type="monotone" dataKey="profit" stroke="hsl(var(--secondary))" fillOpacity={0} strokeWidth={6} strokeDasharray="10 10" name="Realized Yield"/>
                </AreaChart>
             </ResponsiveContainer>
          </div>
       </Card>
    </div>
  );
}

function PaymentOption({ value, label, icon: Icon, id }: any) {
  return (
    <div className="flex-1">
      <RadioGroupItem value={value} id={id} className="peer sr-only" />
      <Label htmlFor={id} className="flex flex-col items-center justify-center rounded-[32px] border-4 border-transparent bg-secondary/20 p-6 hover:bg-secondary/30 peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/5 cursor-pointer h-32 text-center transition-all shadow-inner group">
        <Icon className="mb-2 h-8 w-8 text-primary group-hover:scale-110 transition-transform" />
        <span className="text-[10px] font-black uppercase tracking-[0.2em]">{label}</span>
      </Label>
    </div>
  );
}
