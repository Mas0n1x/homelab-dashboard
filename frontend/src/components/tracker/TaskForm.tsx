'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createTrackerTask } from '@/lib/api';

export function TaskForm() {
  const [title, setTitle] = useState('');
  const [time, setTime] = useState(25);
  const [category, setCategory] = useState('');
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: createTrackerTask,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tracker-tasks'] });
      setTitle('');
      setTime(25);
      setCategory('');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    mutation.mutate({ title: title.trim(), estimated_time: time, category });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Neue Aufgabe..."
        className="glass-input w-full text-xs py-2"
      />
      <div className="flex gap-2">
        <input
          type="number"
          value={time}
          onChange={(e) => setTime(Number(e.target.value))}
          min={1}
          max={480}
          className="glass-input w-16 text-xs py-2 text-center shrink-0"
          title="Minuten"
          placeholder="Min"
        />
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="glass-input text-xs py-2 flex-1 min-w-0"
        >
          <option value="">Kategorie</option>
          <option value="arbeit">Arbeit</option>
          <option value="privat">Privat</option>
          <option value="lernen">Lernen</option>
          <option value="sport">Sport</option>
          <option value="projekt">Projekt</option>
        </select>
        <button
          type="submit"
          disabled={!title.trim() || mutation.isPending}
          className="btn-primary py-2 px-3 disabled:opacity-40 shrink-0"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>
    </form>
  );
}
