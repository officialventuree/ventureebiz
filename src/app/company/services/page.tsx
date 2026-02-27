
'use client';

import { Sidebar } from '@/components/layout/sidebar';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Wrench, Plus, Search, ClipboardList, CheckCircle2, Clock, Trash2, TrendingUp } from 'lucide-react';
import { useAuth } from '@/components/auth-context';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, doc, setDoc, deleteDoc, updateDoc } from 'firebase/firestore';
import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ServiceItem, SaleTransaction } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

export default function ServicesPage() {
  const { user } = useAuth();
  const firestore = useFirestore();
  const { toast } = useToast();
  const [isProcessing, setIsProcessing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const servicesQuery = useMemoFirebase(() => {
    if (!firestore || !user?.companyId) return null;
    return collection(firestore, 'companies', user.companyId, 'serviceItems');
  }, [firestore, user?.companyId]);

  const transactionsQuery = useMemoFirebase(() => {
    if (!firestore || !user?.companyId) return null;
    return collection(firestore, 'companies', user.companyId, 'transactions');
  }, [firestore, user?.companyId]);

  const { data: serviceItems } = useCollection<ServiceItem>(servicesQuery);
  const { data: transactions } = useCollection<SaleTransaction>(transactionsQuery);

  const pendingOrders = transactions?.filter(t => t.module === 'services' && t.status === 'pending') || [];
  const completedOrders = transactions?.filter(t => t.module === 'services' && t.status === 'completed') || [];

  const handleRegisterService = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!firestore || !user?.companyId) return;
    const formData = new FormData(e.currentTarget);
    const serviceId = crypto.randomUUID();
    
    const newService: ServiceItem = {
      id: serviceId,
      companyId: user.companyId,
      name: formData.get('name') as string,
      basePrice: Number(formData.get('basePrice')),
      estimatedProfit: Number(formData.get('estimatedProfit')) || 0
    };

    try {
      await setDoc(doc(firestore, 'companies', user.companyId, 'serviceItems', serviceId), newService);
      toast({ title: "Service Created", description: `${newService.name} added to catalog.` });
      (e.target as HTMLFormElement).reset();
    } catch (e) {
      toast({ title: "Creation failed", variant: "destructive" });
    }
  };

  const handlePlaceOrder = async (service: ServiceItem) => {
    if (!firestore || !user?.companyId) return;
    setIsProcessing(true);

    try {
      const transactionId = crypto.randomUUID();
      const transactionData: SaleTransaction = {
        id: transactionId,
        companyId: user.companyId,
        module: 'services',
        totalAmount: service.basePrice,
        profit: service.estimatedProfit,
        timestamp: new Date().toISOString(),
        items: [{ name: `Service: ${service.name}`, price: service.basePrice, quantity: 1 }],
        status: 'pending'
      };

      await setDoc(doc(firestore, 'companies', user.companyId, 'transactions', transactionId), transactionData);
      toast({ title: "Order Placed", description: `${service.name} is now pending.` });
    } catch (e) {
      toast({ title: "Order failed", variant: "destructive" });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCompleteOrder = async (transactionId: string) => {
    if (!firestore || !user?.companyId) return;
    try {
      await updateDoc(doc(firestore, 'companies', user.companyId, 'transactions', transactionId), { status: 'completed' });
      toast({ title: "Order Completed", description: "Service delivered and closed." });
    } catch (e) {
      toast({ title: "Update failed", variant: "destructive" });
    }
  };

  const handleDeleteService = async (serviceId: string) => {
    if (!firestore || !user?.companyId) return;
    try {
      await deleteDoc(doc(firestore, 'companies', user.companyId, 'serviceItems', serviceId));
      toast({ title: "Service Removed" });
    } catch (e) {
      toast({ title: "Deletion failed", variant: "destructive" });
    }
  };

  return (
    <div className="flex h-screen bg-background font-body">
      <Sidebar />
      <main className="flex-1 overflow-auto p-8">
        <div className="mb-8">
          <h1 className="text-3xl font-black font-headline text-foreground">Services Module</h1>
          <p className="text-muted-foreground">Manage Specialized Orders, Deliveries & Service Profits</p>
        </div>

        <Tabs defaultValue="catalog" className="space-y-6">
          <TabsList className="bg-white/50 border p-1 rounded-xl">
            <TabsTrigger value="catalog" className="rounded-lg gap-2">
              <ClipboardList className="w-4 h-4" /> Service Catalog
            </TabsTrigger>
            <TabsTrigger value="orders" className="rounded-lg gap-2">
              <Clock className="w-4 h-4" /> Order Tracking
              {pendingOrders.length > 0 && <Badge className="ml-2 h-5 w-5 p-0 flex items-center justify-center rounded-full">{pendingOrders.length}</Badge>}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="catalog" className="grid grid-cols-1 lg:grid-cols-4 gap-8">
            <Card className="lg:col-span-1 border-none shadow-sm rounded-2xl bg-white h-fit">
               <CardHeader>
                 <CardTitle>Define Service</CardTitle>
                 <CardDescription>Add specialized expertise to catalog</CardDescription>
               </CardHeader>
               <CardContent>
                 <form onSubmit={handleRegisterService} className="space-y-4">
                   <div className="space-y-1.5">
                     <label className="text-[10px] font-black uppercase text-muted-foreground px-1">Service Name</label>
                     <Input name="name" placeholder="IT Repair" required className="rounded-xl bg-secondary/20 border-none h-12" />
                   </div>
                   <div className="space-y-1.5">
                     <label className="text-[10px] font-black uppercase text-muted-foreground px-1">Base Charge ($)</label>
                     <Input name="basePrice" type="number" step="0.01" required className="rounded-xl bg-secondary/20 border-none h-12" />
                   </div>
                   <div className="space-y-1.5">
                     <label className="text-[10px] font-black uppercase text-muted-foreground px-1">Estimated Profit ($)</label>
                     <Input name="estimatedProfit" type="number" step="0.01" className="rounded-xl bg-secondary/20 border-none h-12" />
                   </div>
                   <Button type="submit" className="w-full h-12 font-black rounded-xl shadow-lg mt-4">Add to Catalog</Button>
                 </form>
               </CardContent>
            </Card>

            <div className="lg:col-span-3 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {serviceItems?.map(service => (
                  <Card key={service.id} className="border-none shadow-sm rounded-2xl bg-white relative overflow-hidden group hover:shadow-md transition-all">
                    <CardHeader className="pb-2">
                      <div className="w-10 h-10 bg-secondary/50 rounded-xl flex items-center justify-center text-primary mb-2">
                        <Wrench className="w-5 h-5" />
                      </div>
                      <CardTitle className="text-lg font-black">{service.name}</CardTitle>
                    </CardHeader>
                    <CardContent>
                       <p className="text-2xl font-black text-primary">${service.basePrice.toFixed(2)}</p>
                       <div className="flex justify-between items-center mt-6">
                         <Button onClick={() => handlePlaceOrder(service)} disabled={isProcessing} size="sm" className="rounded-xl font-black px-6">
                           Place Order
                         </Button>
                         <Button variant="ghost" size="icon" onClick={() => handleDeleteService(service.id)} className="text-destructive hover:bg-destructive/5">
                            <Trash2 className="w-4 h-4" />
                         </Button>
                       </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="orders" className="space-y-8">
             <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Pending Orders */}
                <Card className="border-none shadow-sm rounded-3xl bg-white overflow-hidden">
                   <CardHeader className="bg-orange-50/50 border-b">
                      <CardTitle className="text-lg font-black flex items-center gap-2">
                        <Clock className="w-5 h-5 text-orange-600" /> Pending Work
                      </CardTitle>
                   </CardHeader>
                   <CardContent className="p-6">
                      <div className="space-y-4">
                        {pendingOrders.map(order => (
                          <div key={order.id} className="flex items-center justify-between p-4 rounded-2xl bg-secondary/10 group">
                             <div>
                                <p className="font-black text-foreground">{order.items[0].name}</p>
                                <p className="text-[10px] text-muted-foreground font-bold">{new Date(order.timestamp).toLocaleString()}</p>
                             </div>
                             <div className="flex items-center gap-3">
                                <p className="font-black text-primary">${order.totalAmount.toFixed(2)}</p>
                                <Button size="sm" variant="outline" onClick={() => handleCompleteOrder(order.id)} className="rounded-xl font-bold border-2 text-[10px] h-8">
                                  Mark Done
                                </Button>
                             </div>
                          </div>
                        ))}
                        {pendingOrders.length === 0 && (
                          <div className="py-12 text-center text-muted-foreground opacity-50">
                             <CheckCircle2 className="w-12 h-12 mx-auto mb-2" />
                             <p className="font-bold">No pending service orders.</p>
                          </div>
                        )}
                      </div>
                   </CardContent>
                </Card>

                {/* Completed Orders */}
                <Card className="border-none shadow-sm rounded-3xl bg-white overflow-hidden">
                   <CardHeader className="bg-green-50/50 border-b">
                      <CardTitle className="text-lg font-black flex items-center gap-2">
                        <CheckCircle2 className="w-5 h-5 text-green-600" /> Service History
                      </CardTitle>
                   </CardHeader>
                   <CardContent className="p-6">
                      <div className="space-y-4">
                        {completedOrders.slice(0, 10).map(order => (
                          <div key={order.id} className="flex items-center justify-between p-4 rounded-2xl bg-secondary/10">
                             <div>
                                <p className="font-black text-foreground">{order.items[0].name}</p>
                                <p className="text-[10px] text-muted-foreground font-bold">{new Date(order.timestamp).toLocaleString()}</p>
                             </div>
                             <p className="font-black text-green-600">+${order.totalAmount.toFixed(2)}</p>
                          </div>
                        ))}
                      </div>
                   </CardContent>
                </Card>
             </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
