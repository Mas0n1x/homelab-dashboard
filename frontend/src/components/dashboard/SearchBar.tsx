'use client';

import { useState, useRef, useEffect } from 'react';
import { Search } from 'lucide-react';

export function SearchBar() {
  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Cmd+K shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    window.open(`https://www.google.com/search?q=${encodeURIComponent(query)}`, '_blank');
    setQuery('');
  };

  return (
    <form onSubmit={handleSubmit} className="relative">
      <div className={`flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all duration-200 ${
        focused
          ? 'bg-white/[0.06] border border-white/[0.12] shadow-lg shadow-accent/5'
          : 'bg-white/[0.03] border border-white/[0.06]'
      }`}>
        <Search className={`w-4 h-4 flex-shrink-0 transition-colors ${focused ? 'text-accent-light' : 'text-white/30'}`} />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder="Google durchsuchen..."
          className="bg-transparent text-sm text-white/80 placeholder:text-white/25 outline-none flex-1 min-w-0"
        />
        <kbd className="hidden sm:flex items-center gap-0.5 text-[10px] text-white/20 bg-white/[0.04] px-1.5 py-0.5 rounded">
          <span>Ctrl</span>+<span>K</span>
        </kbd>
      </div>
    </form>
  );
}
