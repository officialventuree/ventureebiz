
'use client';

import { useState } from 'react';
import { Sidebar } from '@/components/layout/sidebar';
import { Card, CardContent, CardHeader, CardTitle, CardFooter, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ShoppingCart, Plus, Minus, Trash2, Search, Package, Receipt } from 'lucide-react';
import { useAuth } from '@/components/auth-context';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, doc, setDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Product } from '@/lib/types';
import { cn } from '@/lib/utils';

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

  const { data: products, isLoading: productsLoading } = useCollection<Product>(productsQuery);

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

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <main className="flex-1 overflow-hidden p-8 flex flex-col">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold font-headline">Mart Module</h1>
            <p className="text-muted-foreground">Retail Point of Sale & Inventory</p>
          </div>
        </div>

        <Tabs defaultValue="pos" className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="mb-4">
            <TabsTrigger value="pos" className="flex items-center gap-2">
              <Receipt className="w-4 h-4" /> POS System
            </TabsTrigger>
            <TabsTrigger value="inventory" className="flex items-center gap-2">
              <Package className="w-4 h-4" /> Inventory
            </TabsTrigger>
          </TabsList>

          <TabsContent value="pos" className="flex-1 overflow-hidden">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 h-full overflow-hidden">
              <div className="lg:col-span-2 flex flex-col gap-4 overflow-hidden">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
                  <Input 
                    placeholder="Search products by name or SKU..." 
                    className="pl-10"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                
                <div className="flex-1 overflow-auto grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 pb-4">
                  {productsLoading ? (
                    <div className="col-span-full py-20 text-center text-muted-foreground">Loading products...</div>
                  ) : filteredProducts?.length === 0 ? (
                    <div className="col-span-full py-20 text-center text-muted-foreground border-2 border-dashed rounded-xl">
                      No products found. Add some in the Inventory tab.
                    </div>
                  ) : (
                    filteredProducts?.map((product) => (
                      <Card 
                        key={product.id} 
                        className={cn(
                          "cursor-pointer hover:border-primary transition-colors bg-white/50 relative overflow-hidden",
                          product.stock <= 0 && "opacity-50 grayscale"
                        )}
                        onClick={() => addToCart(product)}
                      >
                        <CardContent className="p-6">
                          <div className="flex justify-between items-start mb-4">
                            <div className="w-10 h-10 bg-secondary rounded-lg flex items-center justify-center">
                              <Package className="text-primary w-5 h-5" />
                            </div>
                            <span className={cn(
                              "text-[10px] font-bold px-2 py-0.5 rounded-full uppercase",
                              product.stock > 10 ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                            )}>
                              Stock: {product.stock}
                            </span>
                          </div>
                          <h3 className="font-bold mb-1 truncate">{product.name}</h3>
                          <p className="text-primary font-bold text-lg">${product.sellingPrice.toFixed(2)}</p>
                        </CardContent>
                      </Card>
                    ))
                  )}
                </div>
              </div>

              <div className="lg:col-span-1 h-full pb-4">
                <Card className="h-full flex flex-col border-none shadow-lg">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-xl">
                      <ShoppingCart className="w-5 h-5 text-primary" />
                      Checkout
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="flex-1 overflow-auto">
                    {cart.length === 0 ? (
                      <div className="h-full flex flex-col items-center justify-center text-muted-foreground space-y-4">
                        <ShoppingCart className="w-12 h-12 opacity-20" />
                        <p>Your cart is empty</p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {cart.map((item) => (
                          <div key={item.product.id} className="flex items-center justify-between gap-4 p-3 rounded-xl bg-secondary/20">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-bold truncate">{item.product.name}</p>
                              <p className="text-xs text-primary font-semibold">${(item.product.sellingPrice * item.quantity).toFixed(2)}</p>
                            </div>
                            <div className="flex items-center gap-2">
                              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => updateQuantity(item.product.id, -1)}>
                                <Minus className="w-3 h-3" />
                              </Button>
                              <span className="text-sm font-bold w-4 text-center">{item.quantity}</span>
                              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => updateQuantity(item.product.id, 1)}>
                                <Plus className="w-3 h-3" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                  <CardFooter className="flex-col gap-4 border-t p-6 bg-secondary/5">
                    <div className="w-full space-y-1">
                      <div className="flex justify-between text-sm text-muted-foreground">
                        <span>Items Profit</span>
                        <span className="text-green-600">+${totalProfit.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-xl font-bold">
                        <span>Total</span>
                        <span className="text-primary">${totalAmount.toFixed(2)}</span>
                      </div>
                    </div>
                    <Button 
                      className="w-full h-12 text-lg font-bold shadow-md rounded-xl" 
                      disabled={cart.length === 0 || isProcessing}
                      onClick={handleCheckout}
                    >
                      {isProcessing ? "Processing..." : "Confirm Payment"}
                    </Button>
                  </CardFooter>
                </Card>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="inventory" className="flex-1 overflow-auto">
            <InventoryManager companyId={user?.companyId} />
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
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 pb-8">
      <Card className="lg:col-span-1 h-fit border-none shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg">Add New Item</CardTitle>
          <CardDescription>Enter product details for retail</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAddProduct} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase text-muted-foreground">Product Name</label>
              <Input name="name" placeholder="Matcha Latte Pack" required />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase text-muted-foreground">SKU / Barcode</label>
              <Input name="sku" placeholder="MAT-001" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase text-muted-foreground">Cost ($)</label>
                <Input name="costPrice" type="number" step="0.01" placeholder="5.00" required />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase text-muted-foreground">Selling ($)</label>
                <Input name="sellingPrice" type="number" step="0.01" placeholder="12.00" required />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase text-muted-foreground">Initial Stock</label>
              <Input name="stock" type="number" placeholder="100" required />
            </div>
            <Button type="submit" className="w-full" disabled={isAdding}>
              {isAdding ? "Adding..." : "Update Inventory"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <div className="lg:col-span-3 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-lg">Stock Registry</h3>
          <p className="text-xs text-muted-foreground">{products?.length || 0} items listed</p>
        </div>
        <div className="border rounded-xl overflow-hidden bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-secondary/30 border-b">
                <th className="text-left p-4 font-bold">Item Name</th>
                <th className="text-left p-4 font-bold">SKU</th>
                <th className="text-right p-4 font-bold">Cost</th>
                <th className="text-right p-4 font-bold">Selling</th>
                <th className="text-right p-4 font-bold">Stock</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {products?.map(p => (
                <tr key={p.id} className="hover:bg-secondary/10 transition-colors">
                  <td className="p-4 font-medium">{p.name}</td>
                  <td className="p-4 text-muted-foreground">{p.sku || 'N/A'}</td>
                  <td className="p-4 text-right">${p.costPrice.toFixed(2)}</td>
                  <td className="p-4 text-right font-bold text-primary">${p.sellingPrice.toFixed(2)}</td>
                  <td className="p-4 text-right">
                    <span className={cn(
                      "font-bold px-2 py-1 rounded-lg text-xs",
                      p.stock < 10 ? "bg-red-100 text-red-600" : "bg-primary/10 text-primary"
                    )}>
                      {p.stock} units
                    </span>
                  </td>
                </tr>
              ))}
              {products?.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-muted-foreground">No items in inventory.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
