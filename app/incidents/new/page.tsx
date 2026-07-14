'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AppLayout } from '@/components/layout/app-layout';
import { supabase } from '@/lib/supabase';
import type { Category, Department, Subcategory, Profile } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { ArrowLeft, AlertTriangle, Upload, X } from 'lucide-react';
import Link from 'next/link';

const PRIORITY_KEYWORDS: Record<string, string[]> = {
  critical: ['serveur', 'panne totale', 'crash', 'indisponible', 'urgence', 'bloqué', 'arrêt'],
  high: ['lent', 'erreur', 'accès refusé', 'imprimante', 'réseau', 'wifi'],
  medium: ['problème', 'bug', 'mise à jour', 'installation'],
  low: ['question', 'demande', 'information', 'amélioration'],
};

function autoDetectPriority(text: string, dept: string): string {
  const lower = text.toLowerCase();
  for (const [prio, keywords] of Object.entries(PRIORITY_KEYWORDS)) {
    if (keywords.some(k => lower.includes(k))) return prio;
  }
  if (dept === 'Exploitation' || dept === 'Sécurité') return 'high';
  return 'medium';
}

export default function NewIncidentPage() {
  const { profile } = useAuth();
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  const [categories, setCategories] = useState<Category[]>([]);
  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [technicians, setTechnicians] = useState<Profile[]>([]);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [subcategoryId, setSubcategoryId] = useState('');
  const [departmentId, setDepartmentId] = useState(profile?.department_id ?? '');
  const [location, setLocation] = useState(profile?.location ?? '');
  const [priority, setPriority] = useState('medium');
  const [assigneeId, setAssigneeId] = useState('');
  const [autoPriority, setAutoPriority] = useState(true);

  useEffect(() => {
    Promise.all([
      supabase.from('categories').select('*').order('name'),
      supabase.from('departments').select('*').order('name'),
      supabase.from('profiles').select('*').eq('role', 'technician').eq('is_active', true),
    ]).then(([catRes, deptRes, techRes]) => {
      setCategories(catRes.data ?? []);
      setDepartments(deptRes.data ?? []);
      setTechnicians(techRes.data ?? []);
    });
  }, []);

  useEffect(() => {
    if (!categoryId) { setSubcategories([]); return; }
    supabase.from('subcategories').select('*').eq('category_id', categoryId).then(({ data }) => setSubcategories(data ?? []));
  }, [categoryId]);

  useEffect(() => {
    if (!autoPriority) return;
    const dept = departments.find(d => d.id === departmentId);
    const detected = autoDetectPriority(title + ' ' + description, dept?.name ?? '');
    setPriority(detected);
  }, [title, description, departmentId, autoPriority, departments]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    if (!title.trim() || !description.trim()) {
      toast.error('Le titre et la description sont requis');
      return;
    }

    setSubmitting(true);
    const { data, error } = await supabase.from('incidents').insert({
      title: title.trim(),
      description: description.trim(),
      category_id: categoryId || null,
      subcategory_id: subcategoryId || null,
      department_id: departmentId || null,
      location: location || null,
      priority,
      reporter_id: profile.id,
      assignee_id: assigneeId || null,
    }).select().single();

    if (error) {
      toast.error('Erreur lors de la création', { description: error.message });
      setSubmitting(false);
      return;
    }

    // Activity log
    await supabase.from('activity_logs').insert({
      user_id: profile.id,
      action: 'CREATE_INCIDENT',
      entity_type: 'incident',
      entity_id: data.id,
      details: { title, priority },
    });

    // Notify admin
    const { data: admins } = await supabase.from('profiles').select('id').eq('role', 'admin');
    if (admins) {
      await supabase.from('notifications').insert(
        admins.map(a => ({
          user_id: a.id,
          title: 'Nouvel incident créé',
          message: `#${data.number} — ${title}`,
          type: priority === 'critical' ? 'error' : priority === 'high' ? 'warning' : 'info',
          incident_id: data.id,
        }))
      );
    }

    toast.success('Incident créé avec succès', { description: `Incident #${data.number} enregistré.` });
    router.push(`/incidents/${data.id}`);
  };

  const priorityInfo = {
    low: { label: 'Faible', color: 'border-slate-300 bg-slate-50 dark:bg-slate-900/20', dot: 'bg-slate-400' },
    medium: { label: 'Moyenne', color: 'border-blue-300 bg-blue-50 dark:bg-blue-900/20', dot: 'bg-blue-500' },
    high: { label: 'Haute', color: 'border-orange-300 bg-orange-50 dark:bg-orange-900/20', dot: 'bg-orange-500' },
    critical: { label: 'Critique', color: 'border-red-300 bg-red-50 dark:bg-red-900/20', dot: 'bg-red-500' },
  };

  return (
    <AppLayout>
      <div className="max-w-2xl space-y-5">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Link href="/incidents" className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-4 h-4" /> Retour aux incidents
          </Link>
        </div>

        <div>
          <h1 className="text-xl font-bold text-foreground">Déclarer un incident</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Remplissez le formulaire pour signaler un problème IT</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Title */}
          <div className="bg-card border border-border rounded-xl p-5 space-y-4">
            <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Informations générales</h3>

            <div className="space-y-1.5">
              <Label>Titre de l&apos;incident <span className="text-red-500">*</span></Label>
              <Input
                placeholder="Ex: Impossibilité de se connecter au VPN"
                value={title}
                onChange={e => setTitle(e.target.value)}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label>Description détaillée <span className="text-red-500">*</span></Label>
              <Textarea
                placeholder="Décrivez le problème en détail : depuis quand, ce qui a été essayé, messages d'erreur…"
                value={description}
                onChange={e => setDescription(e.target.value)}
                rows={5}
                required
              />
            </div>
          </div>

          {/* Classification */}
          <div className="bg-card border border-border rounded-xl p-5 space-y-4">
            <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Classification</h3>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Catégorie</Label>
                <select
                  className="w-full h-10 text-sm rounded-lg border border-input bg-background px-3"
                  value={categoryId}
                  onChange={e => { setCategoryId(e.target.value); setSubcategoryId(''); }}
                >
                  <option value="">Sélectionner…</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label>Sous-catégorie</Label>
                <select
                  className="w-full h-10 text-sm rounded-lg border border-input bg-background px-3"
                  value={subcategoryId}
                  onChange={e => setSubcategoryId(e.target.value)}
                  disabled={!categoryId}
                >
                  <option value="">Sélectionner…</option>
                  {subcategories.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label>Département</Label>
                <select
                  className="w-full h-10 text-sm rounded-lg border border-input bg-background px-3"
                  value={departmentId}
                  onChange={e => setDepartmentId(e.target.value)}
                >
                  <option value="">Sélectionner…</option>
                  {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label>Localisation</Label>
                <Input
                  placeholder="Ex: Bureau 3A, Salle serveurs"
                  value={location}
                  onChange={e => setLocation(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Priority */}
          <div className="bg-card border border-border rounded-xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Priorité</h3>
              <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoPriority}
                  onChange={e => setAutoPriority(e.target.checked)}
                  className="rounded"
                />
                Détection automatique
              </label>
            </div>

            <div className="grid grid-cols-4 gap-2">
              {Object.entries(priorityInfo).map(([v, info]) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => { setPriority(v); setAutoPriority(false); }}
                  className={`border-2 rounded-lg p-3 text-left transition-all ${priority === v ? info.color + ' border-opacity-100' : 'border-border hover:border-border/80'}`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <div className={`w-2 h-2 rounded-full ${info.dot}`} />
                    <span className="text-xs font-semibold">{info.label}</span>
                  </div>
                </button>
              ))}
            </div>

            {autoPriority && (
              <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                Priorité détectée automatiquement selon le contenu et le département
              </p>
            )}
          </div>

          {/* Assignment (admin/tech only) */}
          {(profile?.role === 'admin' || profile?.role === 'technician') && (
            <div className="bg-card border border-border rounded-xl p-5 space-y-3">
              <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Assignation</h3>
              <div className="space-y-1.5">
                <Label>Technicien assigné</Label>
                <select
                  className="w-full h-10 text-sm rounded-lg border border-input bg-background px-3"
                  value={assigneeId}
                  onChange={e => setAssigneeId(e.target.value)}
                >
                  <option value="">— Non assigné —</option>
                  {technicians.map(t => <option key={t.id} value={t.id}>{t.full_name}</option>)}
                </select>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-between pt-2">
            <Link href="/incidents">
              <Button variant="outline" type="button">Annuler</Button>
            </Link>
            <Button type="submit" disabled={submitting} className="gap-2">
              {submitting && <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
              Créer l&apos;incident
            </Button>
          </div>
        </form>
      </div>
    </AppLayout>
  );
}
