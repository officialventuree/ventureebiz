
'use client';

import { Sidebar } from '@/components/layout/sidebar';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Wrench, Plus, Search, ClipboardList, CheckCircle2, Clock, Trash2, TrendingUp, Play, Package } from 'lucide-react';
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

  const pipeline = {
    pending: transactions?.filter(t => t.module === 'services' && t.status === 'pending') || [],
    inProgress: transactions?.filter(t => t.module === 'services' && t.status === 'in-progress') || [],
    completed: transactions?.filter(t => t.module === 'services' && t.status === 'completed') || []
  };

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

  const handlePlaceOrder = async (service: ServiceItem, customerName: string) => {
    if (!firestore || !user?.companyId || !customerName) return;
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
        customerName,
        items: [{ name: service.name, price: service.basePrice, quantity: 1 }],
        status: 'pending'
      };

      await setDoc(doc(firestore, 'companies', user.companyId, 'transactions', transactionId), transactionData);
      toast({ title: "Order Logged", description: `Order pending for ${customerName}.` });
    } catch (e) {
      toast({ title: "Order failed", variant: "destructive" });
    } finally {
      setIsProcessing(false);
    }
  };

  const updateStatus = async (id: string, newStatus: string) => {
    if (!firestore || !user?.companyId) return;
    try {
      await updateDoc(doc(firestore, 'companies', user.companyId, 'transactions', id), { status: newStatus });
      toast({ title: "Pipeline Updated", description: `Order moved to ${newStatus}.` });
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
          <h1 className="text-3xl font-black font-headline text-foreground tracking-tight">Services Pipeline</h1>
          <p className="text-muted-foreground font-medium">Order Tracking & Fulfillment Workflow</p>
        </div>

        <Tabs defaultValue="pipeline" className="space-y-6">
          <TabsList className="bg-white/50 border p-1 rounded-xl">
            <TabsTrigger value="pipeline" className="rounded-lg gap-2">
              <Package className="w-4 h-4" /> Full Pipeline
            </TabsTrigger>
            <TabsTrigger value="catalog" className="rounded-lg gap-2">
              <ClipboardList className="w-4 h-4" /> Service Catalog
            </TabsTrigger>
          </TabsList>

          <TabsContent value="pipeline" className="grid grid-cols-1 lg:grid-cols-3 gap-8">
             {/* Pending */}
             <div className="space-y-4">
                <h3 className="text-sm font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" /> Pending Orders
                </h3>
                <div className="space-y-4">
                   {pipeline.pending.map(order => (
                     <PipelineCard key={order.id} order={order} onAction={() => updateStatus(order.id, 'in-progress')} actionLabel="Start Work" actionIcon={Play} />
                   ))}
                   {pipeline.pending.length === 0 && <EmptyPipelineLabel />}
                </div>
             </div>

             {/* In Progress */}
             <div className="space-y-4">
                <h3 className="text-sm font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-primary animate-pulse" /> In-Progress
                </h3>
                <div className="space-y-4">
                   {pipeline.inProgress.map(order => (
                     <PipelineCard key={order.id} order={order} onAction={() => updateStatus(order.id, 'completed')} actionLabel="Complete" actionIcon={CheckCircle2} />
                   ))}
                   {pipeline.inProgress.length === 0 && <EmptyPipelineLabel />}
                </div>
             </div>

             {/* Completed */}
             <div className="space-y-4">
                <h3 className="text-sm font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2 text-green-600">
                  <CheckCircle2 className="w-4 h-4" /> Delivered Today
                </h3>
                <div className="space-y-4">
                   {pipeline.completed.slice(0, 5).map(order => (
                     <PipelineCard key={order.id} order={order} completed />
                   ))}
                   {pipeline.completed.length === 0 && <EmptyPipelineLabel />}
                </div>
             </div>
          </TabsContent>

          <TabsContent value="catalog" className="grid grid-cols-1 lg:grid-cols-4 gap-8">
            <Card className="lg:col-span-1 border-none shadow-sm rounded-2xl bg-white h-fit">
               <CardHeader>
                 <CardTitle className="text-lg font-black">Define Service</CardTitle>
               </CardHeader>
               <CardContent>
                 <form onSubmit={handleRegisterService} className="space-y-4">
                   <Input name="name" placeholder="Service (e.g. Phone Repair)" required className="rounded-xl h-12" />
                   <Input name="basePrice" type="number" step="0.01" placeholder="Fee ($)" required className="rounded-xl h-12" />
                   <Input name="estimatedProfit" type="number" step="0.01" placeholder="Net Profit ($)" className="rounded-xl h-12" />
                   <Button type="submit" className="w-full h-12 font-black rounded-xl">Add to Catalog</Button>
                 </form>
               </CardContent>
            </Card>

            <div className="lg:col-span-3 grid grid-cols-1 md:grid-cols-2 gap-4">
                {serviceItems?.map(service => (
                  <Card key={service.id} className="border-none shadow-sm rounded-2xl bg-white group hover:shadow-md transition-all">
                    <CardHeader className="pb-2 flex flex-row justify-between items-start">
                      <div>
                        <CardTitle className="text-lg font-black">{service.name}</CardTitle>
                        <p className="text-2xl font-black text-primary mt-1">${service.basePrice.toFixed(2)}</p>
                      </div>
                      <Button variant="ghost" size="icon" onClick={() => handleDeleteService(service.id)} className="text-destructive opacity-0 group-hover:opacity-100 transition-opacity">
                         <Trash2 className="w-4 h-4" />
                      </Button>
                    </CardHeader>
                    <CardContent>
                       <form onSubmit={(e) => {
                         e.preventDefault();
                         const name = new FormData(e.currentTarget).get('customer') as string;
                         handlePlaceOrder(service, name);
                         (e.target as HTMLFormElement).reset();
                       }} className="flex gap-2">
                         <Input name="customer" placeholder="Customer Name" required className="h-10 rounded-xl bg-secondary/10 border-none text-xs font-bold" />
                         <Button type="submit" size="sm" className="rounded-xl font-black px-4">Log Order</Button>
                       </form>
                    </CardContent>
                  </Card>
                ))}
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

function PipelineCard({ order, onAction, actionLabel, actionIcon: Icon, completed }: any) {
  return (
    <Card className={cn(
      "border-none shadow-sm rounded-2xl",
      completed ? "bg-green-50/30" : "bg-white"
    )}>
      <CardContent className="p-5">
        <div className="flex justify-between items-start mb-4">
           <div>
             <p className="font-black text-foreground">{order.items[0].name}</p>
             <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{order.customerName}</p>
           </div>
           <p className="font-black text-primary">${order.totalAmount.toFixed(2)}</p>
        </div>
        {!completed && (
          <Button onClick={onAction} className="w-full h-10 rounded-xl font-black gap-2 text-xs">
            <Icon className="w-3.5 h-3.5" /> {actionLabel}
          </Button>
        )}
        {completed && (
          <div className="flex items-center gap-2 text-[10px] font-black text-green-600 uppercase tracking-widest">
            <CheckCircle2 className="w-4 h-4" /> Fulfilled
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function EmptyPipelineLabel() {
  return (
    <div className="py-12 text-center border-2 border-dashed rounded-3xl bg-secondary/5 opacity-30">
       <p className="text-xs font-bold">Queue empty</p>
    </div>
  );
}
