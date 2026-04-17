"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Music,
  Server,
  Key,
  User as UserIcon,
  ArrowRight,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Disc3,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';

type ServerType = 'plex' | 'jellyfin' | 'subsonic';

const BACKENDS: Array<{
  id: ServerType;
  name: string;
  description: string;
  urlPlaceholder: string;
  tokenLabel: string;
  tokenPlaceholder: string;
  tokenHelp: string;
  needsUsername: boolean;
}> = [
  {
    id: 'plex',
    name: 'Plex',
    description: 'Official Plex Media Server',
    urlPlaceholder: 'http://192.168.1.100:32400',
    tokenLabel: 'Plex Token',
    tokenPlaceholder: 'Your X-Plex-Token',
    tokenHelp: 'Find your token at Plex Web App → Settings → Account → Authorized Devices.',
    needsUsername: false,
  },
  {
    id: 'jellyfin',
    name: 'Jellyfin',
    description: 'Free & open-source media server',
    urlPlaceholder: 'http://192.168.1.100:8096',
    tokenLabel: 'Jellyfin API Key',
    tokenPlaceholder: 'API key generated in Jellyfin Dashboard',
    tokenHelp: 'Generate at Dashboard → Advanced → API Keys → New API Key.',
    needsUsername: false,
  },
  {
    id: 'subsonic',
    name: 'Navidrome / Subsonic',
    description: 'OpenSubsonic-compatible server (Navidrome, Airsonic, Gonic)',
    urlPlaceholder: 'http://192.168.1.100:4533',
    tokenLabel: 'Password',
    tokenPlaceholder: 'Your Subsonic password',
    tokenHelp: 'Uses your Navidrome/Subsonic account password. Stored server-side only.',
    needsUsername: true,
  },
];

