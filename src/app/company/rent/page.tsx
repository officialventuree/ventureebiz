'use client';

import { Sidebar } from '@/components/layout/sidebar';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CalendarDays, Plus, Search, History, CheckCircle2, Clock, Trash2, ArrowRightLeft, User, LayoutGrid, Info, Settings2 } from 'lucide-react';
import { useAuth } from '@/components/auth-context';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, doc, setDoc, deleteDoc, updateDoc } from 'firebase/firestore';
import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RentalItem, SaleTransaction } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';

export default function RentPage() {
  const { user } = useAuth();
  const firestore = useFirestore();
  const { toast } = useToast();
  const [isProcessing, setIsProcessing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedItem, setSelectedItem] = useState<RentalItem | null>(null);
  const [duration, setDuration] = useState(1);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);

  const rentalItemsQuery = useMemoFirebase(() => {
    if (!firestore || !user?.companyId) return null;
    return collection(firestore, 'companies', user.companyId, 'rentalItems');
  }, [firestore, user?.companyId]);

  const transactionsQuery = useMemoFirebase(() => {
    if (!firestore || !user?.companyId) return null;
    return collection(firestore, 'companies', user.companyId, 'transactions');
  }, [firestore, user?.companyId]);

  const { data: rentalItems } = useCollection<RentalItem>(rentalItemsQuery);
  const { data: transactions } = useCollection<SaleTransaction>(transactionsQuery);

  const filteredItems = rentalItems?.filter(item => 
    item.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const activeRentals = transactions?.filter(t => t.module === 'rent' && t.status === 'in-progress') || [];

  const handleRegisterItem = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!firestore || !user?.companyId) return;
    const formData = new FormData(e.currentTarget);
    const itemId = crypto.randomUUID();
    const unit = formData.get('unit') as 'hour' | 'day' | 'month';
    const rate = Number(formData.get('rate'));
    
    const newItem: RentalItem = {
      id: itemId,
      companyId: user.companyId,
      name: formData.get('name') as string,
      unit,
      dailyRate: unit === 'day' ? rate : undefined,
      hourlyRate: unit === 'hour' ? rate : undefined,
      monthlyRate: unit === 'month' ? rate : undefined,
      status: 'available'
    };

    try {
      await setDoc(doc(firestore, 'companies', user.companyId, 'rentalItems', itemId), newItem);
      toast({ title: "Asset Registered", description: `${newItem.name} is now available for lease.` });
      setIsAddDialogOpen(false);
    } catch (e) {
      toast({ title: "Registration failed", variant: "destructive" });
    }
  };

  const handleCreateAgreement = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedItem || !firestore || !user?.companyId) return;
    setIsProcessing(true);

    const formData = new FormData(e.currentTarget);
    const customerName = formData.get('customer') as string;
    const rate = selectedItem.unit === 'day' ? selectedItem.dailyRate! : selectedItem.unit === 'month' ? selectedItem.monthlyRate! : selectedItem.hourlyRate!;
    const totalAmount = rate * duration;

    try {
      const transactionId = crypto.randomUUID();
      const transactionData: SaleTransaction = {
        id: transactionId,
        companyId: user.companyId,
        module: 'rent',
        totalAmount,
        profit: totalAmount * 0.95, 
        timestamp: new Date().toISOString(),
        customerName,
        status: 'in-progress',
        items: [{ 
          name: selectedItem.name, 
          price: rate, 
          quantity: 1, 
          duration,
          unit: selectedItem.unit,
          startDate: new Date().toISOString(),
          endDate: new Date(Date.now() + (duration * (selectedItem.unit === 'day' ? 24 : selectedItem.unit === 'month' ? 720 : 1) * 60 * 60 * 1000)).toISOString()
        }]
      };

      await setDoc(doc(firestore, 'companies', user.companyId, 'transactions', transactionId), transactionData);
      await updateDoc(doc(firestore, 'companies', user.companyId, 'rentalItems', selectedItem.id), { status: 'rented' });

      toast({ title: "Agreement Launched", description: `Active lease for ${customerName} recorded.` });
      setSelectedItem(null);
      setDuration(1);
    } catch (e) {
      toast({ title: "Launch failed", variant: "destructive" });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCheckIn = async (transactionId: string) => {
    if (!firestore || !user?.companyId) return;
    try {
      const transaction = transactions?.find(t => t.id === transactionId);
      if (!transaction) return;

      await updateDoc(doc(firestore, 'companies', user.companyId, 'transactions', transactionId), { status: 'completed' });
      
      const itemToUpdate = rentalItems?.find(i => i.name === transaction.items[0].name);
      if (itemToUpdate) {
        await updateDoc(doc(firestore, 'companies', user.companyId, 'rentalItems', itemToUpdate.id), { status: 'available' });
      }
      toast({ title: "Asset Returned", description: "Agreement fulfilled and item back in inventory." });
    } catch (e) {
      toast({ title: "Return failed", variant: "destructive" });
    }
  };

  const handleDeleteItem = async (itemId: string) => {
    if (!firestore || !user?.companyId) return;
    try {
      await deleteDoc(doc(firestore, 'companies', user.companyId, 'rentalItems', itemId));
      toast({ title: "Asset Removed" });
    } catch (e) {
      toast({ title: "Deletion failed", variant: "destructive" });
    }
  };

  return (
    <div className="flex h-screen bg-background font-body">
      <Sidebar />
      <main className="flex-1 overflow-auto p-8 flex flex-col">
        <div className="mb-8 flex justify-between items-end">
          <div>
            <h1 className="text-3xl font-black font-headline text-foreground tracking-tight">Leasing Terminal</h1>
            <p className="text-muted-foreground font-bold text-sm">Agreement Creator & Workflow Control</p>
          </div>
          <div className="flex gap-4">
             <Card className="p-3 border-none shadow-sm bg-white/50 flex items-center gap-3 rounded-2xl">
                <div className="w-10 h-10 bg-primary/20 rounded-xl flex items-center justify-center text-primary">
                   <Clock className="w-5 h-5" />
                </div>
                <div>
                   <p className="text-[10px] font-black uppercase text-muted-foreground leading-tight">Active Leases</p>
                   <p className="text-lg font-black text-foreground">{activeRentals.length}</p>
                </div>
             </Card>
          </div>
        </div>

        <Tabs defaultValue="workflow" className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="bg-white/50 border p-1 rounded-2xl shadow-sm self-start mb-6">
            <TabsTrigger value="workflow" className="rounded-xl px-6 gap-2">
              <ArrowRightLeft className="w-4 h-4" /> Active Workflow
            </TabsTrigger>
            <TabsTrigger value="pos" className="rounded-xl px-6 gap-2">
              <CalendarDays className="w-4 h-4" /> Agreement Creator
            </TabsTrigger>
            <TabsTrigger value="registry" className="rounded-xl px-6 gap-2">
              <LayoutGrid className="w-4 h-4" /> Asset Registry
            </TabsTrigger>
          </TabsList>

          <TabsContent value="workflow" className="flex-1 overflow-auto space-y-6">
            <div className="grid grid-cols-1 gap-4">
              {activeRentals.map(rental => (
                <Card key={rental.id} className="border-none shadow-sm rounded-[32px] bg-white overflow-hidden hover:shadow-md transition-shadow">
                  <CardContent className="p-8 flex items-center justify-between">
                    <div className="flex items-center gap-6">
                      <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center text-primary">
                        <CalendarDays className="w-8 h-8" />
                      </div>
                      <div>
                        <p className="font-black text-foreground text-2xl">{rental.items[0].name}</p>
                        <div className="flex items-center gap-4 mt-1">
                          <div className="flex items-center gap-2 text-[10px] font-black text-muted-foreground uppercase tracking-widest">
                            <User className="w-3.5 h-3.5" /> {rental.customerName}
                          </div>
                          <div className="flex items-center gap-2 text-[10px] font-black text-destructive uppercase tracking-widest">
                            <Clock className="w-3.5 h-3.5" /> Due: {new Date(rental.items[0].endDate!).toLocaleDateString()}
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-8">
                       <div className="text-right">
                          <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Contract Value</p>
                          <p className="text-3xl font-black text-primary">${rental.totalAmount.toFixed(2)}</p>
                       </div>
                       <Button onClick={() => handleCheckIn(rental.id)} className="rounded-2xl font-black h-14 px-8 shadow-lg">Return Asset</Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
              {activeRentals.length === 0 && (
                <div className="py-24 text-center border-4 border-dashed rounded-[40px] bg-white/50">
                   <Clock className="w-16 h-16 mx-auto mb-4 opacity-10" />
                   <p className="font-black text-muted-foreground text-lg uppercase tracking-widest">Pipeline Clear</p>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="pos" className="flex-1 overflow-hidden">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 h-full">
              <div className="lg:col-span-2 flex flex-col gap-4 overflow-hidden">
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-primary w-5 h-5" />
                  <Input 
                    placeholder="FILTER ASSETS BY NAME..." 
                    className="pl-16 h-16 rounded-2xl border-none bg-white shadow-lg text-xl font-black"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                <div className="flex-1 overflow-auto grid grid-cols-1 md:grid-cols-2 gap-4 pb-4">
                  {filteredItems?.filter(i => i.status === 'available').map(item => (
                    <Card 
                      key={item.id} 
                      className={cn(
                        "border-4 transition-all cursor-pointer rounded-[32px] overflow-hidden group hover:shadow-xl",
                        selectedItem?.id === item.id ? "border-primary bg-primary/5" : "border-transparent bg-white shadow-sm"
                      )}
                      onClick={() => setSelectedItem(item)}
                    >
                      <CardContent className="p-8">
                        <div className="flex justify-between items-start mb-4">
                           <div className="w-12 h-12 bg-secondary rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
                              <CalendarDays className="w-6 h-6 text-primary" />
                           </div>
                           <Badge variant="secondary" className="font-black uppercase text-[10px] tracking-widest">Available</Badge>
                        </div>
                        <p className="font-black text-foreground text-xl leading-tight">{item.name}</p>
                        <p className="text-3xl font-black text-primary mt-2">
                           ${(item.unit === 'day' ? item.dailyRate : item.unit === 'month' ? item.monthlyRate : item.hourlyRate)?.toFixed(2)}
                           <span className="text-sm font-bold text-muted-foreground uppercase tracking-widest">/{item.unit}</span>
                        </p>
                      </CardContent>
                    </Card>
                  ))}
                  {filteredItems?.filter(i => i.status === 'available').length === 0 && (
                    <div className="col-span-full py-20 text-center opacity-30">
                       <Info className="w-12 h-12 mx-auto mb-2" />
                       <p className="font-black text-lg">NO AVAILABLE ASSETS FOUND</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="lg:col-span-1 h-full">
                <Card className="h-full flex flex-col border-none shadow-2xl bg-white rounded-[40px] overflow-hidden">
                  <CardHeader className="bg-secondary/20 p-10">
                    <CardTitle className="flex items-center gap-3 font-black text-2xl">
                      <ArrowRightLeft className="w-7 h-7 text-primary" /> 
                      Agreement
                    </CardTitle>
                    <CardDescription className="font-bold text-xs uppercase tracking-tight">Contract Generation Terminal</CardDescription>
                  </CardHeader>
                  <CardContent className="flex-1 p-10">
                    {selectedItem ? (
                      <form id="agreement-form" onSubmit={handleCreateAgreement} className="space-y-8">
                        <div className="p-6 bg-primary/5 border-2 border-primary/10 rounded-3xl relative overflow-hidden group">
                          <div className="absolute -right-4 -top-4 opacity-5 group-hover:scale-110 transition-transform">
                             <CalendarDays className="w-32 h-32 text-primary" />
                          </div>
                          <p className="text-[10px] font-black text-primary uppercase tracking-widest mb-1">Target Asset</p>
                          <p className="text-xl font-black text-foreground leading-tight">{selectedItem.name}</p>
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-black uppercase text-muted-foreground px-2 tracking-widest">Client Name</label>
                          <Input name="customer" placeholder="John Doe" required className="h-14 rounded-2xl bg-secondary/30 border-none font-bold text-lg" />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-black uppercase text-muted-foreground px-2 tracking-widest">Duration ({selectedItem.unit}s)</label>
                          <Input 
                            type="number" 
                            min="1" 
                            value={duration} 
                            onChange={(e) => setDuration(Number(e.target.value))}
                            className="h-14 rounded-2xl bg-secondary/30 border-none font-black text-2xl"
                          />
                        </div>
                      </form>
                    ) : (
                      <div className="h-full flex flex-col items-center justify-center text-center opacity-30 space-y-4">
                        <CalendarDays className="w-20 h-20" />
                        <p className="font-black text-lg uppercase tracking-widest">Select an available<br/>asset to begin</p>
                      </div>
                    )}
                  </CardContent>
                  {selectedItem && (
                    <CardFooter className="flex-col gap-6 p-10 border-t bg-secondary/5">
                      <div className="w-full flex justify-between items-end">
                         <div>
                            <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1">Total Valuation</p>
                            <p className="text-5xl font-black text-primary tracking-tighter">
                              ${((selectedItem.unit === 'day' ? selectedItem.dailyRate! : selectedItem.unit === 'month' ? selectedItem.monthlyRate! : selectedItem.hourlyRate!) * duration).toFixed(2)}
                            </p>
                         </div>
                      </div>
                      <Button form="agreement-form" type="submit" disabled={isProcessing} className="w-full h-20 text-xl font-black rounded-3xl shadow-xl">
                        Launch Agreement
                      </Button>
                    </CardFooter>
                  )}
                </Card>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="registry" className="flex-1 overflow-hidden">
             <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 h-full">
               <Card className="lg:col-span-1 border-none shadow-sm rounded-[32px] bg-white h-fit p-8">
                  <div className="flex flex-col gap-6">
                    <div className="space-y-1">
                      <h3 className="text-xl font-black">Strategic Reserve</h3>
                      <p className="text-xs font-bold text-muted-foreground">Manage your rental pool inventory</p>
                    </div>
                    <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                      <DialogTrigger asChild>
                        <Button className="w-full h-14 rounded-2xl font-black shadow-lg">
                          <Plus className="w-5 h-5 mr-2" /> Register Asset
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="rounded-[40px] max-w-lg p-0 overflow-hidden border-none shadow-2xl bg-white">
                         <div className="bg-primary p-10 text-primary-foreground">
                            <DialogTitle className="text-3xl font-black tracking-tight">New Asset Registration</DialogTitle>
                            <DialogDescription className="text-primary-foreground/80 font-bold">Define billing logic and asset metadata</DialogDescription>
                         </div>
                         <form onSubmit={handleRegisterItem} className="p-10 space-y-8">
                           <div className="space-y-2">
                             <label className="text-[10px] font-black uppercase tracking-widest px-1">Legal Name / Model</label>
                             <Input name="name" placeholder="Sony Alpha 7 IV" required className="h-14 rounded-2xl font-bold bg-secondary/20 border-none" />
                           </div>
                           <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase tracking-widest px-1">Billing Cycle</label>
                                <Select name="unit" defaultValue="day">
                                  <SelectTrigger className="h-14 rounded-2xl bg-secondary/20 border-none font-bold">
                                    <SelectValue placeholder="Unit" />
                                  </SelectTrigger>
                                  <SelectContent className="rounded-xl font-bold">
                                    <SelectItem value="hour">Hourly</SelectItem>
                                    <SelectItem value="day">Daily</SelectItem>
                                    <SelectItem value="month">Monthly</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase tracking-widest px-1">Rate ($)</label>
                                <Input name="rate" type="number" step="0.01" placeholder="0.00" required className="h-14 rounded-2xl font-black bg-secondary/20 border-none text-lg" />
                              </div>
                           </div>
                           <Button type="submit" className="w-full h-16 rounded-[24px] font-black text-lg shadow-xl" disabled={isProcessing}>
                             Save to Registry
                           </Button>
                         </form>
                      </DialogContent>
                    </Dialog>
                    
                    <Separator />
                    
                    <div className="space-y-4">
                       <div className="flex justify-between items-center text-sm">
                          <span className="font-bold text-muted-foreground">Total Assets</span>
                          <span className="font-black">{rentalItems?.length || 0}</span>
                       </div>
                       <div className="flex justify-between items-center text-sm">
                          <span className="font-bold text-muted-foreground">In Use</span>
                          <span className="font-black text-primary">{activeRentals.length}</span>
                       </div>
                    </div>
                  </div>
               </Card>

               <div className="lg:col-span-3 space-y-4 overflow-hidden flex flex-col">
                  <div className="bg-white rounded-[40px] border shadow-sm overflow-hidden">
                     <table className="w-full text-sm text-left">
                       <thead className="bg-secondary/20 border-b">
                         <tr>
                           <th className="p-6 font-black uppercase text-[10px] tracking-widest text-muted-foreground">Asset Identity</th>
                           <th className="p-6 font-black uppercase text-[10px] tracking-widest text-muted-foreground">Billing Metrics</th>
                           <th className="p-6 font-black uppercase text-[10px] tracking-widest text-muted-foreground">Status</th>
                           <th className="p-6 text-center font-black uppercase text-[10px] tracking-widest text-muted-foreground">Action</th>
                         </tr>
                       </thead>
                       <tbody className="divide-y">
                         {rentalItems?.map(item => (
                           <tr key={item.id} className="hover:bg-secondary/5 transition-colors">
                             <td className="p-6">
                                <p className="font-black text-foreground text-lg">{item.name}</p>
                                <p className="text-[10px] text-muted-foreground font-mono uppercase tracking-tighter">REF: {item.id.split('-')[0]}</p>
                             </td>
                             <td className="p-6">
                                <div className="flex items-center gap-2">
                                  <p className="font-black text-primary text-xl">
                                    ${(item.unit === 'day' ? item.dailyRate : item.unit === 'month' ? item.monthlyRate : item.hourlyRate)?.toFixed(2)}
                                  </p>
                                  <Badge variant="outline" className="text-[9px] font-black uppercase">{item.unit}</Badge>
                                </div>
                             </td>
                             <td className="p-6">
                                <Badge variant={item.status === 'available' ? 'secondary' : 'destructive'} className="font-black uppercase text-[9px] tracking-widest rounded-lg">
                                  {item.status}
                                </Badge>
                             </td>
                             <td className="p-6 text-center">
                                <Button variant="ghost" size="icon" onClick={() => handleDeleteItem(item.id)} className="text-destructive hover:bg-destructive/10 rounded-full h-10 w-10">
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                             </td>
                           </tr>
                         ))}
                         {(!rentalItems || rentalItems.length === 0) && (
                           <tr>
                             <td colSpan={4} className="py-24 text-center opacity-30">
                               <LayoutGrid className="w-16 h-16 mx-auto mb-4" />
                               <p className="font-black text-lg">REGISTRY EMPTY</p>
                             </td>
                           </tr>
                         )}
                       </tbody>
                     </table>
                  </div>
               </div>
             </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
