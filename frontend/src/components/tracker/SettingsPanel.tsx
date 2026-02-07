'use client';

import { useState, useRef } from 'react';
import { Download, Upload, Target, AlertTriangle } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getTrackerPlayer, updateDailyGoal, exportTrackerBackup, importTrackerBackup } from '@/lib/api';
import { GlassCard } from '@/components/ui/GlassCard';
import type { PlayerData } from '@/lib/types';

export function SettingsPanel() {
  const queryClient = useQueryClient();
  const [goal, setGoal] = useState<number | null>(null);
  const [importError, setImportError] = useState('');
  const [importSuccess, setImportSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: player } = useQuery<PlayerData>({
    queryKey: ['tracker-player'],
    queryFn: getTrackerPlayer as () => Promise<PlayerData>,
  });

  const goalMutation = useMutation({
    mutationFn: (daily_goal: number) => updateDailyGoal(daily_goal),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tracker-player'] });
    },
  });

  const importMutation = useMutation({
    mutationFn: importTrackerBackup,
    onSuccess: () => {
      queryClient.invalidateQueries();
      setImportSuccess(true);
      setImportError('');
      setTimeout(() => setImportSuccess(false), 3000);
    },
    onError: (err: Error) => {
      setImportError(err.message);
    },
  });

  const handleExport = async () => {
    try {
      const data = await exportTrackerBackup();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `tracker-backup-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      // silently fail
    }
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target?.result as string);
        if (!data.tasks && !data.player) {
          setImportError('Ungültiges Backup-Format');
          return;
        }
        importMutation.mutate(data);
      } catch {
        setImportError('Datei konnte nicht gelesen werden');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const displayGoal = goal ?? player?.daily_goal ?? 120;

  return (
    <div className="max-w-lg mx-auto space-y-6">
      {/* Daily Goal */}
      <GlassCard>
        <div className="flex items-center gap-2 mb-4">
          <Target className="w-5 h-5 text-accent-success" />
          <h3 className="text-sm font-medium">Tagesziel</h3>
        </div>
        <div className="flex items-end gap-3">
          <div className="flex-1">
            <label className="text-[10px] text-white/40 uppercase tracking-wider">Minuten pro Tag</label>
            <input
              type="number"
              value={displayGoal}
              onChange={(e) => setGoal(Number(e.target.value))}
              min={10}
              max={720}
              className="glass-input w-full mt-1"
            />
          </div>
          <button
            onClick={() => goalMutation.mutate(displayGoal)}
            disabled={goalMutation.isPending}
            className="btn-primary py-2.5 px-4"
          >
            Speichern
          </button>
        </div>
        <p className="text-[10px] text-white/30 mt-2">
          Aktuell: {player?.daily_goal || 120} Minuten
        </p>
      </GlassCard>

      {/* Backup */}
      <GlassCard>
        <h3 className="text-sm font-medium mb-4">Backup</h3>
        <div className="space-y-3">
          <button
            onClick={handleExport}
            className="w-full btn-glass py-3 flex items-center justify-center gap-2"
          >
            <Download className="w-4 h-4" /> Daten exportieren
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            onChange={handleImport}
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={importMutation.isPending}
            className="w-full btn-glass py-3 flex items-center justify-center gap-2"
          >
            <Upload className="w-4 h-4" /> Daten importieren
          </button>

          {importError && (
            <div className="flex items-center gap-2 p-2 rounded-lg bg-red-500/10 border border-red-500/20">
              <AlertTriangle className="w-4 h-4 text-red-400" />
              <span className="text-xs text-red-300">{importError}</span>
            </div>
          )}
          {importSuccess && (
            <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-300 text-center">
              Import erfolgreich!
            </div>
          )}
        </div>
        <p className="text-[10px] text-white/30 mt-3">
          Beim Import werden alle bestehenden Tracker-Daten überschrieben.
        </p>
      </GlassCard>
    </div>
  );
}
