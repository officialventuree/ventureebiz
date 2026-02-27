
'use client';

import { Sidebar } from '@/components/layout/sidebar';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Waves, UserPlus, CreditCard, Droplet, Search, History, Trash2, ArrowRightLeft, Info } from 'lucide-react';
import { useAuth } from '@/components/auth-context';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, doc, setDoc, addDoc, updateDoc, increment, deleteDoc } from 'firebase/firestore';
import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LaundryStudent, SaleTransaction } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Progress } from '@/components/ui/progress';

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

  const { data: students } = useCollection<LaundryStudent>(studentsQuery);
  const { data: transactions } = useCollection<SaleTransaction>(transactionsQuery);

  const soapLitre = 25.0; // Mock current inventory
  const mlPerWash = 50;

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
    const washRate = 5.00;

    if (selectedStudent.balance < washRate) {
      toast({ title: "Insufficient Funds", description: "Top-up required.", variant: "destructive" });
      setIsProcessing(false);
      return;
    }

    try {
      const studentRef = doc(firestore, 'companies', user.companyId, 'laundryStudents', selectedStudent.id);
      await updateDoc(studentRef, { balance: increment(-washRate) });
      
      const transactionRef = collection(firestore, 'companies', user.companyId, 'transactions');
      await addDoc(transactionRef, {
        id: crypto.randomUUID(),
        companyId: user.companyId,
        module: 'laundry',
        totalAmount: washRate,
        profit: washRate * 0.75, // Estimating soap/water cost
        timestamp: new Date().toISOString(),
        items: [{ name: 'Standard Wash', price: washRate, quantity: 1, soapUsedMl: mlPerWash }]
      });

      toast({ title: "Wash Recorded", description: `Charged $${washRate.toFixed(2)} to ${selectedStudent.name}.` });
      setSelectedStudent({ ...selectedStudent, balance: selectedStudent.balance - washRate });
    } catch (e) {
      toast({ title: "Processing Error", variant: "destructive" });
    } finally {
      setIsProcessing(false);
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

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <main className="flex-1 overflow-auto p-8">
        <div className="mb-8">
          <h1 className="text-3xl font-black font-headline text-foreground">Laundry Module</h1>
          <p className="text-muted-foreground">Manage Mandatory Student Subscriptions & Soap Stock</p>
        </div>

        <Tabs defaultValue="pos" className="space-y-6">
          <TabsList className="bg-white/50 border p-1 rounded-xl">
            <TabsTrigger value="pos" className="rounded-lg gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <CreditCard className="w-4 h-4" /> Laundry POS
            </TabsTrigger>
            <TabsTrigger value="students" className="rounded-lg gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <UserPlus className="w-4 h-4" /> Student Database
            </TabsTrigger>
            <TabsTrigger value="consumables" className="rounded-lg gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <Droplet className="w-4 h-4" /> Consumables
            </TabsTrigger>
          </TabsList>

          <TabsContent value="pos" className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-6">
              <Card className="border-none shadow-sm bg-white rounded-2xl">
                <CardHeader>
                  <CardTitle>Usage Terminal</CardTitle>
                  <CardDescription>Verify student identity and apply washing charges</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="flex gap-2">
                    <Input 
                      placeholder="Scan/Type Matrix Number..." 
                      className="h-12 rounded-xl text-lg font-bold"
                      value={matrixSearch}
                      onChange={(e) => setMatrixSearch(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                    />
                    <Button onClick={handleSearch} size="lg" className="rounded-xl px-8 h-12">Search</Button>
                  </div>

                  {selectedStudent ? (
                    <div className="p-8 bg-primary/5 rounded-2xl border-2 border-primary/20 space-y-6 relative overflow-hidden group">
                      <div className="absolute -right-4 -top-4 opacity-5 group-hover:scale-110 transition-transform">
                        <Waves className="w-32 h-32 text-primary" />
                      </div>
                      <div className="flex justify-between items-start relative z-10">
                        <div>
                          <p className="text-[10px] font-black text-primary uppercase tracking-widest">Active Subscriber</p>
                          <h4 className="text-3xl font-black text-foreground">{selectedStudent.name}</h4>
                          <p className="text-sm font-bold text-muted-foreground font-mono">ID: {selectedStudent.matrixNumber}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Account Credit</p>
                          <p className={cn(
                            "text-4xl font-black",
                            selectedStudent.balance < 5 ? "text-destructive" : "text-primary"
                          )}>${selectedStudent.balance.toFixed(2)}</p>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4">
                        <Button className="h-14 rounded-xl text-lg font-black shadow-lg" onClick={handleChargeLaundry} disabled={isProcessing}>
                          {isProcessing ? "Processing..." : "Standard Wash ($5.00)"}
                        </Button>
                        <Button variant="outline" className="h-14 rounded-xl font-bold bg-white">
                          Print Last Receipt
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="py-20 text-center bg-secondary/20 rounded-2xl border-2 border-dashed border-secondary">
                      <Search className="w-12 h-12 mx-auto mb-4 opacity-20" />
                      <p className="font-bold text-muted-foreground">Ready to scan student matrix</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="border-none shadow-sm bg-white rounded-2xl">
                <CardHeader>
                  <CardTitle className="text-lg">Recent Usage History</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {transactions?.filter(t => t.module === 'laundry').slice(0, 5).map(t => (
                      <div key={t.id} className="flex items-center justify-between p-3 rounded-xl bg-secondary/30">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center text-primary shadow-sm">
                            <Waves className="w-5 h-5" />
                          </div>
                          <div>
                            <p className="text-xs font-black uppercase text-foreground">Standard Wash</p>
                            <p className="text-[10px] text-muted-foreground font-bold">{new Date(t.timestamp).toLocaleString()}</p>
                          </div>
                        </div>
                        <p className="font-black text-primary">+${t.totalAmount.toFixed(2)}</p>
                      </div>
                    ))}
                    {(!transactions || transactions.filter(t => t.module === 'laundry').length === 0) && (
                      <p className="text-center py-10 text-muted-foreground text-sm font-medium">No recent laundry usage detected.</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="lg:col-span-1 space-y-6">
              <Card className="bg-primary border-none shadow-xl text-primary-foreground rounded-2xl overflow-hidden">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Droplet className="w-5 h-5" />
                    Soap Levels
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs font-black uppercase tracking-widest opacity-80">
                      <span>Litre Balance</span>
                      <span>22.4L / 50L</span>
                    </div>
                    <Progress value={45} className="h-3 bg-white/20" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-white/10 p-4 rounded-xl">
                      <p className="text-[10px] font-black opacity-60 uppercase mb-1">Consumption</p>
                      <p className="text-xl font-black">50ml / wash</p>
                    </div>
                    <div className="bg-white/10 p-4 rounded-xl">
                      <p className="text-[10px] font-black opacity-60 uppercase mb-1">Remaining</p>
                      <p className="text-xl font-black">448 Washes</p>
                    </div>
                  </div>
                </CardContent>
                <CardFooter className="bg-black/5 p-4">
                   <Button variant="secondary" className="w-full font-black rounded-lg">Refill Stock</Button>
                </CardFooter>
              </Card>

              <Card className="border-none shadow-sm bg-white rounded-2xl">
                <CardHeader>
                  <CardTitle className="text-sm font-black flex items-center gap-2">
                    <Info className="w-4 h-4 text-primary" /> Quick Stats
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground font-bold">Total Students</span>
                    <span className="font-black">{students?.length || 0}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground font-bold">Total Balance</span>
                    <span className="font-black text-primary">${students?.reduce((acc, s) => acc + s.balance, 0).toFixed(2) || '0.00'}</span>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="students">
             <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
               <Card className="lg:col-span-1 h-fit border-none shadow-sm rounded-2xl">
                 <CardHeader>
                   <CardTitle>Enroll Student</CardTitle>
                   <CardDescription>Mandatory laundry registration</CardDescription>
                 </CardHeader>
                 <CardContent>
                   <form onSubmit={handleRegisterStudent} className="space-y-4">
                     <div className="space-y-1.5">
                       <label className="text-[10px] font-black uppercase text-muted-foreground">Full Name</label>
                       <Input name="name" placeholder="Alice Smith" required />
                     </div>
                     <div className="space-y-1.5">
                       <label className="text-[10px] font-black uppercase text-muted-foreground">Matrix No.</label>
                       <Input name="matrix" placeholder="2024-001" required />
                     </div>
                     <div className="space-y-1.5">
                       <label className="text-[10px] font-black uppercase text-muted-foreground">Initial Credit ($)</label>
                       <Input name="initialBalance" type="number" placeholder="50.00" />
                     </div>
                     <Button type="submit" className="w-full h-11 font-black rounded-xl shadow-md">Register</Button>
                   </form>
                 </CardContent>
               </Card>

               <div className="lg:col-span-3 space-y-4">
                 <div className="flex justify-between items-end">
                    <h3 className="text-xl font-black text-foreground">Registry</h3>
                    <p className="text-xs font-bold text-muted-foreground">Synced to Secure Core</p>
                 </div>
                 <div className="border rounded-2xl bg-white overflow-hidden shadow-sm">
                   <table className="w-full text-sm text-left">
                     <thead className="bg-secondary/20 border-b">
                       <tr>
                         <th className="p-4 font-black uppercase text-muted-foreground tracking-tighter">Student Information</th>
                         <th className="p-4 font-black uppercase text-muted-foreground tracking-tighter">Matrix</th>
                         <th className="p-4 text-right font-black uppercase text-muted-foreground tracking-tighter">Balance</th>
                         <th className="p-4 text-center font-black uppercase text-muted-foreground tracking-tighter">Action</th>
                       </tr>
                     </thead>
                     <tbody className="divide-y">
                       {students?.map(s => (
                         <tr key={s.id} className="hover:bg-secondary/10 transition-colors">
                           <td className="p-4 font-bold">{s.name}</td>
                           <td className="p-4 font-mono text-muted-foreground">{s.matrixNumber}</td>
                           <td className="p-4 text-right font-black text-primary">${s.balance.toFixed(2)}</td>
                           <td className="p-4 text-center">
                              <Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive/5" onClick={() => handleDeleteStudent(s.id)}>
                                <Trash2 className="w-4 h-4" />
                              </Button>
                           </td>
                         </tr>
                       ))}
                     </tbody>
                   </table>
                 </div>
               </div>
             </div>
          </TabsContent>

          <TabsContent value="consumables">
             <div className="max-w-2xl mx-auto py-12 text-center space-y-8">
                <div className="w-24 h-24 bg-primary/10 rounded-3xl flex items-center justify-center mx-auto shadow-inner">
                  <Droplet className="w-12 h-12 text-primary" />
                </div>
                <div>
                  <h2 className="text-3xl font-black text-foreground">Soap & Chemical Logistics</h2>
                  <p className="text-muted-foreground max-w-md mx-auto mt-2">Track inventory of soap, fabric softener, and utility costs to calculate precise laundry profit.</p>
                </div>
                <div className="grid grid-cols-2 gap-6">
                   <Card className="p-6 border-none shadow-sm text-left bg-white rounded-2xl">
                      <p className="text-[10px] font-black text-muted-foreground uppercase mb-2">Cost per Litre</p>
                      <h4 className="text-2xl font-black text-foreground">$1.45</h4>
                      <p className="text-[10px] text-green-600 font-bold mt-1">Vendor: Unilever Pro</p>
                   </Card>
                   <Card className="p-6 border-none shadow-sm text-left bg-white rounded-2xl">
                      <p className="text-[10px] font-black text-muted-foreground uppercase mb-2">Efficiency Rating</p>
                      <h4 className="text-2xl font-black text-primary">Excellent</h4>
                      <p className="text-[10px] text-muted-foreground font-bold mt-1">Based on 50ml standard</p>
                   </Card>
                </div>
                <Button className="rounded-xl h-12 px-8 font-black shadow-lg">Purchase New Chemical Batch</Button>
             </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
