'use client';

import { useState } from 'react';
import { Sidebar } from '@/components/layout/sidebar';
import { Card, CardContent, CardHeader, CardTitle, CardFooter, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ShoppingCart, Plus, Minus, Search, Package, Receipt, TrendingUp, DollarSign, Calendar, Ticket, Trophy, Truck, Trash2, CheckCircle2 } from 'lucide-react';
import { useAuth } from '@/components/auth-context';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, doc, setDoc, updateDoc, increment, query, where, getDocs, addDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Product, SaleTransaction, Coupon, LuckyDrawEntry } from '@/lib/types';
import { cn } from '@/lib/utils';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

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

  const { data: products, isLoading: productsLoading } = useCollection<Product>(productsQuery);
  const { data: transactions } = useCollection<SaleTransaction>(transactionsQuery);
  const { data: coupons } = useCollection<Coupon>(couponsQuery);

  const filteredProducts = products?.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    p.sku?.toLowerCase().includes(searchTerm.toLowerCase())
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
      where('code', '==', couponCode),
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
      toast({ title: "Coupon Applied", description: `Discount: $${couponData.value.toFixed(2)}` });
    }
  };

  const handleCheckout = async () => {
    if (cart.length === 0 || !user?.companyId || !firestore) return;
    if (totalAmount >= LUCKY_DRAW_MIN_SPEND && !customerName) {
      toast({ title: "Lucky Draw Eligible!", description: "Please enter customer name to proceed.", variant: "destructive" });
      return;
    }

    setIsProcessing(true);
    
    try {
      const transactionId = crypto.randomUUID();
      const transactionRef = doc(firestore, 'companies', user.companyId, 'transactions', transactionId);
      
      const transactionData = {
        id: transactionId,
        companyId: user.companyId,
        module: 'mart',
        totalAmount,
        profit: totalProfit,
        discountApplied: discount,
        couponCode: activeCoupon?.code || null,
        customerName: customerName || 'Walk-in',
        timestamp: new Date().toISOString(),
        items: cart.map(item => ({
          name: item.product.name,
          price: item.product.sellingPrice,
          cost: item.product.costPrice,
          quantity: item.quantity
        }))
      };

      await setDoc(transactionRef, transactionData);

      // Deduct stock
      for (const item of cart) {
        const productRef = doc(firestore, 'companies', user.companyId, 'products', item.product.id);
        await updateDoc(productRef, { stock: increment(-item.quantity) });
      }

      // Mark coupon used
      if (activeCoupon) {
        await updateDoc(doc(firestore, 'companies', user.companyId, 'coupons', activeCoupon.id), { status: 'used' });
      }

      // Record Lucky Draw
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

      toast({ title: "Sale Completed", description: `Order total: $${totalAmount.toFixed(2)}` });
      setCart([]);
      setActiveCoupon(null);
      setCouponCode('');
      setCustomerName('');
    } catch (e) {
      toast({ title: "Checkout failed", variant: "destructive" });
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
    <div className="flex h-screen bg-background">
      <Sidebar />
      <main className="flex-1 overflow-hidden p-8 flex flex-col">
        <div className="mb-6 flex justify-between items-end">
          <div>
            <h1 className="text-3xl font-black font-headline text-foreground">Mart Management</h1>
            <p className="text-muted-foreground font-medium">Operations, Loyalty & Logistics</p>
          </div>
          <div className="flex gap-4">
             <Card className="p-4 border-none shadow-sm bg-white/50 flex items-center gap-3">
                <Trophy className="w-5 h-5 text-accent" />
                <div>
                   <p className="text-[10px] font-black uppercase text-muted-foreground">Lucky Draw Min.</p>
                   <p className="text-sm font-black text-foreground">${LUCKY_DRAW_MIN_SPEND}</p>
                </div>
             </Card>
          </div>
        </div>

        <Tabs defaultValue="pos" className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="mb-4 bg-white/50 border self-start p-1 rounded-xl">
            <TabsTrigger value="pos" className="gap-2 rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <Receipt className="w-4 h-4" /> POS
            </TabsTrigger>
            <TabsTrigger value="inventory" className="gap-2 rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <Package className="w-4 h-4" /> Stock
            </TabsTrigger>
            <TabsTrigger value="coupons" className="gap-2 rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <Ticket className="w-4 h-4" /> Coupons
            </TabsTrigger>
            <TabsTrigger value="profit" className="gap-2 rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <TrendingUp className="w-4 h-4" /> Analytics
            </TabsTrigger>
          </TabsList>

          <TabsContent value="pos" className="flex-1 overflow-hidden">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 h-full overflow-hidden">
              <div className="lg:col-span-2 flex flex-col gap-4 overflow-hidden">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
                  <Input 
                    placeholder="Quick search products..." 
                    className="pl-10 h-12 rounded-xl border-none bg-white shadow-sm"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                
                <div className="flex-1 overflow-auto grid grid-cols-1 md:grid-cols-2 gap-4 pb-4">
                  {filteredProducts?.map((product) => (
                    <Card 
                      key={product.id} 
                      className={cn(
                        "cursor-pointer hover:border-primary border-transparent transition-all bg-white shadow-sm",
                        product.stock <= 0 && "opacity-50 grayscale"
                      )}
                      onClick={() => addToCart(product)}
                    >
                      <CardContent className="p-6 flex justify-between items-center">
                        <div className="space-y-1">
                          <h3 className="font-black text-lg">{product.name}</h3>
                          <p className="text-xl font-black text-primary">${product.sellingPrice.toFixed(2)}</p>
                          <p className="text-[10px] text-muted-foreground font-bold uppercase">SKU: {product.sku || 'N/A'}</p>
                        </div>
                        <div className="text-right">
                           <Badge variant={product.stock > 10 ? "outline" : "destructive"} className="mb-2 uppercase font-black">
                             {product.stock} Units
                           </Badge>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>

              <div className="lg:col-span-1 h-full">
                <Card className="h-full flex flex-col border-none shadow-xl bg-white rounded-3xl overflow-hidden">
                  <CardHeader className="bg-secondary/10">
                    <CardTitle className="flex items-center gap-2 text-xl font-black">
                      <ShoppingCart className="w-5 h-5 text-primary" />
                      Checkout
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="flex-1 overflow-auto p-6 space-y-4">
                    {cart.map((item) => (
                      <div key={item.product.id} className="flex items-center justify-between p-3 rounded-xl bg-secondary/20">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-black truncate">{item.product.name}</p>
                          <p className="text-xs text-primary font-bold">${(item.product.sellingPrice * item.quantity).toFixed(2)}</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <Button size="icon" variant="ghost" className="h-8 w-8 bg-white" onClick={() => updateQuantity(item.product.id, -1)}>
                            <Minus className="w-3 h-3" />
                          </Button>
                          <span className="font-black w-4 text-center">{item.quantity}</span>
                          <Button size="icon" variant="ghost" className="h-8 w-8 bg-white" onClick={() => updateQuantity(item.product.id, 1)}>
                            <Plus className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    ))}
                    {cart.length === 0 && <p className="text-center py-20 text-muted-foreground font-bold">Cart is empty</p>}
                  </CardContent>
                  <CardFooter className="flex-col gap-4 p-6 border-t bg-secondary/5">
                    <div className="w-full space-y-3">
                      <div className="flex gap-2">
                        <Input 
                          placeholder="Coupon Code" 
                          className="h-10 rounded-xl bg-white border-none shadow-sm text-sm"
                          value={couponCode}
                          onChange={(e) => setCouponCode(e.target.value)}
                        />
                        <Button onClick={handleApplyCoupon} variant="secondary" className="rounded-xl font-black h-10">Apply</Button>
                      </div>

                      {totalAmount >= LUCKY_DRAW_MIN_SPEND && (
                        <div className="space-y-1">
                           <label className="text-[10px] font-black uppercase text-accent">Customer Name (Lucky Draw Entry)</label>
                           <Input 
                             placeholder="Required for entries..." 
                             className="h-10 rounded-xl border-accent bg-accent/5 font-bold"
                             value={customerName}
                             onChange={(e) => setCustomerName(e.target.value)}
                           />
                        </div>
                      )}

                      <div className="pt-2 border-t space-y-2">
                        <div className="flex justify-between text-xs font-bold text-muted-foreground">
                          <span>Subtotal</span>
                          <span>${subtotal.toFixed(2)}</span>
                        </div>
                        {discount > 0 && (
                          <div className="flex justify-between text-xs font-bold text-green-600">
                            <span>Discount ({activeCoupon?.code})</span>
                            <span>-${discount.toFixed(2)}</span>
                          </div>
                        )}
                        <div className="flex justify-between text-2xl font-black text-foreground">
                          <span>Total</span>
                          <span className="text-primary">${totalAmount.toFixed(2)}</span>
                        </div>
                      </div>
                    </div>
                    <Button 
                      className="w-full h-14 text-lg font-black rounded-xl shadow-lg" 
                      disabled={cart.length === 0 || isProcessing}
                      onClick={handleCheckout}
                    >
                      {isProcessing ? "Processing..." : "Complete Order"}
                    </Button>
                  </CardFooter>
                </Card>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="inventory">
            <InventoryManager companyId={user?.companyId} />
          </TabsContent>

          <TabsContent value="coupons">
            <CouponManager companyId={user?.companyId} />
          </TabsContent>

          <TabsContent value="profit" className="space-y-6 overflow-auto pb-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
               <ReportStat label="Weekly Revenue" value={`$${profitData.reduce((acc, d) => acc + d.revenue, 0).toFixed(2)}`} />
               <ReportStat label="Net Profit" value={`$${profitData.reduce((acc, d) => acc + d.profit, 0).toFixed(2)}`} color="text-primary" />
               <ReportStat label="Lucky Draws" value={`${transactions?.filter(t => t.totalAmount >= LUCKY_DRAW_MIN_SPEND).length || 0} entries`} />
            </div>
            <Card className="border-none shadow-sm p-8 bg-white rounded-3xl">
               <CardHeader className="px-0 pt-0">
                  <CardTitle className="text-lg font-black">Growth Analytics</CardTitle>
               </CardHeader>
               <div className="h-[350px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={profitData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                      <XAxis dataKey="date" axisLine={false} tickLine={false} />
                      <YAxis axisLine={false} tickLine={false} />
                      <Tooltip contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 25px rgba(0,0,0,0.1)' }} />
                      <Bar dataKey="revenue" fill="hsl(var(--secondary))" radius={[8, 8, 0, 0]} name="Revenue" />
                      <Bar dataKey="profit" fill="hsl(var(--primary))" radius={[8, 8, 0, 0]} name="Profit" />
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

function InventoryManager({ companyId }: { companyId?: string }) {
  const firestore = useFirestore();
  const { toast } = useToast();
  const [isAdding, setIsAdding] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

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
      // 1. Update Product Stock
      const productRef = doc(firestore, 'companies', companyId, 'products', selectedProduct.id);
      await updateDoc(productRef, { 
        stock: increment(qty),
        costPrice: cost / qty // Update avg cost price
      });

      // 2. Record Capital Purchase
      const purchaseRef = collection(firestore, 'companies', companyId, 'purchases');
      await addDoc(purchaseRef, {
        id: crypto.randomUUID(),
        companyId,
        amount: cost,
        description: `Restock: ${qty} units of ${selectedProduct.name}`,
        timestamp: new Date().toISOString()
      });

      toast({ title: "Inventory Restocked", description: `Added ${qty} units to ${selectedProduct.name}` });
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
      costPrice: Number(formData.get('cost')),
      sellingPrice: Number(formData.get('price')),
      stock: Number(formData.get('stock')),
    };

    try {
      await setDoc(doc(firestore, 'companies', companyId, 'products', id), productData);
      toast({ title: "Product Registered" });
      (e.target as HTMLFormElement).reset();
    } catch (err) {
      toast({ title: "Save failed", variant: "destructive" });
    } finally {
      setIsAdding(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 pb-8">
      <div className="space-y-6">
        <Card className="border-none shadow-sm rounded-3xl bg-white overflow-hidden">
          <CardHeader className="bg-primary/5">
            <CardTitle className="text-lg font-black flex items-center gap-2">
               <Truck className="w-5 h-5" /> Replenish Stock
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
             {selectedProduct ? (
               <form onSubmit={handleReplenish} className="space-y-4">
                  <div className="p-4 bg-secondary/20 rounded-2xl">
                     <p className="text-[10px] font-black uppercase text-muted-foreground">Product</p>
                     <p className="font-black">{selectedProduct.name}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                     <div className="space-y-1.5">
                        <label className="text-[10px] font-black uppercase">Units</label>
                        <Input name="quantity" type="number" required className="rounded-xl h-12" />
                     </div>
                     <div className="space-y-1.5">
                        <label className="text-[10px] font-black uppercase">Total Cost ($)</label>
                        <Input name="cost" type="number" step="0.01" required className="rounded-xl h-12" />
                     </div>
                  </div>
                  <div className="flex gap-2">
                     <Button type="submit" className="flex-1 rounded-xl font-black h-12" disabled={isAdding}>Confirm</Button>
                     <Button type="button" variant="outline" className="rounded-xl font-black h-12" onClick={() => setSelectedProduct(null)}>Cancel</Button>
                  </div>
               </form>
             ) : (
               <div className="py-12 text-center text-muted-foreground bg-secondary/10 rounded-2xl border-2 border-dashed">
                  <p className="text-sm font-bold">Select a product from the list to replenish stock</p>
               </div>
             )}
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm rounded-3xl bg-white">
          <CardHeader>
            <CardTitle className="text-lg font-black">New Product Entry</CardTitle>
          </CardHeader>
          <CardContent className="p-6">
             <form onSubmit={handleAddNew} className="space-y-4">
                <Input name="name" placeholder="Item Name" required className="h-12 rounded-xl" />
                <Input name="sku" placeholder="SKU/Barcode" className="h-12 rounded-xl" />
                <div className="grid grid-cols-2 gap-4">
                   <Input name="cost" type="number" placeholder="Cost" step="0.01" required className="h-12 rounded-xl" />
                   <Input name="price" type="number" placeholder="Price" step="0.01" required className="h-12 rounded-xl" />
                </div>
                <Input name="stock" type="number" placeholder="Initial Stock" required className="h-12 rounded-xl" />
                <Button type="submit" className="w-full h-12 rounded-xl font-black" disabled={isAdding}>Save Product</Button>
             </form>
          </CardContent>
        </Card>
      </div>

      <div className="lg:col-span-2">
        <div className="bg-white rounded-3xl border shadow-sm overflow-hidden">
          <table className="w-full text-sm text-left">
            <thead className="bg-secondary/20 border-b">
              <tr>
                <th className="p-4 font-black uppercase text-muted-foreground tracking-tighter">Product</th>
                <th className="p-4 font-black uppercase text-muted-foreground tracking-tighter">Stock</th>
                <th className="p-4 font-black uppercase text-muted-foreground tracking-tighter">Value</th>
                <th className="p-4 text-center font-black uppercase text-muted-foreground tracking-tighter">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {products?.map(p => (
                <tr key={p.id} className="hover:bg-secondary/5 transition-colors">
                  <td className="p-4">
                    <p className="font-black text-foreground">{p.name}</p>
                    <p className="text-[10px] text-muted-foreground font-mono">SKU: {p.sku || 'N/A'}</p>
                  </td>
                  <td className="p-4">
                    <Badge variant={p.stock < 10 ? "destructive" : "outline"} className="font-black uppercase text-[10px]">
                      {p.stock} Units
                    </Badge>
                  </td>
                  <td className="p-4 font-black text-primary">${(p.stock * p.costPrice).toFixed(2)}</td>
                  <td className="p-4 text-center">
                    <Button variant="ghost" size="sm" onClick={() => setSelectedProduct(p)} className="rounded-xl font-black gap-2">
                      <Truck className="w-4 h-4" /> Restock
                    </Button>
                  </td>
                </tr>
              ))}
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
      code: formData.get('code') as string,
      value: Number(formData.get('value')),
      expiryDate: formData.get('expiry') as string,
      status: 'unused'
    };

    try {
      await setDoc(doc(firestore, 'companies', companyId, 'coupons', id), couponData);
      toast({ title: "Coupon Created" });
      (e.target as HTMLFormElement).reset();
    } catch (err) {
      toast({ title: "Save failed", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
       <Card className="border-none shadow-sm rounded-3xl bg-white h-fit">
          <CardHeader>
             <CardTitle className="text-lg font-black">Generate Coupon</CardTitle>
          </CardHeader>
          <CardContent className="p-6">
             <form onSubmit={handleCreateCoupon} className="space-y-4">
                <Input name="code" placeholder="Code (e.g. SAVE20)" required className="h-12 rounded-xl font-black uppercase" />
                <Input name="value" type="number" step="0.01" placeholder="Discount Amount ($)" required className="h-12 rounded-xl" />
                <div className="space-y-1.5">
                   <label className="text-[10px] font-black uppercase text-muted-foreground px-1">Expiry Date</label>
                   <Input name="expiry" type="date" required className="h-12 rounded-xl" />
                </div>
                <Button type="submit" className="w-full h-12 rounded-xl font-black" disabled={isSaving}>Create Coupon</Button>
             </form>
          </CardContent>
       </Card>

       <div className="lg:col-span-2">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
             {coupons?.map(c => (
               <Card key={c.id} className={cn("border-none shadow-sm rounded-3xl p-6 relative overflow-hidden", c.status === 'used' ? "opacity-50 grayscale" : "bg-white")}>
                  <div className="absolute -right-4 -top-4 opacity-5 rotate-12">
                     <Ticket className="w-24 h-24" />
                  </div>
                  <div className="flex justify-between items-start mb-4">
                     <Badge className="font-black uppercase text-[10px]">{c.status}</Badge>
                     <p className="text-xl font-black text-primary">-${c.value.toFixed(2)}</p>
                  </div>
                  <h4 className="text-2xl font-black font-mono tracking-tighter">{c.code}</h4>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase mt-1">Expires: {c.expiryDate}</p>
               </Card>
             ))}
             {(!coupons || coupons.length === 0) && (
               <div className="col-span-full py-20 text-center border-2 border-dashed rounded-3xl bg-white/50">
                  <Ticket className="w-12 h-12 mx-auto mb-2 opacity-10" />
                  <p className="font-bold text-muted-foreground">No promotional coupons found.</p>
               </div>
             )}
          </div>
       </div>
    </div>
  );
}

function ReportStat({ label, value, color = "text-foreground" }: any) {
  return (
    <Card className="border-none shadow-sm p-6 bg-white rounded-2xl group hover:shadow-md transition-shadow">
       <p className="text-[10px] font-black uppercase text-muted-foreground mb-1 tracking-widest">{label}</p>
       <h4 className={cn("text-3xl font-black", color)}>{value}</h4>
    </Card>
  );
}
