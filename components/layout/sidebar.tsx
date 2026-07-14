'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard, AlertTriangle, Users, Building2, Tag,
  BarChart3, Settings, Activity,
  ChevronLeft, ChevronRight, LogOut, User,
  Wrench, PlusCircle,
} from 'lucide-react';
import { useState } from 'react';

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  roles?: string[];
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Tableau de bord', href: '/dashboard', icon: <LayoutDashboard className="w-4.5 h-4.5" /> },
  { label: 'Incidents', href: '/incidents', icon: <AlertTriangle className="w-4.5 h-4.5" /> },
  { label: 'Nouvel incident', href: '/incidents/new', icon: <PlusCircle className="w-4.5 h-4.5" /> },
];

const ADMIN_NAV: NavItem[] = [
  { label: 'Utilisateurs', href: '/users', icon: <Users className="w-4.5 h-4.5" />, roles: ['admin'] },
  { label: 'Départements', href: '/departments', icon: <Building2 className="w-4.5 h-4.5" />, roles: ['admin'] },
  { label: 'Catégories', href: '/categories', icon: <Tag className="w-4.5 h-4.5" />, roles: ['admin'] },
  { label: 'Rapports', href: '/reports', icon: <BarChart3 className="w-4.5 h-4.5" />, roles: ['admin', 'technician'] },
  { label: 'Journal d\'activité', href: '/activity', icon: <Activity className="w-4.5 h-4.5" />, roles: ['admin'] },
];

const BOTTOM_NAV: NavItem[] = [
  { label: 'Profil', href: '/profile', icon: <User className="w-4.5 h-4.5" /> },
  { label: 'Paramètres', href: '/settings', icon: <Settings className="w-4.5 h-4.5" />, roles: ['admin'] },
];

export function Sidebar() {
  const { profile, signOut } = useAuth();
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  const role = profile?.role ?? 'employee';

  const visibleAdminNav = ADMIN_NAV.filter(item => !item.roles || item.roles.includes(role));
  const visibleBottomNav = BOTTOM_NAV.filter(item => !item.roles || item.roles.includes(role));

  const NavLink = ({ item }: { item: NavItem }) => {
    const active = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));
    return (
      <Link
        href={item.href}
        title={collapsed ? item.label : undefined}
        className={cn(
          'flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all duration-150',
          'hover:bg-white/10',
          active
            ? 'bg-[hsl(var(--primary))] text-white font-medium shadow-lg shadow-[hsl(var(--primary))]/30'
            : 'text-[hsl(var(--sidebar-foreground))] opacity-75 hover:opacity-100',
          collapsed && 'justify-center px-2'
        )}
      >
        <span className="flex-shrink-0">{item.icon}</span>
        {!collapsed && <span className="truncate">{item.label}</span>}
      </Link>
    );
  };

  return (
    <aside
      className={cn(
        'flex flex-col h-screen sticky top-0 sidebar-bg transition-all duration-300 border-r border-white/10',
        collapsed ? 'w-16' : 'w-60'
      )}
    >
      {/* Logo */}
      <div className={cn('border-b border-white/10', collapsed ? 'p-3 flex justify-center' : 'px-4 py-3 flex justify-center')}>
        <div className={cn('bg-white rounded-xl flex items-center justify-center flex-shrink-0 overflow-hidden', collapsed ? 'w-9 h-9 p-1' : 'w-full p-2')}>
          <Image
            src="/image.png"
            alt="RAM Handling"
            width={collapsed ? 28 : 140}
            height={collapsed ? 28 : 36}
            className="object-contain"
            style={{ width: 'auto', height: collapsed ? 28 : 32 }}
          />
        </div>
      </div>

      {/* Collapse button */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="absolute -right-3 top-6 w-6 h-6 bg-background border border-border rounded-full flex items-center justify-center shadow-sm hover:shadow-md transition-shadow z-10"
      >
        {collapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronLeft className="w-3 h-3" />}
      </button>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto scrollbar-thin p-3 space-y-0.5">
        {NAV_ITEMS.map(item => <NavLink key={item.href} item={item} />)}

        {visibleAdminNav.length > 0 && (
          <>
            {!collapsed && (
              <div className="px-3 pt-4 pb-1">
                <span className="text-[hsl(var(--sidebar-muted))] text-[10px] uppercase tracking-wider font-semibold">
                  Administration
                </span>
              </div>
            )}
            {collapsed && <div className="my-2 border-t border-white/10" />}
            {visibleAdminNav.map(item => <NavLink key={item.href} item={item} />)}
          </>
        )}
      </nav>

      {/* Bottom */}
      <div className="p-3 border-t border-white/10 space-y-0.5">
        {visibleBottomNav.map(item => <NavLink key={item.href} item={item} />)}
        <button
          onClick={signOut}
          title={collapsed ? 'Déconnexion' : undefined}
          className={cn(
            'w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all text-[hsl(var(--sidebar-foreground))] opacity-75 hover:opacity-100 hover:bg-red-500/20 hover:text-red-300',
            collapsed && 'justify-center px-2'
          )}
        >
          <LogOut className="w-4.5 h-4.5 flex-shrink-0" />
          {!collapsed && <span>Déconnexion</span>}
        </button>
      </div>
    </aside>
  );
}
