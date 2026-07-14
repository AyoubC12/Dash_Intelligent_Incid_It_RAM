'use client';

import { useState, useEffect } from 'react';
import { AppLayout } from '@/components/layout/app-layout';
import { supabase } from '@/lib/supabase';
import type { Incident, Profile, Department } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';
import { BarChart2, Download, FileText, Calendar, Building2, User, ShieldAlert, Clock } from 'lucide-react';
import { STATUS_LABELS, PRIORITY_LABELS, formatDateTime, formatDuration } from '@/lib/constants';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts';
import { cn } from '@/lib/utils';

type ReportType = 'monthly' | 'annual' | 'department' | 'technician' | 'sla' | 'critical';

export default function ReportsPage() {
  const { profile } = useAuth();
  const [activeReport, setActiveReport] = useState<ReportType>('monthly');
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      supabase.from('incidents').select('*, categories(name), departments(name)').order('created_at', { ascending: false }),
      supabase.from('profiles').select('*'),
      supabase.from('departments').select('*'),
    ]).then(([iRes, pRes, dRes]) => {
      const incs = iRes.data ?? [];
      const profs = pRes.data ?? [];
      // Attach reporter/assignee profiles
      const profileMap = Object.fromEntries(profs.map(p => [p.id, p]));
      incs.forEach(inc => {
        (inc as unknown as { reporter: Profile | null; assignee: Profile | null }).reporter = profileMap[inc.reporter_id] ?? null;
        (inc as unknown as { reporter: Profile | null; assignee: Profile | null }).assignee = inc.assignee_id ? (profileMap[inc.assignee_id] ?? null) : null;
      });
      setIncidents(incs);
      setProfiles(profs);
      setDepartments(dRes.data ?? []);
      setLoading(false);
    });
  }, []);

  if (profile?.role === 'employee') {
    return <AppLayout><div className="text-center py-16 text-muted-foreground">Accès non autorisé</div></AppLayout>;
  }

  const exportCSV = () => {
    const headers = ['Numéro', 'Titre', 'Statut', 'Priorité', 'Catégorie', 'Département', 'Déclarant', 'Assigné', 'Créé le', 'Résolu le'];
    const rows = incidents.map(i => [
      `#${i.number}`, i.title, STATUS_LABELS[i.status], PRIORITY_LABELS[i.priority],
      (i.categories as { name: string } | null)?.name ?? '',
      (i.departments as { name: string } | null)?.name ?? '',
      (i.reporter as Profile)?.full_name ?? '',
      (i.assignee as Profile)?.full_name ?? '',
      formatDateTime(i.created_at),
      formatDateTime(i.resolved_at),
    ]);
    const csv = [headers, ...rows].map(r => r.map(c => `"${c}"`).join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'incidents_ram_handling.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  const reportTypes = [
    { key: 'monthly', label: 'Mensuel', icon: <Calendar className="w-4 h-4" /> },
    { key: 'annual', label: 'Annuel', icon: <BarChart2 className="w-4 h-4" /> },
    { key: 'department', label: 'Par département', icon: <Building2 className="w-4 h-4" /> },
    { key: 'technician', label: 'Par technicien', icon: <User className="w-4 h-4" /> },
    { key: 'sla', label: 'SLA', icon: <Clock className="w-4 h-4" /> },
    { key: 'critical', label: 'Incidents critiques', icon: <ShieldAlert className="w-4 h-4" /> },
  ];

  // Monthly data
  const MONTHS_FR = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'];
  const now = new Date();

  const monthlyData = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
    const month = MONTHS_FR[d.getMonth()];
    const monthIncs = incidents.filter(inc => {
      const id = new Date(inc.created_at);
      return id.getMonth() === d.getMonth() && id.getFullYear() === d.getFullYear();
    });
    return {
      month,
      total: monthIncs.length,
      resolved: monthIncs.filter(i => ['resolved', 'closed'].includes(i.status)).length,
      critical: monthIncs.filter(i => i.priority === 'critical').length,
    };
  });

  const annualData = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(now.getFullYear(), i, 1);
    const monthIncs = incidents.filter(inc => {
      const id = new Date(inc.created_at);
      return id.getMonth() === i && id.getFullYear() === now.getFullYear();
    });
    return { month: MONTHS_FR[i], total: monthIncs.length };
  });

  const deptData = departments.map(dept => ({
    name: dept.name,
    total: incidents.filter(i => (i.departments as { name: string } | null)?.name === dept.name).length,
  })).filter(d => d.total > 0).sort((a, b) => b.total - a.total);

  const techData = profiles.filter(p => p.role === 'technician').map(tech => {
    const assigned = incidents.filter(i => (i.assignee as Profile)?.full_name === tech.full_name);
    const resolved = assigned.filter(i => ['resolved', 'closed'].includes(i.status));
    const avgHours = resolved.length > 0
      ? resolved.reduce((sum, i) => {
          if (!i.resolved_at) return sum;
          return sum + (new Date(i.resolved_at).getTime() - new Date(i.created_at).getTime()) / 3600000;
        }, 0) / resolved.length
      : 0;
    return { name: tech.full_name.split(' ')[0], total: assigned.length, resolved: resolved.length, avg_hours: Math.round(avgHours) };
  }).filter(t => t.total > 0).sort((a, b) => b.resolved - a.resolved);

  const criticalIncs = incidents.filter(i => i.priority === 'critical');
  const slaStats = {
    total: incidents.length,
    breach: incidents.filter(i => i.sla_breach).length,
    ok: incidents.filter(i => !i.sla_breach).length,
  };

  const renderReport = () => {
    if (loading) return <div className="flex justify-center py-12"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>;

    switch (activeReport) {
      case 'monthly':
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: 'Total ce mois', value: monthlyData[5]?.total ?? 0 },
                { label: 'Résolus', value: monthlyData[5]?.resolved ?? 0 },
                { label: 'Critiques', value: monthlyData[5]?.critical ?? 0 },
              ].map(s => (
                <div key={s.label} className="bg-muted/30 rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold">{s.value}</div>
                  <div className="text-xs text-muted-foreground mt-1">{s.label}</div>
                </div>
              ))}
            </div>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }} />
                <Bar dataKey="total" name="Total" fill="#E31836" radius={[4, 4, 0, 0]} />
                <Bar dataKey="resolved" name="Résolus" fill="#10b981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="critical" name="Critiques" fill="#ef4444" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        );

      case 'annual':
        return (
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={annualData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }} />
              <Bar dataKey="total" name="Incidents" fill="#E31836" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        );

      case 'department':
        return (
          <div className="space-y-3">
            {deptData.map(d => (
              <div key={d.name} className="flex items-center gap-4">
                <div className="text-sm w-32 truncate">{d.name}</div>
                <div className="flex-1 bg-muted rounded-full h-3 overflow-hidden">
                  <div className="bg-primary h-full rounded-full transition-all" style={{ width: `${(d.total / (deptData[0]?.total || 1)) * 100}%` }} />
                </div>
                <div className="text-sm font-bold w-8 text-right">{d.total}</div>
              </div>
            ))}
          </div>
        );

      case 'technician':
        return (
          <div className="space-y-3">
            {techData.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">Aucune donnée de technicien disponible</p>
            ) : techData.map((t, i) => (
              <div key={t.name} className="flex items-center gap-4 p-3 bg-muted/30 rounded-lg">
                <div className="text-lg font-bold text-muted-foreground w-6">#{i + 1}</div>
                <div className="flex-1">
                  <div className="font-medium">{t.name}</div>
                  <div className="text-xs text-muted-foreground">{t.total} assignés · {t.resolved} résolus · Délai moy.: {formatDuration(t.avg_hours)}</div>
                </div>
                <div className="text-sm font-bold text-emerald-600">{t.resolved > 0 ? Math.round(t.resolved / t.total * 100) : 0}%</div>
              </div>
            ))}
          </div>
        );

      case 'sla':
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-muted/30 rounded-lg p-4 text-center">
                <div className="text-2xl font-bold">{slaStats.total}</div>
                <div className="text-xs text-muted-foreground mt-1">Total incidents</div>
              </div>
              <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-emerald-600">{slaStats.ok}</div>
                <div className="text-xs text-muted-foreground mt-1">SLA respectés</div>
              </div>
              <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-red-600">{slaStats.breach}</div>
                <div className="text-xs text-muted-foreground mt-1">SLA dépassés</div>
              </div>
            </div>
            <div className="flex gap-2 h-4 rounded-full overflow-hidden">
              <div className="bg-emerald-500 h-full" style={{ width: `${slaStats.total > 0 ? (slaStats.ok / slaStats.total) * 100 : 100}%` }} />
              <div className="bg-red-500 h-full" style={{ width: `${slaStats.total > 0 ? (slaStats.breach / slaStats.total) * 100 : 0}%` }} />
            </div>
            <p className="text-xs text-muted-foreground text-center">
              Taux de conformité SLA : {slaStats.total > 0 ? Math.round((slaStats.ok / slaStats.total) * 100) : 100}%
            </p>
          </div>
        );

      case 'critical':
        return (
          <div className="space-y-2">
            {criticalIncs.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">Aucun incident critique</p>
            ) : criticalIncs.map(i => (
              <div key={i.id} className="flex items-start gap-3 p-3 bg-red-50 dark:bg-red-900/10 rounded-lg border border-red-100 dark:border-red-900/30">
                <div className="w-2 h-2 rounded-full bg-red-500 mt-1.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm">#{i.number} — {i.title}</div>
                  <div className="text-xs text-muted-foreground">
                    {(i.departments as { name: string } | null)?.name ?? '—'} · {STATUS_LABELS[i.status]} · {formatDateTime(i.created_at)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        );
    }
  };

  return (
    <AppLayout>
      <div className="space-y-5 max-w-4xl">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">Rapports & Statistiques</h1>
            <p className="text-muted-foreground text-sm">Analysez les performances IT de RAM Handling</p>
          </div>
          <Button variant="outline" size="sm" className="gap-2" onClick={exportCSV}>
            <Download className="w-4 h-4" /> Exporter CSV
          </Button>
        </div>

        <div className="flex gap-2 flex-wrap">
          {reportTypes.map(r => (
            <button
              key={r.key}
              onClick={() => setActiveReport(r.key as ReportType)}
              className={cn(
                'flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all border',
                activeReport === r.key
                  ? 'bg-primary text-white border-primary'
                  : 'border-border text-muted-foreground hover:border-primary hover:text-primary bg-card'
              )}
            >
              {r.icon} {r.label}
            </button>
          ))}
        </div>

        <div className="bg-card border border-border rounded-xl p-6">
          <h2 className="font-semibold mb-5 flex items-center gap-2">
            <BarChart2 className="w-4 h-4 text-primary" />
            {reportTypes.find(r => r.key === activeReport)?.label}
          </h2>
          {renderReport()}
        </div>

        {/* Summary table */}
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-sm">Résumé des incidents</h3>
            <span className="text-xs text-muted-foreground">{incidents.length} incidents au total</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 text-xs font-semibold text-muted-foreground">Statut</th>
                  <th className="text-right py-2 text-xs font-semibold text-muted-foreground">Nombre</th>
                  <th className="text-right py-2 text-xs font-semibold text-muted-foreground">%</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(STATUS_LABELS).map(([s, l]) => {
                  const count = incidents.filter(i => i.status === s).length;
                  const pct = incidents.length > 0 ? Math.round(count / incidents.length * 100) : 0;
                  return (
                    <tr key={s} className="border-b border-border/50">
                      <td className="py-2">{l}</td>
                      <td className="py-2 text-right font-medium">{count}</td>
                      <td className="py-2 text-right text-muted-foreground">{pct}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
