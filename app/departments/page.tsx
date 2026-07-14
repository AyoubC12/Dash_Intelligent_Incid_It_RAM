'use client';

import { useState, useEffect } from 'react';
import { AppLayout } from '@/components/layout/app-layout';
import { supabase } from '@/lib/supabase';
import type { Department } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { Plus, Edit2, Trash2, Building2 } from 'lucide-react';
import { formatDateTime } from '@/lib/constants';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

export default function DepartmentsPage() {
  const { profile } = useAuth();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [editDept, setEditDept] = useState<Department | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newManager, setNewManager] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => { loadAll(); }, []);

  const loadAll = async () => {
    const { data } = await supabase.from('departments').select('*').order('name');
    setDepartments(data ?? []);
    setLoading(false);
  };

  const create = async () => {
    if (!newName.trim()) { toast.error('Nom requis'); return; }
    setSaving(true);
    const { error } = await supabase.from('departments').insert({
      name: newName.trim(), description: newDesc || null, manager_name: newManager || null,
    });
    if (error) toast.error('Erreur'); else { toast.success('Département créé'); setShowNew(false); setNewName(''); setNewDesc(''); setNewManager(''); loadAll(); }
    setSaving(false);
  };

  const update = async () => {
    if (!editDept) return;
    setSaving(true);
    const { error } = await supabase.from('departments').update({
      name: editDept.name, description: editDept.description, manager_name: editDept.manager_name,
    }).eq('id', editDept.id);
    if (error) toast.error('Erreur'); else { toast.success('Mis à jour'); setEditDept(null); loadAll(); }
    setSaving(false);
  };

  const remove = async (id: string) => {
    if (!confirm('Supprimer ce département ?')) return;
    const { error } = await supabase.from('departments').delete().eq('id', id);
    if (error) toast.error('Impossible de supprimer (des incidents y sont liés)'); else { toast.success('Supprimé'); loadAll(); }
  };

  if (profile?.role !== 'admin') {
    return <AppLayout><div className="text-center py-16 text-muted-foreground">Accès non autorisé</div></AppLayout>;
  }

  return (
    <AppLayout>
      <div className="space-y-5 max-w-3xl">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">Départements</h1>
            <p className="text-muted-foreground text-sm">{departments.length} département{departments.length !== 1 ? 's' : ''}</p>
          </div>
          <Button size="sm" className="gap-2" onClick={() => setShowNew(true)}>
            <Plus className="w-4 h-4" /> Ajouter
          </Button>
        </div>

        <div className="bg-card border border-border rounded-xl divide-y divide-border">
          {loading ? (
            <div className="py-12 text-center">
              <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
            </div>
          ) : departments.map(dept => (
            <div key={dept.id} className="flex items-center gap-4 px-5 py-4">
              <div className="w-9 h-9 bg-primary/10 rounded-lg flex items-center justify-center">
                <Building2 className="w-4.5 h-4.5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium">{dept.name}</div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {dept.description ?? 'Aucune description'}
                  {dept.manager_name && <> · Responsable: {dept.manager_name}</>}
                </div>
              </div>
              <div className="text-xs text-muted-foreground hidden md:block">{formatDateTime(dept.created_at)}</div>
              <div className="flex gap-1">
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setEditDept({ ...dept })}>
                  <Edit2 className="w-3.5 h-3.5" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 hover:text-red-500" onClick={() => remove(dept.id)}>
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>

        {/* Edit */}
        <Dialog open={!!editDept} onOpenChange={open => !open && setEditDept(null)}>
          <DialogContent>
            <DialogHeader><DialogTitle>Modifier le département</DialogTitle></DialogHeader>
            {editDept && (
              <div className="space-y-4 pt-2">
                <div className="space-y-1.5"><Label>Nom</Label><Input value={editDept.name} onChange={e => setEditDept({ ...editDept, name: e.target.value })} /></div>
                <div className="space-y-1.5"><Label>Description</Label><Textarea value={editDept.description ?? ''} onChange={e => setEditDept({ ...editDept, description: e.target.value })} rows={2} /></div>
                <div className="space-y-1.5"><Label>Responsable</Label><Input value={editDept.manager_name ?? ''} onChange={e => setEditDept({ ...editDept, manager_name: e.target.value })} /></div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setEditDept(null)}>Annuler</Button>
                  <Button onClick={update} disabled={saving}>Sauvegarder</Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* New */}
        <Dialog open={showNew} onOpenChange={setShowNew}>
          <DialogContent>
            <DialogHeader><DialogTitle>Nouveau département</DialogTitle></DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="space-y-1.5"><Label>Nom <span className="text-red-500">*</span></Label><Input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Ex: Marketing" /></div>
              <div className="space-y-1.5"><Label>Description</Label><Textarea value={newDesc} onChange={e => setNewDesc(e.target.value)} rows={2} /></div>
              <div className="space-y-1.5"><Label>Responsable</Label><Input value={newManager} onChange={e => setNewManager(e.target.value)} placeholder="Nom du responsable" /></div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setShowNew(false)}>Annuler</Button>
                <Button onClick={create} disabled={saving}>Créer</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
