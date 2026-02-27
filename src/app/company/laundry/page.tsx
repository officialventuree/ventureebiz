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
  ArrowRight,
  CalendarDays,
  Plus,
  ArrowUpRight,
  Settings2
} from 'lucide-react';
import { useAuth } from '@/components/auth-context';
import { useFirestore, useCollection, useMemoFirebase, useDoc } from '@/firebase';
import { collection, doc, setDoc, addDoc, updateDoc, increment, deleteDoc, query, where, getDocs } from 'firebase/firestore';
import { useState, useMemo } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LaundryStudent, SaleTransaction, LaundryInventory, Company, PaymentMethod, LaundryLevelConfig, LaundrySchedule } from '@/lib/types';
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

  // Schedule State
  const [isScheduleOpen, setIsScheduleOpen] = useState(false);
  const [scheduleLevel, setScheduleLevel] = useState<string>('');

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

  const configQuery = useMemoFirebase(() => {
    if (!firestore || !user?.companyId) return null;
    return collection(firestore, 'companies', user.companyId, 'laundryLevelConfigs');
  }, [firestore, user?.companyId]);

  const scheduleQuery = useMemoFirebase(() => {
    if (!firestore || !user?.companyId) return null;
    return collection(firestore, 'companies', user.companyId, 'laundrySchedules');
  }, [firestore, user?.companyId]);

  const companyRef = useMemoFirebase(() => {
    if (!firestore || !user?.companyId) return null;
    return doc(firestore, 'companies', user.companyId);
  }, [firestore, user?.companyId]);

  const { data: students } = useCollection<LaundryStudent>(studentsQuery);
  const { data: transactions } = useCollection<SaleTransaction>(transactionsQuery);
  const { data: inventoryItems } = useCollection<LaundryInventory>(inventoryQuery);
  const { data: levelConfigs } = useCollection<LaundryLevelConfig>(configQuery);
  const { data: schedules } = useCollection<LaundrySchedule>(scheduleQuery);
  const { data: companyDoc } = useDoc<Company>(companyRef);

  const studentSoap = inventoryItems?.find(i => i.id === 'student_soap');
  const payableSoap = inventoryItems?.find(i => i.id === 'payable_soap');

  const mlPerWash = 50;
  const defaultWashRate = 5.00;

  const getWashRateForLevel = (level: number) => {
    const config = levelConfigs?.find(c => c.level === level);
    if (config && config.totalWashesAllowed > 0) {
      return config.subscriptionFee / config.totalWashesAllowed;
    }
    return defaultWashRate;
  };

  const isLevelAllowedToday = (level: number) => {
    const today = new Date().toISOString().split('T')[0];
    return schedules?.some(s => s.date === today && s.level === level);
  };

  const foundTopUpStudent = useMemo(() => {
    return students?.find(s => s.matrixNumber === topUpMatrix);
  }, [students, topUpMatrix]);

  const changeAmount = topUpPaymentMethod === 'cash' ? Math.max(0, (Number(amountReceived) || 0) - (Number(topUpAmount) || 0)) : 0;
  const walkInChangeAmount = walkInPaymentMethod === 'cash' ? Math.max(0, (Number(walkInAmountReceived) || 0) - defaultWashRate) : 0;

  const handleRegisterStudent = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!firestore || !user?.companyId) return;
    const formData = new FormData(e.currentTarget);
    const studentId = crypto.randomUUID();
    
    if (!selectedLevel || !selectedClass) {
      toast({ title: "Registration incomplete", description: "Please select Level and Class.", variant: "destructive" });
      return;
    }

    const initialBalance = Number(formData.get('initialBalance')) || 0;

    const student: LaundryStudent = {
      id: studentId,
      companyId: user.companyId,
      name: formData.get('name') as string,
      matrixNumber: formData.get('matrix') as string,
      balance: initialBalance,
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

  const handleUpdateLevelConfig = async (e: React.FormEvent<HTMLFormElement>, level: number) => {
    e.preventDefault();
    if (!firestore || !user?.companyId) return;
    const formData = new FormData(e.currentTarget);
    const fee = Number(formData.get('fee'));
    const quota = Number(formData.get('quota'));
    const id = `level_${level}`;

    try {
      await setDoc(doc(firestore, 'companies', user.companyId, 'laundryLevelConfigs', id), {
        id,
        companyId: user.companyId,
        level,
        subscriptionFee: fee,
        totalWashesAllowed: quota
      });
      toast({ title: "Level Config Updated", description: `Quota settings for Level ${level} saved.` });
    } catch (e: any) {
      toast({ title: "Update failed", variant: "destructive" });
    }
  };

  const handleAddSchedule = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!firestore || !user?.companyId || !scheduleLevel) return;
    const formData = new FormData(e.currentTarget);
    const date = formData.get('date') as string;
    const id = crypto.randomUUID();

    try {
      await setDoc(doc(firestore, 'companies', user.companyId, 'laundrySchedules', id), {
        id,
        companyId: user.companyId,
        date,
        level: Number(scheduleLevel)
      });
      toast({ title: "Date Scheduled", description: `Level ${scheduleLevel} assigned for ${date}.` });
      setIsScheduleOpen(false);
      setScheduleLevel('');
    } catch (e: any) {
      toast({ title: "Scheduling failed", variant: "destructive" });
    }
  };

  const handleChargeLaundry = async () => {
    if (!selectedStudent || !firestore || !user?.companyId || !studentSoap) return;
    
    const washRate = getWashRateForLevel(selectedStudent.level);
    
    if (!isLevelAllowedToday(selectedStudent.level)) {
      toast({ title: "Access Denied", description: `Level ${selectedStudent.level} is not scheduled for today.`, variant: "destructive" });
      return;
    }

    if (selectedStudent.balance < washRate) {
      toast({ title: "Insufficient Funds", description: "Top-up required.", variant: "destructive" });
      return;
    }

    if (studentSoap.soapStockMl < mlPerWash) {
       toast({ title: "Out of Student Soap", description: "Please refill student soap inventory.", variant: "destructive" });
       return;
    }

    setIsProcessing(true);

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
        items: [{ name: `Standard Wash (Lv ${selectedStudent.level})`, price: washRate, quantity: 1, soapUsedMl: mlPerWash }]
      });

      toast({ title: "Wash Recorded", description: `Charged $${washRate.toFixed(2)} to ${selectedStudent.name}.` });
      setSelectedStudent({ ...selectedStudent, balance: selectedStudent.balance - washRate });
    } catch (e: any) {
      toast({ title: "Processing Error", variant: "destructive" });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleWalkInWash = async () => {
    if (!firestore || !user?.companyId || !walkInName || !payableSoap) {
      toast({ title: "Incomplete Form", description: "Customer name is required.", variant: "destructive" });
      return;
    }
    
    if (payableSoap.soapStockMl < mlPerWash) {
       toast({ title: "Out of Payable Soap", description: "Please refill payable soap inventory.", variant: "destructive" });
       return;
    }

    if (walkInPaymentMethod === 'cash' && (Number(walkInAmountReceived) || 0) < defaultWashRate) {
      toast({ title: "Insufficient Cash", description: "Amount received is less than wash rate.", variant: "destructive" });
      return;
    }

    setIsProcessing(true);

    try {
      const invRef = doc(firestore, 'companies', user.companyId, 'laundryInventory', 'payable_soap');
      await updateDoc(invRef, { soapStockMl: increment(-mlPerWash) });

      const soapCost = (mlPerWash / 1000) * payableSoap.soapCostPerLitre;
      const profit = defaultWashRate - soapCost;

      const transactionRef = collection(firestore, 'companies', user.companyId, 'transactions');
      await addDoc(transactionRef, {
        id: crypto.randomUUID(),
        companyId: user.companyId,
        module: 'laundry',
        totalAmount: defaultWashRate,
        profit: profit,
        timestamp: new Date().toISOString(),
        customerName: walkInName,
        paymentMethod: walkInPaymentMethod,
        referenceNumber: walkInRef || undefined,
        status: 'completed',
        items: [{ name: 'Standard Wash (Walk-in)', price: defaultWashRate, quantity: 1, soapUsedMl: mlPerWash }]
      });

      toast({ title: "Wash Recorded", description: `Payment collected from ${walkInName}.` });
      
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
            <p className="text-muted-foreground font-medium">Student Subscriptions & Schedule Logistics</p>
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
            <TabsTrigger value="students" className="rounded-lg gap-2">
              <UserPlus className="w-4 h-4" /> Students
            </TabsTrigger>
            <TabsTrigger value="schedule" className="rounded-lg gap-2">
              <CalendarDays className="w-4 h-4" /> Schedule
            </TabsTrigger>
            <TabsTrigger value="walkin" className="rounded-lg gap-2">
              <Banknote className="w-4 h-4" /> Walk-In
            </TabsTrigger>
            <TabsTrigger value="consumables" className="rounded-lg gap-2">
              <Droplet className="w-4 h-4" /> Consumables
            </TabsTrigger>
            <TabsTrigger value="profits" className="rounded-lg gap-2">
              <TrendingUp className="w-4 h-4" /> Profits
            </TabsTrigger>
            <TabsTrigger value="billing" className="rounded-lg gap-2">
              <Settings2 className="w-4 h-4" /> Billing
            </TabsTrigger>
          </TabsList>

          <TabsContent value="pos" className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-6">
              <Card className="border-none shadow-sm bg-white rounded-3xl overflow-hidden">
                <CardHeader className="bg-secondary/10 p-8">
                  <CardTitle className="text-xl font-black">Usage Terminal (Student)</CardTitle>
                  <CardDescription className="font-bold">Verify student identity and check schedule authorization</CardDescription>
                </CardHeader>
                <CardContent className="p-8 space-y-6">
                  <div className="flex gap-2">
                    <Input 
                      placeholder="SCAN STUDENT MATRIX..." 
                      className="h-16 rounded-2xl text-2xl font-black border-2 border-primary/20 bg-secondary/5"
                      value={matrixSearch}
                      onChange={(e) => setMatrixSearch(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && (students?.find(s => s.matrixNumber === matrixSearch) ? setSelectedStudent(students.find(s => s.matrixNumber === matrixSearch)!) : toast({ title: "No Record", variant: "destructive" }))}
                    />
                    <Button onClick={() => {
                       const found = students?.find(s => s.matrixNumber === matrixSearch);
                       if (found) setSelectedStudent(found);
                       else toast({ title: "No Record", variant: "destructive" });
                    }} size="lg" className="rounded-2xl px-10 h-16 font-black text-lg">Search</Button>
                  </div>

                  {selectedStudent ? (
                    <div className="p-10 bg-primary/5 rounded-[32px] border-4 border-primary/10 space-y-8 relative overflow-hidden group">
                      <div className="flex justify-between items-start relative z-10">
                        <div>
                          <p className="text-[10px] font-black text-primary uppercase tracking-widest mb-1">Subscriber: Level {selectedStudent.level}</p>
                          <h4 className="text-4xl font-black text-foreground tracking-tighter">{selectedStudent.name}</h4>
                          <p className="text-sm font-bold text-muted-foreground mt-1">Matrix: {selectedStudent.matrixNumber}</p>
                          {!isLevelAllowedToday(selectedStudent.level) && (
                            <Badge variant="destructive" className="mt-4 font-black">Not scheduled for today</Badge>
                          )}
                        </div>
                        <div className="text-right">
                          <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1">Account Balance</p>
                          <p className={cn(
                            "text-5xl font-black tracking-tighter",
                            selectedStudent.balance < getWashRateForLevel(selectedStudent.level) ? "text-destructive" : "text-primary"
                          )}>${selectedStudent.balance.toFixed(2)}</p>
                          <p className="text-[10px] font-bold text-muted-foreground">Rate: ${getWashRateForLevel(selectedStudent.level).toFixed(2)}</p>
                        </div>
                      </div>
                      
                      <Button 
                        className="w-full h-16 rounded-2xl text-xl font-black shadow-xl" 
                        onClick={handleChargeLaundry} 
                        disabled={isProcessing || !isLevelAllowedToday(selectedStudent.level) || selectedStudent.balance < getWashRateForLevel(selectedStudent.level)}
                      >
                        {isProcessing ? "Processing..." : `Process Wash ($${getWashRateForLevel(selectedStudent.level).toFixed(2)})`}
                      </Button>
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
                    <History className="w-4 h-4 text-primary" /> Recent History
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="divide-y">
                    {laundryTransactions.slice().reverse().slice(0, 5).map(t => (
                      <div key={t.id} className="flex items-center justify-between p-5 hover:bg-secondary/5 transition-colors">
                        <div>
                          <p className="text-sm font-black text-foreground">{t.items[0].name}</p>
                          <p className="text-[10px] text-muted-foreground font-bold">{new Date(t.timestamp).toLocaleString()}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-black text-primary text-lg">${t.totalAmount.toFixed(2)}</p>
                          <p className="text-[10px] font-bold text-muted-foreground">{t.customerName}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="lg:col-span-1 space-y-6">
              <Card className="bg-primary border-none shadow-2xl text-primary-foreground rounded-[32px] overflow-hidden p-8">
                <CardTitle className="flex items-center gap-3 text-xl font-black mb-6">
                  <CalendarDays className="w-6 h-6" />
                  Today's Schedule
                </CardTitle>
                <div className="space-y-4">
                  {LEVELS.map(lv => {
                    const isAllowed = isLevelAllowedToday(lv);
                    return (
                      <div key={lv} className={cn(
                        "p-4 rounded-2xl flex justify-between items-center",
                        isAllowed ? "bg-white/20" : "bg-black/10 opacity-50"
                      )}>
                        <p className="font-black">Level {lv}</p>
                        {isAllowed ? (
                          <Badge className="bg-white text-primary font-black">Authorized</Badge>
                        ) : (
                          <span className="text-[10px] font-bold uppercase tracking-widest">Locked</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="students" className="space-y-8">
             <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
               <Card className="lg:col-span-1 h-fit border-none shadow-sm rounded-3xl bg-white p-8">
                 <CardHeader className="px-0 pt-0">
                   <CardTitle className="text-xl font-black">Enroll Student</CardTitle>
                   <CardDescription className="font-bold">Institutional laundry registry</CardDescription>
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
                       <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest px-1">Initial Balance ($)</label>
                       <Input name="initialBalance" type="number" placeholder="50.00" className="h-12 rounded-xl font-bold" />
                     </div>
                     <Button type="submit" className="w-full h-14 font-black rounded-2xl shadow-xl">Confirm Enrollment</Button>
                   </form>
                 </CardContent>
               </Card>

               <div className="lg:col-span-3 space-y-6">
                 <Card className="border-none shadow-sm bg-white rounded-3xl overflow-hidden">
                   <CardHeader className="bg-secondary/10 p-6">
                     <CardTitle className="text-lg font-black flex items-center gap-2">
                       <Settings2 className="w-5 h-5 text-primary" /> Level Quota Configuration
                     </CardTitle>
                     <CardDescription className="font-bold">Set "Required Fee" and "Usage Limit" per student level to auto-calculate service fees.</CardDescription>
                   </CardHeader>
                   <CardContent className="p-6 grid grid-cols-1 md:grid-cols-5 gap-4">
                     {LEVELS.map(lv => {
                       const config = levelConfigs?.find(c => c.level === lv);
                       return (
                         <form key={lv} onSubmit={(e) => handleUpdateLevelConfig(e, lv)} className="space-y-3 p-4 bg-secondary/10 rounded-2xl border-2 border-transparent hover:border-primary/20 transition-all flex flex-col justify-between">
                            <div>
                               <p className="text-xs font-black uppercase text-primary mb-2">Level {lv}</p>
                               <div className="space-y-2">
                                  <div className="space-y-1">
                                     <Label className="text-[9px] font-black uppercase text-muted-foreground px-1">Required Fee ($)</Label>
                                     <Input name="fee" type="number" step="0.01" defaultValue={config?.subscriptionFee} placeholder="50.00" className="h-8 text-xs font-bold" />
                                  </div>
                                  <div className="space-y-1">
                                     <Label className="text-[9px] font-black uppercase text-muted-foreground px-1">Usage Limit (qty)</Label>
                                     <Input name="quota" type="number" defaultValue={config?.totalWashesAllowed} placeholder="10" className="h-8 text-xs font-bold" />
                                  </div>
                               </div>
                            </div>
                            <Button size="sm" type="submit" className="w-full h-8 font-black text-[10px] uppercase mt-4">Update Lv{lv}</Button>
                         </form>
                       );
                     })}
                   </CardContent>
                 </Card>

                 <div className="rounded-[32px] bg-white border shadow-sm overflow-hidden">
                   <div className="p-6 border-b flex justify-between items-center bg-secondary/5">
                      <h3 className="font-black text-lg">Laundry Accounts List</h3>
                      <Badge variant="outline" className="font-black">{students?.length || 0} Records</Badge>
                   </div>
                   <table className="w-full text-sm text-left">
                     <thead className="bg-secondary/10 border-b">
                       <tr>
                         <th className="p-4 font-black uppercase text-[10px] text-muted-foreground tracking-widest">Subscriber</th>
                         <th className="p-4 font-black uppercase text-[10px] text-muted-foreground tracking-widest text-center">Group</th>
                         <th className="p-4 font-black uppercase text-[10px] text-muted-foreground tracking-widest">Fee / Service</th>
                         <th className="p-4 text-right font-black uppercase text-[10px] text-muted-foreground tracking-widest">Balance Info</th>
                         <th className="p-4 text-center font-black uppercase text-[10px] text-muted-foreground tracking-widest">Actions</th>
                       </tr>
                     </thead>
                     <tbody className="divide-y">
                       {students?.map(s => {
                         const washRate = getWashRateForLevel(s.level);
                         const washesLeft = washRate > 0 ? Math.floor(s.balance / washRate) : 0;
                         return (
                           <tr key={s.id} className="hover:bg-secondary/5 transition-colors">
                             <td className="p-4">
                                <p className="font-black text-foreground">{s.name}</p>
                                <p className="text-[10px] text-muted-foreground font-bold">Matrix: {s.matrixNumber}</p>
                             </td>
                             <td className="p-4 text-center">
                                <Badge variant="outline" className="font-black text-[9px] uppercase">Level {s.level} • {s.class}</Badge>
                             </td>
                             <td className="p-4">
                                <p className="font-black text-primary">${washRate.toFixed(2)}</p>
                                <p className="text-[9px] text-muted-foreground font-bold uppercase">Calculated</p>
                             </td>
                             <td className="p-4 text-right">
                                <p className="font-black text-lg">${s.balance.toFixed(2)}</p>
                                <p className={cn("text-[9px] font-black uppercase", washesLeft <= 1 ? "text-destructive" : "text-muted-foreground")}>
                                   {washesLeft} washes remaining
                                </p>
                             </td>
                             <td className="p-4 text-center">
                                <div className="flex items-center justify-center gap-1">
                                  <Button variant="ghost" size="icon" className="h-8 w-8 text-primary" onClick={() => {
                                    setEditingStudent(s);
                                    setEditLevel(s.level.toString());
                                    setEditClass(s.class);
                                    setIsEditStudentOpen(true);
                                  }}><Edit2 className="w-4 h-4" /></Button>
                                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={async () => {
                                    if (confirm("Remove this student account?")) {
                                      await deleteDoc(doc(firestore!, 'companies', user!.companyId!, 'laundryStudents', s.id));
                                    }
                                  }}><Trash2 className="w-4 h-4" /></Button>
                                </div>
                             </td>
                           </tr>
                         );
                       })}
                     </tbody>
                   </table>
                 </div>
               </div>
             </div>
          </TabsContent>

          <TabsContent value="schedule" className="space-y-6">
             <div className="flex justify-between items-center">
                <div>
                   <h3 className="text-2xl font-black">Institutional Schedule</h3>
                   <p className="text-sm text-muted-foreground font-medium">Designate authorized usage days per level.</p>
                </div>
                <Dialog open={isScheduleOpen} onOpenChange={setIsScheduleOpen}>
                   <DialogTrigger asChild>
                      <Button className="rounded-xl font-black shadow-lg gap-2 h-12 px-6">
                         <Plus className="w-4 h-4" /> Add Usage Date
                      </Button>
                   </DialogTrigger>
                   <DialogContent className="rounded-[32px] max-w-lg p-0 overflow-hidden bg-white">
                      <div className="bg-primary p-8 text-primary-foreground"><DialogTitle className="text-xl font-black">Assign Usage Date</DialogTitle></div>
                      <form onSubmit={handleAddSchedule} className="p-10 space-y-6">
                         <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground px-1">Target Date</Label>
                            <Input name="date" type="date" required className="h-12 rounded-xl font-bold bg-secondary/10 border-none" />
                         </div>
                         <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground px-1">Authorized Level</Label>
                            <Select value={scheduleLevel} onValueChange={setScheduleLevel}>
                               <SelectTrigger className="h-12 rounded-xl font-bold bg-secondary/10 border-none">
                                  <SelectValue placeholder="Select Level" />
                               </SelectTrigger>
                               <SelectContent className="rounded-xl font-bold">
                                  {LEVELS.map(lv => (
                                    <SelectItem key={lv} value={lv.toString()}>Level {lv}</SelectItem>
                                  ))}
                               </SelectContent>
                            </Select>
                         </div>
                         <Button type="submit" className="w-full h-14 rounded-2xl font-black text-lg shadow-xl">Confirm Schedule</Button>
                      </form>
                   </DialogContent>
                </Dialog>
             </div>

             <div className="bg-white rounded-[32px] border shadow-sm overflow-hidden">
                <table className="w-full text-sm text-left">
                   <thead className="bg-secondary/10 border-b">
                      <tr>
                         <th className="p-6 font-black uppercase text-[10px] tracking-widest">Date</th>
                         <th className="p-6 font-black uppercase text-[10px] tracking-widest text-center">Authorized Level</th>
                         <th className="p-6 text-center font-black uppercase text-[10px] tracking-widest">Actions</th>
                      </tr>
                   </thead>
                   <tbody className="divide-y">
                      {schedules?.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map(s => (
                        <tr key={s.id} className="hover:bg-secondary/5 transition-colors">
                           <td className="p-6 font-black text-lg">{new Date(s.date).toLocaleDateString([], { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</td>
                           <td className="p-6 text-center">
                              <Badge className="font-black px-4 py-1 h-8 rounded-lg">Level {s.level}</Badge>
                           </td>
                           <td className="p-6 text-center">
                              <Button variant="ghost" size="icon" className="text-destructive h-10 w-10" onClick={async () => {
                                if (confirm("Remove this scheduled date?")) {
                                  await deleteDoc(doc(firestore!, 'companies', user!.companyId!, 'laundrySchedules', s.id));
                                }
                              }}><Trash2 className="w-5 h-5" /></Button>
                           </td>
                        </tr>
                      ))}
                      {(!schedules || schedules.length === 0) && (
                        <tr>
                           <td colSpan={3} className="py-24 text-center opacity-30">
                              <CalendarDays className="w-16 h-16 mx-auto mb-4" />
                              <p className="font-black uppercase tracking-widest">No dates scheduled</p>
                           </td>
                        </tr>
                      )}
                   </tbody>
                </table>
             </div>
          </TabsContent>

          <TabsContent value="walkin" className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-6">
              <Card className="border-none shadow-sm bg-white rounded-[32px] overflow-hidden">
                <CardHeader className="bg-secondary/10 p-8">
                  <CardTitle className="text-xl font-black flex items-center gap-2">
                    <Banknote className="w-6 h-6 text-primary" /> Payable Wash Terminal
                  </CardTitle>
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
                        {Number(walkInAmountReceived) >= defaultWashRate && (
                          <div className="bg-primary/5 p-8 rounded-3xl border-2 border-primary/20 flex justify-between items-center">
                             <p className="text-[10px] font-black uppercase text-primary tracking-widest">Change Due</p>
                             <p className="text-4xl font-black text-foreground">${walkInChangeAmount.toFixed(2)}</p>
                          </div>
                        )}
                     </div>
                   )}

                   <div className="bg-primary/5 p-8 rounded-[32px] border-2 border-primary/20 flex justify-between items-end">
                      <div>
                         <p className="text-[10px] font-black uppercase text-primary tracking-widest mb-1">Total Fee</p>
                         <p className="text-5xl font-black text-foreground tracking-tighter">${defaultWashRate.toFixed(2)}</p>
                      </div>
                      <Button 
                        className="h-16 px-12 rounded-2xl font-black text-xl shadow-xl gap-2 group"
                        disabled={isProcessing || !payableSoap || payableSoap.soapStockMl < mlPerWash || !walkInName}
                        onClick={handleWalkInWash}
                      >
                         {isProcessing ? "Processing..." : "Record & Fulfill"}
                      </Button>
                   </div>
                </CardContent>
              </Card>
            </div>

            <div className="lg:col-span-1 space-y-6">
               <Card className="bg-primary border-none shadow-2xl text-primary-foreground rounded-[32px] overflow-hidden p-8">
                  <CardTitle className="text-xl font-black mb-6">Payable Soap Pool</CardTitle>
                  <div className="bg-white/10 p-6 rounded-2xl">
                     <p className="text-[10px] font-black uppercase opacity-60 tracking-widest mb-1">Stock Level</p>
                     <p className="text-3xl font-black">{payableSoap ? (payableSoap.soapStockMl / 1000).toFixed(2) : 0}L</p>
                     <Progress value={payableSoap ? Math.min(100, (payableSoap.soapStockMl / payableSoap.capacityMl) * 100) : 0} className="h-2 bg-white/20 mt-3" />
                  </div>
               </Card>
            </div>
          </TabsContent>

          <TabsContent value="consumables">
             <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                <Card className="lg:col-span-1 border-none shadow-sm rounded-3xl bg-white p-8">
                  <CardHeader className="p-0 mb-6">
                    <CardTitle className="text-xl font-black">Restock Supply</CardTitle>
                    <CardDescription className="font-bold">Record chemical procurement</CardDescription>
                  </CardHeader>
                  <form onSubmit={async (e) => {
                    e.preventDefault();
                    if (!firestore || !user?.companyId) return;
                    const formData = new FormData(e.currentTarget);
                    const bottles = Number(formData.get('bottles'));
                    const volPerBottle = Number(formData.get('volPerBottle'));
                    const costPerBottle = Number(formData.get('costPerBottle'));
                    const amountMl = bottles * volPerBottle * 1000;
                    const totalCost = bottles * costPerBottle;
                    const docId = restockCategory === 'student' ? 'student_soap' : 'payable_soap';

                    const existing = restockCategory === 'student' ? studentSoap : payableSoap;
                    if (!existing) {
                      await setDoc(doc(firestore, 'companies', user.companyId, 'laundryInventory', docId), {
                        id: docId,
                        companyId: user.companyId,
                        soapStockMl: amountMl,
                        soapCostPerLitre: totalCost / (bottles * volPerBottle),
                        capacityMl: 50000,
                        category: restockCategory
                      });
                    } else {
                      await updateDoc(doc(firestore, 'companies', user.companyId, 'laundryInventory', docId), {
                        soapStockMl: increment(amountMl),
                        soapCostPerLitre: totalCost / (bottles * volPerBottle)
                      });
                    }
                    await addDoc(collection(firestore, 'companies', user.companyId, 'purchases'), {
                      id: crypto.randomUUID(),
                      companyId: user.companyId,
                      amount: totalCost,
                      description: `Soap Refill (${restockCategory})`,
                      timestamp: new Date().toISOString()
                    });
                    toast({ title: "Restocked" });
                    (e.target as HTMLFormElement).reset();
                  }} className="space-y-4">
                    <Select value={restockCategory} onValueChange={(v: any) => setRestockCategory(v)}>
                      <SelectTrigger className="rounded-xl font-bold">
                        <SelectValue placeholder="Category" />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl font-bold">
                        <SelectItem value="student">Student Stock</SelectItem>
                        <SelectItem value="payable">Payable Stock</SelectItem>
                      </SelectContent>
                    </Select>
                    <Input name="bottles" type="number" placeholder="Bottles" required className="rounded-xl" />
                    <Input name="volPerBottle" type="number" step="0.1" placeholder="Litres/Bottle" required className="rounded-xl" />
                    <Input name="costPerBottle" type="number" step="0.01" placeholder="Cost/Bottle" required className="rounded-xl" />
                    <Button type="submit" className="w-full h-12 font-black rounded-xl">Add to Inventory</Button>
                  </form>
                </Card>

                <div className="lg:col-span-3 grid grid-cols-1 md:grid-cols-2 gap-8">
                   <Card className="p-10 border-none shadow-sm bg-primary text-primary-foreground rounded-[40px]">
                      <p className="text-[10px] font-black uppercase opacity-60 mb-2">Student Soap Pool</p>
                      <h4 className="text-6xl font-black tracking-tighter">{studentSoap ? (studentSoap.soapStockMl / 1000).toFixed(2) : 0}L</h4>
                      <Progress value={studentSoap ? (studentSoap.soapStockMl / studentSoap.capacityMl) * 100 : 0} className="h-2 bg-white/20 mt-6" />
                   </Card>
                   <Card className="p-10 border-none shadow-sm bg-accent text-accent-foreground rounded-[40px]">
                      <p className="text-[10px] font-black uppercase opacity-60 mb-2">Payable Soap Pool</p>
                      <h4 className="text-6xl font-black tracking-tighter">{payableSoap ? (payableSoap.soapStockMl / 1000).toFixed(2) : 0}L</h4>
                      <Progress value={payableSoap ? (payableSoap.soapStockMl / payableSoap.capacityMl) * 100 : 0} className="h-2 bg-black/10 mt-6" />
                   </Card>
                </div>
             </div>
          </TabsContent>

          <TabsContent value="profits">
             <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="p-10 border-none shadow-sm bg-white rounded-[40px]">
                   <p className="text-[10px] font-black uppercase text-muted-foreground mb-4">Total Revenue</p>
                   <h4 className="text-5xl font-black tracking-tighter">${totalRevenue.toFixed(2)}</h4>
                </Card>
                <Card className="p-10 border-none shadow-sm bg-white rounded-[40px]">
                   <p className="text-[10px] font-black uppercase text-muted-foreground mb-4">Chemical Cost</p>
                   <h4 className="text-5xl font-black tracking-tighter text-destructive">-${totalSoapCost.toFixed(2)}</h4>
                </Card>
                <Card className="p-10 border-none shadow-sm bg-white rounded-[40px]">
                   <p className="text-[10px] font-black uppercase text-muted-foreground mb-4">Net Profit</p>
                   <h4 className="text-5xl font-black tracking-tighter text-primary">${totalProfit.toFixed(2)}</h4>
                </Card>
             </div>
          </TabsContent>

          <TabsContent value="billing">
            <div className="max-w-xl mx-auto py-12">
               <Card className="border-none shadow-sm rounded-[32px] bg-white overflow-hidden p-10 text-center space-y-8">
                 <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center text-primary mx-auto">
                    <QrCode className="w-8 h-8" />
                 </div>
                 <h2 className="text-2xl font-black">Settlement Profile</h2>
                 <p className="text-sm text-muted-foreground font-medium">Upload your business DuitNow QR to enable digital student top-ups.</p>
                 {companyDoc?.duitNowQr ? (
                   <div className="relative group mx-auto w-fit">
                     <Image src={companyDoc.duitNowQr} alt="QR" width={250} height={250} className="rounded-3xl border-4" />
                     <label className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center rounded-3xl cursor-pointer transition-opacity">
                        <Upload className="text-white w-8 h-8" />
                        <input type="file" className="hidden" accept="image/*" onChange={async (e) => {
                           const file = e.target.files?.[0];
                           if (!file) return;
                           const reader = new FileReader();
                           reader.onloadend = async () => {
                             await updateDoc(doc(firestore!, 'companies', user!.companyId!), { duitNowQr: reader.result });
                             toast({ title: "QR Updated" });
                           };
                           reader.readAsDataURL(file);
                        }} />
                     </label>
                   </div>
                 ) : (
                   <label className="w-64 h-64 border-4 border-dashed rounded-[40px] flex flex-col items-center justify-center mx-auto cursor-pointer hover:bg-secondary/20 transition-all gap-4">
                      <Plus className="w-8 h-8 text-primary" />
                      <p className="text-xs font-black uppercase">Upload DuitNow QR</p>
                      <input type="file" className="hidden" accept="image/*" onChange={async (e) => {
                         const file = e.target.files?.[0];
                         if (!file) return;
                         const reader = new FileReader();
                         reader.onloadend = async () => {
                           await updateDoc(doc(firestore!, 'companies', user!.companyId!), { duitNowQr: reader.result });
                           toast({ title: "QR Uploaded" });
                         };
                         reader.readAsDataURL(file);
                      }} />
                   </label>
                 )}
               </Card>
            </div>
          </TabsContent>
        </Tabs>
      </main>

      <Dialog open={isEditStudentOpen} onOpenChange={setIsEditStudentOpen}>
        <DialogContent className="rounded-[40px] max-w-lg p-0 overflow-hidden bg-white">
          <div className="bg-primary p-8 text-primary-foreground"><DialogTitle className="text-xl font-black">Edit Student Profile</DialogTitle></div>
          <form onSubmit={async (e) => {
            e.preventDefault();
            if (!firestore || !user?.companyId || !editingStudent) return;
            const formData = new FormData(e.currentTarget);
            await updateDoc(doc(firestore, 'companies', user.companyId, 'laundryStudents', editingStudent.id), {
              name: formData.get('name'),
              matrixNumber: formData.get('matrix'),
              level: Number(editLevel),
              class: editClass
            });
            toast({ title: "Profile Updated" });
            setIsEditStudentOpen(false);
          }} className="p-10 space-y-6">
            <Input name="name" defaultValue={editingStudent?.name} placeholder="Name" required className="rounded-xl font-bold" />
            <Input name="matrix" defaultValue={editingStudent?.matrixNumber} placeholder="Matrix" required className="rounded-xl font-bold" />
            <div className="grid grid-cols-2 gap-4">
              <Select value={editLevel} onValueChange={setEditLevel}>
                <SelectTrigger className="rounded-xl font-bold"><SelectValue placeholder="Lv" /></SelectTrigger>
                <SelectContent className="rounded-xl">
                  {LEVELS.map(lv => (<SelectItem key={lv} value={lv.toString()}>Level {lv}</SelectItem>))}
                </SelectContent>
              </Select>
              <Select value={editClass} onValueChange={setEditClass}>
                <SelectTrigger className="rounded-xl font-bold"><SelectValue placeholder="Class" /></SelectTrigger>
                <SelectContent className="rounded-xl">
                  {CLASSES.map(cls => (<SelectItem key={cls} value={cls}>{cls}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <Button type="submit" className="w-full h-14 rounded-2xl font-black text-lg">Save Changes</Button>
          </form>
        </DialogContent>
      </Dialog>
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
