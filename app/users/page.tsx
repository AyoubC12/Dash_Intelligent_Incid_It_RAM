'use client';

import { useState, useEffect } from 'react';
import { AppLayout } from '@/components/layout/app-layout';
import { supabase } from '@/lib/supabase';
import type { Profile, Department } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Plus, Search, Edit2, Trash2, User, Shield, Wrench, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getInitials, getAvatarColor, formatDateTime } from '@/lib/constants';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';

const ROLE_LABELS = { employee: 'Employé', technician: 'Technicien', admin: 'Administrateur' };
const ROLE_COLORS = {
  employee: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  technician: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  admin: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
};

export default function UsersPage() {
  const { profile: me } = useAuth();
  const [users, setUsers] = useState<Profile[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterRole, setFilterRole] = useState('');
  const [editUser, setEditUser] = useState<Profile | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [saving, setSaving] = useState(false);

  // New user form
  const [newEmail, setNewEmail] = useState('');
  const [newName, setNewName] = useState('');
  const [newRole, setNewRole] = useState('employee');
  const [newDept, setNewDept] = useState('');
  const [newPassword, setNewPassword] = useState('Password123!');

  useEffect(() => {
    if (me?.role !== 'admin') return;
    loadAll();
  }, [me]);

  const loadAll = async () => {
    const [uRes, dRes] = await Promise.all([
      supabase.from('profiles').select('*, departments(name)').order('created_at', { ascending: false }),
      supabase.from('departments').select('*').order('name'),
    ]);
    setUsers(uRes.data ?? []);
    setDepartments(dRes.data ?? []);
    setLoading(false);
  };

  const filtered = users.filter(u =>
    (!filterRole || u.role === filterRole) &&
    (!search || u.full_name.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase()))
  );

  const createUser = async () => {
    if (!newEmail || !newName) { toast.error('Email et nom requis'); return; }
    setSaving(true);

    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: newEmail,
      password: newPassword,
    });

    if (authError && !authError.message.includes('already registered')) {
      toast.error('Erreur création compte', { description: authError.message });
      setSaving(false);
      return;
    }

    if (authData?.user) {
      await supabase.from('profiles').upsert({
        id: authData.user.id, full_name: newName, email: newEmail,
        role: newRole, department_id: newDept || null,
      });
    }

    toast.success('Utilisateur créé — il peut maintenant se connecter');
    setShowNew(false);
    setNewEmail(''); setNewName(''); setNewRole('employee'); setNewDept('');
    loadAll();
    setSaving(false);
  };

  const updateUser = async () => {
    if (!editUser) return;
    setSaving(true);
    const { error } = await supabase.from('profiles').update({
      full_name: editUser.full_name,
      role: editUser.role,
      department_id: editUser.department_id,
      phone: editUser.phone,
      location: editUser.location,
      is_active: editUser.is_active,
      updated_at: new Date().toISOString(),
    }).eq('id', editUser.id);
    if (error) toast.error('Erreur'); else { toast.success('Utilisateur mis à jour'); setEditUser(null); loadAll(); }
    setSaving(false);
  };

  const toggleActive = async (user: Profile) => {
    if (user.id === me?.id) { toast.error('Vous ne pouvez pas désactiver votre propre compte'); return; }
    await supabase.from('profiles').update({ is_active: !user.is_active }).eq('id', user.id);
    loadAll();
  };

  if (me?.role !== 'admin') {
    return <AppLayout><div className="text-center py-16 text-muted-foreground">Accès non autorisé</div></AppLayout>;
  }

  const roleIcon = { employee: <User className="w-3 h-3" />, technician: <Wrench className="w-3 h-3" />, admin: <Shield className="w-3 h-3" /> };

  return (
    <AppLayout>
      <div className="space-y-5 max-w-[1200px]">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">Gestion des utilisateurs</h1>
            <p className="text-muted-foreground text-sm">{users.length} utilisateur{users.length !== 1 ? 's' : ''}</p>
          </div>
          <Button size="sm" className="gap-2" onClick={() => setShowNew(true)}>
            <Plus className="w-4 h-4" /> Nouvel utilisateur
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          {Object.entries(ROLE_LABELS).map(([role, label]) => (
            <div key={role} className="bg-card border border-border rounded-xl p-4">
              <div className="text-2xl font-bold">{users.filter(u => u.role === role).length}</div>
              <div className="text-xs text-muted-foreground mt-0.5">{label}{users.filter(u => u.role === role).length !== 1 ? 's' : ''}</div>
            </div>
          ))}
        </div>

        <div className="bg-card border border-border rounded-xl">
          <div className="flex items-center gap-3 p-3 border-b border-border">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Rechercher…" className="pl-9 h-8 bg-muted/30 border-0" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <select className="h-8 text-xs rounded-lg border border-border bg-background px-2" value={filterRole} onChange={e => setFilterRole(e.target.value)}>
              <option value="">Tous les rôles</option>
              {Object.entries(ROLE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground">Utilisateur</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground">Rôle</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground hidden md:table-cell">Département</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground hidden lg:table-cell">Inscrit le</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground">Statut</th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={6} className="text-center py-12">
                    <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
                  </td></tr>
                ) : filtered.map(u => (
                  <tr key={u.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className={cn('w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold', getAvatarColor(u.full_name))}>
                          {getInitials(u.full_name)}
                        </div>
                        <div>
                          <div className="font-medium">{u.full_name}</div>
                          <div className="text-xs text-muted-foreground">{u.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn('text-[10px] px-2 py-0.5 rounded-full font-medium flex items-center gap-1 w-fit', ROLE_COLORS[u.role])}>
                        {roleIcon[u.role]} {ROLE_LABELS[u.role]}
                      </span>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell text-xs text-muted-foreground">
                      {(u as Profile & { departments?: { name: string } }).departments?.name ?? '—'}
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell text-xs text-muted-foreground">{formatDateTime(u.created_at)}</td>
                    <td className="px-4 py-3">
                      <span className={cn('text-[10px] px-2 py-0.5 rounded-full font-medium',
                        u.is_active ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-gray-100 text-gray-500'
                      )}>
                        {u.is_active ? 'Actif' : 'Inactif'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditUser({ ...u })}>
                          <Edit2 className="w-3.5 h-3.5" />
                        </Button>
                        {u.id !== me?.id && (
                          <Button variant="ghost" size="icon" className="h-7 w-7 hover:text-amber-500" onClick={() => toggleActive(u)}>
                            {u.is_active ? <X className="w-3.5 h-3.5" /> : <Shield className="w-3.5 h-3.5" />}
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Edit Dialog */}
        <Dialog open={!!editUser} onOpenChange={open => !open && setEditUser(null)}>
          <DialogContent>
            <DialogHeader><DialogTitle>Modifier l&apos;utilisateur</DialogTitle></DialogHeader>
            {editUser && (
              <div className="space-y-4 pt-2">
                <div className="space-y-1.5">
                  <Label>Nom complet</Label>
                  <Input value={editUser.full_name} onChange={e => setEditUser({ ...editUser, full_name: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>Rôle</Label>
                  <select className="w-full h-10 text-sm rounded-lg border border-input bg-background px-3"
                    value={editUser.role} onChange={e => setEditUser({ ...editUser, role: e.target.value as Profile['role'] })}>
                    {Object.entries(ROLE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label>Département</Label>
                  <select className="w-full h-10 text-sm rounded-lg border border-input bg-background px-3"
                    value={editUser.department_id ?? ''} onChange={e => setEditUser({ ...editUser, department_id: e.target.value || null })}>
                    <option value="">— Aucun —</option>
                    {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label>Téléphone</Label>
                  <Input value={editUser.phone ?? ''} onChange={e => setEditUser({ ...editUser, phone: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>Localisation</Label>
                  <Input value={editUser.location ?? ''} onChange={e => setEditUser({ ...editUser, location: e.target.value })} />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <Button variant="outline" onClick={() => setEditUser(null)}>Annuler</Button>
                  <Button onClick={updateUser} disabled={saving}>Sauvegarder</Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* New User Dialog */}
        <Dialog open={showNew} onOpenChange={setShowNew}>
          <DialogContent>
            <DialogHeader><DialogTitle>Créer un utilisateur</DialogTitle></DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="space-y-1.5">
                <Label>Nom complet <span className="text-red-500">*</span></Label>
                <Input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Ahmed Benali" />
              </div>
              <div className="space-y-1.5">
                <Label>Email <span className="text-red-500">*</span></Label>
                <Input type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="ahmed@ram-handling.ma" />
              </div>
              <div className="space-y-1.5">
                <Label>Mot de passe</Label>
                <Input value={newPassword} onChange={e => setNewPassword(e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Rôle</Label>
                  <select className="w-full h-10 text-sm rounded-lg border border-input bg-background px-3"
                    value={newRole} onChange={e => setNewRole(e.target.value)}>
                    {Object.entries(ROLE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label>Département</Label>
                  <select className="w-full h-10 text-sm rounded-lg border border-input bg-background px-3"
                    value={newDept} onChange={e => setNewDept(e.target.value)}>
                    <option value="">— Aucun —</option>
                    {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setShowNew(false)}>Annuler</Button>
                <Button onClick={createUser} disabled={saving}>Créer</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
