
'use client';

import { Sidebar } from '@/components/layout/sidebar';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Waves, UserPlus, CreditCard, Droplet, History, Search } from 'lucide-react';
import { useAuth } from '@/components/auth-context';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, doc, setDoc, addDoc, updateDoc, increment } from 'firebase/firestore';
import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LaundryStudent } from '@/lib/types';

export default function LaundryPage() {
  const { user } = useAuth();
  const firestore = useFirestore();
  const { toast } = useToast();
  const [matrixSearch, setMatrixSearch] = useState('');
  const [selectedStudent, setSelectedStudent] = useState<LaundryStudent | null>(null);

  const studentsQuery = useMemoFirebase(() => {
    if (!firestore || !user?.companyId) return null;
    return collection(firestore, 'companies', user.companyId, 'laundryStudents');
  }, [firestore, user?.companyId]);

  const { data: students } = useCollection<LaundryStudent>(studentsQuery);

  const handleRegisterStudent = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!firestore || !user?.companyId) return;
    const formData = new FormData(e.currentTarget);
    const student = {
      id: crypto.randomUUID(),
      companyId: user.companyId,
      name: formData.get('name') as string,
      matrixNumber: formData.get('matrix') as string,
      balance: Number(formData.get('initialBalance')) || 0,
    };

    try {
      await setDoc(doc(firestore, 'companies', user.companyId, 'laundryStudents', student.id), student);
      toast({ title: "Student Registered", description: `${student.name} is now in the system.` });
      (e.target as HTMLFormElement).reset();
    } catch (e) {
      toast({ title: "Registration failed", variant: "destructive" });
    }
  };

  const handleSearch = () => {
    const found = students?.find(s => s.matrixNumber === matrixSearch);
    if (found) {
      setSelectedStudent(found);
      toast({ title: "Student Found", description: `Selected ${found.name}` });
    } else {
      toast({ title: "Not Found", description: "No student with that matrix number.", variant: "destructive" });
      setSelectedStudent(null);
    }
  };

  const handleChargeLaundry = async () => {
    if (!selectedStudent || !firestore || !user?.companyId) return;
    const charge = 5.00; // Flat wash rate

    if (selectedStudent.balance < charge) {
      toast({ title: "Insufficient Balance", description: "Student needs to top up.", variant: "destructive" });
      return;
    }

    try {
      const studentRef = doc(firestore, 'companies', user.companyId, 'laundryStudents', selectedStudent.id);
      await updateDoc(studentRef, { balance: increment(-charge) });
      
      const transactionRef = collection(firestore, 'companies', user.companyId, 'transactions');
      await addDoc(transactionRef, {
        module: 'laundry',
        totalAmount: charge,
        profit: charge * 0.8, // Estimated 80% profit after soap
        timestamp: new Date().toISOString(),
        studentId: selectedStudent.id,
        items: [{ name: 'Standard Wash', price: charge, quantity: 1 }]
      });

      toast({ title: "Laundry Recorded", description: "Charge of $5.00 applied." });
      setSelectedStudent({ ...selectedStudent, balance: selectedStudent.balance - charge });
    } catch (e) {
      toast({ title: "Transaction failed", variant: "destructive" });
    }
  };

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <main className="flex-1 overflow-auto p-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold font-headline">Laundry Module</h1>
          <p className="text-muted-foreground">Manage student payments and soap usage</p>
        </div>

        <Tabs defaultValue="pos">
          <TabsList className="mb-6">
            <TabsTrigger value="pos" className="flex items-center gap-2"><CreditCard className="w-4 h-4" /> Usage POS</TabsTrigger>
            <TabsTrigger value="students" className="flex items-center gap-2"><UserPlus className="w-4 h-4" /> Student Registry</TabsTrigger>
            <TabsTrigger value="soap" className="flex items-center gap-2"><Droplet className="w-4 h-4" /> Soap Inventory</TabsTrigger>
          </TabsList>

          <TabsContent value="pos" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <Card className="border-none shadow-sm">
                <CardHeader>
                  <CardTitle>Usage Terminal</CardTitle>
                  <CardDescription>Scan matrix number to apply wash charge</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="flex gap-2">
                    <Input 
                      placeholder="Enter Matrix Number..." 
                      value={matrixSearch}
                      onChange={(e) => setMatrixSearch(e.target.value)}
                    />
                    <Button onClick={handleSearch}><Search className="w-4 h-4 mr-2" /> Find</Button>
                  </div>

                  {selectedStudent && (
                    <div className="p-6 bg-secondary/20 rounded-2xl border-2 border-primary/20 space-y-4">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="text-xs font-bold text-muted-foreground uppercase">Active Student</p>
                          <h4 className="text-xl font-bold">{selectedStudent.name}</h4>
                          <p className="text-sm text-muted-foreground">Matrix: {selectedStudent.matrixNumber}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs font-bold text-muted-foreground uppercase">Balance</p>
                          <p className="text-2xl font-black text-primary">${selectedStudent.balance.toFixed(2)}</p>
                        </div>
                      </div>
                      <Button className="w-full h-12 text-lg font-bold" onClick={handleChargeLaundry}>
                        Apply $5.00 Wash Charge
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="border-none shadow-sm">
                <CardHeader>
                  <CardTitle>Recent Activity</CardTitle>
                  <CardDescription>Latest laundry records</CardDescription>
                </CardHeader>
                <CardContent>
                   <p className="text-center py-10 text-muted-foreground">No recent activity detected.</p>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="students">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <Card className="lg:col-span-1 h-fit">
                <CardHeader>
                  <CardTitle>Register Student</CardTitle>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleRegisterStudent} className="space-y-4">
                    <Input name="name" placeholder="Student Name" required />
                    <Input name="matrix" placeholder="Matrix Number" required />
                    <Input name="initialBalance" type="number" placeholder="Initial Balance ($)" />
                    <Button type="submit" className="w-full">Register</Button>
                  </form>
                </CardContent>
              </Card>

              <div className="lg:col-span-2 space-y-4">
                <h3 className="font-bold">Student Database</h3>
                <div className="border rounded-xl bg-white overflow-hidden">
                   <table className="w-full text-sm text-left">
                     <thead className="bg-secondary/30 border-b">
                       <tr>
                         <th className="p-4">Name</th>
                         <th className="p-4">Matrix</th>
                         <th className="p-4 text-right">Balance</th>
                       </tr>
                     </thead>
                     <tbody className="divide-y">
                       {students?.map(s => (
                         <tr key={s.id}>
                           <td className="p-4 font-medium">{s.name}</td>
                           <td className="p-4 text-muted-foreground">{s.matrixNumber}</td>
                           <td className="p-4 text-right font-bold text-primary">${s.balance.toFixed(2)}</td>
                         </tr>
                       ))}
                     </tbody>
                   </table>
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="soap">
             <Card className="max-w-md mx-auto">
               <CardHeader className="text-center">
                 <Droplet className="w-12 h-12 text-primary mx-auto mb-2" />
                 <CardTitle>Soap Consumables</CardTitle>
                 <CardDescription>Track chemical levels and purchase costs</CardDescription>
               </CardHeader>
               <CardContent className="space-y-4">
                 <div className="p-4 bg-secondary rounded-xl text-center">
                   <p className="text-xs font-bold uppercase text-muted-foreground">Global Soap Stock</p>
                   <p className="text-3xl font-black">24.5 Litres</p>
                   <div className="w-full bg-background h-2 rounded-full mt-2 overflow-hidden">
                     <div className="bg-primary h-full w-[65%]" />
                   </div>
                 </div>
                 <Button className="w-full" variant="outline">Record New Purchase</Button>
               </CardContent>
             </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
