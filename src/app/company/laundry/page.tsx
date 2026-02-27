'use client';

import { Sidebar } from '@/components/layout/sidebar';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Waves, UserPlus, CreditCard, Droplet, Search, History, Trash2, ArrowRightLeft, Info, TrendingUp, DollarSign, Wallet } from 'lucide-react';
import { useAuth } from '@/components/auth-context';
import { useFirestore, useCollection, useMemoFirebase, useDoc } from '@/firebase';
import { collection, doc, setDoc, addDoc, updateDoc, increment, deleteDoc } from 'firebase/firestore';
import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LaundryStudent, SaleTransaction, LaundryInventory } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';

export default function LaundryPage() {
  const { user } = useAuth();
  const firestore = useFirestore();
  const { toast } = useToast();
  const [matrixSearch, setMatrixSearch] = useState('');
  const [selectedStudent, setSelectedStudent] = useState<LaundryStudent | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const studentsQuery = useMemoFirebase(() => {
    if (!firestore || !user?.companyId) return null;
    return collection(firestore, 'companies', user.companyId, 'laundryStudents');
  }, [firestore, user?.companyId]);

  const transactionsQuery = useMemoFirebase(() => {
    if (!firestore || !user?.companyId) return null;
    return collection(firestore, 'companies', user.companyId, 'transactions');
  }, [firestore, user?.companyId]);

  const inventoryRef = useMemoFirebase(() => {
    if (!firestore || !user?.companyId) return null;
    return doc(firestore, 'companies', user.companyId, 'laundryInventory', 'soap');
  }, [firestore, user?.companyId]);

  const { data: students } = useCollection<LaundryStudent>(studentsQuery);
  const { data: transactions } = useCollection<SaleTransaction>(transactionsQuery);
  const { data: inventoryDoc } = useDoc<LaundryInventory>(inventoryRef);

  const mlPerWash = 50;
  const washRate = 5.00;

  const currentSoapMl = inventoryDoc?.soapStockMl || 0;
  const capacityMl = inventoryDoc?.capacityMl || 50000;
  const soapCostPerLitre = inventoryDoc?.soapCostPerLitre || 1.45;
  const soapUtilization = Math.min(100, (currentSoapMl / capacityMl) * 100);

  const handleRegisterStudent = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!firestore || !user?.companyId) return;
    const formData = new FormData(e.currentTarget);
    const studentId = crypto.randomUUID();
    const student = {
      id: studentId,
      companyId: user.companyId,
      name: formData.get('name') as string,
      matrixNumber: formData.get('matrix') as string,
      balance: Number(formData.get('initialBalance')) || 0,
    };

    try {
      await setDoc(doc(firestore, 'companies', user.companyId, 'laundryStudents', studentId), student);
      toast({ title: "Student Registered", description: `${student.name} added.` });
      (e.target as HTMLFormElement).reset();
    } catch (e) {
      toast({ title: "Registration failed", variant: "destructive" });
    }
  };

  const handleSearch = () => {
    const found = students?.find(s => s.matrixNumber === matrixSearch);
    if (found) {
      setSelectedStudent(found);
      toast({ title: "Student Found", description: found.name });
    } else {
      toast({ title: "No Record", description: "Matrix number not recognized.", variant: "destructive" });
      setSelectedStudent(null);
    }
  };

  const handleChargeLaundry = async () => {
    if (!selectedStudent || !firestore || !user?.companyId) return;
    setIsProcessing(true);

    if (selectedStudent.balance < washRate) {
      toast({ title: "Insufficient Funds", description: "Top-up required.", variant: "destructive" });
      setIsProcessing(false);
      return;
    }

    if (currentSoapMl < mlPerWash) {
       toast({ title: "Out of Soap", description: "Please refill soap inventory.", variant: "destructive" });
       setIsProcessing(false);
       return;
    }

    try {
      // 1. Deduct Student Balance
      const studentRef = doc(firestore, 'companies', user.companyId, 'laundryStudents', selectedStudent.id);
      await updateDoc(studentRef, { balance: increment(-washRate) });
      
      // 2. Deduct Soap Inventory
      if (inventoryRef) {
        await updateDoc(inventoryRef, { soapStockMl: increment(-mlPerWash) });
      }

      // 3. Record Transaction
      const soapCost = (mlPerWash / 1000) * soapCostPerLitre;
      const profit = washRate - soapCost;

      const transactionRef = collection(firestore, 'companies', user.companyId, 'transactions');
      await addDoc(transactionRef, {
        id: crypto.randomUUID(),
        companyId: user.companyId,
        module: 'laundry',
        totalAmount: washRate,
        profit: profit,
        timestamp: new Date().toISOString(),
        items: [{ name: 'Standard Wash', price: washRate, quantity: 1, soapUsedMl: mlPerWash }]
      });

      toast({ title: "Wash Recorded", description: `Charged $${washRate.toFixed(2)} to ${selectedStudent.name}. 50ml soap deducted.` });
      setSelectedStudent({ ...selectedStudent, balance: selectedStudent.balance - washRate });
    } catch (e) {
      toast({ title: "Processing Error", variant: "destructive" });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRestockSoap = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!firestore || !user?.companyId) return;
    const formData = new FormData(e.currentTarget);
    const amountLitres = Number(formData.get('litres'));
    const cost = Number(formData.get('cost'));
    const amountMl = amountLitres * 1000;

    try {
      if (!inventoryDoc) {
        await setDoc(doc(firestore, 'companies', user.companyId, 'laundryInventory', 'soap'), {
          id: 'soap',
          companyId: user.companyId,
          soapStockMl: amountMl,
          soapCostPerLitre: cost / amountLitres,
          capacityMl: 50000
        });
      } else {
        await updateDoc(doc(firestore, 'companies', user.companyId, 'laundryInventory', 'soap'), {
          soapStockMl: increment(amountMl),
          soapCostPerLitre: cost / amountLitres
        });
      }

      await addDoc(collection(firestore, 'companies', user.companyId, 'purchases'), {
        id: crypto.randomUUID(),
        companyId: user.companyId,
        amount: cost,
        description: `Laundry Restock: ${amountLitres}L Soap`,
        timestamp: new Date().toISOString()
      });

      toast({ title: "Inventory Updated", description: `Added ${amountLitres}L to stock.` });
      (e.target as HTMLFormElement).reset();
    } catch (e) {
      toast({ title: "Restock failed", variant: "destructive" });
    }
  };

  const handleDeleteStudent = async (id: string) => {
    if (!firestore || !user?.companyId) return;
    try {
      await deleteDoc(doc(firestore, 'companies', user.companyId, 'laundryStudents', id));
      toast({ title: "Record Deleted" });
    } catch (e) {
      toast({ title: "Deletion failed", variant: "destructive" });
    }
  };

  const laundryTransactions = transactions?.filter(t => t.module === 'laundry') || [];
  const totalRevenue = laundryTransactions.reduce((acc, t) => acc + t.totalAmount, 0);
  const totalProfit = laundryTransactions.reduce((acc, t) => acc + t.profit, 0);
  const totalSoapCost = totalRevenue - totalProfit;

  return (
    <div className="flex h-screen bg-background font-body">
      <Sidebar />
      <main className="flex-1 overflow-auto p-8">
        <div className="mb-8">
          <h1 className="text-3xl font-black font-headline text-foreground tracking-tight">Laundry Module</h1>
          <p className="text-muted-foreground font-medium">Student Subscriptions & Chemical Logistics</p>
        </div>

        <Tabs defaultValue="pos" className="space-y-6">
          <TabsList className="bg-white/50 border p-1 rounded-xl shadow-sm">
            <TabsTrigger value="pos" className="rounded-lg gap-2">
              <CreditCard className="w-4 h-4" /> Laundry POS
            </TabsTrigger>
            <TabsTrigger value="students" className="rounded-lg gap-2">
              <UserPlus className="w-4 h-4" /> Students
            </TabsTrigger>
            <TabsTrigger value="consumables" className="rounded-lg gap-2">
              <Droplet className="w-4 h-4" /> Consumables
            </TabsTrigger>
            <TabsTrigger value="profits" className="rounded-lg gap-2">
              <TrendingUp className="w-4 h-4" /> Profits
            </TabsTrigger>
          </TabsList>

          <TabsContent value="pos" className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-6">
              <Card className="border-none shadow-sm bg-white rounded-3xl overflow-hidden">
                <CardHeader className="bg-secondary/10 p-8">
                  <CardTitle className="text-xl font-black">Usage Terminal</CardTitle>
                  <CardDescription className="font-bold">Verify student identity and process washing charge</CardDescription>
                </CardHeader>
                <CardContent className="p-8 space-y-6">
                  <div className="flex gap-2">
                    <Input 
                      placeholder="SCAN STUDENT MATRIX..." 
                      className="h-16 rounded-2xl text-2xl font-black border-2 border-primary/20 bg-secondary/5"
                      value={matrixSearch}
                      onChange={(e) => setMatrixSearch(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                    />
                    <Button onClick={handleSearch} size="lg" className="rounded-2xl px-10 h-16 font-black text-lg">Search</Button>
                  </div>

                  {selectedStudent ? (
                    <div className="p-10 bg-primary/5 rounded-[32px] border-4 border-primary/10 space-y-8 relative overflow-hidden group">
                      <div className="absolute -right-8 -top-8 opacity-5 group-hover:scale-110 transition-transform">
                        <Waves className="w-48 h-48 text-primary" />
                      </div>
                      <div className="flex justify-between items-start relative z-10">
                        <div>
                          <p className="text-[10px] font-black text-primary uppercase tracking-widest mb-1">Subscriber Status: Active</p>
                          <h4 className="text-4xl font-black text-foreground tracking-tighter">{selectedStudent.name}</h4>
                          <p className="text-sm font-bold text-muted-foreground font-mono mt-1">Matrix: {selectedStudent.matrixNumber}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1">Account Balance</p>
                          <p className={cn(
                            "text-5xl font-black tracking-tighter",
                            selectedStudent.balance < washRate ? "text-destructive" : "text-primary"
                          )}>${selectedStudent.balance.toFixed(2)}</p>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Button className="h-16 rounded-2xl text-xl font-black shadow-xl" onClick={handleChargeLaundry} disabled={isProcessing || currentSoapMl < mlPerWash}>
                          {isProcessing ? "Processing..." : `Standard Wash ($${washRate.toFixed(2)})`}
                        </Button>
                        <Button variant="outline" className="h-16 rounded-2xl font-black bg-white border-2">
                          Print Last Receipt
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="py-24 text-center bg-secondary/10 rounded-[32px] border-4 border-dashed border-secondary/30">
                      <Search className="w-16 h-16 mx-auto mb-4 opacity-10" />
                      <p className="font-black text-muted-foreground uppercase tracking-widest">Ready to scan student matrix</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="border-none shadow-sm bg-white rounded-2xl overflow-hidden">
                <CardHeader className="bg-secondary/5 p-6 border-b">
                  <CardTitle className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
                    <History className="w-4 h-4 text-primary" /> Recent Usage History
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="divide-y">
                    {laundryTransactions.slice().reverse().slice(0, 5).map(t => (
                      <div key={t.id} className="flex items-center justify-between p-5 hover:bg-secondary/5 transition-colors">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center text-primary">
                            <Waves className="w-6 h-6" />
                          </div>
                          <div>
                            <p className="text-sm font-black text-foreground">Standard Wash</p>
                            <p className="text-[10px] text-muted-foreground font-bold">{new Date(t.timestamp).toLocaleString()}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-black text-primary text-lg">+${t.totalAmount.toFixed(2)}</p>
                          <p className="text-[10px] font-bold text-muted-foreground uppercase">Paid by Student</p>
                        </div>
                      </div>
                    ))}
                    {laundryTransactions.length === 0 && (
                      <p className="text-center py-12 text-muted-foreground text-sm font-bold uppercase opacity-30">No usage recorded yet.</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="lg:col-span-1 space-y-6">
              <Card className="bg-primary border-none shadow-2xl text-primary-foreground rounded-[32px] overflow-hidden relative">
                <div className="absolute top-0 right-0 p-8 opacity-10 rotate-12">
                   <Droplet className="w-32 h-32" />
                </div>
                <CardHeader className="p-8">
                  <CardTitle className="flex items-center gap-3 text-xl font-black">
                    <Droplet className="w-6 h-6" />
                    Soap Levels
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-8 pt-0 space-y-8 relative z-10">
                  <div className="space-y-3">
                    <div className="flex justify-between text-[10px] font-black uppercase tracking-widest opacity-80">
                      <span>Inventory Balance</span>
                      <span>{(currentSoapMl / 1000).toFixed(1)}L / {(capacityMl / 1000).toFixed(0)}L</span>
                    </div>
                    <Progress value={soapUtilization} className="h-4 bg-white/20" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-white/10 p-5 rounded-2xl backdrop-blur-sm">
                      <p className="text-[10px] font-black opacity-60 uppercase mb-1 tracking-widest">Dose / Wash</p>
                      <p className="text-2xl font-black">{mlPerWash}ml</p>
                    </div>
                    <div className="bg-white/10 p-5 rounded-2xl backdrop-blur-sm">
                      <p className="text-[10px] font-black opacity-60 uppercase mb-1 tracking-widest">Remaining</p>
                      <p className="text-2xl font-black">{Math.floor(currentSoapMl / mlPerWash)} <span className="text-xs">Washes</span></p>
                    </div>
                  </div>
                </CardContent>
                <CardFooter className="bg-black/10 p-6">
                   <Button variant="secondary" className="w-full h-12 font-black rounded-xl text-primary shadow-lg">Request Chemical Refill</Button>
                </CardFooter>
              </Card>

              <Card className="border-none shadow-sm bg-white rounded-2xl">
                <CardHeader className="p-6 pb-2">
                  <CardTitle className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Chemical Efficiency</CardTitle>
                </CardHeader>
                <CardContent className="p-6 space-y-4">
                  <div className="flex justify-between items-center text-sm font-bold">
                    <span className="text-muted-foreground">Current Cost/L</span>
                    <span className="text-foreground">${soapCostPerLitre.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm font-bold">
                    <span className="text-muted-foreground">Waste Factor</span>
                    <span className="text-green-600">0.02% (Optimal)</span>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="students">
             <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
               <Card className="lg:col-span-1 h-fit border-none shadow-sm rounded-3xl bg-white p-8">
                 <CardHeader className="px-0 pt-0">
                   <CardTitle className="text-xl font-black">Enroll Student</CardTitle>
                   <CardDescription className="font-bold">Mandatory washing subscription registry</CardDescription>
                 </CardHeader>
                 <CardContent className="px-0 pb-0">
                   <form onSubmit={handleRegisterStudent} className="space-y-5">
                     <div className="space-y-1.5">
                       <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest px-1">Full Name</label>
                       <Input name="name" placeholder="Alice Smith" required className="h-12 rounded-xl font-bold" />
                     </div>
                     <div className="space-y-1.5">
                       <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest px-1">Matrix No.</label>
                       <Input name="matrix" placeholder="2024-001" required className="h-12 rounded-xl font-bold" />
                     </div>
                     <div className="space-y-1.5">
                       <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest px-1">Initial Deposit ($)</label>
                       <Input name="initialBalance" type="number" placeholder="50.00" className="h-12 rounded-xl font-bold" />
                     </div>
                     <Button type="submit" className="w-full h-14 font-black rounded-2xl shadow-xl">Confirm Enrollment</Button>
                   </form>
                 </CardContent>
               </Card>

               <div className="lg:col-span-3 space-y-4">
                 <div className="flex justify-between items-end mb-2">
                    <h3 className="text-xl font-black text-foreground">Student Master Registry</h3>
                    <Badge variant="secondary" className="font-black px-4 py-1 rounded-full uppercase text-[10px]">{students?.length || 0} Records</Badge>
                 </div>
                 <div className="rounded-[32px] bg-white border shadow-sm overflow-hidden">
                   <table className="w-full text-sm text-left">
                     <thead className="bg-secondary/20 border-b">
                       <tr>
                         <th className="p-6 font-black uppercase text-[10px] text-muted-foreground tracking-widest">Subscriber Identity</th>
                         <th className="p-6 font-black uppercase text-[10px] text-muted-foreground tracking-widest">Matrix</th>
                         <th className="p-6 text-right font-black uppercase text-[10px] text-muted-foreground tracking-widest">Balance</th>
                         <th className="p-6 text-center font-black uppercase text-[10px] text-muted-foreground tracking-widest">Action</th>
                       </tr>
                     </thead>
                     <tbody className="divide-y">
                       {students?.map(s => (
                         <tr key={s.id} className="hover:bg-secondary/5 transition-colors">
                           <td className="p-6 font-black text-foreground text-lg">{s.name}</td>
                           <td className="p-6 font-mono text-muted-foreground font-bold">{s.matrixNumber}</td>
                           <td className="p-6 text-right">
                              <span className={cn(
                                "text-xl font-black tracking-tighter",
                                s.balance < 5 ? "text-destructive" : "text-primary"
                              )}>${s.balance.toFixed(2)}</span>
                           </td>
                           <td className="p-6 text-center">
                              <Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10 rounded-xl" onClick={() => handleDeleteStudent(s.id)}>
                                <Trash2 className="w-5 h-5" />
                              </Button>
                           </td>
                         </tr>
                       ))}
                       {(!students || students.length === 0) && (
                         <tr><td colSpan={4} className="py-24 text-center opacity-30 font-black uppercase text-xs tracking-widest">No active subscribers</td></tr>
                       )}
                     </tbody>
                   </table>
                 </div>
               </div>
             </div>
          </TabsContent>

          <TabsContent value="consumables">
             <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                <Card className="lg:col-span-1 h-fit border-none shadow-sm rounded-3xl bg-white p-8">
                  <CardHeader className="px-0 pt-0">
                    <CardTitle className="text-xl font-black">Refill Inventory</CardTitle>
                    <CardDescription className="font-bold">Record new soap supply procurement</CardDescription>
                  </CardHeader>
                  <CardContent className="px-0 pb-0">
                    <form onSubmit={handleRestockSoap} className="space-y-5">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest px-1">Quantity (Litres)</label>
                        <Input name="litres" type="number" placeholder="5" required className="h-12 rounded-xl font-bold" />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest px-1">Total Procurement Cost ($)</label>
                        <Input name="cost" type="number" step="0.01" placeholder="7.50" required className="h-12 rounded-xl font-bold" />
                      </div>
                      <Button type="submit" className="w-full h-14 font-black rounded-2xl shadow-xl">Apply to Stock</Button>
                    </form>
                  </CardContent>
                </Card>

                <div className="lg:col-span-3 space-y-8">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                     <Card className="p-10 border-none shadow-sm bg-primary text-primary-foreground rounded-[40px] relative overflow-hidden">
                        <Droplet className="absolute -right-4 -bottom-4 w-32 h-32 opacity-10" />
                        <p className="text-[10px] font-black uppercase tracking-widest opacity-60 mb-2">Live Soap Volume</p>
                        <h4 className="text-6xl font-black tracking-tighter">{(currentSoapMl / 1000).toFixed(2)}<span className="text-2xl ml-2">Litres</span></h4>
                        <div className="mt-8 flex items-center gap-4">
                           <div className="flex-1 bg-white/20 h-3 rounded-full overflow-hidden">
                              <div className="bg-white h-full" style={{ width: `${soapUtilization}%` }} />
                           </div>
                           <span className="text-sm font-black">{soapUtilization.toFixed(0)}%</span>
                        </div>
                     </Card>
                     
                     <Card className="p-10 border-none shadow-sm bg-white rounded-[40px]">
                        <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest mb-2">Procurement Pricing</p>
                        <h4 className="text-6xl font-black tracking-tighter text-foreground">${soapCostPerLitre.toFixed(2)}<span className="text-2xl ml-2 text-muted-foreground">/ Litre</span></h4>
                        <p className="mt-4 text-sm font-bold text-muted-foreground">Weighted average based on latest restocking logs.</p>
                     </Card>
                  </div>

                  <div className="bg-white rounded-[32px] border p-10 flex items-center gap-8 shadow-sm">
                     <div className="w-20 h-20 bg-secondary/30 rounded-3xl flex items-center justify-center text-primary">
                        <Info className="w-10 h-10" />
                     </div>
                     <div className="flex-1">
                        <h4 className="text-xl font-black">Logistics Insights</h4>
                        <p className="text-sm font-bold text-muted-foreground leading-relaxed mt-1">
                          System automatically deducts {mlPerWash}ml per wash. Based on current inventory, you have enough soap for {Math.floor(currentSoapMl / mlPerWash)} standard washes before a critical refill is required.
                        </p>
                     </div>
                  </div>
                </div>
             </div>
          </TabsContent>

          <TabsContent value="profits">
             <div className="space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                   <Card className="p-10 border-none shadow-sm bg-white rounded-[40px]">
                      <div className="flex items-center gap-4 mb-4">
                         <div className="w-12 h-12 bg-secondary rounded-2xl flex items-center justify-center text-primary">
                            <DollarSign className="w-6 h-6" />
                         </div>
                         <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Gross Revenue</p>
                      </div>
                      <h4 className="text-5xl font-black tracking-tighter">${totalRevenue.toFixed(2)}</h4>
                   </Card>

                   <Card className="p-10 border-none shadow-sm bg-white rounded-[40px]">
                      <div className="flex items-center gap-4 mb-4">
                         <div className="w-12 h-12 bg-secondary rounded-2xl flex items-center justify-center text-destructive">
                            <Droplet className="w-6 h-6" />
                         </div>
                         <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Chemical Cost</p>
                      </div>
                      <h4 className="text-5xl font-black tracking-tighter text-destructive">-${totalSoapCost.toFixed(2)}</h4>
                   </Card>

                   <Card className="p-10 border-none shadow-sm bg-white rounded-[40px]">
                      <div className="flex items-center gap-4 mb-4">
                         <div className="w-12 h-12 bg-primary/20 rounded-2xl flex items-center justify-center text-primary">
                            <TrendingUp className="w-6 h-6" />
                         </div>
                         <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Net Earnings</p>
                      </div>
                      <h4 className="text-5xl font-black tracking-tighter text-primary">${totalProfit.toFixed(2)}</h4>
                   </Card>
                </div>

                <Card className="border-none shadow-sm bg-white rounded-[32px] overflow-hidden">
                   <CardHeader className="p-8 pb-0">
                      <CardTitle className="text-xl font-black">Audit Ledger</CardTitle>
                      <CardDescription className="font-bold">Precise profit breakdown per transaction</CardDescription>
                   </CardHeader>
                   <CardContent className="p-8">
                      <div className="rounded-2xl border overflow-hidden">
                         <table className="w-full text-sm">
                            <thead className="bg-secondary/20">
                               <tr>
                                  <th className="p-4 text-left font-black uppercase text-[10px] tracking-widest">Date / Time</th>
                                  <th className="p-4 text-right font-black uppercase text-[10px] tracking-widest">Revenue</th>
                                  <th className="p-4 text-right font-black uppercase text-[10px] tracking-widest">Chemical Expense</th>
                                  <th className="p-4 text-right font-black uppercase text-[10px] tracking-widest">Yield</th>
                               </tr>
                            </thead>
                            <tbody className="divide-y">
                               {laundryTransactions.slice().reverse().map(t => (
                                 <tr key={t.id} className="hover:bg-secondary/5">
                                    <td className="p-4 font-bold">{new Date(t.timestamp).toLocaleString()}</td>
                                    <td className="p-4 text-right font-black">${t.totalAmount.toFixed(2)}</td>
                                    <td className="p-4 text-right font-bold text-destructive">-${(t.totalAmount - t.profit).toFixed(2)}</td>
                                    <td className="p-4 text-right font-black text-primary">${t.profit.toFixed(2)}</td>
                                 </tr>
                               ))}
                               {laundryTransactions.length === 0 && (
                                 <tr><td colSpan={4} className="py-20 text-center text-muted-foreground opacity-30 font-black uppercase text-xs">Awaiting financial data</td></tr>
                               )}
                            </tbody>
                         </table>
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
