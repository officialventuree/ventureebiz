'use client';

import { Sidebar } from '@/components/layout/sidebar';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
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
  TrendingUp, 
  Wallet, 
  QrCode, 
  Upload, 
  Banknote,
  Edit2,
  CalendarDays,
  Plus,
  Settings2,
  CheckCircle2,
  ArrowRight,
  User,
  ShieldCheck,
  Zap,
  AlertCircle,
  Clock,
  PieChart,
  BarChart3,
  Users,
  ShoppingBag
} from 'lucide-react';
import { useAuth } from '@/components/auth-context';
import { useFirestore, useCollection, useMemoFirebase, useDoc } from '@/firebase';
import { collection, doc, setDoc, addDoc, updateDoc, increment, deleteDoc } from 'firebase/firestore';
import { useState, useMemo, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LaundryStudent, SaleTransaction, LaundryInventory, Company, PaymentMethod, LaundryLevelConfig, LaundrySchedule } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
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
  const [todayDate, setTodayDate] = useState<string | null>(null);
  
  // Form States
  const [selectedLevel, setSelectedLevel] = useState<string>('');
  const [selectedClass, setSelectedClass] = useState<string>('');
  const [editingStudent, setEditingStudent] = useState<LaundryStudent | null>(null);
  const [isEditStudentOpen, setIsEditStudentOpen] = useState(false);
  const [editLevel, setEditLevel] = useState<string>('');
  const [editClass, setEditClass] = useState<string>('');
  const [isTopUpOpen, setIsTopUpOpen] = useState(false);
  const [topUpMatrix, setTopUpMatrix] = useState('');
  const [topUpAmount, setTopUpAmount] = useState<number | string>('');
  const [topUpPaymentMethod, setTopUpPaymentMethod] = useState<PaymentMethod>('cash');
  const [amountReceived, setAmountReceived] = useState<number | string>('');
  const [transactionNo, setTransactionNo] = useState('');
  const [isScheduleOpen, setIsScheduleOpen] = useState(false);
  const [scheduleLevel, setScheduleLevel] = useState<string>('');

  // Payable States
  const [payableName, setPayableName] = useState('');
  const [payableAmount, setPayableAmount] = useState<number | string>('');
  const [payablePaymentMethod, setPayablePaymentMethod] = useState<PaymentMethod>('cash');
  const [payableCashReceived, setPayableCashReceived] = useState<number | string>('');
  const [payableRef, setPayableRef] = useState('');

  // Hydration safety for date
  useEffect(() => {
    setTodayDate(new Date().toISOString().split('T')[0]);
  }, []);

  // Queries
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
    if (!todayDate) return false;
    return schedules?.some(s => s.date === todayDate && s.level === level);
  };

  const foundTopUpStudent = useMemo(() => {
    return students?.find(s => s.matrixNumber === topUpMatrix);
  }, [students, topUpMatrix]);

  const topUpChange = topUpPaymentMethod === 'cash' ? Math.max(0, (Number(amountReceived) || 0) - (Number(topUpAmount) || 0)) : 0;
  const payableChange = payablePaymentMethod === 'cash' ? Math.max(0, (Number(payableCashReceived) || 0) - (Number(payableAmount) || 0)) : 0;

  // Handlers
  const handleRegisterStudent = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!firestore || !user?.companyId) return;
    const formData = new FormData(e.currentTarget);
    const studentId = crypto.randomUUID();
    
    if (!selectedLevel || !selectedClass) {
      toast({ title: "Selection Required", description: "Please specify student Level and Class.", variant: "destructive" });
      return;
    }

    const initialDebt = Number(formData.get('amountDue')) || 0;

    const student: LaundryStudent = {
      id: studentId,
      companyId: user.companyId,
      name: formData.get('name') as string,
      matrixNumber: formData.get('matrix') as string,
      balance: -initialDebt, // Debt is recorded as negative balance
      level: Number(selectedLevel),
      class: selectedClass,
    };

    try {
      await setDoc(doc(firestore, 'companies', user.companyId, 'laundryStudents', studentId), student);
      toast({ title: "Student Enrolled", description: `${student.name} is now registered.` });
      (e.target as HTMLFormElement).reset();
      setSelectedLevel('');
      setSelectedClass('');
    } catch (e: any) {
      toast({ title: "Registration error", description: e.message, variant: "destructive" });
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
      toast({ title: `Lv${level} Config Updated`, description: "Fee and quota settings synchronized." });
    } catch (e: any) {
      toast({ title: "Config failed", variant: "destructive" });
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
      toast({ title: "Usage Scheduled", description: `Level ${scheduleLevel} assigned to ${date}.` });
      setIsScheduleOpen(false);
      setScheduleLevel('');
    } catch (e: any) {
      toast({ title: "Schedule failed", variant: "destructive" });
    }
  };

  const handleChargeLaundry = async () => {
    if (!selectedStudent || !firestore || !user?.companyId || !studentSoap) return;
    
    const washRate = getWashRateForLevel(selectedStudent.level);
    
    if (!isLevelAllowedToday(selectedStudent.level)) {
      toast({ title: "Access Denied", description: `Level ${selectedStudent.level} is not scheduled for today.`, variant: "destructive" });
      return;
    }

    if (studentSoap.soapStockMl < mlPerWash) {
       toast({ title: "Refill Required", description: "Insufficient soap stock for student usage.", variant: "destructive" });
       return;
    }

    setIsProcessing(true);

    try {
      await updateDoc(doc(firestore, 'companies', user.companyId, 'laundryStudents', selectedStudent.id), { balance: increment(-washRate) });
      await updateDoc(doc(firestore, 'companies', user.companyId, 'laundryInventory', 'student_soap'), { soapStockMl: increment(-mlPerWash) });

      const soapCost = (mlPerWash / 1000) * studentSoap.soapCostPerLitre;
      const profit = washRate - soapCost;

      await addDoc(collection(firestore, 'companies', user.companyId, 'transactions'), {
        id: crypto.randomUUID(),
        companyId: user.companyId,
        module: 'laundry',
        totalAmount: washRate,
        profit: profit,
        timestamp: new Date().toISOString(),
        customerName: selectedStudent.name,
        status: 'completed',
        items: [{ name: `Service Wash (Lv${selectedStudent.level})`, price: washRate, quantity: 1, soapUsedMl: mlPerWash }]
      });

      toast({ title: "Wash Fulfilled", description: `Recorded wash for ${selectedStudent.name}.` });
      setSelectedStudent(null);
      setMatrixSearch('');
    } catch (e: any) {
      toast({ title: "Processing Error", variant: "destructive" });
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePayableWash = async () => {
    if (!firestore || !user?.companyId || !payableName || !payableAmount) return;
    
    if (!payableSoap || payableSoap.soapStockMl < mlPerWash) {
      toast({ title: "Soap Stock Error", description: "Insufficient soap stock for payable services. Please restock 'Payable Soap'.", variant: "destructive" });
      return;
    }

    const amount = Number(payableAmount);
    if (payablePaymentMethod === 'cash' && (Number(payableCashReceived) || 0) < amount) {
      toast({ title: "Payment Error", description: "Amount received is less than total price.", variant: "destructive" });
      return;
    }

    setIsProcessing(true);
    try {
      await updateDoc(doc(firestore, 'companies', user.companyId, 'laundryInventory', 'payable_soap'), { soapStockMl: increment(-mlPerWash) });
      
      const soapCost = (mlPerWash / 1000) * payableSoap.soapCostPerLitre;
      const profit = amount - soapCost;

      await addDoc(collection(firestore, 'companies', user.companyId, 'transactions'), {
        id: crypto.randomUUID(),
        companyId: user.companyId,
        module: 'laundry',
        totalAmount: amount,
        profit: profit,
        timestamp: new Date().toISOString(),
        customerName: payableName,
        paymentMethod: payablePaymentMethod,
        referenceNumber: payableRef || undefined,
        status: 'completed',
        items: [{ name: 'Payable Service Wash', price: amount, quantity: 1, soapUsedMl: mlPerWash }]
      });

      toast({ title: "Service Complete", description: `Recorded $${amount.toFixed(2)} for ${payableName}.` });
      setPayableName('');
      setPayableAmount('');
      setPayableCashReceived('');
      setPayableRef('');
    } catch (e) {
      toast({ title: "Operation failed", variant: "destructive" });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleConfirmTopUp = async () => {
    if (!foundTopUpStudent || !firestore || !user?.companyId || !topUpAmount) return;
    setIsProcessing(true);

    try {
      const amount = Number(topUpAmount);
      await updateDoc(doc(firestore, 'companies', user.companyId, 'laundryStudents', foundTopUpStudent.id), { balance: increment(amount) });

      await addDoc(collection(firestore, 'companies', user.companyId, 'transactions'), {
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
        items: [{ name: 'Account Deposit', price: amount, quantity: 1 }]
      });

      toast({ title: "Balance Updated", description: `Added $${amount.toFixed(2)} to account.` });
      setIsTopUpOpen(false);
      setTopUpAmount('');
      setTopUpMatrix('');
    } catch (e: any) {
      toast({ title: "Payment failed", variant: "destructive" });
    } finally {
      setIsProcessing(false);
    }
  };

  const laundryTransactions = transactions?.filter(t => t.module === 'laundry') || [];
  const totalRevenue = laundryTransactions.reduce((acc, t) => acc + t.totalAmount, 0);
  const totalProfit = laundryTransactions.reduce((acc, t) => acc + t.profit, 0);

  // Analytics Breakdowns
  const studentWashTransactions = laundryTransactions.filter(t => t.items[0]?.name.startsWith('Service Wash'));
  const payableWashTransactions = laundryTransactions.filter(t => t.items[0]?.name === 'Payable Service Wash');
  
  const studentRevenue = studentWashTransactions.reduce((acc, t) => acc + t.totalAmount, 0);
  const studentProfit = studentWashTransactions.reduce((acc, t) => acc + t.profit, 0);
  
  const payableRevenue = payableWashTransactions.reduce((acc, t) => acc + t.totalAmount, 0);
  const payableProfit = payableWashTransactions.reduce((acc, t) => acc + t.profit, 0);

  const totalWashCount = studentWashTransactions.length + payableWashTransactions.length;

  return (
    <div className="flex h-screen bg-background font-body">
      <Sidebar />
      <main className="flex-1 overflow-auto p-8">
        <div className="mb-8 flex justify-between items-end">
          <div>
            <h1 className="text-3xl font-black font-headline text-foreground tracking-tight">Laundry Hub</h1>
            <p className="text-muted-foreground font-medium">Smart Scheduling & Quota Billing</p>
          </div>
          <div className="flex gap-4">
            <Dialog open={isTopUpOpen} onOpenChange={setIsTopUpOpen}>
              <DialogTrigger asChild>
                <Button className="rounded-2xl h-14 px-8 font-black text-lg shadow-xl gap-2">
                  <Wallet className="w-5 h-5" /> Account Deposit
                </Button>
              </DialogTrigger>
              <DialogContent className="rounded-[40px] max-w-xl p-0 overflow-hidden bg-white border-none shadow-2xl">
                <div className="bg-primary p-12 text-primary-foreground text-center">
                   <p className="text-xs font-black uppercase tracking-widest opacity-80 mb-2">Student Top-Up</p>
                   <h2 className="text-4xl font-black tracking-tighter">Account Settlement</h2>
                </div>
                <div className="p-10 space-y-8">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-muted-foreground px-1 tracking-widest">Target Matrix No</Label>
                    <Input 
                      placeholder="SCAN OR TYPE MATRIX..." 
                      className="h-14 rounded-2xl font-black text-xl bg-secondary/10 border-none px-6"
                      value={topUpMatrix}
                      onChange={(e) => setTopUpMatrix(e.target.value)}
                    />
                  </div>
                  {foundTopUpStudent && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-top-2">
                      <div className="p-6 bg-primary/5 rounded-[32px] border-2 border-primary/20 flex justify-between items-center">
                        <div>
                          <p className="text-[10px] font-black text-primary uppercase tracking-widest">Active Account</p>
                          <h4 className="text-2xl font-black">{foundTopUpStudent.name}</h4>
                          <p className="text-xs font-bold text-muted-foreground">Level {foundTopUpStudent.level} • {foundTopUpStudent.class}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Current Balance</p>
                          <p className={cn("text-3xl font-black", foundTopUpStudent.balance < 0 ? "text-destructive" : "text-foreground")}>
                            ${foundTopUpStudent.balance.toFixed(2)}
                          </p>
                        </div>
                      </div>
                      <div className="space-y-4">
                        <Label className="text-[10px] font-black uppercase text-muted-foreground px-1 tracking-widest">Deposit Amount ($)</Label>
                        <Input 
                          type="number" 
                          placeholder="50.00" 
                          className="h-16 rounded-2xl font-black text-3xl bg-secondary/10 border-none px-6"
                          value={topUpAmount}
                          onChange={(e) => setTopUpAmount(e.target.value)}
                        />
                      </div>
                      <RadioGroup value={topUpPaymentMethod} onValueChange={(v) => setTopUpPaymentMethod(v as PaymentMethod)} className="grid grid-cols-3 gap-3">
                        <PaymentOption value="cash" label="Cash" icon={Banknote} id="topup_cash" />
                        <PaymentOption value="card" label="Card" icon={CreditCard} id="topup_card" />
                        <PaymentOption value="duitnow" label="DuitNow" icon={QrCode} id="topup_qr" />
                      </RadioGroup>
                      {topUpPaymentMethod === 'cash' && (
                        <div className="p-6 bg-secondary/10 rounded-3xl space-y-4">
                           <Input type="number" placeholder="Amount Received" value={amountReceived} onChange={(e) => setAmountReceived(e.target.value)} className="h-12 rounded-xl font-bold" />
                           <div className="flex justify-between font-black text-sm uppercase px-2"><span>Change:</span> <span>${topUpChange.toFixed(2)}</span></div>
                        </div>
                      )}
                      <Button className="w-full h-18 rounded-[28px] font-black text-xl shadow-2xl" onClick={handleConfirmTopUp} disabled={isProcessing || !topUpAmount}>
                        Confirm Deposit
                      </Button>
                    </div>
                  )}
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <Tabs defaultValue="pos" className="space-y-6">
          <TabsList className="bg-white/50 border p-1 rounded-xl shadow-sm">
            <TabsTrigger value="pos" className="rounded-lg gap-2">POS Terminal</TabsTrigger>
            <TabsTrigger value="payable" className="rounded-lg gap-2">Payable Laundry</TabsTrigger>
            <TabsTrigger value="students" className="rounded-lg gap-2">Subscribers</TabsTrigger>
            <TabsTrigger value="schedule" className="rounded-lg gap-2">Schedule</TabsTrigger>
            <TabsTrigger value="consumables" className="rounded-lg gap-2">Inventory</TabsTrigger>
            <TabsTrigger value="profits" className="rounded-lg gap-2">Analytics</TabsTrigger>
            <TabsTrigger value="billing" className="rounded-lg gap-2">Settlement</TabsTrigger>
          </TabsList>

          <TabsContent value="pos" className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-6">
              <Card className="border-none shadow-sm bg-white rounded-3xl overflow-hidden">
                <CardHeader className="bg-secondary/10 p-8">
                  <CardTitle className="text-xl font-black">Washing Terminal</CardTitle>
                  <CardDescription className="font-bold">Authorized student usage verification</CardDescription>
                </CardHeader>
                <CardContent className="p-8 space-y-6">
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground w-6 h-6" />
                      <Input 
                        placeholder="SCAN STUDENT MATRIX..." 
                        className="h-16 rounded-2xl text-2xl font-black border-2 border-primary/20 bg-secondary/5 pl-14"
                        value={matrixSearch}
                        onChange={(e) => setMatrixSearch(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            const found = students?.find(s => s.matrixNumber === matrixSearch);
                            if (found) setSelectedStudent(found);
                            else toast({ title: "Subscriber Not Found", variant: "destructive" });
                          }
                        }}
                      />
                    </div>
                    <Button onClick={() => {
                       const found = students?.find(s => s.matrixNumber === matrixSearch);
                       if (found) setSelectedStudent(found);
                       else toast({ title: "Subscriber Not Found", variant: "destructive" });
                    }} size="lg" className="rounded-2xl px-10 h-16 font-black text-lg">Verify</Button>
                  </div>

                  {selectedStudent ? (
                    <div className="p-10 bg-primary/5 rounded-[32px] border-4 border-primary/10 space-y-8 animate-in zoom-in-95 duration-300">
                      <div className="flex justify-between items-start">
                        <div className="space-y-4">
                          <div>
                            <p className="text-[10px] font-black text-primary uppercase tracking-widest mb-1">Subscriber Identity</p>
                            <h4 className="text-4xl font-black text-foreground tracking-tighter">{selectedStudent.name}</h4>
                            <p className="text-sm font-bold text-muted-foreground flex items-center gap-2">
                              <Badge variant="outline" className="font-bold">Level {selectedStudent.level}</Badge>
                              <Badge variant="outline" className="font-bold">{selectedStudent.class}</Badge>
                            </p>
                          </div>
                          
                          <div className="pt-2">
                            {isLevelAllowedToday(selectedStudent.level) ? (
                              <Badge className="bg-green-600 hover:bg-green-600 h-8 px-4 font-black text-sm flex items-center gap-2 rounded-full">
                                <CheckCircle2 className="w-4 h-4" /> Turn Today
                              </Badge>
                            ) : (
                              <Badge variant="destructive" className="h-8 px-4 font-black text-sm flex items-center gap-2 rounded-full">
                                <AlertCircle className="w-4 h-4" /> Not Turn Today: Level {selectedStudent.level} not scheduled
                              </Badge>
                            )}
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Account Standing</p>
                          <p className={cn(
                            "text-5xl font-black tracking-tighter",
                            selectedStudent.balance < 0 ? "text-destructive" : "text-primary"
                          )}>${selectedStudent.balance.toFixed(2)}</p>
                          <div className="mt-2 flex flex-col items-end gap-1">
                             <Badge variant="secondary" className="font-black text-[10px] uppercase">Service Fee: ${getWashRateForLevel(selectedStudent.level).toFixed(2)}</Badge>
                             <p className="text-[10px] font-bold text-muted-foreground">ID: {selectedStudent.matrixNumber}</p>
                          </div>
                        </div>
                      </div>
                      
                      <Button 
                        className="w-full h-16 rounded-2xl text-xl font-black shadow-xl group" 
                        onClick={handleChargeLaundry} 
                        disabled={isProcessing || !isLevelAllowedToday(selectedStudent.level)}
                      >
                        {isProcessing ? "Processing Authorization..." : (
                          <span className="flex items-center gap-3">
                            Confirm Wash & Debit Account <ArrowRight className="w-6 h-6 group-hover:translate-x-1 transition-transform" />
                          </span>
                        )}
                      </Button>
                    </div>
                  ) : (
                    <div className="py-24 text-center bg-secondary/10 rounded-[32px] border-4 border-dashed border-secondary/30">
                      <Search className="w-16 h-16 mx-auto mb-4 opacity-10" />
                      <p className="font-black text-muted-foreground uppercase tracking-widest">Scanner Ready for Matrix Entry</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="border-none shadow-sm bg-white rounded-2xl overflow-hidden">
                <CardHeader className="bg-secondary/5 p-6 border-b">
                  <CardTitle className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
                    <History className="w-4 h-4 text-primary" /> Daily Activity Feed
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="divide-y">
                    {laundryTransactions.slice().reverse().slice(0, 5).map(t => (
                      <div key={t.id} className="flex items-center justify-between p-5 hover:bg-secondary/5 transition-colors">
                        <div>
                          <p className="text-sm font-black text-foreground">{t.items[0].name}</p>
                          <p className="text-[10px] text-muted-foreground font-bold">{new Date(t.timestamp).toLocaleTimeString()}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-black text-primary text-lg">${t.totalAmount.toFixed(2)}</p>
                          <p className="text-[10px] font-bold text-muted-foreground">{t.customerName}</p>
                        </div>
                      </div>
                    ))}
                    {laundryTransactions.length === 0 && (
                      <div className="p-12 text-center text-muted-foreground font-bold opacity-30">
                        No activity yet today.
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="lg:col-span-1 space-y-6">
              <Card className="bg-primary border-none shadow-2xl text-primary-foreground rounded-[32px] p-8 overflow-hidden relative">
                <div className="absolute top-0 right-0 p-8 opacity-10"><Clock className="w-32 h-32" /></div>
                <CardTitle className="flex items-center gap-3 text-xl font-black mb-6 relative z-10">
                  <CalendarDays className="w-6 h-6" /> Turn Schedule: Today
                </CardTitle>
                <div className="space-y-4 relative z-10">
                  {LEVELS.map(lv => {
                    const isAllowed = isLevelAllowedToday(lv);
                    return (
                      <div key={lv} className={cn(
                        "p-4 rounded-2xl flex justify-between items-center transition-all",
                        isAllowed ? "bg-white/20 border-2 border-white/20 scale-[1.02]" : "bg-black/10 opacity-50"
                      )}>
                        <p className="font-black text-lg">Level {lv}</p>
                        {isAllowed ? (
                          <Badge className="bg-white text-primary font-black">Turn Today</Badge>
                        ) : (
                          <Badge variant="outline" className="text-white border-white/40 font-bold opacity-40">Not Turn</Badge>
                        )}
                      </div>
                    );
                  })}
                  {(!todayDate || schedules?.filter(s => s.date === todayDate).length === 0) && (
                    <div className="p-6 bg-black/10 rounded-2xl text-center border-2 border-dashed border-white/10">
                       <p className="text-xs font-bold opacity-60">No levels scheduled for today.</p>
                    </div>
                  )}
                </div>
              </Card>
              
              <Card className="border-none shadow-sm bg-white rounded-3xl p-6">
                <h4 className="text-xs font-black uppercase tracking-widest text-muted-foreground mb-4">Chemical Health</h4>
                <div className="space-y-6">
                  <div className="space-y-2">
                    <div className="flex justify-between text-[10px] font-black uppercase">
                       <span>Student Chemical</span>
                       <span className={cn(studentSoap && studentSoap.soapStockMl < 5000 ? "text-destructive" : "text-primary")}>
                         {studentSoap ? (studentSoap.soapStockMl / 1000).toFixed(1) : 0}L
                       </span>
                    </div>
                    <Progress value={studentSoap ? (studentSoap.soapStockMl / studentSoap.capacityMl) * 100 : 0} className="h-1.5" />
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-[10px] font-black uppercase">
                       <span>Payable Pool</span>
                       <span>{payableSoap ? (payableSoap.soapStockMl / 1000).toFixed(1) : 0}L</span>
                    </div>
                    <Progress value={payableSoap ? (payableSoap.soapStockMl / payableSoap.capacityMl) * 100 : 0} className="h-1.5 bg-accent/20 [&>div]:bg-accent" />
                  </div>
                </div>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="payable" className="max-w-4xl mx-auto space-y-8">
            <Card className="border-none shadow-xl bg-white rounded-[40px] overflow-hidden">
               <div className="bg-primary p-12 text-primary-foreground text-center">
                  <p className="text-xs font-black uppercase tracking-widest opacity-80 mb-2">Walk-in Services</p>
                  <h2 className="text-5xl font-black tracking-tighter">Payable Laundry Recording</h2>
               </div>
               <div className="p-12 space-y-10">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                     <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground px-1">Customer Name</Label>
                        <Input 
                          placeholder="John Smith" 
                          className="h-14 rounded-2xl font-black text-lg bg-secondary/10 border-none px-6"
                          value={payableName}
                          onChange={(e) => setPayableName(e.target.value)}
                        />
                     </div>
                     <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground px-1">Total Price ($)</Label>
                        <Input 
                          type="number"
                          placeholder="10.00" 
                          className="h-14 rounded-2xl font-black text-xl bg-secondary/10 border-none px-6 text-primary"
                          value={payableAmount}
                          onChange={(e) => setPayableAmount(e.target.value)}
                        />
                     </div>
                  </div>

                  <Separator />

                  <div className="space-y-6">
                     <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground px-1">Select Payment Method</Label>
                     <RadioGroup value={payablePaymentMethod} onValueChange={(v) => setPayablePaymentMethod(v as PaymentMethod)} className="grid grid-cols-3 gap-4">
                        <PaymentOption value="cash" label="Cash Settlement" icon={Banknote} id="payable_cash" />
                        <PaymentOption value="card" label="Card Terminal" icon={CreditCard} id="payable_card" />
                        <PaymentOption value="duitnow" label="DuitNow Digital" icon={QrCode} id="payable_qr" />
                     </RadioGroup>
                  </div>

                  {payablePaymentMethod === 'cash' && (
                    <div className="p-10 bg-secondary/5 rounded-[32px] space-y-6 animate-in fade-in slide-in-from-top-2">
                       <div className="flex justify-between items-end mb-4">
                          <p className="text-sm font-black uppercase tracking-widest text-muted-foreground">Cash Verification</p>
                          <p className="text-xl font-black text-foreground">Total: ${Number(payableAmount || 0).toFixed(2)}</p>
                       </div>
                       <Input 
                         type="number" 
                         placeholder="Amount Received" 
                         className="h-16 rounded-2xl text-3xl font-black px-6"
                         value={payableCashReceived}
                         onChange={(e) => setPayableCashReceived(e.target.value)}
                       />
                       <div className="bg-primary/5 p-6 rounded-2xl flex justify-between items-center border-2 border-primary/10">
                          <span className="font-black text-xs uppercase text-primary">Balance to Return</span>
                          <span className="text-4xl font-black">${payableChange.toFixed(2)}</span>
                       </div>
                    </div>
                  )}

                  {(payablePaymentMethod === 'card' || payablePaymentMethod === 'duitnow') && (
                    <div className="space-y-8 animate-in fade-in slide-in-from-top-2">
                       {payablePaymentMethod === 'duitnow' && companyDoc?.duitNowQr && (
                         <div className="flex flex-col items-center p-8 bg-secondary/5 rounded-[32px] border-2 border-dashed border-primary/20">
                            <Image src={companyDoc.duitNowQr} alt="QR" width={200} height={200} className="rounded-3xl shadow-xl mb-4 border-4 border-white" />
                            <p className="text-[10px] font-black text-primary uppercase tracking-widest">Scan for digital settlement</p>
                         </div>
                       )}
                       <div className="space-y-2">
                          <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground px-1">Transaction Reference / Trace ID</Label>
                          <Input 
                            placeholder="Enter Ref Number" 
                            className="h-14 rounded-2xl font-black text-lg bg-secondary/10 border-none px-6"
                            value={payableRef}
                            onChange={(e) => setPayableRef(e.target.value)}
                          />
                       </div>
                    </div>
                  )}

                  <div className="pt-6">
                     <Button 
                       className="w-full h-20 rounded-[32px] text-2xl font-black shadow-2xl flex gap-3" 
                       onClick={handlePayableWash}
                       disabled={isProcessing || !payableName || !payableAmount}
                     >
                       {isProcessing ? "Recording..." : (
                         <>Record Payable Wash <ArrowRight className="w-6 h-6" /></>
                       )}
                     </Button>
                     <p className="text-[10px] text-center mt-6 font-bold text-muted-foreground uppercase tracking-widest">
                       Soap inventory will be automatically deducted upon recording.
                     </p>
                  </div>
               </div>
            </Card>
          </TabsContent>

          <TabsContent value="students" className="space-y-8">
             <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
               <Card className="lg:col-span-1 border-none shadow-sm rounded-3xl bg-white p-8 h-fit">
                 <CardHeader className="p-0 mb-6">
                   <CardTitle className="text-xl font-black">Enroll Student</CardTitle>
                   <CardDescription className="font-bold">Subscribed laundry accounts</CardDescription>
                 </CardHeader>
                 <form onSubmit={handleRegisterStudent} className="space-y-5">
                   <div className="space-y-1.5">
                     <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest px-1">Full Name</Label>
                     <Input name="name" placeholder="Student Name" required className="h-12 rounded-xl font-bold" />
                   </div>
                   <div className="space-y-1.5">
                     <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest px-1">Matrix ID</Label>
                     <Input name="matrix" placeholder="ID Number" required className="h-12 rounded-xl font-bold" />
                   </div>
                   <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest px-1">Level</Label>
                        <Select value={selectedLevel} onValueChange={setSelectedLevel}>
                          <SelectTrigger className="h-12 rounded-xl font-bold"><SelectValue placeholder="Lv" /></SelectTrigger>
                          <SelectContent className="rounded-xl">{LEVELS.map(lv => (<SelectItem key={lv} value={lv.toString()}>Level {lv}</SelectItem>))}</SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest px-1">Class</Label>
                        <Select value={selectedClass} onValueChange={setSelectedClass}>
                          <SelectTrigger className="h-12 rounded-xl font-bold"><SelectValue placeholder="Class" /></SelectTrigger>
                          <SelectContent className="rounded-xl">{CLASSES.map(cls => (<SelectItem key={cls} value={cls}>{cls}</SelectItem>))}</SelectContent>
                        </Select>
                      </div>
                   </div>
                   <div className="space-y-1.5">
                     <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest px-1">Amount Need to Pay ($)</Label>
                     <Input name="amountDue" type="number" step="0.01" placeholder="50.00" className="h-12 rounded-xl font-bold" />
                   </div>
                   <Button type="submit" className="w-full h-14 font-black rounded-2xl shadow-xl">Confirm Enrollment</Button>
                 </form>
               </Card>

               <div className="lg:col-span-3 space-y-8">
                 <Card className="border-none shadow-sm bg-white rounded-3xl overflow-hidden">
                   <CardHeader className="bg-secondary/10 p-6">
                     <CardTitle className="text-lg font-black flex items-center gap-2">
                       <Settings2 className="w-5 h-5 text-primary" /> Level Quota Configuration
                     </CardTitle>
                     <CardDescription className="font-bold">Define "Required Fee" and "Wash Limit" to auto-calculate service rates.</CardDescription>
                   </CardHeader>
                   <CardContent className="p-6 grid grid-cols-1 md:grid-cols-5 gap-4">
                     {LEVELS.map(lv => {
                       const config = levelConfigs?.find(c => c.level === lv);
                       return (
                         <form key={lv} onSubmit={(e) => handleUpdateLevelConfig(e, lv)} className="space-y-3 p-4 bg-secondary/5 rounded-2xl border-2 border-transparent hover:border-primary/20 transition-all flex flex-col justify-between">
                            <div>
                               <p className="text-xs font-black uppercase text-primary mb-3">Level {lv}</p>
                               <div className="space-y-3">
                                  <div className="space-y-1">
                                     <Label className="text-[9px] font-black uppercase text-muted-foreground">Required Fee</Label>
                                     <Input name="fee" type="number" step="0.01" defaultValue={config?.subscriptionFee} className="h-8 text-xs font-bold" />
                                  </div>
                                  <div className="space-y-1">
                                     <Label className="text-[9px] font-black uppercase text-muted-foreground">Wash Limit</Label>
                                     <Input name="quota" type="number" defaultValue={config?.totalWashesAllowed} className="h-8 text-xs font-bold" />
                                  </div>
                               </div>
                            </div>
                            <Button size="sm" type="submit" className="w-full h-8 font-black text-[10px] mt-4 uppercase">Update</Button>
                         </form>
                       );
                     })}
                   </CardContent>
                 </Card>

                 <div className="bg-white rounded-[32px] border shadow-sm overflow-hidden">
                   <div className="p-6 border-b flex justify-between items-center bg-secondary/5">
                      <h3 className="font-black text-xl">Subscriber Master Registry</h3>
                      <Badge variant="secondary" className="font-black px-4 py-1 rounded-full uppercase text-[10px]">{students?.length || 0} Records</Badge>
                   </div>
                   <table className="w-full text-sm text-left">
                     <thead className="bg-secondary/10 border-b">
                       <tr>
                         <th className="p-4 font-black uppercase text-[10px] tracking-widest text-muted-foreground">Subscriber</th>
                         <th className="p-4 font-black uppercase text-[10px] tracking-widest text-muted-foreground text-center">Identity</th>
                         <th className="p-4 font-black uppercase text-[10px] tracking-widest text-muted-foreground">Fee / Rate</th>
                         <th className="p-4 font-black uppercase text-[10px] tracking-widest text-muted-foreground">Amount Due</th>
                         <th className="p-4 font-black uppercase text-[10px] tracking-widest text-muted-foreground text-right">Net Balance</th>
                         <th className="p-4 font-black uppercase text-[10px] tracking-widest text-muted-foreground text-center">Actions</th>
                       </tr>
                     </thead>
                     <tbody className="divide-y">
                       {students?.map(s => {
                         const washRate = getWashRateForLevel(s.level);
                         const washesLeft = washRate > 0 ? Math.floor(s.balance / washRate) : 0;
                         const amountDue = Math.max(0, -s.balance);
                         return (
                           <tr key={s.id} className="hover:bg-secondary/5 transition-colors">
                             <td className="p-4">
                                <p className="font-black text-foreground">{s.name}</p>
                                <p className="text-[10px] text-muted-foreground font-bold">ID: {s.matrixNumber}</p>
                             </td>
                             <td className="p-4 text-center">
                                <Badge variant="outline" className="font-black text-[9px] uppercase">Level {s.level} • {s.class}</Badge>
                             </td>
                             <td className="p-4">
                                <p className="font-black text-primary">${washRate.toFixed(2)}</p>
                                <p className="text-[9px] text-muted-foreground font-bold uppercase">Per Service</p>
                             </td>
                             <td className="p-4">
                                <p className={cn("font-black text-lg", amountDue > 0 ? "text-destructive" : "text-muted-foreground")}>
                                  ${amountDue.toFixed(2)}
                                </p>
                                <p className="text-[9px] font-bold text-muted-foreground uppercase">Required Pay</p>
                             </td>
                             <td className="p-4 text-right">
                                <p className={cn("font-black text-lg", s.balance < 0 ? "text-destructive" : "text-foreground")}>
                                  ${s.balance.toFixed(2)}
                                </p>
                                <p className={cn("text-[9px] font-black uppercase", s.balance < 0 ? "text-destructive" : washesLeft <= 1 ? "text-destructive" : "text-muted-foreground")}>
                                   {s.balance < 0 ? "Debt Outstanding" : `${washesLeft} washes left`}
                                </p>
                             </td>
                             <td className="p-4 text-center">
                                <div className="flex items-center justify-center gap-2">
                                  <Button variant="ghost" size="icon" className="h-8 w-8 text-primary" onClick={() => {
                                    setEditingStudent(s);
                                    setEditLevel(s.level.toString());
                                    setEditClass(s.class);
                                    setIsEditStudentOpen(true);
                                  }}><Edit2 className="w-4 h-4" /></Button>
                                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={async () => {
                                    if (confirm("Revoke student account?")) {
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
                   <h3 className="text-2xl font-black">Institutional Usage Schedule</h3>
                   <p className="text-sm text-muted-foreground font-medium">Designate authorized washing days per student level.</p>
                </div>
                <div className="flex gap-4">
                   <Dialog open={isScheduleOpen} onOpenChange={setIsScheduleOpen}>
                      <DialogTrigger asChild>
                         <Button className="rounded-xl font-black shadow-lg gap-2 h-12 px-6">
                            <Plus className="w-4 h-4" /> Add Assigned Date
                         </Button>
                      </DialogTrigger>
                      <DialogContent className="rounded-[32px] max-w-lg p-0 overflow-hidden bg-white border-none shadow-2xl">
                         <div className="bg-primary p-8 text-primary-foreground"><DialogTitle className="text-xl font-black">Schedule Usage Date</DialogTitle></div>
                         <form onSubmit={handleAddSchedule} className="p-10 space-y-6">
                            <div className="space-y-2">
                               <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground px-1">Target Date</Label>
                               <Input name="date" type="date" required className="h-12 rounded-xl font-bold bg-secondary/10 border-none" />
                            </div>
                            <div className="space-y-2">
                               <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground px-1">Authorized Level</Label>
                               <Select value={scheduleLevel} onValueChange={setScheduleLevel}>
                                  <SelectTrigger className="h-12 rounded-xl font-bold bg-secondary/10 border-none"><SelectValue placeholder="Select Level" /></SelectTrigger>
                                  <SelectContent className="rounded-xl font-bold">{LEVELS.map(lv => (<SelectItem key={lv} value={lv.toString()}>Level {lv}</SelectItem>))}</SelectContent>
                               </Select>
                            </div>
                            <Button type="submit" className="w-full h-14 rounded-2xl font-black text-lg shadow-xl">Confirm Schedule</Button>
                         </form>
                      </DialogContent>
                   </Dialog>
                </div>
             </div>

             <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                {LEVELS.map(lv => {
                   const count = schedules?.filter(s => s.level === lv).length || 0;
                   return (
                      <Card key={lv} className="border-none shadow-sm bg-white rounded-2xl p-6 text-center">
                         <p className="text-[10px] font-black uppercase text-primary mb-1">Level {lv}</p>
                         <p className="text-3xl font-black">{count}</p>
                         <p className="text-[10px] font-bold text-muted-foreground uppercase mt-1">Scheduled Days</p>
                      </Card>
                   );
                })}
             </div>

             <div className="bg-white rounded-[32px] border shadow-sm overflow-hidden">
                <table className="w-full text-sm text-left">
                   <thead className="bg-secondary/10 border-b">
                      <tr>
                         <th className="p-6 font-black uppercase text-[10px] tracking-widest">Authorized Date</th>
                         <th className="p-6 font-black uppercase text-[10px] tracking-widest text-center">Assigned Level</th>
                         <th className="p-6 text-center font-black uppercase text-[10px] tracking-widest">Actions</th>
                      </tr>
                   </thead>
                   <tbody className="divide-y">
                      {schedules?.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map(s => (
                        <tr key={s.id} className="hover:bg-secondary/5 transition-colors">
                           <td className="p-6 font-black text-lg">{new Date(s.date).toLocaleDateString([], { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</td>
                           <td className="p-6 text-center"><Badge className="font-black px-6 py-1 h-10 rounded-xl text-lg">Level {s.level}</Badge></td>
                           <td className="p-6 text-center">
                              <Button variant="ghost" size="icon" className="text-destructive h-10 w-10" onClick={async () => {
                                if (confirm("Remove schedule date?")) await deleteDoc(doc(firestore!, 'companies', user!.companyId!, 'laundrySchedules', s.id));
                              }}><Trash2 className="w-5 h-5" /></Button>
                           </td>
                        </tr>
                      ))}
                      {(!schedules || schedules.length === 0) && (
                        <tr>
                           <td colSpan={3} className="p-12 text-center text-muted-foreground font-bold opacity-30">No dates scheduled yet.</td>
                        </tr>
                      )}
                   </tbody>
                </table>
             </div>
          </TabsContent>

          <TabsContent value="consumables">
             <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <Card className="border-none shadow-sm rounded-3xl bg-white p-8">
                  <CardHeader className="p-0 mb-6">
                    <CardTitle className="text-xl font-black">Restock Chemical Supply</CardTitle>
                    <CardDescription className="font-bold">Inventory replenishment terminal</CardDescription>
                  </CardHeader>
                  <form onSubmit={async (e) => {
                    e.preventDefault();
                    if (!firestore || !user?.companyId) return;
                    const formData = new FormData(e.currentTarget);
                    const category = formData.get('category') as 'student' | 'payable';
                    const bottles = Number(formData.get('bottles'));
                    const volPerBottle = Number(formData.get('volPerBottle'));
                    const costPerBottle = Number(formData.get('costPerBottle'));
                    const amountMl = bottles * volPerBottle * 1000;
                    const totalCost = bottles * costPerBottle;
                    const docId = `${category}_soap`;

                    const existing = inventoryItems?.find(i => i.id === docId);
                    if (!existing) {
                      await setDoc(doc(firestore, 'companies', user.companyId, 'laundryInventory', docId), {
                        id: docId,
                        companyId: user.companyId,
                        soapStockMl: amountMl,
                        soapCostPerLitre: totalCost / (bottles * volPerBottle),
                        capacityMl: 50000,
                        category: category
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
                      description: `${category.toUpperCase()} Soap Restock`,
                      timestamp: new Date().toISOString()
                    });
                    toast({ title: "Inventory Replenished" });
                    (e.target as HTMLFormElement).reset();
                  }} className="space-y-4">
                    <div className="space-y-1.5">
                      <Label className="text-[10px] font-black uppercase px-1">Designated Usage</Label>
                      <Select name="category" defaultValue="student">
                        <SelectTrigger className="h-12 rounded-xl font-bold"><SelectValue placeholder="Category" /></SelectTrigger>
                        <SelectContent className="rounded-xl">
                          <SelectItem value="student">Student Usage Pool</SelectItem>
                          <SelectItem value="payable">Payable / Walk-in Pool</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                       <Input name="bottles" type="number" placeholder="Bottles" required className="rounded-xl h-12" />
                       <Input name="volPerBottle" type="number" step="0.1" placeholder="Litres/Btl" required className="rounded-xl h-12" />
                    </div>
                    <Input name="costPerBottle" type="number" step="0.01" placeholder="Cost per Bottle ($)" required className="rounded-xl h-12" />
                    <Button type="submit" className="w-full h-14 font-black rounded-2xl shadow-lg">Confirm Procurement</Button>
                  </form>
                </Card>

                <div className="grid grid-cols-1 gap-6">
                   <Card className="p-10 border-none shadow-sm bg-primary text-primary-foreground rounded-[40px] relative overflow-hidden group">
                      <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-125 transition-transform"><Droplet className="w-32 h-32" /></div>
                      <p className="text-[10px] font-black uppercase opacity-60 mb-2">Student Chemical Pool</p>
                      <h4 className="text-6xl font-black tracking-tighter">{studentSoap ? (studentSoap.soapStockMl / 1000).toFixed(2) : 0}L</h4>
                      <div className="mt-6 space-y-2">
                        <div className="flex justify-between text-[10px] font-black uppercase">
                          <span>Usage Capacity</span>
                          <span>{studentSoap ? ((studentSoap.soapStockMl / studentSoap.capacityMl) * 100).toFixed(0) : 0}%</span>
                        </div>
                        <Progress value={studentSoap ? (studentSoap.soapStockMl / studentSoap.capacityMl) * 100 : 0} className="h-2 bg-white/20" />
                      </div>
                   </Card>

                   <Card className="p-10 border-none shadow-sm bg-accent text-accent-foreground rounded-[40px] relative overflow-hidden group">
                      <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-125 transition-transform"><Zap className="w-32 h-32" /></div>
                      <p className="text-[10px] font-black uppercase opacity-60 mb-2">Payable Service Pool</p>
                      <h4 className="text-6xl font-black tracking-tighter">{payableSoap ? (payableSoap.soapStockMl / 1000).toFixed(2) : 0}L</h4>
                      <div className="mt-6 space-y-2">
                        <div className="flex justify-between text-[10px] font-black uppercase">
                          <span>Usage Capacity</span>
                          <span>{payableSoap ? ((payableSoap.soapStockMl / payableSoap.capacityMl) * 100).toFixed(0) : 0}%</span>
                        </div>
                        <Progress value={payableSoap ? (payableSoap.soapStockMl / payableSoap.capacityMl) * 100 : 0} className="h-2 bg-white/20" />
                      </div>
                   </Card>
                </div>
             </div>
          </TabsContent>

          <TabsContent value="profits" className="space-y-8">
             <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="p-8 border-none shadow-sm bg-white rounded-[32px] relative overflow-hidden">
                   <div className="absolute top-0 right-0 p-6 opacity-5"><TrendingUp className="w-16 h-16" /></div>
                   <p className="text-[10px] font-black uppercase text-muted-foreground mb-1 tracking-widest">Aggregate Revenue</p>
                   <h4 className="text-4xl font-black tracking-tighter text-foreground">${totalRevenue.toFixed(2)}</h4>
                   <div className="mt-4 flex items-center gap-2 text-[10px] font-bold text-muted-foreground uppercase">
                     <History className="w-3 h-3" /> {laundryTransactions.length} Total Logs
                   </div>
                </Card>
                <Card className="p-8 border-none shadow-sm bg-white rounded-[32px] relative overflow-hidden">
                   <div className="absolute top-0 right-0 p-6 opacity-5"><Droplet className="w-16 h-16" /></div>
                   <p className="text-[10px] font-black uppercase text-muted-foreground mb-1 tracking-widest">Chemical Overhead</p>
                   <h4 className="text-4xl font-black tracking-tighter text-destructive">-${(totalRevenue - totalProfit).toFixed(2)}</h4>
                   <p className="mt-4 text-[10px] font-bold text-muted-foreground uppercase">Estimated Consumable Cost</p>
                </Card>
                <Card className="p-8 border-none shadow-sm bg-primary text-primary-foreground rounded-[32px] relative overflow-hidden">
                   <div className="absolute top-0 right-0 p-6 opacity-10"><ShieldCheck className="w-16 h-16" /></div>
                   <p className="text-[10px] font-black uppercase opacity-60 mb-1 tracking-widest">Net Business Yield</p>
                   <h4 className="text-4xl font-black tracking-tighter">${totalProfit.toFixed(2)}</h4>
                   <p className="mt-4 text-[10px] font-bold opacity-60 uppercase">Realized Profit After Chemical Cost</p>
                </Card>
             </div>

             <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Student Segment */}
                <Card className="border-none shadow-sm bg-white rounded-[40px] p-8 space-y-8">
                   <div className="flex justify-between items-center">
                      <div>
                        <h3 className="text-xl font-black flex items-center gap-2">
                           <Users className="w-5 h-5 text-primary" /> Student Usage Segment
                        </h3>
                        <p className="text-sm font-medium text-muted-foreground">Institutional quota-based performance</p>
                      </div>
                      <Badge variant="secondary" className="font-black h-8 px-4 rounded-xl">{studentWashTransactions.length} Washes</Badge>
                   </div>
                   
                   <div className="grid grid-cols-2 gap-4">
                      <div className="p-6 bg-secondary/10 rounded-3xl">
                         <p className="text-[10px] font-black uppercase text-muted-foreground mb-1">Segment Revenue</p>
                         <p className="text-2xl font-black">${studentRevenue.toFixed(2)}</p>
                      </div>
                      <div className="p-6 bg-primary/5 border-2 border-primary/10 rounded-3xl">
                         <p className="text-[10px] font-black uppercase text-primary mb-1">Segment Profit</p>
                         <p className="text-2xl font-black text-primary">${studentProfit.toFixed(2)}</p>
                      </div>
                   </div>

                   <div className="space-y-2">
                      <div className="flex justify-between text-[10px] font-black uppercase">
                         <span>Volume Contribution</span>
                         <span>{totalWashCount > 0 ? ((studentWashTransactions.length / totalWashCount) * 100).toFixed(0) : 0}%</span>
                      </div>
                      <Progress value={totalWashCount > 0 ? (studentWashTransactions.length / totalWashCount) * 100 : 0} className="h-2" />
                   </div>
                </Card>

                {/* Payable Segment */}
                <Card className="border-none shadow-sm bg-white rounded-[40px] p-8 space-y-8">
                   <div className="flex justify-between items-center">
                      <div>
                        <h3 className="text-xl font-black flex items-center gap-2">
                           <ShoppingBag className="w-5 h-5 text-accent-foreground" /> Walk-in Segment
                        </h3>
                        <p className="text-sm font-medium text-muted-foreground">Retail walk-in service performance</p>
                      </div>
                      <Badge variant="secondary" className="font-black h-8 px-4 rounded-xl">{payableWashTransactions.length} Washes</Badge>
                   </div>
                   
                   <div className="grid grid-cols-2 gap-4">
                      <div className="p-6 bg-secondary/10 rounded-3xl">
                         <p className="text-[10px] font-black uppercase text-muted-foreground mb-1">Segment Revenue</p>
                         <p className="text-2xl font-black">${payableRevenue.toFixed(2)}</p>
                      </div>
                      <div className="p-6 bg-accent/10 border-2 border-accent/20 rounded-3xl">
                         <p className="text-[10px] font-black uppercase text-accent-foreground mb-1">Segment Profit</p>
                         <p className="text-2xl font-black text-foreground">${payableProfit.toFixed(2)}</p>
                      </div>
                   </div>

                   <div className="space-y-2">
                      <div className="flex justify-between text-[10px] font-black uppercase">
                         <span>Volume Contribution</span>
                         <span>{totalWashCount > 0 ? ((payableWashTransactions.length / totalWashCount) * 100).toFixed(0) : 0}%</span>
                      </div>
                      <Progress value={totalWashCount > 0 ? (payableWashTransactions.length / totalWashCount) * 100 : 0} className="h-2 bg-accent/20 [&>div]:bg-accent" />
                   </div>
                </Card>
             </div>

             <Card className="border-none shadow-sm bg-white rounded-[32px] p-10">
                <div className="flex justify-between items-center mb-10">
                   <div>
                      <h3 className="text-xl font-black">Strategic Performance Audit</h3>
                      <p className="text-sm text-muted-foreground font-medium">Comparative yield and volume breakdown</p>
                   </div>
                   <PieChart className="w-10 h-10 text-primary opacity-20" />
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-4 gap-12">
                   <div className="text-center space-y-2">
                      <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Total Service Volume</p>
                      <p className="text-5xl font-black tracking-tighter">{totalWashCount}</p>
                      <p className="text-[10px] font-bold text-muted-foreground uppercase">Washes Processed</p>
                   </div>
                   <div className="text-center space-y-2">
                      <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Avg. Yield / Wash</p>
                      <p className="text-5xl font-black tracking-tighter text-primary">${totalWashCount > 0 ? (totalProfit / totalWashCount).toFixed(2) : '0.00'}</p>
                      <p className="text-[10px] font-bold text-muted-foreground uppercase">Net Profit Margin</p>
                   </div>
                   <div className="text-center space-y-2">
                      <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Subscriber Conversion</p>
                      <p className="text-5xl font-black tracking-tighter">${totalWashCount > 0 ? (studentRevenue / totalWashCount).toFixed(2) : '0.00'}</p>
                      <p className="text-[10px] font-bold text-muted-foreground uppercase">Rev per total wash</p>
                   </div>
                   <div className="text-center space-y-2">
                      <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Retail Contribution</p>
                      <p className="text-5xl font-black tracking-tighter text-accent-foreground">{totalRevenue > 0 ? ((payableRevenue / totalRevenue) * 100).toFixed(0) : 0}%</p>
                      <p className="text-[10px] font-bold text-muted-foreground uppercase">Gross Rev Percentage</p>
                   </div>
                </div>
             </Card>
          </TabsContent>

          <TabsContent value="billing">
            <div className="max-w-xl mx-auto py-12">
               <Card className="border-none shadow-sm rounded-[32px] bg-white overflow-hidden p-10 text-center space-y-8">
                 <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center text-primary mx-auto"><QrCode className="w-8 h-8" /></div>
                 <h2 className="text-2xl font-black">Settlement Profile</h2>
                 <p className="text-sm text-muted-foreground font-medium">Configure your business DuitNow QR for seamless digital top-ups.</p>
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
                             toast({ title: "Settlement QR Updated" });
                           };
                           reader.readAsDataURL(file);
                        }} />
                     </label>
                   </div>
                 ) : (
                   <label className="w-64 h-64 border-4 border-dashed rounded-[40px] flex flex-col items-center justify-center mx-auto cursor-pointer hover:bg-secondary/20 transition-all gap-4">
                      <Plus className="w-8 h-8 text-primary" />
                      <p className="text-xs font-black uppercase">Upload Settlement QR</p>
                      <input type="file" className="hidden" accept="image/*" onChange={async (e) => {
                         const file = e.target.files?.[0];
                         if (!file) return;
                         const reader = new FileReader();
                         reader.onloadend = async () => {
                           await updateDoc(doc(firestore!, 'companies', user!.companyId!), { duitNowQr: reader.result });
                           toast({ title: "Settlement QR Profile Created" });
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

      {/* Edit Student Dialog */}
      <Dialog open={isEditStudentOpen} onOpenChange={setIsEditStudentOpen}>
        <DialogContent className="rounded-[40px] max-w-lg p-0 overflow-hidden bg-white border-none shadow-2xl">
          <div className="bg-primary p-8 text-primary-foreground"><DialogTitle className="text-xl font-black">Edit Subscriber Record</DialogTitle></div>
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
            toast({ title: "Subscriber Updated" });
            setIsEditStudentOpen(false);
          }} className="p-10 space-y-6">
            <Input name="name" defaultValue={editingStudent?.name} placeholder="Name" required className="rounded-xl font-bold h-12" />
            <Input name="matrix" defaultValue={editingStudent?.matrixNumber} placeholder="Matrix ID" required className="rounded-xl font-bold h-12" />
            <div className="grid grid-cols-2 gap-4">
              <Select value={editLevel} onValueChange={setEditLevel}>
                <SelectTrigger className="rounded-xl font-bold h-12"><SelectValue placeholder="Level" /></SelectTrigger>
                <SelectContent className="rounded-xl">{LEVELS.map(lv => (<SelectItem key={lv} value={lv.toString()}>Level {lv}</SelectItem>))}</SelectContent>
              </Select>
              <Select value={editClass} onValueChange={setEditClass}>
                <SelectTrigger className="rounded-xl font-bold h-12"><SelectValue placeholder="Class" /></SelectTrigger>
                <SelectContent className="rounded-xl">{CLASSES.map(cls => (<SelectItem key={cls} value={cls}>{cls}</SelectItem>))}</SelectContent>
              </Select>
            </div>
            <Button type="submit" className="w-full h-14 rounded-2xl font-black text-lg shadow-xl">Update Record</Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PaymentOption({ value, label, icon: Icon, id }: any) {
  return (
    <div className="flex-1">
      <RadioGroupItem value={value} id={id} className="peer sr-only" />
      <Label htmlFor={id} className="flex flex-col items-center justify-center rounded-[24px] border-4 border-transparent bg-secondary/20 p-4 hover:bg-secondary/30 peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/5 cursor-pointer transition-all h-32 text-center">
        <Icon className="mb-2 h-7 w-7 text-primary" />
        <span className="text-[10px] font-black uppercase tracking-widest">{label}</span>
      </Label>
    </div>
  );
}
