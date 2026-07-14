'use client';

import { useTheme } from 'next-themes';
import { useAuth } from '@/lib/auth-context';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { Notification } from '@/lib/supabase';
import { Bell, Sun, Moon, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { getInitials, getAvatarColor } from '@/lib/constants';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuTrigger, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { formatDateTime } from '@/lib/constants';
import Link from 'next/link';
import { cn } from '@/lib/utils';

export function Navbar() {
  const { profile } = useAuth();
  const { theme, setTheme } = useTheme();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (!profile) return;

    const fetchNotifs = async () => {
      const { data } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', profile.id)
        .order('created_at', { ascending: false })
        .limit(10);
      if (data) {
        setNotifications(data);
        setUnread(data.filter(n => !n.is_read).length);
      }
    };
    fetchNotifs();

    const channel = supabase
      .channel('notif-' + profile.id)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'notifications',
        filter: `user_id=eq.${profile.id}`,
      }, payload => {
        setNotifications(prev => [payload.new as Notification, ...prev].slice(0, 10));
        setUnread(prev => prev + 1);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [profile]);

  const markAllRead = async () => {
    if (!profile) return;
    await supabase.from('notifications').update({ is_read: true }).eq('user_id', profile.id);
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    setUnread(0);
  };

  const typeColor: Record<string, string> = {
    info: 'bg-blue-500',
    success: 'bg-emerald-500',
    warning: 'bg-amber-500',
    error: 'bg-red-500',
  };

  return (
    <header className="h-14 border-b border-border bg-card/80 backdrop-blur-sm flex items-center px-4 gap-4 sticky top-0 z-30">
      <div className="flex-1 max-w-md">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Link href="/incidents">
            <Input
              placeholder="Rechercher un incident…"
              className="pl-9 h-8 bg-muted/50 border-0 text-sm cursor-pointer"
              readOnly
            />
          </Link>
        </div>
      </div>

      <div className="flex items-center gap-2 ml-auto">
        {mounted && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          >
            {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </Button>
        )}

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8 relative">
              <Bell className="w-4 h-4" />
              {unread > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                  {unread > 9 ? '9+' : unread}
                </span>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80">
            <div className="flex items-center justify-between px-3 py-2 border-b border-border">
              <span className="font-semibold text-sm">Notifications</span>
              {unread > 0 && (
                <button onClick={markAllRead} className="text-xs text-primary hover:underline">
                  Tout marquer lu
                </button>
              )}
            </div>
            <div className="max-h-72 overflow-y-auto scrollbar-thin">
              {notifications.length === 0 ? (
                <div className="px-3 py-6 text-center text-muted-foreground text-sm">
                  Aucune notification
                </div>
              ) : (
                notifications.map(n => (
                  <DropdownMenuItem key={n.id} className={cn('flex items-start gap-3 p-3 cursor-default', !n.is_read && 'bg-primary/5')}>
                    <div className={cn('w-2 h-2 rounded-full mt-1.5 flex-shrink-0', typeColor[n.type])} />
                    <div className="min-w-0">
                      <div className={cn('text-xs font-medium', !n.is_read && 'text-foreground')}>{n.title}</div>
                      <div className="text-xs text-muted-foreground truncate">{n.message}</div>
                      <div className="text-[10px] text-muted-foreground/70 mt-0.5">{formatDateTime(n.created_at)}</div>
                    </div>
                  </DropdownMenuItem>
                ))
              )}
            </div>
          </DropdownMenuContent>
        </DropdownMenu>

        {profile && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-2 px-2 py-1 rounded-lg hover:bg-muted transition-colors">
                <div className={cn('w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold', getAvatarColor(profile.full_name))}>
                  {getInitials(profile.full_name)}
                </div>
                <div className="text-left hidden sm:block">
                  <div className="text-xs font-medium leading-tight">{profile.full_name}</div>
                  <div className="text-[10px] text-muted-foreground capitalize">{profile.role}</div>
                </div>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem asChild>
                <Link href="/profile" className="cursor-pointer">Mon profil</Link>
              </DropdownMenuItem>
              {profile.role === 'admin' && (
                <DropdownMenuItem asChild>
                  <Link href="/settings" className="cursor-pointer">Paramètres</Link>
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </header>
  );
}
