
'use client';

import { useState } from 'react';
import { Sidebar } from '@/components/layout/sidebar';
import { Card, CardContent, CardHeader, CardTitle, CardFooter, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ShoppingCart, Plus, Minus, Search, Package, Receipt, TrendingUp, DollarSign, Calendar, Ticket, Trophy, Truck, Trash2, CheckCircle2, CreditCard, QrCode, Image as ImageIcon, Wallet, Banknote, ArrowRight, UserPlus, Barcode } from 'lucide-react';
import { useAuth } from '@/components/auth-context';
import { useFirestore, useCollection, useMemoFirebase, useDoc } from '@/firebase';
import { collection, doc, setDoc, updateDoc, increment, query, where, getDocs, addDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Product, SaleTransaction, Coupon, LuckyDrawEntry, Company, PaymentMethod } from '@/lib/types';
import { cn } from '@/lib/utils';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';

const LUCKY_DRAW_MIN_SPEND = 100;

export default function MartPage() {
  const { user } = useAuth();
  const firestore = useFirestore();
  const { toast } = useToast();
  
  const [cart, setCart] = useState<{ product: Product, quantity: number }[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [couponCode, setCouponCode] = useState('');
  const [activeCoupon, setActiveCoupon] = useState<Coupon | null>(null);
  const [customerName, setCustomerName] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [showCheckoutDialog, setShowCheckoutDialog] = useState(false);

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

  const couponsQuery = useMemoFirebase(() => {
    if (!firestore || !user?.companyId) return null;
    return collection(firestore, 'companies', user.companyId, 'coupons');
  }, [firestore, user?.companyId]);

  const { data: companyDoc } = useDoc<Company>(companyRef);
  const { data: products } = useCollection<Product>(productsQuery);
  const { data: transactions } = useCollection<SaleTransaction>(transactionsQuery);
  const { data: coupons } = useCollection<Coupon>(couponsQuery);

  const filteredProducts = products?.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    p.sku?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.barcode?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const addToCart = (product: Product) => {
    if (product.stock <= 0) {
      toast({ title: "Out of stock", variant: "destructive" });
      return;
    }
    const existing = cart.find(item => item.product.id === product.id);
    if (existing) {
      if (existing.quantity >= product.stock) {
        toast({ title: "Stock limit reached", variant: "destructive" });
        return;
      }
      setCart(cart.map(item => item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item));
    } else {
      setCart([...cart, { product, quantity: 1 }]);
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
  const discount = activeCoupon ? activeCoupon.value : 0;
  const totalAmount = Math.max(0, subtotal - discount);
  const totalProfit = cart.reduce((acc, item) => acc + (item.product.sellingPrice - item.product.costPrice) * item.quantity, 0) - discount;

  const handleApplyCoupon = async () => {
    if (!firestore || !user?.companyId || !couponCode) return;
    
    const q = query(
      collection(firestore, 'companies', user.companyId, 'coupons'),
      where('code', '==', couponCode.toUpperCase()),
      where('status', '==', 'unused')
    );
    
    const snapshot = await getDocs(q);
    if (snapshot.empty) {
      toast({ title: "Invalid Coupon", description: "Code not found or already used.", variant: "destructive" });
      setActiveCoupon(null);
    } else {
      const couponData = { ...snapshot.docs[0].data(), id: snapshot.docs[0].id } as Coupon;
      if (new Date(couponData.expiryDate) < new Date()) {
        toast({ title: "Coupon Expired", variant: "destructive" });
        return;
      }
      setActiveCoupon(couponData);
      toast({ title: "Coupon Applied", description: `Discount of $${couponData.value.toFixed(2)} added.` });
    }
  };

  const initiateCheckout = () => {
    if (cart.length === 0 || !user?.companyId || !firestore) return;
    if (totalAmount >= LUCKY_DRAW_MIN_SPEND && !customerName) {
      toast({ title: "Lucky Draw Entry Required", description: "This high-value purchase qualifies for the Lucky Draw. Please enter the customer's name.", variant: "destructive" });
      return;
    }
    setShowCheckoutDialog(true);
  };

  const handleFinalCheckout = async () => {
    if (!user?.companyId || !firestore) return;
    
    if ((paymentMethod === 'card' || paymentMethod === 'duitnow') && !referenceNumber) {
      toast({ title: "Audit Trail Required", description: "Please enter the payment reference/trace number.", variant: "destructive" });
      return;
    }

    setIsProcessing(true);
    
    try {
      const transactionId = crypto.randomUUID();
      const transactionRef = doc(firestore, 'companies', user.companyId, 'transactions', transactionId);
      
      const transactionData: SaleTransaction = {
        id: transactionId,
        companyId: user.companyId,
        module: 'mart',
        totalAmount,
        profit: totalProfit,
        discountApplied: discount,
        couponCode: activeCoupon?.code || undefined,
        customerName: customerName || 'Walk-in Customer',
        timestamp: new Date().toISOString(),
        paymentMethod,
        referenceNumber: referenceNumber || undefined,
        status: 'completed',
        items: cart.map(item => ({
          name: item.product.name,
          price: item.product.sellingPrice,
          cost: item.product.costPrice,
          quantity: item.quantity
        }))
      };

      await setDoc(transactionRef, transactionData);

      // Inventory adjustment
      for (const item of cart) {
        const productRef = doc(firestore, 'companies', user.companyId, 'products', item.product.id);
        await updateDoc(productRef, { stock: increment(-item.quantity) });
      }

      // Finalize coupon
      if (activeCoupon) {
        await updateDoc(doc(firestore, 'companies', user.companyId, 'coupons', activeCoupon.id), { status: 'used' });
      }

      // Register Lucky Draw
      if (totalAmount >= LUCKY_DRAW_MIN_SPEND) {
        const drawRef = collection(firestore, 'companies', user.companyId, 'luckyDraws');
        await addDoc(drawRef, {
          id: crypto.randomUUID(),
          companyId: user.companyId,
          customerName,
          transactionId,
          amount: totalAmount,
          timestamp: new Date().toISOString()
        });
      }

      toast({ title: "Transaction Successful", description: `Captured $${totalAmount.toFixed(2)} via ${paymentMethod.toUpperCase()}.` });
      setCart([]);
      setActiveCoupon(null);
      setCouponCode('');
      setCustomerName('');
      setReferenceNumber('');
      setShowCheckoutDialog(false);
    } catch (e) {
      toast({ title: "Finalization Failed", variant: "destructive" });
    } finally {
      setIsProcessing(false);
    }
  };

  const profitData = transactions?.filter(t => t.module === 'mart').slice(-7).map(t => ({
    date: new Date(t.timestamp).toLocaleDateString([], { weekday: 'short' }),
    profit: t.profit,
    revenue: t.totalAmount
  })) || [];

  return (
    <div className="flex h-screen bg-background font-body">
      <Sidebar />
      <main className="flex-1 overflow-hidden p-8 flex flex-col">
        <div className="mb-6 flex justify-between items-end">
          <div>
            <h1 className="text-3xl font-black font-headline text-foreground tracking-tight">Mart Control</h1>
            <p className="text-muted-foreground font-bold text-sm">Retail Logistics & Customer Engagement</p>
          </div>
          <div className="flex gap-4">
             <Card className="p-3 border-none shadow-sm bg-white/50 flex items-center gap-3 rounded-2xl">
                <div className="w-10 h-10 bg-accent/20 rounded-xl flex items-center justify-center text-accent-foreground">
                   <Trophy className="w-5 h-5" />
                </div>
                <div>
                   <p className="text-[10px] font-black uppercase text-muted-foreground leading-tight">Lucky Draw Min.</p>
                   <p className="text-lg font-black text-foreground">${LUCKY_DRAW_MIN_SPEND}</p>
                </div>
             </Card>
          </div>
        </div>

        <Tabs defaultValue="pos" className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="mb-4 bg-white/50 border self-start p-1 rounded-2xl shadow-sm">
            <TabsTrigger value="pos" className="gap-2 rounded-xl px-6 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <Receipt className="w-4 h-4" /> POS Terminal
            </TabsTrigger>
            <TabsTrigger value="inventory" className="gap-2 rounded-xl px-6 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <Package className="w-4 h-4" /> Stock Control
            </TabsTrigger>
            <TabsTrigger value="coupons" className="gap-2 rounded-xl px-6 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <Ticket className="w-4 h-4" /> Promotions
            </TabsTrigger>
            <TabsTrigger value="billing" className="gap-2 rounded-xl px-6 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <Wallet className="w-4 h-4" /> Billing Config
            </TabsTrigger>
            <TabsTrigger value="profit" className="gap-2 rounded-xl px-6 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <TrendingUp className="w-4 h-4" /> Profit Analytics
            </TabsTrigger>
          </TabsList>

          <TabsContent value="pos" className="flex-1 overflow-hidden">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 h-full overflow-hidden">
              <div className="lg:col-span-2 flex flex-col gap-4 overflow-hidden">
                <div className="relative group">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground w-5 h-5 transition-colors group-focus-within:text-primary" />
                  <Input 
                    placeholder="Search inventory by name, SKU or barcode..." 
                    className="pl-12 h-14 rounded-2xl border-none bg-white shadow-sm text-lg font-bold"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                
                <div className="flex-1 overflow-auto grid grid-cols-1 md:grid-cols-2 gap-4 pb-4">
                  {filteredProducts?.map((product) => (
                    <Card 
                      key={product.id} 
                      className={cn(
                        "cursor-pointer hover:border-primary border-2 border-transparent transition-all bg-white shadow-sm rounded-3xl group",
                        product.stock <= 0 && "opacity-50 grayscale cursor-not-allowed"
                      )}
                      onClick={() => addToCart(product)}
                    >
                      <CardContent className="p-6 flex justify-between items-center">
                        <div className="space-y-1">
                          <h3 className="font-black text-xl group-hover:text-primary transition-colors">{product.name}</h3>
                          <p className="text-2xl font-black text-primary">${product.sellingPrice.toFixed(2)}</p>
                          <div className="flex gap-2">
                            <p className="text-[10px] text-muted-foreground font-black uppercase tracking-widest">SKU: {product.sku || 'N/A'}</p>
                            {product.barcode && <p className="text-[10px] text-muted-foreground font-black uppercase tracking-widest flex items-center gap-1"><Barcode className="w-2 h-2" /> {product.barcode}</p>}
                          </div>
                        </div>
                        <div className="text-right">
                           <Badge variant={product.stock > 10 ? "secondary" : "destructive"} className="mb-2 uppercase font-black text-[10px] tracking-tighter px-3 py-1">
                             {product.stock} {product.unit || 'Units'}
                           </Badge>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>

              <div className="lg:col-span-1 h-full">
                <Card className="h-full flex flex-col border-none shadow-2xl bg-white rounded-[32px] overflow-hidden">
                  <CardHeader className="bg-secondary/20 p-8">
                    <CardTitle className="flex items-center gap-2 text-2xl font-black">
                      <ShoppingCart className="w-6 h-6 text-primary" />
                      Active Cart
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="flex-1 overflow-auto p-8 space-y-4">
                    {cart.map((item) => (
                      <div key={item.product.id} className="flex items-center justify-between p-4 rounded-2xl bg-secondary/10 group hover:bg-secondary/20 transition-colors">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-black truncate text-foreground">{item.product.name}</p>
                          <p className="text-sm text-primary font-black">${(item.product.sellingPrice * item.quantity).toFixed(2)}</p>
                        </div>
                        <div className="flex items-center gap-4 bg-white p-2 rounded-xl shadow-sm">
                          <Button size="icon" variant="ghost" className="h-8 w-8 hover:bg-destructive/10 hover:text-destructive" onClick={() => updateQuantity(item.product.id, -1)}>
                            <Minus className="w-4 h-4" />
                          </Button>
                          <span className="font-black w-4 text-center text-lg">{item.quantity}</span>
                          <Button size="icon" variant="ghost" className="h-8 w-8 hover:bg-primary/10 hover:text-primary" onClick={() => updateQuantity(item.product.id, 1)}>
                            <Plus className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                    {cart.length === 0 && (
                      <div className="py-20 text-center opacity-20">
                         <ShoppingCart className="w-20 h-20 mx-auto mb-4" />
                         <p className="font-black text-lg">Empty Cart</p>
                      </div>
                    )}
                  </CardContent>
                  <CardFooter className="flex-col gap-6 p-8 border-t bg-secondary/5">
                    <div className="w-full space-y-4">
                      {totalAmount >= LUCKY_DRAW_MIN_SPEND && (
                        <div className="space-y-2 animate-in fade-in slide-in-from-bottom-2">
                           <div className="flex items-center gap-2 text-[10px] font-black uppercase text-accent-foreground tracking-widest bg-accent/20 px-3 py-1.5 rounded-full w-fit">
                             <Trophy className="w-3 h-3" /> Lucky Draw Qualified
                           </div>
                           <Input 
                             placeholder="Enter customer name..." 
                             className="h-12 rounded-xl border-accent border-2 bg-white font-bold"
                             value={customerName}
                             onChange={(e) => setCustomerName(e.target.value)}
                           />
                        </div>
                      )}

                      <div className="space-y-3">
                        <div className="flex justify-between text-sm font-bold text-muted-foreground uppercase tracking-widest">
                          <span>Subtotal</span>
                          <span>${subtotal.toFixed(2)}</span>
                        </div>
                        {discount > 0 && (
                          <div className="flex justify-between text-sm font-black text-green-600 uppercase tracking-widest">
                            <span>Discount</span>
                            <span>-${discount.toFixed(2)}</span>
                          </div>
                        )}
                        <div className="flex justify-between items-end pt-2">
                          <span className="text-xs font-black uppercase text-muted-foreground mb-1">Payable Total</span>
                          <span className="text-5xl font-black text-foreground tracking-tighter">${totalAmount.toFixed(2)}</span>
                        </div>
                      </div>
                    </div>
                    <Button 
                      className="w-full h-16 text-xl font-black rounded-2xl shadow-xl transition-all hover:scale-[1.02] active:scale-[0.98]" 
                      disabled={cart.length === 0 || isProcessing}
                      onClick={initiateCheckout}
                    >
                      {isProcessing ? "Persisting..." : "Initiate Checkout"}
                    </Button>
                  </CardFooter>
                </Card>
              </div>
            </div>

            <Dialog open={showCheckoutDialog} onOpenChange={setShowCheckoutDialog}>
              <DialogContent className="rounded-[40px] border-none shadow-[0_32px_128px_rgba(0,0,0,0.1)] max-w-xl p-0 overflow-hidden bg-white">
                <div className="bg-primary p-12 text-primary-foreground flex flex-col items-center gap-2">
                   <p className="text-xs font-black uppercase tracking-[0.2em] opacity-80">Payment Settlement</p>
                   <h2 className="text-6xl font-black tracking-tighter">${totalAmount.toFixed(2)}</h2>
                   <div className="mt-4 flex gap-2">
                      <Badge variant="outline" className="border-white/20 text-white font-bold px-3">{cart.length} Items</Badge>
                      {discount > 0 && <Badge className="bg-white text-primary font-black">-{discount.toFixed(2)}</Badge>}
                   </div>
                </div>
                
                <div className="p-12 space-y-10">
                  <div className="space-y-4">
                    <label className="text-[10px] font-black uppercase text-muted-foreground tracking-[0.2em] px-1">Payment Channel</label>
                    <RadioGroup value={paymentMethod} onValueChange={(v) => setPaymentMethod(v as PaymentMethod)} className="grid grid-cols-2 gap-4">
                      <PaymentOption value="cash" label="Cash" icon={Banknote} id="cash_final" />
                      <PaymentOption value="card" label="Card" icon={CreditCard} id="card_final" />
                      <PaymentOption value="duitnow" label="DuitNow" icon={QrCode} id="duitnow_final" />
                      <PaymentOption value="coupon" label="Voucher" icon={Ticket} id="coupon_final" />
                    </RadioGroup>
                  </div>

                  <Separator className="opacity-10" />

                  {(paymentMethod === 'card' || paymentMethod === 'duitnow') && (
                    <div className="space-y-6 animate-in zoom-in-95 duration-300">
                       <div className="space-y-2">
                          <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest px-1">Audit Reference / Trace ID</label>
                          <Input 
                            placeholder="Enter transaction reference..." 
                            className="h-14 rounded-2xl font-black text-lg bg-secondary/10 border-none px-6"
                            value={referenceNumber}
                            onChange={(e) => setReferenceNumber(e.target.value)}
                            required
                          />
                       </div>
                       {paymentMethod === 'duitnow' && companyDoc?.duitNowQr && (
                         <div className="bg-secondary/10 p-8 rounded-3xl flex flex-col items-center gap-4 border-2 border-dashed border-primary/20">
                            <p className="text-[10px] font-black uppercase text-primary tracking-widest">Scan Merchant QR</p>
                            <img src={companyDoc.duitNowQr} alt="DuitNow QR" className="w-48 h-48 object-contain bg-white p-4 rounded-2xl shadow-2xl" />
                         </div>
                       )}
                    </div>
                  )}

                  <div className="space-y-4">
                    <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest px-1">Redeem Promotion</label>
                    <div className="flex gap-2">
                      <Input 
                        placeholder="ENTER PROMO CODE" 
                        className="h-14 rounded-2xl bg-secondary/10 border-none font-black uppercase px-6 tracking-widest"
                        value={couponCode}
                        onChange={(e) => setCouponCode(e.target.value)}
                      />
                      <Button onClick={handleApplyCoupon} variant="secondary" className="rounded-2xl font-black h-14 px-8 text-xs uppercase tracking-widest shadow-lg">Verify</Button>
                    </div>
                    {activeCoupon && (
                       <div className="flex items-center gap-3 bg-green-50 text-green-700 p-4 rounded-2xl border border-green-200 animate-in slide-in-from-left-4">
                         <div className="w-10 h-10 bg-green-200 rounded-xl flex items-center justify-center">
                            <CheckCircle2 className="w-5 h-5" />
                         </div>
                         <div>
                            <p className="text-[10px] font-black uppercase tracking-widest">Active Discount</p>
                            <p className="font-black text-lg">{activeCoupon.code} (-${activeCoupon.value.toFixed(2)})</p>
                         </div>
                       </div>
                    )}
                  </div>
                </div>

                <div className="p-12 pt-0">
                  <Button 
                    onClick={handleFinalCheckout} 
                    className="w-full h-20 rounded-[28px] font-black text-xl shadow-[0_16px_48px_rgba(var(--primary),0.2)] flex items-center justify-center gap-4 group" 
                    disabled={isProcessing}
                  >
                    {isProcessing ? "Finalizing Transaction..." : "Complete & Record Sale"}
                    {!isProcessing && <ArrowRight className="w-6 h-6 group-hover:translate-x-2 transition-transform" />}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </TabsContent>

          <TabsContent value="inventory">
            <InventoryManager companyId={user?.companyId} />
          </TabsContent>

          <TabsContent value="coupons">
            <CouponManager companyId={user?.companyId} />
          </TabsContent>

          <TabsContent value="billing">
            <BillingManager companyId={user?.companyId} companyDoc={companyDoc} />
          </TabsContent>

          <TabsContent value="profit" className="space-y-8 overflow-auto pb-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
               <ReportStat label="Weekly Performance" value={`$${profitData.reduce((acc, d) => acc + d.revenue, 0).toFixed(2)}`} />
               <ReportStat label="Realized Profit" value={`$${profitData.reduce((acc, d) => acc + d.profit, 0).toFixed(2)}`} color="text-primary" />
               <ReportStat label="Event Pipeline" value={`${transactions?.filter(t => t.totalAmount >= LUCKY_DRAW_MIN_SPEND).length || 0} Qualifiers`} />
            </div>
            <Card className="border-none shadow-sm p-10 bg-white rounded-[40px]">
               <CardHeader className="px-0 pt-0 mb-8">
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="text-2xl font-black">Growth Analytics</CardTitle>
                      <CardDescription className="font-bold">Historical data across your business modules</CardDescription>
                    </div>
                    <div className="flex gap-4">
                       <div className="flex items-center gap-2 text-[10px] font-black uppercase">
                          <div className="w-3 h-3 bg-secondary rounded-full" /> Revenue
                       </div>
                       <div className="flex items-center gap-2 text-[10px] font-black uppercase">
                          <div className="w-3 h-3 bg-primary rounded-full" /> Profit
                       </div>
                    </div>
                  </div>
               </CardHeader>
               <div className="h-[400px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={profitData} barGap={8}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                      <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontWeight: 700, fill: 'hsl(var(--muted-foreground))' }} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fontWeight: 700, fill: 'hsl(var(--muted-foreground))' }} />
                      <Tooltip contentStyle={{ borderRadius: '24px', border: 'none', boxShadow: '0 20px 50px rgba(0,0,0,0.1)' }} />
                      <Bar dataKey="revenue" fill="hsl(var(--secondary))" radius={[12, 12, 0, 0]} name="Gross Revenue" />
                      <Bar dataKey="profit" fill="hsl(var(--primary))" radius={[12, 12, 0, 0]} name="Net Profit" />
                    </BarChart>
                  </ResponsiveContainer>
               </div>
            </Card>
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
      <Label
        htmlFor={id}
        className="flex flex-col items-center justify-center rounded-[24px] border-4 border-transparent bg-secondary/20 p-6 hover:bg-secondary/30 peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/5 cursor-pointer transition-all h-32"
      >
        <Icon className="mb-2 h-8 w-8 text-primary" />
        <span className="text-sm font-black uppercase tracking-widest">{label}</span>
      </Label>
    </div>
  );
}

function BillingManager({ companyId, companyDoc }: { companyId?: string, companyDoc: Company | null }) {
  const firestore = useFirestore();
  const { toast } = useToast();
  const [isUploading, setIsUploading] = useState(false);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !firestore || !companyId) return;

    setIsUploading(true);
    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64String = reader.result as string;
      try {
        await updateDoc(doc(firestore, 'companies', companyId), {
          duitNowQr: base64String
        });
        toast({ title: "Configuration Updated", description: "Payment QR code is now active in POS." });
      } catch (err) {
        toast({ title: "Configuration failed", variant: "destructive" });
      } finally {
        setIsUploading(false);
      }
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      <Card className="border-none shadow-sm rounded-[40px] bg-white">
        <CardHeader className="p-10">
          <CardTitle className="text-2xl font-black flex items-center gap-3">
            <QrCode className="w-8 h-8 text-primary" /> Digital Settlement Setup
          </CardTitle>
          <CardDescription className="font-bold text-lg">Centralize your business DuitNow identity</CardDescription>
        </CardHeader>
        <CardContent className="p-10 pt-0 space-y-8">
          <div className="p-16 border-4 border-dashed rounded-[32px] flex flex-col items-center justify-center gap-6 bg-secondary/10 relative overflow-hidden group hover:bg-secondary/20 transition-colors">
            {companyDoc?.duitNowQr ? (
              <img src={companyDoc.duitNowQr} alt="Active QR" className="w-64 h-64 object-contain rounded-3xl shadow-2xl bg-white p-6 transition-transform group-hover:scale-105" />
            ) : (
              <div className="w-24 h-24 bg-primary/10 rounded-3xl flex items-center justify-center">
                 <ImageIcon className="w-12 h-12 text-primary opacity-30" />
              </div>
            )}
            <div className="text-center">
              <p className="font-black text-xl text-foreground">{companyDoc?.duitNowQr ? "Update Settlement QR" : "Configure Settlement QR"}</p>
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mt-2">Preferred Format: JPG/PNG @ 1:1 Aspect</p>
            </div>
            <input
              type="file"
              accept="image/*"
              className="absolute inset-0 opacity-0 cursor-pointer"
              onChange={handleImageUpload}
              disabled={isUploading}
            />
          </div>
          <div className="bg-primary/5 p-6 rounded-3xl flex items-start gap-4">
             <div className="w-10 h-10 bg-primary/20 rounded-xl flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-5 h-5 text-primary" />
             </div>
             <div>
                <p className="text-sm font-black text-foreground uppercase tracking-widest">Automatic POS Integration</p>
                <p className="text-xs font-bold text-muted-foreground leading-relaxed mt-2">When DuitNow is selected at checkout, this QR code will be dynamically projected to the customer for immediate cashless fulfillment.</p>
             </div>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-6">
        <Card className="border-none shadow-sm rounded-[40px] bg-white">
          <CardHeader className="p-10">
            <CardTitle className="text-xl font-black">Operational Guardrails</CardTitle>
          </CardHeader>
          <CardContent className="p-10 pt-0 space-y-4">
             <div className="flex items-center justify-between p-6 bg-secondary/10 rounded-3xl">
                <div>
                   <p className="font-black text-lg">Hybrid Tracking</p>
                   <p className="text-xs font-bold text-muted-foreground">Trace IDs required for Card/QR</p>
                </div>
                <div className="w-12 h-12 bg-green-500 rounded-2xl flex items-center justify-center text-white shadow-lg">
                   <CheckCircle2 className="w-7 h-7" />
                </div>
             </div>
             <div className="flex items-center justify-between p-6 bg-secondary/10 rounded-3xl">
                <div>
                   <p className="font-black text-lg">Settlement Active</p>
                   <p className="text-xs font-bold text-muted-foreground">Digital payment infrastructure</p>
                </div>
                <div className={cn(
                  "w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-lg transition-colors",
                  companyDoc?.duitNowQr ? "bg-green-500" : "bg-muted text-muted-foreground"
                )}>
                   <CheckCircle2 className="w-7 h-7" />
                </div>
             </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function InventoryManager({ companyId }: { companyId?: string }) {
  const firestore = useFirestore();
  const { toast } = useToast();
  const [isAdding, setIsAdding] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);

  const productsQuery = useMemoFirebase(() => {
    if (!firestore || !companyId) return null;
    return collection(firestore, 'companies', companyId, 'products');
  }, [firestore, companyId]);

  const { data: products } = useCollection<Product>(productsQuery);

  const handleReplenish = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!firestore || !companyId || !selectedProduct) return;
    setIsAdding(true);

    const formData = new FormData(e.currentTarget);
    const qty = Number(formData.get('quantity'));
    const cost = Number(formData.get('cost'));

    try {
      const productRef = doc(firestore, 'companies', companyId, 'products', selectedProduct.id);
      await updateDoc(productRef, { 
        stock: increment(qty),
        costPrice: cost / qty
      });

      const purchaseRef = collection(firestore, 'companies', companyId, 'purchases');
      await addDoc(purchaseRef, {
        id: crypto.randomUUID(),
        companyId,
        amount: cost,
        description: `Batch Restock: ${qty} units of ${selectedProduct.name}`,
        timestamp: new Date().toISOString()
      });

      toast({ title: "Logistics Updated", description: `Added ${qty} units to ${selectedProduct.name} catalog.` });
      setSelectedProduct(null);
      (e.target as HTMLFormElement).reset();
    } catch (err) {
      toast({ title: "Restock failed", variant: "destructive" });
    } finally {
      setIsAdding(false);
    }
  };

  const handleAddNew = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!firestore || !companyId) return;
    setIsAdding(true);
    const formData = new FormData(e.currentTarget);
    const id = crypto.randomUUID();
    const productData = {
      id,
      companyId,
      name: formData.get('name') as string,
      sku: formData.get('sku') as string,
      barcode: formData.get('barcode') as string,
      costPrice: Number(formData.get('cost')),
      sellingPrice: Number(formData.get('price')),
      stock: Number(formData.get('stock')),
      unit: formData.get('unit') as string,
    };

    try {
      await setDoc(doc(firestore, 'companies', companyId, 'products', id), productData);
      toast({ title: "Catalog Entry Saved" });
      setIsAddDialogOpen(false);
      (e.target as HTMLFormElement).reset();
    } catch (err) {
      toast({ title: "Entry failed", variant: "destructive" });
    } finally {
      setIsAdding(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 pb-8">
      <div className="lg:col-span-1 space-y-6">
        <Card className="border-none shadow-sm rounded-3xl bg-white overflow-hidden">
          <CardHeader className="bg-primary/5 p-8">
            <CardTitle className="text-xl font-black flex items-center gap-3">
               <Truck className="w-6 h-6" /> Batch Replenishment
            </CardTitle>
            <CardDescription className="font-bold">Replenish existing stock items</CardDescription>
          </CardHeader>
          <CardContent className="p-8">
             {selectedProduct ? (
               <form onSubmit={handleReplenish} className="space-y-6">
                  <div className="p-4 bg-secondary/20 rounded-2xl">
                     <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Active Batch</p>
                     <p className="font-black text-lg">{selectedProduct.name}</p>
                     {selectedProduct.barcode && <p className="text-[10px] font-black text-muted-foreground flex items-center gap-1 mt-1"><Barcode className="w-3 h-3" /> {selectedProduct.barcode}</p>}
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                     <div className="space-y-1.5">
                        <label className="text-[10px] font-black uppercase tracking-widest px-1">Units to Add</label>
                        <Input name="quantity" type="number" required className="rounded-xl h-12 font-bold" />
                     </div>
                     <div className="space-y-1.5">
                        <label className="text-[10px] font-black uppercase tracking-widest px-1">Batch Cost ($)</label>
                        <Input name="cost" type="number" step="0.01" required className="rounded-xl h-12 font-bold" />
                     </div>
                  </div>
                  <div className="flex gap-3">
                     <Button type="submit" className="flex-1 rounded-xl font-black h-12 shadow-lg" disabled={isAdding}>Confirm</Button>
                     <Button type="button" variant="outline" className="rounded-xl font-black h-12" onClick={() => setSelectedProduct(null)}>Cancel</Button>
                  </div>
               </form>
             ) : (
               <div className="py-16 text-center text-muted-foreground bg-secondary/5 rounded-3xl border-4 border-dashed border-secondary/20">
                  <Package className="w-12 h-12 mx-auto mb-4 opacity-10" />
                  <p className="text-sm font-black uppercase tracking-widest opacity-60">Inventory Guard</p>
                  <p className="text-[10px] font-bold mt-2 px-4">Select an item from the registry table to replenish stock.</p>
               </div>
             )}
          </CardContent>
        </Card>
      </div>

      <div className="lg:col-span-3 space-y-4">
        <div className="flex justify-between items-center mb-2">
           <h3 className="text-xl font-black tracking-tight">Active Asset Registry</h3>
           <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
             <DialogTrigger asChild>
                <Button className="rounded-xl font-black h-11 px-6 shadow-lg flex items-center gap-2">
                  <Plus className="w-4 h-4" /> Register New Product
                </Button>
             </DialogTrigger>
             <DialogContent className="rounded-[32px] max-w-lg border-none bg-white p-0 overflow-hidden shadow-2xl">
                <DialogHeader className="bg-primary p-8 text-primary-foreground">
                   <DialogTitle className="text-2xl font-black">Product Registration</DialogTitle>
                   <DialogDescription className="text-primary-foreground/80 font-bold">Define new items for the business catalog</DialogDescription>
                </DialogHeader>
                <div className="p-8">
                  <form onSubmit={handleAddNew} className="space-y-6">
                    <div className="space-y-1.5">
                       <label className="text-[10px] font-black uppercase tracking-widest px-1">Product Identity</label>
                       <Input name="name" placeholder="Item Name (e.g. Arabica Beans)" required className="h-12 rounded-xl font-bold border-secondary" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                       <div className="space-y-1.5">
                          <label className="text-[10px] font-black uppercase tracking-widest px-1">Measurement Unit</label>
                          <Input name="unit" placeholder="e.g. piece, kg, ml" required className="h-12 rounded-xl font-bold border-secondary" />
                       </div>
                       <div className="space-y-1.5">
                          <label className="text-[10px] font-black uppercase tracking-widest px-1">SKU</label>
                          <Input name="sku" placeholder="Optional SKU" className="h-12 rounded-xl font-bold border-secondary" />
                       </div>
                    </div>
                    <div className="space-y-1.5">
                       <label className="text-[10px] font-black uppercase tracking-widest px-1">Barcode</label>
                       <Input name="barcode" placeholder="EAN / UPC / Barcode" className="h-12 rounded-xl font-bold border-secondary" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                       <div className="space-y-1.5">
                          <label className="text-[10px] font-black uppercase tracking-widest px-1">Opening Cost ($)</label>
                          <Input name="cost" type="number" step="0.01" placeholder="0.00" required className="h-12 rounded-xl font-bold border-secondary" />
                       </div>
                       <div className="space-y-1.5">
                          <label className="text-[10px] font-black uppercase tracking-widest px-1">Sale Price ($)</label>
                          <Input name="price" type="number" step="0.01" placeholder="0.00" required className="h-12 rounded-xl font-bold border-secondary" />
                       </div>
                    </div>
                    <div className="space-y-1.5">
                       <label className="text-[10px] font-black uppercase tracking-widest px-1">Initial Stock Level</label>
                       <Input name="stock" type="number" placeholder="Total available units" required className="h-12 rounded-xl font-bold border-secondary" />
                    </div>
                    <Button type="submit" className="w-full h-14 rounded-2xl font-black text-lg shadow-xl" disabled={isAdding}>
                      {isAdding ? "Saving Item..." : "Confirm Catalog Entry"}
                    </Button>
                  </form>
                </div>
             </DialogContent>
           </Dialog>
        </div>

        <div className="bg-white rounded-[32px] border shadow-sm overflow-hidden">
          <table className="w-full text-sm text-left">
            <thead className="bg-secondary/20 border-b">
              <tr>
                <th className="p-6 font-black uppercase text-muted-foreground tracking-widest text-[10px]">Product Information</th>
                <th className="p-6 font-black uppercase text-muted-foreground tracking-widest text-[10px]">Identity</th>
                <th className="p-6 font-black uppercase text-muted-foreground tracking-widest text-[10px]">Stock Status</th>
                <th className="p-6 font-black uppercase text-muted-foreground tracking-widest text-[10px]">Asset Value</th>
                <th className="p-6 text-center font-black uppercase text-muted-foreground tracking-widest text-[10px]">Operations</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {products?.map(p => (
                <tr key={p.id} className="hover:bg-secondary/5 transition-colors group">
                  <td className="p-6">
                    <p className="font-black text-lg text-foreground">{p.name}</p>
                    <p className="text-[10px] text-muted-foreground font-black uppercase tracking-widest">{p.unit || 'Units'}</p>
                  </td>
                  <td className="p-6">
                    <div className="space-y-1">
                      <p className="text-[10px] text-muted-foreground font-black uppercase tracking-widest">SKU: {p.sku || 'N/A'}</p>
                      {p.barcode && <p className="text-[10px] text-muted-foreground font-black uppercase tracking-widest flex items-center gap-1"><Barcode className="w-2.5 h-2.5" /> {p.barcode}</p>}
                    </div>
                  </td>
                  <td className="p-6">
                    <div className="flex items-center gap-2">
                      <Badge variant={p.stock < 10 ? "destructive" : "secondary"} className="font-black uppercase text-[10px] px-3 py-1">
                        {p.stock} {p.unit || 'Units'}
                      </Badge>
                    </div>
                  </td>
                  <td className="p-6 font-black text-primary text-lg">${(p.stock * p.costPrice).toFixed(2)}</td>
                  <td className="p-6 text-center">
                    <Button variant="ghost" size="sm" onClick={() => setSelectedProduct(p)} className="rounded-xl font-black gap-2 hover:bg-primary hover:text-white transition-all">
                      <Truck className="w-4 h-4" /> Restock
                    </Button>
                  </td>
                </tr>
              ))}
              {(!products || products.length === 0) && (
                <tr>
                  <td colSpan={5} className="p-20 text-center opacity-30">
                    <Package className="w-16 h-16 mx-auto mb-4" />
                    <p className="font-black uppercase tracking-widest">Registry Empty</p>
                    <p className="text-xs font-bold mt-1">Register your first product to begin tracking</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function CouponManager({ companyId }: { companyId?: string }) {
  const firestore = useFirestore();
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);

  const couponsQuery = useMemoFirebase(() => {
    if (!firestore || !companyId) return null;
    return collection(firestore, 'companies', companyId, 'coupons');
  }, [firestore, companyId]);

  const { data: coupons } = useCollection<Coupon>(couponsQuery);

  const handleCreateCoupon = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!firestore || !companyId) return;
    setIsSaving(true);
    const formData = new FormData(e.currentTarget);
    const id = crypto.randomUUID();
    const couponData = {
      id,
      companyId,
      code: (formData.get('code') as string).toUpperCase(),
      value: Number(formData.get('value')),
      expiryDate: formData.get('expiry') as string,
      status: 'unused'
    };

    try {
      await setDoc(doc(firestore, 'companies', companyId, 'coupons', id), couponData);
      toast({ title: "Promotion Active" });
      (e.target as HTMLFormElement).reset();
    } catch (err) {
      toast({ title: "Promotion failed", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
       <Card className="border-none shadow-sm rounded-3xl bg-white h-fit">
          <CardHeader className="p-8">
             <CardTitle className="text-xl font-black">Generate Promotions</CardTitle>
          </CardHeader>
          <CardContent className="p-8 pt-0">
             <form onSubmit={handleCreateCoupon} className="space-y-6">
                <div className="space-y-1.5">
                   <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest px-1">Voucher Code</label>
                   <Input name="code" placeholder="SAVE20" required className="h-14 rounded-2xl font-black uppercase tracking-widest text-lg" />
                </div>
                <div className="space-y-1.5">
                   <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest px-1">Discount Magnitude ($)</label>
                   <Input name="value" type="number" step="0.01" placeholder="0.00" required className="h-14 rounded-2xl font-black text-lg" />
                </div>
                <div className="space-y-1.5">
                   <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest px-1">Expiration Timeline</label>
                   <Input name="expiry" type="date" required className="h-14 rounded-2xl font-bold" />
                </div>
                <Button type="submit" className="w-full h-16 rounded-2xl font-black shadow-xl" disabled={isSaving}>Activate Coupon</Button>
             </form>
          </CardContent>
       </Card>

       <div className="lg:col-span-2">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
             {coupons?.map(c => (
               <Card key={c.id} className={cn("border-none shadow-sm rounded-[32px] p-8 relative overflow-hidden transition-all", c.status === 'used' ? "opacity-50 grayscale" : "bg-white hover:shadow-xl")}>
                  <div className="absolute -right-8 -top-8 opacity-5 rotate-12">
                     <Ticket className="w-40 h-40" />
                  </div>
                  <div className="flex justify-between items-start mb-6">
                     <Badge className="font-black uppercase text-[10px] tracking-widest px-3 py-1">{c.status}</Badge>
                     <p className="text-3xl font-black text-primary">-${c.value.toFixed(2)}</p>
                  </div>
                  <h4 className="text-3xl font-black font-mono tracking-tighter text-foreground">{c.code}</h4>
                  <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] mt-2">Validity: {new Date(c.expiryDate).toLocaleDateString()}</p>
               </Card>
             ))}
             {(!coupons || coupons.length === 0) && (
               <div className="col-span-full py-24 text-center border-4 border-dashed rounded-[40px] bg-white/50">
                  <Ticket className="w-20 h-20 mx-auto mb-4 opacity-10" />
                  <p className="font-black text-muted-foreground uppercase tracking-widest">No active campaigns</p>
               </div>
             )}
          </div>
       </div>
    </div>
  );
}

function ReportStat({ label, value, color = "text-foreground" }: any) {
  return (
    <Card className="border-none shadow-sm p-8 bg-white rounded-[32px] group hover:shadow-xl transition-all">
       <p className="text-[10px] font-black uppercase text-muted-foreground mb-2 tracking-[0.2em]">{label}</p>
       <h4 className={cn("text-4xl font-black tracking-tighter", color)}>{value}</h4>
    </Card>
  );
}
