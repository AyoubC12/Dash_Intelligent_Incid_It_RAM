'use client';

import { useState, useEffect } from 'react';
import { AppLayout } from '@/components/layout/app-layout';
import { supabase } from '@/lib/supabase';
import type { Category, Subcategory } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Plus, Edit2, Trash2, ChevronDown, ChevronRight, Tag } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

const ICONS = ['folder', 'wifi', 'cpu', 'monitor', 'shield', 'mail', 'printer', 'phone', 'server', 'database', 'cloud', 'lock'];
const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#F97316', '#06B6D4', '#DC2626'];

export default function CategoriesPage() {
  const { profile } = useAuth();
  const [categories, setCategories] = useState<Category[]>([]);
  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [editCat, setEditCat] = useState<Category | null>(null);
  const [showNewCat, setShowNewCat] = useState(false);
  const [showNewSub, setShowNewSub] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', icon: 'folder', color: '#3B82F6' });
  const [subForm, setSubForm] = useState({ name: '', description: '' });

  useEffect(() => { loadAll(); }, []);

  const loadAll = async () => {
    const [cRes, sRes] = await Promise.all([
      supabase.from('categories').select('*').order('name'),
      supabase.from('subcategories').select('*').order('name'),
    ]);
    setCategories(cRes.data ?? []);
    setSubcategories(sRes.data ?? []);
    setLoading(false);
  };

  const createCat = async () => {
    if (!form.name.trim()) { toast.error('Nom requis'); return; }
    setSaving(true);
    const { error } = await supabase.from('categories').insert({ name: form.name, description: form.description || null, icon: form.icon, color: form.color });
    if (error) toast.error('Erreur'); else { toast.success('Catégorie créée'); setShowNewCat(false); setForm({ name: '', description: '', icon: 'folder', color: '#3B82F6' }); loadAll(); }
    setSaving(false);
  };

  const updateCat = async () => {
    if (!editCat) return;
    setSaving(true);
    const { error } = await supabase.from('categories').update({ name: editCat.name, description: editCat.description, icon: editCat.icon, color: editCat.color }).eq('id', editCat.id);
    if (error) toast.error('Erreur'); else { toast.success('Mis à jour'); setEditCat(null); loadAll(); }
    setSaving(false);
  };

  const deleteCat = async (id: string) => {
    if (!confirm('Supprimer cette catégorie ?')) return;
    const { error } = await supabase.from('categories').delete().eq('id', id);
    if (error) toast.error('Impossible de supprimer'); else { toast.success('Supprimé'); loadAll(); }
  };

  const createSub = async (catId: string) => {
    if (!subForm.name.trim()) { toast.error('Nom requis'); return; }
    setSaving(true);
    const { error } = await supabase.from('subcategories').insert({ category_id: catId, name: subForm.name, description: subForm.description || null });
    if (error) toast.error('Erreur'); else { toast.success('Sous-catégorie créée'); setShowNewSub(null); setSubForm({ name: '', description: '' }); loadAll(); }
    setSaving(false);
  };

  const deleteSub = async (id: string) => {
    if (!confirm('Supprimer ?')) return;
    await supabase.from('subcategories').delete().eq('id', id);
    loadAll();
  };

  if (profile?.role !== 'admin') {
    return <AppLayout><div className="text-center py-16 text-muted-foreground">Accès non autorisé</div></AppLayout>;
  }

  return (
    <AppLayout>
      <div className="space-y-5 max-w-3xl">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">Catégories d&apos;incidents</h1>
            <p className="text-muted-foreground text-sm">{categories.length} catégorie{categories.length !== 1 ? 's' : ''}</p>
          </div>
          <Button size="sm" className="gap-2" onClick={() => setShowNewCat(true)}>
            <Plus className="w-4 h-4" /> Ajouter
          </Button>
        </div>

        <div className="bg-card border border-border rounded-xl divide-y divide-border">
          {loading ? (
            <div className="py-12 text-center"><div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" /></div>
          ) : categories.map(cat => {
            const subs = subcategories.filter(s => s.category_id === cat.id);
            const isExpanded = expanded.has(cat.id);
            return (
              <div key={cat.id}>
                <div className="flex items-center gap-4 px-5 py-4">
                  <button onClick={() => setExpanded(prev => { const s = new Set(prev); isExpanded ? s.delete(cat.id) : s.add(cat.id); return s; })} className="text-muted-foreground hover:text-foreground">
                    {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                  </button>
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: cat.color + '20' }}>
                    <div className="w-3 h-3 rounded-full" style={{ background: cat.color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium">{cat.name}</div>
                    <div className="text-xs text-muted-foreground">{cat.description ?? ''} · {subs.length} sous-catégorie{subs.length !== 1 ? 's' : ''}</div>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditCat({ ...cat })}><Edit2 className="w-3.5 h-3.5" /></Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 hover:text-red-500" onClick={() => deleteCat(cat.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                  </div>
                </div>
                {isExpanded && (
                  <div className="pl-14 pr-5 pb-4 space-y-1">
                    {subs.map(s => (
                      <div key={s.id} className="flex items-center gap-3 py-1.5 px-3 rounded-lg hover:bg-muted/30">
                        <Tag className="w-3.5 h-3.5 text-muted-foreground" />
                        <span className="text-sm flex-1">{s.name}</span>
                        <Button variant="ghost" size="icon" className="h-6 w-6 hover:text-red-500" onClick={() => deleteSub(s.id)}><Trash2 className="w-3 h-3" /></Button>
                      </div>
                    ))}
                    <button onClick={() => setShowNewSub(cat.id)} className="flex items-center gap-2 text-xs text-primary hover:underline py-1 px-3">
                      <Plus className="w-3 h-3" /> Ajouter une sous-catégorie
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* New Category */}
        <Dialog open={showNewCat} onOpenChange={setShowNewCat}>
          <DialogContent>
            <DialogHeader><DialogTitle>Nouvelle catégorie</DialogTitle></DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="space-y-1.5"><Label>Nom <span className="text-red-500">*</span></Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
              <div className="space-y-1.5"><Label>Description</Label><Input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></div>
              <div className="space-y-1.5">
                <Label>Couleur</Label>
                <div className="flex gap-2 flex-wrap">
                  {COLORS.map(c => (
                    <button key={c} onClick={() => setForm({ ...form, color: c })}
                      className={`w-7 h-7 rounded-full border-2 transition-transform hover:scale-110 ${form.color === c ? 'border-foreground scale-110' : 'border-transparent'}`}
                      style={{ background: c }} />
                  ))}
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setShowNewCat(false)}>Annuler</Button>
                <Button onClick={createCat} disabled={saving}>Créer</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Edit Category */}
        <Dialog open={!!editCat} onOpenChange={open => !open && setEditCat(null)}>
          <DialogContent>
            <DialogHeader><DialogTitle>Modifier la catégorie</DialogTitle></DialogHeader>
            {editCat && (
              <div className="space-y-4 pt-2">
                <div className="space-y-1.5"><Label>Nom</Label><Input value={editCat.name} onChange={e => setEditCat({ ...editCat, name: e.target.value })} /></div>
                <div className="space-y-1.5"><Label>Description</Label><Input value={editCat.description ?? ''} onChange={e => setEditCat({ ...editCat, description: e.target.value })} /></div>
                <div className="space-y-1.5">
                  <Label>Couleur</Label>
                  <div className="flex gap-2 flex-wrap">
                    {COLORS.map(c => (
                      <button key={c} onClick={() => setEditCat({ ...editCat, color: c })}
                        className={`w-7 h-7 rounded-full border-2 transition-transform hover:scale-110 ${editCat.color === c ? 'border-foreground scale-110' : 'border-transparent'}`}
                        style={{ background: c }} />
                    ))}
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setEditCat(null)}>Annuler</Button>
                  <Button onClick={updateCat} disabled={saving}>Sauvegarder</Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* New Subcategory */}
        <Dialog open={!!showNewSub} onOpenChange={open => !open && setShowNewSub(null)}>
          <DialogContent>
            <DialogHeader><DialogTitle>Nouvelle sous-catégorie</DialogTitle></DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="space-y-1.5"><Label>Nom <span className="text-red-500">*</span></Label><Input value={subForm.name} onChange={e => setSubForm({ ...subForm, name: e.target.value })} /></div>
              <div className="space-y-1.5"><Label>Description</Label><Input value={subForm.description} onChange={e => setSubForm({ ...subForm, description: e.target.value })} /></div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setShowNewSub(null)}>Annuler</Button>
                <Button onClick={() => showNewSub && createSub(showNewSub)} disabled={saving}>Créer</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
