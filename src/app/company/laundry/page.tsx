
'use client';

import { Sidebar } from '@/components/layout/sidebar';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
  ShoppingBag,
  RefreshCw,
  XCircle,
  ChevronRight,
  DollarSign,
  Calculator,
  ListFilter,
  Info,
  AlertTriangle,
  Lock
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import Link from 'next/link';
import Image from 'next/image';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

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
  const [isTopUpOpen, setIsTopUpOpen] = useState(false);
  const [topUpMatrix, setTopUpMatrix] = useState('');
  const [topUpAmount, setTopUpAmount] = useState<number | string>('');
  const [topUpPaymentMethod, setTopUpPaymentMethod] = useState<PaymentMethod>('cash');
  const [amountReceived, setAmountReceived] = useState<number | string>('');
  const [transactionNo, setTransactionNo] = useState('');

  // Refill States
  const [refillCategory, setRefillCategory] = useState<'student' | 'payable'>('student');
  const [refillBottles, setRefillBottles] = useState<string>('');
  const [refillVolPerBottle, setRefillVolPerBottle] = useState<string>('');
  const [refillCostPerBottle, setRefillCostPerBottle] = useState<string>('');

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

  const isBudgetActive = useMemo(() => {
    if (!companyDoc?.capitalEndDate) return false;
    const now = new Date();
    const end = new Date(companyDoc.capitalEndDate);
    end.setHours(23, 59, 59, 999);
    return now < end;
  }, [companyDoc]);

  const studentSoap = inventoryItems?.find(i => i.category === 'student');
  const payableSoap = inventoryItems?.find(i => i.category === 'payable');

  // Set default refill values based on selection
  useEffect(() => {
    const item = refillCategory === 'student' ? studentSoap : payableSoap;
    if (item) {
      setRefillVolPerBottle(item.lastBottleVolume?.toString() || '');
      setRefillCostPerBottle(item.lastBottleCost?.toString() || '');
    }
  }, [refillCategory, studentSoap, payableSoap]);

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

  const handleRegisterStudent = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!firestore || !user?.companyId) return;
    const formData = new FormData(e.currentTarget);
    const studentId = crypto.randomUUID();
    
    if (!selectedLevel || !selectedClass) {
      toast({ title: "Selection Required", description: "Please specify student Level and Class.", variant: "destructive" });
      return;
    }

    const amountToPay = Number(formData.get('amountDue')) || 0;

    const student: LaundryStudent = {
      id: studentId,
      companyId: user.companyId,
      name: formData.get('name') as string,
      matrixNumber: formData.get('matrix') as string,
      balance: -amountToPay, // Amount need to pay is recorded as negative balance
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
      toast({ title: "Registration error", variant: "destructive" });
    }
  };

  const handleRefillInventory = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!firestore || !user?.companyId) return;
    setIsProcessing(true);

    const bottles = Number(refillBottles);
    const volPerBottle = Number(refillVolPerBottle);
    const costPerBottle = Number(refillCostPerBottle);
    
    const newAmountMl = bottles * volPerBottle * 1000;
    const newTotalCost = bottles * costPerBottle;
    const newBatchCostPerLitre = newTotalCost / (bottles * volPerBottle);
    
    const docId = `${refillCategory}_soap`;

    try {
      const existing = inventoryItems?.find(i => i.id === docId);
      
      if (!existing) {
        await setDoc(doc(firestore, 'companies', user.companyId, 'laundryInventory', docId), {
          id: docId,
          companyId: user.companyId,
          soapStockMl: newAmountMl,
          soapCostPerLitre: newBatchCostPerLitre,
          capacityMl: 50000,
          category: refillCategory,
          lastBottleCost: costPerBottle,
          lastBottleVolume: volPerBottle
        });
      } else {
        const currentStockMl = existing.soapStockMl;
        const currentCostPerLitre = existing.soapCostPerLitre;
        
        // Weighted Average Cost Calculation
        const totalMl = currentStockMl + newAmountMl;
        const weightedCostPerLitre = ((currentStockMl / 1000 * currentCostPerLitre) + (newAmountMl / 1000 * newBatchCostPerLitre)) / (totalMl / 1000);

        await updateDoc(doc(firestore, 'companies', user.companyId, 'laundryInventory', docId), {
          soapStockMl: increment(newAmountMl),
          soapCostPerLitre: weightedCostPerLitre,
          lastBottleCost: costPerBottle,
          lastBottleVolume: volPerBottle
        });
      }

      await addDoc(collection(firestore, 'companies', user.companyId, 'purchases'), {
        id: crypto.randomUUID(),
        companyId: user.companyId,
        amount: newTotalCost,
        description: `${refillCategory.toUpperCase()} Soap Refill (${bottles}x ${volPerBottle}L)`,
        timestamp: new Date().toISOString()
      });

      toast({ title: "Inventory Replenished", description: `Added ${(newAmountMl/1000).toFixed(1)}L to the ${refillCategory} pool.` });
      setRefillBottles('');
    } catch (err) {
      toast({ title: "Refill failed", variant: "destructive" });
    } finally {
      setIsProcessing(false);
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
       toast({ title: "Refill Required", description: "Insufficient soap stock.", variant: "destructive" });
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
        totalCost: soapCost, 
        timestamp: new Date().toISOString(),
        customerName: selectedStudent.name,
        status: 'completed',
        items: [{ name: `Service Wash (Lv${selectedStudent.level})`, price: washRate, quantity: 1 }]
      });

      toast({ title: "Wash Fulfilled" });
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
      toast({ title: "Soap Stock Error", variant: "destructive" });
      return;
    }

    const amount = Number(payableAmount);
    if (payablePaymentMethod === 'cash' && (Number(payableCashReceived) || 0) < amount) {
      toast({ title: "Payment Error", variant: "destructive" });
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
        totalCost: soapCost, 
        timestamp: new Date().toISOString(),
        customerName: payableName,
        paymentMethod: payablePaymentMethod,
        referenceNumber: payableRef || null,
        status: 'completed',
        items: [{ name: 'Payable Service Wash', price: amount, quantity: 1 }]
      });

      toast({ title: "Service Complete" });
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
        profit: 0, 
        totalCost: 0, 
        timestamp: new Date().toISOString(),
        customerName: foundTopUpStudent.name,
        paymentMethod: topUpPaymentMethod,
        referenceNumber: transactionNo || null,
        status: 'completed',
        items: [{ name: 'Account Deposit', price: amount, quantity: 1 }]
      });

      toast({ title: "Balance Updated" });
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
  
  const studentUsageRevenue = laundryTransactions.filter(t => !t.items[0].name.includes('Payable') && !t.items[0].name.includes('Deposit')).reduce((acc, t) => acc + t.totalAmount, 0);
  const payableUsageRevenue = laundryTransactions.filter(t => t.items[0].name.includes('Payable')).reduce((acc, t) => acc + t.totalAmount, 0);

  const todayWashes = laundryTransactions.filter(t => {
    const d = new Date(t.timestamp);
    const now = new Date();
    return d.toDateString() === now.toDateString() && !t.items[0].name.includes('Deposit');
  });

  const refillPreviewMl = Number(refillBottles) * Number(refillVolPerBottle) * 1000;
  const refillPreviewCost = Number(refillBottles) * Number(refillCostPerBottle);

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
                   <p className="text-xs font-black uppercase tracking-widest opacity-80 mb-2">Student Settlement</p>
                   <DialogTitle className="text-4xl font-black tracking-tighter">Top-Up Registry</DialogTitle>
                </div>
                <div className="p-10 space-y-8">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-muted-foreground px-1 tracking-widest">Subscriber Matrix No</Label>
                    <Input 
                      placeholder="SCAN OR TYPE MATRIX..." 
                      className="h-14 rounded-2xl font-black text-xl bg-secondary/10 border-none px-6"
                      value={topUpMatrix}
                      onChange={(e) => setTopUpMatrix(e.target.value)}
                    />
                  </div>
                  {foundTopUpStudent && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-top-2">
                      <div className="p-6 bg-primary/5 rounded-[32px] border-2 border-primary/10 flex justify-between items-center">
                        <div>
                          <p className="text-[10px] font-black text-primary uppercase tracking-widest">Active Subscriber</p>
                          <h4 className="text-2xl font-black">{foundTopUpStudent.name}</h4>
                          <p className="text-xs font-bold text-muted-foreground">Lv {foundTopUpStudent.level} • {foundTopUpStudent.class}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Net Balance</p>
                          <p className={cn("text-3xl font-black", foundTopUpStudent.balance < 0 ? "text-destructive" : "text-foreground")}>
                            ${foundTopUpStudent.balance.toFixed(2)}
                          </p>
                        </div>
                      </div>
                      <div className="space-y-4">
                        <Label className="text-[10px] font-black uppercase text-muted-foreground px-1 tracking-widest">Deposit Amount ($)</Label>
                        <Input 
                          type="number" 
                          placeholder="0.00" 
                          className="h-16 rounded-2xl font-black text-3xl bg-secondary/10 border-none px-6"
                          value={topUpAmount}
                          onChange={(e) => setTopUpAmount(e.target.value)}
                        />
                      </div>
                      <RadioGroup value={topUpPaymentMethod} onValueChange={(v) => setTopUpPaymentMethod(v as PaymentMethod)} className="grid grid-cols-3 gap-3">
                        <PaymentOption value="cash" label="Cash" icon={Banknote} id="topup_cash" />
                        <PaymentOption value="card" label="Card" icon={CreditCard} id="topup_card" />
                        <PaymentOption value="duitnow" label="DuitNow" icon={QrCode} id="duitnow_final" />
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

        {!isBudgetActive && (
          <Alert variant="destructive" className="mb-6 rounded-2xl bg-destructive/10 border-destructive/20">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle className="font-black uppercase text-xs tracking-widest">Financial Guardrail Active</AlertTitle>
            <AlertDescription className="text-sm font-medium">
              You cannot register new students or replenish soap inventory because your <strong>Capital Base Limit</strong> is not set. 
              Please <Link href="/company/capital" className="underline font-black hover:opacity-80">configure your budget</Link> to enable procurement.
            </AlertDescription>
          </Alert>
        )}

        <Tabs defaultValue="pos" className="space-y-6">
          <TabsList className="bg-white/50 border p-1 rounded-xl shadow-sm overflow-x-auto max-w-full">
            <TabsTrigger value="pos" className="rounded-lg gap-2">POS Terminal</TabsTrigger>
            <TabsTrigger value="payable" className="rounded-lg gap-2">Payable Laundry</TabsTrigger>
            <TabsTrigger value="students" className="rounded-lg gap-2">Subscribers</TabsTrigger>
            <TabsTrigger value="schedule" className="rounded-lg gap-2">Schedule</TabsTrigger>
            <TabsTrigger value="config" className="rounded-lg gap-2">Pricing Config</TabsTrigger>
            <TabsTrigger value="consumables" className="rounded-lg gap-2">Inventory</TabsTrigger>
            <TabsTrigger value="profits" className="rounded-lg gap-2">Analytics</TabsTrigger>
            <TabsTrigger value="billing" className="rounded-lg gap-2">Digital Gateway</TabsTrigger>
          </TabsList>

          <TabsContent value="pos" className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-6">
              <Card className="border-none shadow-sm bg-white rounded-3xl overflow-hidden">
                <CardHeader className="bg-secondary/10 p-8">
                  <div className="flex justify-between items-center">
                    <div>
                      <CardTitle className="text-xl font-black">Washing Terminal</CardTitle>
                      <CardDescription className="font-bold">Authorized student usage verification</CardDescription>
                    </div>
                    <div className="text-right">
                       <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest mb-1">Live Date</p>
                       <p className="font-black text-primary">{todayDate ? new Date(todayDate).toLocaleDateString([], { dateStyle: 'long' }) : "---"}</p>
                    </div>
                  </div>
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
                            <div className="flex items-center gap-2 mt-2">
                              <Badge variant="outline" className="font-bold">Level {selectedStudent.level}</Badge>
                              <Badge variant="outline" className="font-bold">{selectedStudent.class}</Badge>
                            </div>
                          </div>
                          
                          <div className="pt-2">
                            {isLevelAllowedToday(selectedStudent.level) ? (
                              <Badge className="bg-green-600 h-8 px-4 font-black text-sm flex items-center gap-2 rounded-full">
                                <CheckCircle2 className="w-4 h-4" /> Turn Authorized
                              </Badge>
                            ) : (
                              <div className="bg-destructive/10 border-2 border-destructive p-4 rounded-2xl flex items-start gap-3">
                                 <AlertCircle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
                                 <div>
                                    <p className="font-black text-destructive text-sm uppercase">Unauthorized Access</p>
                                    <p className="text-xs font-bold text-destructive/80 mt-1">This student cannot use laundry today because it is not his/her level turn today.</p>
                                 </div>
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Net Balance</p>
                          <p className={cn(
                            "text-5xl font-black tracking-tighter",
                            selectedStudent.balance < 0 ? "text-destructive" : "text-primary"
                          )}>${selectedStudent.balance.toFixed(2)}</p>
                          <div className="mt-2">
                             <Badge variant="secondary" className="font-black text-[10px] uppercase">Service Fee: ${getWashRateForLevel(selectedStudent.level).toFixed(2)}</Badge>
                          </div>
                        </div>
                      </div>
                      
                      <Button 
                        className="w-full h-16 rounded-2xl text-xl font-black shadow-xl group" 
                        onClick={handleChargeLaundry} 
                        disabled={isProcessing || !isLevelAllowedToday(selectedStudent.level)}
                      >
                        {isProcessing ? "Authorizing..." : (
                          <span className="flex items-center gap-3">
                            Confirm Wash & Debit Account <ArrowRight className="w-6 h-6 group-hover:translate-x-1 transition-transform" />
                          </span>
                        )}
                      </Button>
                    </div>
                  ) : (
                    <div className="py-24 text-center bg-secondary/10 rounded-[32px] border-4 border-dashed border-secondary/30">
                      <Search className="w-16 h-16 mx-auto mb-4 opacity-10" />
                      <p className="font-black text-muted-foreground uppercase tracking-widest">Scanner Ready</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
            <div className="lg:col-span-1 space-y-6">
              <Card className="bg-primary border-none shadow-2xl text-primary-foreground rounded-[32px] p-8 overflow-hidden relative">
                <div className="absolute top-0 right-0 p-8 opacity-10"><Clock className="w-32 h-32" /></div>
                <CardTitle className="flex items-center gap-3 text-xl font-black mb-6 relative z-10">
                  <CalendarDays className="w-6 h-6" /> Turn Schedule
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
                          <Badge className="bg-white text-primary font-black">Authorized Today</Badge>
                        ) : (
                          <Badge variant="outline" className="text-white/40 font-bold">Closed</Badge>
                        )}
                      </div>
                    );
                  })}
                </div>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="payable">
             <Card className="border-none shadow-sm bg-white rounded-3xl p-8 max-w-2xl mx-auto">
                <CardHeader className="px-0 pt-0 mb-8">
                   <CardTitle className="text-2xl font-black">Payable Service Entry</CardTitle>
                   <CardDescription className="font-bold">Record immediate revenue for walk-in customers</CardDescription>
                </CardHeader>
                <div className="space-y-8">
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                         <Label className="text-[10px] font-black uppercase text-muted-foreground px-1">Customer Name</Label>
                         <Input placeholder="Full Name" value={payableName} onChange={(e) => setPayableName(e.target.value)} className="h-12 rounded-xl font-bold bg-secondary/10 border-none" />
                      </div>
                      <div className="space-y-2">
                         <Label className="text-[10px] font-black uppercase text-muted-foreground px-1">Service Amount ($)</Label>
                         <Input type="number" placeholder="5.00" value={payableAmount} onChange={(e) => setPayableAmount(e.target.value)} className="h-12 rounded-xl font-bold bg-secondary/10 border-none text-primary" />
                      </div>
                   </div>
                   
                   <div className="space-y-4">
                      <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground px-1">Settlement Gateway</Label>
                      <RadioGroup value={payablePaymentMethod} onValueChange={(v) => setPayablePaymentMethod(v as PaymentMethod)} className="grid grid-cols-3 gap-3">
                         <PaymentOption value="cash" label="Cash" icon={Banknote} id="pay_wash_cash" />
                         <PaymentOption value="card" label="Card" icon={CreditCard} id="pay_wash_card" />
                         <PaymentOption value="duitnow" label="DuitNow" icon={QrCode} id="pay_wash_qr" />
                      </RadioGroup>
                   </div>

                   {payablePaymentMethod === 'cash' ? (
                     <div className="p-6 bg-primary/5 rounded-[32px] border-2 border-primary/10 space-y-6">
                        <div className="space-y-2">
                           <Label className="text-[10px] font-black uppercase text-primary">Cash Received ($)</Label>
                           <Input type="number" value={payableCashReceived} onChange={(e) => setPayableCashReceived(e.target.value)} className="h-16 rounded-2xl font-black text-3xl text-center bg-white border-none" />
                        </div>
                        {Number(payableCashReceived) >= Number(payableAmount) && Number(payableAmount) > 0 && (
                          <div className="flex justify-between items-center px-2">
                             <span className="text-xs font-black uppercase text-muted-foreground">Change Due:</span>
                             <span className="text-3xl font-black text-foreground">${payableChange.toFixed(2)}</span>
                          </div>
                        )}
                     </div>
                   ) : (
                     <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase text-muted-foreground px-1">Trace ID / Reference</Label>
                        <Input placeholder="Enter Trace No..." value={payableRef} onChange={(e) => setPayableRef(e.target.value)} className="h-12 rounded-xl font-bold bg-secondary/10 border-none" />
                     </div>
                   )}

                   <Button onClick={handlePayableWash} className="w-full h-16 rounded-[24px] font-black text-xl shadow-xl" disabled={isProcessing || !payableAmount || !payableName}>
                      {isProcessing ? "Processing..." : "Complete & Confirm Wash"}
                   </Button>
                </div>
             </Card>
          </TabsContent>

          <TabsContent value="students" className="grid grid-cols-1 lg:grid-cols-4 gap-8">
             <div className="lg:col-span-1">
                <Card className={cn(
                  "border-none shadow-sm rounded-3xl bg-white p-8 sticky top-8",
                  !isBudgetActive && "opacity-50 pointer-events-none"
                )}>
                   <h3 className="text-xl font-black mb-6">New Enrollment</h3>
                   <form onSubmit={handleRegisterStudent} className="space-y-5">
                      <div className="space-y-1.5"><Label className="text-[10px] font-black uppercase text-muted-foreground">Full Name</Label><Input name="name" required disabled={!isBudgetActive} className="h-11 rounded-xl bg-secondary/10 border-none font-bold" /></div>
                      <div className="space-y-1.5"><Label className="text-[10px] font-black uppercase text-muted-foreground">Matrix Number</Label><Input name="matrix" required disabled={!isBudgetActive} className="h-11 rounded-xl bg-secondary/10 border-none font-bold" /></div>
                      <div className="grid grid-cols-2 gap-3">
                         <div className="space-y-1.5">
                            <Label className="text-[10px] font-black uppercase text-muted-foreground">Level</Label>
                            <Select value={selectedLevel} onValueChange={setSelectedLevel} disabled={!isBudgetActive}>
                               <SelectTrigger className="h-11 rounded-xl bg-secondary/10 border-none font-bold"><SelectValue /></SelectTrigger>
                               <SelectContent className="rounded-xl font-bold">{LEVELS.map(l => <SelectItem key={l} value={l.toString()}>Level {l}</SelectItem>)}</SelectContent>
                            </Select>
                         </div>
                         <div className="space-y-1.5">
                            <Label className="text-[10px] font-black uppercase text-muted-foreground">Class</Label>
                            <Select value={selectedClass} onValueChange={setSelectedClass} disabled={!isBudgetActive}>
                               <SelectTrigger className="h-11 rounded-xl bg-secondary/10 border-none font-bold"><SelectValue /></SelectTrigger>
                               <SelectContent className="rounded-xl font-bold">{CLASSES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                            </Select>
                         </div>
                      </div>
                      <div className="space-y-1.5">
                         <Label className="text-[10px] font-black uppercase text-muted-foreground">Initial Amount Need to Pay ($)</Label>
                         <Input name="amountDue" type="number" defaultValue="0" disabled={!isBudgetActive} className="h-11 rounded-xl bg-secondary/10 border-none font-bold text-destructive" />
                         <p className="text-[9px] font-bold text-muted-foreground italic">Balance will be negative until top-up.</p>
                      </div>
                      <Button type="submit" className="w-full h-12 rounded-xl font-black shadow-lg" disabled={!isBudgetActive}>Save Subscriber</Button>
                   </form>
                </Card>
             </div>
             <div className="lg:col-span-3">
                <div className="bg-white rounded-[32px] border shadow-sm overflow-hidden">
                   <table className="w-full text-sm text-left">
                      <thead className="bg-secondary/20">
                         <tr>
                           <th className="p-6 font-black uppercase text-[10px]">Subscriber / Matrix</th>
                           <th className="p-6 font-black uppercase text-[10px]">Level</th>
                           <th className="p-6 font-black uppercase text-[10px]">Per Service Fee</th>
                           <th className="p-6 font-black uppercase text-[10px]">Amount Need to Pay / Balance</th>
                           <th className="p-6 text-center font-black uppercase text-[10px]">Action</th>
                         </tr>
                      </thead>
                      <tbody className="divide-y">
                         {students?.map(s => (
                           <tr key={s.id} className="hover:bg-secondary/5 group">
                              <td className="p-6">
                                 <p className="font-black text-lg">{s.name}</p>
                                 <p className="text-[10px] font-bold text-muted-foreground uppercase">{s.matrixNumber} • {s.class}</p>
                              </td>
                              <td className="p-6"><Badge variant="secondary" className="font-black">Level {s.level}</Badge></td>
                              <td className="p-6 font-bold text-muted-foreground">${getWashRateForLevel(s.level).toFixed(2)}</td>
                              <td className="p-6">
                                 <p className={cn("font-black text-lg", s.balance < 0 ? "text-destructive" : "text-green-600")}>
                                    ${Math.abs(s.balance).toFixed(2)}
                                    <span className="text-[10px] ml-2 uppercase opacity-60">
                                       {s.balance < 0 ? "(OWED)" : "(CREDIT)"}
                                    </span>
                                 </p>
                              </td>
                              <td className="p-6 text-center">
                                 <Button variant="ghost" size="icon" onClick={async () => {
                                    if(confirm("Expel this subscriber?")) await deleteDoc(doc(firestore!, 'companies', user!.companyId!, 'laundryStudents', s.id));
                                 }} className="text-destructive opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 className="w-4 h-4" /></Button>
                              </td>
                           </tr>
                         ))}
                      </tbody>
                   </table>
                </div>
             </div>
          </TabsContent>

          <TabsContent value="schedule">
             <LaundryScheduler companyId={user?.companyId} schedules={schedules} levelConfigs={levelConfigs} />
          </TabsContent>

          <TabsContent value="config">
             <LaundryConfigurator companyId={user?.companyId} levelConfigs={levelConfigs} />
          </TabsContent>

          <TabsContent value="consumables">
             <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                <div className="lg:col-span-1">
                   <Card className={cn(
                     "border-none shadow-sm rounded-3xl bg-white p-8 sticky top-8",
                     !isBudgetActive && "opacity-50 pointer-events-none"
                   )}>
                      <div className="flex items-center gap-2 mb-6">
                        <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center text-primary">
                          <RefreshCw className="w-5 h-5" />
                        </div>
                        <h3 className="text-xl font-black">Stock Replenish</h3>
                      </div>
                      <form onSubmit={handleRefillInventory} className="space-y-5">
                         <div className="space-y-1.5">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Inventory Pool</Label>
                            <Select value={refillCategory} onValueChange={(v: any) => setRefillCategory(v)} disabled={!isBudgetActive}>
                               <SelectTrigger className="rounded-xl h-11 font-bold bg-secondary/10 border-none"><SelectValue /></SelectTrigger>
                               <SelectContent className="rounded-xl font-bold"><SelectItem value="student">Student Pool</SelectItem><SelectItem value="payable">Payable Pool</SelectItem></SelectContent>
                            </Select>
                         </div>
                         <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                               <Label className="text-[10px] font-black uppercase text-muted-foreground">Amount of Bottles</Label>
                               <Input value={refillBottles} onChange={(e) => setRefillBottles(e.target.value)} disabled={!isBudgetActive} type="number" className="rounded-xl h-11 font-bold bg-secondary/10 border-none" placeholder="0" />
                            </div>
                            <div className="space-y-1.5">
                               <Label className="text-[10px] font-black uppercase text-muted-foreground">Litres/Bottle</Label>
                               <Input value={refillVolPerBottle} onChange={(e) => setRefillVolPerBottle(e.target.value)} disabled={!isBudgetActive} type="number" className="rounded-xl h-11 font-bold bg-secondary/10 border-none" placeholder="0.0" />
                            </div>
                         </div>
                         <div className="space-y-1.5">
                            <Label className="text-[10px] font-black uppercase text-muted-foreground">Price/Bottle ($)</Label>
                            <Input value={refillCostPerBottle} onChange={(e) => setRefillCostPerBottle(e.target.value)} disabled={!isBudgetActive} type="number" step="0.01" className="rounded-xl h-11 font-bold bg-secondary/10 border-none" placeholder="0.00" />
                         </div>

                         {Number(refillBottles) > 0 && (
                           <div className="bg-primary/5 p-4 rounded-2xl border-2 border-primary/10 space-y-2 animate-in fade-in zoom-in-95">
                              <div className="flex items-center gap-2 text-[9px] font-black text-primary uppercase tracking-widest mb-1">
                                 <Info className="w-3 h-3" /> Batch Calculation
                              </div>
                              <div className="flex justify-between items-center text-[10px] font-black uppercase">
                                 <span className="text-muted-foreground">Total Vol.</span>
                                 <span className="text-foreground">{refillPreviewMl.toLocaleString()} ml</span>
                              </div>
                              <div className="flex justify-between items-center text-[10px] font-black uppercase">
                                 <span className="text-muted-foreground">Cost/ML</span>
                                 <span className="text-primary">${(Number(refillCostPerBottle) / (Number(refillVolPerBottle) * 1000 || 1)).toFixed(4)}</span>
                              </div>
                              <div className="flex justify-between items-center text-[10px] font-black uppercase border-t pt-2 mt-2">
                                 <span className="text-muted-foreground">Aggregate Cost</span>
                                 <span className="text-primary font-black">${refillPreviewCost.toFixed(2)}</span>
                              </div>
                           </div>
                         )}

                         <Button type="submit" className="w-full h-12 rounded-xl font-black shadow-lg" disabled={isProcessing || !refillBottles || !refillVolPerBottle || !refillCostPerBottle || !isBudgetActive}>
                            {isProcessing ? "Processing..." : "Confirm Stock Refill"}
                         </Button>
                      </form>
                   </Card>
                </div>
                <div className="lg:col-span-3 grid grid-cols-1 md:grid-cols-2 gap-8">
                   <InventoryGauge label="Student Usage Consumables" item={studentSoap} />
                   <InventoryGauge label="Payable Laundry Consumables" item={payableSoap} />
                </div>
             </div>
          </TabsContent>

          <TabsContent value="profits">
             <div className="space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                   <ReportStat label="Aggregate Revenue" value={`$${totalRevenue.toFixed(2)}`} icon={DollarSign} />
                   <ReportStat label="Realized Margin" value={`$${totalProfit.toFixed(2)}`} icon={TrendingUp} color="text-primary" />
                   <ReportStat label="Student Usage Rev." value={`$${studentUsageRevenue.toFixed(2)}`} icon={User} />
                   <ReportStat label="Payable Laundry Rev." value={`$${payableUsageRevenue.toFixed(2)}`} icon={ShoppingBag} />
                </div>
                <div className="bg-white rounded-[40px] border shadow-sm overflow-hidden p-10">
                   <h3 className="text-xl font-black mb-6">Today's Service Feed</h3>
                   <div className="divide-y">
                      {todayWashes.slice().reverse().map(t => (
                        <div key={t.id} className="py-4 flex justify-between items-center">
                           <div className="flex items-center gap-4">
                              <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center text-primary">
                                 <RefreshCw className="w-5 h-5" />
                              </div>
                              <div>
                                 <p className="font-black">{t.customerName}</p>
                                 <p className="text-[10px] font-bold text-muted-foreground uppercase">{t.items[0].name} • {new Date(t.timestamp).toLocaleTimeString()}</p>
                              </div>
                           </div>
                           <div className="text-right">
                              <p className="font-black text-primary">${t.totalAmount.toFixed(2)}</p>
                              <p className="text-[9px] font-bold text-muted-foreground uppercase">Cost: ${t.totalCost?.toFixed(2)}</p>
                           </div>
                        </div>
                      ))}
                      {todayWashes.length === 0 && (
                        <div className="py-20 text-center opacity-30">
                           <History className="w-16 h-16 mx-auto mb-4" />
                           <p className="font-black uppercase tracking-widest">No washes processed today</p>
                        </div>
                      )}
                   </div>
                </div>
             </div>
          </TabsContent>

          <TabsContent value="billing">
             <div className="max-w-xl mx-auto py-12 text-center space-y-8">
                <Card className="border-none shadow-sm rounded-[40px] bg-white p-12 space-y-8">
                   <div className="w-20 h-20 bg-primary/10 rounded-3xl flex items-center justify-center text-primary mx-auto"><QrCode className="w-10 h-10" /></div>
                   <h2 className="text-3xl font-black">Laundry Gateway</h2>
                   <p className="text-muted-foreground font-medium">Configure the DuitNow QR for digital laundry settlements.</p>
                   {companyDoc?.duitNowQr ? (
                     <div className="relative group w-fit mx-auto">
                        <Image src={companyDoc.duitNowQr} alt="QR" width={200} height={200} className="rounded-3xl border-4" />
                        <label className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center rounded-3xl cursor-pointer transition-opacity">
                           <Upload className="text-white w-8 h-8" />
                           <input type="file" className="hidden" accept="image/*" onChange={async (e) => {
                              const file = e.target.files?.[0];
                              if(!file || !firestore || !user?.companyId) return;
                              const reader = new FileReader();
                              reader.onloadend = () => updateDoc(doc(firestore, 'companies', user.companyId!), { duitNowQr: reader.result as string });
                              reader.readAsDataURL(file);
                           }} />
                        </label>
                     </div>
                   ) : (
                     <div className="py-20 border-4 border-dashed rounded-[40px] opacity-30 cursor-pointer hover:bg-secondary/20 transition-all flex flex-col items-center justify-center gap-4">
                        <Plus className="w-12 h-12" />
                        <p className="text-xs font-black uppercase">Upload QR Code</p>
                        <input type="file" className="hidden" accept="image/*" onChange={async (e) => {
                           const file = e.target.files?.[0];
                           if(!file || !firestore || !user?.companyId) return;
                           const reader = new FileReader();
                           reader.onloadend = () => updateDoc(doc(firestore, 'companies', user.companyId!), { duitNowQr: reader.result as string });
                           reader.readAsDataURL(file);
                        }} />
                     </div>
                   )}
                </Card>
             </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

function LaundryConfigurator({ companyId, levelConfigs }: { companyId?: string, levelConfigs: LaundryLevelConfig[] | null }) {
  const firestore = useFirestore();
  const { toast } = useToast();
  const [isUpdating, setIsUpdating] = useState(false);

  const saveConfig = async (level: number, fee: number, quota: number) => {
    if (!firestore || !companyId) return;
    setIsUpdating(true);
    const id = `LV${level}_CONFIG`;
    try {
      await setDoc(doc(firestore, 'companies', companyId, 'laundryLevelConfigs', id), {
        id, companyId, level, subscriptionFee: fee, totalWashesAllowed: quota
      });
      toast({ title: `Level ${level} Updated` });
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <Card className="border-none shadow-sm bg-white rounded-3xl p-10 max-w-4xl mx-auto">
       <div className="mb-10 text-center">
          <h3 className="text-2xl font-black">Quota & Pricing Policy</h3>
          <p className="text-sm font-bold text-muted-foreground">Define departmental wash limits and subscription rates</p>
       </div>
       <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {LEVELS.map(lv => {
            const config = levelConfigs?.find(c => c.level === lv);
            return (
              <div key={lv} className="bg-secondary/10 p-6 rounded-3xl space-y-4 border-2 border-transparent hover:border-primary/20 transition-all">
                 <div className="flex justify-between items-center">
                    <Badge className="h-8 px-4 font-black">Level {lv}</Badge>
                    <p className="text-[10px] font-black uppercase text-muted-foreground">Strategic Tier</p>
                 </div>
                 <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                       <Label className="text-[10px] font-black uppercase px-1">Sub. Fee ($)</Label>
                       <Input 
                        type="number" 
                        defaultValue={config?.subscriptionFee || 0} 
                        onBlur={(e) => saveConfig(lv, Number(e.target.value), config?.totalWashesAllowed || 0)}
                        className="h-11 rounded-xl font-bold bg-white border-none"
                       />
                    </div>
                    <div className="space-y-1">
                       <Label className="text-[10px] font-black uppercase px-1">Wash Quota</Label>
                       <Input 
                        type="number" 
                        defaultValue={config?.totalWashesAllowed || 0} 
                        onBlur={(e) => saveConfig(lv, config?.subscriptionFee || 0, Number(e.target.value))}
                        className="h-11 rounded-xl font-bold bg-white border-none"
                       />
                    </div>
                 </div>
                 <div className="pt-2">
                    <div className="flex justify-between items-center px-1">
                       <span className="text-[9px] font-black text-muted-foreground uppercase">Internal Service Rate</span>
                       <span className="text-sm font-black text-primary">${((config?.subscriptionFee || 0) / (config?.totalWashesAllowed || 1)).toFixed(2)}/wash</span>
                    </div>
                 </div>
              </div>
            );
          })}
       </div>
    </Card>
  );
}

function LaundryScheduler({ companyId, schedules, levelConfigs }: { companyId?: string, schedules: LaundrySchedule[] | null, levelConfigs: LaundryLevelConfig[] | null }) {
  const firestore = useFirestore();
  const { toast } = useToast();
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedLevels, setSelectedLevels] = useState<number[]>([]);

  useEffect(() => {
    if (schedules) {
      const active = schedules.filter(s => s.date === selectedDate).map(s => s.level);
      setSelectedLevels(active);
    }
  }, [schedules, selectedDate]);

  const toggleLevel = async (lv: number) => {
    if (!firestore || !companyId) return;
    const existing = schedules?.find(s => s.date === selectedDate && s.level === lv);
    if (existing) {
      await deleteDoc(doc(firestore, 'companies', companyId, 'laundrySchedules', existing.id));
    } else {
      const id = `${selectedDate}_LV${lv}`;
      await setDoc(doc(firestore, 'companies', companyId, 'laundrySchedules', id), {
        id, companyId, date: selectedDate, level: lv
      });
    }
  };

  const handleRemoveSchedule = async (id: string) => {
    if (!firestore || !companyId) return;
    await deleteDoc(doc(firestore, 'companies', companyId, 'laundrySchedules', id));
    toast({ title: "Turn Removed" });
  };

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
       {/* Strategic Quota Section */}
       <Card className="border-none shadow-sm bg-white rounded-3xl overflow-hidden">
          <CardHeader className="bg-primary/10 p-8 border-b">
             <div className="flex items-center gap-3">
                <Calculator className="w-6 h-6 text-primary" />
                <div>
                   <CardTitle className="text-xl font-black">Strategic Quota Overview</CardTitle>
                   <CardDescription className="font-bold">Total authorized washes per student level</CardDescription>
                </div>
             </div>
          </CardHeader>
          <CardContent className="p-8">
             <div className="grid grid-cols-5 gap-4">
                {LEVELS.map(lv => {
                  const config = levelConfigs?.find(c => c.level === lv);
                  return (
                    <div key={lv} className="p-4 bg-secondary/10 rounded-2xl text-center border-2 border-transparent">
                       <p className="text-[10px] font-black uppercase text-muted-foreground mb-1 tracking-widest leading-none">Level {lv}</p>
                       <p className="text-2xl font-black text-foreground">{config?.totalWashesAllowed || 0}</p>
                       <p className="text-[8px] font-bold text-muted-foreground uppercase">Washes Allowed</p>
                    </div>
                  );
                })}
             </div>
          </CardContent>
       </Card>

       <Card className="border-none shadow-sm bg-white rounded-3xl p-10">
          <div className="flex justify-between items-center mb-10">
             <div><h3 className="text-2xl font-black">Turn Scheduler</h3><p className="text-sm font-bold text-muted-foreground">Manage authorized wash days</p></div>
             <div className="flex items-center gap-3">
                <CalendarDays className="w-5 h-5 text-primary" />
                <Input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="w-48 h-12 rounded-xl font-bold bg-secondary/10 border-none" />
             </div>
          </div>
          <div className="grid grid-cols-5 gap-4">
             {LEVELS.map(lv => (
               <button key={lv} onClick={() => toggleLevel(lv)} className={cn(
                 "h-32 rounded-[32px] border-4 flex flex-col items-center justify-center transition-all",
                 selectedLevels.includes(lv) ? "bg-primary border-primary text-primary-foreground shadow-xl scale-105" : "bg-secondary/10 border-transparent text-muted-foreground opacity-50"
               )}>
                  <p className="text-[10px] font-black uppercase mb-1">Level</p>
                  <p className="text-4xl font-black">{lv}</p>
                  {selectedLevels.includes(lv) && <CheckCircle2 className="w-5 h-5 mt-2" />}
               </button>
             ))}
          </div>
       </Card>

       {/* Scheduled Registry Table */}
       <Card className="border-none shadow-sm bg-white rounded-3xl overflow-hidden">
          <CardHeader className="bg-secondary/10 p-8">
             <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                   <ListFilter className="w-6 h-6 text-primary" />
                   <CardTitle className="text-xl font-black">Scheduled Registry</CardTitle>
                </div>
                <Badge variant="outline" className="font-black text-[10px] uppercase">{schedules?.length || 0} Turn Records</Badge>
             </div>
          </CardHeader>
          <div className="overflow-hidden">
             <table className="w-full text-sm text-left">
                <thead className="bg-secondary/5">
                   <tr>
                      <th className="p-6 font-black uppercase text-[10px] tracking-widest text-muted-foreground">Date of Turn</th>
                      <th className="p-6 font-black uppercase text-[10px] tracking-widest text-muted-foreground">Authorized Level</th>
                      <th className="p-6 font-black uppercase text-[10px] tracking-widest text-muted-foreground text-center">Action</th>
                   </tr>
                </thead>
                <tbody className="divide-y">
                   {schedules?.sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime()).map(s => (
                     <tr key={s.id} className="hover:bg-secondary/5 group">
                        <td className="p-6 font-black text-foreground">
                           {new Date(s.date).toLocaleDateString([], { dateStyle: 'full' })}
                        </td>
                        <td className="p-6">
                           <Badge className="bg-primary h-7 px-4 font-black uppercase text-[10px]">Level {s.level}</Badge>
                        </td>
                        <td className="p-6 text-center">
                           <Button 
                            variant="ghost" 
                            size="icon" 
                            onClick={() => handleRemoveSchedule(s.id)}
                            className="text-destructive hover:bg-destructive/10 opacity-0 group-hover:opacity-100 transition-opacity"
                           >
                              <Trash2 className="w-4 h-4" />
                           </Button>
                        </td>
                     </tr>
                   ))}
                   {(!schedules || schedules.length === 0) && (
                     <tr>
                        <td colSpan={3} className="py-24 text-center opacity-30">
                           <CalendarDays className="w-16 h-16 mx-auto mb-4" />
                           <p className="font-black uppercase tracking-widest">No Turn records found</p>
                        </td>
                     </tr>
                   )}
                </tbody>
             </table>
          </div>
       </Card>
    </div>
  );
}

