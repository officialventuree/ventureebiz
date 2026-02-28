
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
  ShieldCheck,
  Clock,
  RefreshCw,
  AlertTriangle,
  Lock,
  XCircle,
  Landmark,
  Calendar
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import Link from 'next/link';
import Image from 'next/image';
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
      .then(() => { 
        toast({ title: editingStudent ? "Profile Updated" : "Student Enrolled" }); 
        setEditingStudent(null); 
        setSelectedLevel(''); 
        setSelectedClass(''); 
      })
      .finally(() => setIsProcessing(false));
  };

  const handleDeleteStudent = (studentId: string) => {
    if (!firestore || !user?.companyId || !confirm("Delete this subscriber permanently?")) return;
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
      <main className="flex-1 overflow-auto p-10">
        <div className="mb-10 flex justify-between items-end">
          <div>
            <h1 className="text-4xl font-black font-headline tracking-tighter uppercase text-foreground">Facility Hub</h1>
            <p className="text-muted-foreground font-bold text-lg mt-1">Laundry Operations & Quota Quotas</p>
          </div>
          <div className="flex gap-4">
            <Card className="p-4 border-none shadow-xl bg-white/80 flex items-center gap-4 rounded-[24px]">
              <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg", remainingBudget > 0 ? "bg-primary text-white" : "bg-destructive text-white")}><Wallet className="w-6 h-6" /></div>
              <div><p className="text-[10px] font-black uppercase text-muted-foreground leading-tight tracking-widest">Tactical Budget</p><p className={cn("text-xl font-black tracking-tighter", remainingBudget <= 0 && "text-destructive")}>{currencySymbol}{remainingBudget.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p></div>
            </Card>
            <Dialog open={isTopUpOpen} onOpenChange={setIsTopUpOpen}>
              <DialogTrigger asChild><Button className="rounded-2xl h-16 px-10 font-black text-lg shadow-2xl gap-3 transition-all hover:scale-[1.02]"><Wallet className="w-6 h-6 fill-current" /> Account Deposit</Button></DialogTrigger>
              <DialogContent className="rounded-[48px] max-xl p-0 overflow-hidden bg-white border-none shadow-2xl">
                <div className="bg-primary p-12 text-primary-foreground text-center relative"><div className="absolute top-0 right-0 p-8 opacity-10"><Waves className="w-20 h-20" /></div><p className="text-xs font-black uppercase tracking-[0.3em] opacity-80 mb-2">Student Registry Settlement</p><DialogTitle className="text-5xl font-black tracking-tighter">Authorized Deposit</DialogTitle></div>
                <div className="p-12 space-y-10">
                  <div className="space-y-2"><Label className="text-[10px] font-black uppercase text-muted-foreground px-1 tracking-widest">Subscriber Matrix Identity</Label><Input placeholder="SCAN OR ENTER MATRIX ID..." className="h-16 rounded-2xl font-black text-2xl bg-secondary/10 border-none px-8" value={topUpMatrix} onChange={(e) => setTopUpMatrix(e.target.value)}/></div>
                  {foundTopUpStudent && (
                    <div className="space-y-8 animate-in fade-in slide-in-from-top-4">
                      <div className="p-8 bg-primary/5 rounded-[32px] border-4 border-primary/10 flex justify-between items-center">
                        <div><p className="text-[10px] font-black text-primary uppercase tracking-widest">Validated Account</p><h4 className="text-3xl font-black tracking-tighter">{foundTopUpStudent.name}</h4><p className="text-xs font-bold text-muted-foreground mt-1">Level {foundTopUpStudent.level} Operational • {foundTopUpStudent.class} Squadron</p></div>
                        <div className="text-right"><p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Outstanding Liability</p><p className="text-4xl font-black text-destructive tracking-tighter">{currencySymbol}{Math.max(0, (foundTopUpStudent.initialAmount ?? 0) - (foundTopUpStudent.balance ?? 0)).toFixed(2)}</p></div>
                      </div>
                      <div className="space-y-4"><Label className="text-[10px] font-black uppercase text-muted-foreground px-1 tracking-widest">Deposit Volume ({currencySymbol})</Label><Input type="number" placeholder="0.00" className="h-20 rounded-[28px] font-black text-5xl tracking-tighter bg-secondary/10 border-none px-8 text-center" value={topUpAmount} onChange={(e) => setTopUpAmount(e.target.value)}/></div>
                      <div className="space-y-4"><Label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground px-1">Settlement Method Protocol</Label><RadioGroup value={topUpPaymentMethod} onValueChange={(v) => setTopUpPaymentMethod(v as PaymentMethod)} className="grid grid-cols-3 gap-4"><PaymentOption value="cash" label="Physical Cash" icon={Banknote} id="topup_cash" /><PaymentOption value="card" label="Bank Card" icon={CreditCard} id="topup_card" /><PaymentOption value="duitnow" label="DuitNow" icon={QrCode} id="duitnow_final" /></RadioGroup></div>
                      {topUpPaymentMethod === 'cash' ? (
                        <div className="space-y-6 p-8 bg-secondary/10 rounded-[32px] border-2 border-dashed border-primary/20">
                          <div className="space-y-2"><Label className="text-[10px] font-black uppercase text-primary px-1 tracking-widest">Amount Paid In ({currencySymbol})</Label><Input type="number" placeholder="0.00" className="h-16 rounded-2xl font-black text-3xl bg-white border-none text-center shadow-inner" value={amountReceived} onChange={(e) => setAmountReceived(e.target.value)}/></div>
                          {Number(amountReceived) >= Number(topUpAmount) && Number(topUpAmount) > 0 && (
                            <div className="flex justify-between items-center px-4 py-4 border-t-2 border-primary/10 animate-in fade-in"><span className="text-xs font-black uppercase text-muted-foreground tracking-widest">Return Change:</span><span className="text-4xl font-black text-foreground tracking-tighter">{currencySymbol}{(Number(amountReceived) - Number(topUpAmount)).toFixed(2)}</span></div>
                          )}
                        </div>
                      ) : (
                        <div className="space-y-2 p-8 bg-secondary/10 rounded-[32px] border-2 border-dashed border-primary/20"><Label className="text-[10px] font-black uppercase px-1 tracking-widest">Transaction Trace ID / Auth Reference</Label><Input placeholder="ENTER REFERENCE CODE..." className="h-16 rounded-2xl font-black text-xl bg-white border-none px-8 shadow-inner" value={transactionNo} onChange={(e) => setTransactionNo(e.target.value)}/></div>
                      )}
                      <Button className="w-full h-24 rounded-[32px] font-black text-2xl shadow-2xl transition-all hover:scale-[1.02]" onClick={handleConfirmTopUp} disabled={isProcessing || !topUpAmount}>Confirm & Authorize Deposit</Button>
                    </div>
                  )}
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {!isBudgetActive && <Alert variant="destructive" className="mb-10 rounded-[24px] bg-destructive/5 border-2 border-destructive/10 animate-in slide-in-from-top-4"><AlertTriangle className="h-5 w-5" /><AlertTitle className="font-black uppercase text-[10px] tracking-[0.2em] mb-1">Financial Guardrail Alert</AlertTitle><AlertDescription className="text-sm font-bold opacity-80">Your <strong>Capital Base Limit</strong> is not set. <Link href="/company/capital" className="underline font-black hover:opacity-100 ml-2">Configure Strategic Budget</Link></AlertDescription></Alert>}

        <Tabs defaultValue="pos" className="space-y-10">
          <TabsList className="bg-white/50 border-2 border-primary/5 p-1.5 rounded-[24px] shadow-sm"><TabsTrigger value="pos" className="rounded-[18px] px-8 py-2 font-black text-xs uppercase tracking-widest">Washing Terminal</TabsTrigger><TabsTrigger value="payable" className="rounded-[18px] px-8 py-2 font-black text-xs uppercase tracking-widest">Walk-in Registry</TabsTrigger><TabsTrigger value="students" className="rounded-[18px] px-8 py-2 font-black text-xs uppercase tracking-widest">Authorized Subscribers</TabsTrigger><TabsTrigger value="schedule" className="rounded-[18px] px-8 py-2 font-black text-xs uppercase tracking-widest">Turn Scheduler</TabsTrigger><TabsTrigger value="config" className="rounded-[18px] px-8 py-2 font-black text-xs uppercase tracking-widest">Strategic Config</TabsTrigger><TabsTrigger value="consumables" className="rounded-[18px] px-8 py-2 font-black text-xs uppercase tracking-widest">Consumables</TabsTrigger><TabsTrigger value="profits" className="rounded-[18px] px-8 py-2 font-black text-xs uppercase tracking-widest">Hub Analytics</TabsTrigger><TabsTrigger value="billing" className="rounded-[18px] px-8 py-2 font-black text-xs uppercase tracking-widest">Gateway Hub</TabsTrigger></TabsList>

          <TabsContent value="pos" className="grid grid-cols-1 lg:grid-cols-3 gap-10">
            <div className="lg:col-span-2 space-y-8">
              <Card className="border-none shadow-sm bg-white rounded-[40px] overflow-hidden border-2 border-primary/5">
                <CardHeader className="bg-secondary/20 p-10"><div className="flex justify-between items-center"><div><CardTitle className="text-2xl font-black tracking-tight">Active Wash Terminal</CardTitle><CardDescription className="font-bold text-[10px] uppercase tracking-widest mt-2">Authorized Subscriber Verification</CardDescription></div><div className="text-right"><p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1">Operational Date</p><p className="font-black text-primary text-lg tracking-tighter">{todayDate ? new Date(todayDate).toLocaleDateString([], { dateStyle: 'long' }) : "---"}</p></div></div></CardHeader>
                <CardContent className="p-10 space-y-8">
                  <div className="flex gap-4 group"><div className="relative flex-1"><Search className="absolute left-6 top-1/2 -translate-y-1/2 text-primary w-7 h-7 relative z-10" /><Input placeholder="SCAN STUDENT MATRIX OR TYPE ID..." className="h-20 rounded-[28px] text-3xl font-black border-4 border-transparent bg-secondary/10 pl-16 focus-visible:bg-white focus-visible:border-primary/20 transition-all shadow-inner focus-visible:shadow-2xl relative z-0 tracking-tight" value={matrixSearch} onChange={(e) => setMatrixSearch(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { const found = students?.find(s => s.matrixNumber === matrixSearch); if (found) setSelectedStudent(found); else toast({ title: "Not Found", variant: "destructive" }); } }}/></div><Button onClick={() => { const found = students?.find(s => s.matrixNumber === matrixSearch); if (found) setSelectedStudent(found); else toast({ title: "Not Found", variant: "destructive" }); }} className="rounded-[28px] px-12 h-20 font-black text-xl shadow-2xl transition-all hover:scale-[1.02]">VERIFY</Button></div>
                  {selectedStudent ? (
                    <div className="p-12 bg-primary/5 rounded-[40px] border-4 border-primary/10 space-y-10 animate-in zoom-in-95">
                      <div className="flex flex-col md:flex-row justify-between items-start gap-6">
                        <div><p className="text-[10px] font-black text-primary uppercase tracking-[0.2em] mb-3">Validated Identity</p><h4 className="text-5xl font-black text-foreground tracking-tighter">{selectedStudent.name}</h4><div className="flex items-center gap-3 mt-4"><Badge variant="outline" className="font-black text-[10px] tracking-widest px-4 h-7 border-2">LEVEL {selectedStudent.level} SEGMENT</Badge><Badge variant="outline" className="font-black text-[10px] tracking-widest px-4 h-7 border-2 uppercase">{selectedStudent.class} SQUADRON</Badge></div></div>
                        <div className="text-right bg-white p-6 rounded-3xl shadow-sm border border-primary/5"><p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-2">Available Wash Capital</p><p className={cn("text-6xl font-black tracking-tighter", ((selectedStudent.balance ?? 0) - (selectedStudent.totalSpent ?? 0)) <= 0 ? "text-destructive" : "text-primary")}>{currencySymbol}{((selectedStudent.balance ?? 0) - (selectedStudent.totalSpent ?? 0)).toFixed(2)}</p><p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mt-3 opacity-60">Service Rate: {currencySymbol}{getWashRateForLevel(selectedStudent.level).toFixed(2)}</p></div>
                      </div>
                      <Button className="w-full h-24 rounded-[32px] text-2xl font-black shadow-2xl transition-all hover:scale-[1.02] group" onClick={handleChargeLaundry} disabled={isProcessing || !isBudgetActive || !isLevelAllowedToday(selectedStudent.level) || ((selectedStudent.balance ?? 0) - (selectedStudent.totalSpent ?? 0)) < getWashRateForLevel(selectedStudent.level)}>Confirm Wash & Debit Tactical Account <ArrowRight className="ml-4 w-8 h-8 group-hover:translate-x-2 transition-transform" /></Button>
                    </div>
                  ) : <div className="py-32 text-center bg-secondary/5 rounded-[40px] border-4 border-dashed border-secondary/20 group"><Search className="w-20 h-20 mx-auto mb-6 text-primary opacity-10 group-hover:opacity-30 transition-opacity" /><p className="font-black text-muted-foreground uppercase tracking-[0.3em] text-sm">Scanner Protocol Standby</p></div>}
                </CardContent>
              </Card>
            </div>
            <div className="lg:col-span-1"><Card className="bg-primary border-none shadow-2xl text-primary-foreground rounded-[48px] p-10 overflow-hidden relative border-4 border-white/10"><div className="absolute top-0 right-0 p-10 opacity-10 rotate-12"><Clock className="w-48 h-48" /></div><div className="relative z-10"><CardTitle className="flex items-center gap-4 text-2xl font-black tracking-tight mb-8"><CalendarDays className="w-8 h-8" /> Authorized Turns</CardTitle><div className="space-y-4">{LEVELS.map(lv => { const isAllowed = isLevelAllowedToday(lv); return (<div key={lv} className={cn("p-6 rounded-3xl flex justify-between items-center transition-all", isAllowed ? "bg-white/20 border-4 border-white/20 shadow-lg scale-[1.02]" : "bg-black/10 opacity-40 grayscale")}><p className="font-black text-2xl tracking-tighter">Level {lv} Segment</p>{isAllowed ? <Badge className="bg-white text-primary font-black px-4 py-1 rounded-xl uppercase tracking-widest text-[10px]">Authorized</Badge> : <Badge variant="outline" className="text-white/40 font-black px-4 py-1 rounded-xl uppercase tracking-widest text-[10px] border-white/20">Standby</Badge>}</div>); })}</div><div className="mt-10 pt-10 border-t border-white/10"><p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-60">Strategic Notice</p><p className="text-xs font-bold mt-2 leading-relaxed opacity-80">Only authorized segments are permitted terminal access for the current operational cycle.</p></div></div></Card></div>
          </TabsContent>

          <TabsContent value="payable">
             <Card className="border-none shadow-2xl bg-white rounded-[48px] p-12 max-w-2xl mx-auto border-2 border-primary/5">
                <CardHeader className="px-0 pt-0 mb-10"><div className="flex items-center gap-4 mb-2"><div className="w-12 h-12 bg-primary rounded-2xl flex items-center justify-center text-white"><Droplet className="w-6 h-6 fill-current" /></div><h2 className="text-3xl font-black tracking-tighter uppercase">Walk-in Service Entry</h2></div><p className="text-sm font-bold text-muted-foreground uppercase tracking-widest">Direct Settlement Protocol</p></CardHeader>
                <div className="space-y-10">
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      <div className="space-y-2"><Label className="text-[10px] font-black uppercase text-muted-foreground px-1 tracking-widest">Customer Identity</Label><Input placeholder="Full Name" value={payableName} onChange={(e) => setPayableName(e.target.value)} className="h-14 rounded-2xl font-black text-lg bg-secondary/10 border-none px-6" /></div>
                      <div className="space-y-2"><Label className="text-[10px] font-black uppercase text-muted-foreground px-1 tracking-widest">Service Fee ({currencySymbol})</Label><Input type="number" placeholder="5.00" value={payableAmount} onChange={(e) => setPayableAmount(e.target.value)} className="h-14 rounded-2xl font-black text-2xl bg-secondary/10 border-none px-6 text-primary tracking-tighter" /></div>
                   </div>
                   <div className="space-y-4"><Label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground px-1">Settlement Gateway Selection</Label><RadioGroup value={payablePaymentMethod} onValueChange={(v) => setPayablePaymentMethod(v as PaymentMethod)} className="grid grid-cols-3 gap-4"><PaymentOption value="cash" label="Physical Cash" icon={Banknote} id="pay_wash_cash" /><PaymentOption value="card" label="Bank Card" icon={CreditCard} id="pay_wash_card" /><PaymentOption value="duitnow" label="DuitNow Digital" icon={QrCode} id="pay_wash_qr" /></RadioGroup></div>
                   {payablePaymentMethod === 'cash' ? (
                     <div className="p-8 bg-primary/5 rounded-[40px] border-4 border-primary/10 space-y-8 animate-in fade-in">
                        <div className="space-y-2"><Label className="text-[10px] font-black uppercase text-primary tracking-widest">Cash Volume Paid In ({currencySymbol})</Label><Input type="number" value={payableCashReceived} onChange={(e) => setPayableCashReceived(e.target.value)} className="h-20 rounded-[28px] font-black text-5xl tracking-tighter text-center bg-white border-none shadow-inner" /></div>
                        {Number(payableCashReceived) >= Number(payableAmount) && Number(payableAmount) > 0 && (<div className="flex justify-between items-center px-4 py-4 border-t-2 border-primary/10"><span className="text-xs font-black uppercase text-muted-foreground tracking-widest">Settlement Change:</span><span className="text-5xl font-black text-foreground tracking-tighter">{currencySymbol}{Math.max(0, (Number(payableCashReceived) || 0) - (Number(payableAmount) || 0)).toFixed(2)}</span></div>)}
                     </div>
                   ) : <div className="space-y-2 p-8 bg-secondary/10 rounded-[32px] border-2 border-dashed border-primary/20"><Label className="text-[10px] font-black uppercase text-muted-foreground px-1 tracking-widest">Trace ID / Authentication Reference</Label><Input placeholder="ENTER REFERENCE CODE..." value={payableRef} onChange={(e) => setPayableRef(e.target.value)} className="h-16 rounded-2xl font-black text-xl bg-white border-none px-8 shadow-inner" /></div>}
                   <Button onClick={handlePayableWash} className="w-full h-24 rounded-[32px] font-black text-2xl shadow-2xl transition-all hover:scale-[1.02]" disabled={isProcessing || !payableAmount}>Authorize & Confirm Wash</Button>
                </div>
             </Card>
          </TabsContent>

          <TabsContent value="students" className="space-y-10">
             <div className="grid grid-cols-1 lg:grid-cols-4 gap-10">
                <div className="lg:col-span-1"><Card className="border-none shadow-sm rounded-[40px] bg-white p-10 sticky top-10 border-2 border-secondary/10"><h3 className="text-2xl font-black mb-8 tracking-tight">{editingStudent ? 'Update Account' : 'New Enrollment'}</h3><form onSubmit={handleRegisterStudent} className="space-y-6"><div className="space-y-2"><Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Full Legal Name</Label><Input name="name" defaultValue={editingStudent?.name} required className="h-12 rounded-xl bg-secondary/10 border-none font-black text-sm" /></div><div className="space-y-2"><Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Matrix Identifier</Label><Input name="matrix" defaultValue={editingStudent?.matrixNumber} required className="h-12 rounded-xl bg-secondary/10 border-none font-black text-sm" /></div><div className="grid grid-cols-2 gap-4"><div className="space-y-2"><Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Segment</Label><Select value={selectedLevel} onValueChange={setSelectedLevel}><SelectTrigger className="h-12 rounded-xl bg-secondary/10 border-none font-black text-xs uppercase"><SelectValue placeholder="LEVEL" /></SelectTrigger><SelectContent className="rounded-xl font-black text-xs uppercase">{LEVELS.map(l => <SelectItem key={l} value={l.toString()}>Level {l}</SelectItem>)}</SelectContent></Select></div><div className="space-y-2"><Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Squadron</Label><Select value={selectedClass} onValueChange={setSelectedClass}><SelectTrigger className="h-12 rounded-xl bg-secondary/10 border-none font-black text-xs uppercase"><SelectValue placeholder="CLASS" /></SelectTrigger><SelectContent className="rounded-xl font-black text-xs uppercase">{CLASSES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select></div></div><div className="space-y-2"><Label className="text-[10px] font-black uppercase tracking-widest text-primary">Base Subscription Fee ({currencySymbol})</Label><div className="h-14 rounded-2xl bg-primary/5 border-2 border-primary/10 font-black flex items-center px-6 text-primary text-xl tracking-tighter">{currencySymbol}{(benchmarkSubscription || 0).toFixed(2)}</div></div><div className="flex gap-3 pt-4">{editingStudent && <Button type="button" variant="outline" onClick={() => { setEditingStudent(null); setSelectedLevel(''); setSelectedClass(''); }} className="flex-1 rounded-2xl h-14 font-black uppercase text-[10px] tracking-widest">Abort</Button>}<Button type="submit" className="flex-1 h-14 rounded-2xl font-black shadow-xl uppercase text-[10px] tracking-widest" disabled={isProcessing}>{editingStudent ? "Update" : "Authorize"}</Button></div></form></Card></div>
                <div className="lg:col-span-3"><div className="bg-white rounded-[48px] border-2 border-primary/5 shadow-sm overflow-hidden"><table className="w-full text-sm text-left"><thead className="bg-secondary/20 border-b-2"><tr><th className="p-8 font-black uppercase text-[10px] tracking-widest text-muted-foreground">Subscriber / Identity</th><th className="p-8 font-black uppercase text-[10px] tracking-widest text-muted-foreground">Base Sub</th><th className="p-8 font-black uppercase text-[10px] tracking-widest text-muted-foreground">Net Deposits</th><th className="p-8 font-black uppercase text-[10px] tracking-widest text-muted-foreground">Net Liquidity</th><th className="p-8 text-center font-black uppercase text-[10px] tracking-widest text-muted-foreground">Operations</th></tr></thead><tbody className="divide-y">{students?.map(s => { const deposits = s.balance ?? 0; const spent = s.totalSpent ?? 0; const washBalance = deposits - spent; return (<tr key={s.id} className="hover:bg-secondary/10 transition-all group"><td className="p-8"><p className="font-black text-xl tracking-tight text-foreground">{s.name}</p><p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-1.5">{s.matrixNumber} • LEVEL {s.level} • {s.class}</p></td><td className="p-8 font-black text-muted-foreground tracking-tighter text-lg">{currencySymbol}{(s.initialAmount ?? 0).toFixed(2)}</td><td className="p-8 font-black text-foreground tracking-tighter text-lg">{currencySymbol}{deposits.toFixed(2)}</td><td className="p-8"><p className={cn("font-black text-3xl tracking-tighter", washBalance <= 0 ? "text-destructive" : "text-primary")}>{currencySymbol}{washBalance.toFixed(2)}</p></td><td className="p-8 text-center"><div className="flex items-center justify-center gap-3"><Button variant="ghost" size="icon" onClick={() => { setEditingStudent(s); setSelectedLevel(s.level.toString()); setSelectedClass(s.class); }} className="h-12 w-12 rounded-2xl text-primary hover:bg-primary/10 transition-all border-2 border-transparent hover:border-primary/20"><Edit2 className="w-5 h-5" /></Button><Button variant="ghost" size="icon" onClick={() => handleDeleteStudent(s.id)} className="h-12 w-12 rounded-2xl text-destructive hover:bg-destructive/10 transition-all border-2 border-transparent hover:border-destructive/20"><Trash2 className="w-5 h-5" /></Button></div></td></tr>); })}</tbody></table></div></div>
             </div>
          </TabsContent>

          <TabsContent value="schedule"><LaundryScheduler companyId={user?.companyId} schedules={schedules} levelQuotas={levelQuotas} /></TabsContent>

          <TabsContent value="config" className="space-y-10"><GlobalPolicyConfig companyId={user?.companyId} initialConfig={globalConfig} currencySymbol={currencySymbol} /><LaundryConfigurator levelQuotas={levelQuotas} benchmarkSubscription={benchmarkSubscription} studentSoap={studentSoap} soapMlPerWash={soapMlPerWash} payableSoap={payableSoap} payableServiceRate={payableServiceRate} payableSoapMlPerWash={payableSoapMlPerWash} currencySymbol={currencySymbol}/></TabsContent>

          <TabsContent value="consumables">
             <div className="grid grid-cols-1 lg:grid-cols-4 gap-10">
                <div className="lg:col-span-1"><Card className={cn("border-none shadow-sm rounded-[40px] bg-white p-10 sticky top-10 border-2 border-transparent", !canProcure ? "grayscale opacity-80 border-destructive/10" : "hover:border-primary/10")}><div className="flex items-center gap-3 mb-8"><div className={cn("w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg", canProcure ? "bg-primary text-white" : "bg-destructive text-white")}>{canProcure ? <RefreshCw className="w-7 h-7" /> : <Lock className="w-7 h-7" />}</div><div><h3 className="text-xl font-black tracking-tight">{canProcure ? 'Stock Refill' : 'Terminal Locked'}</h3><p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest mt-1">Inventory Protocol</p></div></div><form onSubmit={handleRefillInventory} className="space-y-6"><div className="space-y-2"><Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground px-1">Tactical Pool</Label><Select value={refillCategory} onValueChange={(v: any) => setRefillCategory(v)} disabled={!canProcure}><SelectTrigger className="h-14 rounded-2xl bg-secondary/10 border-none font-black text-xs uppercase"><SelectValue /></SelectTrigger><SelectContent className="rounded-2xl font-black text-xs uppercase"><SelectItem value="student">Subscriber Pool</SelectItem><SelectItem value="payable">Walk-in Pool</SelectItem></SelectContent></Select></div><div className="grid grid-cols-2 gap-4"><div className="space-y-2"><Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground px-1">Units</Label><Input value={refillBottles} onChange={(e) => setRefillBottles(e.target.value)} type="number" disabled={!canProcure} className="h-12 rounded-xl bg-secondary/10 border-none font-black text-lg text-center" /></div><div className="space-y-2"><Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground px-1">Vol/Unit</Label><Input value={refillVolPerBottle} onChange={(e) => setRefillVolPerBottle(e.target.value)} type="number" disabled={!canProcure} className="h-12 rounded-xl bg-secondary/10 border-none font-black text-lg text-center" /></div></div><div className="space-y-2"><Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground px-1">Unit Liability ({currencySymbol})</Label><Input value={refillCostPerBottle} onChange={(e) => setRefillCostPerBottle(e.target.value)} type="number" step="0.01" disabled={!canProcure} className="h-14 rounded-2xl bg-secondary/10 border-none font-black text-2xl tracking-tighter text-center" /></div><Button type="submit" className="w-full h-20 rounded-[32px] font-black text-lg shadow-2xl transition-all hover:scale-[1.02]" disabled={isProcessing || !canProcure}>Confirm Stock Reinvestment</Button></form></Card></div>
                <div className="lg:col-span-3 grid grid-cols-1 md:grid-cols-2 gap-10"><InventoryGauge label="Subscriber Consumables" item={studentSoap} currencySymbol={currencySymbol}/><InventoryGauge label="Walk-in Consumables" item={payableSoap} currencySymbol={currencySymbol}/></div>
             </div>
          </TabsContent>

          <TabsContent value="profits"><LaundryAnalytics transactions={laundryTransactions} currencySymbol={currencySymbol} /></TabsContent>

          <TabsContent value="billing">
             <div className="max-w-3xl mx-auto py-16 text-center space-y-10"><Card className="border-none shadow-2xl rounded-[56px] bg-white p-16 space-y-10 border-4 border-primary/5"><div className="w-24 h-24 bg-primary/10 rounded-[32px] flex items-center justify-center text-primary mx-auto shadow-inner"><QrCode className="w-12 h-12" /></div><div><h2 className="text-4xl font-black tracking-tighter">Facility Gateway</h2><p className="text-muted-foreground font-bold text-lg mt-3">Subscriber Settlement Protocol Hub</p></div>{companyDoc?.duitNowQr ? (<div className="relative group w-fit mx-auto"><div className="absolute inset-0 bg-primary/20 rounded-[48px] blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" /><Image src={companyDoc.duitNowQr} alt="QR" width={300} height={300} className="rounded-[48px] border-8 border-white shadow-2xl relative z-10" /><label className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center rounded-[48px] cursor-pointer transition-all duration-300 z-20"><Upload className="text-white w-12 h-12 mb-4" /><p className="text-white font-black uppercase tracking-[0.2em] text-xs">Update Hub Protocol</p><input type="file" className="hidden" accept="image/*" onChange={async (e) => { const file = e.target.files?.[0]; if(!file || !firestore || !user?.companyId) return; const reader = new FileReader(); reader.onloadend = () => updateDoc(doc(firestore, 'companies', user.companyId!), { duitNowQr: reader.result as string }); reader.readAsDataURL(file); }} /></label></div>) : <label className="py-32 border-8 border-dashed rounded-[64px] opacity-30 cursor-pointer flex flex-col items-center justify-center gap-6 border-secondary/30 hover:bg-secondary/10 transition-all"><Plus className="w-16 h-16 text-primary" /><p className="font-black uppercase tracking-[0.3em] text-xs">Upload Gateway Protocol</p><input type="file" className="hidden" accept="image/*" /></label>}</Card></div>
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
  return (<Card className="border-none shadow-sm rounded-[40px] bg-white p-10 max-w-6xl mx-auto border-2 border-primary/5"><div className="grid grid-cols-1 md:grid-cols-4 gap-8 items-end"><div className="space-y-2"><Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground px-1">Base Subscription ({currencySymbol})</Label><Input type="number" step="0.01" value={subVal} onChange={(e) => setSubVal(e.target.value)} className="h-14 rounded-2xl bg-secondary/10 border-none font-black text-2xl tracking-tighter px-6" /></div><div className="space-y-2"><Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground px-1">Soap Vol/Wash (ml)</Label><Input type="number" value={soapVal} onChange={(e) => setSoapVal(e.target.value)} className="h-14 rounded-2xl bg-secondary/10 border-none font-black text-2xl tracking-tighter px-6" /></div><div className="space-y-2"><Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground px-1">Walk-in Rate ({currencySymbol})</Label><Input type="number" step="0.01" value={payableRateVal} onChange={(e) => setPayableRateVal(e.target.value)} className="h-14 rounded-2xl bg-secondary/10 border-none font-black text-2xl tracking-tighter px-6 text-primary" /></div><div className="space-y-2"><Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground px-1">Walk-in Soap (ml)</Label><Input type="number" value={payableSoapVal} onChange={(e) => setPayableSoapVal(e.target.value)} className="h-14 rounded-2xl bg-secondary/10 border-none font-black text-2xl tracking-tighter px-6" /></div><Button onClick={handleSave} className="h-16 rounded-[24px] px-12 font-black shadow-2xl md:col-span-4 uppercase tracking-[0.2em] text-sm">Update Strategic Policy Matrix</Button></div></Card>);
}

function LaundryConfigurator({ levelQuotas, benchmarkSubscription, studentSoap, soapMlPerWash, payableSoap, payableServiceRate, payableSoapMlPerWash, currencySymbol }: any) {
  const soapCostPerMl = (studentSoap?.soapCostPerLitre || 0) / 1000;
  const subscriberCostPrice = soapCostPerMl * soapMlPerWash;
  const payableSoapCostPerMl = (payableSoap?.soapCostPerLitre || 0) / 1000;
  const payableCostPrice = payableSoapCostPerMl * payableSoapMlPerWash;
  return (<Card className="border-none shadow-sm bg-white rounded-[48px] p-12 max-w-6xl mx-auto border-2 border-primary/5"><div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">{LEVELS.map(lv => { const quota = levelQuotas[lv] || 0; const serviceRate = quota > 0 ? (benchmarkSubscription / quota) : 0; return (<div key={lv} className="bg-secondary/10 p-8 rounded-[32px] space-y-6 border border-secondary/20 shadow-inner"><Badge className="h-8 px-6 rounded-xl font-black uppercase tracking-widest text-[10px]">Segment Level {lv}</Badge><div className="grid grid-cols-2 gap-4"><div className="p-5 bg-white rounded-2xl border shadow-sm"><p className="text-[9px] font-black text-primary uppercase tracking-widest mb-1">Tactical Rate</p><p className="text-2xl font-black tracking-tighter">{currencySymbol}{serviceRate.toFixed(2)}</p></div><div className="p-5 bg-white rounded-2xl border shadow-sm"><p className="text-[9px] font-black text-destructive uppercase tracking-widest mb-1">Unit Cost</p><p className="text-2xl font-black tracking-tighter">{currencySymbol}{subscriberCostPrice.toFixed(2)}</p></div></div><p className="text-[9px] font-bold text-muted-foreground uppercase text-center tracking-widest">Active Quota: {quota} Sessions/Cycle</p></div>); })}<div className="bg-primary/5 p-8 rounded-[32px] space-y-6 border-4 border-primary/10 shadow-lg col-span-1 md:col-span-2 lg:col-span-1"><Badge className="h-8 px-6 rounded-xl font-black uppercase tracking-widest text-[10px] bg-primary">Walk-in Segment</Badge><div className="grid grid-cols-2 gap-4"><div className="p-5 bg-white rounded-2xl border shadow-sm"><p className="text-[9px] font-black text-primary uppercase tracking-widest mb-1">Tactical Rate</p><p className="text-2xl font-black tracking-tighter">{currencySymbol}{payableServiceRate.toFixed(2)}</p></div><div className="p-5 bg-white rounded-2xl border shadow-sm"><p className="text-[9px] font-black text-destructive uppercase tracking-widest mb-1">Unit Cost</p><p className="text-2xl font-black tracking-tighter">{currencySymbol}{payableCostPrice.toFixed(2)}</p></div></div><p className="text-[9px] font-bold text-muted-foreground uppercase text-center tracking-widest">Public Operational Rate</p></div></div></Card>);
}

function LaundryScheduler({ companyId, schedules, levelQuotas }: { companyId?: string, schedules: LaundrySchedule[] | null, levelQuotas: Record<number, number> }) {
  const firestore = useFirestore();
  const { toast } = useToast();
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedLevels, setSelectedLevels] = useState<number[]>([]);

  useEffect(() => { 
    if (schedules) {
      setSelectedLevels(schedules.filter(s => s.date === selectedDate).map(s => s.level)); 
    }
  }, [schedules, selectedDate]);

  const toggleLevel = (lv: number) => { 
    if (!firestore || !companyId) return; 
    const existing = schedules?.find(s => s.date === selectedDate && s.level === lv); 
    if (existing) {
      deleteDocumentNonBlocking(doc(firestore, 'companies', companyId, 'laundrySchedules', existing.id)); 
    } else {
      const scheduleId = `${selectedDate}_LV${lv}`;
      setDoc(doc(firestore, 'companies', companyId, 'laundrySchedules', scheduleId), { 
        id: scheduleId, 
        companyId, 
        date: selectedDate, 
        level: lv 
      }); 
    }
  };

  const groupedSchedules = useMemo(() => {
    if (!schedules) return {};
    const groups: Record<string, number[]> = {};
    schedules.forEach(s => {
      if (!groups[s.date]) groups[s.date] = [];
      groups[s.date].push(s.level);
    });
    return Object.fromEntries(
      Object.entries(groups).sort((a, b) => new Date(b[0]).getTime() - new Date(a[0]).getTime())
    );
  }, [schedules]);

  return (
    <div className="space-y-12 max-w-5xl mx-auto pb-24">
      <Card className="border-none shadow-2xl bg-white rounded-[56px] overflow-hidden border-4 border-primary/5">
        <CardHeader className="bg-secondary/20 p-12 flex flex-col md:flex-row items-center justify-between gap-8">
          <div>
            <CardTitle className="text-3xl font-black tracking-tighter uppercase">Turn Authorization Matrix</CardTitle>
            <CardDescription className="font-bold text-sm text-muted-foreground uppercase tracking-widest mt-2">Active Segment Deployment Control</CardDescription>
          </div>
          <div className="bg-white p-6 rounded-3xl shadow-xl border-2 border-primary/10 flex items-center gap-4 transition-all hover:scale-[1.05]">
            <CalendarDays className="w-7 h-7 text-primary" />
            <div>
               <p className="text-[9px] font-black uppercase text-muted-foreground tracking-widest">Selected Period</p>
               <Input 
                 type="date" 
                 value={selectedDate} 
                 onChange={(e) => setSelectedDate(e.target.value)} 
                 className="w-44 border-none font-black text-lg p-0 h-auto focus-visible:ring-0 tracking-tight" 
               />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-12">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-8">
            {LEVELS.map(lv => {
              const isActive = selectedLevels.includes(lv);
              return (
                <button 
                  key={lv} 
                  onClick={() => toggleLevel(lv)} 
                  className={cn(
                    "relative h-56 rounded-[40px] border-8 flex flex-col items-center justify-center transition-all duration-500 group overflow-hidden shadow-sm",
                    isActive 
                      ? "bg-primary border-primary text-primary-foreground shadow-2xl scale-[1.05] z-10" 
                      : "bg-secondary/10 border-transparent hover:bg-secondary/20 grayscale opacity-50"
                  )}
                >
                  {isActive && (
                    <div className="absolute top-6 right-6 bg-white text-primary rounded-full p-1.5 animate-in zoom-in-50 duration-300">
                      <CheckCircle2 className="w-6 h-6" />
                    </div>
                  )}
                  <p className="text-[10px] font-black uppercase tracking-[0.3em] mb-2 opacity-60">Segment</p>
                  <p className="text-8xl font-black tracking-tighter leading-none">{lv}</p>
                  <div className={cn(
                    "mt-6 px-6 py-1.5 rounded-2xl text-[10px] font-black uppercase tracking-widest",
                    isActive ? "bg-black/20" : "bg-secondary/30 text-muted-foreground"
                  )}>
                    {isActive ? "DEPLOYED" : "STANDBY"}
                  </div>
                </button>
              );
            })}
          </div>

          <div className="mt-16 p-10 bg-primary/5 rounded-[48px] border-4 border-dashed border-primary/20 flex items-center gap-10">
            <div className="w-20 h-20 bg-white rounded-3xl flex items-center justify-center shadow-xl text-primary shrink-0">
              <ShieldCheck className="w-10 h-10" />
            </div>
            <div>
              <h4 className="font-black text-2xl tracking-tight uppercase">Segment Guardrail Active</h4>
              <p className="text-sm font-bold text-muted-foreground mt-2 leading-relaxed max-w-2xl">Unauthorized segments are dynamically blocked at the POS washing terminal based on this Turn Plan. Terminal access is restricted to deployed segments only.</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-10 px-4">
        <div className="flex items-center justify-between">
           <h3 className="text-3xl font-black flex items-center gap-4 tracking-tighter uppercase">
             <Calendar className="w-10 h-10 text-primary" /> Master Hub Registry
           </h3>
           <Badge className="font-black px-6 h-10 rounded-2xl tracking-widest text-[10px] uppercase border-none bg-primary/10 text-primary">{Object.keys(groupedSchedules).length} SESSIONS PLANNED</Badge>
        </div>
        {Object.keys(groupedSchedules).length === 0 ? (
          <div className="py-32 text-center bg-white rounded-[56px] border-4 border-dashed border-secondary/20 shadow-inner">
            <Calendar className="w-24 h-24 mx-auto mb-6 text-primary opacity-10" />
            <p className="font-black text-muted-foreground uppercase tracking-[0.4em] text-sm">Turn Registry Empty</p>
          </div>
        ) : (
          <div className="grid gap-6">
            {Object.entries(groupedSchedules).map(([date, levels]) => (
              <Card key={date} className="border-none shadow-xl bg-white rounded-[40px] overflow-hidden group hover:shadow-2xl transition-all border-2 border-transparent hover:border-primary/10">
                <CardContent className="p-10 flex flex-col md:flex-row items-center justify-between gap-8">
                  <div className="flex items-center gap-8">
                    <div className="w-20 h-20 bg-secondary/50 rounded-[32px] flex items-center justify-center text-primary group-hover:scale-[1.1] transition-transform duration-500 shadow-inner">
                      <CalendarDays className="w-10 h-10" />
                    </div>
                    <div>
                      <p className="font-black text-3xl tracking-tighter text-foreground">
                        {new Date(date).toLocaleDateString([], { dateStyle: 'full' })}
                      </p>
                      <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] mt-2">Status: Active Tactical Turn Plan</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex flex-wrap gap-2 justify-center md:justify-end">
                      {levels.sort().map(lv => (
                        <Badge key={lv} className="bg-primary text-primary-foreground font-black px-6 h-10 rounded-2xl text-xs tracking-widest uppercase shadow-lg border-2 border-white/10">LV {lv}</Badge>
                      ))}
                    </div>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      onClick={() => {
                        setSelectedDate(date);
                        toast({ title: "Session Selected", description: "Authorization matrix loaded for the chosen period." });
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }}
                      className="h-14 w-14 rounded-3xl text-primary hover:bg-primary/10 transition-all border-2 border-transparent hover:border-primary/20 shrink-0 ml-4"
                    >
                      <Edit2 className="w-6 h-6" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function InventoryGauge({ label, item, currencySymbol }: { label: string, item?: LaundryInventory, currencySymbol: string }) {
  const stock = item?.soapStockMl || 0;
  return (<Card className="border-none shadow-xl bg-white rounded-[48px] p-12 relative overflow-hidden group border-2 border-transparent hover:border-primary/10 transition-all"><div className="absolute top-0 right-0 p-10 opacity-5 group-hover:scale-110 transition-transform duration-500"><Droplet className="w-32 h-32" /></div><p className="text-[10px] font-black uppercase text-muted-foreground mb-4 tracking-[0.2em] leading-none">{label}</p><h4 className="text-6xl font-black tracking-tighter leading-none">{stock.toLocaleString()} <span className="text-2xl text-muted-foreground">ml</span></h4><div className="grid grid-cols-2 gap-6 mb-10 mt-10"><div className="p-5 bg-secondary/10 rounded-3xl border border-secondary/20 shadow-inner"><p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground mb-2">Protocol Price</p><p className="text-xl font-black tracking-tighter">{currencySymbol}{(item?.lastBottleCost || 0).toFixed(2)}</p></div><div className="p-5 bg-secondary/10 rounded-3xl border border-secondary/20 shadow-inner"><p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground mb-2">Volume/Batch</p><p className="text-xl font-black tracking-tighter">{(item?.lastBottleVolume || 0).toLocaleString()} ml</p></div></div>{item?.soapCostPerLitre !== undefined && (<div className="flex justify-between items-center mt-6 border-t-2 pt-6 border-secondary/10"><p className="text-[10px] font-black text-primary uppercase tracking-[0.2em]">Weighted Analysis: {currencySymbol}{item.soapCostPerLitre.toFixed(2)} / LITRE</p></div>)}</Card>);
}

function LaundryAnalytics({ transactions, currencySymbol }: { transactions: SaleTransaction[], currencySymbol: string }) {
  const subscriberWashes = transactions.filter(t => t.items[0].name.includes('Service Wash (Lv'));
  const payableWashes = transactions.filter(t => t.items[0].name === 'Payable Service Wash');
  
  const getChartData = (data: SaleTransaction[]) => { 
    if (!data || data.length === 0) return [];
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
    <div className="space-y-16 pb-24">
       <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          <div className="space-y-8">
             <div className="flex items-center gap-4 px-4"><div className="w-3 h-8 bg-primary rounded-full" /><h3 className="text-2xl font-black tracking-tighter uppercase">Subscriber Metrics</h3></div>
             <div className="grid grid-cols-2 gap-6">
                <ReportStat label="Cumulative Revenue" value={`${currencySymbol}${subscriberWashes.reduce((acc, t) => acc + t.totalAmount, 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`} />
                <ReportStat label="Realized Yield" value={`${currencySymbol}${subscriberWashes.reduce((acc, t) => acc + t.profit, 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`} color="text-primary" />
             </div>
             <Card className="border-none shadow-xl p-10 bg-white rounded-[48px] border-2 border-primary/5">
                <div className="h-[250px]">
                   <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={getChartData(subscriberWashes)}>
                         <defs>
                            <linearGradient id="colorSub" x1="0" x2="0" y2="1">
                               <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                               <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                            </linearGradient>
                         </defs>
                         <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                         <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontWeight: 900, fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}/>
                         <YAxis axisLine={false} tickLine={false} tick={{ fontWeight: 900, fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} tickFormatter={(v) => `${currencySymbol}${v}`}/>
                         <Tooltip contentStyle={{ borderRadius: '24px', border: 'none', boxShadow: '0 20px 50px rgba(0,0,0,0.1)' }} />
                         <Area type="monotone" dataKey="revenue" stroke="hsl(var(--primary))" fillOpacity={1} fill="url(#colorSub)" strokeWidth={5} />
                      </AreaChart>
                   </ResponsiveContainer>
                </div>
             </Card>
          </div>
          <div className="space-y-8">
             <div className="flex items-center gap-4 px-4"><div className="w-3 h-8 bg-accent rounded-full" /><h3 className="text-2xl font-black tracking-tighter uppercase">Walk-in Performance</h3></div>
             <div className="grid grid-cols-2 gap-6">
                <ReportStat label="Cumulative Revenue" value={`${currencySymbol}${payableWashes.reduce((acc, t) => acc + t.totalAmount, 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`} />
                <ReportStat label="Realized Yield" value={`${currencySymbol}${payableWashes.reduce((acc, t) => acc + t.profit, 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`} color="text-primary" />
             </div>
             <Card className="border-none shadow-xl p-10 bg-white rounded-[48px] border-2 border-primary/5">
                <div className="h-[250px]">
                   <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={getChartData(payableWashes)}>
                         <defs>
                            <linearGradient id="colorPay" x1="0" x2="0" y2="1">
                               <stop offset="5%" stopColor="hsl(var(--accent))" stopOpacity={0.3}/>
                               <stop offset="95%" stopColor="hsl(var(--accent))" stopOpacity={0}/>
                            </linearGradient>
                         </defs>
                         <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                         <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontWeight: 900, fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}/>
                         <YAxis axisLine={false} tickLine={false} tick={{ fontWeight: 900, fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} tickFormatter={(v) => `${currencySymbol}${v}`}/>
                         <Tooltip contentStyle={{ borderRadius: '24px', border: 'none', boxShadow: '0 20px 50px rgba(0,0,0,0.1)' }} />
                         <Area type="monotone" dataKey="revenue" stroke="hsl(var(--accent))" fillOpacity={1} fill="url(#colorPay)" strokeWidth={5}/>
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
    <div className="relative group flex-1">
      <RadioGroupItem value={value} id={id} className="peer sr-only" />
      <Label htmlFor={id} className="flex flex-col items-center justify-center rounded-[32px] border-4 border-transparent bg-secondary/20 p-6 hover:bg-secondary/30 peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/5 cursor-pointer transition-all h-32 text-center shadow-inner">
        <Icon className="mb-2 h-8 w-8 text-primary group-hover:scale-110 transition-transform" />
        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-foreground">{label}</span>
      </Label>
    </div>
  );
}

function ReportStat({ label, value, color = "text-foreground" }: any) {
  return (<Card className="border-none shadow-xl p-10 bg-white rounded-[40px] border-2 border-transparent hover:border-primary/10 transition-all"><div><p className="text-[10px] font-black uppercase text-muted-foreground mb-3 tracking-[0.2em]">{label}</p><h4 className={cn("text-4xl font-black tracking-tighter leading-none", color)}>{value}</h4></div></Card>);
}
