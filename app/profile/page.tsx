'use client';

import { useState } from 'react';
import { AppLayout } from '@/components/layout/app-layout';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { User, Mail, Phone, MapPin, Camera, Save } from 'lucide-react';
import { getInitials, getAvatarColor } from '@/lib/constants';
import { cn } from '@/lib/utils';

export default function ProfilePage() {
  const { profile, refreshProfile } = useAuth();
  const [fullName, setFullName] = useState(profile?.full_name ?? '');
  const [phone, setPhone] = useState(profile?.phone ?? '');
  const [location, setLocation] = useState(profile?.location ?? '');
  const [saving, setSaving] = useState(false);
  const [changingPwd, setChangingPwd] = useState(false);
  const [currentPwd, setCurrentPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');

  const saveProfile = async () => {
    if (!profile) return;
    setSaving(true);
    const { error } = await supabase.from('profiles').update({
      full_name: fullName, phone: phone || null, location: location || null, updated_at: new Date().toISOString(),
    }).eq('id', profile.id);
    if (error) toast.error('Erreur'); else { toast.success('Profil mis à jour'); refreshProfile(); }
    setSaving(false);
  };

  const changePassword = async () => {
    if (newPwd !== confirmPwd) { toast.error('Les mots de passe ne correspondent pas'); return; }
    if (newPwd.length < 8) { toast.error('Minimum 8 caractères'); return; }
    setChangingPwd(true);
    const { error } = await supabase.auth.updateUser({ password: newPwd });
    if (error) toast.error('Erreur', { description: error.message }); else {
      toast.success('Mot de passe modifié');
      setCurrentPwd(''); setNewPwd(''); setConfirmPwd('');
    }
    setChangingPwd(false);
  };

  const ROLE_LABELS = { employee: 'Employé', technician: 'Technicien', admin: 'Administrateur' };

  return (
    <AppLayout>
      <div className="max-w-2xl space-y-6">
        <h1 className="text-xl font-bold">Mon profil</h1>

        {/* Avatar & header */}
        <div className="bg-card border border-border rounded-xl p-6">
          <div className="flex items-center gap-5">
            <div className="relative">
              <div className={cn('w-16 h-16 rounded-full flex items-center justify-center text-white text-xl font-bold', profile ? getAvatarColor(profile.full_name) : 'bg-gray-400')}>
                {profile ? getInitials(profile.full_name) : '?'}
              </div>
            </div>
            <div>
              <div className="text-lg font-bold">{profile?.full_name}</div>
              <div className="text-muted-foreground text-sm">{profile?.email}</div>
              <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium mt-1 inline-block capitalize">
                {profile?.role ? ROLE_LABELS[profile.role] : ''}
              </span>
            </div>
          </div>
        </div>

        {/* Edit form */}
        <div className="bg-card border border-border rounded-xl p-6 space-y-4">
          <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Informations personnelles</h3>

          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5"><User className="w-3.5 h-3.5" /> Nom complet</Label>
            <Input value={fullName} onChange={e => setFullName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5"><Mail className="w-3.5 h-3.5" /> Email</Label>
            <Input value={profile?.email ?? ''} disabled className="opacity-60" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5"><Phone className="w-3.5 h-3.5" /> Téléphone</Label>
              <Input value={phone} onChange={e => setPhone(e.target.value)} placeholder="+212 6XX XXX XXX" />
            </div>
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5" /> Localisation</Label>
              <Input value={location} onChange={e => setLocation(e.target.value)} placeholder="Bureau, site…" />
            </div>
          </div>
          <div className="flex justify-end pt-2">
            <Button className="gap-2" onClick={saveProfile} disabled={saving}>
              <Save className="w-4 h-4" /> Sauvegarder
            </Button>
          </div>
        </div>

        {/* Change password */}
        <div className="bg-card border border-border rounded-xl p-6 space-y-4">
          <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Changer le mot de passe</h3>
          <div className="space-y-1.5">
            <Label>Nouveau mot de passe</Label>
            <Input type="password" value={newPwd} onChange={e => setNewPwd(e.target.value)} placeholder="Minimum 8 caractères" />
          </div>
          <div className="space-y-1.5">
            <Label>Confirmer le mot de passe</Label>
            <Input type="password" value={confirmPwd} onChange={e => setConfirmPwd(e.target.value)} />
          </div>
          <div className="flex justify-end">
            <Button variant="outline" className="gap-2" onClick={changePassword} disabled={changingPwd || !newPwd}>
              Modifier le mot de passe
            </Button>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
