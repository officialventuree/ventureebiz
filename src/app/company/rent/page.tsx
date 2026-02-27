
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
  Info, 
  Settings2, 
  Building2, 
  CreditCard, 
  Banknote, 
  QrCode, 
  Calendar as CalendarIcon,
  Upload,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Wallet
} from 'lucide-react';
import { useAuth } from '@/components/auth-context';
import { useFirestore, useCollection, useMemoFirebase, useDoc } from '@/firebase';
import { collection, doc, setDoc, deleteDoc, updateDoc } from 'firebase/firestore';
import { useState, useMemo } from 'react';
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
import Image from 'next/image';

export default function RentPage() {
  const { user } = useAuth();
  const firestore = useFirestore();
  const { toast } = useToast();
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedItem, setSelectedItem] = useState<RentalItem | null>(null);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [showCheckoutDialog, setShowCheckoutDialog] = useState(false);
  
  // Agreement Form State
  const [customerName, setCustomerName] = useState('');
  const [customerCompany, setCustomerCompany] = useState('');
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date(Date.now() + 86400000).toISOString().split('T')[0]);
  
  // Checkout State
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
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

  // Live Price Calculation
  const calculatedAgreement = useMemo(() => {
    if (!selectedItem) return { totalAmount: 0, duration: 0 };
    
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) || 1;
    
    let duration = diffDays;
    const rate = selectedItem.unit === 'day' ? selectedItem.dailyRate! : selectedItem.unit === 'month' ? selectedItem.monthlyRate! : selectedItem.hourlyRate!;
    
    if (selectedItem.unit === 'month') {
      duration = Math.ceil(diffDays / 30);
    } else if (selectedItem.unit === 'hour') {
      duration = diffDays * 24;
    }

    return {
      totalAmount: rate * duration,
      duration,
      rate
    };
  }, [selectedItem, startDate, endDate]);

  const changeAmount = paymentMethod === 'cash' ? Math.max(0, (Number(cashReceived) || 0) - calculatedAgreement.totalAmount) : 0;
  const isInsufficientCash = paymentMethod === 'cash' && (Number(cashReceived) || 0) < calculatedAgreement.totalAmount;
  const isMissingReference = (paymentMethod === 'card' || paymentMethod === 'duitnow') && !referenceNumber;

  const handleRegisterItem = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!firestore || !user?.companyId) return;
    const formData = new FormData(e.currentTarget);
    const itemId = crypto.randomUUID();
    const unit = formData.get('unit') as 'hour' | 'day' | 'month';
    const rate = Number(formData.get('rate'));
    
    const newItem: RentalItem = {
      id: itemId,
      companyId: user.companyId,
      name: formData.get('name') as string,
      unit,
      dailyRate: unit === 'day' ? rate : undefined,
      hourlyRate: unit === 'hour' ? rate : undefined,
      monthlyRate: unit === 'month' ? rate : undefined,
      status: 'available'
    };

    try {
      await setDoc(doc(firestore, 'companies', user.companyId, 'rentalItems', itemId), newItem);
      toast({ title: "Asset Registered", description: `${newItem.name} is now available for lease.` });
      setIsAddDialogOpen(false);
    } catch (e: any) {
      toast({ title: "Registration failed", description: e.message, variant: "destructive" });
    }
  };

  const handleLaunchAgreement = async () => {
    if (!selectedItem || !firestore || !user?.companyId) return;
    setIsProcessing(true);

    try {
      const transactionId = crypto.randomUUID();
      const transactionData: SaleTransaction = {
        id: transactionId,
        companyId: user.companyId,
        module: 'rent',
        totalAmount: calculatedAgreement.totalAmount,
        profit: calculatedAgreement.totalAmount * 0.95, 
        timestamp: new Date().toISOString(),
        customerName: customerCompany ? `${customerName} (${customerCompany})` : customerName,
        paymentMethod,
        referenceNumber: referenceNumber || undefined,
        status: 'in-progress',
        items: [{ 
          name: selectedItem.name, 
          price: calculatedAgreement.rate, 
          quantity: 1, 
          duration: calculatedAgreement.duration,
          unit: selectedItem.unit,
          startDate: new Date(startDate).toISOString(),
          endDate: new Date(endDate).toISOString()
        }]
      };

      await setDoc(doc(firestore, 'companies', user.companyId, 'transactions', transactionId), transactionData);
      await updateDoc(doc(firestore, 'companies', user.companyId, 'rentalItems', selectedItem.id), { status: 'rented' });

      toast({ title: "Agreement Launched", description: `Active lease for ${customerName} recorded.` });
      setSelectedItem(null);
      setCustomerName('');
      setCustomerCompany('');
      setReferenceNumber('');
      setPaymentMethod('cash');
      setCashReceived('');
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
      toast({ title: "Asset Returned", description: "Agreement fulfilled and item back in inventory." });
    } catch (e: any) {
      toast({ title: "Return failed", description: e.message, variant: "destructive" });
    }
  };

  const handleDeleteItem = async (itemId: string) => {
    if (!firestore || !user?.companyId) return;
    try {
      await deleteDoc(doc(firestore, 'companies', user.companyId, 'rentalItems', itemId));
      toast({ title: "Asset Removed" });
    } catch (e: any) {
      toast({ title: "Deletion failed", description: e.message, variant: "destructive" });
    }
  };

  const handleQrUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !firestore || !user?.companyId) return;

    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64String = reader.result as string;
      try {
        await updateDoc(doc(firestore, 'companies', user.companyId), {
          duitNowQr: base64String
        });
        toast({ title: "QR Code Updated", description: "DuitNow QR has been saved to your rental profile." });
      } catch (err: any) {
        toast({ title: "Upload failed", description: err.message, variant: "destructive" });
      }
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
            <p className="text-muted-foreground font-bold text-sm">Advanced Agreement & Billing Control</p>
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
            <TabsTrigger value="workflow" className="rounded-xl px-6 gap-2">
              <ArrowRightLeft className="w-4 h-4" /> Workflow
            </TabsTrigger>
            <TabsTrigger value="pos" className="rounded-xl px-6 gap-2">
              <CalendarDays className="w-4 h-4" /> Create Agreement
            </TabsTrigger>
            <TabsTrigger value="registry" className="rounded-xl px-6 gap-2">
              <LayoutGrid className="w-4 h-4" /> Assets
            </TabsTrigger>
            <TabsTrigger value="settings" className="rounded-xl px-6 gap-2">
              <Settings2 className="w-4 h-4" /> Billing Settings
            </TabsTrigger>
          </TabsList>

          <TabsContent value="workflow" className="flex-1 overflow-auto space-y-6">
            <div className="grid grid-cols-1 gap-4">
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
                            <Clock className="w-3.5 h-3.5" /> Period: {new Date(rental.items[0].startDate!).toLocaleDateString()} - {new Date(rental.items[0].endDate!).toLocaleDateString()}
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
              {activeRentals.length === 0 && (
                <div className="py-24 text-center border-4 border-dashed rounded-[40px] bg-white/50">
                   <Clock className="w-16 h-16 mx-auto mb-4 opacity-10" />
                   <p className="font-black text-muted-foreground text-lg uppercase tracking-widest">No Active Agreements</p>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="pos" className="flex-1 overflow-hidden">
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
                        selectedItem?.id === item.id ? "border-primary bg-primary/5" : "border-transparent bg-white shadow-sm"
                      )}
                      onClick={() => setSelectedItem(item)}
                    >
                      <CardContent className="p-8">
                        <div className="flex justify-between items-start mb-4">
                           <div className="w-12 h-12 bg-secondary rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
                              <CalendarDays className="w-6 h-6 text-primary" />
                           </div>
                           <Badge variant="secondary" className="font-black uppercase text-[10px] tracking-widest">Available</Badge>
                        </div>
                        <p className="font-black text-foreground text-xl leading-tight">{item.name}</p>
                        <p className="text-3xl font-black text-primary mt-2">
                           ${(item.unit === 'day' ? item.dailyRate : item.unit === 'month' ? item.monthlyRate : item.hourlyRate)?.toFixed(2)}
                           <span className="text-sm font-bold text-muted-foreground uppercase tracking-widest">/{item.unit}</span>
                        </p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>

              <div className="lg:col-span-1 h-full">
                <Card className="h-full flex flex-col border-none shadow-2xl bg-white rounded-[40px] overflow-hidden">
                  <CardHeader className="bg-secondary/20 p-8">
                    <CardTitle className="flex items-center gap-3 font-black text-xl">
                      <ArrowRightLeft className="w-6 h-6 text-primary" /> 
                      Agreement Creator
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="flex-1 p-8 overflow-y-auto space-y-8">
                    {selectedItem ? (
                      <div className="space-y-8">
                        <div className="p-6 bg-primary/5 border-2 border-primary/10 rounded-3xl relative overflow-hidden group">
                          <div className="absolute -right-4 -bottom-4 opacity-5 group-hover:scale-110 transition-transform">
                            <CalendarDays className="w-24 h-24" />
                          </div>
                          <p className="text-[10px] font-black text-primary uppercase tracking-widest mb-1">Active Selection</p>
                          <p className="text-xl font-black text-foreground">{selectedItem.name}</p>
                        </div>

                        <div className="space-y-4">
                           <div className="space-y-1.5">
                              <label className="text-[10px] font-black uppercase text-muted-foreground px-1">Customer Full Name</label>
                              <Input 
                                placeholder="Alice Smith" 
                                className="h-12 rounded-xl font-bold" 
                                value={customerName}
                                onChange={(e) => setCustomerName(e.target.value)}
                              />
                           </div>
                           <div className="space-y-1.5">
                              <label className="text-[10px] font-black uppercase text-muted-foreground px-1">Organization (Optional)</label>
                              <Input 
                                placeholder="Acme Logistics" 
                                className="h-12 rounded-xl font-bold" 
                                value={customerCompany}
                                onChange={(e) => setCustomerCompany(e.target.value)}
                              />
                           </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                           <div className="space-y-1.5">
                              <label className="text-[10px] font-black uppercase text-muted-foreground px-1">Start Date</label>
                              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="h-12 rounded-xl font-bold" />
                           </div>
                           <div className="space-y-1.5">
                              <label className="text-[10px] font-black uppercase text-muted-foreground px-1">End Date</label>
                              <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="h-12 rounded-xl font-bold" />
                           </div>
                        </div>

                        <Separator className="bg-secondary/50" />

                        <div className="bg-secondary/10 p-6 rounded-3xl space-y-1">
                           <div className="flex justify-between items-center">
                              <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Duration Estimate</p>
                              <p className="text-sm font-black">{calculatedAgreement.duration} {selectedItem.unit}(s)</p>
                           </div>
                           <div className="flex justify-between items-end pt-2">
                              <p className="text-[10px] font-black uppercase text-primary tracking-widest">Total Due</p>
                              <p className="text-4xl font-black text-foreground tracking-tighter">${calculatedAgreement.totalAmount.toFixed(2)}</p>
                           </div>
                        </div>
                      </div>
                    ) : (
                      <div className="h-full flex flex-col items-center justify-center text-center opacity-30 space-y-4 py-12">
                        <CalendarDays className="w-16 h-16" />
                        <p className="font-black text-sm uppercase tracking-widest">Select an available asset<br/>to begin drafting</p>
                      </div>
                    )}
                  </CardContent>
                  {selectedItem && (
                    <CardFooter className="flex-col gap-4 p-8 border-t bg-secondary/5">
                      <Button 
                        onClick={() => setShowCheckoutDialog(true)} 
                        disabled={!customerName} 
                        className="w-full h-16 text-xl font-black rounded-[24px] shadow-xl"
                      >
                        Initialize Agreement
                      </Button>
                    </CardFooter>
                  )}
                </Card>
              </div>
            </div>

            <Dialog open={showCheckoutDialog} onOpenChange={setShowCheckoutDialog}>
              <DialogContent className="rounded-[40px] border-none shadow-2xl max-w-xl p-0 overflow-hidden bg-white">
                <div className="bg-primary p-12 text-primary-foreground text-center relative">
                   <div className="absolute top-4 left-1/2 -translate-x-1/2 opacity-20"><Wallet className="w-16 h-16" /></div>
                   <p className="text-xs font-black uppercase tracking-widest opacity-80 mb-2 relative z-10">Agreement Settlement</p>
                   <h2 className="text-6xl font-black tracking-tighter relative z-10">${calculatedAgreement.totalAmount.toFixed(2)}</h2>
                </div>
                
                <div className="p-12 space-y-10">
                  <div className="space-y-4">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground px-1">Select Payment Method</Label>
                    <RadioGroup value={paymentMethod} onValueChange={(v) => setPaymentMethod(v as PaymentMethod)} className="grid grid-cols-3 gap-3">
                      <PaymentOption value="cash" label="Cash" icon={Banknote} id="rent_cash" />
                      <PaymentOption value="card" label="Card" icon={CreditCard} id="rent_card" />
                      <PaymentOption value="duitnow" label="DuitNow" icon={QrCode} id="rent_qr" />
                    </RadioGroup>
                  </div>

                  {paymentMethod === 'cash' && (
                    <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
                      <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground px-1">Cash Received ($)</Label>
                      <Input 
                        type="number" 
                        className="h-16 rounded-[20px] font-black text-3xl bg-secondary/20 border-none px-6" 
                        value={cashReceived} 
                        onChange={(e) => setCashReceived(e.target.value)} 
                        autoFocus
                      />
                      {Number(cashReceived) >= calculatedAgreement.totalAmount && (
                        <div className="bg-primary/5 p-6 rounded-[24px] border-2 border-primary/20 flex justify-between items-center">
                           <div className="flex items-center gap-3">
                              <CheckCircle2 className="w-6 h-6 text-primary" />
                              <p className="text-[10px] font-black uppercase text-primary tracking-widest">Change to Return</p>
                           </div>
                           <p className="text-4xl font-black tracking-tighter text-foreground">${changeAmount.toFixed(2)}</p>
                        </div>
                      )}
                    </div>
                  )}

                  {(paymentMethod === 'card' || paymentMethod === 'duitnow') && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-top-2">
                       {paymentMethod === 'duitnow' && companyDoc?.duitNowQr && (
                         <div className="flex flex-col items-center bg-secondary/10 p-6 rounded-3xl">
                            <Image 
                              src={companyDoc.duitNowQr} 
                              alt="DuitNow QR" 
                              width={180} 
                              height={180} 
                              className="rounded-2xl shadow-xl border-4 border-white mb-4"
                            />
                            <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Point to Scan</p>
                         </div>
                       )}
                       <div className="space-y-2">
                          <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground px-1">Reference / Trace ID</Label>
                          <Input 
                            placeholder="TRX-XXXXXX" 
                            className="h-14 rounded-2xl font-black text-lg bg-secondary/20 border-none px-6" 
                            value={referenceNumber} 
                            onChange={(e) => setReferenceNumber(e.target.value)} 
                            required
                          />
                       </div>
                    </div>
                  )}
                </div>

                <div className="p-12 pt-0">
                  <Button 
                    onClick={handleLaunchAgreement} 
                    className="w-full h-20 rounded-[30px] font-black text-xl shadow-2xl transition-all hover:scale-[1.02]" 
                    disabled={isProcessing || isInsufficientCash || isMissingReference}
                  >
                    {isProcessing ? "Launching..." : "Confirm & Launch Agreement"}
                  </Button>
                  <p className="text-center text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-6 opacity-40">
                    Agreement will be finalized and asset marked as rented
                  </p>
                </div>
              </DialogContent>
            </Dialog>
          </TabsContent>

          <TabsContent value="registry" className="flex-1 overflow-hidden">
             <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 h-full">
               <Card className="lg:col-span-1 border-none shadow-sm rounded-[32px] bg-white h-fit p-8">
                  <div className="flex flex-col gap-6">
                    <div className="space-y-1">
                      <h3 className="text-xl font-black">Strategic Reserve</h3>
                      <p className="text-xs font-bold text-muted-foreground">Rental pool management</p>
                    </div>
                    <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                      <DialogTrigger asChild>
                        <Button className="w-full h-14 rounded-2xl font-black shadow-lg">
                          <Plus className="w-5 h-5 mr-2" /> Register Asset
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="rounded-[40px] max-w-lg p-0 overflow-hidden border-none shadow-2xl bg-white">
                         <div className="bg-primary p-10 text-primary-foreground">
                            <DialogTitle className="text-3xl font-black tracking-tight">New Asset Registration</DialogTitle>
                         </div>
                         <form onSubmit={handleRegisterItem} className="p-10 space-y-8">
                           <div className="space-y-2">
                             <label className="text-[10px] font-black uppercase tracking-widest px-1">Legal Name / Model</label>
                             <Input name="name" placeholder="Asset Name" required className="h-14 rounded-2xl font-bold bg-secondary/20 border-none" />
                           </div>
                           <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase tracking-widest px-1">Billing Cycle</label>
                                <Select name="unit" defaultValue="day">
                                  <SelectTrigger className="h-14 rounded-2xl bg-secondary/20 border-none font-bold">
                                    <SelectValue placeholder="Unit" />
                                  </SelectTrigger>
                                  <SelectContent className="rounded-xl font-bold">
                                    <SelectItem value="hour">Hourly</SelectItem>
                                    <SelectItem value="day">Daily</SelectItem>
                                    <SelectItem value="month">Monthly</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase tracking-widest px-1">Rate ($)</label>
                                <Input name="rate" type="number" step="0.01" placeholder="0.00" required className="h-14 rounded-2xl font-black bg-secondary/20 border-none text-lg" />
                              </div>
                           </div>
                           <Button type="submit" className="w-full h-16 rounded-[24px] font-black text-lg shadow-xl">
                             Save to Registry
                           </Button>
                         </form>
                      </DialogContent>
                    </Dialog>
                    
                    <Separator className="bg-secondary/50" />
                    
                    <div className="space-y-4">
                       <div className="flex justify-between items-center text-sm">
                          <span className="font-bold text-muted-foreground">Total Assets</span>
                          <span className="font-black">{rentalItems?.length || 0}</span>
                       </div>
                       <div className="flex justify-between items-center text-sm">
                          <span className="font-bold text-muted-foreground">Active Leases</span>
                          <span className="font-black text-primary">{activeRentals.length}</span>
                       </div>
                    </div>
                  </div>
               </Card>

               <div className="lg:col-span-3 space-y-4 overflow-hidden flex flex-col">
                  <div className="bg-white rounded-[40px] border shadow-sm overflow-hidden">
                     <table className="w-full text-sm text-left">
                       <thead className="bg-secondary/20 border-b">
                         <tr>
                           <th className="p-6 font-black uppercase text-[10px] tracking-widest text-muted-foreground">Asset Identity</th>
                           <th className="p-6 font-black uppercase text-[10px] tracking-widest text-muted-foreground">Billing Metrics</th>
                           <th className="p-6 font-black uppercase text-[10px] tracking-widest text-muted-foreground">Status</th>
                           <th className="p-6 text-center font-black uppercase text-[10px] tracking-widest text-muted-foreground">Action</th>
                         </tr>
                       </thead>
                       <tbody className="divide-y">
                         {rentalItems?.map(item => (
                           <tr key={item.id} className="hover:bg-secondary/5 transition-colors">
                             <td className="p-6">
                                <p className="font-black text-foreground text-lg">{item.name}</p>
                             </td>
                             <td className="p-6">
                                <div className="flex items-center gap-2">
                                  <p className="font-black text-primary text-xl">
                                    ${(item.unit === 'day' ? item.dailyRate : item.unit === 'month' ? item.monthlyRate : item.hourlyRate)?.toFixed(2)}
                                  </p>
                                  <Badge variant="outline" className="text-[9px] font-black uppercase">{item.unit}</Badge>
                                </div>
                             </td>
                             <td className="p-6">
                                <Badge variant={item.status === 'available' ? 'secondary' : 'destructive'} className="font-black uppercase text-[9px] tracking-widest rounded-lg">
                                  {item.status}
                                </Badge>
                             </td>
                             <td className="p-6 text-center">
                                <Button variant="ghost" size="icon" onClick={() => handleDeleteItem(item.id)} className="text-destructive hover:bg-destructive/10">
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                             </td>
                           </tr>
                         ))}
                       </tbody>
                     </table>
                  </div>
               </div>
             </div>
          </TabsContent>

          <TabsContent value="settings" className="flex-1 overflow-auto">
             <div className="max-w-xl mx-auto space-y-8 py-12">
               <div className="text-center">
                 <h2 className="text-3xl font-black text-foreground">Billing Settings</h2>
                 <p className="text-muted-foreground mt-2">Configure DuitNow QR for seamless digital rental payments</p>
               </div>

               <Card className="border-none shadow-sm rounded-[32px] bg-white overflow-hidden">
                 <CardHeader className="bg-primary/10 p-8">
                   <CardTitle className="text-lg font-black flex items-center gap-2">
                     <QrCode className="w-5 h-5 text-primary" />
                     DuitNow QR Profile
                   </CardTitle>
                 </CardHeader>
                 <CardContent className="p-10 flex flex-col items-center gap-8">
                   {companyDoc?.duitNowQr ? (
                     <div className="relative group">
                       <Image 
                        src={companyDoc.duitNowQr} 
                        alt="DuitNow QR" 
                        width={250} 
                        height={250} 
                        className="rounded-3xl shadow-2xl border-4 border-white"
                       />
                       <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-3xl">
                         <Button variant="secondary" className="rounded-xl font-black" asChild>
                           <label className="cursor-pointer">
                             <Upload className="w-4 h-4 mr-2" /> Replace
                             <input type="file" className="hidden" accept="image/*" onChange={handleQrUpload} />
                           </label>
                         </Button>
                       </div>
                     </div>
                   ) : (
                     <label className="w-64 h-64 border-4 border-dashed rounded-[40px] flex flex-col items-center justify-center cursor-pointer hover:bg-secondary/20 transition-all gap-4">
                       <div className="w-16 h-16 bg-secondary rounded-2xl flex items-center justify-center text-primary">
                         <Plus className="w-8 h-8" />
                       </div>
                       <p className="text-xs font-black uppercase text-muted-foreground tracking-widest">Upload QR Image</p>
                       <input type="file" className="hidden" accept="image/*" onChange={handleQrUpload} />
                     </label>
                   )}
                   <p className="text-xs text-center font-bold text-muted-foreground max-w-xs">
                     Upload your static DuitNow QR code from your bank. This will be shown to customers during the agreement process.
                   </p>
                 </CardContent>
               </Card>
             </div>
          </TabsContent>
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

