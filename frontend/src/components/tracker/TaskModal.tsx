'use client';

import { useState, useEffect } from 'react';
import { Trash2, Plus, X } from 'lucide-react';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { updateTrackerTask, deleteTrackerTask, getTrackerProjects } from '@/lib/api';
import { Modal } from '@/components/ui/Modal';
import type { TrackerTask, TrackerProject } from '@/lib/types';

interface TaskModalProps {
  task: TrackerTask | null;
  isOpen: boolean;
  onClose: () => void;
}

export function TaskModal({ task, isOpen, onClose }: TaskModalProps) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    title: '',
    description: '',
    notes: '',
    estimated_time: 25,
    category: '',
    project_id: '' as string,
    subtasks: [] as { text: string; completed: boolean }[],
  });
  const [newSubtask, setNewSubtask] = useState('');

  const { data: projects = [] } = useQuery<TrackerProject[]>({
    queryKey: ['tracker-projects'],
    queryFn: getTrackerProjects as () => Promise<TrackerProject[]>,
    enabled: isOpen,
  });

  useEffect(() => {
    if (task) {
      setForm({
        title: task.title,
        description: task.description,
        notes: task.notes,
        estimated_time: task.estimated_time,
        category: task.category,
        project_id: task.project_id || '',
        subtasks: [...task.subtasks],
      });
    }
  }, [task]);

  const updateMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => updateTrackerTask(task!.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tracker-tasks'] });
      onClose();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteTrackerTask(task!.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tracker-tasks'] });
      onClose();
    },
  });

  const handleSave = () => {
    updateMutation.mutate({
      title: form.title,
      description: form.description,
      notes: form.notes,
      estimated_time: form.estimated_time,
      category: form.category,
      project_id: form.project_id || null,
      subtasks: form.subtasks,
    });
  };

  const addSubtask = () => {
    if (!newSubtask.trim()) return;
    setForm(f => ({ ...f, subtasks: [...f.subtasks, { text: newSubtask.trim(), completed: false }] }));
    setNewSubtask('');
  };

  const toggleSubtask = (index: number) => {
    setForm(f => ({
      ...f,
      subtasks: f.subtasks.map((s, i) => i === index ? { ...s, completed: !s.completed } : s),
    }));
  };

  const removeSubtask = (index: number) => {
    setForm(f => ({ ...f, subtasks: f.subtasks.filter((_, i) => i !== index) }));
  };

  if (!task) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Aufgabe bearbeiten" size="md">
      <div className="space-y-4">
        {/* Title */}
        <div>
          <label className="text-[10px] text-white/40 uppercase tracking-wider">Titel</label>
          <input
            type="text"
            value={form.title}
            onChange={(e) => setForm(f => ({ ...f, title: e.target.value }))}
            className="glass-input w-full mt-1"
          />
        </div>

        {/* Description */}
        <div>
          <label className="text-[10px] text-white/40 uppercase tracking-wider">Beschreibung</label>
          <textarea
            value={form.description}
            onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))}
            rows={2}
            className="glass-input w-full mt-1 resize-none"
          />
        </div>

        <div className="grid grid-cols-3 gap-3">
          {/* Time */}
          <div>
            <label className="text-[10px] text-white/40 uppercase tracking-wider">Zeit (min)</label>
            <input
              type="number"
              value={form.estimated_time}
              onChange={(e) => setForm(f => ({ ...f, estimated_time: Number(e.target.value) }))}
              min={1}
              className="glass-input w-full mt-1"
            />
          </div>

          {/* Category */}
          <div>
            <label className="text-[10px] text-white/40 uppercase tracking-wider">Kategorie</label>
            <select
              value={form.category}
              onChange={(e) => setForm(f => ({ ...f, category: e.target.value }))}
              className="glass-input w-full mt-1"
            >
              <option value="">Keine</option>
              <option value="arbeit">Arbeit</option>
              <option value="privat">Privat</option>
              <option value="lernen">Lernen</option>
              <option value="sport">Sport</option>
              <option value="projekt">Projekt</option>
            </select>
          </div>

          {/* Project */}
          <div>
            <label className="text-[10px] text-white/40 uppercase tracking-wider">Projekt</label>
            <select
              value={form.project_id}
              onChange={(e) => setForm(f => ({ ...f, project_id: e.target.value }))}
              className="glass-input w-full mt-1"
            >
              <option value="">Kein Projekt</option>
              {projects.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Subtasks */}
        <div>
          <label className="text-[10px] text-white/40 uppercase tracking-wider">Unteraufgaben</label>
          <div className="space-y-1 mt-1">
            {form.subtasks.map((s, i) => (
              <div key={i} className="flex items-center gap-2 group">
                <input
                  type="checkbox"
                  checked={s.completed}
                  onChange={() => toggleSubtask(i)}
                  className="rounded accent-indigo-500"
                />
                <span className={`text-sm flex-1 ${s.completed ? 'line-through text-white/30' : ''}`}>{s.text}</span>
                <button
                  onClick={() => removeSubtask(i)}
                  className="opacity-0 group-hover:opacity-100 text-white/20 hover:text-red-400 transition-all"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
          <div className="flex gap-2 mt-2">
            <input
              type="text"
              value={newSubtask}
              onChange={(e) => setNewSubtask(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addSubtask())}
              placeholder="Unteraufgabe hinzufügen..."
              className="glass-input flex-1 text-xs py-1.5"
            />
            <button onClick={addSubtask} className="btn-glass py-1.5 px-2">
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Notes */}
        <div>
          <label className="text-[10px] text-white/40 uppercase tracking-wider">Notizen</label>
          <textarea
            value={form.notes}
            onChange={(e) => setForm(f => ({ ...f, notes: e.target.value }))}
            rows={3}
            className="glass-input w-full mt-1 resize-none"
            placeholder="Notizen zur Aufgabe..."
          />
        </div>

        {/* Actions */}
        <div className="flex justify-between pt-2">
          <button
            onClick={() => deleteMutation.mutate()}
            className="btn-danger py-2 px-3 flex items-center gap-1.5 text-xs"
          >
            <Trash2 className="w-3.5 h-3.5" /> Löschen
          </button>
          <div className="flex gap-2">
            <button onClick={onClose} className="btn-glass py-2 px-4 text-xs">
              Abbrechen
            </button>
            <button
              onClick={handleSave}
              disabled={!form.title.trim() || updateMutation.isPending}
              className="btn-primary py-2 px-4 text-xs"
            >
              Speichern
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
