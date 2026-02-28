
'use client';

import { useAuth } from '@/components/auth-context';
import { useFirestore, useMemoFirebase, useDoc } from '@/firebase';
import { doc } from 'firebase/firestore';
import { Company } from '@/lib/types';
import { ShieldAlert, RefreshCw, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function CompanyLayout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const firestore = useFirestore();

  const companyRef = useMemoFirebase(() => {
    if (!firestore || !user?.companyId) return null;
    return doc(firestore, 'companies', user.companyId);
  }, [firestore, user?.companyId]);

  const { data: company, isLoading } = useDoc<Company>(companyRef);

  if (isLoading) return <div className="h-screen w-full flex items-center justify-center bg-background"><RefreshCw className="w-10 h-10 animate-spin text-primary" /></div>;

  const isExpired = company?.status === 'Expired';
  const isSuspended = company?.status === 'Suspended';

  if (isExpired || isSuspended) {
    return (
      <div className="h-screen w-full fixed inset-0 z-[9999] bg-background/95 backdrop-blur-md flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-[40px] shadow-2xl p-12 text-center space-y-8 border-4 border-destructive/20 animate-in zoom-in-95">
          <div className="w-20 h-20 bg-destructive/10 rounded-3xl flex items-center justify-center text-destructive mx-auto">
            <ShieldAlert className="w-10 h-10" />
          </div>
          <div className="space-y-2">
            <h2 className="text-3xl font-black tracking-tighter">{company?.name} Dashboard Expired</h2>
            <p className="text-muted-foreground font-medium">Access to business operations is restricted. Please contact your platform administrator for renewal.</p>
          </div>
          <div className="p-6 bg-secondary/20 rounded-2xl">
             <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest mb-1">Current Status</p>
             <p className="text-xl font-black text-destructive uppercase">{company?.status}</p>
          </div>
          <div className="flex flex-col gap-3">
             <Button variant="outline" className="h-14 rounded-2xl font-black gap-2" onClick={logout}>
                <LogOut className="w-5 h-5" /> Sign Out
             </Button>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
