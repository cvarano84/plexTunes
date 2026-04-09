"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Music, Server, Key, ArrowRight, Loader2, CheckCircle2, AlertCircle, Disc3 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';

export default function SetupClient() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [serverUrl, setServerUrl] = useState('');
  const [token, setToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState(0);
  const [syncMessage, setSyncMessage] = useState('');
  const [musicSections, setMusicSections] = useState<any[]>([]);
  const [selectedSection, setSelectedSection] = useState('');
  const [checkingConfig, setCheckingConfig] = useState(true);

  useEffect(() => {
    fetch('/api/plex/config')
      .then(r => r?.json?.())
      .then(data => {
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
        body: JSON.stringify({ serverUrl: serverUrl?.trim?.(), token: token?.trim?.() }),
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
        setError('No music libraries found on this Plex server');
        return;
      }
      setMusicSections(sections);
      setSelectedSection(sections[0]?.key ?? '');
      setStep(2);
      toast.success('Connected to Plex!');
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
      // Start sync
      fetch('/api/plex/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sectionId: selectedSection }),
      }).then(async (res) => {
        const data = await res?.json?.();
        if (data?.success) {
          setSyncProgress(100);
          setSyncMessage('Sync complete! Redirecting...');
          setTimeout(() => router?.push?.('/jukebox'), 1500);
        } else {
          setSyncMessage(`Error: ${data?.error ?? 'Unknown error'}`);
          setSyncing(false);
        }
      }).catch(() => {
        setSyncMessage('Sync failed');
        setSyncing(false);
      });

      // Poll progress
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

  return (
    <div className="min-h-screen flex items-center justify-center bg-background hero-gradient p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-lg"
      >
        {/* Logo area */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-primary/10 mb-4 jukebox-glow">
            <Disc3 className="w-10 h-10 text-primary" />
          </div>
          <h1 className="text-3xl font-display font-bold tracking-tight neon-text">Plex Jukebox</h1>
          <p className="text-muted-foreground mt-2">Connect your Plex server to get started</p>
        </div>

        <div className="bg-card rounded-xl p-8 border border-border/50" style={{ boxShadow: 'var(--shadow-lg)' }}>
          <AnimatePresence mode="wait">
            {step === 1 && (
              <motion.div key="step1" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <div className="space-y-5">
                  <div>
                    <label className="text-sm font-medium text-foreground mb-2 flex items-center gap-2">
                      <Server className="w-4 h-4 text-primary" /> Plex Server URL
                    </label>
                    <input
                      type="text"
                      value={serverUrl}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setServerUrl(e?.target?.value ?? '')}
                      placeholder="http://192.168.1.100:32400"
                      className="w-full px-4 py-3 rounded-lg bg-secondary border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 text-base"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-foreground mb-2 flex items-center gap-2">
                      <Key className="w-4 h-4 text-primary" /> Plex Token
                    </label>
                    <input
                      type="password"
                      value={token}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setToken(e?.target?.value ?? '')}
                      placeholder="Your X-Plex-Token"
                      className="w-full px-4 py-3 rounded-lg bg-secondary border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 text-base"
                    />
                    <p className="text-xs text-muted-foreground mt-1.5">
                      Find your token at Plex Web App → Settings → Account → Authorized Devices
                    </p>
                  </div>

                  {error && (
                    <div className="flex items-center gap-2 text-destructive text-sm bg-destructive/10 px-3 py-2 rounded-lg">
                      <AlertCircle className="w-4 h-4 flex-shrink-0" />
                      {error}
                    </div>
                  )}

                  <button
                    onClick={handleConnect}
                    disabled={loading || !serverUrl?.trim?.() || !token?.trim?.()}
                    className="w-full flex items-center justify-center gap-2 px-6 py-3 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-base"
                  >
                    {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <ArrowRight className="w-5 h-5" />}
                    {loading ? 'Connecting...' : 'Connect to Plex'}
                  </button>
                </div>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div key="step2" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <div className="space-y-5">
                  <div className="flex items-center gap-2 text-green-400 mb-2">
                    <CheckCircle2 className="w-5 h-5" />
                    <span className="font-medium">Connected to Plex!</span>
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
                      {(musicSections ?? [])?.map?.((s: any) => (
                        <option key={s?.key ?? ''} value={s?.key ?? ''}>{s?.title ?? 'Unknown'}</option>
                      ))}
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
