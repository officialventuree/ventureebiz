
'use client';

import { useState } from 'react';
import { Sidebar } from '@/components/layout/sidebar';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ShoppingCart, Plus, Minus, Trash2 } from 'lucide-react';
import { useAuth } from '@/components/auth-context';
import { recordSaleAction } from '@/app/actions';
import { useToast } from '@/hooks/use-toast';
import { useFirestore } from '@/firebase';
import { collection, doc, setDoc } from 'firebase/firestore';

const PRODUCTS = [
  { id: '1', name: 'Premium Matcha Powder', price: 24.99, cost: 12.00 },
  { id: '2', name: 'Sage Green Teapot', price: 45.00, cost: 20.00 },
  { id: '3', name: 'Bamboo Whisk', price: 12.50, cost: 5.00 },
  { id: '4', name: 'Ceramic Bowl', price: 32.00, cost: 15.00 },
  { id: '5', name: 'Organic Green Tea', price: 18.00, cost: 8.00 },
];

export default function POSPage() {
  const [cart, setCart] = useState<{ id: string, name: string, price: number, cost: number, quantity: number }[]>([]);
  const { user } = useAuth();
  const firestore = useFirestore();
  const { toast } = useToast();
  const [isProcessing, setIsProcessing] = useState(false);

  const addToCart = (product: typeof PRODUCTS[0]) => {
    const existing = cart.find(item => item.id === product.id);
    if (existing) {
      setCart(cart.map(item => item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item));
    } else {
      setCart([...cart, { ...product, quantity: 1 }]);
    }
  };

  const removeFromCart = (id: string) => {
    setCart(cart.filter(item => item.id !== id));
  };

  const updateQuantity = (id: string, delta: number) => {
    setCart(cart.map(item => {
      if (item.id === id) {
        const newQty = Math.max(1, item.quantity + delta);
        return { ...item, quantity: newQty };
      }
      return item;
    }));
  };

  const total = cart.reduce((acc, item) => acc + item.price * item.quantity, 0);
  const profit = cart.reduce((acc, item) => acc + (item.price - item.cost) * item.quantity, 0);

  const handleCheckout = async () => {
    if (cart.length === 0 || !firestore || !user?.companyId) return;
    setIsProcessing(true);
    
    try {
      const transactionId = crypto.randomUUID();
      const transactionRef = doc(firestore, 'companies', user.companyId, 'transactions', transactionId);
      
      const transactionData = {
        id: transactionId,
        companyId: user.companyId,
        module: 'mart',
        totalAmount: total,
        profit: profit,
        timestamp: new Date().toISOString(),
        items: cart.map(item => ({
          name: item.name,
          price: item.price,
          cost: item.cost,
          quantity: item.quantity
        }))
      };

      await setDoc(transactionRef, transactionData);
      await recordSaleAction(user.companyId, cart);

      toast({
        title: "Sale Completed",
        description: `Total amount: $${total.toFixed(2)}`,
      });
      setCart([]);
    } catch (e) {
      toast({
        title: "Checkout failed",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <main className="flex-1 overflow-hidden p-8 flex flex-col">
        <div className="mb-6">
          <h1 className="text-3xl font-bold font-headline">Point of Sale</h1>
          <p className="text-muted-foreground">Quick transaction terminal</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 flex-1 overflow-hidden">
          <div className="lg:col-span-2 overflow-auto pr-2">
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {PRODUCTS.map((product) => (
                <Card 
                  key={product.id} 
                  className="cursor-pointer hover:border-primary transition-colors bg-white/50"
                  onClick={() => addToCart(product)}
                >
                  <CardContent className="p-6">
                    <div className="w-12 h-12 bg-secondary rounded-xl flex items-center justify-center mb-4">
                      <ShoppingCart className="text-primary w-6 h-6" />
                    </div>
                    <h3 className="font-bold mb-1">{product.name}</h3>
                    <p className="text-primary font-bold">${product.price.toFixed(2)}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          <div className="lg:col-span-1 h-full">
            <Card className="h-full flex flex-col border-none shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ShoppingCart className="w-5 h-5 text-primary" />
                  Cart Summary
                </CardTitle>
              </CardHeader>
              <CardContent className="flex-1 overflow-auto">
                {cart.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-muted-foreground space-y-4">
                    <ShoppingCart className="w-12 h-12 opacity-20" />
                    <p>No items in cart</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {cart.map((item) => (
                      <div key={item.id} className="flex items-center justify-between gap-4 p-2 rounded-lg bg-secondary/20">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold truncate">{item.name}</p>
                          <p className="text-xs text-primary">${(item.price * item.quantity).toFixed(2)}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); updateQuantity(item.id, -1); }}>
                            <Minus className="w-3 h-3" />
                          </Button>
                          <span className="text-sm font-bold w-4 text-center">{item.quantity}</span>
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); updateQuantity(item.id, 1); }}>
                            <Plus className="w-3 h-3" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={(e) => { e.stopPropagation(); removeFromCart(item.id); }}>
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
              <CardFooter className="flex-col gap-4 border-t p-6">
                <div className="w-full flex justify-between text-lg font-bold">
                  <span>Total</span>
                  <span className="text-primary">${total.toFixed(2)}</span>
                </div>
                <Button 
                  className="w-full h-12 text-lg font-bold shadow-md" 
                  disabled={cart.length === 0 || isProcessing}
                  onClick={handleCheckout}
                >
                  {isProcessing ? "Processing..." : "Complete Sale"}
                </Button>
              </CardFooter>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
