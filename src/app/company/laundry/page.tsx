'use client';

import { Sidebar } from '@/components/layout/sidebar';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Waves, 
  UserPlus, 
  CreditCard, 
  Droplet, 
  Search, 
  History, 
  Trash2, 
  ArrowRightLeft, 
  TrendingUp, 
  DollarSign, 
  Wallet, 
  QrCode, 
  Upload, 
  ShieldCheck, 
  Banknote,
  User,
  Edit2,
  CheckCircle2,
  ArrowRight
} from 'lucide-react';
import { useAuth } from '@/components/auth-context';
import { useFirestore, useCollection, useMemoFirebase, useDoc } from '@/firebase';
import { collection, doc, setDoc, addDoc, updateDoc, increment, deleteDoc } from 'firebase/firestore';
import { useState, useMemo } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LaundryStudent, SaleTransaction, LaundryInventory, Company, PaymentMethod } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Separator } from '@/components/ui/separator';
import Image from 'next/image';

const CLASSES = ['Biruni', 'Dinawari', 'Farabi', 'Ghazali', 'Khawarizmi', 'Razi'];
const LEVELS = [1, 2, 3, 4, 5];

export default function LaundryPage() {
  const { user } = useAuth();
  const firestore = useFirestore();
  const { toast } = useToast();
  
  const [matrixSearch, setMatrixSearch] = useState('');
  const [selectedStudent, setSelectedStudent] = useState<LaundryStudent | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Registration Form State
  const [selectedLevel, setSelectedLevel] = useState<string>('');
  const [selectedClass, setSelectedClass] = useState<string>('');

  // Edit Student State
  const [editingStudent, setEditingStudent] = useState<LaundryStudent | null>(null);
  const [isEditStudentOpen, setIsEditStudentOpen] = useState(false);
  const [editLevel, setEditLevel] = useState<string>('');
  const [editClass, setEditClass] = useState<string>('');

  // Top Up Dialog State
  const [isTopUpOpen, setIsTopUpOpen] = useState(false);
  const [topUpMatrix, setTopUpMatrix] = useState('');
  const [topUpAmount, setTopUpAmount] = useState<number | string>('');
  const [topUpPaymentMethod, setTopUpPaymentMethod] = useState<PaymentMethod>('cash');
  const [amountReceived, setAmountReceived] = useState<number | string>('');
  const [transactionNo, setTransactionNo] = useState('');

  // Walk-in State
  const [walkInName, setWalkInName] = useState('');
  const [walkInPaymentMethod, setWalkInPaymentMethod] = useState<PaymentMethod>('cash');
  const [walkInAmountReceived, setWalkInAmountReceived] = useState<number | string>('');
  const [walkInRef, setWalkInRef] = useState('');

  // Restock State
  const [restockCategory, setRestockCategory] = useState<'student' | 'payable'>('student');

  const studentsQuery = useMemoFirebase(() => {
    if (!firestore || !user?.companyId) return null;
    return collection(firestore, 'companies', user.companyId, 'laundryStudents');
  }, [firestore, user?.companyId]);

  const transactionsQuery = useMemoFirebase(() => {
    if (!firestore || !user?.companyId) return null;
    return collection(firestore, 'companies', user.companyId, 'transactions');
  }, [firestore, user?.companyId]);

  const inventoryQuery = useMemoFirebase(() => {
    if (!firestore || !user?.companyId) return null;
    return collection(firestore, 'companies', user.companyId, 'laundryInventory');
  }, [firestore, user?.companyId]);

  const companyRef = useMemoFirebase(() => {
    if (!firestore || !user?.companyId) return null;
    return doc(firestore, 'companies', user.companyId);
  }, [firestore, user?.companyId]);

  const { data: students } = useCollection<LaundryStudent>(studentsQuery);
  const { data: transactions } = useCollection<SaleTransaction>(transactionsQuery);
  const { data: inventoryItems } = useCollection<LaundryInventory>(inventoryQuery);
  const { data: companyDoc } = useDoc<Company>(companyRef);

  const studentSoap = inventoryItems?.find(i => i.id === 'student_soap');
  const payableSoap = inventoryItems?.find(i => i.id === 'payable_soap');

  const mlPerWash = 50;
  const washRate = 5.00;

  const foundTopUpStudent = useMemo(() => {
    return students?.find(s => s.matrixNumber === topUpMatrix);
  }, [students, topUpMatrix]);

  const changeAmount = topUpPaymentMethod === 'cash' ? Math.max(0, (Number(amountReceived) || 0) - (Number(topUpAmount) || 0)) : 0;
  const walkInChangeAmount = walkInPaymentMethod === 'cash' ? Math.max(0, (Number(walkInAmountReceived) || 0) - washRate) : 0;

  const handleRegisterStudent = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!firestore || !user?.companyId) return;
    const formData = new FormData(e.currentTarget);
    const studentId = crypto.randomUUID();
    
    if (!selectedLevel || !selectedClass) {
      toast({ title: "Registration incomplete", description: "Please select Level and Class.", variant: "destructive" });
      return;
    }

    const student: LaundryStudent = {
      id: studentId,
      companyId: user.companyId,
      name: formData.get('name') as string,
      matrixNumber: formData.get('matrix') as string,
      balance: Number(formData.get('initialBalance')) || 0,
      level: Number(selectedLevel),
      class: selectedClass,
    };

    try {
      await setDoc(doc(firestore, 'companies', user.companyId, 'laundryStudents', studentId), student);
      toast({ title: "Student Registered", description: `${student.name} from ${student.class} (Level ${student.level}) added.` });
      (e.target as HTMLFormElement).reset();
      setSelectedLevel('');
      setSelectedClass('');
    } catch (e: any) {
      toast({ title: "Registration failed", description: e.message, variant: "destructive" });
    }
  };

  const handleOpenEdit = (student: LaundryStudent) => {
    setEditingStudent(student);
    setEditLevel(student.level.toString());
    setEditClass(student.class);
    setIsEditStudentOpen(true);
  };

  const handleUpdateStudent = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!firestore || !user?.companyId || !editingStudent) return;
    const formData = new FormData(e.currentTarget);
    
    const updatedData = {
      name: formData.get('name') as string,
      matrixNumber: formData.get('matrix') as string,
      level: Number(editLevel),
      class: editClass,
    };

    try {
      await updateDoc(doc(firestore, 'companies', user.companyId, 'laundryStudents', editingStudent.id), updatedData);
      toast({ title: "Record Updated", description: `Information for ${updatedData.name} saved.` });
      setIsEditStudentOpen(false);
      setEditingStudent(null);
    } catch (e: any) {
      toast({ title: "Update failed", variant: "destructive" });
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
    if (!selectedStudent || !firestore || !user?.companyId || !studentSoap) return;
    setIsProcessing(true);

    if (selectedStudent.balance < washRate) {
      toast({ title: "Insufficient Funds", description: "Top-up required.", variant: "destructive" });
      setIsProcessing(false);
      return;
    }

    if (studentSoap.soapStockMl < mlPerWash) {
       toast({ title: "Out of Student Soap", description: "Please refill student soap inventory.", variant: "destructive" });
       setIsProcessing(false);
       return;
    }

    try {
      const studentRef = doc(firestore, 'companies', user.companyId, 'laundryStudents', selectedStudent.id);
      await updateDoc(studentRef, { balance: increment(-washRate) });
      
      const invRef = doc(firestore, 'companies', user.companyId, 'laundryInventory', 'student_soap');
      await updateDoc(invRef, { soapStockMl: increment(-mlPerWash) });

      const soapCost = (mlPerWash / 1000) * studentSoap.soapCostPerLitre;
      const profit = washRate - soapCost;

      const transactionRef = collection(firestore, 'companies', user.companyId, 'transactions');
      await addDoc(transactionRef, {
        id: crypto.randomUUID(),
        companyId: user.companyId,
        module: 'laundry',
        totalAmount: washRate,
        profit: profit,
        timestamp: new Date().toISOString(),
        customerName: selectedStudent.name,
        items: [{ name: 'Standard Wash (Student)', price: washRate, quantity: 1, soapUsedMl: mlPerWash }]
      });

      toast({ title: "Wash Recorded", description: `Charged $${washRate.toFixed(2)} to ${selectedStudent.name}. 50ml student soap deducted.` });
      setSelectedStudent({ ...selectedStudent, balance: selectedStudent.balance - washRate });
    } catch (e: any) {
      toast({ title: "Processing Error", variant: "destructive" });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleWalkInWash = async () => {
    if (!firestore || !user?.companyId || !walkInName || !payableSoap) {
      toast({ title: "Incomplete Form", description: "Customer name is required and inventory must be loaded.", variant: "destructive" });
      return;
    }
    
    if (payableSoap.soapStockMl < mlPerWash) {
       toast({ title: "Out of Payable Soap", description: "Please refill payable soap inventory.", variant: "destructive" });
       return;
    }

    if (walkInPaymentMethod === 'cash' && (Number(walkInAmountReceived) || 0) < washRate) {
      toast({ title: "Insufficient Cash", description: "Amount received is less than wash rate.", variant: "destructive" });
      return;
    }

    if ((walkInPaymentMethod === 'card' || walkInPaymentMethod === 'duitnow') && !walkInRef) {
      toast({ title: "Reference Required", description: "Please enter transaction reference number.", variant: "destructive" });
      return;
    }

    setIsProcessing(true);

    try {
      const invRef = doc(firestore, 'companies', user.companyId, 'laundryInventory', 'payable_soap');
      await updateDoc(invRef, { soapStockMl: increment(-mlPerWash) });

      const soapCost = (mlPerWash / 1000) * payableSoap.soapCostPerLitre;
      const profit = washRate - soapCost;

      const transactionRef = collection(firestore, 'companies', user.companyId, 'transactions');
      await addDoc(transactionRef, {
        id: crypto.randomUUID(),
        companyId: user.companyId,
        module: 'laundry',
        totalAmount: washRate,
        profit: profit,
        timestamp: new Date().toISOString(),
        customerName: walkInName,
        paymentMethod: walkInPaymentMethod,
        referenceNumber: walkInRef || undefined,
        status: 'completed',
        items: [{ name: 'Standard Wash (Walk-in)', price: washRate, quantity: 1, soapUsedMl: mlPerWash }]
      });

      toast({ title: "Wash Recorded", description: `Payment collected from ${walkInName}. 50ml payable soap deducted.` });
      
      // Reset walk-in form
      setWalkInName('');
      setWalkInAmountReceived('');
      setWalkInRef('');
      setWalkInPaymentMethod('cash');
    } catch (e: any) {
      toast({ title: "Processing Error", variant: "destructive" });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleConfirmTopUp = async () => {
    if (!foundTopUpStudent || !firestore || !user?.companyId || !topUpAmount) return;
    setIsProcessing(true);

    try {
      const amount = Number(topUpAmount);
      const studentRef = doc(firestore, 'companies', user.companyId, 'laundryStudents', foundTopUpStudent.id);
      await updateDoc(studentRef, { balance: increment(amount) });

      const transactionRef = collection(firestore, 'companies', user.companyId, 'transactions');
      await addDoc(transactionRef, {
        id: crypto.randomUUID(),
        companyId: user.companyId,
        module: 'laundry',
        totalAmount: amount,
        profit: amount,
        timestamp: new Date().toISOString(),
        customerName: foundTopUpStudent.name,
        paymentMethod: topUpPaymentMethod,
        referenceNumber: transactionNo || undefined,
        status: 'completed',
        items: [{ name: 'Student Top-Up', price: amount, quantity: 1 }]
      });

      toast({ title: "Top-Up Successful", description: `$${amount.toFixed(2)} added to ${foundTopUpStudent.name}'s balance.` });
      
      setIsTopUpOpen(false);
      setTopUpMatrix('');
      setTopUpAmount('');
      setAmountReceived('');
      setTransactionNo('');
    } catch (e: any) {
      toast({ title: "Transaction Failed", variant: "destructive" });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRestockSoap = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!firestore || !user?.companyId) return;
    const formData = new FormData(e.currentTarget);
    
    const bottles = Number(formData.get('bottles'));
    const volPerBottle = Number(formData.get('volPerBottle')); // in Litres
    const costPerBottle = Number(formData.get('costPerBottle'));
    
    const amountLitres = bottles * volPerBottle;
    const totalCost = bottles * costPerBottle;
    const category = restockCategory;
    const amountMl = amountLitres * 1000;
    const docId = category === 'student' ? 'student_soap' : 'payable_soap';

    try {
      const existing = category === 'student' ? studentSoap : payableSoap;
      
      if (!existing) {
        await setDoc(doc(firestore, 'companies', user.companyId, 'laundryInventory', docId), {
          id: docId,
          companyId: user.companyId,
          soapStockMl: amountMl,
          soapCostPerLitre: totalCost / amountLitres,
          capacityMl: 50000,
          category
        });
      } else {
        await updateDoc(doc(firestore, 'companies', user.companyId, 'laundryInventory', docId), {
          soapStockMl: increment(amountMl),
          soapCostPerLitre: totalCost / amountLitres
        });
      }

      await addDoc(collection(firestore, 'companies', user.companyId, 'purchases'), {
        id: crypto.randomUUID(),
        companyId: user.companyId,
        amount: totalCost,
        description: `Laundry Restock (${category}): ${bottles}x ${volPerBottle}L Bottles`,
        timestamp: new Date().toISOString()
      });

      toast({ title: "Inventory Updated", description: `Added ${amountLitres}L to ${category} stock.` });
      (e.target as HTMLFormElement).reset();
    } catch (e: any) {
      toast({ title: "Restock failed", variant: "destructive" });
    }
  };

  const handleQrUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !firestore || !user?.companyId) return;

    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64String = reader.result as string;
      try {
        await updateDoc(doc(firestore, 'companies', user.companyId), {
          duitNowQr: base64String
        });
        toast({ title: "QR Code Updated", description: "DuitNow QR has been saved to your profile." });
      } catch (err: any) {
        toast({ title: "Upload failed", variant: "destructive" });
      }
    };
    reader.readAsDataURL(file);
  };

  const handleDeleteStudent = async (id: string) => {
    if (!firestore || !user?.companyId) return;
    if (!confirm("Remove this student account and all balance data?")) return;
    try {
      await deleteDoc(doc(firestore, 'companies', user.companyId, 'laundryStudents', id));
      toast({ title: "Record Deleted" });
    } catch (e: any) {
      toast({ title: "Deletion failed", variant: "destructive" });
    }
  };

  const laundryTransactions = transactions?.filter(t => t.module === 'laundry') || [];
  const totalRevenue = laundryTransactions.reduce((acc, t) => acc + t.totalAmount, 0);
  const totalProfit = laundryTransactions.reduce((acc, t) => acc + t.profit, 0);
  const totalSoapCost = Math.max(0, totalRevenue - totalProfit);

  return (
    <div className="flex h-screen bg-background font-body">
      <Sidebar />
      <main className="flex-1 overflow-auto p-8">
        <div className="mb-8 flex justify-between items-end">
          <div>
            <h1 className="text-3xl font-black font-headline text-foreground tracking-tight">Laundry Module</h1>
            <p className="text-muted-foreground font-medium">Student Subscriptions & Chemical Logistics</p>
          </div>
          <div className="flex gap-4">
            <Dialog open={isTopUpOpen} onOpenChange={setIsTopUpOpen}>
              <DialogTrigger asChild>
                <Button className="rounded-2xl h-14 px-8 font-black text-lg shadow-xl gap-2">
                  <CreditCard className="w-5 h-5" /> Student Payment
                </Button>
              </DialogTrigger>
              <DialogContent className="rounded-[40px] border-none shadow-2xl max-w-xl p-0 overflow-hidden bg-white">
                <div className="bg-primary p-12 text-primary-foreground text-center relative overflow-hidden">
                   <div className="absolute -top-4 -left-4 opacity-10 rotate-12"><Wallet className="w-24 h-24" /></div>
                   <p className="text-xs font-black uppercase tracking-widest opacity-80 mb-2 relative z-10">Balance Top-Up</p>
                   <h2 className="text-4xl font-black tracking-tighter relative z-10">Laundry Settlement</h2>
                </div>

                <div className="p-10 space-y-8">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-muted-foreground px-1 tracking-widest">Identify Student Matrix</Label>
                    <Input 
                      placeholder="ENTER MATRIX NO..." 
                      className="h-14 rounded-2xl font-black text-xl bg-secondary/10 border-none px-6"
                      value={topUpMatrix}
                      onChange={(e) => setTopUpMatrix(e.target.value)}
                    />
                  </div>

                  {foundTopUpStudent ? (
                    <div className="space-y-8 animate-in fade-in slide-in-from-top-2">
                      <div className="p-6 bg-primary/5 rounded-[32px] border-2 border-primary/20 flex justify-between items-center">
                        <div>
                          <p className="text-[10px] font-black text-primary uppercase tracking-widest mb-1">Authenticated Account</p>
                          <h4 className="text-2xl font-black text-foreground">{foundTopUpStudent.name}</h4>
                          <p className="text-xs font-bold text-muted-foreground">Level {foundTopUpStudent.level} • {foundTopUpStudent.class}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1">Live Balance</p>
                          <p className="text-3xl font-black text-foreground">${foundTopUpStudent.balance.toFixed(2)}</p>
                        </div>
                      </div>

                      <div className="space-y-6">
                        <div className="space-y-2">
                          <Label className="text-[10px] font-black uppercase text-muted-foreground px-1 tracking-widest">Top-Up Amount ($)</Label>
                          <Input 
                            type="number" 
                            placeholder="50.00" 
                            className="h-16 rounded-2xl font-black text-3xl bg-secondary/10 border-none px-6"
                            value={topUpAmount}
                            onChange={(e) => setTopUpAmount(e.target.value)}
                          />
                        </div>

                        <div className="space-y-4">
                          <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground px-1">Select Payment Mode</Label>
                          <RadioGroup value={topUpPaymentMethod} onValueChange={(v) => setTopUpPaymentMethod(v as PaymentMethod)} className="grid grid-cols-3 gap-3">
                            <PaymentOption value="cash" label="Cash" icon={Banknote} id="topup_cash" />
                            <PaymentOption value="card" label="Card" icon={CreditCard} id="topup_card" />
                            <PaymentOption value="duitnow" label="DuitNow" icon={QrCode} id="topup_qr" />
                          </RadioGroup>
                        </div>

                        <Separator className="bg-secondary/50" />

                        {topUpPaymentMethod === 'cash' && (
                          <div className="space-y-6 animate-in slide-in-from-top-2">
                            <div className="space-y-2">
                              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground px-1">Amount Received ($)</Label>
                              <Input 
                                type="number" 
                                className="h-14 rounded-2xl font-black text-xl bg-secondary/10 border-none px-6 text-center"
                                value={amountReceived}
                                onChange={(e) => setAmountReceived(e.target.value)}
                              />
                            </div>
                            {Number(amountReceived) >= (Number(topUpAmount) || 0) && (
                              <div className="bg-primary/5 p-6 rounded-3xl border-2 border-primary/20 flex justify-between items-center">
                                <p className="text-[10px] font-black uppercase text-primary">Change Balance</p>
                                <p className="text-3xl font-black text-foreground">${changeAmount.toFixed(2)}</p>
                              </div>
                            )}
                          </div>
                        )}

                        {(topUpPaymentMethod === 'card' || topUpPaymentMethod === 'duitnow') && (
                          <div className="space-y-6 animate-in slide-in-from-top-2">
                            {topUpPaymentMethod === 'duitnow' && companyDoc?.duitNowQr && (
                              <div className="flex flex-col items-center bg-secondary/5 p-8 rounded-[40px] border-2 border-dashed border-primary/10">
                                <Image 
                                  src={companyDoc.duitNowQr} 
                                  alt="DuitNow QR" 
                                  width={180} 
                                  height={180} 
                                  className="rounded-3xl shadow-xl border-4 border-white mb-4"
                                />
                                <p className="text-[10px] font-black text-primary uppercase tracking-widest">Scan to Pay Now</p>
                              </div>
                            )}
                            <div className="space-y-2">
                              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground px-1">Transaction No / Trace ID</Label>
                              <Input 
                                placeholder="TRX-XXXXXX" 
                                className="h-14 rounded-2xl font-black text-xl bg-secondary/10 border-none px-6"
                                value={transactionNo}
                                onChange={(e) => setTransactionNo(e.target.value)}
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  ) : topUpMatrix ? (
                    <div className="py-12 text-center text-destructive font-black uppercase text-sm tracking-widest">
                       Student not found. Verify Matrix No.
                    </div>
                  ) : null}
                </div>

                <div className="p-10 pt-0">
                  <Button 
                    className="w-full h-18 rounded-[28px] font-black text-xl shadow-2xl"
                    disabled={!foundTopUpStudent || !topUpAmount || isProcessing}
                    onClick={handleConfirmTopUp}
                  >
                    {isProcessing ? "Processing..." : "Confirm & Update Balance"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <Tabs defaultValue="pos" className="space-y-6">
          <TabsList className="bg-white/50 border p-1 rounded-xl shadow-sm">
            <TabsTrigger value="pos" className="rounded-lg gap-2">
              <CreditCard className="w-4 h-4" /> Laundry POS
            </TabsTrigger>
            <TabsTrigger value="walkin" className="rounded-lg gap-2">
              <Banknote className="w-4 h-4" /> Payable Laundry
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
            <TabsTrigger value="billing" className="rounded-lg gap-2">
              <ShieldCheck className="w-4 h-4" /> Billing
            </TabsTrigger>
          </TabsList>

          <TabsContent value="pos" className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-6">
              <Card className="border-none shadow-sm bg-white rounded-3xl overflow-hidden">
                <CardHeader className="bg-secondary/10 p-8">
                  <CardTitle className="text-xl font-black">Usage Terminal (Student)</CardTitle>
                  <CardTitle className="text-sm font-bold mt-1">Verify student identity and process washing charge from Student Soap Stock</CardTitle>
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
                          <p className="text-xs font-black text-primary uppercase mt-1">Level {selectedStudent.level} • {selectedStudent.class}</p>
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
                        <Button className="h-16 rounded-2xl text-xl font-black shadow-xl" onClick={handleChargeLaundry} disabled={isProcessing || !studentSoap || studentSoap.soapStockMl < mlPerWash}>
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
                            <p className="text-sm font-black text-foreground">{t.items[0].name}</p>
                            <p className="text-[10px] text-muted-foreground font-bold">{new Date(t.timestamp).toLocaleString()}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-black text-primary text-lg">+${t.totalAmount.toFixed(2)}</p>
                          <p className="text-[10px] font-bold text-muted-foreground uppercase">Paid by {t.customerName}</p>
                        </div>
                      </div>
                    ))}
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
                    Student Soap Level
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-8 pt-0 space-y-8 relative z-10">
                  <div className="space-y-3">
                    <div className="flex justify-between text-[10px] font-black uppercase tracking-widest opacity-80">
                      <span>Inventory Balance</span>
                      <span>{studentSoap ? (studentSoap.soapStockMl / 1000).toFixed(1) : 0}L / {studentSoap ? (studentSoap.capacityMl / 1000).toFixed(0) : 50}L</span>
                    </div>
                    <Progress value={studentSoap ? Math.min(100, (studentSoap.soapStockMl / studentSoap.capacityMl) * 100) : 0} className="h-4 bg-white/20" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-white/10 p-5 rounded-2xl backdrop-blur-sm">
                      <p className="text-[10px] font-black opacity-60 uppercase mb-1 tracking-widest">Dose / Wash</p>
                      <p className="text-2xl font-black">{mlPerWash}ml</p>
                    </div>
                    <div className="bg-white/10 p-5 rounded-2xl backdrop-blur-sm">
                      <p className="text-[10px] font-black opacity-60 uppercase mb-1 tracking-widest">Remaining</p>
                      <p className="text-2xl font-black">{studentSoap ? Math.floor(studentSoap.soapStockMl / mlPerWash) : 0} <span className="text-xs">Washes</span></p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="walkin" className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-6">
              <Card className="border-none shadow-sm bg-white rounded-[32px] overflow-hidden">
                <CardHeader className="bg-secondary/10 p-8">
                  <CardTitle className="text-xl font-black flex items-center gap-2">
                    <Banknote className="w-6 h-6 text-primary" /> Payable Wash Terminal
                  </CardTitle>
                  <CardDescription className="font-bold">Record laundry services from Payable Soap Stock</CardDescription>
                </CardHeader>
                <CardContent className="p-10 space-y-8">
                   <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase text-muted-foreground px-1 tracking-widest">Customer Name</Label>
                      <Input 
                        placeholder="WALK-IN CUSTOMER NAME..." 
                        className="h-14 rounded-2xl font-black text-xl bg-secondary/10 border-none px-6"
                        value={walkInName}
                        onChange={(e) => setWalkInName(e.target.value)}
                      />
                   </div>

                   <div className="space-y-4">
                      <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground px-1">Select Payment Mode</Label>
                      <RadioGroup value={walkInPaymentMethod} onValueChange={(v) => setWalkInPaymentMethod(v as PaymentMethod)} className="grid grid-cols-3 gap-4">
                        <PaymentOption value="cash" label="Cash" icon={Banknote} id="walkin_cash" />
                        <PaymentOption value="card" label="Card" icon={CreditCard} id="walkin_card" />
                        <PaymentOption value="duitnow" label="DuitNow" icon={QrCode} id="walkin_qr" />
                      </RadioGroup>
                   </div>

                   <Separator className="bg-secondary/50" />

                   {walkInPaymentMethod === 'cash' && (
                     <div className="space-y-6 animate-in slide-in-from-top-2">
                        <div className="space-y-2">
                           <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground px-1">Amount Received ($)</Label>
                           <Input 
                              type="number" 
                              className="h-16 rounded-2xl font-black text-3xl bg-secondary/10 border-none px-8"
                              value={walkInAmountReceived}
                              onChange={(e) => setWalkInAmountReceived(e.target.value)}
                              placeholder="0.00"
                           />
                        </div>
                        {Number(walkInAmountReceived) >= washRate && (
                          <div className="bg-primary/5 p-8 rounded-3xl border-2 border-primary/20 flex justify-between items-center">
                             <p className="text-[10px] font-black uppercase text-primary tracking-widest">Change Due</p>
                             <p className="text-4xl font-black text-foreground">${walkInChangeAmount.toFixed(2)}</p>
                          </div>
                        )}
                     </div>
                   )}

                   {(walkInPaymentMethod === 'card' || walkInPaymentMethod === 'duitnow') && (
                     <div className="space-y-6 animate-in slide-in-from-top-2">
                        {walkInPaymentMethod === 'duitnow' && companyDoc?.duitNowQr && (
                          <div className="flex flex-col items-center bg-secondary/5 p-8 rounded-[40px] border-2 border-dashed border-primary/10">
                             <Image 
                                src={companyDoc.duitNowQr} 
                                alt="DuitNow QR" 
                                width={180} 
                                height={180} 
                                className="rounded-3xl shadow-xl border-4 border-white mb-4"
                             />
                             <p className="text-[10px] font-black text-primary uppercase tracking-widest">Scan to Pay Now</p>
                          </div>
                        )}
                        <div className="space-y-2">
                           <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground px-1">Transaction Ref / Trace ID</Label>
                           <Input 
                              placeholder="TRX-XXXXXX" 
                              className="h-14 rounded-2xl font-black text-xl bg-secondary/10 border-none px-6"
                              value={walkInRef}
                              onChange={(e) => setWalkInRef(e.target.value)}
                           />
                        </div>
                     </div>
                   )}

                   <div className="bg-primary/5 p-8 rounded-[32px] border-2 border-primary/20 flex justify-between items-end">
                      <div>
                         <p className="text-[10px] font-black uppercase text-primary tracking-widest mb-1">Total Fee</p>
                         <p className="text-5xl font-black text-foreground tracking-tighter">${washRate.toFixed(2)}</p>
                      </div>
                      <Button 
                        className="h-16 px-12 rounded-2xl font-black text-xl shadow-xl gap-2 group"
                        disabled={isProcessing || !payableSoap || payableSoap.soapStockMl < mlPerWash || !walkInName}
                        onClick={handleWalkInWash}
                      >
                         {isProcessing ? "Processing..." : (
                           <>
                             Record & Fulfill <ArrowRight className="w-6 h-6 group-hover:translate-x-1 transition-transform" />
                           </>
                         )}
                      </Button>
                   </div>
                </CardContent>
              </Card>
            </div>

            <div className="lg:col-span-1 space-y-6">
               <Card className="bg-primary border-none shadow-2xl text-primary-foreground rounded-[32px] overflow-hidden">
                  <CardHeader className="p-8 pb-4">
                     <CardTitle className="text-xl font-black">Payable Soap Level</CardTitle>
                  </CardHeader>
                  <CardContent className="p-8 pt-0 space-y-6">
                     <div className="bg-white/10 p-6 rounded-2xl">
                        <p className="text-[10px] font-black uppercase opacity-60 tracking-widest mb-1">Soap Level</p>
                        <p className="text-3xl font-black">{payableSoap ? (payableSoap.soapStockMl / 1000).toFixed(2) : 0}L</p>
                        <Progress value={payableSoap ? Math.min(100, (payableSoap.soapStockMl / payableSoap.capacityMl) * 100) : 0} className="h-2 bg-white/20 mt-3" />
                     </div>
                     <div className="flex items-center gap-3 text-xs font-bold opacity-80">
                        <ShieldCheck className="w-5 h-5" />
                        System deducting from Payable stock pool.
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
                     
                     <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest px-1">Level</label>
                          <Select value={selectedLevel} onValueChange={setSelectedLevel}>
                            <SelectTrigger className="h-12 rounded-xl font-bold">
                              <SelectValue placeholder="Lv" />
                            </SelectTrigger>
                            <SelectContent className="rounded-xl">
                              {LEVELS.map(lv => (
                                <SelectItem key={lv} value={lv.toString()}>Level {lv}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest px-1">Class</label>
                          <Select value={selectedClass} onValueChange={setSelectedClass}>
                            <SelectTrigger className="h-12 rounded-xl font-bold">
                              <SelectValue placeholder="Class" />
                            </SelectTrigger>
                            <SelectContent className="rounded-xl">
                              {CLASSES.map(cls => (
                                <SelectItem key={cls} value={cls}>{cls}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
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
                         <th className="p-6 font-black uppercase text-[10px] text-muted-foreground tracking-widest text-center">Group</th>
                         <th className="p-6 text-right font-black uppercase text-[10px] text-muted-foreground tracking-widest">Balance</th>
                         <th className="p-6 text-center font-black uppercase text-[10px] text-muted-foreground tracking-widest">Actions</th>
                       </tr>
                     </thead>
                     <tbody className="divide-y">
                       {students?.map(s => (
                         <tr key={s.id} className="hover:bg-secondary/5 transition-colors">
                           <td className="p-6">
                              <p className="font-black text-foreground text-lg">{s.name}</p>
                              <p className="text-[10px] text-muted-foreground font-bold font-mono">Matrix: {s.matrixNumber}</p>
                           </td>
                           <td className="p-6 text-center">
                              <Badge variant="outline" className="font-black text-[9px] uppercase tracking-tighter">Level {s.level} • {s.class}</Badge>
                           </td>
                           <td className="p-6 text-right">
                              <span className={cn(
                                "text-xl font-black tracking-tighter",
                                s.balance < 5 ? "text-destructive" : "text-primary"
                              )}>${s.balance.toFixed(2)}</span>
                           </td>
                           <td className="p-6 text-center">
                              <div className="flex items-center justify-center gap-2">
                                <Button variant="ghost" size="icon" className="text-primary hover:bg-primary/10 rounded-xl" onClick={() => handleOpenEdit(s)}>
                                  <Edit2 className="w-5 h-5" />
                                </Button>
                                <Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10 rounded-xl" onClick={() => handleDeleteStudent(s.id)}>
                                  <Trash2 className="w-5 h-5" />
                                </Button>
                              </div>
                           </td>
                         </tr>
                       ))}
                     </tbody>
                   </table>
                 </div>
               </div>
             </div>

             <Dialog open={isEditStudentOpen} onOpenChange={setIsEditStudentOpen}>
               <DialogContent className="rounded-[40px] max-w-lg p-0 overflow-hidden border-none shadow-2xl bg-white">
                  <div className="bg-primary p-10 text-primary-foreground">
                    <DialogTitle className="text-2xl font-black tracking-tight flex items-center gap-3">
                      <Edit2 className="w-6 h-6" /> Edit Student Info
                    </DialogTitle>
                    <DialogDescription className="text-primary-foreground/80 font-bold mt-2">
                      Updating Matrix {editingStudent?.matrixNumber}
                    </DialogDescription>
                  </div>
                  <form onSubmit={handleUpdateStudent} className="p-10 space-y-6">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest px-1">Full Name</label>
                      <Input name="name" defaultValue={editingStudent?.name} placeholder="Alice Smith" required className="h-12 rounded-xl font-bold bg-secondary/10 border-none" />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest px-1">Matrix No.</label>
                      <Input name="matrix" defaultValue={editingStudent?.matrixNumber} placeholder="2024-001" required className="h-12 rounded-xl font-bold bg-secondary/10 border-none" />
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest px-1">Level</label>
                        <Select value={editLevel} onValueChange={setEditLevel}>
                          <SelectTrigger className="h-12 rounded-xl font-bold bg-secondary/10 border-none">
                            <SelectValue placeholder="Lv" />
                          </SelectTrigger>
                          <SelectContent className="rounded-xl">
                            {LEVELS.map(lv => (
                              <SelectItem key={lv} value={lv.toString()}>Level {lv}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest px-1">Class</label>
                        <Select value={editClass} onValueChange={setEditClass}>
                          <SelectTrigger className="h-12 rounded-xl font-bold bg-secondary/10 border-none">
                            <SelectValue placeholder="Class" />
                          </SelectTrigger>
                          <SelectContent className="rounded-xl">
                            {CLASSES.map(cls => (
                              <SelectItem key={cls} value={cls}>{cls}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <Button type="submit" className="w-full h-14 rounded-2xl font-black text-lg shadow-xl mt-4">
                      Save Changes
                    </Button>
                  </form>
               </DialogContent>
             </Dialog>
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
                        <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest px-1">Soap Category</label>
                        <Select value={restockCategory} onValueChange={(v: any) => setRestockCategory(v)}>
                          <SelectTrigger className="h-12 rounded-xl font-bold">
                            <SelectValue placeholder="Select Category" />
                          </SelectTrigger>
                          <SelectContent className="rounded-xl">
                            <SelectItem value="student">Student Usage</SelectItem>
                            <SelectItem value="payable">Payable Laundry</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest px-1">No. of Bottles</label>
                        <Input name="bottles" type="number" placeholder="5" required className="h-12 rounded-xl font-bold" />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest px-1">Volume per Bottle (Litres)</label>
                        <Input name="volPerBottle" type="number" step="0.1" placeholder="5.0" required className="h-12 rounded-xl font-bold" />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest px-1">Cost per Bottle ($)</label>
                        <Input name="costPerBottle" type="number" step="0.01" placeholder="7.50" required className="h-12 rounded-xl font-bold" />
                      </div>
                      <Button type="submit" className="w-full h-14 font-black rounded-2xl shadow-xl">Apply to Stock</Button>
                    </form>
                  </CardContent>
                </Card>

                <div className="lg:col-span-3 space-y-8">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                     <Card className="p-10 border-none shadow-sm bg-primary text-primary-foreground rounded-[40px] relative overflow-hidden">
                        <Droplet className="absolute -right-4 -bottom-4 w-32 h-32 opacity-10" />
                        <p className="text-[10px] font-black uppercase tracking-widest opacity-60 mb-2">Student Soap Volume</p>
                        <h4 className="text-6xl font-black tracking-tighter">{studentSoap ? (studentSoap.soapStockMl / 1000).toFixed(2) : 0}<span className="text-2xl ml-2">Litres</span></h4>
                        <div className="mt-8 flex items-center gap-4">
                           <div className="flex-1 bg-white/20 h-3 rounded-full overflow-hidden">
                              <div className="bg-white h-full" style={{ width: `${studentSoap ? Math.min(100, (studentSoap.soapStockMl / studentSoap.capacityMl) * 100) : 0}%` }} />
                           </div>
                           <span className="text-sm font-black">{studentSoap ? (Math.min(100, (studentSoap.soapStockMl / studentSoap.capacityMl) * 100)).toFixed(0) : 0}%</span>
                        </div>
                     </Card>
                     
                     <Card className="p-10 border-none shadow-sm bg-accent text-accent-foreground rounded-[40px] relative overflow-hidden">
                        <Droplet className="absolute -right-4 -bottom-4 w-32 h-32 opacity-10" />
                        <p className="text-[10px] font-black uppercase tracking-widest opacity-60 mb-2">Payable Soap Volume</p>
                        <h4 className="text-6xl font-black tracking-tighter">{payableSoap ? (payableSoap.soapStockMl / 1000).toFixed(2) : 0}<span className="text-2xl ml-2">Litres</span></h4>
                        <div className="mt-8 flex items-center gap-4">
                           <div className="flex-1 bg-black/10 h-3 rounded-full overflow-hidden">
                              <div className="bg-black/40 h-full" style={{ width: `${payableSoap ? Math.min(100, (payableSoap.soapStockMl / payableSoap.capacityMl) * 100) : 0}%` }} />
                           </div>
                           <span className="text-sm font-black">{payableSoap ? (Math.min(100, (payableSoap.soapStockMl / payableSoap.capacityMl) * 100)).toFixed(0) : 0}%</span>
                        </div>
                     </Card>
                  </div>

                  <Card className="p-10 border-none shadow-sm bg-white rounded-[40px]">
                    <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest mb-4">Inventory Pricing Overview</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      <div>
                        <p className="text-[10px] font-black uppercase text-primary tracking-widest mb-1">Student Stock Cost</p>
                        <h4 className="text-4xl font-black text-foreground">${studentSoap ? studentSoap.soapCostPerLitre.toFixed(2) : '0.00'}<span className="text-lg ml-2 text-muted-foreground">/ Litre</span></h4>
                      </div>
                      <div>
                        <p className="text-[10px] font-black uppercase text-accent tracking-widest mb-1">Payable Stock Cost</p>
                        <h4 className="text-4xl font-black text-foreground">${payableSoap ? payableSoap.soapCostPerLitre.toFixed(2) : '0.00'}<span className="text-lg ml-2 text-muted-foreground">/ Litre</span></h4>
                      </div>
                    </div>
                    <p className="mt-8 text-sm font-bold text-muted-foreground">Weighted average based on categorized restocking logs.</p>
                  </Card>
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
             </div>
          </TabsContent>

          <TabsContent value="billing">
            <div className="max-w-xl mx-auto space-y-8 py-12">
               <div className="text-center">
                 <h2 className="text-3xl font-black text-foreground">Laundry Billing Config</h2>
                 <p className="text-muted-foreground mt-2">Manage digital payment collection QR</p>
               </div>

               <Card className="border-none shadow-sm rounded-[32px] bg-white overflow-hidden">
                 <CardHeader className="bg-primary/10 p-8">
                   <CardTitle className="text-lg font-black flex items-center gap-2">
                     <QrCode className="w-5 h-5 text-primary" />
                     DuitNow Settlement Profile
                   </CardTitle>
                 </CardHeader>
                 <CardContent className="p-10 flex flex-col items-center gap-8">
                   {companyDoc?.duitNowQr ? (
                     <div className="relative group">
                       <Image 
                        src={companyDoc.duitNowQr} 
                        alt="DuitNow QR" 
                        width={250} 
                        height={250} 
                        className="rounded-3xl shadow-2xl border-4 border-white"
                       />
                       <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-3xl">
                         <Button variant="secondary" className="rounded-xl font-black" asChild>
                           <label className="cursor-pointer">
                             <Upload className="w-4 h-4 mr-2" /> Replace QR
                             <input type="file" className="hidden" accept="image/*" onChange={handleQrUpload} />
                           </label>
                         </Button>
                       </div>
                     </div>
                   ) : (
                     <label className="w-64 h-64 border-4 border-dashed rounded-[40px] flex flex-col items-center justify-center cursor-pointer hover:bg-secondary/20 transition-all gap-4">
                       <div className="w-16 h-16 bg-secondary rounded-2xl flex items-center justify-center text-primary">
                         <QrCode className="w-8 h-8" />
                       </div>
                       <p className="text-xs font-black uppercase text-muted-foreground tracking-widest">Upload Static QR</p>
                       <input type="file" className="hidden" accept="image/*" onChange={handleQrUpload} />
                     </label>
                   )}
                   <p className="text-xs text-center font-bold text-muted-foreground max-w-xs">
                     This QR code will be shown during top-up and walk-in sessions when DuitNow is chosen as the payment method.
                   </p>
                 </CardContent>
               </Card>
             </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

function PaymentOption({ value, label, icon: Icon, id }: any) {
  return (
    <div>
      <RadioGroupItem value={value} id={id} className="peer sr-only" />
      <Label htmlFor={id} className="flex flex-col items-center justify-center rounded-[24px] border-4 border-transparent bg-secondary/20 p-4 hover:bg-secondary/30 peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/5 cursor-pointer transition-all h-28">
        <Icon className="mb-2 h-7 w-7 text-primary" />
        <span className="text-[10px] font-black uppercase tracking-widest">{label}</span>
      </Label>
    </div>
  );
}
