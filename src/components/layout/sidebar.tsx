
'use client';

import { useAuth } from '@/components/auth-context';
import { Button } from '@/components/ui/button';
import { 
  LayoutDashboard, 
  ShoppingCart, 
  Users, 
  BarChart3, 
  LogOut, 
  Leaf, 
  Waves, 
  CalendarDays, 
  Wrench, 
  Wallet,
  Settings2,
  ShieldCheck
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

export function Sidebar() {
  const { user, logout } = useAuth();
  const pathname = usePathname();

  const adminLinks = [
    { href: '/admin', icon: ShieldCheck, label: 'Platform Management' },
  ];

  const companyLinks = [
    { href: '/company', icon: LayoutDashboard, label: 'Tactical Overview' },
    { href: '/company/mart', icon: ShoppingCart, label: 'Retail Operations' },
    { href: '/company/laundry', icon: Waves, label: 'Facility Hub' },
    { href: '/company/rent', icon: CalendarDays, label: 'Asset Leasing' },
    { href: '/company/services', icon: Wrench, label: 'Service Pipeline' },
    { href: '/company/capital', icon: Wallet, label: 'Capital Guardrails' },
    { href: '/company/reports', icon: BarChart3, label: 'Business Intelligence' },
    { href: '/company/viewers', icon: Users, label: 'Access Management' },
    { href: '/company/settings', icon: Settings2, label: 'Regional Config' },
  ];

  const viewerLinks = [
    { href: '/viewer', icon: BarChart3, label: 'Analytics Insights' },
  ];

  // Filter company links based on provisioned modules from admin setup
  const filteredCompanyLinks = companyLinks.filter(link => {
    // If user is not a company owner, return all (handled by layout guard)
    if (user?.role !== 'CompanyOwner' || !user?.enabledModules) return true;

    // Infrastructure modules are always visible
    const coreHrefs = ['/company', '/company/capital', '/company/reports', '/company/viewers', '/company/settings'];
    if (coreHrefs.includes(link.href)) return true;

    // Business unit check
    if (link.href === '/company/mart') return user.enabledModules.includes('mart');
    if (link.href === '/company/laundry') return user.enabledModules.includes('laundry');
    if (link.href === '/company/rent') return user.enabledModules.includes('rent');
    if (link.href === '/company/services') return user.enabledModules.includes('services');

    return true;
  });

  const links = user?.role === 'PlatformAdmin' ? adminLinks : user?.role === 'CompanyOwner' ? filteredCompanyLinks : viewerLinks;

  return (
    <div className="w-72 h-full bg-white border-r flex flex-col p-6 shrink-0 overflow-y-auto">
      <div className="flex items-center gap-4 px-2 mb-12">
        <div className="w-12 h-12 bg-primary rounded-2xl flex items-center justify-center shadow-lg shadow-primary/20">
          <Leaf className="text-primary-foreground w-7 h-7" />
        </div>
        <div>
          <h2 className="font-black text-xl leading-none tracking-tighter">Venturee</h2>
          <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-black mt-1">Business Studio</p>
        </div>
      </div>

      <nav className="flex-1 space-y-2">
        {links.map((link) => (
          <Link key={link.href} href={link.href}>
            <span className={cn(
              "flex items-center gap-3 px-4 py-3 rounded-2xl transition-all duration-200 group",
              pathname === link.href 
                ? "bg-primary text-primary-foreground shadow-md shadow-primary/10" 
                : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
            )}>
              <link.icon className={cn("w-5 h-5", pathname === link.href ? "text-white" : "text-primary")} />
              <span className="font-black text-sm tracking-tight">{link.label}</span>
            </span>
          </Link>
        ))}
      </nav>

      <div className="pt-6 border-t mt-auto">
        <div className="px-4 py-5 mb-6 bg-secondary/30 rounded-3xl border border-secondary/50">
          <p className="text-[9px] font-black text-muted-foreground mb-2 uppercase tracking-widest">Active Session</p>
          <p className="text-sm font-black truncate text-foreground">{user?.name}</p>
          <p className="text-[10px] text-primary font-bold truncate uppercase mt-0.5">{user?.role}</p>
        </div>
        <Button variant="ghost" className="w-full justify-start text-destructive font-black text-sm h-12 rounded-2xl hover:text-destructive hover:bg-destructive/10" onClick={logout}>
          <LogOut className="w-5 h-5 mr-3" />
          Logout Terminal
        </Button>
      </div>
    </div>
  );
}
