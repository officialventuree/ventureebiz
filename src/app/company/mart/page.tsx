
'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import { Sidebar } from '@/components/layout/sidebar';
import { Card, CardContent, CardHeader, CardTitle, CardFooter, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  ShoppingCart, 
  Plus, 
  Minus, 
  Search, 
  Package, 
  Receipt, 
  TrendingUp, 
  DollarSign, 
  Ticket, 
  Trash2, 
  CreditCard, 
  QrCode, 
  Wallet, 
  Banknote, 
  Scan, 
  Settings2, 
  History, 
  XCircle, 
  RefreshCw, 
  Edit2, 
  ShieldCheck, 
  Upload, 
  Landmark, 
  AlertTriangle, 
  Lock 
} from 'lucide-react';
import { useAuth } from '@/components/auth-context';
import { useFirestore, useCollection, useMemoFirebase, useDoc, deleteDocumentNonBlocking } from '@/firebase';
import { collection, doc, setDoc, updateDoc, increment, query, where, addDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Product, SaleTransaction, Coupon, Company, PaymentMethod, CapitalPurchase } from '@/lib/types';
import { cn } from '@/lib/utils';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Separator } from '@/components/ui/separator';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import Link from 'next/link';
import Image from 'next/image';
import { ScrollArea } from '@/components/ui/scroll-area';

