'use client';

import { useState, useEffect } from 'react';
import { AppLayout } from '@/components/layout/app-layout';
import { supabase } from '@/lib/supabase';
import type { ActivityLog, Profile } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { formatDateTime, getInitials, getAvatarColor } from '@/lib/constants';
import { Input } from '@/components/ui/input';
import { Search, Activity } from 'lucide-react';
import { cn } from '@/lib/utils';

const ACTION_LABELS: Record<string, string> = {
  CREATE_INCIDENT: 'A créé un incident',
  UPDATE_INCIDENT: 'A mis à jour un incident',
  CLOSE_INCIDENT: 'A fermé un incident',
  LOGIN: 'Connexion',
  LOGOUT: 'Déconnexion',
  CREATE_USER: 'A créé un utilisateur',
  UPDATE_USER: 'A modifié un utilisateur',
};

const ACTION_COLORS: Record<string, string> = {
  CREATE_INCIDENT: 'bg-blue-500',
  CLOSE_INCIDENT: 'bg-emerald-500',
  LOGIN: 'bg-slate-400',
  CREATE_USER: 'bg-violet-500',
};

export default function ActivityPage() {
  const { profile } = useAuth();
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    supabase.from('activity_logs')
      .select('*, user:profiles!user_id(full_name, email, role)')
      .order('created_at', { ascending: false })
      .limit(200)
      .then(({ data }) => { setLogs(data ?? []); setLoading(false); });
  }, []);

  const filtered = logs.filter(l => {
    if (!search) return true;
    const user = l.user as Profile;
    return (user?.full_name ?? '').toLowerCase().includes(search.toLowerCase()) ||
      l.action.toLowerCase().includes(search.toLowerCase());
  });

  if (profile?.role !== 'admin') {
    return <AppLayout><div className="text-center py-16 text-muted-foreground">Accès non autorisé</div></AppLayout>;
  }

  return (
    <AppLayout>
      <div className="space-y-5 max-w-3xl">
        <div>
          <h1 className="text-xl font-bold">Journal d&apos;activité</h1>
          <p className="text-muted-foreground text-sm">{logs.length} événements enregistrés</p>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Rechercher dans les journaux…" className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
        </div>

        <div className="bg-card border border-border rounded-xl divide-y divide-border">
          {loading ? (
            <div className="py-12 text-center"><div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" /></div>
          ) : filtered.length === 0 ? (
            <div className="py-12 text-center">
              <Activity className="w-8 h-8 mx-auto mb-2 text-muted-foreground/30" />
              <p className="text-muted-foreground text-sm">Aucun événement</p>
            </div>
          ) : filtered.map(log => {
            const user = log.user as Profile;
            const dotColor = ACTION_COLORS[log.action] ?? 'bg-gray-400';
            return (
              <div key={log.id} className="flex items-start gap-4 px-5 py-4">
                <div className="relative mt-1 flex-shrink-0">
                  {user ? (
                    <div className={cn('w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold', getAvatarColor(user.full_name))}>
                      {getInitials(user.full_name)}
                    </div>
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                      <Activity className="w-4 h-4 text-muted-foreground" />
                    </div>
                  )}
                  <div className={cn('absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-card', dotColor)} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm">
                    <span className="font-medium">{user?.full_name ?? 'Système'}</span>
                    {' '}
                    <span className="text-muted-foreground">{ACTION_LABELS[log.action] ?? log.action.toLowerCase().replace(/_/g, ' ')}</span>
                    {log.entity_id && (
                      <span className="text-muted-foreground text-xs ml-1 font-mono">({log.entity_id.slice(0, 8)}…)</span>
                    )}
                  </div>
                  {log.details && Object.keys(log.details).length > 0 && (
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {JSON.stringify(log.details)}
                    </div>
                  )}
                  <div className="text-xs text-muted-foreground/60 mt-1">{formatDateTime(log.created_at)}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </AppLayout>
  );
}
