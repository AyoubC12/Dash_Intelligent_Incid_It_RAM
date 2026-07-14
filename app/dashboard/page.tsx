'use client';

import { AppLayout } from '@/components/layout/app-layout';
import { useAuth } from '@/lib/auth-context';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { Incident, Profile } from '@/lib/supabase';
import {
  AlertTriangle, CheckCircle2, Clock, Users, TrendingUp,
  ShieldAlert, Wifi, Activity, ArrowUp, ArrowDown,
  Brain, Lightbulb, ChevronRight, BarChart2,
} from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer,
} from 'recharts';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { PRIORITY_LABELS, STATUS_LABELS, formatDuration } from '@/lib/constants';

interface KPIData {
  totalIncidents: number;
  openIncidents: number;
  resolvedIncidents: number;
  criticalIncidents: number;
  avgResolutionHours: number;
  resolutionRate: number;
  totalUsers: number;
  activeTechnicians: number;
}

interface ChartData {
  monthlyTrend: Array<{ month: string; incidents: number; resolved: number }>;
  byCategory: Array<{ name: string; value: number; color: string }>;
  byPriority: Array<{ name: string; value: number; color: string }>;
  byStatus: Array<{ name: string; value: number; color: string }>;
  byDepartment: Array<{ name: string; incidents: number }>;
  byTechnician: Array<{ name: string; resolved: number; avg_hours: number }>;
}

interface AIInsight {
  type: 'warning' | 'info' | 'success' | 'tip';
  title: string;
  message: string;
  icon: React.ReactNode;
}

const MONTHS_FR = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'];

