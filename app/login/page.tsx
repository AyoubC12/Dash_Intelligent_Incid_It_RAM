'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Eye, EyeOff, Wifi, Cpu, Lock } from 'lucide-react';
import Image from 'next/image';

export default function LoginPage() {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const { signIn, signUp } = useAuth();
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    if (mode === 'login') {
      const { error } = await signIn(email, password);
      if (error) {
        toast.error('Connexion échouée', { description: error });
      } else {
        router.replace('/dashboard');
      }
    } else {
      if (!fullName.trim()) {
        toast.error('Le nom complet est requis');
        setLoading(false);
        return;
      }
      const { error } = await signUp(email, password, fullName);
      if (error) {
        toast.error('Inscription échouée', { description: error });
      } else {
        toast.success('Compte créé !', { description: 'Vous pouvez maintenant vous connecter.' });
        setMode('login');
      }
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex">
      {/* Left Panel */}
      <div className="hidden lg:flex lg:w-1/2 relative bg-gradient-to-br from-[#8B0000] via-[#B71C1C] to-[#D32F2F] flex-col justify-between p-12 overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          {[...Array(20)].map((_, i) => (
            <div
              key={i}
              className="absolute rounded-full border border-white/20"
              style={{
                width: `${40 + i * 30}px`,
                height: `${40 + i * 30}px`,
                top: `${Math.random() * 100}%`,
                left: `${Math.random() * 100}%`,
                transform: 'translate(-50%, -50%)',
              }}
            />
          ))}
        </div>

        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-2">
            <div className="bg-white rounded-xl p-2 flex items-center justify-center">
              <Image src="/image.png" alt="RAM Handling" width={64} height={32} className="object-contain" style={{ width: 'auto', height: 32 }} />
            </div>
            <div>
              <div className="text-white font-bold text-lg leading-tight">RAM Handling</div>
              <div className="text-red-200 text-xs">IT Service Management</div>
            </div>
          </div>
        </div>

        <div className="relative z-10 space-y-8">
          <div>
            <h1 className="text-4xl font-bold text-white leading-tight">
              Gestion Intelligente
              <br />
              <span className="text-red-200">des Incidents IT</span>
            </h1>
            <p className="text-red-100 mt-4 text-lg leading-relaxed">
              Centralisez, suivez et résolvez vos incidents informatiques avec efficacité et intelligence.
            </p>
          </div>

          <div className="space-y-4">
            {[
              { icon: <Wifi className="w-5 h-5" />, title: 'Surveillance en temps réel', desc: 'Détection et alertes instantanées' },
              { icon: <Cpu className="w-5 h-5" />, title: 'Intelligence artificielle', desc: 'Prédictions et recommandations automatiques' },
              { icon: <Lock className="w-5 h-5" />, title: 'Gestion des SLA', desc: 'Respect des délais garanti' },
            ].map((item, i) => (
              <div key={i} className="flex items-start gap-3">
                <div className="w-9 h-9 bg-white/15 rounded-lg flex items-center justify-center text-white flex-shrink-0 mt-0.5">
                  {item.icon}
                </div>
                <div>
                  <div className="text-white font-medium text-sm">{item.title}</div>
                  <div className="text-red-200 text-xs">{item.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="relative z-10">
          <p className="text-red-200/60 text-xs">
            © 2025 RAM Handling — Plateforme IT v2.0
          </p>
        </div>
      </div>

      {/* Right Panel */}
      <div className="flex-1 flex items-center justify-center p-6 bg-background">
        <div className="w-full max-w-md space-y-8">
          <div className="lg:hidden flex items-center gap-3 mb-6">
            <div className="bg-white rounded-xl p-1.5 flex items-center justify-center">
              <Image src="/image.png" alt="RAM Handling" width={48} height={28} className="object-contain" style={{ width: 'auto', height: 28 }} />
            </div>
            <div>
              <div className="font-bold text-foreground">RAM Handling IT</div>
              <div className="text-muted-foreground text-xs">Service Management</div>
            </div>
          </div>

          <div>
            <h2 className="text-2xl font-bold text-foreground">
              {mode === 'login' ? 'Bienvenue' : 'Créer un compte'}
            </h2>
            <p className="text-muted-foreground text-sm mt-1">
              {mode === 'login'
                ? 'Connectez-vous à votre espace IT'
                : 'Rejoignez la plateforme IT de RAM Handling'}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {mode === 'signup' && (
              <div className="space-y-1.5">
                <Label htmlFor="fullName">Nom complet</Label>
                <Input
                  id="fullName"
                  placeholder="Ahmed Benali"
                  value={fullName}
                  onChange={e => setFullName(e.target.value)}
                  required
                />
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="email">Adresse email</Label>
              <Input
                id="email"
                type="email"
                placeholder="vous@ram-handling.ma"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password">Mot de passe</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  {mode === 'login' ? 'Connexion…' : 'Création…'}
                </span>
              ) : (
                mode === 'login' ? 'Se connecter' : 'Créer mon compte'
              )}
            </Button>
          </form>

          <div className="text-center text-sm text-muted-foreground">
            {mode === 'login' ? (
              <>
                Pas encore de compte ?{' '}
                <button onClick={() => setMode('signup')} className="text-primary font-medium hover:underline">
                  S&apos;inscrire
                </button>
              </>
            ) : (
              <>
                Déjà un compte ?{' '}
                <button onClick={() => setMode('login')} className="text-primary font-medium hover:underline">
                  Se connecter
                </button>
              </>
            )}
          </div>

          <div className="border border-border rounded-lg p-4 bg-muted/30">
            <p className="text-xs text-muted-foreground font-medium mb-2">Comptes de démonstration :</p>
            <div className="space-y-1">
              {[
                { label: 'Admin', email: 'admin@ram-handling.ma' },
                { label: 'Technicien', email: 'tech@ram-handling.ma' },
                { label: 'Employé', email: 'user@ram-handling.ma' },
              ].map(a => (
                <button
                  key={a.email}
                  onClick={() => { setEmail(a.email); setPassword('Password123!'); setMode('login'); }}
                  className="w-full text-left text-xs p-1.5 rounded hover:bg-muted transition-colors flex items-center justify-between"
                >
                  <span className="font-medium text-foreground">{a.label}</span>
                  <span className="text-muted-foreground">{a.email}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