export default function MartPage() {
  const { user } = useAuth();
  const firestore = useFirestore();
  const { toast } = useToast();
  
  const [cart, setCart] = useState<{ product: Product, quantity: number }[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [scanValue, setScanValue] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [cashReceived, setCashReceived] = useState<number | string>('');
  const [showCheckoutDialog, setShowCheckoutDialog] = useState(false);
  
  // Stored Value / Voucher State
  const [voucherSearch, setVoucherSearch] = useState('');
  const [selectedVoucher, setSelectedVoucher] = useState<Coupon | null>(null);

  // Reversal Security State
  const [isReverseDialogOpen, setIsReverseDialogOpen] = useState(false);
  const [reverseKey, setReverseKey] = useState('');
  const [pendingReverseTrans, setPendingReverseTrans] = useState<SaleTransaction | null>(null);
  const [isReversing, setIsReversing] = useState(false);
  
  const scanInputRef = useRef<HTMLInputElement>(null);

  const companyRef = useMemoFirebase(() => {
    if (!firestore || !user?.companyId) return null;
    return doc(firestore, 'companies', user.companyId);
  }, [firestore, user?.companyId]);

  const productsQuery = useMemoFirebase(() => {
    if (!firestore || !user?.companyId) return null;
    return collection(firestore, 'companies', user.companyId, 'products');
  }, [firestore, user?.companyId]);

  const transactionsQuery = useMemoFirebase(() => {
    if (!firestore || !user?.companyId) return null;
    return collection(firestore, 'companies', user.companyId, 'transactions');
  }, [firestore, user?.companyId]);

  const vouchersQuery = useMemoFirebase(() => {
    if (!firestore || !user?.companyId) return null;
    return query(collection(firestore, 'companies', user.companyId, 'coupons'), where('status', '==', 'active'));
  }, [firestore, user?.companyId]);

  const purchasesQuery = useMemoFirebase(() => {
    if (!firestore || !user?.companyId) return null;
    return collection(firestore, 'companies', user.companyId, 'purchases');
  }, [firestore, user?.companyId]);

  const { data: companyDoc } = useDoc<Company>(companyRef);
  const { data: products } = useCollection<Product>(productsQuery);
  const { data: transactions } = useCollection<SaleTransaction>(transactionsQuery);
  const { data: vouchers } = useCollection<Coupon>(vouchersQuery);
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

  // Auto-focus barcode scanner
  useEffect(() => {
    if (scanInputRef.current && !showCheckoutDialog && !isReverseDialogOpen) {
      scanInputRef.current.focus();
    }
  }, [showCheckoutDialog, isReverseDialogOpen]);

  const filteredProducts = products?.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    p.sku?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.barcode?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const addToCart = (product: Product) => {
    if (product.stock <= 0) {
      toast({ title: "Out of stock", description: `${product.name} is unavailable.`, variant: "destructive" });
      return;
    }
    const existing = cart.find(item => item.product.id === product.id);
    if (existing) {
      if (existing.quantity >= product.stock) {
        toast({ title: "Stock limit reached", description: `Cannot add more ${product.name}.`, variant: "destructive" });
        return;
      }
      setCart(cart.map(item => item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item));
    } else {
      setCart([...cart, { product, quantity: 1 }]);
    }
  };

  const handleBarcodeScan = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      const barcode = scanValue.trim();
      if (!barcode) return;
      const matchedProduct = products?.find(p => p.barcode === barcode);
      if (matchedProduct) {
        addToCart(matchedProduct);
        toast({ title: "Item Scanned", description: `${matchedProduct.name} added to cart.` });
        setScanValue('');
      } else {
        toast({ title: "Product Not Found", description: `No item matches barcode: ${barcode}`, variant: "destructive" });
        setScanValue('');
      }
    }
  };

  const updateQuantity = (id: string, delta: number) => {
    setCart(cart.map(item => {
      if (item.product.id === id) {
        const newQty = Math.max(0, item.quantity + delta);
        if (newQty > item.product.stock) return item;
        return { ...item, quantity: newQty };
      }
      return item;
    }).filter(item => item.quantity > 0));
  };

  const subtotal = cart.reduce((acc, item) => acc + item.product.sellingPrice * item.quantity, 0);
  const voucherDiscount = selectedVoucher ? Math.min(selectedVoucher.balance, subtotal) : 0;
  const settlementDue = Math.max(0, subtotal - voucherDiscount);
  const totalProfit = cart.reduce((acc, item) => acc + (item.product.sellingPrice - item.product.costPrice) * item.quantity, 0);
  const totalCost = cart.reduce((acc, item) => acc + (item.product.costPrice * item.quantity), 0);

  const changeAmount = paymentMethod === 'cash' ? Math.max(0, (Number(cashReceived) || 0) - settlementDue) : 0;
  const isInsufficientCash = paymentMethod === 'cash' && (Number(cashReceived) || 0) < settlementDue;
  const isMissingReference = (paymentMethod === 'card' || paymentMethod === 'duitnow') && !referenceNumber;

  const handleFinalCheckout = () => {
    if (!user?.companyId || !firestore) return;
    setIsProcessing(true);
    const transactionId = crypto.randomUUID();
    const transactionRef = doc(firestore, 'companies', user.companyId, 'transactions', transactionId);
    
    const transactionData: SaleTransaction = {
      id: transactionId,
      companyId: user.companyId,
      module: 'mart',
      totalAmount: subtotal, 
      profit: totalProfit, 
      totalCost: totalCost, 
      isCapitalClaimed: false,
      discountApplied: voucherDiscount,
      couponCode: selectedVoucher?.code || null,
      customerName: customerName || selectedVoucher?.customerName || 'Walk-in Customer',
      timestamp: new Date().toISOString(),
      paymentMethod,
      referenceNumber: referenceNumber || null,
      status: 'completed',
      items: cart.map(item => ({
        productId: item.product.id,
        name: item.product.name,
        price: item.product.sellingPrice,
        cost: item.product.costPrice,
        quantity: item.quantity
      }))
    };

    setDoc(transactionRef, transactionData).catch(async (err) => {
      errorEmitter.emit('permission-error', new FirestorePermissionError({
        path: transactionRef.path,
        operation: 'create',
        requestResourceData: transactionData
      }));
    });

    for (const item of cart) {
      const productRef = doc(firestore, 'companies', user.companyId, 'products', item.product.id);
      updateDoc(productRef, { stock: increment(-item.quantity) }).catch(async (err) => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({
          path: productRef.path,
          operation: 'update',
          requestResourceData: { stock: increment(-item.quantity) }
        }));
      });
    }

    if (selectedVoucher) {
      const voucherRef = doc(firestore, 'companies', user.companyId, 'coupons', selectedVoucher.id);
      const newBalance = selectedVoucher.balance - voucherDiscount;
      updateDoc(voucherRef, { 
        balance: newBalance,
        status: newBalance <= 0 ? 'exhausted' : 'active'
      }).catch(async (err) => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({
          path: voucherRef.path,
          operation: 'update'
        }));
      });
    }

    toast({ title: "Transaction Successful" });
    setCart([]);
    setSelectedVoucher(null);
    setCustomerName('');
    setReferenceNumber('');
    setCashReceived('');
    setShowCheckoutDialog(false);
    setIsProcessing(false);
  };

  const martTransactions = transactions?.filter(t => t.module === 'mart') || [];

  const handleInitiateReverse = (t: SaleTransaction) => {
    setPendingReverseTrans(t);
    setIsReverseDialogOpen(true);
  };

  const handleConfirmReverse = () => {
    if (!firestore || !user?.companyId || !pendingReverseTrans || !companyDoc) return;
    
    if (reverseKey !== companyDoc.cancellationPassword) {
      toast({ title: "Invalid Supervisor Key", description: "Authorization failed. Check your reset authority key.", variant: "destructive" });
      return;
    }

    setIsReversing(true);
    
    for (const item of pendingReverseTrans.items) {
      if (item.productId) {
        const productRef = doc(firestore, 'companies', user.companyId, 'products', item.productId);
        updateDoc(productRef, { stock: increment(item.quantity) }).catch(async (err) => {
          errorEmitter.emit('permission-error', new FirestorePermissionError({ path: productRef.path, operation: 'update' }));
        });
      }
    }

    const transRef = doc(firestore, 'companies', user.companyId, 'transactions', pendingReverseTrans.id);
    deleteDocumentNonBlocking(transRef);
    
    toast({ title: "Transaction Reversed", description: "Inventory restored and ledger updated." });
    setIsReverseDialogOpen(false);
    setReverseKey('');
    setPendingReverseTrans(null);
    setIsReversing(false);
  };

  return (
    <div className="flex h-screen bg-background font-body overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-auto p-10 flex flex-col">
        <div className="mb-10 flex justify-between items-end">
          <div>
            <h1 className="text-4xl font-black font-headline text-foreground tracking-tighter uppercase">Retail Operations</h1>
            <p className="text-muted-foreground font-bold text-lg mt-1">Tactical Logistics & Inventory Management</p>
          </div>
          <Card className="p-4 border-none shadow-xl bg-white/80 backdrop-blur-md flex items-center gap-4 rounded-[24px]">
            <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center", remainingBudget > 0 ? "bg-primary/20 text-primary" : "bg-destructive/20 text-destructive")}>
               <Wallet className="w-6 h-6" />
            </div>
            <div>
               <p className="text-[10px] font-black uppercase text-muted-foreground leading-tight tracking-[0.1em]">Procurement Budget</p>
               <p className={cn("text-xl font-black tracking-tighter", remainingBudget <= 0 && "text-destructive")}>{currencySymbol}{remainingBudget.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
            </div>
          </Card>
        </div>

        {!isBudgetActive && (
          <Alert variant="destructive" className="mb-8 rounded-[24px] bg-destructive/5 border-2 border-destructive/10 animate-in slide-in-from-top-4">
            <AlertTriangle className="h-5 w-5" />
            <AlertTitle className="font-black uppercase text-[10px] tracking-[0.2em] mb-1">Strategic Guardrail Alert</AlertTitle>
            <AlertDescription className="text-sm font-bold opacity-80">
              Your <strong>Capital Base Limit</strong> is not configured. Procurement logs will not be locked to a strategic cycle. 
              <Link href="/company/capital" className="underline font-black hover:opacity-100 ml-2">Configure Strategic Budget</Link>
            </AlertDescription>
          </Alert>
        )}

        <Tabs defaultValue="pos" className="flex-1 flex flex-col overflow-auto">
          <TabsList className="mb-8 bg-white/50 border-2 border-primary/5 self-start p-1.5 rounded-[24px] shadow-sm shrink-0">
            <TabsTrigger value="pos" className="gap-2 rounded-[18px] px-8 py-2 font-black text-xs uppercase tracking-widest">POS Terminal</TabsTrigger>
            <TabsTrigger value="history" className="gap-2 rounded-[18px] px-8 py-2 font-black text-xs uppercase tracking-widest">Sales Registry</TabsTrigger>
            <TabsTrigger value="inventory" className="gap-2 rounded-[18px] px-8 py-2 font-black text-xs uppercase tracking-widest">Inventory Assets</TabsTrigger>
            <TabsTrigger value="coupons" className="gap-2 rounded-[18px] px-8 py-2 font-black text-xs uppercase tracking-widest">Stored-Value Cards</TabsTrigger>
            <TabsTrigger value="profits" className="gap-2 rounded-[18px] px-8 py-2 font-black text-xs uppercase tracking-widest">Yield Analytics</TabsTrigger>
            <TabsTrigger value="billing" className="gap-2 rounded-[18px] px-8 py-2 font-black text-xs uppercase tracking-widest">Gateway Config</TabsTrigger>
          </TabsList>

          <TabsContent value="pos" className="flex-1 overflow-hidden">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-10 h-full overflow-hidden">
              <div className="lg:col-span-2 flex flex-col gap-6 overflow-hidden">
                <div className="relative group">
                  <div className="absolute inset-0 bg-primary/5 rounded-[32px] blur-xl opacity-0 group-hover:opacity-100 transition-opacity" />
                  <Scan className="absolute left-6 top-1/2 -translate-y-1/2 text-primary w-6 h-6 relative z-10" />
                  <Input 
                    ref={scanInputRef}
                    placeholder="SCAN BARCODE OR SKU..." 
                    className="pl-16 h-20 rounded-[32px] border-4 border-transparent bg-white shadow-2xl text-2xl font-black focus-visible:ring-primary/20 focus-visible:border-primary/20 relative z-10 tracking-tight"
                    value={scanValue}
                    onChange={(e) => setScanValue(e.target.value)}
                    onKeyDown={handleBarcodeScan}
                  />
                </div>
                <div className="flex-1 overflow-auto grid grid-cols-1 md:grid-cols-2 gap-6 pb-6 pr-2 custom-scrollbar">
                  {filteredProducts?.map((p) => (
                    <Card key={p.id} className={cn(
                      "cursor-pointer hover:border-primary/30 border-4 border-transparent transition-all bg-white shadow-sm rounded-[32px] overflow-hidden group",
                      p.stock <= 0 && "opacity-50 grayscale select-none"
                    )} onClick={() => addToCart(p)}>
                      <CardContent className="p-8 flex justify-between items-center h-full">
                        <div className="space-y-2">
                          <h3 className="font-black text-2xl tracking-tighter leading-none">{p.name}</h3>
                          <div className="flex items-center gap-3">
                             <p className="text-3xl font-black text-primary tracking-tighter">{currencySymbol}{p.sellingPrice.toFixed(2)}</p>
                             <Badge variant="secondary" className="font-black text-[9px] uppercase tracking-widest py-0.5">Yield: {currencySymbol}{(p.sellingPrice - p.costPrice).toFixed(2)}</Badge>
                          </div>
                          <p className="text-[10px] text-muted-foreground font-black uppercase tracking-[0.15em] pt-2">Stock Inventory: {p.stock} {p.unit || 'units'}</p>
                        </div>
                        <div className="w-14 h-14 bg-secondary rounded-2xl flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                           <Plus className="w-6 h-6 text-primary" />
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
              <div className="lg:col-span-1 h-full">
                <Card className="h-full flex flex-col border-none shadow-2xl bg-white rounded-[48px] overflow-hidden border-2 border-primary/5">
                  <CardHeader className="bg-secondary/20 p-10">
                    <CardTitle className="flex items-center gap-3 font-black text-2xl tracking-tight"><ShoppingCart className="w-7 h-7 text-primary" /> Tactical Cart</CardTitle>
                    <CardDescription className="font-bold text-[10px] uppercase tracking-[0.2em] mt-2">Active Transaction Flow</CardDescription>
                  </CardHeader>
                  <CardContent className="flex-1 overflow-auto p-10 space-y-5 custom-scrollbar">
                    {cart.map((item) => (
                      <div key={item.product.id} className="flex items-center justify-between p-5 rounded-[24px] bg-secondary/10 border border-secondary/20">
                        <div className="flex-1 min-w-0 pr-4">
                          <p className="text-sm font-black truncate leading-tight">{item.product.name}</p>
                          <p className="text-xs text-primary font-black mt-1">{currencySymbol}{(item.product.sellingPrice * item.quantity).toFixed(2)}</p>
                        </div>
                        <div className="flex items-center gap-4 bg-white p-2 rounded-2xl shadow-sm border border-primary/5">
                          <Button size="icon" variant="ghost" className="h-8 w-8 hover:bg-primary/10 hover:text-primary rounded-xl" onClick={() => updateQuantity(item.product.id, -1)}><Minus className="w-4 h-4" /></Button>
                          <span className="font-black text-lg tracking-tighter w-4 text-center">{item.quantity}</span>
                          <Button size="icon" variant="ghost" className="h-8 w-8 hover:bg-primary/10 hover:text-primary rounded-xl" onClick={() => updateQuantity(item.product.id, 1)}><Plus className="w-4 h-4" /></Button>
                        </div>
                      </div>
                    ))}
                    {cart.length === 0 && (
                      <div className="h-full flex flex-col items-center justify-center text-center py-20 opacity-20">
                         <ShoppingCart className="w-16 h-16 mb-4" />
                         <p className="font-black uppercase tracking-widest text-xs">Terminal Standby</p>
                      </div>
                    )}
                  </CardContent>
                  <CardFooter className="flex-col gap-8 p-10 border-t bg-secondary/5">
                    <div className="w-full space-y-2">
                       <div className="flex justify-between items-center">
                          <span className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Aggregated Net Value</span>
                          <span className="text-sm font-black text-muted-foreground">{currencySymbol}{subtotal.toFixed(2)}</span>
                       </div>
                       <div className="w-full flex justify-between items-end">
                         <span className="text-[10px] font-black uppercase text-primary tracking-[0.2em] mb-2">Payable Total</span>
                         <span className="text-6xl font-black text-foreground tracking-tighter">{currencySymbol}{subtotal.toFixed(2)}</span>
                       </div>
                    </div>
                    <Button className="w-full h-20 text-2xl font-black rounded-[28px] shadow-2xl transition-all hover:scale-[1.02] active:scale-95" disabled={cart.length === 0} onClick={() => setShowCheckoutDialog(true)}>Initiate Settlement</Button>
                  </CardFooter>
                </Card>
              </div>
            </div>

            <Dialog open={showCheckoutDialog} onOpenChange={setShowCheckoutDialog}>
              <DialogContent className="rounded-[48px] border-none shadow-2xl max-w-xl p-0 overflow-hidden bg-white">
                <div className="bg-primary p-12 text-primary-foreground text-center relative">
                   <div className="absolute top-0 right-0 p-8 opacity-10"><Receipt className="w-20 h-20" /></div>
                   <DialogTitle className="text-xs font-black uppercase tracking-[0.3em] opacity-80 mb-2">Final Verification</DialogTitle>
                   <h2 className="text-7xl font-black tracking-tighter">{currencySymbol}{settlementDue.toFixed(2)}</h2>
                   {voucherDiscount > 0 && (
                     <p className="text-sm font-bold opacity-70 mt-3 bg-black/10 inline-block px-4 py-1 rounded-full uppercase tracking-widest">Voucher Coverage: -{currencySymbol}{voucherDiscount.toFixed(2)}</p>
                   )}
                </div>
                <div className="p-12 space-y-10">
                  <div className="space-y-4">
                    <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground px-1">Settlement Gateway Selection</Label>
                    <RadioGroup value={paymentMethod} onValueChange={(v) => setPaymentMethod(v as PaymentMethod)} className="grid grid-cols-2 gap-4">
                      <PaymentOption value="cash" label="Physical Cash" icon={Banknote} id="cash_final" />
                      <PaymentOption value="card" label="Bank Card" icon={CreditCard} id="card_final" />
                      <PaymentOption value="duitnow" label="DuitNow Digital" icon={QrCode} id="duitnow_final" />
                      <PaymentOption value="coupon" label="Stored Value" icon={Ticket} id="coupon_final" />
                    </RadioGroup>
                  </div>

                  {paymentMethod === 'coupon' && (
                    <div className="space-y-5 animate-in fade-in slide-in-from-top-4">
                       <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-primary px-1">Access Stored-Value Registry</Label>
                       <div className="relative">
                          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                          <Input 
                            placeholder="SEARCH CUSTOMER OR CARD ID..." 
                            className="pl-12 h-14 rounded-2xl bg-secondary/10 border-none font-black"
                            value={voucherSearch}
                            onChange={(e) => setVoucherSearch(e.target.value)}
                          />
                       </div>
                       <div className="max-h-48 overflow-auto space-y-3 custom-scrollbar pr-2">
                          {vouchers?.filter(v => v.customerName.toLowerCase().includes(voucherSearch.toLowerCase()) || v.code.toLowerCase().includes(voucherSearch.toLowerCase())).map(v => (
                            <div 
                              key={v.id} 
                              onClick={() => setSelectedVoucher(v)}
                              className={cn(
                                "p-4 rounded-[20px] border-4 cursor-pointer transition-all flex justify-between items-center group",
                                selectedVoucher?.id === v.id ? "border-primary bg-primary/5" : "border-transparent bg-secondary/10 hover:bg-secondary/20"
                              )}
                            >
                               <div>
                                  <p className="font-black text-sm tracking-tight group-hover:text-primary transition-colors">{v.customerName}</p>
                                  <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest mt-0.5">{v.code}</p>
                               </div>
                               <p className="font-black text-xl tracking-tighter text-foreground">{currencySymbol}{v.balance.toFixed(2)}</p>
                            </div>
                          ))}
                       </div>
                    </div>
                  )}

                  {paymentMethod === 'cash' && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-top-4">
                      <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground px-1">Physical Cash Received ({currencySymbol})</Label>
                        <Input type="number" className="h-20 rounded-[28px] font-black text-5xl tracking-tighter text-center bg-secondary/10 border-none" value={cashReceived} onChange={(e) => setCashReceived(e.target.value)} />
                      </div>
                      {Number(cashReceived) >= settlementDue && (
                        <div className="bg-primary/5 p-8 rounded-[32px] border-4 border-primary/10 flex justify-between items-center animate-in zoom-in-95">
                           <div>
                              <p className="text-[10px] font-black uppercase text-primary tracking-widest">Return Change Due</p>
                              <p className="text-xs font-bold text-muted-foreground mt-1">Settlement verified</p>
                           </div>
                           <p className="text-5xl font-black tracking-tighter text-foreground">{currencySymbol}{changeAmount.toFixed(2)}</p>
                        </div>
                      )}
                    </div>
                  )}
                  {(paymentMethod === 'card' || paymentMethod === 'duitnow') && (
                    <div className="space-y-4 animate-in fade-in slide-in-from-top-4">
                       <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground px-1">Terminal Reference / Trace ID</Label>
                       <Input placeholder="ENTER TRANSACTION REF..." className="h-16 rounded-2xl font-black text-xl tracking-tight bg-secondary/10 border-none px-6" value={referenceNumber} onChange={(e) => setReferenceNumber(e.target.value)} />
                    </div>
                  )}
                </div>
                <div className="p-12 pt-0">
                  <Button onClick={handleFinalCheckout} className="w-full h-24 rounded-[32px] font-black text-2xl shadow-2xl transition-all hover:scale-[1.02] active:scale-95" disabled={isProcessing || isInsufficientCash || isMissingReference}>
                    {isProcessing ? "COMMITING LEDGER..." : "Complete & Finalize Order"}
                  </Button>
                  <p className="text-center text-[10px] font-black text-muted-foreground uppercase tracking-widest mt-6 opacity-40">Tactical Settlement Protocol Active</p>
                </div>
              </DialogContent>
            </Dialog>
          </TabsContent>

          <TabsContent value="history" className="flex-1 overflow-auto">
             <div className="bg-white rounded-[48px] border-2 border-primary/5 shadow-sm overflow-hidden mb-12">
                <CardHeader className="bg-secondary/10 border-b p-10">
                   <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                      <div>
                         <CardTitle className="text-3xl font-black flex items-center gap-3 tracking-tight">
                            <History className="w-8 h-8 text-primary" /> Strategic Sales Registry
                         </CardTitle>
                         <CardDescription className="font-bold text-sm text-muted-foreground mt-2 uppercase tracking-widest">Immutable Audit Trail of Retail Activity</CardDescription>
                      </div>
                      <div className="flex items-center gap-4 bg-white px-6 py-3 rounded-2xl shadow-sm border border-primary/10">
                         <Badge variant="outline" className="font-black text-xs h-8 px-4 border-2">{martTransactions.length} TOTAL SESSIONS</Badge>
                         <div className="text-right">
                            <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">Verified Revenue</p>
                            <p className="text-lg font-black tracking-tighter text-primary">{currencySymbol}{martTransactions.reduce((acc, t) => acc + t.totalAmount, 0).toFixed(2)}</p>
                         </div>
                      </div>
                   </div>
                </CardHeader>
                <div className="overflow-x-auto">
                   <table className="w-full text-sm text-left">
                     <thead className="bg-secondary/5 border-b-2">
                       <tr>
                         <th className="p-8 font-black uppercase text-[10px] tracking-[0.2em] text-muted-foreground">Session ID / Context</th>
                         <th className="p-8 font-black uppercase text-[10px] tracking-[0.2em] text-muted-foreground">Account Identity</th>
                         <th className="p-8 font-black uppercase text-[10px] tracking-[0.2em] text-muted-foreground">Gateway</th>
                         <th className="p-8 font-black uppercase text-[10px] tracking-[0.2em] text-muted-foreground">Total Yield</th>
                         <th className="p-8 font-black uppercase text-[10px] tracking-[0.2em] text-muted-foreground">Net Margin</th>
                         <th className="p-8 text-center font-black uppercase text-[10px] tracking-[0.2em] text-muted-foreground">Operations</th>
                       </tr>
                     </thead>
                     <tbody className="divide-y">
                       {martTransactions.slice().sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).map(t => (
                         <tr key={t.id} className="hover:bg-secondary/10 transition-all group">
                           <td className="p-8">
                              <p className="font-black font-mono text-xs text-primary">REF-{t.id.split('-')[0].toUpperCase()}</p>
                              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-1.5">{new Date(t.timestamp).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}</p>
                           </td>
                           <td className="p-8">
                              <p className="font-black text-lg tracking-tight text-foreground">{t.customerName || 'Walk-in Guest'}</p>
                              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-1">{t.items?.length || 0} SKU(s) Processed</p>
                           </td>
                           <td className="p-8">
                              <Badge className="font-black uppercase text-[9px] h-6 px-4 tracking-[0.1em] rounded-lg border-none">{t.paymentMethod || 'cash'}</Badge>
                              {t.referenceNumber && <p className="text-[10px] font-mono text-muted-foreground mt-2 opacity-60">ID: {t.referenceNumber}</p>}
                           </td>
                           <td className="p-8">
                              <p className="font-black text-foreground text-2xl tracking-tighter">{currencySymbol}{t.totalAmount.toFixed(2)}</p>
                           </td>
                           <td className="p-8">
                              <div className="flex items-center gap-2">
                                 <div className="w-1.5 h-6 bg-primary/20 rounded-full" />
                                 <p className="font-black text-primary text-2xl tracking-tighter">{currencySymbol}{t.profit.toFixed(2)}</p>
                              </div>
                           </td>
                           <td className="p-8 text-center">
                             <Button 
                               variant="ghost" 
                               size="icon" 
                               onClick={() => handleInitiateReverse(t)}
                               className="h-12 w-12 rounded-2xl text-muted-foreground hover:text-destructive hover:bg-destructive/10 opacity-0 group-hover:opacity-100 transition-all border-2 border-transparent hover:border-destructive/20"
                               title="Initiate Security Reversal"
                             >
                                <XCircle className="w-6 h-6" />
                             </Button>
                           </td>
                         </tr>
                       ))}
                       {martTransactions.length === 0 && (
                         <tr>
                            <td colSpan={6} className="py-32 text-center opacity-20">
                               <Receipt className="w-24 h-24 mx-auto mb-6" />
                               <p className="font-black uppercase tracking-[0.3em] text-sm">Registry Empty</p>
                            </td>
                         </tr>
                       )}
                     </tbody>
                   </table>
                </div>
             </div>
          </TabsContent>

          <TabsContent value="inventory" className="flex-1 overflow-auto">
            <InventoryManager companyId={user?.companyId} products={products} isBudgetActive={isBudgetActive} remainingBudget={remainingBudget} currencySymbol={currencySymbol} />
          </TabsContent>
          <TabsContent value="coupons" className="flex-1 overflow-auto">
            <CouponManager companyId={user?.companyId} companyDoc={companyDoc} currencySymbol={currencySymbol} />
          </TabsContent>
          <TabsContent value="profits" className="flex-1 overflow-auto">
            <ProfitAnalytics transactions={martTransactions} currencySymbol={currencySymbol} />
          </TabsContent>
          <TabsContent value="billing" className="flex-1 overflow-auto">
            <BillingManager companyId={user?.companyId} companyDoc={companyDoc} />
          </TabsContent>
        </Tabs>
      </main>

      <Dialog open={isReverseDialogOpen} onOpenChange={setIsReverseDialogOpen}>
        <DialogContent className="rounded-[40px] border-none shadow-2xl max-md p-0 overflow-hidden bg-white">
          <div className="bg-destructive p-12 text-destructive-foreground relative">
            <div className="absolute top-0 right-0 p-10 opacity-10"><ShieldCheck className="w-24 h-24" /></div>
            <div className="w-16 h-16 bg-white/20 rounded-3xl flex items-center justify-center mb-6 relative z-10">
              <Lock className="w-8 h-8" />
            </div>
            <DialogTitle className="text-3xl font-black tracking-tighter leading-none relative z-10">Security Reversal</DialogTitle>
            <DialogDescription className="text-destructive-foreground/80 font-bold mt-3 relative z-10 text-sm">
              Critical Authorization Required. Enter your 8-character Supervisor ID to reverse this transaction and restore assets.
            </DialogDescription>
          </div>
          <div className="p-12 space-y-10">
            <div className="p-6 bg-secondary/10 rounded-3xl space-y-2 border-2 border-dashed border-destructive/20">
               <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Pending Restoration</p>
               <div className="flex justify-between items-end">
                  <p className="font-black text-lg text-foreground">Ref: #{pendingReverseTrans?.id.split('-')[0].toUpperCase()}</p>
                  <p className="font-black text-3xl text-destructive tracking-tighter">{currencySymbol}{pendingReverseTrans?.totalAmount.toFixed(2)}</p>
               </div>
            </div>
            <div className="space-y-3">
              <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground px-1">Supervisor Authorization Token</Label>
              <Input 
                placeholder="TOKEN ID" 
                value={reverseKey}
                onChange={(e) => setReverseKey(e.target.value.toUpperCase())}
                className="h-20 rounded-[28px] bg-secondary/10 border-none font-mono font-black tracking-[0.5em] text-3xl text-center" 
              />
            </div>
            <Button 
              onClick={handleConfirmReverse} 
              disabled={isReversing || reverseKey.length < 8}
              className="w-full h-20 rounded-[32px] font-black text-xl shadow-2xl bg-destructive hover:bg-destructive/90 transition-all hover:scale-[1.02]"
            >
              {isReversing ? "AUTHORIZING..." : "Confirm Ledger Reversal"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function InventoryManager({ companyId, products, isBudgetActive, remainingBudget, currencySymbol }: { companyId?: string, products: Product[] | null, isBudgetActive: boolean, remainingBudget: number, currencySymbol: string }) {
  const firestore = useFirestore();
  const { toast } = useToast();
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [refillScan, setRefillScan] = useState('');
  const [refillSearch, setRefillSearch] = useState('');

  const [unitsBought, setUnitsBought] = useState<string>('1');
  const [itemsPerUnit, setItemsPerUnit] = useState<string>('1');
  const [costPerUnit, setCostPerUnit] = useState<string>('');
  const [retailPrice, setRetailPrice] = useState<string>('');

  useEffect(() => {
    if (selectedProduct) {
      setItemsPerUnit(selectedProduct.itemsPerUnit?.toString() || '1');
      const currentUnitCost = selectedProduct.costPrice * (selectedProduct.itemsPerUnit || 1);
      setCostPerUnit(currentUnitCost.toFixed(2));
      setRetailPrice(selectedProduct.sellingPrice.toFixed(2));
    }
  }, [selectedProduct]);

  const handleRefillScan = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      const matched = products?.find(p => p.barcode === refillScan.trim());
      if (matched) {
        setSelectedProduct(matched);
        setRefillScan('');
      } else {
        toast({ title: "Product Not Found", variant: "destructive" });
      }
    }
  };

  const refillYield = (Number(unitsBought) * Number(itemsPerUnit));
  const totalRefillCost = (Number(unitsBought) * Number(costPerUnit));

  const handleConfirmRefill = (e: React.FormEvent) => {
    e.preventDefault();
    if (!firestore || !companyId || !selectedProduct) return;

    if (totalRefillCost > remainingBudget) {
      toast({ title: "Insufficient Budget", description: "This refill exceeds your remaining cycle budget.", variant: "destructive" });
      return;
    }

    setIsProcessing(true);

    const units = Number(unitsBought);
    const ipu = Number(itemsPerUnit);
    const cpu = Number(costPerUnit);
    const newRetail = Number(retailPrice);

    const totalStockAdded = units * ipu;
    const totalCost = units * cpu;
    const normalizedCost = totalCost / totalStockAdded;

    const productRef = doc(firestore, 'companies', companyId, 'products', selectedProduct.id);
    const purchaseRef = collection(firestore, 'companies', companyId, 'purchases');

    const updateData = {
      stock: increment(totalStockAdded),
      costPrice: normalizedCost,
      sellingPrice: newRetail,
      itemsPerUnit: ipu
    };

    updateDoc(productRef, updateData).catch(async (err) => {
      errorEmitter.emit('permission-error', new FirestorePermissionError({
        path: productRef.path,
        operation: 'update',
        requestResourceData: updateData
      }));
    });

    const purchaseData = {
      id: crypto.randomUUID(),
      companyId,
      amount: totalCost,
      description: `Restock: ${units}x Unit(s) of ${selectedProduct.name} (${ipu} per unit)`,
      timestamp: new Date().toISOString()
    };

    addDoc(purchaseRef, purchaseData).catch(async (err) => {
      errorEmitter.emit('permission-error', new FirestorePermissionError({
        path: purchaseRef.path,
        operation: 'create',
        requestResourceData: purchaseData
      }));
    });

    toast({ title: "Inventory Replenished", description: `Added ${totalStockAdded} items to ${selectedProduct.name}.` });
    setSelectedProduct(null);
    setUnitsBought('1');
    setIsProcessing(false);
  };

  const handleAddNew = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!firestore || !companyId) return;
    const formData = new FormData(e.currentTarget);
    
    const cost = Number(formData.get('cost'));
    const stock = Number(formData.get('stock'));
    const totalInitialCost = cost * stock;

    if (!editingProduct && totalInitialCost > remainingBudget) {
      toast({ title: "Insufficient Budget", description: "Initial stock registry exceeds budget.", variant: "destructive" });
      return;
    }

    setIsProcessing(true);
    const id = editingProduct?.id || crypto.randomUUID();
    
    const unit = editingProduct ? editingProduct.unit : formData.get('unit') as string;
    const price = editingProduct ? editingProduct.sellingPrice : Number(formData.get('price'));
    const ipu = editingProduct ? editingProduct.itemsPerUnit : Number(formData.get('ipu') || 1);
    
    const productData: Product = {
      id,
      companyId,
      name: formData.get('name') as string,
      unit,
      barcode: formData.get('barcode') as string,
      costPrice: editingProduct ? editingProduct.costPrice : cost,
      sellingPrice: price,
      stock: editingProduct ? editingProduct.stock : stock,
      itemsPerUnit: ipu
    };

    const docRef = doc(firestore, 'companies', companyId, 'products', id);
    setDoc(docRef, productData)
      .then(() => {
        if (!editingProduct && totalInitialCost > 0) {
          const purchaseRef = collection(firestore, 'companies', companyId, 'purchases');
          const purchaseData = {
            id: crypto.randomUUID(),
            companyId,
            amount: totalInitialCost,
            description: `Initial Stock Registry: ${stock}x ${productData.name}`,
            timestamp: new Date().toISOString()
          };
          addDoc(purchaseRef, purchaseData);
        }
        toast({ title: editingProduct ? "Product Updated" : "Product Registered" });
        setIsAddDialogOpen(false);
        setEditingProduct(null);
      })
      .catch(async (err) => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({
          path: docRef.path,
          operation: editingProduct ? 'update' : 'create',
          requestResourceData: productData
        }));
      })
      .finally(() => {
        setIsProcessing(false);
      });
  };

  const handleDeleteProduct = (id: string) => {
    if (!firestore || !companyId) return;
    if (!confirm("Permanently remove this product registry?")) return;
    const docRef = doc(firestore, 'companies', companyId, 'products', id);
    deleteDocumentNonBlocking(docRef);
    toast({ title: "Product Removed" });
  };

  const canProcure = isBudgetActive && remainingBudget > 0;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-10 pb-16">
      <div className="lg:col-span-1">
        <Card className={cn(
          "border-none shadow-sm rounded-[40px] bg-white p-10 sticky top-0 border-2 border-transparent",
          !canProcure && !editingProduct ? "grayscale opacity-80 border-destructive/10" : "hover:border-primary/10"
        )}>
          <div className="flex items-center gap-3 mb-8">
            <div className={cn("w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg", canProcure ? "bg-primary text-primary-foreground" : "bg-destructive/10 text-destructive")}>
              {canProcure ? <RefreshCw className="w-7 h-7" /> : <Lock className="w-7 h-7" />}
            </div>
            <div>
               <h3 className="text-xl font-black tracking-tight">{canProcure ? 'Stock Replenish' : 'Terminal Locked'}</h3>
               <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest mt-1">Refill Protocol</p>
            </div>
          </div>

          <div className="space-y-8">
            {!selectedProduct && (
              <div className="space-y-6">
                <div className="relative group">
                  <Scan className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-primary z-10" />
                  <Input 
                    placeholder="SCAN BARCODE..." 
                    disabled={!canProcure}
                    className="pl-12 h-14 rounded-2xl bg-secondary/10 border-none font-black text-sm tracking-tight focus-visible:bg-white focus-visible:shadow-xl transition-all relative z-0"
                    value={refillScan}
                    onChange={(e) => setRefillScan(e.target.value)}
                    onKeyDown={handleRefillScan}
                  />
                </div>
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <Input 
                    placeholder="SEARCH CATALOG..." 
                    disabled={!canProcure}
                    className="pl-12 h-12 rounded-2xl bg-secondary/5 border-none text-[11px] font-black tracking-widest uppercase"
                    value={refillSearch}
                    onChange={(e) => setRefillSearch(e.target.value)}
                  />
                </div>
                <ScrollArea className="h-64 border rounded-3xl p-4 bg-secondary/5 border-secondary/20">
                   <div className="space-y-2">
                      {products?.filter(p => p.name.toLowerCase().includes(refillSearch.toLowerCase())).map(p => (
                        <div 
                          key={p.id} 
                          onClick={() => canProcure && setSelectedProduct(p)}
                          className={cn(
                            "p-4 rounded-2xl cursor-pointer transition-all border-2 border-transparent",
                            canProcure ? "hover:bg-white hover:border-primary/10 group" : "opacity-50 pointer-events-none"
                          )}
                        >
                           <p className="text-xs font-black group-hover:text-primary transition-colors tracking-tight">{p.name}</p>
                           <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest mt-1">{p.barcode || 'Manual Entry'}</p>
                        </div>
                      ))}
                   </div>
                </ScrollArea>
              </div>
            )}

            {selectedProduct ? (
              <form onSubmit={handleConfirmRefill} className="space-y-6 animate-in fade-in slide-in-from-top-4">
                <div className="p-6 bg-primary/5 rounded-3xl border-2 border-primary/10 relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-4 opacity-5"><Package className="w-16 h-16" /></div>
                  <p className="text-[9px] font-black text-primary uppercase tracking-[0.2em] mb-2">Identified SKU</p>
                  <p className="text-xl font-black leading-tight pr-10 tracking-tight">{selectedProduct.name}</p>
                  <button 
                    type="button"
                    className="absolute top-4 right-4 text-muted-foreground hover:text-destructive transition-colors"
                    onClick={() => setSelectedProduct(null)}
                  >
                    <XCircle className="w-6 h-6" />
                  </button>
                </div>

                <div className="space-y-5">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground px-1">Batch Units</Label>
                      <Input type="number" value={unitsBought} onChange={(e) => setUnitsBought(e.target.value)} className="h-12 rounded-xl font-black text-lg border-2 border-secondary/20" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground px-1">Items/Unit</Label>
                      <Input type="number" value={itemsPerUnit} onChange={(e) => setItemsPerUnit(e.target.value)} className="h-12 rounded-xl font-black text-lg border-2 border-secondary/20" />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground px-1">Purchase Cost/Unit ({currencySymbol})</Label>
                    <Input type="number" step="0.01" value={costPerUnit} onChange={(e) => setCostPerUnit(e.target.value)} className="h-14 rounded-2xl font-black text-2xl border-2 border-secondary/20" />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-primary px-1">New Selling Price/Item ({currencySymbol})</Label>
                    <Input type="number" step="0.01" value={retailPrice} onChange={(e) => setRetailPrice(e.target.value)} className="h-14 rounded-2xl font-black text-2xl border-2 border-primary/20 text-primary" />
                  </div>
                </div>

                <div className="bg-secondary/10 p-6 rounded-[24px] space-y-3 border-2 border-transparent">
                   <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest border-b border-secondary/20 pb-2 mb-2">
                      <span className="text-muted-foreground">Tactical Liability</span>
                      <span className={cn("font-black text-2xl tracking-tighter", totalRefillCost > remainingBudget ? "text-destructive" : "text-primary")}>
                        {currencySymbol}{totalRefillCost.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </span>
                   </div>
                   {totalRefillCost > remainingBudget && (
                     <div className="flex items-center gap-2 text-destructive">
                        <AlertTriangle className="w-3 h-3" />
                        <p className="text-[9px] font-black uppercase tracking-widest">Exceeds Cycle Capacity</p>
                     </div>
                   )}
                </div>

                <div className="flex gap-3">
                  <Button type="button" variant="outline" onClick={() => setSelectedProduct(null)} className="flex-1 rounded-2xl h-14 font-black uppercase text-xs tracking-widest">Abort</Button>
                  <Button type="submit" className="flex-1 rounded-2xl h-14 font-black shadow-xl uppercase text-xs tracking-widest" disabled={isProcessing || !canProcure || !unitsBought || !costPerUnit || totalRefillCost > remainingBudget}>
                    {isProcessing ? "PROCESSING..." : "Commit Refill"}
                  </Button>
                </div>
              </form>
            ) : !canProcure && (
              <div className="p-8 bg-destructive/5 rounded-[32px] border-4 border-dashed border-destructive/10 text-center animate-pulse">
                 <Lock className="w-10 h-10 text-destructive/30 mx-auto mb-4" />
                 <p className="text-[10px] font-black text-destructive uppercase tracking-[0.2em]">Procurement Frozen</p>
                 <p className="text-xs font-bold text-muted-foreground mt-2 leading-relaxed">Strategic budget exhausted. Inject recovered modal funds to resume.</p>
              </div>
            )}
          </div>
        </Card>
      </div>

      <div className="lg:col-span-3 space-y-8">
        <div className="flex justify-between items-center px-4">
          <div>
             <h3 className="text-2xl font-black tracking-tight">Active SKU Registry</h3>
             <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-1">Managed retail assets and valuation</p>
          </div>
          <Dialog open={isAddDialogOpen} onOpenChange={(open) => { setIsAddDialogOpen(open); if(!open) setEditingProduct(null); }}>
            <DialogTrigger asChild>
              <Button className="rounded-2xl h-14 px-10 font-black shadow-2xl transition-all hover:scale-[1.02] active:scale-95" disabled={!canProcure && !editingProduct} onClick={() => setEditingProduct(null)}>
                <Plus className="w-5 h-5 mr-3" /> Register New Asset
              </Button>
            </DialogTrigger>
            <DialogContent className="rounded-[48px] max-lg p-0 overflow-hidden bg-white border-none shadow-2xl">
               <div className="bg-primary p-10 text-primary-foreground relative">
                 <div className="absolute top-0 right-0 p-10 opacity-10"><Package className="w-20 h-20" /></div>
                 <DialogTitle className="text-3xl font-black tracking-tighter leading-none relative z-10">{editingProduct ? 'Update Asset Metadata' : 'New Asset Registration'}</DialogTitle>
                 <p className="text-xs font-bold opacity-70 mt-3 relative z-10 uppercase tracking-widest">Global SKU Protocol</p>
               </div>
               <form onSubmit={handleAddNew} className="p-10 space-y-8">
                 <div className="space-y-2">
                   <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground px-1">Tactical Item Name</Label>
                   <Input name="name" defaultValue={editingProduct?.name} placeholder="e.g. Premium Matcha Powder" required className="h-14 rounded-2xl bg-secondary/10 border-none font-black text-lg" />
                 </div>
                 <div className="grid grid-cols-2 gap-6">
                   <div className="space-y-2">
                     <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground px-1">Inventory Unit</Label>
                     <Input name="unit" defaultValue={editingProduct?.unit} placeholder="e.g. bottle, pack" required disabled={!!editingProduct} className="h-14 rounded-2xl bg-secondary/10 border-none font-black" />
                   </div>
                   <div className="space-y-2">
                     <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground px-1">Global Barcode / SKU</Label>
                     <Input name="barcode" defaultValue={editingProduct?.barcode} placeholder="SCAN OR TYPE" className="h-14 rounded-2xl bg-secondary/10 border-none font-black" />
                   </div>
                 </div>
                 <div className="grid grid-cols-2 gap-6">
                   <div className="space-y-2">
                     <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground px-1">Baseline Unit Cost ({currencySymbol})</Label>
                     <Input name="cost" type="number" step="0.01" defaultValue={editingProduct?.costPrice} required disabled={!!editingProduct} className="h-14 rounded-2xl bg-secondary/10 border-none font-black text-lg" />
                   </div>
                   <div className="space-y-2">
                     <Label className="text-[10px] font-black uppercase tracking-widest text-primary px-1">Tactical Selling Price ({currencySymbol})</Label>
                     <Input name="price" type="number" step="0.01" defaultValue={editingProduct?.sellingPrice} required className="h-14 rounded-2xl border-4 border-primary/10 font-black text-lg text-primary" />
                   </div>
                 </div>
                 {!editingProduct && (
                   <div className="space-y-2">
                     <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground px-1">Initial Commissioning Stock</Label>
                     <Input name="stock" type="number" placeholder="0" required className="h-14 rounded-2xl bg-secondary/10 border-none font-black" />
                   </div>
                 )}
                 <Button type="submit" className="w-full h-20 rounded-[32px] font-black text-xl shadow-2xl transition-all hover:scale-[1.02] mt-4" disabled={isProcessing}>
                   {isProcessing ? "COMMITING ASSET..." : editingProduct ? "Confirm Metadata Update" : "Authorize Asset Launch"}
                 </Button>
               </form>
            </DialogContent>
          </Dialog>
        </div>
        <div className="bg-white rounded-[40px] border-2 border-primary/5 overflow-hidden shadow-sm">
          <table className="w-full text-sm text-left">
            <thead className="bg-secondary/20 border-b-2">
              <tr>
                <th className="p-8 font-black uppercase text-[10px] tracking-widest text-muted-foreground">Product Asset</th>
                <th className="p-8 font-black uppercase text-[10px] tracking-widest text-muted-foreground">Inventory</th>
                <th className="p-8 font-black uppercase text-[10px] tracking-widest text-muted-foreground">Unit Cost</th>
                <th className="p-8 font-black uppercase text-[10px] tracking-widest text-muted-foreground">Selling Price</th>
                <th className="p-8 font-black uppercase text-[10px] tracking-widest text-muted-foreground">Yield</th>
                <th className="p-8 text-right font-black uppercase text-[10px] tracking-widest text-muted-foreground">Net Valuation</th>
                <th className="p-8 text-center font-black uppercase text-[10px] tracking-widest text-muted-foreground">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y">{products?.map(p => (
              <tr key={p.id} className="hover:bg-secondary/10 transition-colors group">
                <td className="p-8">
                  <p className="font-black text-lg tracking-tight text-foreground">{p.name}</p>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-1">{p.barcode || 'SYSTEM REG'}</p>
                </td>
                <td className="p-8">
                   <Badge variant={p.stock < 10 ? "destructive" : "secondary"} className="font-black h-7 px-4 rounded-xl tracking-tight">
                      {p.stock} {p.unit || 'units'}
                   </Badge>
                </td>
                <td className="p-8 font-bold text-muted-foreground tracking-tighter">{currencySymbol}{p.costPrice.toFixed(2)}</td>
                <td className="p-8 font-black text-foreground text-lg tracking-tighter">{currencySymbol}{p.sellingPrice.toFixed(2)}</td>
                <td className="p-8 font-black text-primary text-xl tracking-tighter">+{currencySymbol}{(p.sellingPrice - p.costPrice).toFixed(2)}</td>
                <td className="p-8 text-right font-black text-foreground text-2xl tracking-tighter">{currencySymbol}{(p.stock * p.costPrice).toFixed(2)}</td>
                <td className="p-8 text-center">
                  <div className="flex items-center justify-center gap-3">
                    <Button variant="ghost" size="icon" onClick={() => { setEditingProduct(p); setIsAddDialogOpen(true); }} className="h-10 w-10 rounded-xl text-primary hover:bg-primary/10 transition-all"><Edit2 className="w-4 h-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDeleteProduct(p.id)} className="h-10 w-10 rounded-xl text-destructive hover:bg-destructive/10 transition-all"><Trash2 className="w-4 h-4" /></Button>
                  </div>
                </td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function CouponManager({ companyId, companyDoc, currencySymbol }: { companyId?: string, companyDoc: Company | null, currencySymbol: string }) {
  const firestore = useFirestore();
  const { toast } = useToast();
  
  const [customerName, setCustomerName] = useState('');
  const [customerCompany, setCustomerCompany] = useState('');
  const [batch, setBatch] = useState<{ id: string, value: number, qty: number }[]>([]);
  const [inputVal, setInputVal] = useState<string>('');
  const [inputQty, setInputQty] = useState<string>('1');
  const [expiry, setExpiry] = useState('');
  const [purchaseMethod, setPurchaseMethod] = useState<PaymentMethod>('cash');
  const [cashReceived, setCashReceived] = useState<number | string>('');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [registrySearch, setRegistrySearch] = useState('');

  const couponsQuery = useMemoFirebase(() => (!firestore || !companyId) ? null : collection(firestore, 'companies', companyId, 'coupons'), [firestore, companyId]);
  const { data: coupons } = useCollection<Coupon>(couponsQuery);

  const filteredCoupons = useMemo(() => {
    if (!coupons) return [];
    return coupons.filter(c => 
      c.customerName.toLowerCase().includes(registrySearch.toLowerCase()) || 
      c.code.toLowerCase().includes(registrySearch.toLowerCase())
    ).sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [coupons, registrySearch]);

  const bankStats = useMemo(() => {
    if (!coupons) return { totalLiability: 0, totalIssued: 0, cash: 0, card: 0, duitnow: 0 };
    return coupons.reduce((acc, c) => {
      const bal = c.balance || 0;
      acc.totalLiability += bal;
      acc.totalIssued += (c.initialValue || 0);
      
      if (c.paymentMethod === 'cash') acc.cash += bal;
      else if (c.paymentMethod === 'card') acc.card += bal;
      else if (c.paymentMethod === 'duitnow') acc.duitnow += bal;
      
      return acc;
    }, { totalLiability: 0, totalIssued: 0, cash: 0, card: 0, duitnow: 0 });
  }, [coupons]);

  const addToBatch = () => {
    if (!inputVal || Number(inputVal) <= 0 || !inputQty || Number(inputQty) <= 0) {
      toast({ title: "Invalid Input", variant: "destructive" });
      return;
    }
    setBatch([...batch, { id: crypto.randomUUID(), value: Number(inputVal), qty: Number(inputQty) }]);
    setInputVal('');
    setInputQty('1');
  };

  const removeFromBatch = (id: string) => setBatch(batch.filter(item => item.id !== id));

  const subtotal = batch.reduce((acc, item) => acc + (item.value * item.qty), 0);
  const cashChange = purchaseMethod === 'cash' ? Math.max(0, (Number(cashReceived) || 0) - subtotal) : 0;
  
  const isPaymentValid = useMemo(() => {
    if (batch.length === 0) return false;
    if (purchaseMethod === 'cash') return Number(cashReceived) >= subtotal;
    if (purchaseMethod === 'card' || purchaseMethod === 'duitnow') return referenceNumber.trim().length > 0;
    return true;
  }, [batch, purchaseMethod, cashReceived, subtotal, referenceNumber]);

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!firestore || !companyId || !isPaymentValid) return;
    setIsProcessing(true);

    const creationBatch: {id: string, data: Coupon}[] = [];
    for (const item of batch) {
      for (let i = 0; i < item.qty; i++) {
        const id = crypto.randomUUID();
        const shortId = id.split('-')[0].toUpperCase();
        const data: Coupon = { 
          id, 
          companyId, 
          code: `VAL${item.value}-${shortId}`, 
          initialValue: item.value, 
          balance: item.value, 
          expiryDate: expiry, 
          status: 'active',
          customerName,
          customerCompany: customerCompany || null,
          createdAt: new Date().toISOString(),
          paymentMethod: purchaseMethod 
        };
        creationBatch.push({ id, data });
      }
    }

    creationBatch.forEach(({ id, data }) => {
      const docRef = doc(firestore, 'companies', companyId, 'coupons', id);
      setDoc(docRef, data);
    });

    toast({ title: "Liability Deposit Logged" });
    setCustomerName(''); 
    setCustomerCompany(''); 
    setBatch([]); 
    setCashReceived(''); 
    setReferenceNumber('');
    setIsProcessing(false);
  };

  const handleRevokeVoucher = (id: string) => {
    if (!firestore || !companyId) return;
    if (!confirm("Revoke this voucher?")) return;
    deleteDocumentNonBlocking(doc(firestore, 'companies', companyId, 'coupons', id));
    toast({ title: "Voucher Revoked" });
  };

  return (
    <div className="space-y-10 pb-16">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <Card className="border-none shadow-xl bg-white rounded-[48px] p-10 relative overflow-hidden group border-2 border-transparent hover:border-primary/5 transition-all">
          <div className="absolute top-0 right-0 p-10 opacity-5 group-hover:scale-110 transition-transform duration-500">
            <Landmark className="w-24 h-24" />
          </div>
          <div className="space-y-2 relative z-10">
            <p className="text-[10px] font-black uppercase text-muted-foreground tracking-[0.2em] leading-none mb-2">Stored-Value Liability Bank</p>
            <h4 className="text-5xl font-black tracking-tighter text-primary">{currencySymbol}{bankStats.totalLiability.toLocaleString(undefined, { minimumFractionDigits: 2 })}</h4>
            <div className="grid grid-cols-3 gap-6 mt-10 pt-10 border-t-2 border-secondary/20">
               <div><p className="text-[9px] font-black uppercase text-muted-foreground mb-2 tracking-widest">Physical Cash</p><p className="text-lg font-black tracking-tighter">{currencySymbol}{bankStats.cash.toFixed(2)}</p></div>
               <div><p className="text-[9px] font-black uppercase text-muted-foreground mb-2 tracking-widest">Bank Card</p><p className="text-lg font-black tracking-tighter">{currencySymbol}{bankStats.card.toFixed(2)}</p></div>
               <div><p className="text-[9px] font-black uppercase text-muted-foreground mb-2 tracking-widest">DuitNow</p><p className="text-lg font-black tracking-tighter">{currencySymbol}{bankStats.duitnow.toFixed(2)}</p></div>
            </div>
          </div>
        </Card>
        <Card className="border-none shadow-xl bg-white rounded-[48px] p-10 relative overflow-hidden group border-2 border-transparent hover:border-primary/5 transition-all">
          <div className="absolute top-0 right-0 p-10 opacity-5 group-hover:scale-110 transition-transform duration-500">
            <TrendingUp className="w-24 h-24" />
          </div>
          <div className="space-y-2 relative z-10">
            <p className="text-[10px] font-black uppercase text-muted-foreground tracking-[0.2em] leading-none mb-2">Cumulative Value Issued</p>
            <h4 className="text-5xl font-black tracking-tighter text-foreground">{currencySymbol}{bankStats.totalIssued.toLocaleString(undefined, { minimumFractionDigits: 2 })}</h4>
            <p className="text-xs font-bold text-muted-foreground opacity-60 mt-4 leading-relaxed max-w-xs">Aggregate volume of liquidity credit generated via stored-value protocols.</p>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-10">
        <div className="lg:col-span-1">
          <Card className="border-none shadow-sm rounded-[40px] bg-white p-10 sticky top-0 border-2 border-secondary/10">
            <h3 className="text-2xl font-black mb-8 tracking-tight">Batch Issuance</h3>
            <div className="space-y-8">
                <div className="space-y-5">
                   <div className="space-y-2"><Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground px-1">Customer Entity</Label><Input placeholder="Full Name" value={customerName} onChange={(e) => setCustomerName(e.target.value)} className="h-14 rounded-2xl bg-secondary/10 border-none font-black text-lg" /></div>
                   <div className="space-y-2"><Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground px-1">Global Expiry Date</Label><Input type="date" value={expiry} onChange={(e) => setExpiry(e.target.value)} className="h-14 rounded-2xl bg-secondary/10 border-none font-black" /></div>
                </div>
                <Separator className="opacity-50" />
                <div className="p-6 bg-secondary/10 rounded-3xl space-y-5 border border-secondary/20">
                   <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2"><Label className="text-[10px] font-black uppercase tracking-widest">Card Value</Label><Input type="number" step="0.01" value={inputVal} onChange={(e) => setInputVal(e.target.value)} placeholder="0.00" className="h-12 rounded-xl font-black text-xl border-2 border-secondary/30" /></div>
                      <div className="space-y-2"><Label className="text-[10px] font-black uppercase tracking-widest">Quantity</Label><Input type="number" value={inputQty} onChange={(e) => setInputQty(e.target.value)} className="h-12 rounded-xl font-black text-xl border-2 border-secondary/30" /></div>
                   </div>
                   <Button onClick={addToBatch} variant="secondary" className="w-full h-14 rounded-2xl font-black text-xs uppercase tracking-[0.2em] gap-3 transition-all hover:bg-secondary/80"><Plus className="w-4 h-4" /> Add to Batch</Button>
                </div>
                {batch.length > 0 && (
                  <div className="space-y-4 animate-in slide-in-from-top-4">
                     <div className="space-y-2 max-h-48 overflow-auto custom-scrollbar pr-2">
                        {batch.map(item => (
                          <div key={item.id} className="bg-white border-2 border-secondary/20 rounded-2xl p-4 flex justify-between items-center group">
                             <div><p className="font-black text-lg tracking-tight">{currencySymbol}{item.value.toFixed(2)}</p><p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Batch size: {item.qty}</p></div>
                             <Button variant="ghost" size="icon" onClick={() => removeFromBatch(item.id)} className="h-10 w-10 rounded-xl text-destructive hover:bg-destructive/10"><Trash2 className="w-4 h-4" /></Button>
                          </div>
                        ))}
                     </div>
                     <div className="bg-primary/5 p-6 rounded-3xl border-4 border-primary/10 flex justify-between items-center"><span className="text-[10px] font-black text-primary uppercase tracking-widest">Total Batch Fee</span><span className="text-2xl font-black tracking-tighter">{currencySymbol}{subtotal.toFixed(2)}</span></div>
                  </div>
                )}
                <Separator className="opacity-50" />
                <div className="space-y-5">
                   <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground px-1">Tactical Payment Method</Label>
                   <RadioGroup value={purchaseMethod} onValueChange={(v) => { setPurchaseMethod(v as PaymentMethod); setReferenceNumber(''); setCashReceived(''); }} className="grid grid-cols-3 gap-3">
                      <PaymentOption value="cash" label="Cash" icon={Banknote} id="cou_cash" />
                      <PaymentOption value="card" label="Card" icon={CreditCard} id="cou_card" />
                      <PaymentOption value="duitnow" label="QR" icon={QrCode} id="cou_qr" />
                   </RadioGroup>
                </div>
                {purchaseMethod === 'cash' && (
                  <div className="p-6 bg-secondary/10 rounded-3xl space-y-4 border border-secondary/20">
                     <div className="space-y-2"><Label className="text-[10px] font-black uppercase tracking-widest">Cash Received ({currencySymbol})</Label><Input type="number" value={cashReceived} onChange={(e) => setCashReceived(e.target.value)} className="h-12 rounded-xl font-black text-xl border-none shadow-sm" /></div>
                     <div className="flex justify-between items-center px-1">
                        <span className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Balance Return</span>
                        <span className="text-primary font-black text-2xl tracking-tighter">{currencySymbol}{cashChange.toFixed(2)}</span>
                     </div>
                  </div>
                )}
                {(purchaseMethod === 'card' || purchaseMethod === 'duitnow') && (
                  <div className="space-y-2"><Label className="text-[10px] font-black uppercase tracking-widest">Trace ID / Reference</Label><Input placeholder="Trace ID..." value={referenceNumber} onChange={(e) => setReferenceNumber(e.target.value)} className="h-14 rounded-2xl bg-secondary/10 border-none font-black" /></div>
                )}
                <Button onClick={handleCreate} className="w-full h-20 rounded-[32px] font-black text-lg shadow-2xl transition-all hover:scale-[1.02] active:scale-95" disabled={isProcessing || !isPaymentValid || !customerName}>Authorize Batch Issue</Button>
            </div>
          </Card>
        </div>

        <div className="lg:col-span-3 space-y-10">
          <div className="relative group">
            <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-primary w-6 h-6 z-10" />
            <Input placeholder="SEARCH VOUCHER REGISTRY BY CUSTOMER OR TOKEN..." className="pl-16 h-20 rounded-[32px] border-4 border-transparent bg-white shadow-xl text-xl font-black focus-visible:ring-primary/20 tracking-tight relative z-0" value={registrySearch} onChange={(e) => setRegistrySearch(e.target.value)} />
          </div>
          <div className="bg-white rounded-[48px] border-2 border-primary/5 overflow-hidden flex flex-col h-fit shadow-sm">
            <table className="w-full text-sm text-left">
              <thead className="bg-secondary/20 border-b-2">
                <tr>
                  <th className="p-8 font-black uppercase text-[10px] tracking-widest text-muted-foreground">Customer Entity / Account</th>
                  <th className="p-8 font-black uppercase text-[10px] tracking-widest text-muted-foreground">Tactical ID</th>
                  <th className="p-8 font-black uppercase text-[10px] tracking-widest text-muted-foreground">Initial</th>
                  <th className="p-8 font-black uppercase text-[10px] tracking-widest text-muted-foreground">Net Balance</th>
                  <th className="p-8 font-black uppercase text-[10px] tracking-widest text-muted-foreground">Status</th>
                  <th className="p-8 text-center font-black uppercase text-[10px] tracking-widest text-muted-foreground">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y">{filteredCoupons.map(c => (
                <tr key={c.id} className="hover:bg-secondary/10 transition-all group">
                  <td className="p-8">
                     <p className="font-black text-lg tracking-tight">{c.customerName}</p>
                     <p className="text-[10px] font-bold text-muted-foreground tracking-widest mt-1 uppercase">{c.code}</p>
                  </td>
                  <td className="p-8">
                     <Badge variant="outline" className="font-black text-[10px] tracking-widest bg-secondary/20 border-none px-4 h-7">VALUE-{c.initialValue}</Badge>
                  </td>
                  <td className="p-8 font-black text-muted-foreground tracking-tighter">{currencySymbol}{c.initialValue.toFixed(2)}</td>
                  <td className="p-8 font-black text-primary text-3xl tracking-tighter">{currencySymbol}{c.balance.toFixed(2)}</td>
                  <td className="p-8">
                     <Badge variant={c.status === 'exhausted' ? "outline" : "secondary"} className={cn(
                        "uppercase font-black text-[10px] tracking-widest h-7 px-4 border-none",
                        c.status === 'active' ? "bg-green-600 text-white" : "bg-destructive/10 text-destructive"
                     )}>{c.status}</Badge>
                  </td>
                  <td className="p-8 text-center">
                     <Button variant="ghost" size="icon" onClick={() => handleRevokeVoucher(c.id)} className="h-12 w-12 rounded-2xl text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all"><Trash2 className="w-6 h-6" /></Button>
                  </td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

function ProfitAnalytics({ transactions, currencySymbol }: { transactions: SaleTransaction[], currencySymbol: string }) {
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
    <div className="space-y-12 overflow-auto pb-16">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
         <ReportStat label="Aggregate Retail Revenue" value={`${currencySymbol}${totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}`} />
         <ReportStat label="Realized Net Profit" value={`${currencySymbol}${totalProfit.toLocaleString(undefined, { minimumFractionDigits: 2 })}`} color="text-primary" />
         <ReportStat label="Aggregate Segment Yield" value={`${((totalProfit / (totalRevenue || 1)) * 100).toFixed(1)}%`} />
      </div>
      <Card className="border-none shadow-xl p-12 bg-white rounded-[56px] border-2 border-primary/5">
        <CardHeader className="p-0 mb-12">
           <CardTitle className="text-3xl font-black tracking-tighter">Profit Velocity Matrix</CardTitle>
           <p className="text-sm font-bold text-muted-foreground uppercase tracking-widest mt-2">7-Day Real-time Operating performance</p>
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
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f5f5f5" />
              <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontWeight: 900, fontSize: 14, fill: 'hsl(var(--muted-foreground))' }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fontWeight: 900, fontSize: 14, fill: 'hsl(var(--muted-foreground))' }} tickFormatter={(v) => `${currencySymbol}${v}`} />
              <Tooltip contentStyle={{ borderRadius: '32px', border: 'none', boxShadow: '0 30px 60px rgba(0,0,0,0.15)', padding: '24px' }} />
              <Area type="monotone" dataKey="revenue" stroke="hsl(var(--primary))" fillOpacity={1} fill="url(#colorRev)" strokeWidth={6} name="Gross Revenue" />
              <Area type="monotone" dataKey="profit" stroke="hsl(var(--secondary))" fillOpacity={0} strokeWidth={6} strokeDasharray="10 10" name="Net Yield" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </div>
  );
}

