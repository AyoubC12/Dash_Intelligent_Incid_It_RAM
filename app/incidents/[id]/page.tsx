'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { AppLayout } from '@/components/layout/app-layout';
import { supabase } from '@/lib/supabase';
import type { Incident, IncidentComment, IncidentHistory, Profile } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { STATUS_LABELS, PRIORITY_LABELS, STATUS_COLORS, PRIORITY_COLORS, formatDateTime, getInitials, getAvatarColor } from '@/lib/constants';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
  ArrowLeft, Clock, User, Building2, Tag, MapPin, Send,
  CheckCircle2, XCircle, RefreshCw, AlertTriangle, Lock,
  MessageSquare, History, Paperclip, Edit3,
} from 'lucide-react';
import Link from 'next/link';

export default function IncidentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { profile } = useAuth();
  const router = useRouter();
  const [incident, setIncident] = useState<Incident | null>(null);
  const [comments, setComments] = useState<IncidentComment[]>([]);
  const [history, setHistory] = useState<IncidentHistory[]>([]);
  const [technicians, setTechnicians] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [commentText, setCommentText] = useState('');
  const [isInternal, setIsInternal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState<'comments' | 'history'>('comments');
  const [editingStatus, setEditingStatus] = useState(false);
  const [editingAssignee, setEditingAssignee] = useState(false);
  const [editingSolution, setEditingSolution] = useState(false);
  const [solutionText, setSolutionText] = useState('');

  useEffect(() => {
    loadAll();
    supabase.from('profiles').select('*').eq('role', 'technician').eq('is_active', true)
      .then(({ data }) => setTechnicians(data ?? []));
  }, [id]);

  const loadAll = async () => {
    // Fetch incident without profile joins (FK points to auth.users, not profiles)
    const { data: incData } = await supabase
      .from('incidents')
      .select('*, categories(name, color, icon), subcategories(name), departments(name)')
      .eq('id', id)
      .maybeSingle();

    if (incData) {
      // Fetch reporter and assignee profiles separately
      const profileIds = [incData.reporter_id, incData.assignee_id].filter(Boolean) as string[];
      const { data: profilesData } = await supabase.from('profiles').select('id, full_name, email, role').in('id', profileIds);
      const profileMap = Object.fromEntries((profilesData ?? []).map(p => [p.id, p]));
      (incData as unknown as { reporter: Profile | null; assignee: Profile | null }).reporter = profileMap[incData.reporter_id] ?? null;
      (incData as unknown as { reporter: Profile | null; assignee: Profile | null }).assignee = incData.assignee_id ? (profileMap[incData.assignee_id] ?? null) : null;
    }

    // Comments: fetch separately then attach author profiles
    const { data: commData } = await supabase
      .from('incident_comments')
      .select('*')
      .eq('incident_id', id)
      .order('created_at');

    if (commData && commData.length > 0) {
      const authorIds = Array.from(new Set(commData.map(c => c.author_id)));
      const { data: authorsData } = await supabase.from('profiles').select('id, full_name, role').in('id', authorIds);
      const authorMap = Object.fromEntries((authorsData ?? []).map(p => [p.id, p]));
      (commData as (typeof commData[0] & { author?: Profile })[]).forEach(c => { (c as { author?: Profile }).author = authorMap[c.author_id] ?? null; });
    }

    // History: fetch separately then attach changer profiles
    const { data: histData } = await supabase
      .from('incident_history')
      .select('*')
      .eq('incident_id', id)
      .order('created_at', { ascending: false });

    if (histData && histData.length > 0) {
      const changerIds = Array.from(new Set(histData.map(h => h.changed_by)));
      const { data: changersData } = await supabase.from('profiles').select('id, full_name').in('id', changerIds);
      const changerMap = Object.fromEntries((changersData ?? []).map(p => [p.id, p]));
      (histData as (typeof histData[0] & { changer?: Profile })[]).forEach(h => { (h as { changer?: Profile }).changer = changerMap[h.changed_by] ?? null; });
    }

    setIncident(incData ?? null);
    setSolutionText(incData?.solution ?? '');
    setComments((commData ?? []) as IncidentComment[]);
    setHistory((histData ?? []) as IncidentHistory[]);
    setLoading(false);
  };

  const canEdit = profile?.role === 'admin' || profile?.role === 'technician' || incident?.reporter_id === profile?.id;
  const canManage = profile?.role === 'admin' || profile?.role === 'technician';

  const updateField = async (field: string, value: string | null, label: string) => {
    if (!incident) return;
    const oldValue = (incident as unknown as Record<string, unknown>)[field] as string;
    const { error } = await supabase.from('incidents').update({ [field]: value, updated_at: new Date().toISOString() }).eq('id', id);
    if (error) { toast.error('Erreur de mise à jour'); return; }

    await supabase.from('incident_history').insert({
      incident_id: id, changed_by: profile!.id,
      field_name: label, old_value: oldValue, new_value: value ?? '',
    });

    if (field === 'status' && incident.reporter_id) {
      await supabase.from('notifications').insert({
        user_id: incident.reporter_id,
        title: 'Statut de votre incident modifié',
        message: `Incident #${incident.number} : ${STATUS_LABELS[oldValue as keyof typeof STATUS_LABELS] ?? oldValue} → ${STATUS_LABELS[value as keyof typeof STATUS_LABELS] ?? value}`,
        type: value === 'resolved' ? 'success' : 'info',
        incident_id: id,
      });
    }

    toast.success('Mis à jour');
    loadAll();
  };

  const submitComment = async () => {
    if (!commentText.trim() || !profile) return;
    setSubmitting(true);
    const { error } = await supabase.from('incident_comments').insert({
      incident_id: id, author_id: profile.id,
      content: commentText.trim(), is_internal: isInternal,
    });
    if (error) { toast.error('Erreur'); } else {
      setCommentText('');
      loadAll();
    }
    setSubmitting(false);
  };

  const saveSolution = async () => {
    await updateField('solution', solutionText, 'Solution');
    setEditingSolution(false);
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

  if (!incident) {
    return (
      <AppLayout>
        <div className="text-center py-16">
          <AlertTriangle className="w-12 h-12 mx-auto mb-3 text-muted-foreground/30" />
          <h2 className="font-semibold">Incident introuvable</h2>
          <Link href="/incidents" className="text-primary text-sm mt-2 inline-block hover:underline">Retour à la liste</Link>
        </div>
      </AppLayout>
    );
  }

  const quickActions = canManage ? [
    { label: 'En cours', status: 'in_progress', icon: <RefreshCw className="w-3.5 h-3.5" />, color: 'amber' },
    { label: 'Résolu', status: 'resolved', icon: <CheckCircle2 className="w-3.5 h-3.5" />, color: 'emerald' },
    { label: 'Fermé', status: 'closed', icon: <Lock className="w-3.5 h-3.5" />, color: 'gray' },
    { label: 'En attente', status: 'pending', icon: <Clock className="w-3.5 h-3.5" />, color: 'orange' },
  ] : [];

  return (
    <AppLayout>
      <div className="max-w-5xl space-y-5">
        {/* Back */}
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-4 h-4" /> Retour
          </button>
          <span className="text-muted-foreground/40">/</span>
          <span className="text-sm text-muted-foreground">Incident #{incident.number}</span>
        </div>

        {/* Header */}
        <div className="bg-card border border-border rounded-xl p-6">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-3 flex-wrap mb-2">
                <span className="font-mono text-sm text-muted-foreground bg-muted px-2 py-0.5 rounded">#{incident.number}</span>
                <span className={cn('text-xs px-2.5 py-1 rounded-full font-medium', STATUS_COLORS[incident.status])}>
                  {STATUS_LABELS[incident.status]}
                </span>
                <span className={cn('text-xs px-2.5 py-1 rounded-full font-medium', PRIORITY_COLORS[incident.priority])}>
                  {PRIORITY_LABELS[incident.priority]}
                </span>
                {incident.sla_breach && (
                  <span className="text-xs px-2.5 py-1 rounded-full bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 font-medium">
                    SLA dépassé
                  </span>
                )}
              </div>
              <h1 className="text-xl font-bold text-foreground">{incident.title}</h1>
              <p className="text-muted-foreground text-sm mt-2 leading-relaxed">{incident.description}</p>
            </div>

            {canManage && (
              <div className="flex flex-wrap gap-2">
                {quickActions.filter(a => a.status !== incident.status).map(a => (
                  <Button
                    key={a.status}
                    size="sm"
                    variant="outline"
                    className="h-8 gap-1.5 text-xs"
                    onClick={() => updateField('status', a.status, 'Statut')}
                  >
                    {a.icon} {a.label}
                  </Button>
                ))}
              </div>
            )}
          </div>

          {/* Meta grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-5 pt-5 border-t border-border">
            <MetaItem icon={<User className="w-3.5 h-3.5" />} label="Déclarant" value={(incident.reporter as Profile)?.full_name ?? '—'} />
            <MetaItem icon={<Building2 className="w-3.5 h-3.5" />} label="Département" value={incident.departments?.name ?? '—'} />
            <MetaItem icon={<Tag className="w-3.5 h-3.5" />} label="Catégorie" value={incident.categories?.name ?? '—'} />
            <MetaItem icon={<MapPin className="w-3.5 h-3.5" />} label="Localisation" value={incident.location ?? '—'} />
            <MetaItem icon={<Clock className="w-3.5 h-3.5" />} label="Créé le" value={formatDateTime(incident.created_at)} />
            <MetaItem icon={<Clock className="w-3.5 h-3.5" />} label="Mis à jour" value={formatDateTime(incident.updated_at)} />
            {incident.resolved_at && <MetaItem icon={<CheckCircle2 className="w-3.5 h-3.5" />} label="Résolu le" value={formatDateTime(incident.resolved_at)} />}
            <div>
              <div className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                <User className="w-3.5 h-3.5" /> Technicien assigné
              </div>
              {canManage && editingAssignee ? (
                <div className="flex items-center gap-2">
                  <select
                    className="text-xs border border-border rounded-lg px-2 py-1 bg-background flex-1"
                    defaultValue={incident.assignee_id ?? ''}
                    onChange={async e => {
                      await updateField('assignee_id', e.target.value || null, 'Technicien');
                      setEditingAssignee(false);
                    }}
                  >
                    <option value="">— Non assigné —</option>
                    {technicians.map(t => <option key={t.id} value={t.id}>{t.full_name}</option>)}
                  </select>
                  <button onClick={() => setEditingAssignee(false)} className="text-xs text-muted-foreground hover:text-foreground">✕</button>
                </div>
              ) : (
                <div className="flex items-center gap-1">
                  <span className="text-sm font-medium">{(incident.assignee as Profile)?.full_name ?? '—'}</span>
                  {canManage && (
                    <button onClick={() => setEditingAssignee(true)} className="text-muted-foreground hover:text-primary ml-1">
                      <Edit3 className="w-3 h-3" />
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Change status */}
          {canManage && (
            <div className="mt-4 pt-4 border-t border-border flex items-center gap-3 flex-wrap">
              <span className="text-xs text-muted-foreground">Changer le statut :</span>
              {Object.entries(STATUS_LABELS).map(([v, l]) => (
                <button
                  key={v}
                  onClick={() => updateField('status', v, 'Statut')}
                  className={cn(
                    'text-xs px-3 py-1 rounded-full border font-medium transition-all',
                    incident.status === v
                      ? cn(STATUS_COLORS[v as keyof typeof STATUS_COLORS], 'border-transparent')
                      : 'border-border text-muted-foreground hover:border-primary hover:text-primary'
                  )}
                >
                  {l}
                </button>
              ))}
              {canManage && (
                <div className="flex items-center gap-2 ml-auto">
                  <span className="text-xs text-muted-foreground">Priorité :</span>
                  <select
                    className="text-xs border border-border rounded-lg px-2 py-1 bg-background"
                    value={incident.priority}
                    onChange={e => updateField('priority', e.target.value, 'Priorité')}
                  >
                    {Object.entries(PRIORITY_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Solution */}
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-sm flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" /> Solution appliquée
            </h3>
            {canManage && !editingSolution && (
              <Button variant="ghost" size="sm" className="h-7 gap-1.5 text-xs" onClick={() => setEditingSolution(true)}>
                <Edit3 className="w-3 h-3" /> Modifier
              </Button>
            )}
          </div>
          {editingSolution ? (
            <div className="space-y-2">
              <Textarea
                value={solutionText}
                onChange={e => setSolutionText(e.target.value)}
                placeholder="Décrivez la solution appliquée…"
                className="text-sm"
                rows={4}
              />
              <div className="flex gap-2">
                <Button size="sm" className="h-7 text-xs" onClick={saveSolution}>Sauvegarder</Button>
                <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => { setEditingSolution(false); setSolutionText(incident.solution ?? ''); }}>Annuler</Button>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground leading-relaxed">
              {incident.solution ?? 'Aucune solution enregistrée pour le moment.'}
            </p>
          )}
        </div>

        {/* Comments & History */}
        <div className="bg-card border border-border rounded-xl">
          <div className="flex border-b border-border">
            {[
              { key: 'comments', label: `Commentaires (${comments.length})`, icon: <MessageSquare className="w-4 h-4" /> },
              { key: 'history', label: `Historique (${history.length})`, icon: <History className="w-4 h-4" /> },
            ].map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as 'comments' | 'history')}
                className={cn(
                  'flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 -mb-px transition-colors',
                  activeTab === tab.key
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                )}
              >
                {tab.icon} {tab.label}
              </button>
            ))}
          </div>

          <div className="p-5">
            {activeTab === 'comments' ? (
              <div className="space-y-4">
                {comments.length === 0 && (
                  <p className="text-muted-foreground text-sm text-center py-4">Aucun commentaire</p>
                )}
                {comments.map(c => {
                  const author = c.author as Profile;
                  return (
                    <div key={c.id} className={cn('flex gap-3', c.is_internal && 'opacity-75')}>
                      <div className={cn('w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0', getAvatarColor(author?.full_name ?? 'U'))}>
                        {getInitials(author?.full_name ?? 'U')}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-medium">{author?.full_name ?? 'Utilisateur'}</span>
                          {c.is_internal && (
                            <span className="text-[10px] bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 px-1.5 py-0.5 rounded font-medium">Interne</span>
                          )}
                          <span className="text-xs text-muted-foreground">{formatDateTime(c.created_at)}</span>
                        </div>
                        <div className="bg-muted/40 rounded-lg p-3 text-sm leading-relaxed">{c.content}</div>
                      </div>
                    </div>
                  );
                })}

                {/* Add comment */}
                <div className="pt-2 border-t border-border">
                  <Textarea
                    value={commentText}
                    onChange={e => setCommentText(e.target.value)}
                    placeholder="Ajouter un commentaire…"
                    className="text-sm"
                    rows={3}
                  />
                  <div className="flex items-center justify-between mt-2">
                    {canManage && (
                      <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
                        <input type="checkbox" checked={isInternal} onChange={e => setIsInternal(e.target.checked)} className="rounded" />
                        Commentaire interne
                      </label>
                    )}
                    <Button size="sm" className="gap-2 h-8 ml-auto" onClick={submitComment} disabled={submitting || !commentText.trim()}>
                      <Send className="w-3.5 h-3.5" /> Envoyer
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {history.length === 0 ? (
                  <p className="text-muted-foreground text-sm text-center py-4">Aucun historique</p>
                ) : (
                  history.map(h => (
                    <div key={h.id} className="flex items-start gap-3 text-sm">
                      <div className="w-1.5 h-1.5 rounded-full bg-primary mt-2 flex-shrink-0" />
                      <div className="flex-1">
                        <span className="font-medium">{(h.changer as Profile)?.full_name ?? '—'}</span>
                        {' a modifié '}
                        <span className="font-medium">{h.field_name}</span>
                        {h.old_value && <> : <span className="text-muted-foreground line-through">{h.old_value}</span></>}
                        {h.new_value && <> → <span className="text-foreground">{h.new_value}</span></>}
                        <div className="text-xs text-muted-foreground mt-0.5">{formatDateTime(h.created_at)}</div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}

function MetaItem({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground mb-1 flex items-center gap-1">{icon} {label}</div>
      <div className="text-sm font-medium">{value}</div>
    </div>
  );
}
