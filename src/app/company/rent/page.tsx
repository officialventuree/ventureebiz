
'use client';

import { Sidebar } from '@/components/layout/sidebar';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CalendarDays, Plus, Search, History, CheckCircle2, AlertCircle, Clock, Trash2 } from 'lucide-react';
import { useAuth } from '@/components/auth-context';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, doc, setDoc, deleteDoc, addDoc, updateDoc } from 'firebase/firestore';
import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RentalItem, SaleTransaction } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

export default function RentPage() {
  const { user } = useAuth();
  const firestore = useFirestore();
  const { toast } = useToast();
  const [isProcessing, setIsProcessing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

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

  const handleRegisterItem = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!firestore || !user?.companyId) return;
    const formData = new FormData(e.currentTarget);
    const itemId = crypto.randomUUID();
    
    const newItem: RentalItem = {
      id: itemId,
      companyId: user.companyId,
      name: formData.get('name') as string,
      dailyRate: Number(formData.get('dailyRate')),
      hourlyRate: Number(formData.get('hourlyRate')),
      status: 'available'
    };

    try {
      await setDoc(doc(firestore, 'companies', user.companyId, 'rentalItems', itemId), newItem);
      toast({ title: "Item Registered", description: `${newItem.name} is now available for rent.` });
      (e.target as HTMLFormElement).reset();
    } catch (e) {
      toast({ title: "Registration failed", variant: "destructive" });
    }
  };

  const handleRentOut = async (item: RentalItem) => {
    if (!firestore || !user?.companyId) return;
    setIsProcessing(true);

    try {
      const transactionId = crypto.randomUUID();
      const transactionData: SaleTransaction = {
        id: transactionId,
        companyId: user.companyId,
        module: 'rent',
        totalAmount: item.dailyRate,
        profit: item.dailyRate * 0.9, // 90% profit margin assumed for rent
        timestamp: new Date().toISOString(),
        items: [{ name: `Rental: ${item.name}`, price: item.dailyRate, quantity: 1 }],
        status: 'completed'
      };

      await setDoc(doc(firestore, 'companies', user.companyId, 'transactions', transactionId), transactionData);
      await updateDoc(doc(firestore, 'companies', user.companyId, 'rentalItems', item.id), { status: 'rented' });

      toast({ title: "Asset Rented", description: `${item.name} status updated to Rented.` });
    } catch (e) {
      toast({ title: "Transaction failed", variant: "destructive" });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReturnItem = async (itemId: string) => {
    if (!firestore || !user?.companyId) return;
    try {
      await updateDoc(doc(firestore, 'companies', user.companyId, 'rentalItems', itemId), { status: 'available' });
      toast({ title: "Asset Returned", description: "Item is now available again." });
    } catch (e) {
      toast({ title: "Update failed", variant: "destructive" });
    }
  };

  const handleDeleteItem = async (itemId: string) => {
    if (!firestore || !user?.companyId) return;
    try {
      await deleteDoc(doc(firestore, 'companies', user.companyId, 'rentalItems', itemId));
      toast({ title: "Item Removed" });
    } catch (e) {
      toast({ title: "Deletion failed", variant: "destructive" });
    }
  };

  return (
    <div className="flex h-screen bg-background font-body">
      <Sidebar />
      <main className="flex-1 overflow-auto p-8">
        <div className="mb-8">
          <h1 className="text-3xl font-black font-headline text-foreground">Rent Module</h1>
          <p className="text-muted-foreground">Manage Asset Leasing, Contracts & Availability</p>
        </div>

        <Tabs defaultValue="pos" className="space-y-6">
          <TabsList className="bg-white/50 border p-1 rounded-xl">
            <TabsTrigger value="pos" className="rounded-lg gap-2">
              <CalendarDays className="w-4 h-4" /> Rental POS
            </TabsTrigger>
            <TabsTrigger value="inventory" className="rounded-lg gap-2">
              <Plus className="w-4 h-4" /> Asset Registry
            </TabsTrigger>
            <TabsTrigger value="history" className="rounded-lg gap-2">
              <History className="w-4 h-4" /> History
            </TabsTrigger>
          </TabsList>

          <TabsContent value="pos" className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-6">
              <div className="flex gap-2 mb-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input 
                    placeholder="Search rental assets..." 
                    className="pl-10 h-12 rounded-xl bg-white shadow-sm border-none"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredItems?.map(item => (
                  <Card key={item.id} className="border-none shadow-sm rounded-2xl bg-white overflow-hidden group">
                    <CardHeader className="p-6 pb-2">
                      <div className="flex justify-between items-start">
                        <CardTitle className="text-lg font-black">{item.name}</CardTitle>
                        <Badge variant={item.status === 'available' ? 'default' : 'destructive'} className="uppercase font-black text-[10px]">
                          {item.status}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="p-6 pt-0">
                      <div className="flex justify-between items-end mt-4">
                        <div>
                          <p className="text-[10px] font-black text-muted-foreground uppercase">Daily Rate</p>
                          <p className="text-2xl font-black text-primary">${item.dailyRate.toFixed(2)}</p>
                        </div>
                        {item.status === 'available' ? (
                          <Button onClick={() => handleRentOut(item)} disabled={isProcessing} className="rounded-xl font-black px-6">
                            Rent Out
                          </Button>
                        ) : item.status === 'rented' ? (
                          <Button variant="outline" onClick={() => handleReturnItem(item.id)} className="rounded-xl font-black border-2">
                            Check In
                          </Button>
                        ) : null}
                      </div>
                    </CardContent>
                  </Card>
                ))}
                {(!filteredItems || filteredItems.length === 0) && (
                  <div className="col-span-full py-12 text-center text-muted-foreground border-2 border-dashed rounded-3xl">
                    <AlertCircle className="w-12 h-12 mx-auto mb-2 opacity-20" />
                    <p className="font-bold">No rental assets found matching your criteria.</p>
                  </div>
                )}
              </div>
            </div>

            <div className="lg:col-span-1 space-y-6">
               <Card className="border-none shadow-xl bg-primary text-primary-foreground rounded-3xl">
                  <CardHeader>
                    <CardTitle className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
                      <Clock className="w-4 h-4" /> Quick Insight
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="bg-white/10 p-4 rounded-2xl">
                      <p className="text-[10px] font-black opacity-60 uppercase">Currently Leased</p>
                      <p className="text-3xl font-black">{rentalItems?.filter(i => i.status === 'rented').length || 0}</p>
                    </div>
                    <div className="bg-white/10 p-4 rounded-2xl">
                      <p className="text-[10px] font-black opacity-60 uppercase">Available Assets</p>
                      <p className="text-3xl font-black">{rentalItems?.filter(i => i.status === 'available').length || 0}</p>
                    </div>
                  </CardContent>
               </Card>
            </div>
          </TabsContent>

          <TabsContent value="inventory" className="grid grid-cols-1 lg:grid-cols-4 gap-8">
             <Card className="lg:col-span-1 border-none shadow-sm rounded-2xl bg-white h-fit">
                <CardHeader>
                  <CardTitle>Register Asset</CardTitle>
                  <CardDescription>Add equipment to rental pool</CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleRegisterItem} className="space-y-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black uppercase text-muted-foreground px-1">Asset Name</label>
                      <Input name="name" placeholder="Projector XL" required className="rounded-xl bg-secondary/20 border-none h-12" />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black uppercase text-muted-foreground px-1">Daily Rate ($)</label>
                      <Input name="dailyRate" type="number" step="0.01" required className="rounded-xl bg-secondary/20 border-none h-12" />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black uppercase text-muted-foreground px-1">Hourly Rate ($)</label>
                      <Input name="hourlyRate" type="number" step="0.01" className="rounded-xl bg-secondary/20 border-none h-12" />
                    </div>
                    <Button type="submit" className="w-full h-12 font-black rounded-xl shadow-lg mt-4">Add Asset</Button>
                  </form>
                </CardContent>
             </Card>

             <div className="lg:col-span-3 space-y-4">
               <div className="bg-white rounded-3xl shadow-sm border overflow-hidden">
                 <table className="w-full text-sm text-left">
                   <thead className="bg-secondary/20 border-b">
                     <tr>
                       <th className="p-4 font-black uppercase text-muted-foreground tracking-tighter">Asset Info</th>
                       <th className="p-4 font-black uppercase text-muted-foreground tracking-tighter">Rates</th>
                       <th className="p-4 font-black uppercase text-muted-foreground tracking-tighter">Status</th>
                       <th className="p-4 text-center font-black uppercase text-muted-foreground tracking-tighter">Action</th>
                     </tr>
                   </thead>
                   <tbody className="divide-y">
                     {rentalItems?.map(item => (
                       <tr key={item.id} className="hover:bg-secondary/10 transition-colors">
                         <td className="p-4">
                            <p className="font-black text-foreground">{item.name}</p>
                            <p className="text-[10px] text-muted-foreground font-mono">#{item.id.split('-')[0]}</p>
                         </td>
                         <td className="p-4">
                            <p className="text-sm font-bold text-primary">${item.dailyRate}/day</p>
                            {item.hourlyRate && <p className="text-[10px] text-muted-foreground font-bold">${item.hourlyRate}/hr</p>}
                         </td>
                         <td className="p-4">
                            <Badge variant={item.status === 'available' ? 'outline' : 'destructive'} className="font-bold">
                              {item.status}
                            </Badge>
                         </td>
                         <td className="p-4 text-center">
                            <Button variant="ghost" size="icon" onClick={() => handleDeleteItem(item.id)} className="text-destructive hover:bg-destructive/5">
                               <Trash2 className="w-4 h-4" />
                            </Button>
                         </td>
                       </tr>
                     ))}
                   </tbody>
                 </table>
               </div>
             </div>
          </TabsContent>

          <TabsContent value="history">
             <Card className="border-none shadow-sm rounded-3xl bg-white overflow-hidden">
                <CardHeader>
                   <CardTitle>Recent Rental Contracts</CardTitle>
                </CardHeader>
                <CardContent>
                   <div className="space-y-4">
                      {transactions?.filter(t => t.module === 'rent').slice(0, 10).map(t => (
                        <div key={t.id} className="flex items-center justify-between p-4 rounded-2xl bg-secondary/10 hover:bg-secondary/20 transition-all group">
                           <div className="flex items-center gap-4">
                              <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center text-primary shadow-sm group-hover:scale-110 transition-transform">
                                 <CalendarDays className="w-6 h-6" />
                              </div>
                              <div>
                                 <p className="font-black text-foreground">{t.items[0].name}</p>
                                 <p className="text-[10px] text-muted-foreground font-bold">{new Date(t.timestamp).toLocaleString()}</p>
                              </div>
                           </div>
                           <p className="text-xl font-black text-primary">+${t.totalAmount.toFixed(2)}</p>
                        </div>
                      ))}
                      {(!transactions || transactions.filter(t => t.module === 'rent').length === 0) && (
                         <div className="py-20 text-center text-muted-foreground">
                            <History className="w-12 h-12 mx-auto mb-2 opacity-20" />
                            <p className="font-bold">No rental transactions recorded yet.</p>
                         </div>
                      )}
                   </div>
                </CardContent>
             </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
