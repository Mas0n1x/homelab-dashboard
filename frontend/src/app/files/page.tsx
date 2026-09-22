/*
 * Homelab Dashboard
 * Copyright (c) 2024-2026 DEV Mas0n1x.
 * Licensed under the MIT License.
 */
'use client';

import { useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  FolderOpen, Folder, File as FileIcon, ArrowUp, Upload, FolderPlus,
  Trash2, Download, Save, Loader2, X, AlertTriangle, Server, ShieldAlert,
} from 'lucide-react';
import { clsx } from 'clsx';
import { PageTransition } from '@/components/ui/PageTransition';
import { GlassCard } from '@/components/ui/GlassCard';
import { Modal } from '@/components/ui/Modal';
import { useServerStore } from '@/stores/serverStore';
import * as api from '@/lib/api';
import { formatBytes, formatDateTime } from '@/lib/formatters';
import type { FileEntry } from '@/lib/api';

const DEFAULT_PATH: Record<string, string> = {}; // pro Server gemerkter letzter Pfad

export default function FilesPage() {
  const { servers } = useServerStore();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [serverId, setServerId] = useState<string>('');
  const [currentPath, setCurrentPath] = useState<string>('');
  const [editing, setEditing] = useState<{ path: string; name: string; content: string; original: string; binary: boolean } | null>(null);
  const [newFolder, setNewFolder] = useState(false);
  const [folderName, setFolderName] = useState('');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activeServer = servers.find(s => s.id === serverId) || servers[0];
  const activeId = activeServer?.id || '';
  const activePath = currentPath || DEFAULT_PATH[activeId] || '';

  const { data, isLoading, isError, error: listError } = useQuery({
    queryKey: ['files-list', activeId, activePath],
    queryFn: () => api.listFiles(activeId, activePath),
    enabled: !!activeId,
    retry: false,
  });

  const selectServer = (id: string) => {
    setServerId(id);
    setCurrentPath('');
    setError(null);
  };

  const navigate = (path: string) => {
    setCurrentPath(path);
    DEFAULT_PATH[activeId] = path;
  };

  const goInto = (entry: FileEntry) => {
    const base = data?.path || activePath || '/';
    const next = `${base.replace(/\/$/, '')}/${entry.name}`;
    navigate(next);
  };

  const goUp = () => {
    const base = data?.path || activePath || '/';
    const parent = base.split('/').slice(0, -1).join('/') || '/';
    navigate(parent);
  };

  const openFile = async (entry: FileEntry) => {
    setError(null);
    const base = data?.path || activePath || '/';
    const fullPath = `${base.replace(/\/$/, '')}/${entry.name}`;
    try {
      const res = await api.readFile(activeId, fullPath);
      if (res.binary) {
        setEditing({ path: fullPath, name: entry.name, content: '', original: '', binary: true });
      } else {
        setEditing({ path: fullPath, name: entry.name, content: res.content || '', original: res.content || '', binary: false });
      }
    } catch (e: any) {
      setError(e.message || 'Datei konnte nicht geöffnet werden');
    }
  };

  const save = async () => {
    if (!editing) return;
    setSaving(true);
    try {
      await api.writeFile(activeId, editing.path, editing.content);
      setEditing(null);
    } catch (e: any) {
      setError(e.message || 'Speichern fehlgeschlagen');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (entry: FileEntry) => {
    const base = data?.path || activePath || '/';
    const fullPath = `${base.replace(/\/$/, '')}/${entry.name}`;
    if (!confirm(`"${entry.name}" wirklich ${entry.type === 'dir' ? 'löschen (Ordner muss leer sein)' : 'löschen'}?`)) return;
    try {
      await api.deleteFile(activeId, fullPath, entry.type === 'dir');
      queryClient.invalidateQueries({ queryKey: ['files-list', activeId, activePath] });
    } catch (e: any) {
      setError(e.message || 'Löschen fehlgeschlagen');
    }
  };

  const download = async (entry: FileEntry) => {
    const base = data?.path || activePath || '/';
    const fullPath = `${base.replace(/\/$/, '')}/${entry.name}`;
    try {
      await api.downloadFile(activeId, fullPath);
    } catch (e: any) {
      setError(e.message || 'Download fehlgeschlagen');
    }
  };

  const createFolder = async () => {
    if (!folderName.trim()) return;
    try {
      await api.mkdirFile(activeId, data?.path || activePath || '/', folderName.trim());
      setNewFolder(false);
      setFolderName('');
      queryClient.invalidateQueries({ queryKey: ['files-list', activeId, activePath] });
    } catch (e: any) {
      setError(e.message || 'Ordner konnte nicht angelegt werden');
    }
  };

  const onUploadChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploading(true);
    setError(null);
    try {
      for (const file of Array.from(files)) {
        await api.uploadFile(activeId, data?.path || activePath || '/', file);
      }
      queryClient.invalidateQueries({ queryKey: ['files-list', activeId, activePath] });
    } catch (e: any) {
      setError(e.message || 'Upload fehlgeschlagen');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const pathSegments = (data?.path || activePath || '/').split('/').filter(Boolean);

  return (
    <PageTransition>
      <div className="flex flex-col gap-4">
        {/* Header */}
        <div className="space-y-3">
          <div>
            <h1 className="text-xl font-semibold flex items-center gap-2">
              <FolderOpen className="w-5 h-5 text-cyan-400" />
              Dateien
            </h1>
            <p className="text-sm text-white/40 mt-0.5 flex items-center gap-1.5">
              <ShieldAlert className="w-3.5 h-3.5 text-amber-400/70" />
              Direkter Zugriff auf das Dateisystem des Server-Hosts
            </p>
          </div>

          {/* Server-Auswahl */}
          <div className="flex flex-wrap items-center gap-2">
            {servers.map(s => {
              const active = activeId === s.id;
              return (
                <button
                  key={s.id}
                  onClick={() => selectServer(s.id)}
                  className={clsx(
                    'flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm border transition-all',
                    active
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                      : 'bg-white/[0.03] border-white/[0.08] text-white/60 hover:text-white/90 hover:bg-white/[0.06]'
                  )}
                >
                  <span className="relative flex-shrink-0">
                    <Server className="w-4 h-4" />
                    <span className={clsx('absolute -bottom-0.5 -right-0.5 w-1.5 h-1.5 rounded-full border border-[#0a0a1a]',
                      s.status === 'connected' ? 'bg-emerald-400' : 'bg-red-400')} />
                  </span>
                  <span className="truncate max-w-[160px]">{s.name}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Toolbar */}
        <GlassCard>
          <div className="relative z-10 flex flex-wrap items-center gap-2">
            <button
              onClick={goUp}
              disabled={pathSegments.length === 0}
              className="p-2 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-white/60 hover:text-white/90 disabled:opacity-30 transition-colors"
              title="Übergeordneter Ordner"
            >
              <ArrowUp className="w-4 h-4" />
            </button>

            {/* Breadcrumb */}
            <div className="flex items-center gap-1 text-sm text-white/50 overflow-x-auto flex-1 min-w-0">
              <button onClick={() => navigate('/')} className="hover:text-white/90 transition-colors font-mono px-1">/</button>
              {pathSegments.map((seg, i) => (
                <span key={i} className="flex items-center gap-1 flex-shrink-0">
                  <span className="text-white/20">/</span>
                  <button
                    onClick={() => navigate('/' + pathSegments.slice(0, i + 1).join('/'))}
                    className="hover:text-white/90 transition-colors font-mono"
                  >
                    {seg}
                  </button>
                </span>
              ))}
            </div>

            <button
              onClick={() => setNewFolder(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs bg-white/[0.04] hover:bg-white/[0.08] text-white/60 hover:text-white/90 transition-colors"
            >
              <FolderPlus className="w-3.5 h-3.5" /> Neuer Ordner
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs bg-accent/15 hover:bg-accent/25 text-accent-light transition-colors disabled:opacity-50"
            >
              {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
              Hochladen
            </button>
            <input ref={fileInputRef} type="file" multiple onChange={onUploadChange} className="hidden" />
          </div>
        </GlassCard>

        {error && (
          <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            {error}
          </div>
        )}

        {/* Listing */}
        <GlassCard padding={false}>
          <div className="relative z-10">
            {!activeId ? (
              <div className="flex flex-col items-center justify-center py-16 text-white/30 gap-3">
                <FolderOpen className="w-12 h-12 text-white/10" />
                <p className="text-sm">Wähle einen Server</p>
              </div>
            ) : isLoading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="w-6 h-6 animate-spin text-white/30" />
              </div>
            ) : isError ? (
              <div className="flex flex-col items-center justify-center py-16 text-white/30 gap-2 px-4 text-center">
                <AlertTriangle className="w-8 h-8 text-red-400/50" />
                <p className="text-sm text-red-400/80">{(listError as Error)?.message || 'Verzeichnis konnte nicht gelesen werden'}</p>
              </div>
            ) : !data?.entries.length ? (
              <div className="flex flex-col items-center justify-center py-16 text-white/30 gap-2">
                <Folder className="w-10 h-10 text-white/10" />
                <p className="text-sm">Ordner ist leer</p>
              </div>
            ) : (
              <table className="w-full text-sm">
                <tbody>
                  {data.entries.map(entry => (
                    <tr key={entry.name} className="border-b border-white/[0.04] last:border-0 hover:bg-white/[0.03] transition-colors group">
                      <td className="py-2.5 pl-4 pr-2 w-8">
                        {entry.type === 'dir'
                          ? <Folder className="w-4 h-4 text-cyan-400/70" />
                          : <FileIcon className="w-4 h-4 text-white/30" />}
                      </td>
                      <td className="py-2.5 pr-2">
                        <button
                          onClick={() => (entry.type === 'dir' ? goInto(entry) : openFile(entry))}
                          className="text-left text-white/80 hover:text-white truncate max-w-[280px] sm:max-w-none"
                        >
                          {entry.name}
                        </button>
                      </td>
                      <td className="py-2.5 pr-2 text-white/30 text-xs whitespace-nowrap hidden sm:table-cell">
                        {entry.type !== 'dir' ? formatBytes(entry.size) : ''}
                      </td>
                      <td className="py-2.5 pr-2 text-white/30 text-xs whitespace-nowrap hidden md:table-cell">
                        {entry.mtime ? formatDateTime(new Date(entry.mtime).toISOString()) : ''}
                      </td>
                      <td className="py-2.5 pr-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          {entry.type !== 'dir' && (
                            <button onClick={() => download(entry)} title="Herunterladen" className="p-1.5 rounded-lg text-white/40 hover:text-white/80 hover:bg-white/10 transition-colors">
                              <Download className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <button onClick={() => remove(entry)} title="Löschen" className="p-1.5 rounded-lg text-white/40 hover:text-red-400 hover:bg-red-500/10 transition-colors">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </GlassCard>
      </div>

      {/* Editor Modal */}
      <Modal isOpen={!!editing} onClose={() => setEditing(null)} title={editing?.path.split('/').pop() || 'Datei'} size="lg">
        {editing?.binary ? (
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <AlertTriangle className="w-8 h-8 text-amber-400/70" />
            <p className="text-sm text-white/60">Binärdatei — im Editor nicht darstellbar.</p>
            <button
              onClick={() => { const e = data?.entries.find(en => en.name === editing.name); if (e) download(e); }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs bg-accent/15 hover:bg-accent/25 text-accent-light transition-colors"
            >
              <Download className="w-3.5 h-3.5" /> Stattdessen herunterladen
            </button>
          </div>
        ) : editing ? (
          <div className="space-y-3">
            <p className="text-[10px] text-white/25 font-mono">{editing.path}</p>
            <textarea
              value={editing.content}
              onChange={e => setEditing({ ...editing, content: e.target.value })}
              className="w-full h-[55vh] bg-black/30 rounded-xl p-4 font-mono text-xs text-white/80 leading-5 resize-y outline-none border border-white/[0.06] focus:border-accent/30 transition-colors"
              spellCheck={false}
            />
            <div className="flex justify-end gap-2">
              <button onClick={() => setEditing(null)} className="px-4 py-2 text-sm rounded-lg bg-white/[0.06] hover:bg-white/[0.1] text-white/60 transition-colors">
                Abbrechen
              </button>
              <button
                onClick={save}
                disabled={editing.content === editing.original || saving}
                className="flex items-center gap-2 px-4 py-2 text-sm rounded-lg bg-accent/20 hover:bg-accent/30 text-accent-light font-medium transition-colors disabled:opacity-30"
              >
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                Speichern
              </button>
            </div>
          </div>
        ) : null}
      </Modal>

      {/* Neuer Ordner */}
      <Modal isOpen={newFolder} onClose={() => setNewFolder(false)} title="Neuer Ordner" size="sm">
        <div className="space-y-4">
          <input
            autoFocus
            value={folderName}
            onChange={e => setFolderName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && createFolder()}
            placeholder="Ordnername"
            className="w-full px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-sm text-white/80 outline-none focus:border-accent/30 transition-colors"
          />
          <div className="flex justify-end gap-2">
            <button onClick={() => setNewFolder(false)} className="px-4 py-2 text-sm rounded-lg bg-white/[0.06] hover:bg-white/[0.1] text-white/60 transition-colors">
              Abbrechen
            </button>
            <button onClick={createFolder} disabled={!folderName.trim()} className="px-4 py-2 text-sm rounded-lg bg-accent/20 hover:bg-accent/30 text-accent-light font-medium transition-colors disabled:opacity-30">
              Anlegen
            </button>
          </div>
        </div>
      </Modal>
    </PageTransition>
  );
}
