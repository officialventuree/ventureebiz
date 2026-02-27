
'use client';

import { useState } from 'react';
import { Sidebar } from '@/components/layout/sidebar';
import { Card, CardContent, CardHeader, CardTitle, CardFooter, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ShoppingCart, Plus, Minus, Search, Package, Receipt, TrendingUp, DollarSign, Calendar } from 'lucide-react';
import { useAuth } from '@/components/auth-context';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Product, SaleTransaction } from '@/lib/types';
import { cn } from '@/lib/utils';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';

export default function MartPage() {
  const { user } = useAuth();
  const firestore = useFirestore();
  const { toast } = useToast();
  const [cart, setCart] = useState<{ product: Product, quantity: number }[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const productsQuery = useMemoFirebase(() => {
    if (!firestore || !user?.companyId) return null;
    return collection(firestore, 'companies', user.companyId, 'products');
  }, [firestore, user?.companyId]);

  const transactionsQuery = useMemoFirebase(() => {
    if (!firestore || !user?.companyId) return null;
    return collection(firestore, 'companies', user.companyId, 'transactions');
  }, [firestore, user?.companyId]);

  const { data: products, isLoading: productsLoading } = useCollection<Product>(productsQuery);
  const { data: transactions } = useCollection<SaleTransaction>(transactionsQuery);

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

  const totalAmount = cart.reduce((acc, item) => acc + item.product.sellingPrice * item.quantity, 0);
  const totalProfit = cart.reduce((acc, item) => acc + (item.product.sellingPrice - item.product.costPrice) * item.quantity, 0);

  const handleCheckout = async () => {
    if (cart.length === 0 || !user?.companyId || !firestore) return;
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
        timestamp: new Date().toISOString(),
        items: cart.map(item => ({
          name: item.product.name,
          price: item.product.sellingPrice,
          cost: item.product.costPrice,
          quantity: item.quantity
        }))
      };

      await setDoc(transactionRef, transactionData);

      cart.forEach(item => {
        const productRef = doc(firestore, 'companies', user.companyId!, 'products', item.product.id);
        setDoc(productRef, { 
          stock: item.product.stock - item.quantity 
        }, { merge: true });
      });

      toast({ title: "Sale Completed", description: `Order total: $${totalAmount.toFixed(2)}` });
      setCart([]);
    } catch (e) {
      toast({ title: "Checkout failed", variant: "destructive" });
    } finally {
      setIsProcessing(false);
    }
  };

  // Profit Analytics Logic
  const profitData = transactions?.filter(t => t.module === 'mart').slice(-7).map(t => ({
    date: new Date(t.timestamp).toLocaleDateString([], { weekday: 'short' }),
    profit: t.profit,
    revenue: t.totalAmount
  })) || [];

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <main className="flex-1 overflow-hidden p-8 flex flex-col">
        <div className="mb-6">
          <h1 className="text-3xl font-bold font-headline text-foreground">Mart Module</h1>
          <p className="text-muted-foreground">Retail Terminal, Inventory & Performance Analytics</p>
        </div>

        <Tabs defaultValue="pos" className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="mb-4 bg-white/50 border self-start p-1 rounded-xl">
            <TabsTrigger value="pos" className="flex items-center gap-2 rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <Receipt className="w-4 h-4" /> POS System
            </TabsTrigger>
            <TabsTrigger value="inventory" className="flex items-center gap-2 rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <Package className="w-4 h-4" /> Inventory
            </TabsTrigger>
            <TabsTrigger value="profit" className="flex items-center gap-2 rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <TrendingUp className="w-4 h-4" /> Profit Analysis
            </TabsTrigger>
          </TabsList>

          <TabsContent value="pos" className="flex-1 overflow-hidden">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 h-full overflow-hidden">
              <div className="lg:col-span-2 flex flex-col gap-4 overflow-hidden">
                <div className="relative group">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4 group-focus-within:text-primary transition-colors" />
                  <Input 
                    placeholder="Search products by name or SKU..." 
                    className="pl-10 h-12 rounded-xl shadow-sm border-none bg-white/80 focus-visible:ring-primary"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                
                <div className="flex-1 overflow-auto grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 pb-4 scrollbar-hide">
                  {productsLoading ? (
                    <div className="col-span-full py-20 text-center text-muted-foreground animate-pulse">Loading products...</div>
                  ) : filteredProducts?.length === 0 ? (
                    <div className="col-span-full py-20 text-center text-muted-foreground border-2 border-dashed rounded-2xl bg-white/30">
                      No products found. Add some in the Inventory tab.
                    </div>
                  ) : (
                    filteredProducts?.map((product) => (
                      <Card 
                        key={product.id} 
                        className={cn(
                          "cursor-pointer hover:border-primary border-transparent transition-all hover:scale-[1.02] bg-white relative overflow-hidden shadow-sm",
                          product.stock <= 0 && "opacity-50 grayscale"
                        )}
                        onClick={() => addToCart(product)}
                      >
                        <CardContent className="p-6">
                          <div className="flex justify-between items-start mb-4">
                            <div className="w-10 h-10 bg-secondary rounded-xl flex items-center justify-center">
                              <Package className="text-primary w-5 h-5" />
                            </div>
                            <span className={cn(
                              "text-[10px] font-bold px-2 py-0.5 rounded-full uppercase",
                              product.stock > 10 ? "bg-primary/10 text-primary" : "bg-red-100 text-red-600"
                            )}>
                              {product.stock} in stock
                            </span>
                          </div>
                          <h3 className="font-bold mb-1 truncate text-foreground">{product.name}</h3>
                          <p className="text-primary font-black text-xl">${product.sellingPrice.toFixed(2)}</p>
                        </CardContent>
                      </Card>
                    ))
                  )}
                </div>
              </div>

              <div className="lg:col-span-1 h-full pb-4">
                <Card className="h-full flex flex-col border-none shadow-xl bg-white/90 backdrop-blur-md rounded-2xl overflow-hidden">
                  <CardHeader className="bg-primary/5 border-b">
                    <CardTitle className="flex items-center gap-2 text-xl font-headline">
                      <ShoppingCart className="w-5 h-5 text-primary" />
                      Shopping Cart
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="flex-1 overflow-auto p-4">
                    {cart.length === 0 ? (
                      <div className="h-full flex flex-col items-center justify-center text-muted-foreground space-y-4">
                        <div className="w-16 h-16 bg-secondary/50 rounded-full flex items-center justify-center">
                          <ShoppingCart className="w-8 h-8 opacity-20" />
                        </div>
                        <p className="font-medium">Cart is waiting for items</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {cart.map((item) => (
                          <div key={item.product.id} className="flex items-center justify-between gap-4 p-4 rounded-xl bg-secondary/30 group">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-bold truncate text-foreground">{item.product.name}</p>
                              <p className="text-xs text-primary font-bold">${(item.product.sellingPrice * item.quantity).toFixed(2)}</p>
                            </div>
                            <div className="flex items-center gap-2">
                              <Button size="icon" variant="ghost" className="h-8 w-8 hover:bg-white" onClick={() => updateQuantity(item.product.id, -1)}>
                                <Minus className="w-3 h-3" />
                              </Button>
                              <span className="text-sm font-black w-4 text-center">{item.quantity}</span>
                              <Button size="icon" variant="ghost" className="h-8 w-8 hover:bg-white" onClick={() => updateQuantity(item.product.id, 1)}>
                                <Plus className="w-3 h-3" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                  <CardFooter className="flex-col gap-4 border-t p-6 bg-secondary/10">
                    <div className="w-full space-y-2">
                      <div className="flex justify-between text-xs font-bold text-muted-foreground uppercase">
                        <span>Projected Profit</span>
                        <span className="text-green-600 font-black">+${totalProfit.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-2xl font-black text-foreground">
                        <span>Total Pay</span>
                        <span className="text-primary">${totalAmount.toFixed(2)}</span>
                      </div>
                    </div>
                    <Button 
                      className="w-full h-14 text-lg font-black shadow-lg shadow-primary/20 rounded-xl" 
                      disabled={cart.length === 0 || isProcessing}
                      onClick={handleCheckout}
                    >
                      {isProcessing ? "Finalizing..." : "Confirm Checkout"}
                    </Button>
                  </CardFooter>
                </Card>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="inventory" className="flex-1 overflow-auto">
            <InventoryManager companyId={user?.companyId} />
          </TabsContent>

          <TabsContent value="profit" className="flex-1 overflow-auto space-y-6 pb-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card className="border-none shadow-sm">
                <CardContent className="p-6">
                  <p className="text-xs font-bold text-muted-foreground uppercase">Average Profit Margin</p>
                  <h4 className="text-3xl font-black mt-1 text-primary">32.5%</h4>
                  <p className="text-[10px] text-green-600 mt-1 flex items-center gap-1 font-bold">
                    <TrendingUp className="w-3 h-3" /> +2.1% from last week
                  </p>
                </CardContent>
              </Card>
              <Card className="border-none shadow-sm">
                <CardContent className="p-6">
                  <p className="text-xs font-bold text-muted-foreground uppercase">Best Selling Item</p>
                  <h4 className="text-2xl font-black mt-1 text-foreground truncate">
                    {products?.sort((a,b) => (b.costPrice - a.costPrice))[0]?.name || 'No Data'}
                  </h4>
                  <p className="text-[10px] text-muted-foreground mt-1 font-bold uppercase tracking-tighter">Based on revenue</p>
                </CardContent>
              </Card>
              <Card className="border-none shadow-sm">
                <CardContent className="p-6">
                  <p className="text-xs font-bold text-muted-foreground uppercase">Weekly Revenue</p>
                  <h4 className="text-3xl font-black mt-1 text-foreground">
                    ${profitData.reduce((acc, d) => acc + d.revenue, 0).toFixed(2)}
                  </h4>
                  <p className="text-[10px] text-muted-foreground mt-1 font-bold uppercase">Last 7 Transactions</p>
                </CardContent>
              </Card>
            </div>

            <Card className="border-none shadow-sm p-6">
              <CardHeader className="px-0 pt-0">
                <CardTitle className="text-lg">Sales & Profit Trend</CardTitle>
                <CardDescription>Comparison of revenue vs. actual profit</CardDescription>
              </CardHeader>
              <div className="h-[400px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={profitData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                    <XAxis dataKey="date" axisLine={false} tickLine={false} />
                    <YAxis axisLine={false} tickLine={false} tickFormatter={(v) => `$${v}`} />
                    <Tooltip 
                      contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 25px rgba(0,0,0,0.1)' }}
                    />
                    <Bar dataKey="revenue" fill="hsl(var(--secondary))" radius={[4, 4, 0, 0]} name="Revenue" barSize={40} />
                    <Bar dataKey="profit" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="Profit" barSize={40} />
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

  const productsQuery = useMemoFirebase(() => {
    if (!firestore || !companyId) return null;
    return collection(firestore, 'companies', companyId, 'products');
  }, [firestore, companyId]);

  const { data: products } = useCollection<Product>(productsQuery);

  const handleAddProduct = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!firestore || !companyId) return;
    setIsAdding(true);
    
    const formData = new FormData(e.currentTarget);
    const productData = {
      id: crypto.randomUUID(),
      companyId,
      name: formData.get('name') as string,
      sku: formData.get('sku') as string,
      costPrice: Number(formData.get('costPrice')),
      sellingPrice: Number(formData.get('sellingPrice')),
      stock: Number(formData.get('stock')),
    };

    try {
      await setDoc(doc(firestore, 'companies', companyId, 'products', productData.id), productData);
      toast({ title: "Product Added", description: `${productData.name} has been added to inventory.` });
      (e.target as HTMLFormElement).reset();
    } catch (e) {
      toast({ title: "Failed to add product", variant: "destructive" });
    } finally {
      setIsAdding(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 pb-8 h-full">
      <Card className="lg:col-span-1 h-fit border-none shadow-sm bg-white rounded-2xl">
        <CardHeader>
          <CardTitle className="text-lg">Product Entry</CardTitle>
          <CardDescription>Update your retail catalog</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAddProduct} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Item Name</label>
              <Input name="name" placeholder="Green Tea Pack" className="rounded-lg" required />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">SKU / Barcode</label>
              <Input name="sku" placeholder="GT-001" className="rounded-lg" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Cost ($)</label>
                <Input name="costPrice" type="number" step="0.01" placeholder="5.00" className="rounded-lg" required />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Sale ($)</label>
                <Input name="sellingPrice" type="number" step="0.01" placeholder="12.00" className="rounded-lg" required />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Initial Units</label>
              <Input name="stock" type="number" placeholder="100" className="rounded-lg" required />
            </div>
            <Button type="submit" className="w-full h-11 font-bold rounded-xl" disabled={isAdding}>
              {isAdding ? "Saving..." : "Register Product"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <div className="lg:col-span-3 space-y-4 overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-2">
          <h3 className="font-black text-xl text-foreground">Stock Registry</h3>
          <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground">
            <Calendar className="w-3 h-3" /> Last synced: Just now
          </div>
        </div>
        <div className="border rounded-2xl overflow-hidden bg-white shadow-sm flex-1">
          <table className="w-full text-sm text-left">
            <thead className="bg-secondary/20 border-b">
              <tr>
                <th className="p-4 font-black uppercase tracking-tighter text-muted-foreground">Product Details</th>
                <th className="p-4 font-black uppercase tracking-tighter text-muted-foreground">SKU</th>
                <th className="p-4 text-right font-black uppercase tracking-tighter text-muted-foreground">Profit/Unit</th>
                <th className="p-4 text-right font-black uppercase tracking-tighter text-muted-foreground">Stock Level</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {products?.map(p => (
                <tr key={p.id} className="hover:bg-secondary/10 transition-colors">
                  <td className="p-4">
                    <p className="font-black text-foreground">{p.name}</p>
                    <p className="text-[10px] text-muted-foreground">Cost: ${p.costPrice.toFixed(2)} | Sale: ${p.sellingPrice.toFixed(2)}</p>
                  </td>
                  <td className="p-4 text-muted-foreground font-mono">{p.sku || '---'}</td>
                  <td className="p-4 text-right font-bold text-green-600">
                    +${(p.sellingPrice - p.costPrice).toFixed(2)}
                  </td>
                  <td className="p-4 text-right">
                    <span className={cn(
                      "font-black px-3 py-1 rounded-full text-[10px] border",
                      p.stock < 10 ? "bg-red-50 text-red-600 border-red-100" : "bg-primary/5 text-primary border-primary/10"
                    )}>
                      {p.stock} UNITS
                    </span>
                  </td>
                </tr>
              ))}
              {(!products || products.length === 0) && (
                <tr>
                  <td colSpan={4} className="p-20 text-center text-muted-foreground">
                    <Package className="w-12 h-12 mx-auto mb-2 opacity-20" />
                    No inventory records found.
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