export default function SetupClient() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [serverType, setServerType] = useState<ServerType>('plex');
  const [serverUrl, setServerUrl] = useState('');
  const [token, setToken] = useState('');
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState(0);
  const [syncMessage, setSyncMessage] = useState('');
  const [musicSections, setMusicSections] = useState<any[]>([]);
  const [selectedSection, setSelectedSection] = useState('');
  const [checkingConfig, setCheckingConfig] = useState(true);

  const backend = BACKENDS.find((b) => b.id === serverType) ?? BACKENDS[0];

  useEffect(() => {
    fetch('/api/plex/config')
      .then((r) => r?.json?.())
      .then((data) => {
        if (data?.configured) {
          router?.push?.('/jukebox');
        }
        setCheckingConfig(false);
      })
      .catch(() => setCheckingConfig(false));
  }, [router]);

  const handleConnect = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/plex/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serverType,
          serverUrl: serverUrl?.trim?.(),
          token: token?.trim?.(),
          username: backend.needsUsername ? username?.trim?.() : null,
        }),
      });
      const data = await res?.json?.();
      if (!res?.ok) {
        setError(data?.error ?? 'Connection failed');
        return;
      }
      // Fetch music libraries
      const libRes = await fetch('/api/plex/library');
      const libData = await libRes?.json?.();
      const sections = libData?.sections ?? [];
      if (sections?.length === 0) {
        setError('No music libraries found on this server');
        return;
      }
      setMusicSections(sections);
      // Sections now use { id, title }; support legacy { key, title } just in case
      const first = sections[0];
      setSelectedSection(String(first?.id ?? first?.key ?? ''));
      setStep(2);
      toast.success(`Connected to ${backend.name}!`);
    } catch (e: any) {
      setError(e?.message ?? 'Connection failed');
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    setSyncProgress(0);
    setSyncMessage('Starting sync...');
    try {
      fetch('/api/plex/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sectionId: selectedSection }),
      })
        .then(async (res) => {
          const data = await res?.json?.();
          if (data?.success) {
            setSyncProgress(100);
            setSyncMessage('Sync complete! Redirecting...');
            setTimeout(() => router?.push?.('/jukebox'), 1500);
          } else {
            setSyncMessage(`Error: ${data?.error ?? 'Unknown error'}`);
            setSyncing(false);
          }
        })
        .catch(() => {
          setSyncMessage('Sync failed');
          setSyncing(false);
        });

      const pollInterval = setInterval(async () => {
        try {
          const statusRes = await fetch('/api/plex/sync');
          const status = await statusRes?.json?.();
          setSyncProgress(status?.syncProgress ?? 0);
          setSyncMessage(status?.syncMessage ?? '');
          if (!status?.syncInProgress && (status?.syncProgress ?? 0) >= 100) {
            clearInterval(pollInterval);
          }
        } catch {
          // continue polling
        }
      }, 2000);
    } catch (e: any) {
      setSyncMessage(e?.message ?? 'Failed');
      setSyncing(false);
    }
  };

  if (checkingConfig) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const connectDisabled =
    loading ||
    !serverUrl?.trim?.() ||
    !token?.trim?.() ||
    (backend.needsUsername && !username?.trim?.());

  return (
    <div className="min-h-screen flex items-center justify-center bg-background hero-gradient p-4">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-lg">
        {/* Logo area */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-primary/10 mb-4 jukebox-glow">
            <Disc3 className="w-10 h-10 text-primary" />
          </div>
          <h1 className="text-3xl font-display font-bold tracking-tight neon-text">Jukebox</h1>
          <p className="text-muted-foreground mt-2">Connect your media server to get started</p>
        </div>

        <div className="bg-card rounded-xl p-8 border border-border/50" style={{ boxShadow: 'var(--shadow-lg)' }}>
          <AnimatePresence mode="wait">
            {step === 1 && (
              <motion.div key="step1" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <div className="space-y-5">
                  {/* Server type picker */}
                  <div>
                    <label className="text-sm font-medium text-foreground mb-2 block">Media Server</label>
                    <div className="grid grid-cols-1 gap-2">
                      {BACKENDS.map((b) => (
                        <button
                          key={b.id}
                          type="button"
                          onClick={() => {
                            setServerType(b.id);
                            setError('');
                          }}
                          className={`text-left px-4 py-3 rounded-lg border transition-all ${
                            serverType === b.id
                              ? 'bg-primary/10 border-primary/60 ring-1 ring-primary/40'
                              : 'bg-secondary border-border/50 hover:border-border active:border-primary/40'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="font-medium text-sm text-foreground">{b.name}</div>
                              <div className="text-xs text-muted-foreground mt-0.5">{b.description}</div>
                            </div>
                            {serverType === b.id && <CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0" />}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-foreground mb-2 flex items-center gap-2">
                      <Server className="w-4 h-4 text-primary" /> Server URL
                    </label>
                    <input
                      type="text"
                      value={serverUrl}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setServerUrl(e?.target?.value ?? '')}
                      placeholder={backend.urlPlaceholder}
                      className="w-full px-4 py-3 rounded-lg bg-secondary border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 text-base"
                    />
                  </div>

                  {backend.needsUsername && (
                    <div>
                      <label className="text-sm font-medium text-foreground mb-2 flex items-center gap-2">
                        <UserIcon className="w-4 h-4 text-primary" /> Username
                      </label>
                      <input
                        type="text"
                        value={username}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setUsername(e?.target?.value ?? '')}
                        placeholder="Your Navidrome/Subsonic username"
                        className="w-full px-4 py-3 rounded-lg bg-secondary border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 text-base"
                      />
                    </div>
                  )}

                  <div>
                    <label className="text-sm font-medium text-foreground mb-2 flex items-center gap-2">
                      <Key className="w-4 h-4 text-primary" /> {backend.tokenLabel}
                    </label>
                    <input
                      type="password"
                      value={token}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setToken(e?.target?.value ?? '')}
                      placeholder={backend.tokenPlaceholder}
                      className="w-full px-4 py-3 rounded-lg bg-secondary border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 text-base"
                    />
                    <p className="text-xs text-muted-foreground mt-1.5">{backend.tokenHelp}</p>
                  </div>

                  {error && (
                    <div className="flex items-center gap-2 text-destructive text-sm bg-destructive/10 px-3 py-2 rounded-lg">
                      <AlertCircle className="w-4 h-4 flex-shrink-0" />
                      {error}
                    </div>
                  )}

                  <button
                    onClick={handleConnect}
                    disabled={connectDisabled}
                    className="w-full flex items-center justify-center gap-2 px-6 py-3 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-base"
                  >
                    {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <ArrowRight className="w-5 h-5" />}
                    {loading ? 'Connecting...' : `Connect to ${backend.name}`}
                  </button>
                </div>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div key="step2" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <div className="space-y-5">
                  <div className="flex items-center gap-2 text-green-400 mb-2">
                    <CheckCircle2 className="w-5 h-5" />
                    <span className="font-medium">Connected to {backend.name}!</span>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-foreground mb-2 flex items-center gap-2">
                      <Music className="w-4 h-4 text-primary" /> Select Music Library
                    </label>
                    <select
                      value={selectedSection}
                      onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setSelectedSection(e?.target?.value ?? '')}
                      className="w-full px-4 py-3 rounded-lg bg-secondary border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 text-base"
                    >
                      {(musicSections ?? [])?.map?.((s: any) => {
                        const id = String(s?.id ?? s?.key ?? '');
                        return (
                          <option key={id} value={id}>
                            {s?.title ?? 'Unknown'}
                          </option>
                        );
                      })}
                    </select>
                  </div>

                  {syncing ? (
                    <div className="space-y-3">
                      <div className="w-full h-3 rounded-full bg-secondary overflow-hidden">
                        <motion.div
                          className="h-full bg-gradient-to-r from-primary to-accent rounded-full"
                          initial={{ width: '0%' }}
                          animate={{ width: `${syncProgress}%` }}
                          transition={{ duration: 0.5 }}
                        />
                      </div>
                      <p className="text-sm text-muted-foreground text-center">{syncMessage}</p>
                    </div>
                  ) : (
                    <button
                      onClick={handleSync}
                      className="w-full flex items-center justify-center gap-2 px-6 py-3 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors text-base"
                    >
                      <Music className="w-5 h-5" />
                      Sync Music Library
                    </button>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}
