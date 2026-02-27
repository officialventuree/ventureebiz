
'use client';

import { Sidebar } from '@/components/layout/sidebar';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CalendarDays, Plus, Search, History, CheckCircle2, Clock, Trash2, ArrowRightLeft, User } from 'lucide-react';
import { useAuth } from '@/components/auth-context';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, doc, setDoc, deleteDoc, updateDoc } from 'firebase/firestore';
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
  const [selectedItem, setSelectedItem] = useState<RentalItem | null>(null);
  const [duration, setDuration] = useState(1);

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
    
    const newItem: RentalItem = {
      id: itemId,
      companyId: user.companyId,
      name: formData.get('name') as string,
      dailyRate: Number(formData.get('dailyRate')),
      hourlyRate: Number(formData.get('hourlyRate')) || 0,
      status: 'available'
    };

    try {
      await setDoc(doc(firestore, 'companies', user.companyId, 'rentalItems', itemId), newItem);
      toast({ title: "Item Registered", description: `${newItem.name} is now available.` });
      (e.target as HTMLFormElement).reset();
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
    const totalAmount = selectedItem.dailyRate * duration;

    try {
      const transactionId = crypto.randomUUID();
      const transactionData: SaleTransaction = {
        id: transactionId,
        companyId: user.companyId,
        module: 'rent',
        totalAmount,
        profit: totalAmount * 0.95, // High margin for rental
        timestamp: new Date().toISOString(),
        customerName,
        status: 'in-progress',
        items: [{ 
          name: selectedItem.name, 
          price: selectedItem.dailyRate, 
          quantity: 1, 
          duration,
          startDate: new Date().toISOString(),
          endDate: new Date(Date.now() + duration * 24 * 60 * 60 * 1000).toISOString()
        }]
      };

      await setDoc(doc(firestore, 'companies', user.companyId, 'transactions', transactionId), transactionData);
      await updateDoc(doc(firestore, 'companies', user.companyId, 'rentalItems', selectedItem.id), { status: 'rented' });

      toast({ title: "Agreement Launched", description: `Contract active for ${customerName}.` });
      setSelectedItem(null);
      setDuration(1);
    } catch (e) {
      toast({ title: "Launch failed", variant: "destructive" });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCheckIn = async (transactionId: string, itemId: string) => {
    if (!firestore || !user?.companyId) return;
    try {
      await updateDoc(doc(firestore, 'companies', user.companyId, 'transactions', transactionId), { status: 'completed' });
      const itemToUpdate = rentalItems?.find(i => i.name === transactions?.find(t => t.id === transactionId)?.items[0].name);
      if (itemToUpdate) {
        await updateDoc(doc(firestore, 'companies', user.companyId, 'rentalItems', itemToUpdate.id), { status: 'available' });
      }
      toast({ title: "Asset Returned", description: "Item is back in inventory." });
    } catch (e) {
      toast({ title: "Return failed", variant: "destructive" });
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
          <h1 className="text-3xl font-black font-headline text-foreground tracking-tight">Rent Module</h1>
          <p className="text-muted-foreground font-medium">Agreement Creator & Workflow Management</p>
        </div>

        <Tabs defaultValue="workflow" className="space-y-6">
          <TabsList className="bg-white/50 border p-1 rounded-xl">
            <TabsTrigger value="workflow" className="rounded-lg gap-2">
              <ArrowRightLeft className="w-4 h-4" /> Active Workflow
            </TabsTrigger>
            <TabsTrigger value="pos" className="rounded-lg gap-2">
              <CalendarDays className="w-4 h-4" /> Agreement Creator
            </TabsTrigger>
            <TabsTrigger value="registry" className="rounded-lg gap-2">
              <Plus className="w-4 h-4" /> Asset Registry
            </TabsTrigger>
          </TabsList>

          <TabsContent value="workflow" className="space-y-6">
            <div className="grid grid-cols-1 gap-4">
              <h3 className="font-black text-lg flex items-center gap-2">
                <Clock className="w-5 h-5 text-primary" /> Active Leasing Pipeline
              </h3>
              {activeRentals.map(rental => (
                <Card key={rental.id} className="border-none shadow-sm rounded-2xl bg-white overflow-hidden group">
                  <CardContent className="p-6 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center text-primary">
                        <CalendarDays className="w-6 h-6" />
                      </div>
                      <div>
                        <p className="font-black text-foreground text-lg">{rental.items[0].name}</p>
                        <div className="flex items-center gap-2 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                          <User className="w-3 h-3" /> {rental.customerName} | Due: {new Date(rental.items[0].endDate!).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-6">
                       <div className="text-right">
                          <p className="text-[10px] font-black text-muted-foreground uppercase">Revenue</p>
                          <p className="text-xl font-black text-primary">${rental.totalAmount.toFixed(2)}</p>
                       </div>
                       <Button onClick={() => handleCheckIn(rental.id, '')} className="rounded-xl font-black h-12 px-6">Mark Returned</Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
              {activeRentals.length === 0 && (
                <div className="py-20 text-center border-2 border-dashed rounded-3xl bg-white/50">
                   <Clock className="w-12 h-12 mx-auto mb-2 opacity-10" />
                   <p className="font-bold text-muted-foreground">No active rentals found.</p>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="pos" className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-4">
              <div className="relative group">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input 
                  placeholder="Filter available inventory..." 
                  className="pl-10 h-12 rounded-xl bg-white border-none shadow-sm font-bold"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredItems?.filter(i => i.status === 'available').map(item => (
                  <Card 
                    key={item.id} 
                    className={cn(
                      "border-2 transition-all cursor-pointer rounded-2xl overflow-hidden",
                      selectedItem?.id === item.id ? "border-primary bg-primary/5" : "border-transparent bg-white shadow-sm"
                    )}
                    onClick={() => setSelectedItem(item)}
                  >
                    <CardContent className="p-6">
                      <p className="font-black text-foreground text-lg">{item.name}</p>
                      <p className="text-2xl font-black text-primary mt-2">${item.dailyRate}/day</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>

            <Card className="lg:col-span-1 border-none shadow-xl bg-white rounded-3xl h-fit sticky top-8">
              <CardHeader>
                <CardTitle className="text-lg font-black">Agreement Creator</CardTitle>
                <CardDescription className="font-bold text-xs uppercase tracking-tight">Contract Details & Pricing</CardDescription>
              </CardHeader>
              <CardContent>
                {selectedItem ? (
                  <form onSubmit={handleCreateAgreement} className="space-y-6">
                    <div className="p-4 bg-secondary/20 rounded-2xl">
                      <p className="text-[10px] font-black text-muted-foreground uppercase">Selected Asset</p>
                      <p className="font-black text-foreground">{selectedItem.name}</p>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black uppercase text-muted-foreground px-1">Customer Full Name</label>
                      <Input name="customer" placeholder="Jane Doe" required className="h-12 rounded-xl bg-secondary/10 border-none font-bold" />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black uppercase text-muted-foreground px-1">Duration (Days)</label>
                      <Input 
                        type="number" 
                        min="1" 
                        value={duration} 
                        onChange={(e) => setDuration(Number(e.target.value))}
                        className="h-12 rounded-xl bg-secondary/10 border-none font-bold"
                      />
                    </div>
                    <div className="pt-4 border-t flex justify-between items-end">
                       <div>
                         <p className="text-[10px] font-black text-muted-foreground uppercase">Total Contract Value</p>
                         <p className="text-3xl font-black text-primary">${(selectedItem.dailyRate * duration).toFixed(2)}</p>
                       </div>
                       <Button type="submit" disabled={isProcessing} className="h-12 px-8 rounded-xl font-black shadow-lg">Launch Agreement</Button>
                    </div>
                  </form>
                ) : (
                  <div className="py-20 text-center opacity-30">
                    <CalendarDays className="w-12 h-12 mx-auto mb-2" />
                    <p className="text-sm font-bold">Select an asset to begin</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="registry" className="grid grid-cols-1 lg:grid-cols-4 gap-8">
             <Card className="lg:col-span-1 border-none shadow-sm rounded-2xl bg-white h-fit">
                <CardHeader>
                  <CardTitle className="text-lg font-black">Asset Registry</CardTitle>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleRegisterItem} className="space-y-4">
                    <Input name="name" placeholder="Item Name (e.g. Sony A7 III)" required className="rounded-xl h-12" />
                    <Input name="dailyRate" type="number" step="0.01" placeholder="Daily Rate ($)" required className="rounded-xl h-12" />
                    <Input name="hourlyRate" type="number" step="0.01" placeholder="Hourly Rate (Optional)" className="rounded-xl h-12" />
                    <Button type="submit" className="w-full h-12 font-black rounded-xl">Add to Pool</Button>
                  </form>
                </CardContent>
             </Card>

             <div className="lg:col-span-3 space-y-4">
                <div className="bg-white rounded-3xl border shadow-sm overflow-hidden">
                   <table className="w-full text-sm text-left">
                     <thead className="bg-secondary/20 border-b">
                       <tr>
                         <th className="p-4 font-black uppercase text-muted-foreground tracking-tighter">Information</th>
                         <th className="p-4 font-black uppercase text-muted-foreground tracking-tighter">Pricing</th>
                         <th className="p-4 font-black uppercase text-muted-foreground tracking-tighter">Status</th>
                         <th className="p-4 text-center font-black uppercase text-muted-foreground tracking-tighter">Action</th>
                       </tr>
                     </thead>
                     <tbody className="divide-y">
                       {rentalItems?.map(item => (
                         <tr key={item.id} className="hover:bg-secondary/5 transition-colors">
                           <td className="p-4">
                              <p className="font-black text-foreground">{item.name}</p>
                              <p className="text-[10px] text-muted-foreground font-mono">#{item.id.split('-')[0]}</p>
                           </td>
                           <td className="p-4">
                              <p className="font-bold text-primary">${item.dailyRate}/day</p>
                           </td>
                           <td className="p-4">
                              <Badge variant={item.status === 'available' ? 'outline' : 'destructive'} className="font-black uppercase text-[9px] tracking-widest">
                                {item.status}
                              </Badge>
                           </td>
                           <td className="p-4 text-center">
                              <Button variant="ghost" size="icon" onClick={() => handleDeleteItem(item.id)} className="text-destructive hover:bg-destructive/5 rounded-full">
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
        </Tabs>
      </main>
    </div>
  );
}
