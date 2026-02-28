
'use client';

import { use, useState, useMemo } from 'react';
import { Sidebar } from '@/components/layout/sidebar';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  ChevronLeft, 
  User, 
  Building2, 
  Banknote, 
  CreditCard, 
  QrCode, 
  CheckCircle2, 
  Calculator, 
  ArrowRight,
  ShieldCheck,
  Zap,
  ShoppingBag
} from 'lucide-react';
import { useAuth } from '@/components/auth-context';
import { useFirestore, useMemoFirebase, useDoc, useCollection } from '@/firebase';
import { doc, setDoc, collection } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { ServiceType, ServicePriceBundle, SaleTransaction, PaymentMethod } from '@/lib/types';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

export default function ServiceBookingPage({ params }: { params: Promise<{ serviceId: string }> }) {
  const { serviceId } = use(params);
  const { user } = useAuth();
  const firestore = useFirestore();
  const { toast } = useToast();
  const router = useRouter();

  // Form State
  const [selectedBundle, setSelectedBundle] = useState<ServicePriceBundle | null>(null);
  const [customerName, setCustomerName] = useState('');
  const [customerCompany, setCustomerCompany] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [cashReceived, setCashReceived] = useState<number | string>('');
  const [isProcessing, setIsProcessing] = useState(false);

  // Queries
  const serviceRef = useMemoFirebase(() => {
    if (!firestore || !user?.companyId) return null;
    return doc(firestore, 'companies', user.companyId, 'serviceTypes', serviceId);
  }, [firestore, user?.companyId, serviceId]);

  const bundlesQuery = useMemoFirebase(() => {
    if (!firestore || !user?.companyId) return null;
    return collection(firestore, 'companies', user.companyId, 'serviceTypes', serviceId, 'priceBundles');
  }, [firestore, user?.companyId, serviceId]);

  const { data: serviceType } = useDoc<ServiceType>(serviceRef);
  const { data: bundles } = useCollection<ServicePriceBundle>(bundlesQuery);

  const totalAmount = selectedBundle?.price || 0;
  const changeAmount = paymentMethod === 'cash' ? Math.max(0, (Number(cashReceived) || 0) - totalAmount) : 0;
  const isInsufficientCash = paymentMethod === 'cash' && (Number(cashReceived) || 0) < totalAmount;
  const isMissingReference = (paymentMethod === 'card' || paymentMethod === 'duitnow') && !referenceNumber;

  const handlePlaceOrder = () => {
    if (!firestore || !user?.companyId || !customerName || !selectedBundle) return;
    setIsProcessing(true);
    
    const transactionId = crypto.randomUUID();
    const transactionRef = doc(firestore, 'companies', user.companyId, 'transactions', transactionId);
    const transactionData: SaleTransaction = {
      id: transactionId,
      companyId: user.companyId,
      module: 'services',
      serviceTypeId: serviceId,
      totalAmount: selectedBundle.price,
      profit: selectedBundle.estimatedProfit,
      timestamp: new Date().toISOString(),
      customerName: customerName || null,
      customerCompany: customerCompany || null,
      paymentMethod,
      referenceNumber: referenceNumber || null,
      items: [{ name: selectedBundle.name, price: selectedBundle.price, quantity: 1 }],
      status: 'pending'
    };

    setDoc(transactionRef, transactionData)
      .then(() => {
        toast({ title: "Booking Logged", description: `Order for ${customerName} added to pipeline.` });
        router.push(`/company/services/${serviceId}`);
      })
      .catch(async (err) => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({
          path: transactionRef.path,
          operation: 'create',
          requestResourceData: transactionData
        }));
        setIsProcessing(false);
      });
  };

  return (
    <div className="flex h-screen bg-background font-body">
      <Sidebar />
      <main className="flex-1 overflow-auto p-8">
        <div className="max-w-4xl mx-auto">
          <Link href={`/company/services/${serviceId}`} className="inline-flex items-center gap-2 text-muted-foreground hover:text-primary transition-colors font-black text-[10px] uppercase tracking-widest mb-6">
            <ChevronLeft className="w-4 h-4" /> Cancel & Return
          </Link>

          <div className="mb-10">
            <h1 className="text-4xl font-black font-headline text-foreground tracking-tighter">New Booking</h1>
            <p className="text-muted-foreground font-medium">Department: {serviceType?.name || 'Loading...'}</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
            <div className="space-y-8">
              <Card className="border-none shadow-sm rounded-[32px] bg-white p-8">
                <CardHeader className="px-0 pt-0">
                  <CardTitle className="text-xl font-black">Customer Details</CardTitle>
                </CardHeader>
                <div className="space-y-6">
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground px-1">Full Name</Label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input 
                        placeholder="Alice Smith" 
                        value={customerName} 
                        onChange={(e) => setCustomerName(e.target.value)} 
                        className="pl-10 h-12 rounded-xl font-bold bg-secondary/10 border-none" 
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground px-1">Company (Optional)</Label>
                    <div className="relative">
                      <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input 
                        placeholder="Acme Logistics" 
                        value={customerCompany} 
                        onChange={(e) => setCustomerCompany(e.target.value)} 
                        className="pl-10 h-12 rounded-xl font-bold bg-secondary/10 border-none" 
                      />
                    </div>
                  </div>
                </div>
              </Card>

              <Card className="border-none shadow-sm rounded-[32px] bg-white p-8">
                <CardHeader className="px-0 pt-0">
                  <CardTitle className="text-xl font-black">Select Package</CardTitle>
                </CardHeader>
                <div className="grid grid-cols-1 gap-3">
                  {bundles?.map(bundle => (
                    <div 
                      key={bundle.id}
                      onClick={() => setSelectedBundle(bundle)}
                      className={cn(
                        "p-4 rounded-2xl border-4 cursor-pointer transition-all flex justify-between items-center group",
                        selectedBundle?.id === bundle.id ? "border-primary bg-primary/5" : "border-transparent bg-secondary/10 hover:bg-secondary/20"
                      )}
                    >
                      <div>
                        <p className="font-black text-sm">{bundle.name}</p>
                        <p className="text-[10px] font-bold text-muted-foreground uppercase">Service Value</p>
                      </div>
                      <p className="text-xl font-black text-foreground">${bundle.price.toFixed(2)}</p>
                    </div>
                  ))}
                  {(!bundles || bundles.length === 0) && (
                    <div className="py-8 text-center opacity-30">
                      <Zap className="w-8 h-8 mx-auto mb-2" />
                      <p className="text-xs font-black uppercase">No packages found</p>
                    </div>
                  )}
                </div>
              </Card>
            </div>

            <div className="space-y-8">
              <Card className="border-none shadow-2xl rounded-[40px] bg-white overflow-hidden">
                <div className="bg-primary p-10 text-primary-foreground text-center relative overflow-hidden">
                  <div className="absolute -top-4 -left-4 opacity-10 rotate-12"><Calculator className="w-24 h-24" /></div>
                  <p className="text-xs font-black uppercase tracking-widest opacity-80 mb-2 relative z-10">Total Settlement</p>
                  <h2 className="text-6xl font-black tracking-tighter relative z-10">${totalAmount.toFixed(2)}</h2>
                </div>
                
                <div className="p-10 space-y-8">
                  <div className="space-y-4">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground px-1">Payment Method</Label>
                    <RadioGroup value={paymentMethod} onValueChange={(v) => setPaymentMethod(v as PaymentMethod)} className="grid grid-cols-3 gap-3">
                      <PaymentOption value="cash" label="Cash" icon={Banknote} id="pay_cash" />
                      <PaymentOption value="card" label="Card" icon={CreditCard} id="pay_card" />
                      <PaymentOption value="duitnow" label="DuitNow" icon={QrCode} id="pay_qr" />
                    </RadioGroup>
                  </div>

                  {paymentMethod === 'cash' && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-top-2">
                      <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground px-1">Amount Received ($)</Label>
                        <Input 
                          type="number" 
                          placeholder="0.00" 
                          value={cashReceived} 
                          onChange={(e) => setCashReceived(e.target.value)} 
                          className="h-16 rounded-[24px] font-black text-3xl text-center bg-secondary/10 border-none" 
                        />
                      </div>
                      
                      {Number(cashReceived) >= totalAmount && totalAmount > 0 && (
                        <div className="bg-primary/5 p-6 rounded-[32px] border-2 border-primary/20 flex justify-between items-center animate-in zoom-in-95">
                          <div className="space-y-1">
                            <p className="text-[10px] font-black uppercase text-primary tracking-widest">Balance to Return</p>
                            <p className="text-xs font-bold text-muted-foreground">Cash handling verified</p>
                          </div>
                          <p className="text-4xl font-black tracking-tighter text-foreground">${changeAmount.toFixed(2)}</p>
                        </div>
                      )}
                    </div>
                  )}

                  {(paymentMethod === 'card' || paymentMethod === 'duitnow') && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-top-2">
                      {paymentMethod === 'duitnow' && serviceType?.duitNowQr && (
                        <div className="text-center space-y-4 p-6 bg-secondary/5 rounded-3xl border-2 border-dashed border-primary/10">
                          <Image src={serviceType.duitNowQr} alt="QR" width={180} height={180} className="rounded-2xl mx-auto shadow-lg border-4 border-white" />
                          <p className="text-[10px] font-black text-primary uppercase tracking-widest">Scan departmental QR</p>
                        </div>
                      )}
                      <div className="space-y-1.5">
                        <Label className="text-[10px] font-black uppercase tracking-widest px-1">Transaction Ref / Trace ID</Label>
                        <Input 
                          placeholder="Enter reference..." 
                          value={referenceNumber} 
                          onChange={(e) => setReferenceNumber(e.target.value)} 
                          className="h-12 rounded-xl font-bold bg-secondary/10 border-none" 
                        />
                      </div>
                    </div>
                  )}

                  <Separator />

                  <Button 
                    className="w-full h-20 rounded-[32px] font-black text-2xl shadow-xl transition-all hover:scale-[1.02] active:scale-95 group" 
                    onClick={handlePlaceOrder}
                    disabled={isProcessing || !customerName || !selectedBundle || isInsufficientCash || isMissingReference}
                  >
                    {isProcessing ? "Processing..." : (
                      <>Confirm Booking <ArrowRight className="ml-2 w-6 h-6 group-hover:translate-x-1 transition-transform" /></>
                    )}
                  </Button>
                  
                  <div className="flex items-center justify-center gap-2 opacity-40">
                    <ShieldCheck className="w-4 h-4" />
                    <p className="text-[10px] font-black uppercase tracking-widest">Secured Transaction Protocol</p>
                  </div>
                </div>
              </Card>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

function PaymentOption({ value, label, icon: Icon, id }: any) {
  return (
    <div className="flex-1">
      <RadioGroupItem value={value} id={id} className="peer sr-only" />
      <Label htmlFor={id} className="flex flex-col items-center justify-center rounded-[20px] border-4 border-transparent bg-secondary/20 p-4 hover:bg-secondary/30 peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/5 cursor-pointer transition-all h-28 text-center">
        <Icon className="mb-2 h-6 w-6 text-primary" />
        <span className="text-[10px] font-black uppercase tracking-widest">{label}</span>
      </Label>
    </div>
  );
}