export default function DashboardPage() {
  const { profile } = useAuth();
  const [kpi, setKpi] = useState<KPIData | null>(null);
  const [charts, setCharts] = useState<ChartData | null>(null);
  const [recentIncidents, setRecentIncidents] = useState<Incident[]>([]);
  const [insights, setInsights] = useState<AIInsight[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    const [incidentsRes, profilesRes] = await Promise.all([
      supabase.from('incidents').select('*, categories(name, color), departments(name)').order('created_at', { ascending: false }),
      supabase.from('profiles').select('*'),
    ]);

    const incidents: Incident[] = incidentsRes.data ?? [];
    const profiles: Profile[] = profilesRes.data ?? [];

    // Attach reporter/assignee profiles (FK points to auth.users, not profiles)
    const profileMap = Object.fromEntries(profiles.map(p => [p.id, p]));
    incidents.forEach(inc => {
      (inc as unknown as { reporter: Profile | null; assignee: Profile | null }).reporter = profileMap[inc.reporter_id] ?? null;
      (inc as unknown as { reporter: Profile | null; assignee: Profile | null }).assignee = inc.assignee_id ? (profileMap[inc.assignee_id] ?? null) : null;
    });

    // KPIs
    const openIncidents = incidents.filter(i => ['new', 'in_progress', 'pending'].includes(i.status));
    const resolvedIncidents = incidents.filter(i => ['resolved', 'closed'].includes(i.status));
    const criticalIncidents = incidents.filter(i => i.priority === 'critical' && i.status !== 'closed');

    const resolved = incidents.filter(i => i.resolved_at && i.created_at);
    const avgResHours = resolved.length > 0
      ? resolved.reduce((sum, i) => {
          const diff = new Date(i.resolved_at!).getTime() - new Date(i.created_at).getTime();
          return sum + diff / 3600000;
        }, 0) / resolved.length
      : 0;

    const technicians = profiles.filter(p => p.role === 'technician' && p.is_active);

    setKpi({
      totalIncidents: incidents.length,
      openIncidents: openIncidents.length,
      resolvedIncidents: resolvedIncidents.length,
      criticalIncidents: criticalIncidents.length,
      avgResolutionHours: avgResHours,
      resolutionRate: incidents.length > 0 ? Math.round((resolvedIncidents.length / incidents.length) * 100) : 0,
      totalUsers: profiles.filter(p => p.is_active).length,
      activeTechnicians: technicians.length,
    });

    // Monthly trend (last 6 months)
    const monthlyMap = new Map<string, { incidents: number; resolved: number }>();
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const key = MONTHS_FR[d.getMonth()];
      monthlyMap.set(key, { incidents: 0, resolved: 0 });
    }
    incidents.forEach(inc => {
      const d = new Date(inc.created_at);
      const now = new Date();
      const diffMonths = (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth());
      if (diffMonths >= 0 && diffMonths < 6) {
        const key = MONTHS_FR[d.getMonth()];
        const existing = monthlyMap.get(key);
        if (existing) {
          existing.incidents++;
          if (['resolved', 'closed'].includes(inc.status)) existing.resolved++;
        }
      }
    });
    const monthlyTrend = Array.from(monthlyMap.entries()).map(([month, data]) => ({ month, ...data }));

    // By category
    const catMap = new Map<string, { count: number; color: string }>();
    incidents.forEach(inc => {
      if (inc.categories) {
        const k = inc.categories.name;
        const prev = catMap.get(k) ?? { count: 0, color: inc.categories.color };
        catMap.set(k, { count: prev.count + 1, color: prev.color });
      }
    });
    const byCategory = Array.from(catMap.entries())
      .map(([name, { count, color }]) => ({ name, value: count, color }))
      .sort((a, b) => b.value - a.value).slice(0, 6);

    // By priority
    const priorityColors = { low: '#94a3b8', medium: '#E31836', high: '#f97316', critical: '#dc2626' };
    const byPriority = (['low', 'medium', 'high', 'critical'] as const).map(p => ({
      name: PRIORITY_LABELS[p],
      value: incidents.filter(i => i.priority === p).length,
      color: priorityColors[p],
    }));

    // By status
    const statusColors = { new: '#E31836', in_progress: '#f59e0b', pending: '#f97316', resolved: '#10b981', closed: '#94a3b8' };
    const byStatus = (['new', 'in_progress', 'pending', 'resolved', 'closed'] as const).map(s => ({
      name: STATUS_LABELS[s],
      value: incidents.filter(i => i.status === s).length,
      color: statusColors[s],
    }));

    // By department
    const deptMap = new Map<string, number>();
    incidents.forEach(inc => {
      if (inc.departments) {
        deptMap.set(inc.departments.name, (deptMap.get(inc.departments.name) ?? 0) + 1);
      }
    });
    const byDepartment = Array.from(deptMap.entries())
      .map(([name, incidents]) => ({ name, incidents }))
      .sort((a, b) => b.incidents - a.incidents).slice(0, 8);

    // By technician
    const techMap = new Map<string, { resolved: number; totalHours: number }>();
    incidents.forEach(inc => {
      if (inc.assignee && ['resolved', 'closed'].includes(inc.status)) {
        const name = (inc.assignee as Profile).full_name;
        const prev = techMap.get(name) ?? { resolved: 0, totalHours: 0 };
        const hours = inc.resolved_at
          ? (new Date(inc.resolved_at).getTime() - new Date(inc.created_at).getTime()) / 3600000
          : 0;
        techMap.set(name, { resolved: prev.resolved + 1, totalHours: prev.totalHours + hours });
      }
    });
    const byTechnician = Array.from(techMap.entries())
      .map(([name, { resolved, totalHours }]) => ({
        name: name.split(' ')[0],
        resolved,
        avg_hours: resolved > 0 ? Math.round(totalHours / resolved) : 0,
      }))
      .sort((a, b) => b.resolved - a.resolved).slice(0, 6);

    setCharts({ monthlyTrend, byCategory, byPriority, byStatus, byDepartment, byTechnician });
    setRecentIncidents(incidents.slice(0, 5));

    // AI Insights
    generateInsights(incidents, profiles, byDepartment, byTechnician, avgResHours, criticalIncidents.length);
    setLoading(false);
  };

  const generateInsights = (
    incidents: Incident[],
    profiles: Profile[],
    byDept: Array<{ name: string; incidents: number }>,
    byTech: Array<{ name: string; resolved: number; avg_hours: number }>,
    avgHours: number,
    critCount: number,
  ) => {
    const newInsights: AIInsight[] = [];

    if (byDept[0] && incidents.length > 0) {
      const pct = Math.round((byDept[0].incidents / incidents.length) * 100);
      if (pct >= 25) {
        newInsights.push({
          type: 'warning',
          title: `Département ${byDept[0].name} — Concentration élevée`,
          message: `Le département ${byDept[0].name} génère ${pct}% des incidents. Une intervention préventive est recommandée.`,
          icon: <AlertTriangle className="w-4 h-4" />,
        });
      }
    }

    if (byTech[0] && byTech[0].avg_hours < avgHours * 0.6) {
      newInsights.push({
        type: 'success',
        title: `${byTech[0].name} — Technicien le plus performant`,
        message: `${byTech[0].name} résout les incidents ${Math.round((1 - byTech[0].avg_hours / avgHours) * 100)}% plus rapidement que la moyenne. Partagez ses méthodes.`,
        icon: <TrendingUp className="w-4 h-4" />,
      });
    }

    if (critCount >= 3) {
      newInsights.push({
        type: 'warning',
        title: 'Incidents critiques actifs',
        message: `${critCount} incidents critiques sont en attente de résolution. Vérifiez les SLA pour éviter les violations.`,
        icon: <ShieldAlert className="w-4 h-4" />,
      });
    }

    const networkInc = incidents.filter(i => i.categories?.name === 'Réseau' && !['resolved', 'closed'].includes(i.status));
    if (networkInc.length >= 2) {
      newInsights.push({
        type: 'info',
        title: 'Incidents réseau récurrents',
        message: `${networkInc.length} incidents réseau actifs détectés. Planifier un audit de l'infrastructure réseau.`,
        icon: <Wifi className="w-4 h-4" />,
      });
    }

    const thisWeek = incidents.filter(i => {
      const d = new Date(i.created_at);
      const now = new Date();
      return (now.getTime() - d.getTime()) < 7 * 24 * 3600000;
    });
    if (thisWeek.length > incidents.length * 0.4 && incidents.length > 5) {
      newInsights.push({
        type: 'tip',
        title: 'Pic d\'incidents cette semaine',
        message: `${thisWeek.length} incidents ont été créés cette semaine (${Math.round(thisWeek.length / incidents.length * 100)}% du total). Analysez les causes racines.`,
        icon: <Activity className="w-4 h-4" />,
      });
    }

    if (newInsights.length === 0) {
      newInsights.push({
        type: 'success',
        title: 'Situation stable',
        message: 'Aucune anomalie détectée. Les indicateurs IT sont dans les normes. Continuez à monitorer.',
        icon: <CheckCircle2 className="w-4 h-4" />,
      });
    }

    setInsights(newInsights);
  };

  const insightStyle: Record<string, string> = {
    warning: 'bg-amber-50 border-amber-200 dark:bg-amber-900/10 dark:border-amber-800 text-amber-700 dark:text-amber-400',
    info: 'bg-blue-50 border-blue-200 dark:bg-blue-900/10 dark:border-blue-800 text-blue-700 dark:text-blue-400',
    success: 'bg-emerald-50 border-emerald-200 dark:bg-emerald-900/10 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400',
    tip: 'bg-purple-50 border-purple-200 dark:bg-purple-900/10 dark:border-purple-800 text-purple-700 dark:text-purple-400',
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      </AppLayout>
    );
  }

  const priorityColors = { low: '#94a3b8', medium: '#E31836', high: '#f97316', critical: '#dc2626' };

  return (
    <AppLayout>
      <div className="space-y-6 max-w-[1600px]">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              Bonjour, {profile?.full_name?.split(' ')[0]} 
            </h1>
            <p className="text-muted-foreground text-sm mt-0.5">
              {new Date().toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
          </div>
          <Link href="/incidents/new" className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary/90 transition-colors">
            + Nouvel incident
          </Link>
        </div>

        {/* KPI Cards */}
        {kpi && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <KpiCard
              title="Total Incidents"
              value={kpi.totalIncidents}
              icon={<BarChart2 className="w-5 h-5" />}
              color="red"
            />
            <KpiCard
              title="Incidents Ouverts"
              value={kpi.openIncidents}
              icon={<AlertTriangle className="w-5 h-5" />}
              color="amber"
              trend={kpi.openIncidents > 5 ? 'up' : 'neutral'}
            />
            <KpiCard
              title="Résolus"
              value={kpi.resolvedIncidents}
              icon={<CheckCircle2 className="w-5 h-5" />}
              color="emerald"
              subtitle={`Taux: ${kpi.resolutionRate}%`}
            />
            <KpiCard
              title="Critiques"
              value={kpi.criticalIncidents}
              icon={<ShieldAlert className="w-5 h-5" />}
              color="red"
              trend={kpi.criticalIncidents > 0 ? 'up' : 'neutral'}
            />
            <KpiCard
              title="Délai Moyen"
              value={formatDuration(kpi.avgResolutionHours)}
              icon={<Clock className="w-5 h-5" />}
              color="purple"
              isString
            />
            <KpiCard
              title="Taux Résolution"
              value={`${kpi.resolutionRate}%`}
              icon={<TrendingUp className="w-5 h-5" />}
              color="teal"
              isString
            />
            <KpiCard
              title="Utilisateurs"
              value={kpi.totalUsers}
              icon={<Users className="w-5 h-5" />}
              color="indigo"
            />
            <KpiCard
              title="Techniciens Actifs"
              value={kpi.activeTechnicians}
              icon={<Activity className="w-5 h-5" />}
              color="cyan"
            />
          </div>
        )}

        {/* Charts Row 1 */}
        {charts && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Monthly Trend */}
            <div className="lg:col-span-2 bg-card border border-border rounded-xl p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-semibold text-sm">Evolution des incidents</h3>
                  <p className="text-muted-foreground text-xs mt-0.5">6 derniers mois</p>
                </div>
              </div>
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={charts.monthlyTrend}>
                  <defs>
                    <linearGradient id="colorIncidents" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#E31836" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#E31836" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorResolved" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Area type="monotone" dataKey="incidents" name="Créés" stroke="#E31836" fill="url(#colorIncidents)" strokeWidth={2} />
                  <Area type="monotone" dataKey="resolved" name="Résolus" stroke="#10b981" fill="url(#colorResolved)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* By Status */}
            <div className="bg-card border border-border rounded-xl p-5">
              <h3 className="font-semibold text-sm mb-4">Par statut</h3>
              <ResponsiveContainer width="100%" height={170}>
                <PieChart>
                  <Pie data={charts.byStatus.filter(s => s.value > 0)} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={45} outerRadius={75}>
                    {charts.byStatus.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                  </Pie>
                  <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-1 mt-2">
                {charts.byStatus.filter(s => s.value > 0).map(s => (
                  <div key={s.name} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full" style={{ background: s.color }} />
                      <span className="text-muted-foreground">{s.name}</span>
                    </div>
                    <span className="font-medium">{s.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Charts Row 2 */}
        {charts && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* By Department */}
            <div className="bg-card border border-border rounded-xl p-5">
              <h3 className="font-semibold text-sm mb-4">Incidents par département</h3>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={charts.byDepartment} layout="vertical" margin={{ left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={80} />
                  <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }} />
                  <Bar dataKey="incidents" name="Incidents" fill="#E31836" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* By Category */}
            <div className="bg-card border border-border rounded-xl p-5">
              <h3 className="font-semibold text-sm mb-4">Incidents par catégorie</h3>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={charts.byCategory}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }} />
                  <Bar dataKey="value" name="Incidents" radius={[4, 4, 0, 0]}>
                    {charts.byCategory.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Bottom Row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* AI Insights */}
          <div className="bg-card border border-border rounded-xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-7 h-7 bg-gradient-to-br from-blue-500 to-violet-600 rounded-lg flex items-center justify-center">
                <Brain className="w-4 h-4 text-white" />
              </div>
              <div>
                <h3 className="font-semibold text-sm">Intelligence IA</h3>
                <p className="text-muted-foreground text-[10px]">Recommandations automatiques</p>
              </div>
            </div>
            <div className="space-y-3">
              {insights.map((insight, i) => (
                <div key={i} className={cn('border rounded-lg p-3 text-xs', insightStyle[insight.type])}>
                  <div className="flex items-center gap-1.5 font-semibold mb-1">
                    {insight.icon}
                    {insight.title}
                  </div>
                  <p className="opacity-90 leading-relaxed">{insight.message}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Recent Incidents */}
          <div className="lg:col-span-2 bg-card border border-border rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-sm">Incidents récents</h3>
              <Link href="/incidents" className="text-xs text-primary hover:underline flex items-center gap-1">
                Voir tout <ChevronRight className="w-3 h-3" />
              </Link>
            </div>
            <div className="space-y-2">
              {recentIncidents.length === 0 ? (
                <p className="text-muted-foreground text-sm text-center py-8">Aucun incident enregistré</p>
              ) : (
                recentIncidents.map(inc => (
                  <Link
                    key={inc.id}
                    href={`/incidents/${inc.id}`}
                    className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors group"
                  >
                    <div className={cn('w-2 h-2 rounded-full flex-shrink-0',
                      inc.priority === 'critical' ? 'bg-red-500' :
                      inc.priority === 'high' ? 'bg-orange-500' :
                      inc.priority === 'medium' ? 'bg-blue-500' : 'bg-slate-400'
                    )} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground font-mono">#{inc.number}</span>
                        <span className="text-sm font-medium truncate group-hover:text-primary transition-colors">{inc.title}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        {inc.categories && (
                          <span className="text-[10px] text-muted-foreground">{inc.categories.name}</span>
                        )}
                        {inc.departments && (
                          <>
                            <span className="text-[10px] text-muted-foreground/50">•</span>
                            <span className="text-[10px] text-muted-foreground">{inc.departments.name}</span>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className={cn('text-[10px] px-2 py-0.5 rounded-full font-medium',
                        inc.status === 'new' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                        inc.status === 'in_progress' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' :
                        inc.status === 'resolved' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' :
                        'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
                      )}>
                        {STATUS_LABELS[inc.status]}
                      </span>
                    </div>
                  </Link>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Technician Performance */}
        {charts && charts.byTechnician.length > 0 && (
          <div className="bg-card border border-border rounded-xl p-5">
            <h3 className="font-semibold text-sm mb-4">Performance des techniciens</h3>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={charts.byTechnician}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis yAxisId="left" tick={{ fontSize: 11 }} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} />
                <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar yAxisId="left" dataKey="resolved" name="Résolus" fill="#10b981" radius={[4, 4, 0, 0]} />
                <Bar yAxisId="right" dataKey="avg_hours" name="Délai moy. (h)" fill="#E31836" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </AppLayout>
  );
}

interface KpiCardProps {
  title: string;
  value: number | string;
  icon: React.ReactNode;
  color: string;
  subtitle?: string;
  trend?: 'up' | 'down' | 'neutral';
  isString?: boolean;
}

const colorMap: Record<string, { bg: string; icon: string; text: string }> = {
  blue: { bg: 'bg-red-50 dark:bg-red-900/20', icon: 'text-red-600 dark:text-red-400', text: 'text-red-600' },
  amber: { bg: 'bg-amber-50 dark:bg-amber-900/20', icon: 'text-amber-600 dark:text-amber-400', text: 'text-amber-600' },
  emerald: { bg: 'bg-emerald-50 dark:bg-emerald-900/20', icon: 'text-emerald-600 dark:text-emerald-400', text: 'text-emerald-600' },
  red: { bg: 'bg-red-50 dark:bg-red-900/20', icon: 'text-red-600 dark:text-red-400', text: 'text-red-600' },
  purple: { bg: 'bg-purple-50 dark:bg-purple-900/20', icon: 'text-purple-600 dark:text-purple-400', text: 'text-purple-600' },
  teal: { bg: 'bg-teal-50 dark:bg-teal-900/20', icon: 'text-teal-600 dark:text-teal-400', text: 'text-teal-600' },
  indigo: { bg: 'bg-indigo-50 dark:bg-indigo-900/20', icon: 'text-indigo-600 dark:text-indigo-400', text: 'text-indigo-600' },
  cyan: { bg: 'bg-cyan-50 dark:bg-cyan-900/20', icon: 'text-cyan-600 dark:text-cyan-400', text: 'text-cyan-600' },
};

function KpiCard({ title, value, icon, color, subtitle, trend }: KpiCardProps) {
  const c = colorMap[color] ?? colorMap.blue;
  return (
    <div className="bg-card border border-border rounded-xl p-4 hover:shadow-sm transition-shadow">
      <div className="flex items-start justify-between">
        <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center', c.bg)}>
          <span className={c.icon}>{icon}</span>
        </div>
        {trend === 'up' && <ArrowUp className="w-3.5 h-3.5 text-red-500" />}
        {trend === 'down' && <ArrowDown className="w-3.5 h-3.5 text-emerald-500" />}
      </div>
      <div className="mt-3">
        <div className="text-2xl font-bold text-foreground">{value}</div>
        <div className="text-xs text-muted-foreground mt-0.5">{title}</div>
        {subtitle && <div className={cn('text-xs mt-0.5 font-medium', c.text)}>{subtitle}</div>}
      </div>
    </div>
  );
}
