
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
      <main className="flex-1 overflow-auto p-8 flex flex-col">
        <div className="mb-8 flex justify-between items-end">
          <div><h1 className="text-3xl font-black font-headline text-foreground tracking-tight">Leasing Terminal</h1><p className="text-muted-foreground font-bold text-sm">Precision Time-Aware Billing Control</p></div>
          <div className="flex gap-4">
             <Card className="p-3 border-none shadow-sm bg-white/50 flex items-center gap-3 rounded-2xl mr-4"><div className={cn("w-10 h-10 rounded-xl flex items-center justify-center", remainingBudget > 0 ? "bg-primary/20 text-primary" : "bg-destructive/20 text-destructive")}><Wallet className="w-5 h-5" /></div><div><p className="text-[10px] font-black uppercase text-muted-foreground">Cycle Budget</p><p className={cn("text-lg font-black", remainingBudget <= 0 && "text-destructive")}>{currencySymbol}{remainingBudget.toFixed(2)}</p></div></Card>
             <Card className="p-3 border-none shadow-sm bg-white/50 flex items-center gap-3 rounded-2xl"><div className="w-10 h-10 bg-primary/20 rounded-xl flex items-center justify-center text-primary"><Clock className="w-5 h-5" /></div><div><p className="text-[10px] font-black uppercase text-muted-foreground">Active Leases</p><p className="text-lg font-black">{activeRentals.length}</p></div></Card>
          </div>
        </div>

        {!isBudgetActive && <Alert variant="destructive" className="mb-6 rounded-2xl bg-destructive/10 border-destructive/20"><AlertTriangle className="h-4 w-4" /><AlertTitle className="font-black uppercase text-xs tracking-widest">Financial Guardrail Alert</AlertTitle><AlertDescription className="text-sm font-medium">Note: Your <strong>Capital Base Limit</strong> is not set. <Link href="/company/capital" className="underline font-black">Configure budget</Link></AlertDescription></Alert>}

        <Tabs defaultValue="workflow" className="flex-1 flex flex-col">
          <TabsList className="bg-white/50 border p-1 rounded-2xl shadow-sm self-start mb-6 shrink-0"><TabsTrigger value="workflow" className="rounded-xl px-6 gap-2 font-black"><ArrowRightLeft className="w-4 h-4" /> Workflow</TabsTrigger><TabsTrigger value="pos" className="rounded-xl px-6 gap-2 font-black"><CalendarDays className="w-4 h-4" /> Create Agreement</TabsTrigger><TabsTrigger value="registry" className="rounded-xl px-6 gap-2 font-black"><LayoutGrid className="w-4 h-4" /> Asset Catalog</TabsTrigger><TabsTrigger value="analysis" className="rounded-xl px-6 gap-2 font-black"><BarChart3 className="w-4 h-4" /> Analysis</TabsTrigger><TabsTrigger value="settings" className="rounded-xl px-6 gap-2 font-black"><Settings2 className="w-4 h-4" /> Gateway</TabsTrigger></TabsList>

          <TabsContent value="workflow" className="flex-1 space-y-6">
            {activeRentals.length === 0 ? <div className="py-24 text-center border-4 border-dashed rounded-[40px] bg-white/50"><CalendarDays className="w-16 h-16 mx-auto mb-4 opacity-10" /><p className="font-black text-muted-foreground text-lg uppercase tracking-widest">No Active Agreements</p></div> : activeRentals.map(rental => (
              <Card key={rental.id} className="border-none shadow-sm rounded-[32px] bg-white overflow-hidden hover:shadow-md transition-shadow">
                <CardContent className="p-8 flex items-center justify-between">
                  <div className="flex items-center gap-6"><div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center text-primary"><CalendarDays className="w-8 h-8" /></div><div><p className="font-black text-foreground text-2xl">{rental.items[0].name}</p><div className="flex items-center gap-4 mt-1"><div className="flex items-center gap-2 text-[10px] font-black text-muted-foreground uppercase"><User className="w-3.5 h-3.5" /> {rental.customerName}</div><div className="flex items-center gap-2 text-[10px] font-black text-destructive uppercase"><Clock className="w-3.5 h-3.5" /> {new Date(rental.items[0].endDate!).toLocaleString()}</div></div></div></div>
                  <div className="flex items-center gap-8"><div className="text-right"><p className="text-[10px] font-black text-muted-foreground uppercase">Value ({rental.paymentMethod})</p><p className="text-3xl font-black text-primary">{currencySymbol}{rental.totalAmount.toFixed(2)}</p></div><Button onClick={() => handleCheckIn(rental.id)} className="rounded-2xl font-black h-14 px-8 shadow-lg">Return Asset</Button></div>
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          <TabsContent value="pos" className="flex-1">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2 space-y-4">
                <div className="relative"><Search className="absolute left-4 top-1/2 -translate-y-1/2 text-primary w-5 h-5" /><Input placeholder="FILTER ASSETS..." className="pl-16 h-16 rounded-2xl border-none bg-white shadow-lg text-xl font-black" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}/></div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pb-4">
                  {filteredItems?.filter(i => i.status === 'available').map(item => (
                    <Card key={item.id} className={cn("border-4 transition-all cursor-pointer rounded-[32px] overflow-hidden group hover:shadow-xl", selectedAssetForAgreement?.id === item.id ? "border-primary bg-primary/5" : "border-transparent bg-white shadow-sm")} onClick={() => setSelectedAssetForAgreement(item)}>
                      <CardContent className="p-8">
                        <div className="flex justify-between items-start mb-4"><div className="w-12 h-12 bg-secondary rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform"><CalendarDays className="w-6 h-6 text-primary" /></div><Badge variant="secondary" className="font-black uppercase text-[10px]">Available</Badge></div>
                        <p className="font-black text-foreground text-xl leading-tight">{item.name}</p>
                        <div className="mt-4 space-y-1 opacity-60">
                          {item.hourlyRate && <p className="text-xs font-bold">{currencySymbol}{item.hourlyRate.toFixed(2)}/hour</p>}
                          {item.dailyRate && <p className="text-xs font-bold">{currencySymbol}{item.dailyRate.toFixed(2)}/day</p>}
                          {item.weeklyRate && <p className="text-xs font-bold">{currencySymbol}{item.weeklyRate.toFixed(2)}/week</p>}
                          {item.monthlyRate && <p className="text-xs font-bold">{currencySymbol}{item.monthlyRate.toFixed(2)}/month</p>}
                          {item.yearlyRate && <p className="text-xs font-bold">{currencySymbol}{item.yearlyRate.toFixed(2)}/year</p>}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
              <div className="lg:col-span-1">
                <Card className="sticky top-8 border-none shadow-2xl bg-white rounded-[40px] overflow-hidden flex flex-col max-h-[calc(100vh-120px)]">
                  <CardHeader className="bg-secondary/20 p-8"><CardTitle className="flex items-center gap-3 font-black text-xl"><ArrowRightLeft className="w-6 h-6 text-primary" /> Agreement Creator</CardTitle></CardHeader>
                  <CardContent className="flex-1 p-8 overflow-y-auto space-y-8">
                    {selectedAssetForAgreement ? (
                      <div className="space-y-8 pb-4">
                        <div className="p-6 bg-primary/5 border-2 border-primary/10 rounded-3xl relative"><p className="text-[10px] font-black text-primary uppercase">Selection</p><p className="text-xl font-black">{selectedAssetForAgreement.name}</p></div>
                        <div className="space-y-4"><Label className="text-[10px] font-black uppercase">Customer Name</Label><Input placeholder="Alice Smith" value={customerName} onChange={(e) => setCustomerName(e.target.value)} className="h-12 rounded-xl font-bold bg-secondary/10 border-none px-4" /></div>
                        <div className="space-y-4"><Label className="text-[10px] font-black uppercase">Billing Period</Label><Select value={selectedBillingPeriod} onValueChange={(v) => setSelectedBillingPeriod(v as any)}><SelectTrigger className="h-12 rounded-xl bg-secondary/10 border-none font-bold px-4"><SelectValue /></SelectTrigger><SelectContent className="rounded-xl font-bold">{selectedAssetForAgreement.hourlyRate && <SelectItem value="hour">Hourly ({currencySymbol}{selectedAssetForAgreement.hourlyRate.toFixed(2)})</SelectItem>}{selectedAssetForAgreement.dailyRate && <SelectItem value="day">Daily ({currencySymbol}{selectedAssetForAgreement.dailyRate.toFixed(2)})</SelectItem>}{selectedAssetForAgreement.weeklyRate && <SelectItem value="week">Weekly ({currencySymbol}{selectedAssetForAgreement.weeklyRate.toFixed(2)})</SelectItem>}{selectedAssetForAgreement.monthlyRate && <SelectItem value="month">Monthly ({currencySymbol}{selectedAssetForAgreement.monthlyRate.toFixed(2)})</SelectItem>}{selectedAssetForAgreement.yearlyRate && <SelectItem value="year">Yearly ({currencySymbol}{selectedAssetForAgreement.yearlyRate.toFixed(2)})</SelectItem>}</SelectContent></Select></div>
                        <div className="space-y-4"><div className="flex justify-between items-center px-1"><Label className="text-[10px] font-black uppercase">Duration</Label><Badge variant="secondary" className="font-black text-[10px] uppercase">{duration} {selectedBillingPeriod}</Badge></div><div className="flex items-center gap-4 p-4 bg-secondary/5 rounded-2xl"><Input type="number" min="1" value={duration} onChange={(e) => setDuration(Math.max(1, Number(e.target.value)))} className="w-20 h-12 rounded-xl bg-white border-none text-center shadow-sm" /><Slider value={[duration]} min={1} max={sliderMax} step={1} onValueChange={(v) => setDuration(v[0])} className="flex-1" /></div></div>
                        <div className="space-y-4"><Label className="text-[10px] font-black uppercase tracking-widest px-1">Settlement Method</Label><RadioGroup value={paymentMethod} onValueChange={(v) => { setPaymentMethod(v as PaymentMethod); setCashReceived(''); setReferenceNumber(''); }} className="grid grid-cols-3 gap-3"><PaymentOption value="cash" label="Cash" icon={Banknote} id="rent_cash_main" /><PaymentOption value="card" label="Card" icon={CreditCard} id="rent_card_main" /><PaymentOption value="duitnow" label="Digital" icon={QrCode} id="rent_qr_main" /></RadioGroup></div>
                        <div className="bg-primary/5 p-8 rounded-[32px] border-2 border-primary/10 flex justify-between items-end"><div><p className="text-xs font-black uppercase text-primary">Total Fee</p><p className="text-5xl font-black tracking-tighter">{currencySymbol}{calculatedAgreement.totalAmount.toFixed(2)}</p></div></div>
                      </div>
                    ) : <div className="py-24 text-center opacity-30 space-y-4"><CalendarDays className="w-16 h-16 mx-auto" /><p className="font-black text-sm uppercase">Select an asset to begin</p></div>}
                  </CardContent>
                  {selectedAssetForAgreement && <CardFooter className="p-8 border-t bg-secondary/5"><Button onClick={() => setShowCheckoutDialog(true)} disabled={!customerName} className="w-full h-16 text-xl font-black rounded-[24px] shadow-xl">Verify Settlement</Button></CardFooter>}
                </Card>
              </div>
            </div>
            
            <Dialog open={showCheckoutDialog} onOpenChange={setShowCheckoutDialog}>
              <DialogContent className="rounded-[40px] max-w-xl p-0 overflow-hidden bg-white border-none shadow-2xl">
                <div className="bg-primary p-12 text-primary-foreground text-center"><DialogTitle className="text-xs font-black uppercase mb-2">Checkout Verification</DialogTitle><h2 className="text-7xl font-black tracking-tighter">{currencySymbol}{calculatedAgreement.totalAmount.toFixed(2)}</h2></div>
                <div className="p-12 space-y-10">
                  {paymentMethod === 'cash' && (<div className="space-y-6"><div className="space-y-2"><Label className="text-[10px] font-black uppercase px-1">Amount Paid ({currencySymbol})</Label><Input type="number" className="h-20 rounded-[28px] font-black text-4xl bg-secondary/20 border-none text-center" value={cashReceived} onChange={(e) => setCashReceived(e.target.value)} /></div>{Number(cashReceived) >= calculatedAgreement.totalAmount && (<div className="bg-primary/5 p-8 rounded-[32px] border-4 border-primary/20 flex justify-between items-center animate-in fade-in zoom-in-95"><span className="text-[10px] font-black uppercase text-primary">Balance</span><span className="text-5xl font-black">{currencySymbol}{changeAmount.toFixed(2)}</span></div>)}</div>)}
                  {(paymentMethod === 'card' || paymentMethod === 'duitnow') && (<div className="space-y-2"><Label className="text-[10px] font-black uppercase px-1">Transaction Ref</Label><Input placeholder="Enter reference..." className="h-16 rounded-[24px] font-black text-xl bg-secondary/20 border-none px-8" value={referenceNumber} onChange={(e) => setReferenceNumber(e.target.value)} /></div>)}
                  <Button onClick={handleLaunchAgreement} className="w-full h-20 rounded-[32px] font-black text-2xl shadow-xl" disabled={isProcessing || isInsufficientCash || isMissingReference}>Confirm & Launch Agreement</Button>
                </div>
              </DialogContent>
            </Dialog>
          </TabsContent>

          <TabsContent value="registry" className="grid grid-cols-1 lg:grid-cols-4 gap-8">
             <div className="lg:col-span-1"><Card className={cn("border-none shadow-sm rounded-3xl bg-white p-8 sticky top-8", !canProcure && !editingAsset && "grayscale opacity-80")}><h3 className="text-xl font-black mb-6">{editingAsset ? 'Edit Asset' : 'New Registry'}</h3><form onSubmit={handleSaveAsset} className="space-y-5"><div className="space-y-1.5"><Label className="text-[10px] font-black uppercase">Asset Name</Label><Input name="name" defaultValue={editingAsset?.name} required className="h-11 rounded-xl bg-secondary/10 border-none font-bold px-4" /></div><div className="space-y-1.5"><Label className="text-[10px] font-black uppercase">Cost Price ({currencySymbol})</Label><Input name="costPrice" type="number" step="0.01" defaultValue={editingAsset?.costPrice} required disabled={!!editingAsset} className="h-11 rounded-xl bg-secondary/10 border-none font-bold px-4 text-primary" /></div><Separator /><p className="text-[10px] font-black uppercase text-primary tracking-widest px-1">Rates</p><div className="space-y-4"><RateInput id="hourly" label="Hourly" enabled={!!editingAsset?.hourlyRate} defaultValue={editingAsset?.hourlyRate} currencySymbol={currencySymbol} /><RateInput id="daily" label="Daily" enabled={!!editingAsset?.dailyRate || !editingAsset} defaultValue={editingAsset?.dailyRate} currencySymbol={currencySymbol} /><RateInput id="weekly" label="Weekly" enabled={!!editingAsset?.weeklyRate} defaultValue={editingAsset?.weeklyRate} currencySymbol={currencySymbol} /><RateInput id="monthly" label="Monthly" enabled={!!editingAsset?.monthlyRate} defaultValue={editingAsset?.monthlyRate} currencySymbol={currencySymbol} /><RateInput id="yearly" label="Yearly" enabled={!!editingAsset?.yearlyRate} defaultValue={editingAsset?.yearlyRate} currencySymbol={currencySymbol} /></div><Button type="submit" className="w-full h-12 rounded-xl font-black shadow-lg mt-4" disabled={(!canProcure && !editingAsset)}>{editingAsset ? "Update" : "Save"}</Button></form></Card></div>
             <div className="lg:col-span-3"><div className="bg-white rounded-[32px] border shadow-sm overflow-hidden"><table className="w-full text-sm text-left"><thead className="bg-secondary/20"><tr><th className="p-6 font-black uppercase text-[10px]">Asset Name</th><th className="p-6 font-black uppercase text-[10px]">Active Rates</th><th className="p-6 font-black uppercase text-[10px]">ROI Recovery</th><th className="p-6 font-black uppercase text-[10px]">Status</th><th className="p-6 text-center font-black uppercase text-[10px]">Action</th></tr></thead><tbody className="divide-y">{rentalItems?.map(item => { const cost = item.costPrice || 0; const rev = item.accumulatedRevenue || 0; const isPaidOff = rev >= cost; return (<tr key={item.id} className="hover:bg-secondary/5 group"><td className="p-6"><p className="font-black text-lg">{item.name}</p></td><td className="p-6"><div className="flex flex-wrap gap-1">{item.dailyRate && <Badge variant="outline" className="text-[9px]">D: {currencySymbol}{item.dailyRate}</Badge>}</div></td><td className="p-6"><div><p className="text-[10px] font-black text-muted-foreground uppercase">Cost: {currencySymbol}{cost.toFixed(2)}</p><p className={cn("text-sm font-black", isPaidOff ? "text-primary" : "text-orange-600")}>Rev: {currencySymbol}{rev.toFixed(2)}</p></div></td><td className="p-6"><Badge className={cn("font-black uppercase text-[9px]", item.status === 'available' ? "bg-green-600" : "bg-primary")}>{item.status}</Badge></td><td className="p-6 text-center"><div className="flex justify-center gap-2"><Button variant="ghost" size="icon" onClick={() => setEditingAsset(item)} className="text-primary"><Edit2 className="w-4 h-4" /></Button><Button variant="ghost" size="icon" onClick={() => handleDeleteItem(item.id)} className="text-destructive"><Trash2 className="w-4 h-4" /></Button></div></td></tr>); })}</tbody></table></div></div>
          </TabsContent>

          <TabsContent value="analysis" className="space-y-8"><RentAnalytics transactions={rentTransactions} currencySymbol={currencySymbol} /></TabsContent>

          <TabsContent value="settings">
             <div className="max-w-xl mx-auto py-12 text-center space-y-8"><Card className="border-none shadow-sm rounded-[40px] bg-white p-12 space-y-8"><div className="w-20 h-20 bg-primary/10 rounded-3xl flex items-center justify-center text-primary mx-auto"><QrCode className="w-10 h-10" /></div><h2 className="text-3xl font-black">Digital Lease Gateway</h2>{companyDoc?.duitNowQr ? (<div className="relative group w-fit mx-auto"><Image src={companyDoc.duitNowQr} alt="QR" width={200} height={200} className="rounded-3xl border-4" /><label className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center rounded-3xl cursor-pointer transition-opacity"><Upload className="text-white w-8 h-8" /><input type="file" className="hidden" accept="image/*" onChange={(e) => { const file = e.target.files?.[0]; if(file) { const reader = new FileReader(); reader.onloadend = () => updateDoc(doc(firestore!, 'companies', user!.companyId!), { duitNowQr: reader.result as string }); reader.readAsDataURL(file); } }} /></label></div>) : <label className="py-20 border-4 border-dashed rounded-[40px] opacity-30 cursor-pointer flex flex-col items-center justify-center gap-4"><Plus className="w-12 h-12" /><input type="file" className="hidden" accept="image/*" /></label>}</Card></div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

function RateInput({ id, label, enabled, defaultValue, currencySymbol, disabled }: { id: string, label: string, enabled: boolean, defaultValue?: number, currencySymbol: string, disabled?: boolean }) {
  const [isChecked, setIsChecked] = useState(enabled);
  return (
    <div className="flex items-center justify-between gap-4 p-3 bg-secondary/10 rounded-2xl">
       <div className="flex items-center gap-2"><Checkbox id={`${id}Enabled`} name={`${id}Enabled`} checked={isChecked} onCheckedChange={(v) => setIsChecked(!!v)} disabled={disabled} /><Label htmlFor={`${id}Enabled`} className="text-xs font-bold">{label}</Label></div>
       <div className="relative w-24"><span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] font-bold opacity-50">{currencySymbol}</span><Input name={`${id}Rate`} type="number" step="0.01" defaultValue={defaultValue || 0} disabled={!isChecked || disabled} className="h-8 pl-6 pr-2 rounded-lg text-xs font-black text-right" /></div>
    </div>
  );
}

function RentAnalytics({ transactions, currencySymbol }: { transactions: SaleTransaction[], currencySymbol: string }) {
  const totalRevenue = transactions.reduce((acc, t) => acc + t.totalAmount, 0);
  const totalProfit = transactions.reduce((acc, t) => acc + t.profit, 0);
  const chartData = useMemo(() => { const daily: Record<string, { date: string, revenue: number, profit: number }> = {}; transactions.forEach(t => { const day = new Date(t.timestamp).toLocaleDateString([], { weekday: 'short' }); if (!daily[day]) daily[day] = { date: day, revenue: 0, profit: 0 }; daily[day].revenue += t.totalAmount; daily[day].profit += t.profit; }); return Object.values(daily).slice(-7); }, [transactions]);
  return (
    <div className="space-y-10">
       <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="border-none shadow-sm p-8 bg-white rounded-[32px] flex justify-between items-start"><div><p className="text-[10px] font-black uppercase text-muted-foreground mb-2">Aggregate Lease Revenue</p><h4 className="text-4xl font-black">{currencySymbol}{totalRevenue.toFixed(2)}</h4></div><div className="w-12 h-12 bg-secondary rounded-2xl flex items-center justify-center text-primary"><DollarSign className="w-6 h-6" /></div></Card>
          <Card className="border-none shadow-sm p-8 bg-white rounded-[32px] flex justify-between items-start"><div><p className="text-[10px] font-black uppercase text-muted-foreground mb-2">Net Rental Yield</p><h4 className="text-4xl font-black text-primary">{currencySymbol}{totalProfit.toFixed(2)}</h4></div><div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center text-primary"><TrendingUp className="w-6 h-6" /></div></Card>
          <Card className="border-none shadow-sm p-8 bg-white rounded-[32px] flex justify-between items-start"><div><p className="text-[10px] font-black uppercase text-muted-foreground mb-2">Portfolio Efficiency</p><h4 className="text-4xl font-black">{totalRevenue > 0 ? ((totalProfit/totalRevenue)*100).toFixed(1) : 0}%</h4></div><div className="w-12 h-12 bg-secondary rounded-2xl flex items-center justify-center text-primary"><ShieldCheck className="w-6 h-6" /></div></Card>
       </div>
       <Card className="border-none shadow-sm p-10 bg-white rounded-[40px]"><div className="h-[400px]"><ResponsiveContainer width="100%" height="100%"><AreaChart data={chartData}><defs><linearGradient id="colorRev" x1="0" x2="0" y2="1"><stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/><stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/></linearGradient></defs><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="date" axisLine={false} tickLine={false}/><YAxis axisLine={false} tickLine={false} tickFormatter={(v) => `${currencySymbol}${v}`}/><Tooltip /><Area type="monotone" dataKey="revenue" stroke="hsl(var(--primary))" fillOpacity={1} fill="url(#colorRev)" strokeWidth={4}/><Area type="monotone" dataKey="profit" stroke="hsl(var(--secondary))" fillOpacity={0} strokeWidth={4} strokeDasharray="5 5"/></AreaChart></ResponsiveContainer></div></Card>
    </div>
  );
}

function PaymentOption({ value, label, icon: Icon, id }: any) {
  return (
    <div className="flex-1">
      <RadioGroupItem value={value} id={id} className="peer sr-only" />
      <Label htmlFor={id} className="flex flex-col items-center justify-center rounded-[24px] border-4 border-transparent bg-secondary/20 p-4 hover:bg-secondary/30 peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/5 cursor-pointer h-28 text-center">
        <Icon className="mb-2 h-6 w-6 text-primary" />
        <span className="text-[10px] font-black uppercase tracking-widest">{label}</span>
      </Label>
    </div>
  );
}
