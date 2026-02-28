
'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import { Sidebar } from '@/components/layout/sidebar';
import { Card, CardContent, CardHeader, CardTitle, CardFooter, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ShoppingCart, Plus, Minus, Search, Package, Receipt, TrendingUp, DollarSign, Calendar, Ticket, Trophy, Truck, Trash2, CheckCircle2, CreditCard, QrCode, Image as ImageIcon, Wallet, Banknote, ArrowRight, UserPlus, Barcode, Scan, Settings2, Power, History, XCircle, MoreVertical, Star, RefreshCw, Edit2, ShieldCheck, ChevronRight, Upload, Info } from 'lucide-react';
import { useAuth } from '@/components/auth-context';
import { useFirestore, useCollection, useMemoFirebase, useDoc } from '@/firebase';
import { collection, doc, setDoc, updateDoc, increment, query, where, getDocs, addDoc, deleteDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Product, SaleTransaction, Coupon, LuckyDrawEntry, Company, PaymentMethod, LuckyDrawEvent } from '@/lib/types';
import { cn } from '@/lib/utils';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import Image from 'next/image';

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

  const { data: companyDoc } = useDoc<Company>(companyRef);
  const { data: products } = useCollection<Product>(productsQuery);
  const { data: transactions } = useCollection<SaleTransaction>(transactionsQuery);
  const { data: vouchers } = useCollection<Coupon>(vouchersQuery);

  // Auto-focus barcode scanner
  useEffect(() => {
    if (scanInputRef.current && !showCheckoutDialog) {
      scanInputRef.current.focus();
    }
  }, [showCheckoutDialog]);

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
  
  // Stored Value Logic
  const voucherDiscount = selectedVoucher ? Math.min(selectedVoucher.balance, subtotal) : 0;
  const totalAmount = Math.max(0, subtotal - voucherDiscount);
  const totalProfit = cart.reduce((acc, item) => acc + (item.product.sellingPrice - item.product.costPrice) * item.quantity, 0) - voucherDiscount;

  const changeAmount = paymentMethod === 'cash' ? Math.max(0, (Number(cashReceived) || 0) - totalAmount) : 0;
  const isInsufficientCash = paymentMethod === 'cash' && (Number(cashReceived) || 0) < totalAmount;
  const isMissingReference = (paymentMethod === 'card' || paymentMethod === 'duitnow') && !referenceNumber;

  const handleFinalCheckout = async () => {
    if (!user?.companyId || !firestore) return;
    setIsProcessing(true);
    const transactionId = crypto.randomUUID();
    const transactionRef = doc(firestore, 'companies', user.companyId, 'transactions', transactionId);
    
    const transactionData: SaleTransaction = {
      id: transactionId,
      companyId: user.companyId,
      module: 'mart',
      totalAmount,
      profit: totalProfit,
      discountApplied: voucherDiscount,
      couponCode: selectedVoucher?.code || undefined,
      customerName: customerName || selectedVoucher?.customerName || 'Walk-in Customer',
      timestamp: new Date().toISOString(),
      paymentMethod,
      referenceNumber: referenceNumber || undefined,
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

  // Analytics
  const martTransactions = transactions?.filter(t => t.module === 'mart') || [];
  const totalRevenue = martTransactions.reduce((acc, t) => acc + t.totalAmount, 0);

  return (
    <div className="flex h-screen bg-background font-body">
      <Sidebar />
      <main className="flex-1 overflow-hidden p-8 flex flex-col">
        <div className="mb-6 flex justify-between items-end">
          <div>
            <h1 className="text-3xl font-black font-headline text-foreground tracking-tight">Mart Control</h1>
            <p className="text-muted-foreground font-bold text-sm">Retail Logistics & Analytics</p>
          </div>
        </div>

        <Tabs defaultValue="pos" className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="mb-4 bg-white/50 border self-start p-1 rounded-2xl shadow-sm">
            <TabsTrigger value="pos" className="gap-2 rounded-xl px-6">POS Terminal</TabsTrigger>
            <TabsTrigger value="history" className="gap-2 rounded-xl px-6">History</TabsTrigger>
            <TabsTrigger value="inventory" className="gap-2 rounded-xl px-6">Inventory</TabsTrigger>
            <TabsTrigger value="coupons" className="gap-2 rounded-xl px-6">Generate Vouchers</TabsTrigger>
            <TabsTrigger value="profits" className="gap-2 rounded-xl px-6">Analytics</TabsTrigger>
            <TabsTrigger value="billing" className="gap-2 rounded-xl px-6">Billing</TabsTrigger>
          </TabsList>

          <TabsContent value="pos" className="flex-1 overflow-hidden">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 h-full overflow-hidden">
              <div className="lg:col-span-2 flex flex-col gap-4 overflow-hidden">
                <div className="relative">
                  <Scan className="absolute left-4 top-1/2 -translate-y-1/2 text-primary w-5 h-5" />
                  <Input 
                    ref={scanInputRef}
                    placeholder="SCAN BARCODE..." 
                    className="pl-16 h-16 rounded-2xl border-2 border-primary/20 bg-white shadow-lg text-xl font-black"
                    value={scanValue}
                    onChange={(e) => setScanValue(e.target.value)}
                    onKeyDown={handleBarcodeScan}
                  />
                </div>
                <div className="flex-1 overflow-auto grid grid-cols-1 md:grid-cols-2 gap-4 pb-4">
                  {filteredProducts?.map((p) => (
                    <Card key={p.id} className={cn("cursor-pointer hover:border-primary border-2 border-transparent transition-all bg-white shadow-sm rounded-3xl", p.stock <= 0 && "opacity-50 grayscale")} onClick={() => addToCart(p)}>
                      <CardContent className="p-6 flex justify-between items-center">
                        <div className="space-y-1">
                          <h3 className="font-black text-xl">{p.name}</h3>
                          <p className="text-2xl font-black text-primary">${p.sellingPrice.toFixed(2)}</p>
                          <p className="text-[10px] text-muted-foreground font-black uppercase">Stock: {p.stock} {p.unit}</p>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
              <div className="lg:col-span-1 h-full">
                <Card className="h-full flex flex-col border-none shadow-2xl bg-white rounded-[32px] overflow-hidden">
                  <CardHeader className="bg-secondary/20 p-8"><CardTitle className="flex items-center gap-2 font-black"><ShoppingCart className="w-6 h-6 text-primary" /> Active Cart</CardTitle></CardHeader>
                  <CardContent className="flex-1 overflow-auto p-8 space-y-4">
                    {cart.map((item) => (
                      <div key={item.product.id} className="flex items-center justify-between p-4 rounded-2xl bg-secondary/10">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-black truncate">{item.product.name}</p>
                          <p className="text-sm text-primary font-black">${(item.product.sellingPrice * item.quantity).toFixed(2)}</p>
                        </div>
                        <div className="flex items-center gap-4 bg-white p-2 rounded-xl shadow-sm">
                          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => updateQuantity(item.product.id, -1)}><Minus className="w-4 h-4" /></Button>
                          <span className="font-black text-lg">{item.quantity}</span>
                          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => updateQuantity(item.product.id, 1)}><Plus className="w-4 h-4" /></Button>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                  <CardFooter className="flex-col gap-6 p-8 border-t bg-secondary/5">
                    <div className="w-full flex justify-between items-end pt-2">
                      <span className="text-xs font-black uppercase text-muted-foreground mb-1">Payable Total</span>
                      <span className="text-5xl font-black text-foreground tracking-tighter">${subtotal.toFixed(2)}</span>
                    </div>
                    <Button className="w-full h-16 text-xl font-black rounded-2xl shadow-xl" disabled={cart.length === 0} onClick={() => setShowCheckoutDialog(true)}>Initiate Checkout</Button>
                  </CardFooter>
                </Card>
              </div>
            </div>

            <Dialog open={showCheckoutDialog} onOpenChange={setShowCheckoutDialog}>
              <DialogContent className="rounded-[40px] border-none shadow-2xl max-w-xl p-0 overflow-hidden bg-white">
                <div className="bg-primary p-12 text-primary-foreground text-center">
                   <p className="text-xs font-black uppercase tracking-widest opacity-80">Settlement Due</p>
                   <h2 className="text-6xl font-black tracking-tighter">${totalAmount.toFixed(2)}</h2>
                   {voucherDiscount > 0 && (
                     <p className="text-sm font-bold opacity-70 mt-2">Voucher Coverage: -${voucherDiscount.toFixed(2)}</p>
                   )}
                </div>
                <div className="p-12 space-y-8">
                  <RadioGroup value={paymentMethod} onValueChange={(v) => setPaymentMethod(v as PaymentMethod)} className="grid grid-cols-2 gap-4">
                    <PaymentOption value="cash" label="Cash" icon={Banknote} id="cash_final" />
                    <PaymentOption value="card" label="Card" icon={CreditCard} id="card_final" />
                    <PaymentOption value="duitnow" label="DuitNow" icon={QrCode} id="duitnow_final" />
                    <PaymentOption value="coupon" label="Stored Value" icon={Ticket} id="coupon_final" />
                  </RadioGroup>

                  {paymentMethod === 'coupon' && (
                    <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
                       <Label className="text-[10px] font-black uppercase tracking-widest">Search Customer Vouchers</Label>
                       <div className="relative">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                          <Input 
                            placeholder="Type customer name or code..." 
                            className="pl-10 h-12 rounded-xl"
                            value={voucherSearch}
                            onChange={(e) => setVoucherSearch(e.target.value)}
                          />
                       </div>
                       <div className="max-h-40 overflow-auto space-y-2">
                          {vouchers?.filter(v => v.customerName.toLowerCase().includes(voucherSearch.toLowerCase()) || v.code.toLowerCase().includes(voucherSearch.toLowerCase())).map(v => (
                            <div 
                              key={v.id} 
                              onClick={() => setSelectedVoucher(v)}
                              className={cn(
                                "p-3 rounded-xl border-2 cursor-pointer transition-all flex justify-between items-center",
                                selectedVoucher?.id === v.id ? "border-primary bg-primary/5" : "border-secondary/20 hover:bg-secondary/5"
                              )}
                            >
                               <div>
                                  <p className="font-black text-xs">{v.customerName}</p>
                                  <p className="text-[9px] font-bold text-muted-foreground uppercase">{v.code}</p>
                               </div>
                               <p className="font-black text-primary">${v.balance.toFixed(2)}</p>
                            </div>
                          ))}
                       </div>
                    </div>
                  )}

                  {paymentMethod === 'cash' && (
                    <div className="space-y-4">
                      <Label className="text-[10px] font-black uppercase tracking-widest">Cash Received ($)</Label>
                      <Input type="number" className="h-14 rounded-2xl font-black text-2xl" value={cashReceived} onChange={(e) => setCashReceived(e.target.value)} />
                      {Number(cashReceived) >= totalAmount && (
                        <div className="bg-primary/5 p-6 rounded-3xl border-2 border-primary/10 flex justify-between items-center">
                           <p className="text-[10px] font-black uppercase text-primary">Change Due</p>
                           <p className="text-3xl font-black">${changeAmount.toFixed(2)}</p>
                        </div>
                      )}
                    </div>
                  )}
                  {(paymentMethod === 'card' || paymentMethod === 'duitnow') && (
                    <div className="space-y-4">
                       <Label className="text-[10px] font-black uppercase tracking-widest">Reference / Trace ID</Label>
                       <Input placeholder="Enter trace ID..." className="h-14 rounded-2xl font-black text-lg" value={referenceNumber} onChange={(e) => setReferenceNumber(e.target.value)} />
                    </div>
                  )}
                </div>
                <div className="p-12 pt-0">
                  <Button onClick={handleFinalCheckout} className="w-full h-20 rounded-[28px] font-black text-xl shadow-xl" disabled={isProcessing || isInsufficientCash || isMissingReference}>
                    {isProcessing ? "Finalizing..." : "Complete & Record Sale"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </TabsContent>

          <TabsContent value="history" className="flex-1 overflow-auto">
             <div className="bg-white rounded-[32px] border shadow-sm overflow-hidden">
                <table className="w-full text-sm text-left">
                  <thead className="bg-secondary/20 border-b">
                    <tr><th className="p-6 font-black uppercase text-[10px]">Reference</th><th className="p-6 font-black uppercase text-[10px]">Customer</th><th className="p-6 font-black uppercase text-[10px]">Total</th><th className="p-6 text-center font-black uppercase text-[10px]">Action</th></tr>
                  </thead>
                  <tbody className="divide-y">
                    {martTransactions.slice().reverse().map(t => (
                      <tr key={t.id} className="hover:bg-secondary/5 transition-colors">
                        <td className="p-6"><p className="font-bold font-mono text-xs">#{t.id.split('-')[0].toUpperCase()}</p></td>
                        <td className="p-6 font-bold">{t.customerName}</td>
                        <td className="p-6 font-black text-primary text-lg">${t.totalAmount.toFixed(2)}</td>
                        <td className="p-6 text-center">
                          <Button variant="ghost" size="icon" onClick={async () => {
                            if (confirm("Reverse this transaction? Inventory will be restored.")) {
                              for (const item of t.items) {
                                if (item.productId) {
                                  updateDoc(doc(firestore!, 'companies', user!.companyId!, 'products', item.productId), { stock: increment(item.quantity) });
                                }
                              }
                              deleteDoc(doc(firestore!, 'companies', user!.companyId!, 'transactions', t.id));
                              toast({ title: "Transaction Reversed" });
                            }
                          }}><XCircle className="w-4 h-4 text-destructive" /></Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
             </div>
          </TabsContent>

          <TabsContent value="inventory"><InventoryManager companyId={user?.companyId} products={products} /></TabsContent>
          <TabsContent value="coupons"><CouponManager companyId={user?.companyId} companyDoc={companyDoc} /></TabsContent>
          <TabsContent value="profits"><ProfitAnalytics transactions={martTransactions} /></TabsContent>
          <TabsContent value="billing"><BillingManager companyId={user?.companyId} companyDoc={companyDoc} /></TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

function InventoryManager({ companyId, products }: { companyId?: string, products: Product[] | null }) {
  const firestore = useFirestore();
  const { toast } = useToast();
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [refillScan, setRefillScan] = useState('');

  // Refill Form States
  const [unitsBought, setUnitsBought] = useState<string>('1');
  const [itemsPerUnit, setItemsPerUnit] = useState<string>('1');
  const [costPerUnit, setCostPerUnit] = useState<string>('');
  const [retailPrice, setRetailPrice] = useState<string>('');

  useEffect(() => {
    if (selectedProduct) {
      setItemsPerUnit(selectedProduct.itemsPerUnit?.toString() || '1');
      setCostPerUnit((selectedProduct.costPrice * (selectedProduct.itemsPerUnit || 1)).toFixed(2));
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

  const handleConfirmRefill = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firestore || !companyId || !selectedProduct) return;
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

    updateDoc(productRef, {
      stock: increment(totalStockAdded),
      costPrice: normalizedCost,
      sellingPrice: newRetail,
      itemsPerUnit: ipu
    }).catch(async (err) => {
      errorEmitter.emit('permission-error', new FirestorePermissionError({
        path: productRef.path,
        operation: 'update'
      }));
    });

    addDoc(purchaseRef, {
      id: crypto.randomUUID(),
      companyId,
      amount: totalCost,
      description: `Restock: ${units}x Unit(s) of ${selectedProduct.name} (${ipu} per unit)`,
      timestamp: new Date().toISOString()
    });

    toast({ title: "Inventory Replenished", description: `Added ${totalStockAdded} items to ${selectedProduct.name}.` });
    setSelectedProduct(null);
    setUnitsBought('1');
    setIsProcessing(false);
  };

  const handleAddNew = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!firestore || !companyId) return;
    const formData = new FormData(e.currentTarget);
    const id = crypto.randomUUID();
    const productData: Product = {
      id,
      companyId,
      name: formData.get('name') as string,
      unit: formData.get('unit') as string,
      barcode: formData.get('barcode') as string,
      costPrice: Number(formData.get('cost')),
      sellingPrice: Number(formData.get('price')),
      stock: Number(formData.get('stock')),
      itemsPerUnit: Number(formData.get('ipu') || 1)
    };
    setDoc(doc(firestore, 'companies', companyId, 'products', id), productData);
    toast({ title: "Product Registered" });
    setIsAddDialogOpen(false);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
      <div className="lg:col-span-1">
        <Card className="border-none shadow-sm rounded-3xl bg-white p-8 sticky top-8">
          <div className="flex items-center gap-2 mb-6">
            <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center text-primary">
              <RefreshCw className="w-5 h-5" />
            </div>
            <h3 className="text-xl font-black">Stock Refill</h3>
          </div>

          <div className="space-y-6">
            <div className="relative">
              <Scan className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input 
                placeholder="SCAN TO REFILL..." 
                className="pl-10 h-12 rounded-xl bg-secondary/10 border-none font-black"
                value={refillScan}
                onChange={(e) => setRefillScan(e.target.value)}
                onKeyDown={handleRefillScan}
              />
            </div>

            {selectedProduct ? (
              <form onSubmit={handleConfirmRefill} className="space-y-5 animate-in fade-in slide-in-from-top-2">
                <div className="p-4 bg-primary/5 rounded-2xl border-2 border-primary/10">
                  <p className="text-[10px] font-black text-primary uppercase">Refilling Asset</p>
                  <p className="text-lg font-black">{selectedProduct.name}</p>
                </div>

                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-[10px] font-black uppercase">Units Bought</Label>
                      <Input type="number" value={unitsBought} onChange={(e) => setUnitsBought(e.target.value)} className="h-10 rounded-lg font-bold" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] font-black uppercase">Qty per Unit</Label>
                      <Input type="number" value={itemsPerUnit} onChange={(e) => setItemsPerUnit(e.target.value)} className="h-10 rounded-lg font-bold" />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-[10px] font-black uppercase">Cost per Unit ($)</Label>
                    <Input type="number" step="0.01" value={costPerUnit} onChange={(e) => setCostPerUnit(e.target.value)} className="h-10 rounded-lg font-bold" />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-[10px] font-black uppercase">New Retail Price ($)</Label>
                    <Input type="number" step="0.01" value={retailPrice} onChange={(e) => setRetailPrice(e.target.value)} className="h-10 rounded-lg font-bold text-primary" />
                  </div>
                </div>

                <div className="bg-secondary/10 p-4 rounded-2xl space-y-2">
                   <div className="flex justify-between text-[10px] font-black uppercase">
                      <span>Stock Addition</span>
                      <span className="text-foreground">{(Number(unitsBought) * Number(itemsPerUnit))} {selectedProduct.unit}</span>
                   </div>
                   <div className="flex justify-between text-[10px] font-black uppercase">
                      <span>Total Purchase</span>
                      <span className="text-primary">${(Number(unitsBought) * Number(costPerUnit)).toFixed(2)}</span>
                   </div>
                </div>

                <div className="flex gap-2">
                  <Button type="button" variant="outline" onClick={() => setSelectedProduct(null)} className="flex-1 rounded-xl font-bold">Cancel</Button>
                  <Button type="submit" className="flex-1 rounded-xl font-black shadow-lg" disabled={isProcessing}>Confirm</Button>
                </div>
              </form>
            ) : (
              <div className="py-20 text-center border-2 border-dashed rounded-[32px] opacity-30">
                <Truck className="w-12 h-12 mx-auto mb-2" />
                <p className="text-[10px] font-black uppercase tracking-widest">Select item to start replenishment</p>
              </div>
            )}
          </div>
        </Card>
      </div>

      <div className="lg:col-span-3 space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="text-xl font-black">Stock Registry</h3>
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild><Button className="rounded-xl font-black shadow-lg"><Plus className="w-4 h-4 mr-2" /> New Product</Button></DialogTrigger>
            <DialogContent className="rounded-[32px] max-w-lg p-0 overflow-hidden">
               <div className="bg-primary p-8 text-primary-foreground"><DialogTitle className="text-2xl font-black">New Registration</DialogTitle></div>
               <form onSubmit={handleAddNew} className="p-8 space-y-6">
                 <Input name="name" placeholder="Item Name" required className="h-12 rounded-xl" />
                 <div className="grid grid-cols-2 gap-4">
                   <Input name="unit" placeholder="Unit (pc, kg)" required className="h-12 rounded-xl" />
                   <Input name="barcode" placeholder="Barcode" className="h-12 rounded-xl" />
                 </div>
                 <div className="grid grid-cols-2 gap-4">
                   <Input name="cost" type="number" step="0.01" placeholder="Unit Cost ($)" required className="h-12 rounded-xl" />
                   <Input name="price" type="number" step="0.01" placeholder="Selling Price ($)" required className="h-12 rounded-xl" />
                 </div>
                 <div className="grid grid-cols-2 gap-4">
                   <Input name="stock" type="number" placeholder="Initial Stock" required className="h-12 rounded-xl" />
                   <Input name="ipu" type="number" placeholder="Qty/Box (Optional)" className="h-12 rounded-xl" />
                 </div>
                 <Button type="submit" className="w-full h-14 rounded-2xl font-black">Save Product</Button>
               </form>
            </DialogContent>
          </Dialog>
        </div>
        <div className="bg-white rounded-[32px] border overflow-hidden">
          <table className="w-full text-sm text-left">
            <thead className="bg-secondary/20"><tr><th className="p-6 font-black uppercase text-[10px]">Product</th><th className="p-6 font-black uppercase text-[10px]">Stock</th><th className="p-6 text-right font-black uppercase text-[10px]">Valuation</th><th className="p-6 text-center font-black uppercase text-[10px]">Action</th></tr></thead>
            <tbody className="divide-y">{products?.map(p => (
              <tr key={p.id} className="hover:bg-secondary/5 group">
                <td className="p-6">
                  <p className="font-black text-foreground">{p.name}</p>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase">{p.barcode || 'NO BARCODE'}</p>
                </td>
                <td className="p-6"><Badge variant={p.stock < 10 ? "destructive" : "secondary"} className="font-bold">{p.stock} {p.unit}</Badge></td>
                <td className="p-6 text-right font-black text-primary text-lg">${(p.stock * p.costPrice).toFixed(2)}</td>
                <td className="p-6 text-center">
                  <div className="flex items-center justify-center gap-2">
                    <Button variant="ghost" size="icon" onClick={() => setSelectedProduct(p)} className="text-primary hover:bg-primary/10"><RefreshCw className="w-4 h-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={async () => {
                      if (confirm("Delete product registry?")) deleteDoc(doc(firestore!, 'companies', companyId!, 'products', p.id));
                    }} className="text-destructive hover:bg-destructive/10"><Trash2 className="w-4 h-4" /></Button>
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

function CouponManager({ companyId, companyDoc }: { companyId?: string, companyDoc: Company | null }) {
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

  const couponsQuery = useMemoFirebase(() => (!firestore || !companyId) ? null : collection(firestore, 'companies', companyId, 'coupons'), [firestore, companyId]);
  const { data: coupons } = useCollection<Coupon>(couponsQuery);

  const uniqueVoucherTypes = useMemo(() => {
    if (!coupons) return [];
    const values = Array.from(new Set(coupons.map(c => c.initialValue))).sort((a, b) => a - b);
    return values.map(val => ({
      value: val,
      id: `VAL${val}`
    }));
  }, [coupons]);

  const addToBatch = () => {
    if (!inputVal || Number(inputVal) <= 0 || !inputQty || Number(inputQty) <= 0) {
      toast({ title: "Invalid Input", description: "Value and quantity must be greater than zero.", variant: "destructive" });
      return;
    }
    setBatch([...batch, { id: crypto.randomUUID(), value: Number(inputVal), qty: Number(inputQty) }]);
    setInputVal('');
    setInputQty('1');
  };

  const removeFromBatch = (id: string) => {
    setBatch(batch.filter(item => item.id !== id));
  };

  const subtotal = batch.reduce((acc, item) => acc + (item.value * item.qty), 0);
  const cashChange = purchaseMethod === 'cash' ? Math.max(0, (Number(cashReceived) || 0) - subtotal) : 0;
  
  const isPaymentValid = useMemo(() => {
    if (batch.length === 0) return false;
    if (purchaseMethod === 'cash') return Number(cashReceived) >= subtotal;
    if (purchaseMethod === 'card' || purchaseMethod === 'duitnow') return referenceNumber.trim().length > 0;
    return true;
  }, [batch, purchaseMethod, cashReceived, subtotal, referenceNumber]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firestore || !companyId || !isPaymentValid) return;
    setIsProcessing(true);

    try {
      // Record the sale of vouchers
      const transactionId = crypto.randomUUID();
      await setDoc(doc(firestore, 'companies', companyId, 'transactions', transactionId), {
        id: transactionId,
        companyId,
        module: 'mart',
        totalAmount: subtotal,
        profit: subtotal, // Vouchers are 100% upfront profit until used
        timestamp: new Date().toISOString(),
        customerName,
        customerCompany: customerCompany || undefined,
        paymentMethod: purchaseMethod,
        referenceNumber: referenceNumber || undefined,
        status: 'completed',
        items: batch.map(item => ({ name: `Stored Value Issue: $${item.value} x${item.qty}`, price: item.value, quantity: item.qty }))
      });

      // Generate individual voucher card records
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
            customerCompany: customerCompany || undefined,
            createdAt: new Date().toISOString()
          };
          await setDoc(doc(firestore, 'companies', companyId, 'coupons', id), data);
        }
      }

      toast({ title: "Batch Vouchers Issued", description: `Generated all cards for ${customerName}.` });
      setCustomerName(''); setCustomerCompany(''); setBatch([]); setCashReceived(''); setReferenceNumber('');
    } catch (err) {
      toast({ title: "Issue failed", variant: "destructive" });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
      <div className="lg:col-span-1 space-y-6">
        <Card className="border-none shadow-sm rounded-3xl bg-white p-8 h-fit">
          <h3 className="text-xl font-black mb-6">Batch Issue Stored Value</h3>
          <div className="space-y-6">
            <div className="space-y-4">
               <div className="space-y-1.5">
                  <Label className="text-[10px] font-black uppercase text-muted-foreground px-1">Customer Name</Label>
                  <Input placeholder="Full Name" value={customerName} onChange={(e) => setCustomerName(e.target.value)} className="h-12 rounded-xl font-bold" />
               </div>
               <div className="space-y-1.5">
                  <Label className="text-[10px] font-black uppercase text-muted-foreground px-1">Company (Optional)</Label>
                  <Input placeholder="Acme Corp" value={customerCompany} onChange={(e) => setCustomerCompany(e.target.value)} className="h-12 rounded-xl font-bold" />
               </div>
               <div className="space-y-1.5">
                  <Label className="text-[10px] font-black uppercase text-muted-foreground px-1">Global Expiry Date</Label>
                  <Input type="date" value={expiry} onChange={(e) => setExpiry(e.target.value)} className="h-12 rounded-xl font-bold" />
               </div>
            </div>

            <Separator />

            <div className="p-4 bg-secondary/10 rounded-2xl space-y-4">
               <p className="text-[10px] font-black uppercase text-primary tracking-widest">Coupon Item Builder</p>
               <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                     <Label className="text-[9px] font-black uppercase">Value ($)</Label>
                     <Input type="number" step="0.01" value={inputVal} onChange={(e) => setInputVal(e.target.value)} placeholder="0.00" className="h-10 rounded-lg font-bold" />
                  </div>
                  <div className="space-y-1.5">
                     <Label className="text-[9px] font-black uppercase">Qty</Label>
                     <Input type="number" value={inputQty} onChange={(e) => setInputQty(e.target.value)} className="h-10 rounded-lg font-bold" />
                  </div>
               </div>
               <Button onClick={addToBatch} variant="secondary" className="w-full h-10 rounded-xl font-black text-xs gap-2">
                  <Plus className="w-3.5 h-3.5" /> Add to Batch
               </Button>
            </div>

            {batch.length > 0 && (
              <div className="space-y-3 animate-in fade-in zoom-in-95">
                 <p className="text-[10px] font-black uppercase text-muted-foreground px-1">Batch Composition</p>
                 <div className="space-y-2 max-h-40 overflow-auto pr-1">
                    {batch.map(item => (
                      <div key={item.id} className="bg-white border rounded-xl p-2.5 flex justify-between items-center group shadow-sm">
                         <div>
                            <p className="font-black text-xs">${item.value.toFixed(2)}</p>
                            <p className="text-[9px] font-bold text-muted-foreground uppercase">Quantity: {item.qty}</p>
                         </div>
                         <Button variant="ghost" size="icon" onClick={() => removeFromBatch(item.id)} className="h-7 w-7 text-destructive hover:bg-destructive/10">
                            <Trash2 className="w-3.5 h-3.5" />
                         </Button>
                      </div>
                    ))}
                 </div>
                 <div className="bg-primary/5 p-4 rounded-2xl border-2 border-primary/10 flex justify-between items-center">
                    <span className="text-[10px] font-black uppercase text-primary">Batch Subtotal</span>
                    <span className="text-lg font-black text-foreground">${subtotal.toFixed(2)}</span>
                 </div>
              </div>
            )}

            <Separator />

            <div className="space-y-4">
               <Label className="text-[10px] font-black uppercase text-muted-foreground px-1">Payment Method</Label>
               <RadioGroup value={purchaseMethod} onValueChange={(v) => {
                 setPurchaseMethod(v as PaymentMethod);
                 setReferenceNumber('');
                 setCashReceived('');
               }} className="grid grid-cols-3 gap-2">
                  <PaymentOption value="cash" label="Cash" icon={Banknote} id="cou_cash" />
                  <PaymentOption value="card" label="Card" icon={CreditCard} id="cou_card" />
                  <PaymentOption value="duitnow" label="QR" icon={QrCode} id="cou_qr" />
               </RadioGroup>
            </div>

            {purchaseMethod === 'cash' && (
              <div className="p-4 bg-secondary/10 rounded-2xl space-y-3 animate-in fade-in slide-in-from-top-1">
                 <div className="space-y-1">
                    <Label className="text-[9px] font-black uppercase">Amount Received ($)</Label>
                    <Input type="number" value={cashReceived} onChange={(e) => setCashReceived(e.target.value)} className="h-10 rounded-lg font-bold" placeholder="0.00" />
                 </div>
                 <div className="flex justify-between items-center text-[10px] font-black uppercase">
                    <span>Balance to Return</span>
                    <span className="text-primary text-sm">${cashChange.toFixed(2)}</span>
                 </div>
              </div>
            )}

            {(purchaseMethod === 'card' || purchaseMethod === 'duitnow') && (
              <div className="space-y-3 animate-in fade-in slide-in-from-top-1">
                 {purchaseMethod === 'duitnow' && companyDoc?.duitNowQr && (
                   <div className="p-4 bg-white border-2 border-dashed border-primary/20 rounded-2xl text-center">
                      <Image src={companyDoc.duitNowQr} alt="QR" width={120} height={120} className="mx-auto rounded-lg shadow-sm mb-2" />
                      <p className="text-[9px] font-black text-primary uppercase">Scan Digital Gateway</p>
                   </div>
                 )}
                 <div className="space-y-1">
                    <Label className="text-[9px] font-black uppercase">Trace ID / Ref No.</Label>
                    <Input placeholder="Enter reference..." value={referenceNumber} onChange={(e) => setReferenceNumber(e.target.value)} className="h-10 rounded-lg font-bold" />
                 </div>
              </div>
            )}

            <Button onClick={handleCreate} className="w-full h-14 rounded-2xl font-black shadow-lg" disabled={isProcessing || !isPaymentValid || !customerName}>
               {isProcessing ? "Finalizing Batch..." : "Issue Batch Card(s)"}
            </Button>
          </div>
        </Card>

        <Card className="border-none shadow-sm rounded-3xl bg-primary text-primary-foreground p-6 overflow-hidden relative">
           <div className="absolute top-0 right-0 p-4 opacity-10"><Barcode className="w-16 h-16" /></div>
           <div className="relative z-10">
              <div className="flex items-center gap-2 mb-4">
                 <Info className="w-4 h-4" />
                 <h4 className="text-xs font-black uppercase tracking-widest">Barcode Reference Center</h4>
              </div>
              <p className="text-[10px] font-bold opacity-80 mb-4 leading-relaxed">Derive searchable system IDs for quick lookup in the POS terminal.</p>
              <div className="space-y-2">
                 {uniqueVoucherTypes.map(type => (
                   <div key={type.id} className="flex justify-between items-center bg-white/10 p-2 rounded-xl border border-white/10">
                      <span className="font-black text-xs">${type.value.toFixed(2)}</span>
                      <Badge className="bg-white text-primary font-black text-[10px] border-none">{type.id}</Badge>
                   </div>
                 ))}
                 {uniqueVoucherTypes.length === 0 && (
                   <p className="text-[10px] font-bold opacity-40 italic text-center py-2">No active types identified</p>
                 )}
              </div>
           </div>
        </Card>
      </div>

      <div className="lg:col-span-3 bg-white rounded-[32px] border overflow-hidden flex flex-col h-fit">
        <CardHeader className="bg-secondary/10 border-b p-6">
           <CardTitle className="text-lg font-black flex items-center gap-2">
              <Ticket className="w-5 h-5 text-primary" /> Issued Stored Balances
           </CardTitle>
           <CardDescription className="font-bold">Active customer accounts and card status</CardDescription>
        </CardHeader>
        <table className="w-full text-sm text-left">
          <thead className="bg-secondary/5">
            <tr>
              <th className="p-6 font-black uppercase text-[10px] tracking-widest text-muted-foreground">Customer / Account</th>
              <th className="p-6 font-black uppercase text-[10px] tracking-widest text-muted-foreground">System ID</th>
              <th className="p-6 font-black uppercase text-[10px] tracking-widest text-muted-foreground">Initial</th>
              <th className="p-6 font-black uppercase text-[10px] tracking-widest text-muted-foreground">Net Balance</th>
              <th className="p-6 font-black uppercase text-[10px] tracking-widest text-muted-foreground">Status</th>
              <th className="p-6 text-center font-black uppercase text-[10px] tracking-widest text-muted-foreground">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y">{coupons?.sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).map(c => (
            <tr key={c.id} className="hover:bg-secondary/5 transition-colors">
              <td className="p-6">
                 <p className="font-black text-foreground">{c.customerName}</p>
                 <p className="text-[9px] font-bold text-muted-foreground uppercase">{c.code}</p>
              </td>
              <td className="p-6">
                 <Badge variant="outline" className="font-black text-[10px] bg-secondary/10 text-primary border-primary/20">
                    VAL{c.initialValue}
                 </Badge>
              </td>
              <td className="p-6 font-bold text-muted-foreground">${c.initialValue.toFixed(2)}</td>
              <td className="p-6 font-black text-primary text-lg">${c.balance.toFixed(2)}</td>
              <td className="p-6"><Badge variant={c.status === 'exhausted' ? "outline" : "secondary"} className="uppercase font-black text-[9px]">{c.status}</Badge></td>
              <td className="p-6 text-center">
                 <Button variant="ghost" size="icon" onClick={async () => {
                    if (confirm("Revoke this stored value card?")) await deleteDoc(doc(firestore!, 'companies', companyId!, 'coupons', c.id));
                 }} className="text-destructive hover:bg-destructive/10"><Trash2 className="w-4 h-4" /></Button>
              </td>
            </tr>
          ))}</tbody>
        </table>
        {(!coupons || coupons.length === 0) && (
          <div className="py-24 text-center opacity-30">
             <Ticket className="w-16 h-16 mx-auto mb-4" />
             <p className="font-black uppercase tracking-widest">Voucher Registry Empty</p>
          </div>
        )}
      </div>
    </div>
  );
}

function ProfitAnalytics({ transactions }: { transactions: SaleTransaction[] }) {
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
    <div className="space-y-8 overflow-auto pb-8">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
         <ReportStat label="Aggregate Revenue" value={`$${totalRevenue.toFixed(2)}`} />
         <ReportStat label="Realized Profit" value={`$${totalProfit.toFixed(2)}`} color="text-primary" />
         <ReportStat label="Net Yield" value={`${((totalProfit / (totalRevenue || 1)) * 100).toFixed(1)}%`} />
      </div>
      <Card className="border-none shadow-sm p-10 bg-white rounded-[40px]">
        <CardHeader className="px-0 pt-0 mb-8"><CardTitle className="text-2xl font-black">7-Day Trajectory</CardTitle></CardHeader>
        <div className="h-[350px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/><stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/></linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
              <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontWeight: 700 }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fontWeight: 700 }} />
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
    <div className="max-w-xl mx-auto py-12">
      <Card className="border-none shadow-sm rounded-[32px] bg-white p-10 text-center space-y-8">
        <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center text-primary mx-auto"><QrCode className="w-8 h-8" /></div>
        <h2 className="text-2xl font-black">Digital Gateway</h2>
        <p className="text-sm text-muted-foreground font-medium">Configure business-wide DuitNow QR for digital settlements.</p>
        {companyDoc?.duitNowQr ? (
          <div className="relative group mx-auto w-fit">
            <Image src={companyDoc.duitNowQr} alt="QR" width={250} height={250} className="rounded-3xl border-4" />
            <label className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center rounded-3xl cursor-pointer transition-opacity">
               <Upload className="text-white w-8 h-8" />
               <input type="file" className="hidden" accept="image/*" onChange={handleUpload} />
            </label>
          </div>
        ) : (
          <label className="w-64 h-64 border-4 border-dashed rounded-[40px] flex flex-col items-center justify-center mx-auto cursor-pointer hover:bg-secondary/20 transition-all gap-4">
             <Plus className="w-8 h-8 text-primary" />
             <p className="text-xs font-black uppercase">Upload QR Code</p>
             <input type="file" className="hidden" accept="image/*" onChange={handleUpload} />
          </label>
        )}
      </Card>
    </div>
  );
}

function PaymentOption({ value, label, icon: Icon, id }: any) {
  return (
    <div>
      <RadioGroupItem value={value} id={id} className="peer sr-only" />
      <Label htmlFor={id} className="flex flex-col items-center justify-center rounded-[24px] border-4 border-transparent bg-secondary/20 p-4 hover:bg-secondary/30 peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/5 cursor-pointer transition-all h-24">
        <Icon className="mb-1 h-6 w-6 text-primary" />
        <span className="text-[10px] font-black uppercase tracking-widest">{label}</span>
      </Label>
    </div>
  );
}

function ReportStat({ label, value, color = "text-foreground" }: any) {
  return (
    <Card className="border-none shadow-sm p-8 bg-white rounded-[32px]">
       <p className="text-[10px] font-black uppercase text-muted-foreground mb-2 tracking-widest">{label}</p>
       <h4 className={cn("text-4xl font-black tracking-tighter", color)}>{value}</h4>
    </Card>
  );
}
