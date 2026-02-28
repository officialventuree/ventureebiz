
'use client';

import { Sidebar } from '@/components/layout/sidebar';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Wrench, Plus, Search, ArrowRight, Trash2, LayoutGrid, ClipboardList, Briefcase } from 'lucide-react';
import { useAuth } from '@/components/auth-context';
import { useFirestore, useCollection, useMemoFirebase, deleteDocumentNonBlocking } from '@/firebase';
import { collection, doc, setDoc, deleteDoc } from 'firebase/firestore';
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
      toast({ title: "Service Category Created", description: `${newService.name} is now available.` });
      (e.target as HTMLFormElement).reset();
    } catch (e) {
      toast({ title: "Creation failed", variant: "destructive" });
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteService = (serviceId: string) => {
    if (!firestore || !user?.companyId) return;
    if (!confirm("Are you sure? This will delete the entire service category and its settings.")) return;
    const docRef = doc(firestore, 'companies', user.companyId, 'serviceTypes', serviceId);
    deleteDocumentNonBlocking(docRef);
    toast({ title: "Category Removed" });
  };

  return (
    <div className="flex h-screen bg-background font-body">
      <Sidebar />
      <main className="flex-1 overflow-auto p-8">
        <div className="max-w-6xl mx-auto">
          <div className="mb-10 flex justify-between items-end">
            <div>
              <h1 className="text-4xl font-black font-headline text-foreground tracking-tighter">Services Ecosystem</h1>
              <p className="text-muted-foreground font-medium">Strategic Portfolio & Departmental Management</p>
            </div>
            <div className="flex items-center gap-2 text-[10px] font-black bg-white px-4 py-2 rounded-full shadow-sm border text-primary tracking-widest uppercase">
              <div className="w-2 h-2 bg-primary rounded-full animate-pulse" />
              Real-time Segment Sync
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
            <Card className="lg:col-span-1 border-none shadow-sm rounded-[32px] bg-white h-fit p-8 sticky top-8">
               <div className="space-y-6">
                  <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center text-primary">
                    <Plus className="w-6 h-6" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-xl font-black tracking-tight">New Department</h3>
                    <p className="text-xs font-bold text-muted-foreground">Register a new service line</p>
                  </div>
                  <form onSubmit={handleCreateServiceType} className="space-y-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black uppercase text-muted-foreground px-1">Category Name</label>
                      <Input name="name" placeholder="e.g. Phone Repair" required className="h-12 rounded-xl font-bold bg-secondary/10 border-none" />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black uppercase text-muted-foreground px-1">Scope / Description</label>
                      <Textarea name="description" placeholder="Short scope summary..." className="rounded-xl bg-secondary/10 border-none font-medium text-sm" />
                    </div>
                    <Button type="submit" className="w-full h-14 rounded-2xl font-black shadow-xl" disabled={isCreating}>
                      {isCreating ? "Deploying..." : "Launch Category"}
                    </Button>
                  </form>
               </div>
            </Card>

            <div className="lg:col-span-3 space-y-6">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-primary w-5 h-5" />
                <Input 
                  placeholder="SEARCH SERVICE PORTFOLIO..." 
                  className="pl-16 h-16 rounded-[24px] border-none bg-white shadow-lg text-lg font-black"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {isLoading ? (
                  Array(4).fill(0).map((_, i) => <div key={i} className="h-48 bg-white/50 rounded-[32px] animate-pulse" />)
                ) : filteredServices?.map((service) => (
                  <Card key={service.id} className="border-none shadow-sm rounded-[32px] bg-white group hover:shadow-xl transition-all overflow-hidden relative">
                    <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:scale-110 transition-transform">
                      <Wrench className="w-24 h-24" />
                    </div>
                    <CardContent className="p-8 space-y-6 relative z-10">
                      <div className="flex justify-between items-start">
                        <div className="w-14 h-14 bg-secondary rounded-[20px] flex items-center justify-center">
                          <Briefcase className="w-7 h-7 text-primary" />
                        </div>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => handleDeleteService(service.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                      
                      <div>
                        <h3 className="text-2xl font-black tracking-tight text-foreground">{service.name}</h3>
                        <p className="text-sm font-medium text-muted-foreground mt-1 line-clamp-2">{service.description || "Multi-pillar service management active."}</p>
                      </div>

                      <div className="pt-4 border-t border-secondary/50 flex items-center justify-between">
                        <Badge variant="secondary" className="font-black text-[10px] uppercase px-3 py-1 rounded-lg">Active Dashboard</Badge>
                        <Link href={`/company/services/${service.id}`} className="flex items-center gap-2 text-primary font-black text-xs uppercase tracking-widest hover:gap-3 transition-all">
                          Enter Command Center <ArrowRight className="w-4 h-4" />
                        </Link>
                      </div>
                    </CardContent>
                  </Card>
                ))}
                {filteredServices?.length === 0 && (
                  <div className="col-span-full py-24 text-center border-4 border-dashed rounded-[40px] bg-white/50">
                    <LayoutGrid className="w-16 h-16 mx-auto mb-4 opacity-10" />
                    <p className="font-black text-muted-foreground text-lg uppercase tracking-widest">No Service Categories Found</p>
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
