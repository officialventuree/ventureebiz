
'use client';

import { Sidebar } from '@/components/layout/sidebar';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Wrench, Plus, Search, ArrowRight, Trash2, LayoutGrid, ClipboardList, Briefcase, Zap } from 'lucide-react';
import { useAuth } from '@/components/auth-context';
import { useFirestore, useCollection, useMemoFirebase, deleteDocumentNonBlocking } from '@/firebase';
import { collection, doc, setDoc } from 'firebase/firestore';
import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { ServiceType } from '@/lib/types';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';

export default function ServicesDirectoryPage() {
  const { user } = useAuth();
  const firestore = useFirestore();
  const { toast } = useToast();
  const [isCreating, setIsCreating] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const servicesQuery = useMemoFirebase(() => {
    if (!firestore || !user?.companyId) return null;
    return collection(firestore, 'companies', user.companyId, 'serviceTypes');
  }, [firestore, user?.companyId]);

  const { data: serviceTypes, isLoading } = useCollection<ServiceType>(servicesQuery);

  const filteredServices = serviceTypes?.filter(s => 
    s.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleCreateServiceType = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!firestore || !user?.companyId) return;
    setIsCreating(true);
    
    const formData = new FormData(e.currentTarget);
    const serviceId = crypto.randomUUID();
    
    const newService: ServiceType = {
      id: serviceId,
      companyId: user.companyId,
      name: formData.get('name') as string,
      description: formData.get('description') as string,
    };

    try {
      await setDoc(doc(firestore, 'companies', user.companyId, 'serviceTypes', serviceId), newService);
      toast({ title: "Service Segment Commissioned", description: `${newService.name} is now tactical.` });
      (e.target as HTMLFormElement).reset();
    } catch (e) {
      toast({ title: "Creation failed", variant: "destructive" });
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteService = (serviceId: string) => {
    if (!firestore || !user?.companyId) return;
    if (!confirm("Critical: Permanently decommission this entire service segment?")) return;
    const docRef = doc(firestore, 'companies', user.companyId, 'serviceTypes', serviceId);
    deleteDocumentNonBlocking(docRef);
    toast({ title: "Segment Decommissioned" });
  };

  return (
    <div className="flex h-screen bg-background font-body">
      <Sidebar />
      <main className="flex-1 overflow-auto p-10">
        <div className="max-w-7xl mx-auto">
          <div className="mb-12 flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div>
              <h1 className="text-5xl font-black font-headline text-foreground tracking-tighter uppercase">Service Ecosystem</h1>
              <p className="text-muted-foreground font-bold text-lg mt-2 tracking-tight">Strategic Portfolio & Departmental Pipeline Management</p>
            </div>
            <div className="flex items-center gap-3 text-[10px] font-black bg-white px-6 py-3 rounded-full shadow-lg border-2 border-primary/10 text-primary tracking-[0.2em] uppercase">
              <div className="w-2.5 h-2.5 bg-primary rounded-full animate-pulse" />
              Real-time Hub Sync
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-4 gap-10">
            <Card className="lg:col-span-1 border-none shadow-xl rounded-[40px] bg-white h-fit p-10 sticky top-10 border-2 border-primary/5 transition-all hover:border-primary/10">
               <div className="space-y-8">
                  <div className="w-16 h-16 bg-primary rounded-[24px] flex items-center justify-center text-white shadow-lg">
                    <Plus className="w-8 h-8" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-black tracking-tighter leading-none">New Department</h3>
                    <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mt-2">Tactical Segment Launch</p>
                  </div>
                  <form onSubmit={handleCreateServiceType} className="space-y-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase text-muted-foreground px-1 tracking-widest">Segment Identity</label>
                      <Input name="name" placeholder="e.g. Precision Repair" required className="h-14 rounded-2xl font-black text-lg bg-secondary/10 border-none shadow-inner" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase text-muted-foreground px-1 tracking-widest">Strategic Scope</label>
                      <Textarea name="description" placeholder="Departmental operational summary..." className="rounded-2xl bg-secondary/10 border-none font-bold text-sm min-h-[120px] shadow-inner" />
                    </div>
                    <Button type="submit" className="w-full h-20 rounded-[32px] font-black text-lg shadow-2xl transition-all hover:scale-[1.02] active:scale-95" disabled={isCreating}>
                      {isCreating ? "LAUNCHING..." : "Commission Segment"}
                    </Button>
                  </form>
               </div>
            </Card>

            <div className="lg:col-span-3 space-y-10">
              <div className="relative group">
                <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-primary w-7 h-7 relative z-10" />
                <Input 
                  placeholder="SEARCH SERVICE PORTFOLIO BY CATEGORY..." 
                  className="pl-16 h-20 rounded-[32px] border-4 border-transparent bg-white shadow-xl text-2xl font-black focus-visible:ring-primary/20 transition-all tracking-tight relative z-0"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {isLoading ? (
                  Array(4).fill(0).map((_, i) => <div key={i} className="h-64 bg-white/50 rounded-[48px] animate-pulse" />)
                ) : filteredServices?.map((service) => (
                  <Card key={service.id} className="border-none shadow-sm rounded-[48px] bg-white group hover:shadow-2xl transition-all overflow-hidden relative border-2 border-transparent hover:border-primary/10">
                    <div className="absolute top-0 right-0 p-10 opacity-5 group-hover:scale-[1.2] transition-transform duration-700">
                      <Wrench className="w-32 h-32" />
                    </div>
                    <CardContent className="p-10 space-y-8 relative z-10">
                      <div className="flex justify-between items-start">
                        <div className="w-16 h-16 bg-secondary/50 rounded-[24px] flex items-center justify-center shadow-inner group-hover:scale-[1.1] transition-transform duration-500">
                          <Briefcase className="w-8 h-8 text-primary" />
                        </div>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-12 w-12 rounded-2xl text-destructive opacity-0 group-hover:opacity-100 transition-all border-2 border-transparent hover:border-destructive/20 hover:bg-destructive/10"
                          onClick={() => handleDeleteService(service.id)}
                        >
                          <Trash2 className="w-6 h-6" />
                        </Button>
                      </div>
                      
                      <div className="space-y-2">
                        <h3 className="text-3xl font-black tracking-tighter text-foreground leading-none">{service.name}</h3>
                        <p className="text-sm font-bold text-muted-foreground mt-2 line-clamp-3 leading-relaxed">{service.description || "Aggregated multi-pillar service operations protocol."}</p>
                      </div>

                      <div className="pt-8 border-t-2 border-secondary/20 flex flex-col md:flex-row items-center justify-between gap-4">
                        <Badge variant="secondary" className="font-black text-[10px] uppercase tracking-[0.2em] px-5 py-1.5 rounded-xl border-none bg-primary/10 text-primary">Operational Terminal</Badge>
                        <Link href={`/company/services/${service.id}`} className="flex items-center gap-2 text-foreground font-black text-xs uppercase tracking-widest hover:gap-4 transition-all hover:text-primary">
                          Enter Command Center <ArrowRight className="w-5 h-5 text-primary" />
                        </Link>
                      </div>
                    </CardContent>
                  </Card>
                ))}
                {filteredServices?.length === 0 && (
                  <div className="col-span-full py-32 text-center border-8 border-dashed rounded-[64px] bg-white/50 shadow-inner">
                    <LayoutGrid className="w-24 h-24 mx-auto mb-6 text-primary opacity-10" />
                    <p className="font-black text-muted-foreground text-lg uppercase tracking-[0.4em]">No Active Segments</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
