'use client';

import { useState, useEffect } from 'react';
import { Search, X } from 'lucide-react';
import { useMailStore } from '@/stores/mailStore';

export function MailSearch() {
  const { searchQuery, setSearchQuery, searchActive, setSearchActive } = useMailStore();
  const [input, setInput] = useState(searchQuery);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (input.trim()) {
        setSearchQuery(input.trim());
        setSearchActive(true);
      } else if (searchActive) {
        setSearchQuery('');
        setSearchActive(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [input, setSearchQuery, setSearchActive, searchActive]);

  const handleClear = () => {
    setInput('');
    setSearchQuery('');
    setSearchActive(false);
  };

  return (
    <div className="relative">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
      <input
        type="text"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder="E-Mails durchsuchen..."
        className="glass-input w-full pl-10 pr-9 py-2 text-sm"
      />
      {input && (
        <button
          onClick={handleClear}
          className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-white/10"
        >
          <X className="w-3.5 h-3.5 text-white/40" />
        </button>
      )}
    </div>
  );
}