function BillingManager({ companyId, companyDoc }: any) {
  const firestore = useFirestore();
  const { toast } = useToast();
  const handleUpload = async (e: any) => {
    const file = e.target.files?.[0];
    if (!file || !firestore || !companyId) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      updateDoc(doc(firestore, 'companies', companyId), { duitNowQr: reader.result as string });
      toast({ title: "Settlement QR Updated" });
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="max-w-3xl mx-auto py-16 pb-24">
      <Card className="border-none shadow-2xl rounded-[56px] bg-white p-16 text-center space-y-10 border-4 border-primary/5">
        <div className="w-24 h-24 bg-primary/10 rounded-[32px] flex items-center justify-center text-primary mx-auto shadow-inner"><QrCode className="w-12 h-12" /></div>
        <div>
           <h2 className="text-4xl font-black tracking-tighter">Tactical Settlement Gateway</h2>
           <p className="text-muted-foreground font-bold text-lg mt-3">Managed Digital DuitNow Infrastructure</p>
        </div>
        {companyDoc?.duitNowQr ? (
          <div className="relative group mx-auto w-fit">
            <div className="absolute inset-0 bg-primary/20 rounded-[48px] blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            <Image src={companyDoc.duitNowQr} alt="QR" width={300} height={300} className="rounded-[48px] border-8 border-white shadow-2xl relative z-10" />
            <label className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center rounded-[48px] cursor-pointer transition-all duration-300 z-20">
               <Upload className="text-white w-12 h-12 mb-4" />
               <p className="text-white font-black uppercase tracking-[0.2em] text-xs">Replace Protocol</p>
               <input type="file" className="hidden" accept="image/*" onChange={handleUpload} />
            </label>
          </div>
        ) : (
          <label className="w-80 h-80 border-8 border-dashed rounded-[64px] flex flex-col items-center justify-center mx-auto cursor-pointer hover:bg-secondary/20 transition-all gap-6 border-secondary/30">
             <Plus className="w-12 h-12 text-primary" />
             <p className="text-xs font-black uppercase tracking-[0.3em] text-muted-foreground">Upload QR Protocol</p>
             <input type="file" className="hidden" accept="image/*" onChange={handleUpload} />
          </label>
        )}
        <div className="bg-secondary/20 p-8 rounded-[32px] text-left border border-secondary/30">
           <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary mb-2">Technical Note</p>
           <p className="text-sm font-bold text-muted-foreground leading-relaxed">This QR code is dynamically projected to customers during the checkout flow for card-less digital settlements.</p>
        </div>
      </Card>
    </div>
  );
}

function PaymentOption({ value, label, icon: Icon, id }: any) {
  return (
    <div className="relative group">
      <RadioGroupItem value={value} id={id} className="peer sr-only" />
      <Label htmlFor={id} className="flex flex-col items-center justify-center rounded-[32px] border-4 border-transparent bg-secondary/20 p-6 hover:bg-secondary/30 peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/5 cursor-pointer transition-all h-32 text-center shadow-inner group-hover:shadow-lg">
        <Icon className="mb-2 h-8 w-8 text-primary group-hover:scale-110 transition-transform" />
        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-foreground">{label}</span>
      </Label>
    </div>
  );
}

function ReportStat({ label, value, color = "text-foreground" }: any) {
  return (
    <Card className="border-none shadow-xl p-10 bg-white rounded-[40px] border-2 border-transparent hover:border-primary/10 transition-all">
       <p className="text-[10px] font-black uppercase text-muted-foreground mb-3 tracking-[0.2em]">{label}</p>
       <h4 className={cn("text-4xl font-black tracking-tighter leading-none", color)}>{value}</h4>
    </Card>
  );
}
