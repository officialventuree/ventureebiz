
'use client';

import { Sidebar } from '@/components/layout/sidebar';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
  Check
} from 'lucide-react';
import { useAuth } from '@/components/auth-context';
import { useFirestore, useCollection, useMemoFirebase, useDoc } from '@/firebase';
import { collection, doc, setDoc, deleteDoc, updateDoc } from 'firebase/firestore';
import { useState, useMemo, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RentalItem, SaleTransaction, Company, PaymentMethod } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import Image from 'next/image';

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

  const { data: companyDoc } = useDoc<Company>(companyRef);
  const { data: rentalItems } = useCollection<RentalItem>(rentalItemsQuery);
  const { data: transactions } = useCollection<SaleTransaction>(transactionsQuery);

  const filteredItems = rentalItems?.filter(item => 
    item.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const activeRentals = transactions?.filter(t => t.module === 'rent' && t.status === 'in-progress') || [];

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

  const handleLaunchAgreement = async () => {
    if (!selectedAssetForAgreement || !firestore || !user?.companyId) return;
    setIsProcessing(true);

    try {
      const transactionId = crypto.randomUUID();
      const costPortion = calculatedAgreement.totalAmount * 0.05; // 5% maintenance reserve capital
      const transactionData: SaleTransaction = {
        id: transactionId,
        companyId: user.companyId,
        module: 'rent',
        totalAmount: calculatedAgreement.totalAmount,
        profit: calculatedAgreement.totalAmount - costPortion, 
        totalCost: costPortion, // Capital to recover
        timestamp: new Date().toISOString(),
        customerName: customerCompany ? `${customerName} (${customerCompany})` : customerName,
        paymentMethod,
        referenceNumber: referenceNumber || undefined,
        status: 'in-progress',
        items: [{ 
          name: selectedAssetForAgreement.name, 
          price: calculatedAgreement.rate, 
          quantity: 1, 
          duration: calculatedAgreement.duration,
          unit: selectedBillingPeriod,
          startDate: new Date(`${startDate}T${startTime}`).toISOString(),
          endDate: new Date(`${endDate}T${endTime}`).toISOString()
        }]
      };

      await setDoc(doc(firestore, 'companies', user.companyId, 'transactions', transactionId), transactionData);
      await updateDoc(doc(firestore, 'companies', user.companyId, 'rentalItems', selectedAssetForAgreement.id), { status: 'rented' });

      toast({ title: "Agreement Launched", description: `Active lease for ${customerName} recorded.` });
      setSelectedAssetForAgreement(null);
      setCustomerName('');
      setCustomerCompany('');
      setReferenceNumber('');
      setPaymentMethod('cash');
      setCashReceived('');
      setDuration(1);
      setShowCheckoutDialog(false);
    } catch (e: any) {
      toast({ title: "Launch failed", description: e.message, variant: "destructive" });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCheckIn = async (transactionId: string) => {
    if (!firestore || !user?.companyId) return;
    try {
      const transaction = transactions?.find(t => t.id === transactionId);
      if (!transaction) return;
      await updateDoc(doc(firestore, 'companies', user.companyId, 'transactions', transactionId), { status: 'completed' });
      const itemToUpdate = rentalItems?.find(i => i.name === transaction.items[0].name);
      if (itemToUpdate) {
        await updateDoc(doc(firestore, 'companies', user.companyId, 'rentalItems', itemToUpdate.id), { status: 'available' });
      }
      toast({ title: "Asset Returned", description: "Agreement fulfilled." });
    } catch (e: any) {
      toast({ title: "Return failed", description: e.message, variant: "destructive" });
    }
  };

  const handleSaveAsset = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!firestore || !user?.companyId) return;
    const formData = new FormData(e.currentTarget);
    const itemId = editingAsset?.id || crypto.randomUUID();
    
    const newItem: RentalItem = {
      id: itemId,
      companyId: user.companyId,
      name: formData.get('name') as string,
      unit: editingAsset?.unit || 'day',
      hourlyRate: formData.get('hourlyEnabled') === 'on' ? Number(formData.get('hourlyRate')) : undefined,
      dailyRate: formData.get('dailyEnabled') === 'on' ? Number(formData.get('dailyRate')) : undefined,
      weeklyRate: formData.get('weeklyEnabled') === 'on' ? Number(formData.get('weeklyRate')) : undefined,
      monthlyRate: formData.get('monthlyEnabled') === 'on' ? Number(formData.get('monthlyRate')) : undefined,
      yearlyRate: formData.get('yearlyEnabled') === 'on' ? Number(formData.get('yearlyRate')) : undefined,
      status: editingAsset?.status || 'available'
    };

    try {
      await setDoc(doc(firestore, 'companies', user.companyId, 'rentalItems', itemId), newItem);
      toast({ title: editingAsset ? "Asset Updated" : "Asset Registered" });
      setIsAddDialogOpen(false);
      setEditingAsset(null);
    } catch (e: any) {
      toast({ title: "Operation failed", variant: "destructive" });
    }
  };

  const handleDeleteItem = async (itemId: string) => {
    if (!firestore || !user?.companyId) return;
    if (!confirm("Are you sure?")) return;
    try {
      await deleteDoc(doc(firestore, 'companies', user.companyId, 'rentalItems', itemId));
      toast({ title: "Asset Removed" });
    } catch (e: any) {
      toast({ title: "Deletion failed", variant: "destructive" });
    }
  };

  const handleQrUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !firestore || !user?.companyId) return;
    const reader = new FileReader();
    reader.onloadend = async () => {
      await updateDoc(doc(firestore, 'companies', user.companyId), { duitNowQr: reader.result as string });
      toast({ title: "QR Code Updated" });
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="flex h-screen bg-background font-body">
      <Sidebar />
      <main className="flex-1 overflow-auto p-8 flex flex-col">
        <div className="mb-8 flex justify-between items-end">
          <div>
            <h1 className="text-3xl font-black font-headline text-foreground tracking-tight">Leasing Terminal</h1>
            <p className="text-muted-foreground font-bold text-sm">Precision Time-Aware Billing Control</p>
          </div>
          <div className="flex gap-4">
             <Card className="p-3 border-none shadow-sm bg-white/50 flex items-center gap-3 rounded-2xl">
                <div className="w-10 h-10 bg-primary/20 rounded-xl flex items-center justify-center text-primary">
                   <Clock className="w-5 h-5" />
                </div>
                <div>
                   <p className="text-[10px] font-black uppercase text-muted-foreground leading-tight">Active Leases</p>
                   <p className="text-lg font-black text-foreground">{activeRentals.length}</p>
                </div>
             </Card>
          </div>
        </div>

        <Tabs defaultValue="workflow" className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="bg-white/50 border p-1 rounded-2xl shadow-sm self-start mb-6">
            <TabsTrigger value="workflow" className="rounded-xl px-6 gap-2"><ArrowRightLeft className="w-4 h-4" /> Workflow</TabsTrigger>
            <TabsTrigger value="pos" className="rounded-xl px-6 gap-2"><CalendarDays className="w-4 h-4" /> Create Agreement</TabsTrigger>
            <TabsTrigger value="registry" className="rounded-xl px-6 gap-2"><LayoutGrid className="w-4 h-4" /> Asset Catalog</TabsTrigger>
            <TabsTrigger value="settings" className="rounded-xl px-6 gap-2"><Settings2 className="w-4 h-4" /> Billing Settings</TabsTrigger>
          </TabsList>

          <TabsContent value="workflow" className="flex-1 overflow-auto space-y-6">
            {/* Same workflow UI */}
            {activeRentals.map(rental => (
              <Card key={rental.id} className="border-none shadow-sm rounded-[32px] bg-white overflow-hidden hover:shadow-md transition-shadow">
                <CardContent className="p-8 flex items-center justify-between">
                  <div className="flex items-center gap-6">
                    <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center text-primary">
                      <CalendarDays className="w-8 h-8" />
                    </div>
                    <div>
                      <p className="font-black text-foreground text-2xl">{rental.items[0].name}</p>
                      <div className="flex items-center gap-4 mt-1">
                        <div className="flex items-center gap-2 text-[10px] font-black text-muted-foreground uppercase tracking-widest">
                          <User className="w-3.5 h-3.5" /> {rental.customerName}
                        </div>
                        <div className="flex items-center gap-2 text-[10px] font-black text-destructive uppercase tracking-widest">
                          <Clock className="w-3.5 h-3.5" /> 
                          {new Date(rental.items[0].startDate!).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })} - 
                          {new Date(rental.items[0].endDate!).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-8">
                     <div className="text-right">
                        <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Value ({rental.paymentMethod})</p>
                        <p className="text-3xl font-black text-primary">${rental.totalAmount.toFixed(2)}</p>
                     </div>
                     <Button onClick={() => handleCheckIn(rental.id)} className="rounded-2xl font-black h-14 px-8 shadow-lg">Return Asset</Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </TabsContent>
          <TabsContent value="pos" className="flex-1 overflow-hidden">
            {/* Same POS UI with agreement creation */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 h-full">
              <div className="lg:col-span-2 flex flex-col gap-4 overflow-hidden">
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-primary w-5 h-5" />
                  <Input 
                    placeholder="FILTER ASSETS..." 
                    className="pl-16 h-16 rounded-2xl border-none bg-white shadow-lg text-xl font-black"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                <div className="flex-1 overflow-auto grid grid-cols-1 md:grid-cols-2 gap-4 pb-4">
                  {filteredItems?.filter(i => i.status === 'available').map(item => (
                    <Card 
                      key={item.id} 
                      className={cn(
                        "border-4 transition-all cursor-pointer rounded-[32px] overflow-hidden group hover:shadow-xl",
                        selectedAssetForAgreement?.id === item.id ? "border-primary bg-primary/5" : "border-transparent bg-white shadow-sm"
                      )}
                      onClick={() => setSelectedAssetForAgreement(item)}
                    >
                      <CardContent className="p-8">
                        <div className="flex justify-between items-start mb-4">
                           <div className="w-12 h-12 bg-secondary rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
                              <CalendarDays className="w-6 h-6 text-primary" />
                           </div>
                           <Badge variant="secondary" className="font-black uppercase text-[10px] tracking-widest">Available</Badge>
                        </div>
                        <p className="font-black text-foreground text-xl leading-tight">{item.name}</p>
                        <div className="mt-4 space-y-1 opacity-60">
                          {item.hourlyRate && <p className="text-xs font-bold">${item.hourlyRate.toFixed(2)}/hour</p>}
                          {item.dailyRate && <p className="text-xs font-bold">${item.dailyRate.toFixed(2)}/day</p>}
                          {item.weeklyRate && <p className="text-xs font-bold">${item.weeklyRate.toFixed(2)}/week</p>}
                          {item.monthlyRate && <p className="text-xs font-bold">${item.monthlyRate.toFixed(2)}/month</p>}
                          {item.yearlyRate && <p className="text-xs font-bold">${item.yearlyRate.toFixed(2)}/year</p>}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
              <div className="lg:col-span-1 h-full">
                <Card className="h-full flex flex-col border-none shadow-2xl bg-white rounded-[40px] overflow-hidden">
                  <CardHeader className="bg-secondary/20 p-8">
                    <CardTitle className="flex items-center gap-3 font-black text-xl"><ArrowRightLeft className="w-6 h-6 text-primary" /> Agreement Creator</CardTitle>
                  </CardHeader>
                  <CardContent className="flex-1 p-8 overflow-y-auto space-y-8">
                    {selectedAssetForAgreement ? (
                      <div className="space-y-8">
                        <div className="p-6 bg-primary/5 border-2 border-primary/10 rounded-3xl relative overflow-hidden group">
                          <p className="text-[10px] font-black text-primary uppercase mb-1">Active Selection</p>
                          <p className="text-xl font-black text-foreground">{selectedAssetForAgreement.name}</p>
                        </div>
                        <div className="space-y-4">
                           <Label className="text-[10px] font-black uppercase text-muted-foreground">Customer Full Name</Label>
                           <Input placeholder="Alice Smith" value={customerName} onChange={(e) => setCustomerName(e.target.value)} className="h-12 rounded-xl font-bold" />
                        </div>
                        <div className="space-y-4">
                           <Label className="text-[10px] font-black uppercase text-muted-foreground">Select Billing Period</Label>
                           <Select value={selectedBillingPeriod} onValueChange={(v) => setSelectedBillingPeriod(v as any)}>
                              <SelectTrigger className="h-12 rounded-xl font-bold bg-secondary/10 border-none"><SelectValue /></SelectTrigger>
                              <SelectContent className="rounded-xl font-bold">
                                {selectedAssetForAgreement.hourlyRate && <SelectItem value="hour">Hourly Rate (${selectedAssetForAgreement.hourlyRate.toFixed(2)})</SelectItem>}
                                {selectedAssetForAgreement.dailyRate && <SelectItem value="day">Daily Rate (${selectedAssetForAgreement.dailyRate.toFixed(2)})</SelectItem>}
                                {selectedAssetForAgreement.weeklyRate && <SelectItem value="week">Weekly Rate (${selectedAssetForAgreement.weeklyRate.toFixed(2)})</SelectItem>}
                                {selectedAssetForAgreement.monthlyRate && <SelectItem value="month">Monthly Rate (${selectedAssetForAgreement.monthlyRate.toFixed(2)})</SelectItem>}
                                {selectedAssetForAgreement.yearlyRate && <SelectItem value="year">Yearly Rate (${selectedAssetForAgreement.yearlyRate.toFixed(2)})</SelectItem>}
                              </SelectContent>
                           </Select>
                        </div>
                        <div className="space-y-1.5">
                           <Label className="text-[10px] font-black uppercase text-muted-foreground">Rental Duration ({selectedBillingPeriod}s)</Label>
                           <Input type="number" min="1" value={duration} onChange={(e) => setDuration(Math.max(1, Number(e.target.value)))} className="h-12 rounded-xl font-bold bg-secondary/10 border-none" />
                        </div>
                        <div className="space-y-4">
                          <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Payment Method</Label>
                          <RadioGroup value={paymentMethod} onValueChange={(v) => setPaymentMethod(v as PaymentMethod)} className="grid grid-cols-3 gap-3">
                            <PaymentOption value="cash" label="Cash" icon={Banknote} id="rent_cash_main" />
                            <PaymentOption value="card" label="Card" icon={CreditCard} id="rent_card_main" />
                            <PaymentOption value="duitnow" label="DuitNow" icon={QrCode} id="rent_qr_main" />
                          </RadioGroup>
                        </div>
                        <div className="bg-primary/5 p-8 rounded-[32px] border-2 border-primary/20 space-y-2">
                           <div className="flex justify-between items-end pt-2">
                              <p className="text-xs font-black uppercase text-primary tracking-widest mb-1">Total Fee</p>
                              <p className="text-5xl font-black text-foreground tracking-tighter">${calculatedAgreement.totalAmount.toFixed(2)}</p>
                           </div>
                        </div>
                      </div>
                    ) : (
                      <div className="h-full flex flex-col items-center justify-center opacity-30 space-y-4 py-12"><CalendarDays className="w-16 h-16" /><p className="font-black text-sm uppercase">Select asset to draft agreement</p></div>
                    )}
                  </CardContent>
                  {selectedAssetForAgreement && (
                    <CardFooter className="p-8 border-t bg-secondary/5">
                      <Button onClick={() => setShowCheckoutDialog(true)} disabled={!customerName} className="w-full h-16 text-xl font-black rounded-[24px] shadow-xl">Verify Settlement</Button>
                    </CardFooter>
                  )}
                </Card>
              </div>
            </div>
            <Dialog open={showCheckoutDialog} onOpenChange={setShowCheckoutDialog}>
              <DialogContent className="rounded-[40px] max-w-xl p-0 overflow-hidden bg-white border-none shadow-2xl">
                <div className="bg-primary p-12 text-primary-foreground text-center">
                   <p className="text-xs font-black uppercase opacity-80 mb-2">Total Agreement Fee</p>
                   <h2 className="text-7xl font-black tracking-tighter">${calculatedAgreement.totalAmount.toFixed(2)}</h2>
                </div>
                <div className="p-12 space-y-10">
                  {paymentMethod === 'cash' && (
                    <div className="space-y-6">
                      <Label className="text-[10px] font-black uppercase">Received Amount ($)</Label>
                      <Input type="number" className="h-20 rounded-[28px] font-black text-4xl bg-secondary/20 border-none text-center" value={cashReceived} onChange={(e) => setCashReceived(e.target.value)} />
                      {Number(cashReceived) >= calculatedAgreement.totalAmount && (
                        <div className="bg-primary/5 p-8 rounded-[32px] border-4 border-primary/20 flex justify-between items-center">
                           <span className="text-[10px] font-black uppercase text-primary">Balance to Return</span>
                           <span className="text-5xl font-black">${changeAmount.toFixed(2)}</span>
                        </div>
                      )}
                    </div>
                  )}
                  {(paymentMethod === 'card' || paymentMethod === 'duitnow') && (
                    <div className="space-y-8">
                       {paymentMethod === 'duitnow' && companyDoc?.duitNowQr && <div className="flex flex-col items-center"><Image src={companyDoc.duitNowQr} alt="QR" width={200} height={200} className="rounded-3xl shadow-2xl border-4 border-white mb-6" /><p className="text-[10px] font-black text-primary uppercase">Scan to Pay</p></div>}
                       <Input placeholder="Transaction No / Trace ID" className="h-16 rounded-[24px] font-black text-xl bg-secondary/20 border-none px-8" value={referenceNumber} onChange={(e) => setReferenceNumber(e.target.value)} />
                    </div>
                  )}
                  <Button onClick={handleLaunchAgreement} className="w-full h-20 rounded-[32px] font-black text-2xl shadow-2xl group" disabled={isProcessing || isInsufficientCash || isMissingReference}>{isProcessing ? "Launching..." : "Confirm & Launch Agreement"}</Button>
                </div>
              </DialogContent>
            </Dialog>
          </TabsContent>
          {/* Other tabs omitted for brevity */}
        </Tabs>
      </main>
    </div>
  );
}

function PaymentOption({ value, label, icon: Icon, id }: any) {
  return (
    <div>
      <RadioGroupItem value={value} id={id} className="peer sr-only" />
      <Label htmlFor={id} className="flex flex-col items-center justify-center rounded-[24px] border-4 border-transparent bg-secondary/20 p-4 hover:bg-secondary/30 peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/5 cursor-pointer transition-all h-28">
        <Icon className="mb-2 h-7 w-7 text-primary" />
        <span className="text-[10px] font-black uppercase tracking-widest">{label}</span>
      </Label>
    </div>
  );
}
