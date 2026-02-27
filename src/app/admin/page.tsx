'use client';

import { Sidebar } from '@/components/layout/sidebar';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, Building2, Mail, Key, Search } from 'lucide-react';
import { createCompanyAction } from '@/app/actions';
import { useState } from 'react';
import { Company } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, doc, setDoc } from 'firebase/firestore';

export default function AdminDashboard() {
  const firestore = useFirestore();
  const { toast } = useToast();
  const [isCreating, setIsCreating] = useState(false);

  const companiesQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return collection(firestore, 'companies');
  }, [firestore]);

  const { data: companies, isLoading: loadingCompanies } = useCollection<Company>(companiesQuery);

  const handleCreate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!firestore) return;
    setIsCreating(true);
    
    const formData = new FormData(e.currentTarget);
    const result = await createCompanyAction(formData);
    
    if (result.success && result.company) {
      const companyData = result.company;
      try {
        // Save company profile
        await setDoc(doc(firestore, 'companies', companyData.id), companyData);
        
        // Save user record for manual login lookup
        await setDoc(doc(firestore, 'company_users', companyData.id), {
          id: companyData.id,
          name: companyData.name,
          email: companyData.email,
          password: companyData.password,
          role: 'company',
          companyId: companyData.id
        });

        toast({
          title: "Company Registered",
          description: `Account for ${companyData.name} is ready.`,
        });
        (e.target as HTMLFormElement).reset();
      } catch (e: any) {
        toast({ title: "Registration error", description: e.message, variant: "destructive" });
      }
    }
    setIsCreating(false);
  };

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <main className="flex-1 overflow-auto p-8">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-3xl font-bold font-headline">Admin Portal</h1>
              <p className="text-muted-foreground">Register and manage SaaS platform partners</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-1">
              <Card className="shadow-sm border-none bg-white">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Plus className="w-5 h-5 text-primary" />
                    New Company
                  </CardTitle>
                  <CardDescription>Register a new business entity on the platform</CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleCreate} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">Company Legal Name</Label>
                      <Input id="name" name="name" placeholder="Acme Corp" required />
                    </div>
                    <Button type="submit" className="w-full" disabled={isCreating}>
                      {isCreating ? "Saving..." : "Add Company"}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </div>

            <div className="lg:col-span-2 space-y-6">
              <div className="flex items-center gap-4 bg-white p-2 rounded-xl border shadow-sm px-4">
                <Search className="text-muted-foreground w-5 h-5" />
                <input 
                  placeholder="Search registered companies..." 
                  className="flex-1 bg-transparent border-none outline-none text-sm h-10"
                />
              </div>

              <div className="space-y-4">
                <h3 className="font-semibold text-lg flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-primary" />
                  Registered Companies
                </h3>
                
                {loadingCompanies ? (
                  <div className="bg-white/50 border-2 border-dashed rounded-xl p-12 text-center text-muted-foreground animate-pulse">
                    Scanning database...
                  </div>
                ) : !companies || companies.length === 0 ? (
                  <div className="bg-white/50 border-2 border-dashed rounded-xl p-12 text-center">
                    <Building2 className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
                    <p className="text-muted-foreground">No companies registered yet.</p>
                  </div>
                ) : (
                  <div className="grid gap-4">
                    {companies.map((company) => (
                      <Card key={company.id} className="shadow-sm border-none hover:shadow-md transition-shadow">
                        <CardContent className="p-6">
                          <div className="flex items-start justify-between">
                            <div className="space-y-1">
                              <h4 className="font-bold text-xl">{company.name}</h4>
                              <p className="text-[10px] text-muted-foreground font-mono uppercase tracking-tighter">ID: {company.id}</p>
                            </div>
                            <div className="bg-primary/10 text-primary text-[10px] font-bold px-2 py-1 rounded-full uppercase">
                              Active Partner
                            </div>
                          </div>
                          
                          <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="flex items-center gap-3 p-3 bg-secondary/30 rounded-lg">
                              <Mail className="w-4 h-4 text-primary" />
                              <div className="flex-1 min-w-0">
                                <p className="text-[10px] font-semibold text-muted-foreground uppercase">Login Email</p>
                                <p className="text-sm font-medium truncate">{company.email}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-3 p-3 bg-accent/20 rounded-lg">
                              <Key className="w-4 h-4 text-accent-foreground" />
                              <div className="flex-1 min-w-0">
                                <p className="text-[10px] font-semibold text-muted-foreground uppercase">Password</p>
                                <p className="text-sm font-medium truncate font-mono">{company.password}</p>
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
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
