
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
  Wallet 
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

export function Sidebar() {
  const { user, logout } = useAuth();
  const pathname = usePathname();

  const adminLinks = [
    { href: '/admin', icon: LayoutDashboard, label: 'Portal' },
  ];

  const companyLinks = [
    { href: '/company', icon: LayoutDashboard, label: 'Overview' },
    { href: '/company/mart', icon: ShoppingCart, label: 'Mart' },
    { href: '/company/laundry', icon: Waves, label: 'Laundry' },
    { href: '/company/rent', icon: CalendarDays, label: 'Rent' },
    { href: '/company/services', icon: Wrench, label: 'Services' },
    { href: '/company/capital', icon: Wallet, label: 'Capital Control' },
    { href: '/company/reports', icon: BarChart3, label: 'Reports' },
    { href: '/company/viewers', icon: Users, label: 'Viewers' },
  ];

  const viewerLinks = [
    { href: '/viewer', icon: BarChart3, label: 'Insights' },
  ];

  const links = user?.role === 'admin' ? adminLinks : user?.role === 'company' ? companyLinks : viewerLinks;

  return (
    <div className="w-64 h-full bg-white border-r flex flex-col p-4 shrink-0 overflow-y-auto">
      <div className="flex items-center gap-3 px-2 mb-10">
        <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center shadow-sm">
          <Leaf className="text-primary-foreground w-6 h-6" />
        </div>
        <div>
          <h2 className="font-bold text-lg leading-tight">Venturee</h2>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Business Studio</p>
        </div>
      </div>

      <nav className="flex-1 space-y-1">
        {links.map((link) => (
          <Link key={link.href} href={link.href}>
            <span className={cn(
              "flex items-center gap-3 px-3 py-2 rounded-lg transition-colors group",
              pathname === link.href 
                ? "bg-primary text-primary-foreground shadow-sm" 
                : "text-muted-foreground hover:bg-secondary hover:text-foreground"
            )}>
              <link.icon className="w-4 h-4" />
              <span className="font-medium text-sm">{link.label}</span>
            </span>
          </Link>
        ))}
      </nav>

      <div className="pt-4 border-t mt-auto">
        <div className="px-3 py-4 mb-4 bg-secondary/50 rounded-xl">
          <p className="text-xs font-semibold text-muted-foreground mb-1 uppercase tracking-tighter">Logged in as</p>
          <p className="text-sm font-bold truncate">{user?.name}</p>
          <p className="text-[10px] text-muted-foreground truncate uppercase">{user?.role}</p>
        </div>
        <Button variant="ghost" className="w-full justify-start text-destructive hover:text-destructive hover:bg-destructive/10" onClick={logout}>
          <LogOut className="w-5 h-5 mr-3" />
          Logout
        </Button>
      </div>
    </div>
  );
}
