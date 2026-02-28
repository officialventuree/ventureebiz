'use client';

import { Sidebar } from '@/components/layout/sidebar';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Waves, 
  Droplet, 
  Search, 
  History, 
  Trash2, 
  TrendingUp, 
  Wallet, 
  QrCode, 
  Upload, 
  Banknote,
  CreditCard,
  Edit2,
  CalendarDays,
  Plus,
  CheckCircle2,
  ArrowRight,
  User,
  ShieldCheck,
  AlertCircle,
  Clock,
  RefreshCw,
  Calculator,
  ListFilter,
  AlertTriangle,
  Settings2,
  FlaskConical,
  Scale,
  HandCoins,
  BarChart3,
  Lock,
  XCircle,
  Landmark
} from 'lucide-react';
import { useAuth } from '@/components/auth-context';
import { useFirestore, useCollection, useMemoFirebase, useDoc, deleteDocumentNonBlocking } from '@/firebase';
import { collection, doc, setDoc, addDoc, updateDoc, increment } from 'firebase/firestore';
import { useState, useMemo, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LaundryStudent, SaleTransaction, LaundryInventory, Company, PaymentMethod, LaundrySchedule, CapitalPurchase } from '@/lib/types';
import { cn } from '@/lib/utils';
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
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

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

  // Editing State
  const [editingStudent, setEditingStudent] = useState<LaundryStudent | null>(null);

  // Refill States
  const [refillCategory, setRefillCategory] = useState<'student' | 'payable'>('student');
  const [refillBottles, setRefillBottles] = useState<string>('0');
  const [refillVolPerBottle, setRefillVolPerBottle] = useState<string>('');
  const [refillCostPerBottle, setRefillCostPerBottle] = useState<string>('');

  // Payable States
  const [payableName, setPayableName] = useState('');
  const [payableAmount, setPayableAmount] = useState<number | string>('');
  const [payablePaymentMethod, setPayablePaymentMethod] = useState<PaymentMethod>('cash');
  const [payableCashReceived, setPayableCashReceived] = useState<number | string>('');
  const [payableRef, setPayableRef] = useState('');

  useEffect(() => {
    setTodayDate(new Date().toISOString().split('T')[0]);
  }, []);

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

  const scheduleQuery = useMemoFirebase(() => {
    if (!firestore || !user?.companyId) return null;
    return collection(firestore, 'companies', user.companyId, 'laundrySchedules');
  }, [firestore, user?.companyId]);

  const globalConfigRef = useMemoFirebase(() => {
    if (!firestore || !user?.companyId) return null;
    return doc(firestore, 'companies', user.companyId, 'laundryConfig', 'global');
  }, [firestore, user?.companyId]);

  const companyRef = useMemoFirebase(() => {
    if (!firestore || !user?.companyId) return null;
    return doc(firestore, 'companies', user.companyId);
  }, [firestore, user?.companyId]);

  const purchasesQuery = useMemoFirebase(() => {
    if (!firestore || !user?.companyId) return null;
    return collection(firestore, 'companies', user.companyId, 'purchases');
  }, [firestore, user?.companyId]);

  const { data: students } = useCollection<LaundryStudent>(studentsQuery);
  const { data: transactions } = useCollection<SaleTransaction>(transactionsQuery);
  const { data: inventoryItems } = useCollection<LaundryInventory>(inventoryQuery);
  const { data: schedules } = useCollection<LaundrySchedule>(scheduleQuery);
  const { data: globalConfig } = useDoc<any>(globalConfigRef);
  const { data: companyDoc } = useDoc<Company>(companyRef);
  const { data: purchases } = useCollection<CapitalPurchase>(purchasesQuery);

  const currencySymbol = companyDoc?.currencySymbol || '$';

  const activePurchases = useMemo(() => {
    if (!purchases) return [];
    if (!companyDoc?.capitalStartDate || !companyDoc?.capitalEndDate) return purchases;
    const start = new Date(companyDoc.capitalStartDate);
    const end = new Date(companyDoc.capitalEndDate);
    end.setHours(23, 59, 59, 999);
    return purchases.filter(p => {
      const pDate = new Date(p.timestamp);
      return pDate >= start && pDate <= end;
    });
  }, [purchases, companyDoc]);

  const totalSpent = activePurchases.reduce((acc, p) => acc + p.amount, 0);
  const totalCapacity = (companyDoc?.capitalLimit || 0) + (companyDoc?.injectedCapital || 0);
  const remainingBudget = Math.max(0, totalCapacity - totalSpent);

  const isBudgetActive = useMemo(() => {
    if (!companyDoc?.capitalEndDate) return false;
    const now = new Date();
    const end = new Date(companyDoc.capitalEndDate);
    end.setHours(23, 59, 59, 999);
    return now < end;
  }, [companyDoc]);

  const canProcure = isBudgetActive && remainingBudget > 0;

  const benchmarkSubscription = globalConfig?.fixedSubscription || 0;
  const soapMlPerWash = globalConfig?.soapMlPerWash || 50;
  const payableServiceRate = globalConfig?.payableServiceRate || 0;
  const payableSoapMlPerWash = globalConfig?.payableSoapMlPerWash || 50;

  const levelQuotas = useMemo(() => {
    const counts: Record<number, number> = {};
    LEVELS.forEach(lv => counts[lv] = 0);
    schedules?.forEach(s => { if (counts[s.level] !== undefined) counts[s.level]++; });
    return counts;
  }, [schedules]);

  const studentSoap = inventoryItems?.find(i => i.category === 'student');
  const payableSoap = inventoryItems?.find(i => i.category === 'payable');

  useEffect(() => {
    const item = refillCategory === 'student' ? studentSoap : payableSoap;
    if (item) {
      setRefillVolPerBottle(item.lastBottleVolume?.toString() || '');
      setRefillCostPerBottle(item.lastBottleCost?.toString() || '');
    }
  }, [refillCategory, !!studentSoap, !!payableSoap]);

  useEffect(() => {
    if (globalConfig?.payableServiceRate) setPayableAmount(globalConfig.payableServiceRate.toString());
  }, [globalConfig]);

  const getWashRateForLevel = (level: number) => {
    const quota = levelQuotas[level] || 0;
    return quota === 0 ? 0 : benchmarkSubscription / quota;
  };

  const isLevelAllowedToday = (level: number) => {
    if (!todayDate) return false;
    return schedules?.some(s => s.date === todayDate && s.level === level);
  };

  const foundTopUpStudent = useMemo(() => students?.find(s => s.matrixNumber === topUpMatrix), [students, topUpMatrix]);

  const handleRegisterStudent = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!firestore || !user?.companyId || !selectedLevel || !selectedClass) return;
    setIsProcessing(true);
    const formData = new FormData(e.currentTarget);
    const studentId = editingStudent?.id || crypto.randomUUID();
    const student: LaundryStudent = {
      id: studentId,
      companyId: user.companyId,
      name: formData.get('name') as string,
      matrixNumber: formData.get('matrix') as string,
      balance: editingStudent ? (editingStudent.balance ?? 0) : 0, 
      totalSpent: editingStudent ? (editingStudent.totalSpent ?? 0) : 0,
      initialAmount: benchmarkSubscription || 0,
      level: Number(selectedLevel),
      class: selectedClass,
    };
    setDoc(doc(firestore, 'companies', user.companyId, 'laundryStudents', studentId), student)
      .then(() => { toast({ title: editingStudent ? "Profile Updated" : "Student Enrolled" }); setEditingStudent(null); setSelectedLevel(''); setSelectedClass(''); })
      .finally(() => setIsProcessing(false));
  };

  const handleDeleteStudent = (studentId: string) => {
    if (!firestore || !user?.companyId || !confirm("Delete this subscriber?")) return;
    deleteDocumentNonBlocking(doc(firestore, 'companies', user.companyId, 'laundryStudents', studentId));
    toast({ title: "Subscriber Removed" });
  };

  const handleRefillInventory = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!firestore || !user?.companyId) return;
    const units = Number(refillBottles) || 0;
    const cost = units * Number(refillCostPerBottle);
    if (units > 0 && cost > remainingBudget) { toast({ title: "Insufficient Budget", variant: "destructive" }); return; }
    setIsProcessing(true);
    const vol = units * Number(refillVolPerBottle);
    const id = `${refillCategory}_soap`;
    const invRef = doc(firestore, 'companies', user.companyId, 'laundryInventory', id);
    const existing = inventoryItems?.find(i => i.id === id);
    if (!existing) setDoc(invRef, { id, category: refillCategory, soapStockMl: vol, soapCostPerLitre: units > 0 ? (cost / (vol / 1000)) : 0, lastBottleCost: Number(refillCostPerBottle), lastBottleVolume: Number(refillVolPerBottle) });
    else updateDoc(invRef, { lastBottleCost: Number(refillCostPerBottle), lastBottleVolume: Number(refillVolPerBottle), ...(units > 0 ? { soapStockMl: increment(vol), soapCostPerLitre: (( (existing.soapStockMl/1000)*existing.soapCostPerLitre ) + cost) / ((existing.soapStockMl+vol)/1000) } : {}) });
    if (units > 0) addDoc(collection(firestore, 'companies', user.companyId, 'purchases'), { id: crypto.randomUUID(), amount: cost, description: `${refillCategory.toUpperCase()} Soap Refill`, timestamp: new Date().toISOString() });
    toast({ title: units > 0 ? "Inventory Replenished" : "Info Updated" });
    setRefillBottles('0');
    setIsProcessing(false);
  };

  const handleChargeLaundry = () => {
    if (!selectedStudent || !firestore || !user?.companyId || !studentSoap) return;
    const washRate = getWashRateForLevel(selectedStudent.level);
    if (!isLevelAllowedToday(selectedStudent.level) || studentSoap.soapStockMl < soapMlPerWash || ((selectedStudent.balance ?? 0) - (selectedStudent.totalSpent ?? 0)) < washRate) { toast({ title: "Authorized Check Failed", variant: "destructive" }); return; }
    setIsProcessing(true);
    const soapCost = (soapMlPerWash / 1000) * (studentSoap.soapCostPerLitre || 0);
    const transData: SaleTransaction = { id: crypto.randomUUID(), companyId: user.companyId, module: 'laundry', totalAmount: washRate, profit: washRate - soapCost, totalCost: soapCost, timestamp: new Date().toISOString(), customerName: selectedStudent.name, status: 'completed', items: [{ name: `Service Wash (Lv${selectedStudent.level})`, price: washRate, quantity: 1 }] };
    updateDoc(doc(firestore, 'companies', user.companyId, 'laundryStudents', selectedStudent.id), { totalSpent: increment(washRate) });
    updateDoc(doc(firestore, 'companies', user.companyId, 'laundryInventory', 'student_soap'), { soapStockMl: increment(-soapMlPerWash) });
    addDoc(collection(firestore, 'companies', user.companyId, 'transactions'), transData);
    toast({ title: "Wash Fulfilled" });
    setSelectedStudent(null);
    setMatrixSearch('');
    setIsProcessing(false);
  };

  const handlePayableWash = () => {
    if (!payableName || !payableAmount || !firestore || !user?.companyId || !payableSoap) return;
    const amount = Number(payableAmount);
    const mlRequired = globalConfig?.payableSoapMlPerWash || 50;
    if (payableSoap.soapStockMl < mlRequired) { toast({ title: "Insufficient Soap Stock", variant: "destructive" }); return; }
    setIsProcessing(true);
    const soapCost = (mlRequired / 1000) * (payableSoap.soapCostPerLitre || 0);
    const transId = crypto.randomUUID();
    const transData: SaleTransaction = { id: transId, companyId: user.companyId, module: 'laundry', totalAmount: amount, profit: amount - soapCost, totalCost: soapCost, timestamp: new Date().toISOString(), customerName: payableName, paymentMethod: payablePaymentMethod, referenceNumber: payableRef || null, status: 'completed', items: [{ name: 'Payable Service Wash', price: amount, quantity: 1 }] };
    setDoc(doc(firestore, 'companies', user.companyId, 'transactions', transId), transData).then(() => {
      updateDoc(doc(firestore, 'companies', user.companyId!, 'laundryInventory', 'payable_soap'), { soapStockMl: increment(-mlRequired) });
      toast({ title: "Payable Wash Fulfilled" });
      setPayableName('');
      setPayableRef('');
      setPayableCashReceived('');
    }).finally(() => setIsProcessing(false));
  };

  const handleConfirmTopUp = () => {
    if (!foundTopUpStudent || !firestore || !user?.companyId || !topUpAmount) return;
    setIsProcessing(true);
    const amount = Number(topUpAmount);
    const transData: SaleTransaction = { id: crypto.randomUUID(), companyId: user.companyId, module: 'laundry', totalAmount: amount, profit: 0, totalCost: 0, timestamp: new Date().toISOString(), customerName: foundTopUpStudent.name, paymentMethod: topUpPaymentMethod, referenceNumber: transactionNo || null, status: 'completed', items: [{ name: 'Account Deposit', price: amount, quantity: 1 }] };
    updateDoc(doc(firestore, 'companies', user.companyId, 'laundryStudents', foundTopUpStudent.id), { balance: increment(amount) });
    addDoc(collection(firestore, 'companies', user.companyId, 'transactions'), transData);
    toast({ title: "Deposit Successful" });
    setIsTopUpOpen(false);
    setTopUpAmount('');
    setTopUpMatrix('');
    setIsProcessing(false);
  };

  const laundryTransactions = transactions?.filter(t => t.module === 'laundry') || [];
  
  return (
    <div className="flex h-screen bg-background font-body">
      <Sidebar />
      <main className="flex-1 overflow-auto p-8">
        <div className="mb-8 flex justify-between items-end">
          <div><h1 className="text-3xl font-black font-headline tracking-tight text-foreground">Laundry Hub</h1><p className="text-muted-foreground font-medium">Smart Scheduling & Quota Billing</p></div>
          <div className="flex gap-4">
            <Card className="p-3 border-none shadow-sm bg-white/50 flex items-center gap-3 rounded-2xl mr-4">
              <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center", remainingBudget > 0 ? "bg-primary/20 text-primary" : "bg-destructive/20 text-destructive")}><Wallet className="w-5 h-5" /></div>
              <div><p className="text-[10px] font-black uppercase text-muted-foreground leading-tight">Cycle Budget</p><p className={cn("text-lg font-black", remainingBudget <= 0 && "text-destructive")}>{currencySymbol}{remainingBudget.toFixed(2)}</p></div>
            </Card>
            <Dialog open={isTopUpOpen} onOpenChange={setIsTopUpOpen}>
              <DialogTrigger asChild><Button className="rounded-2xl h-14 px-8 font-black text-lg shadow-xl gap-2"><Wallet className="w-5 h-5" /> Account Deposit</Button></DialogTrigger>
              <DialogContent className="rounded-[40px] max-w-xl p-0 overflow-hidden bg-white border-none shadow-2xl">
                <div className="bg-primary p-12 text-primary-foreground text-center"><p className="text-xs font-black uppercase tracking-widest opacity-80 mb-2">Student Settlement</p><DialogTitle className="text-4xl font-black tracking-tighter">Deposit Registry</DialogTitle></div>
                <div className="p-10 space-y-8">
                  <div className="space-y-2"><Label className="text-[10px] font-black uppercase text-muted-foreground px-1">Subscriber Matrix No</Label><Input placeholder="SCAN OR TYPE MATRIX..." className="h-14 rounded-2xl font-black text-xl bg-secondary/10 border-none px-6" value={topUpMatrix} onChange={(e) => setTopUpMatrix(e.target.value)}/></div>
                  {foundTopUpStudent && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-top-2">
                      <div className="p-6 bg-primary/5 rounded-[32px] border-2 border-primary/10 flex justify-between items-center">
                        <div><p className="text-[10px] font-black text-primary uppercase">Active Subscriber</p><h4 className="text-2xl font-black">{foundTopUpStudent.name}</h4><p className="text-xs font-bold text-muted-foreground">Lv {foundTopUpStudent.level} • {foundTopUpStudent.class}</p></div>
                        <div className="text-right"><p className="text-[10px] font-black text-muted-foreground uppercase">Need to Pay</p><p className="text-3xl font-black text-destructive">{currencySymbol}{Math.max(0, (foundTopUpStudent.initialAmount ?? 0) - (foundTopUpStudent.balance ?? 0)).toFixed(2)}</p></div>
                      </div>
                      <div className="space-y-4"><Label className="text-[10px] font-black uppercase text-muted-foreground px-1">Deposit Amount ({currencySymbol})</Label><Input type="number" placeholder="0.00" className="h-16 rounded-2xl font-black text-3xl bg-secondary/10 border-none px-6" value={topUpAmount} onChange={(e) => setTopUpAmount(e.target.value)}/></div>
                      <div className="space-y-4"><Label className="text-[10px] font-black uppercase tracking-widest">Settlement Method</Label><RadioGroup value={topUpPaymentMethod} onValueChange={(v) => setTopUpPaymentMethod(v as PaymentMethod)} className="grid grid-cols-3 gap-3"><PaymentOption value="cash" label="Cash" icon={Banknote} id="topup_cash" /><PaymentOption value="card" label="Card" icon={CreditCard} id="topup_card" /><PaymentOption value="duitnow" label="DuitNow" icon={QrCode} id="duitnow_final" /></RadioGroup></div>
                      {topUpPaymentMethod === 'cash' ? (
                        <div className="space-y-4 p-6 bg-secondary/10 rounded-3xl border-2 border-dashed border-primary/20">
                          <div className="space-y-2"><Label className="text-[10px] font-black uppercase text-primary px-1">Cash Received ({currencySymbol})</Label><Input type="number" placeholder="0.00" className="h-14 rounded-2xl font-black text-2xl bg-white border-none text-center" value={amountReceived} onChange={(e) => setAmountReceived(e.target.value)}/></div>
                          {Number(amountReceived) >= Number(topUpAmount) && Number(topUpAmount) > 0 && (
                            <div className="flex justify-between items-center px-2 py-2 border-t border-primary/10"><span className="text-xs font-black uppercase text-muted-foreground">Change Due:</span><span className="text-3xl font-black text-foreground">{currencySymbol}{(Number(amountReceived) - Number(topUpAmount)).toFixed(2)}</span></div>
                          )}
                        </div>
                      ) : (
                        <div className="space-y-2 p-6 bg-secondary/10 rounded-3xl border-2 border-dashed border-primary/20"><Label className="text-[10px] font-black uppercase px-1">Transaction Ref / Trace ID</Label><Input placeholder="ENTER REFERENCE NO..." className="h-14 rounded-2xl font-black text-lg bg-white border-none px-6" value={transactionNo} onChange={(e) => setTransactionNo(e.target.value)}/></div>
                      )}
                      <Button className="w-full h-18 rounded-[28px] font-black text-xl shadow-2xl" onClick={handleConfirmTopUp} disabled={isProcessing || !topUpAmount}>Confirm & Record Deposit</Button>
                    </div>
                  )}
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {!isBudgetActive && <Alert variant="destructive" className="mb-6 rounded-2xl bg-destructive/10 border-destructive/20"><AlertTriangle className="h-4 w-4" /><AlertTitle className="font-black uppercase text-xs tracking-widest">Financial Guardrail Alert</AlertTitle><AlertDescription className="text-sm font-medium">Note: Your <strong>Capital Base Limit</strong> is not set. <Link href="/company/capital" className="underline font-black ml-1">Configure budget</Link></AlertDescription></Alert>}

        <Tabs defaultValue="pos" className="space-y-6">
          <TabsList className="bg-white/50 border p-1 rounded-xl shadow-sm"><TabsTrigger value="pos" className="rounded-lg">POS Terminal</TabsTrigger><TabsTrigger value="payable" className="rounded-lg">Payable Laundry</TabsTrigger><TabsTrigger value="students" className="rounded-lg">Subscribers</TabsTrigger><TabsTrigger value="schedule" className="rounded-lg">Schedule</TabsTrigger><TabsTrigger value="config" className="rounded-lg">Pricing Config</TabsTrigger><TabsTrigger value="consumables" className="rounded-lg">Inventory</TabsTrigger><TabsTrigger value="profits" className="rounded-lg">Analytics</TabsTrigger><TabsTrigger value="billing" className="rounded-lg">Gateway</TabsTrigger></TabsList>

          <TabsContent value="pos" className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-6">
              <Card className="border-none shadow-sm bg-white rounded-3xl overflow-hidden">
                <CardHeader className="bg-secondary/10 p-8"><div className="flex justify-between items-center"><div><CardTitle className="text-xl font-black">Washing Terminal</CardTitle><CardDescription className="font-bold">Subscriber usage verification</CardDescription></div><p className="font-black text-primary">{todayDate ? new Date(todayDate).toLocaleDateString([], { dateStyle: 'long' }) : "---"}</p></div></CardHeader>
                <CardContent className="p-8 space-y-6">
                  <div className="flex gap-2"><div className="relative flex-1"><Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground w-6 h-6" /><Input placeholder="SCAN STUDENT MATRIX..." className="h-16 rounded-2xl text-2xl font-black border-2 border-primary/20 bg-secondary/5 pl-14" value={matrixSearch} onChange={(e) => setMatrixSearch(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { const found = students?.find(s => s.matrixNumber === matrixSearch); if (found) setSelectedStudent(found); else toast({ title: "Not Found", variant: "destructive" }); } }}/></div><Button onClick={() => { const found = students?.find(s => s.matrixNumber === matrixSearch); if (found) setSelectedStudent(found); else toast({ title: "Not Found", variant: "destructive" }); }} size="lg" className="rounded-2xl px-10 h-16 font-black text-lg">Verify</Button></div>
                  {selectedStudent ? (
                    <div className="p-10 bg-primary/5 rounded-[32px] border-4 border-primary/10 space-y-8 animate-in zoom-in-95">
                      <div className="flex justify-between items-start">
                        <div><p className="text-[10px] font-black text-primary uppercase mb-1">Subscriber Identity</p><h4 className="text-4xl font-black text-foreground tracking-tighter">{selectedStudent.name}</h4><div className="flex items-center gap-2 mt-2"><Badge variant="outline" className="font-bold">Level {selectedStudent.level}</Badge><Badge variant="outline" className="font-bold">{selectedStudent.class}</Badge></div></div>
                        <div className="text-right"><p className="text-[10px] font-black text-muted-foreground uppercase">Wash Bank Balance</p><p className={cn("text-5xl font-black tracking-tighter", ((selectedStudent.balance ?? 0) - (selectedStudent.totalSpent ?? 0)) <= 0 ? "text-destructive" : "text-primary")}>{currencySymbol}{((selectedStudent.balance ?? 0) - (selectedStudent.totalSpent ?? 0)).toFixed(2)}</p><p className="text-[10px] font-black text-muted-foreground uppercase mt-2">Rate: {currencySymbol}{getWashRateForLevel(selectedStudent.level).toFixed(2)}</p></div>
                      </div>
                      <Button className="w-full h-16 rounded-2xl text-xl font-black shadow-xl group" onClick={handleChargeLaundry} disabled={isProcessing || !isBudgetActive || !isLevelAllowedToday(selectedStudent.level) || ((selectedStudent.balance ?? 0) - (selectedStudent.totalSpent ?? 0)) < getWashRateForLevel(selectedStudent.level)}>Confirm Wash & Debit Account <ArrowRight className="ml-3 w-6 h-6" /></Button>
                    </div>
                  ) : <div className="py-24 text-center bg-secondary/10 rounded-[32px] border-4 border-dashed border-secondary/30"><Search className="w-16 h-16 mx-auto mb-4 opacity-10" /><p className="font-black text-muted-foreground uppercase">Scanner Ready</p></div>}
                </CardContent>
              </Card>
            </div>
            <div className="lg:col-span-1"><Card className="bg-primary border-none shadow-2xl text-primary-foreground rounded-[32px] p-8 overflow-hidden relative"><div className="absolute top-0 right-0 p-8 opacity-10"><Clock className="w-32 h-32" /></div><CardTitle className="flex items-center gap-3 text-xl font-black mb-6 relative z-10"><CalendarDays className="w-6 h-6" /> Turn Schedule</CardTitle><div className="space-y-4 relative z-10">{LEVELS.map(lv => { const isAllowed = isLevelAllowedToday(lv); return (<div key={lv} className={cn("p-4 rounded-2xl flex justify-between items-center", isAllowed ? "bg-white/20 border-2 border-white/20" : "bg-black/10 opacity-50")}><p className="font-black text-lg">Level {lv}</p>{isAllowed ? <Badge className="bg-white text-primary font-black">Authorized</Badge> : <Badge variant="outline" className="text-white/40 font-bold">Closed</Badge>}</div>); })}</div></Card></div>
          </TabsContent>

          <TabsContent value="payable">
             <Card className="border-none shadow-sm bg-white rounded-3xl p-8 max-w-2xl mx-auto">
                <CardHeader className="px-0 pt-0 mb-8"><CardTitle className="text-2xl font-black">Payable Service Entry</CardTitle></CardHeader>
                <div className="space-y-8">
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2"><Label className="text-[10px] font-black uppercase text-muted-foreground px-1">Customer Name</Label><Input placeholder="Full Name" value={payableName} onChange={(e) => setPayableName(e.target.value)} className="h-12 rounded-xl font-bold bg-secondary/10 border-none" /></div>
                      <div className="space-y-2"><Label className="text-[10px] font-black uppercase text-muted-foreground px-1">Service Amount ({currencySymbol})</Label><Input type="number" placeholder="5.00" value={payableAmount} onChange={(e) => setPayableAmount(e.target.value)} className="h-12 rounded-xl font-bold bg-secondary/10 border-none text-primary" /></div>
                   </div>
                   <div className="space-y-4"><Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground px-1">Settlement Gateway</Label><RadioGroup value={payablePaymentMethod} onValueChange={(v) => setPayablePaymentMethod(v as PaymentMethod)} className="grid grid-cols-3 gap-3"><PaymentOption value="cash" label="Cash" icon={Banknote} id="pay_wash_cash" /><PaymentOption value="card" label="Card" icon={CreditCard} id="pay_wash_card" /><PaymentOption value="duitnow" label="DuitNow" icon={QrCode} id="pay_wash_qr" /></RadioGroup></div>
                   {payablePaymentMethod === 'cash' ? (
                     <div className="p-6 bg-primary/5 rounded-[32px] border-2 border-primary/10 space-y-6">
                        <div className="space-y-2"><Label className="text-[10px] font-black uppercase text-primary">Cash Received ({currencySymbol})</Label><Input type="number" value={payableCashReceived} onChange={(e) => setPayableCashReceived(e.target.value)} className="h-16 rounded-2xl font-black text-3xl text-center bg-white border-none" /></div>
                        {Number(payableCashReceived) >= Number(payableAmount) && Number(payableAmount) > 0 && (<div className="flex justify-between items-center px-2"><span className="text-xs font-black uppercase text-muted-foreground">Change Due:</span><span className="text-3xl font-black text-foreground">{currencySymbol}{Math.max(0, (Number(payableCashReceived) || 0) - (Number(payableAmount) || 0)).toFixed(2)}</span></div>)}
                     </div>
                   ) : <div className="space-y-2"><Label className="text-[10px] font-black uppercase text-muted-foreground px-1">Trace ID / Reference</Label><Input placeholder="Enter Trace No..." value={payableRef} onChange={(e) => setPayableRef(e.target.value)} className="h-12 rounded-xl font-bold bg-secondary/10 border-none" /></div>}
                   <Button onClick={handlePayableWash} className="w-full h-16 rounded-[24px] font-black text-xl shadow-xl" disabled={isProcessing || !payableAmount}>Complete & Confirm Wash</Button>
                </div>
             </Card>
          </TabsContent>

          <TabsContent value="students" className="space-y-8">
             <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                <div className="lg:col-span-1"><Card className="border-none shadow-sm rounded-3xl bg-white p-8 sticky top-8"><h3 className="text-xl font-black mb-6">{editingStudent ? 'Update Account' : 'New Enrollment'}</h3><form onSubmit={handleRegisterStudent} className="space-y-5"><div className="space-y-1.5"><Label className="text-[10px] font-black uppercase">Full Name</Label><Input name="name" defaultValue={editingStudent?.name} required className="h-11 rounded-xl bg-secondary/10 border-none font-bold" /></div><div className="space-y-1.5"><Label className="text-[10px] font-black uppercase">Matrix Number</Label><Input name="matrix" defaultValue={editingStudent?.matrixNumber} required className="h-11 rounded-xl bg-secondary/10 border-none font-bold" /></div><div className="grid grid-cols-2 gap-3"><div className="space-y-1.5"><Label className="text-[10px] font-black uppercase">Level</Label><Select value={selectedLevel} onValueChange={setSelectedLevel}><SelectTrigger className="h-11 rounded-xl bg-secondary/10 border-none font-bold"><SelectValue /></SelectTrigger><SelectContent className="rounded-xl font-bold">{LEVELS.map(l => <SelectItem key={l} value={l.toString()}>Level {l}</SelectItem>)}</SelectContent></Select></div><div className="space-y-1.5"><Label className="text-[10px] font-black uppercase">Class</Label><Select value={selectedClass} onValueChange={setSelectedClass}><SelectTrigger className="h-11 rounded-xl bg-secondary/10 border-none font-bold"><SelectValue /></SelectTrigger><SelectContent className="rounded-xl font-bold">{CLASSES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select></div></div><div className="space-y-1.5"><Label className="text-[10px] font-black uppercase">Initial Subscription ({currencySymbol})</Label><div className="h-11 rounded-xl bg-secondary/10 border-none font-black flex items-center px-4 text-primary">{currencySymbol}{(benchmarkSubscription || 0).toFixed(2)}</div></div><div className="flex gap-2">{editingStudent && <Button type="button" variant="outline" onClick={() => { setEditingStudent(null); setSelectedLevel(''); setSelectedClass(''); }} className="flex-1 rounded-xl font-bold">Cancel</Button>}<Button type="submit" className="flex-1 h-12 rounded-xl font-black shadow-lg" disabled={isProcessing}>{editingStudent ? "Update" : "Save"}</Button></div></form></Card></div>
                <div className="lg:col-span-3"><div className="bg-white rounded-[32px] border shadow-sm overflow-hidden"><table className="w-full text-sm text-left"><thead className="bg-secondary/20"><tr><th className="p-6 font-black uppercase text-[10px]">Subscriber / Matrix</th><th className="p-6 font-black uppercase text-[10px]">Initial Sub</th><th className="p-6 font-black uppercase text-[10px]">Deposits</th><th className="p-6 font-black uppercase text-[10px]">Net Balance</th><th className="p-6 font-black uppercase text-[10px]">Action</th></tr></thead><tbody className="divide-y">{students?.map(s => { const deposits = s.balance ?? 0; const spent = s.totalSpent ?? 0; const washBalance = deposits - spent; return (<tr key={s.id} className="hover:bg-secondary/5 group"><td className="p-6"><p className="font-black text-lg">{s.name}</p><p className="text-[10px] font-bold text-muted-foreground uppercase">{s.matrixNumber} • {s.class}</p></td><td className="p-6 font-bold">{currencySymbol}{(s.initialAmount ?? 0).toFixed(2)}</td><td className="p-6 font-black">{currencySymbol}{deposits.toFixed(2)}</td><td className="p-6"><p className={cn("font-black text-lg", washBalance <= 0 ? "text-destructive" : "text-primary")}>{currencySymbol}{washBalance.toFixed(2)}</p></td><td className="p-6 text-center"><div className="flex items-center justify-center gap-2"><Button variant="ghost" size="icon" onClick={() => { setEditingStudent(s); setSelectedLevel(s.level.toString()); setSelectedClass(s.class); }} className="text-primary hover:bg-primary/10"><Edit2 className="w-4 h-4" /></Button><Button variant="ghost" size="icon" onClick={() => handleDeleteStudent(s.id)} className="text-destructive hover:bg-destructive/10"><Trash2 className="w-4 h-4" /></Button></div></td></tr>); })}</tbody></table></div></div>
             </div>
          </TabsContent>

          <TabsContent value="schedule"><LaundryScheduler companyId={user?.companyId} schedules={schedules} levelQuotas={levelQuotas} /></TabsContent>

          <TabsContent value="config" className="space-y-8"><GlobalPolicyConfig companyId={user?.companyId} initialConfig={globalConfig} currencySymbol={currencySymbol} /><LaundryConfigurator levelQuotas={levelQuotas} benchmarkSubscription={benchmarkSubscription} studentSoap={studentSoap} soapMlPerWash={soapMlPerWash} payableSoap={payableSoap} payableServiceRate={payableServiceRate} payableSoapMlPerWash={payableSoapMlPerWash} currencySymbol={currencySymbol}/></TabsContent>

          <TabsContent value="consumables">
             <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                <div className="lg:col-span-1"><Card className={cn("border-none shadow-sm rounded-3xl bg-white p-8 sticky top-8", !canProcure && "grayscale opacity-80")}><div className="flex items-center gap-2 mb-6"><div className={cn("w-10 h-10 rounded-xl flex items-center justify-center", canProcure ? "bg-primary/10 text-primary" : "bg-destructive/10 text-destructive")}>{canProcure ? <RefreshCw className="w-5 h-5" /> : <Lock className="w-5 h-5" />}</div><h3 className="text-xl font-black">{canProcure ? 'Stock Replenish' : 'Locked'}</h3></div><form onSubmit={handleRefillInventory} className="space-y-5"><div className="space-y-1.5"><Label className="text-[10px] font-black uppercase">Pool</Label><Select value={refillCategory} onValueChange={(v: any) => setRefillCategory(v)} disabled={!canProcure}><SelectTrigger className="h-11 rounded-xl bg-secondary/10 border-none font-bold"><SelectValue /></SelectTrigger><SelectContent className="rounded-xl font-bold"><SelectItem value="student">Student Pool</SelectItem><SelectItem value="payable">Payable Pool</SelectItem></SelectContent></Select></div><div className="grid grid-cols-2 gap-3"><div className="space-y-1.5"><Label className="text-[10px] font-black uppercase">Bottles</Label><Input value={refillBottles} onChange={(e) => setRefillBottles(e.target.value)} type="number" disabled={!canProcure} className="h-11 rounded-xl bg-secondary/10 border-none font-bold" /></div><div className="space-y-1.5"><Label className="text-[10px] font-black uppercase">ml/Bottle</Label><Input value={refillVolPerBottle} onChange={(e) => setRefillVolPerBottle(e.target.value)} type="number" disabled={!canProcure} className="h-11 rounded-xl bg-secondary/10 border-none font-bold" /></div></div><div className="space-y-1.5"><Label className="text-[10px] font-black uppercase">Price/Bottle ({currencySymbol})</Label><Input value={refillCostPerBottle} onChange={(e) => setRefillCostPerBottle(e.target.value)} type="number" step="0.01" disabled={!canProcure} className="h-11 rounded-xl bg-secondary/10 border-none font-bold" /></div><Button type="submit" className="w-full h-12 rounded-xl font-black shadow-lg" disabled={isProcessing || !canProcure}>Confirm Stock Refill</Button></form></Card></div>
                <div className="lg:col-span-3 grid grid-cols-1 md:grid-cols-2 gap-8"><InventoryGauge label="Student Consumables" item={studentSoap} currencySymbol={currencySymbol}/><InventoryGauge label="Payable Consumables" item={payableSoap} currencySymbol={currencySymbol}/></div>
             </div>
          </TabsContent>

          <TabsContent value="profits"><LaundryAnalytics transactions={laundryTransactions} currencySymbol={currencySymbol} /></TabsContent>

          <TabsContent value="billing">
             <div className="max-w-xl auto py-12 text-center space-y-8"><Card className="border-none shadow-sm rounded-[40px] bg-white p-12 space-y-8"><div className="w-20 h-20 bg-primary/10 rounded-3xl flex items-center justify-center text-primary mx-auto"><QrCode className="w-10 h-10" /></div><h2 className="text-3xl font-black">Laundry Gateway</h2>{companyDoc?.duitNowQr ? (<div className="relative group w-fit mx-auto"><Image src={companyDoc.duitNowQr} alt="QR" width={200} height={200} className="rounded-3xl border-4" /><label className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center rounded-3xl cursor-pointer transition-opacity"><Upload className="text-white w-8 h-8" /><input type="file" className="hidden" accept="image/*" onChange={async (e) => { const file = e.target.files?.[0]; if(!file || !firestore || !user?.companyId) return; const reader = new FileReader(); reader.onloadend = () => updateDoc(doc(firestore, 'companies', user.companyId!), { duitNowQr: reader.result as string }); reader.readAsDataURL(file); }} /></label></div>) : <label className="py-20 border-4 border-dashed rounded-[40px] opacity-30 cursor-pointer flex flex-col items-center justify-center gap-4"><Plus className="w-12 h-12" /><input type="file" className="hidden" accept="image/*" /></label>}</Card></div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

function GlobalPolicyConfig({ companyId, initialConfig, currencySymbol }: { companyId?: string, initialConfig: any, currencySymbol: string }) {
  const firestore = useFirestore();
  const { toast } = useToast();
  const [subVal, setSubVal] = useState('');
  const [soapVal, setSoapVal] = useState('');
  const [payableRateVal, setPayableRateVal] = useState('');
  const [payableSoapVal, setPayableSoapVal] = useState('');
  useEffect(() => {
    if (initialConfig?.fixedSubscription) setSubVal(initialConfig.fixedSubscription.toString());
    if (initialConfig?.soapMlPerWash) setSoapVal(initialConfig.soapMlPerWash.toString());
    if (initialConfig?.payableServiceRate) setPayableRateVal(initialConfig.payableServiceRate.toString());
    if (initialConfig?.payableSoapMlPerWash) setPayableSoapVal(initialConfig.payableSoapMlPerWash.toString());
  }, [initialConfig]);
  const handleSave = () => {
    if (!firestore || !companyId) return;
    const docRef = doc(firestore, 'companies', companyId, 'laundryConfig', 'global');
    setDoc(docRef, { fixedSubscription: Number(subVal), soapMlPerWash: Number(soapVal) || 50, payableServiceRate: Number(payableRateVal), payableSoapMlPerWash: Number(payableSoapVal) || 50 }, { merge: true }).then(() => toast({ title: "Updated" }));
  };
  return (<Card className="border-none shadow-sm rounded-[32px] bg-white p-8 max-w-5xl mx-auto"><div className="grid grid-cols-1 md:grid-cols-4 gap-6 items-end"><div className="space-y-1.5"><Label className="text-[10px] font-black uppercase">Fee ({currencySymbol})</Label><Input type="number" step="0.01" value={subVal} onChange={(e) => setSubVal(e.target.value)} className="h-12 rounded-xl bg-secondary/10 border-none font-black text-lg" /></div><div className="space-y-1.5"><Label className="text-[10px] font-black uppercase">Soap/Wash (ml)</Label><Input type="number" value={soapVal} onChange={(e) => setSoapVal(e.target.value)} className="h-12 rounded-xl bg-secondary/10 border-none font-black text-lg" /></div><div className="space-y-1.5"><Label className="text-[10px] font-black uppercase">Payable Rate ({currencySymbol})</Label><Input type="number" step="0.01" value={payableRateVal} onChange={(e) => setPayableRateVal(e.target.value)} className="h-12 rounded-xl bg-secondary/10 border-none font-black text-lg" /></div><div className="space-y-1.5"><Label className="text-[10px] font-black uppercase">Payable Soap (ml)</Label><Input type="number" value={payableSoapVal} onChange={(e) => setPayableSoapVal(e.target.value)} className="h-12 rounded-xl bg-secondary/10 border-none font-black text-lg" /></div><Button onClick={handleSave} className="h-12 rounded-xl px-8 font-black shadow-lg md:col-span-4">Set Strategic Policy</Button></div></Card>);
}

function LaundryConfigurator({ levelQuotas, benchmarkSubscription, studentSoap, soapMlPerWash, payableSoap, payableServiceRate, payableSoapMlPerWash, currencySymbol }: any) {
  const soapCostPerMl = (studentSoap?.soapCostPerLitre || 0) / 1000;
  const subscriberCostPrice = soapCostPerMl * soapMlPerWash;
  const payableSoapCostPerMl = (payableSoap?.soapCostPerLitre || 0) / 1000;
  const payableCostPrice = payableSoapCostPerMl * payableSoapMlPerWash;
  return (<Card className="border-none shadow-sm bg-white rounded-3xl p-10 max-w-5xl mx-auto"><div className="grid grid-cols-1 md:grid-cols-2 gap-8">{LEVELS.map(lv => { const quota = levelQuotas[lv] || 0; const serviceRate = quota > 0 ? (benchmarkSubscription / quota) : 0; return (<div key={lv} className="bg-secondary/10 p-6 rounded-3xl space-y-6"><Badge className="h-8 px-4">Level {lv}</Badge><div className="grid grid-cols-2 gap-4"><div className="p-4 bg-white rounded-2xl border"><p className="text-[9px] font-black text-primary uppercase">Service Rate</p><p className="text-xl font-black">{currencySymbol}{serviceRate.toFixed(2)}</p></div><div className="p-4 bg-white rounded-2xl border"><p className="text-[9px] font-black text-destructive uppercase">Cost Price</p><p className="text-xl font-black">{currencySymbol}{subscriberCostPrice.toFixed(2)}</p></div></div></div>); })}<div className="bg-primary/10 p-6 rounded-3xl space-y-6 col-span-1 md:col-span-2"><Badge className="h-8 px-4 bg-primary">Walk-in (Payable)</Badge><div className="grid grid-cols-2 gap-4"><div className="p-4 bg-white rounded-2xl border"><p className="text-[9px] font-black text-primary uppercase">Payable Rate</p><p className="text-xl font-black">{currencySymbol}{payableServiceRate.toFixed(2)}</p></div><div className="p-4 bg-white rounded-2xl border"><p className="text-[9px] font-black text-destructive uppercase">Cost Price</p><p className="text-xl font-black">{currencySymbol}{payableCostPrice.toFixed(2)}</p></div></div></div></div></Card>);
}

function LaundryScheduler({ companyId, schedules, levelQuotas }: { companyId?: string, schedules: LaundrySchedule[] | null, levelQuotas: Record<number, number> }) {
  const firestore = useFirestore();
  const { toast } = useToast();
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedLevels, setSelectedLevels] = useState<number[]>([]);
  useEffect(() => { if (schedules) setSelectedLevels(schedules.filter(s => s.date === selectedDate).map(s => s.level)); }, [schedules, selectedDate]);
  const toggleLevel = (lv: number) => { if (!firestore || !companyId) return; const existing = schedules?.find(s => s.date === selectedDate && s.level === lv); if (existing) deleteDocumentNonBlocking(doc(firestore, 'companies', companyId, 'laundrySchedules', existing.id)); else setDoc(doc(firestore, 'companies', companyId, 'laundrySchedules', `${selectedDate}_LV${lv}`), { id: `${selectedDate}_LV${lv}`, companyId, date: selectedDate, level: lv }); };
  return (<div className="space-y-8 max-w-4xl mx-auto"><Card className="border-none shadow-sm bg-white rounded-3xl p-10"><div className="flex justify-between items-center mb-10"><div><h3 className="text-2xl font-black">Turn Scheduler</h3></div><Input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="w-48 rounded-xl font-bold bg-secondary/10 border-none" /></div><div className="grid grid-cols-5 gap-4">{LEVELS.map(lv => (<button key={lv} onClick={() => toggleLevel(lv)} className={cn("h-32 rounded-[32px] border-4 flex flex-col items-center justify-center transition-all", selectedLevels.includes(lv) ? "bg-primary border-primary text-primary-foreground shadow-xl" : "bg-secondary/10 border-transparent opacity-50")}><p className="text-4xl font-black">{lv}</p>{selectedLevels.includes(lv) && <CheckCircle2 className="w-5 h-5 mt-2" />}</button>))}</div></Card></div>);
}

function InventoryGauge({ label, item, currencySymbol }: { label: string, item?: LaundryInventory, currencySymbol: string }) {
  return (<Card className="border-none shadow-sm bg-white rounded-3xl p-8 relative overflow-hidden"><div className="absolute top-0 right-0 p-6 opacity-5"><Droplet className="w-24 h-24" /></div><p className="text-[10px] font-black uppercase text-muted-foreground mb-2 tracking-widest">{label}</p><h4 className="text-4xl font-black tracking-tighter">{(item?.soapStockMl || 0).toLocaleString()} ml</h4><div className="grid grid-cols-2 gap-4 mb-6 mt-6"><div className="p-3 bg-secondary/10 rounded-xl"><p className="text-[8px] font-black uppercase">Price/Unit</p><p className="text-sm font-black">{currencySymbol}{(item?.lastBottleCost || 0).toFixed(2)}</p></div><div className="p-3 bg-secondary/10 rounded-xl"><p className="text-[8px] font-black uppercase">Vol/Unit</p><p className="text-sm font-black">{(item?.lastBottleVolume || 0).toLocaleString()} ml</p></div></div>{item?.soapCostPerLitre !== undefined && (<div className="flex justify-between items-center mt-4 border-t pt-4 border-secondary/20"><p className="text-[10px] font-black text-primary uppercase">Weighted: {currencySymbol}{item.soapCostPerLitre.toFixed(2)}/L</p></div>)}</Card>);
}

function LaundryAnalytics({ transactions, currencySymbol }: { transactions: SaleTransaction[], currencySymbol: string }) {
  const subscriberWashes = transactions.filter(t => t.items[0].name.includes('Service Wash (Lv'));
  const payableWashes = transactions.filter(t => t.items[0].name === 'Payable Service Wash');
  
  const getChartData = (data: SaleTransaction[]) => { 
    const daily: Record<string, { date: string, revenue: number, profit: number }> = {}; 
    data.forEach(t => { 
      const day = new Date(t.timestamp).toLocaleDateString([], { weekday: 'short' }); 
      if (!daily[day]) daily[day] = { date: day, revenue: 0, profit: 0 }; 
      daily[day].revenue += t.totalAmount; 
      daily[day].profit += t.profit; 
    }); 
    return Object.values(daily).slice(-7); 
  };

  return (
    <div className="space-y-12 pb-24">
       <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="space-y-6">
             <div className="grid grid-cols-2 gap-4">
                <ReportStat label="Sub Revenue" value={`${currencySymbol}${subscriberWashes.reduce((acc, t) => acc + t.totalAmount, 0).toFixed(2)}`} />
                <ReportStat label="Sub Profit" value={`${currencySymbol}${subscriberWashes.reduce((acc, t) => acc + t.profit, 0).toFixed(2)}`} color="text-primary" />
             </div>
             <Card className="border-none shadow-sm p-8 bg-white rounded-[32px]">
                <div className="h-[200px]">
                   <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={getChartData(subscriberWashes)}>
                         <defs>
                            <linearGradient id="colorSub" x1="0" x2="0" y2="1">
                               <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                               <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                            </linearGradient>
                         </defs>
                         <CartesianGrid strokeDasharray="3 3" vertical={false} />
                         <XAxis dataKey="date" axisLine={false} tickLine={false}/>
                         <YAxis axisLine={false} tickLine={false} tickFormatter={(v) => `${currencySymbol}${v}`}/>
                         <Tooltip />
                         <Area type="monotone" dataKey="revenue" stroke="hsl(var(--primary))" fillOpacity={1} fill="url(#colorSub)" strokeWidth={3} />
                      </AreaChart>
                   </ResponsiveContainer>
                </div>
             </Card>
          </div>
          <div className="space-y-6">
             <div className="grid grid-cols-2 gap-4">
                <ReportStat label="Pay Revenue" value={`${currencySymbol}${payableWashes.reduce((acc, t) => acc + t.totalAmount, 0).toFixed(2)}`} />
                <ReportStat label="Pay Profit" value={`${currencySymbol}${payableWashes.reduce((acc, t) => acc + t.profit, 0).toFixed(2)}`} color="text-primary" />
             </div>
             <Card className="border-none shadow-sm p-8 bg-white rounded-[32px]">
                <div className="h-[200px]">
                   <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={getChartData(payableWashes)}>
                         <defs>
                            <linearGradient id="colorPay" x1="0" x2="0" y2="1">
                               <stop offset="5%" stopColor="hsl(var(--accent))" stopOpacity={0.3}/>
                               <stop offset="95%" stopColor="hsl(var(--accent))" stopOpacity={0}/>
                            </linearGradient>
                         </defs>
                         <CartesianGrid strokeDasharray="3 3" vertical={false} />
                         <XAxis dataKey="date" axisLine={false} tickLine={false}/>
                         <YAxis axisLine={false} tickLine={false} tickFormatter={(v) => `${currencySymbol}${v}`}/>
                         <Tooltip />
                         <Area type="monotone" dataKey="revenue" stroke="hsl(var(--accent))" fillOpacity={1} fill="url(#colorPay)" strokeWidth={3}/>
                      </AreaChart>
                   </ResponsiveContainer>
                </div>
             </Card>
          </div>
       </div>
    </div>
  );
}

function PaymentOption({ value, label, icon: Icon, id }: any) {
  return (
    <div className="flex-1">
      <RadioGroupItem value={value} id={id} className="peer sr-only" />
      <Label htmlFor={id} className="flex flex-col items-center justify-center rounded-[24px] border-4 border-transparent bg-secondary/20 p-4 hover:bg-secondary/30 peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/5 cursor-pointer h-32 text-center">
        <Icon className="mb-2 h-7 w-7 text-primary" />
        <span className="text-[10px] font-black uppercase tracking-widest">{label}</span>
      </Label>
    </div>
  );
}

function ReportStat({ label, value, color = "text-foreground" }: any) {
  return (<Card className="border-none shadow-sm p-8 bg-white rounded-[32px] flex justify-between items-start"><div><p className="text-[10px] font-black uppercase text-muted-foreground mb-2 tracking-widest">{label}</p><h4 className={cn("text-4xl font-black tracking-tighter", color)}>{value}</h4></div></Card>);
}