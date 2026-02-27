'use client';

import { Sidebar } from '@/components/layout/sidebar';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Users, Mail, Key, ShieldCheck, UserPlus } from 'lucide-react';
import { createViewerAction } from '@/app/actions';
import { useState, useEffect } from 'react';
import { User } from '@/lib/types';
import { useAuth } from '@/components/auth-context';
import { db } from '@/lib/store';
import { useToast } from '@/hooks/use-toast';

export default function ViewersPage() {
  const { user: currentUser } = useAuth();
  const [viewers, setViewers] = useState<User[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    // Filter global users to find viewers for this company
    const allUsers = db.getUsers();
    const companyViewers = allUsers.filter(u => u.role === 'viewer' && u.companyId === currentUser?.companyId);
    setViewers(companyViewers);
  }, [currentUser?.companyId]);

  const handleCreate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsCreating(true);
    const formData = new FormData(e.currentTarget);
    const result = await createViewerAction(formData, currentUser?.companyId || '', currentUser?.name || '');
    
    if (result.success && result.user) {
      setViewers([...viewers, result.user]);
      toast({
        title: "Viewer Access Granted",
        description: `${result.user.name}'s account has been created.`,
      });
      (e.target as HTMLFormElement).reset();
    }
    setIsCreating(false);
  };

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <main className="flex-1 overflow-auto p-8">
        <div className="max-w-6xl mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl font-bold font-headline">User Management</h1>
            <p className="text-muted-foreground">Manage viewer roles and access permissions</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-1">
              <Card className="border-none shadow-sm">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <UserPlus className="w-5 h-5 text-primary" />
                    New Viewer
                  </CardTitle>
                  <CardDescription>Grant read-only access to your business metrics</CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleCreate} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">Full Name</Label>
                      <Input id="name" name="name" placeholder="John Doe" required />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="username">Username</Label>
                      <Input id="username" name="username" placeholder="johndoe" required />
                    </div>
                    <Button type="submit" className="w-full" disabled={isCreating}>
                      {isCreating ? "Creating Viewer..." : "Create Account"}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </div>

            <div className="lg:col-span-2">
              <div className="space-y-4">
                <h3 className="font-semibold text-lg flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-primary" />
                  Active Viewers
                </h3>
                
                {viewers.length === 0 ? (
                  <div className="bg-white/50 border-2 border-dashed rounded-xl p-12 text-center">
                    <Users className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
                    <p className="text-muted-foreground">No viewers added yet.</p>
                  </div>
                ) : (
                  <div className="grid gap-4">
                    {viewers.map((viewer) => (
                      <Card key={viewer.id} className="shadow-sm border-none overflow-hidden group">
                        <CardContent className="p-0">
                          <div className="flex flex-col md:flex-row">
                            <div className="p-6 flex-1">
                              <div className="flex items-start justify-between mb-4">
                                <div>
                                  <h4 className="font-bold text-lg">{viewer.name}</h4>
                                  <p className="text-xs text-muted-foreground">Username: @{viewer.username}</p>
                                </div>
                                <div className="bg-accent/10 text-accent-foreground text-[10px] font-bold px-2 py-1 rounded-full uppercase">
                                  Read Only
                                </div>
                              </div>
                              
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <div className="flex items-center gap-3 p-2 bg-secondary/20 rounded-lg">
                                  <Mail className="w-3.5 h-3.5 text-primary" />
                                  <p className="text-xs font-medium truncate">{viewer.email}</p>
                                </div>
                                <div className="flex items-center gap-3 p-2 bg-accent/20 rounded-lg">
                                  <Key className="w-3.5 h-3.5 text-accent-foreground" />
                                  <p className="text-xs font-mono truncate">{viewer.password}</p>
                                </div>
                              </div>
                            </div>
                            <div className="bg-secondary/10 px-4 flex items-center justify-center border-l group-hover:bg-primary/5 transition-colors">
                              <Button variant="ghost" size="sm" className="text-destructive font-semibold">Revoke Access</Button>
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
