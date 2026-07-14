'use client';

import { useState, useEffect } from 'react';
import { AppLayout } from '@/components/layout/app-layout';
import { supabase } from '@/lib/supabase';
import type { SlaConfig } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Save, Clock, Shield } from 'lucide-react';
import { PRIORITY_LABELS } from '@/lib/constants';

export default function SettingsPage() {
  const { profile } = useAuth();
  const [slaConfigs, setSlaConfigs] = useState<SlaConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase.from('sla_configs').select('*').order('priority').then(({ data }) => {
      setSlaConfigs(data ?? []);
      setLoading(false);
    });
  }, []);

  const updateSla = (id: string, field: 'response_time_hours' | 'resolution_time_hours', value: number) => {
    setSlaConfigs(prev => prev.map(s => s.id === id ? { ...s, [field]: value } : s));
  };

  const saveSla = async () => {
    setSaving(true);
    for (const sla of slaConfigs) {
      await supabase.from('sla_configs').update({
        response_time_hours: sla.response_time_hours,
        resolution_time_hours: sla.resolution_time_hours,
        updated_at: new Date().toISOString(),
      }).eq('id', sla.id);
    }
    toast.success('Configurations SLA sauvegardées');
    setSaving(false);
  };

  if (profile?.role !== 'admin') {
    return <AppLayout><div className="text-center py-16 text-muted-foreground">Accès non autorisé</div></AppLayout>;
  }

  const priorityColors = { low: 'text-slate-500', medium: 'text-blue-500', high: 'text-orange-500', critical: 'text-red-500' };

  return (
    <AppLayout>
      <div className="max-w-2xl space-y-6">
        <h1 className="text-xl font-bold">Paramètres</h1>

        {/* SLA */}
        <div className="bg-card border border-border rounded-xl p-6 space-y-5">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center">
              <Clock className="w-4 h-4 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold">Configurations SLA</h3>
              <p className="text-xs text-muted-foreground">Délais de réponse et résolution par priorité</p>
            </div>
          </div>

          {loading ? (
            <div className="py-6 text-center"><div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" /></div>
          ) : (
            <div className="space-y-4">
              {slaConfigs.map(sla => (
                <div key={sla.id} className="grid grid-cols-3 gap-4 items-center py-3 border-b border-border last:border-0">
                  <div className={`font-semibold text-sm ${priorityColors[sla.priority as keyof typeof priorityColors]}`}>
                    {PRIORITY_LABELS[sla.priority as keyof typeof PRIORITY_LABELS]}
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Délai de réponse (h)</Label>
                    <Input
                      type="number"
                      value={sla.response_time_hours}
                      onChange={e => updateSla(sla.id, 'response_time_hours', parseInt(e.target.value))}
                      className="h-8"
                      min={1}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Délai de résolution (h)</Label>
                    <Input
                      type="number"
                      value={sla.resolution_time_hours}
                      onChange={e => updateSla(sla.id, 'resolution_time_hours', parseInt(e.target.value))}
                      className="h-8"
                      min={1}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="flex justify-end pt-2">
            <Button className="gap-2" onClick={saveSla} disabled={saving}>
              <Save className="w-4 h-4" /> Sauvegarder les SLA
            </Button>
          </div>
        </div>

        {/* Platform info */}
        <div className="bg-card border border-border rounded-xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center">
              <Shield className="w-4 h-4 text-primary" />
            </div>
            <h3 className="font-semibold">À propos de la plateforme</h3>
          </div>
          <div className="space-y-2 text-sm text-muted-foreground">
            <div className="flex justify-between"><span>Nom</span><span className="font-medium text-foreground">RAM Handling IT Management</span></div>
            <div className="flex justify-between"><span>Version</span><span className="font-medium text-foreground">2.0.0</span></div>
            <div className="flex justify-between"><span>Environnement</span><span className="font-medium text-foreground">Production</span></div>
            <div className="flex justify-between"><span>Base de données</span><span className="font-medium text-foreground">PostgreSQL (Supabase)</span></div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