function InventoryGauge({ label, item }: { label: string, item?: LaundryInventory }) {
  const stock = item?.soapStockMl || 0;
  const capacity = item?.capacityMl || 50000;
  const percentage = (stock / capacity) * 100;

  return (
    <Card className="border-none shadow-sm bg-white rounded-3xl p-8 relative overflow-hidden">
       <div className="absolute top-0 right-0 p-6 opacity-5"><Droplet className="w-24 h-24" /></div>
       <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest mb-2">{label}</p>
       <h4 className="text-4xl font-black tracking-tighter">{(stock / 1000).toFixed(1)}L</h4>
       <p className="text-xs font-bold opacity-60 mb-6">of {(capacity / 1000)}L Capacity</p>
       <Progress value={percentage} className="h-3 rounded-full" />
       {item?.soapCostPerLitre && <p className="text-[10px] font-black text-primary uppercase mt-4">Weighted Value: ${item.soapCostPerLitre.toFixed(2)}/L</p>}
    </Card>
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

function ReportStat({ label, value, icon: Icon, color = "text-foreground" }: any) {
  return (
    <Card className="border-none shadow-sm p-8 bg-white rounded-[32px] flex justify-between items-start">
       <div>
          <p className="text-[10px] font-black uppercase text-muted-foreground mb-2 tracking-widest">{label}</p>
          <h4 className={cn("text-4xl font-black tracking-tighter", color)}>{value}</h4>
       </div>
       <div className="w-12 h-12 bg-secondary/50 rounded-2xl flex items-center justify-center text-primary"><Icon className="w-6 h-6" /></div>
    </Card>
  );
}
