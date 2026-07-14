'use client';

import { useState, useEffect } from 'react';
import { AppLayout } from '@/components/layout/app-layout';
import { supabase } from '@/lib/supabase';
import type { Incident, Category, Department, Profile } from '@/lib/supabase';
import { STATUS_LABELS, PRIORITY_LABELS, STATUS_COLORS, PRIORITY_COLORS, formatDateTime } from '@/lib/constants';
import { useAuth } from '@/lib/auth-context';
import {
  Search, Filter, Plus, ChevronRight, ChevronLeft,
  AlertTriangle, CheckCircle2, Clock, Eye,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import Link from 'next/link';

const PAGE_SIZE = 15;

export default function IncidentsPage() {
  const { profile } = useAuth();
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterPriority, setFilterPriority] = useState('');
  const [filterDept, setFilterDept] = useState('');
  const [filterCat, setFilterCat] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  const [departments, setDepartments] = useState<Department[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);

  useEffect(() => {
    Promise.all([
      supabase.from('departments').select('*').order('name'),
      supabase.from('categories').select('*').order('name'),
    ]).then(([dRes, cRes]) => {
      setDepartments(dRes.data ?? []);
      setCategories(cRes.data ?? []);
    });
  }, []);

  useEffect(() => {
    loadIncidents();
  }, [page, filterStatus, filterPriority, filterDept, filterCat, search]);

  const loadIncidents = async () => {
    setLoading(true);
    let query = supabase
      .from('incidents')
      .select('*, categories(name, color), departments(name)', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

    if (filterStatus) query = query.eq('status', filterStatus);
    if (filterPriority) query = query.eq('priority', filterPriority);
    if (filterDept) query = query.eq('department_id', filterDept);
    if (filterCat) query = query.eq('category_id', filterCat);
    if (search) query = query.or(`title.ilike.%${search}%,description.ilike.%${search}%`);

    // Role-based filtering
    if (profile?.role === 'employee') {
      query = query.eq('reporter_id', profile.id);
    } else if (profile?.role === 'technician') {
      query = query.or(`reporter_id.eq.${profile?.id},assignee_id.eq.${profile?.id}`);
    }

    const { data, count } = await query;

    // Fetch reporter/assignee profiles separately (FK points to auth.users, not profiles)
    if (data && data.length > 0) {
      const profileIds = Array.from(new Set(
        data.flatMap(d => [d.reporter_id, d.assignee_id].filter(Boolean))
      )) as string[];
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .in('id', profileIds);
      const profileMap = Object.fromEntries((profilesData ?? []).map(p => [p.id, p]));
      (data as unknown as (typeof data[0] & { reporter: Profile | null; assignee: Profile | null })[]).forEach(d => {
        d.reporter = profileMap[d.reporter_id] ?? null;
        d.assignee = d.assignee_id ? (profileMap[d.assignee_id] ?? null) : null;
      });
    }

    setIncidents(data ?? []);
    setTotal(count ?? 0);
    setLoading(false);
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);

  const statusCounts = {
    new: incidents.filter(i => i.status === 'new').length,
    in_progress: incidents.filter(i => i.status === 'in_progress').length,
    resolved: incidents.filter(i => ['resolved', 'closed'].includes(i.status)).length,
    critical: incidents.filter(i => i.priority === 'critical').length,
  };

  return (
    <AppLayout>
      <div className="space-y-5 max-w-[1400px]">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-foreground">Incidents</h1>
            <p className="text-muted-foreground text-sm">{total} incident{total !== 1 ? 's' : ''} au total</p>
          </div>
          <Link href="/incidents/new">
            <Button size="sm" className="gap-2">
              <Plus className="w-4 h-4" /> Nouvel incident
            </Button>
          </Link>
        </div>

        {/* Quick stats */}
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: 'Nouveaux', value: statusCounts.new, color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-900/20' },
            { label: 'En cours', value: statusCounts.in_progress, color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-900/20' },
            { label: 'Résolus', value: statusCounts.resolved, color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-900/20' },
            { label: 'Critiques', value: statusCounts.critical, color: 'text-red-600', bg: 'bg-red-50 dark:bg-red-900/20' },
          ].map(s => (
            <div key={s.label} className={cn('rounded-lg p-3 flex items-center gap-3', s.bg)}>
              <div className={cn('text-2xl font-bold', s.color)}>{s.value}</div>
              <div className="text-xs text-muted-foreground">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Search & Filters */}
        <div className="bg-card border border-border rounded-xl">
          <div className="flex items-center gap-3 p-3 border-b border-border">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher par titre, description…"
                className="pl-9 h-8 bg-muted/30 border-0"
                value={search}
                onChange={e => { setSearch(e.target.value); setPage(0); }}
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              className="gap-2 h-8"
              onClick={() => setShowFilters(!showFilters)}
            >
              <Filter className="w-3.5 h-3.5" />
              Filtres
              {(filterStatus || filterPriority || filterDept || filterCat) && (
                <span className="w-4 h-4 bg-primary text-white text-[10px] rounded-full flex items-center justify-center">
                  {[filterStatus, filterPriority, filterDept, filterCat].filter(Boolean).length}
                </span>
              )}
            </Button>
          </div>

          {showFilters && (
            <div className="p-3 border-b border-border bg-muted/20 grid grid-cols-2 md:grid-cols-4 gap-3">
              <select
                className="h-8 text-xs rounded-lg border border-border bg-background px-2"
                value={filterStatus}
                onChange={e => { setFilterStatus(e.target.value); setPage(0); }}
              >
                <option value="">Tous les statuts</option>
                {Object.entries(STATUS_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
              <select
                className="h-8 text-xs rounded-lg border border-border bg-background px-2"
                value={filterPriority}
                onChange={e => { setFilterPriority(e.target.value); setPage(0); }}
              >
                <option value="">Toutes priorités</option>
                {Object.entries(PRIORITY_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
              <select
                className="h-8 text-xs rounded-lg border border-border bg-background px-2"
                value={filterDept}
                onChange={e => { setFilterDept(e.target.value); setPage(0); }}
              >
                <option value="">Tous départements</option>
                {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
              <select
                className="h-8 text-xs rounded-lg border border-border bg-background px-2"
                value={filterCat}
                onChange={e => { setFilterCat(e.target.value); setPage(0); }}
              >
                <option value="">Toutes catégories</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          )}

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground">#</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground">Titre</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground hidden md:table-cell">Catégorie</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground hidden lg:table-cell">Département</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground">Priorité</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground">Statut</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground hidden xl:table-cell">Créé le</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground hidden xl:table-cell">Assigné à</th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={9} className="text-center py-12 text-muted-foreground">
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                      Chargement…
                    </div>
                  </td></tr>
                ) : incidents.length === 0 ? (
                  <tr><td colSpan={9} className="text-center py-12 text-muted-foreground">
                    <AlertTriangle className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    <div>Aucun incident trouvé</div>
                  </td></tr>
                ) : (
                  incidents.map(inc => (
                    <tr key={inc.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">#{inc.number}</td>
                      <td className="px-4 py-3">
                        <Link href={`/incidents/${inc.id}`} className="font-medium hover:text-primary transition-colors line-clamp-1">
                          {inc.title}
                        </Link>
                        <div className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{inc.description}</div>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        {inc.categories && (
                          <span className="flex items-center gap-1.5 text-xs">
                            <span className="w-2 h-2 rounded-full" style={{ background: inc.categories.color }} />
                            {inc.categories.name}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell text-xs text-muted-foreground">
                        {inc.departments?.name ?? '—'}
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn('text-[10px] px-2 py-0.5 rounded-full font-medium', PRIORITY_COLORS[inc.priority])}>
                          {PRIORITY_LABELS[inc.priority]}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn('text-[10px] px-2 py-0.5 rounded-full font-medium', STATUS_COLORS[inc.status])}>
                          {STATUS_LABELS[inc.status]}
                        </span>
                      </td>
                      <td className="px-4 py-3 hidden xl:table-cell text-xs text-muted-foreground whitespace-nowrap">
                        {formatDateTime(inc.created_at)}
                      </td>
                      <td className="px-4 py-3 hidden xl:table-cell text-xs text-muted-foreground">
                        {inc.assignee ? (inc.assignee as Profile).full_name : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <Link href={`/incidents/${inc.id}`}>
                          <Button variant="ghost" size="icon" className="h-7 w-7">
                            <Eye className="w-3.5 h-3.5" />
                          </Button>
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-border">
              <span className="text-xs text-muted-foreground">
                Page {page + 1} sur {totalPages} — {total} résultats
              </span>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" className="h-7 w-7 p-0" onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}>
                  <ChevronLeft className="w-3.5 h-3.5" />
                </Button>
                <Button variant="outline" size="sm" className="h-7 w-7 p-0" onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}>
                  <ChevronRight className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
