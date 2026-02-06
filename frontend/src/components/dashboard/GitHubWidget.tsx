'use client';

import { useQuery } from '@tanstack/react-query';
import { GitFork, Star, Eye, ExternalLink, MapPin, LinkIcon, Clock } from 'lucide-react';
import { GlassCard } from '@/components/ui/GlassCard';
import { AnimatedNumber } from '@/components/ui/AnimatedNumber';

const GITHUB_USER = 'mas0n1x';

interface GitHubRepo {
  id: number;
  name: string;
  html_url: string;
  description: string | null;
  language: string | null;
  stargazers_count: number;
  forks_count: number;
  watchers_count: number;
  open_issues_count: number;
  updated_at: string;
  fork: boolean;
  topics: string[];
  size: number;
}

interface GitHubUser {
  login: string;
  avatar_url: string;
  html_url: string;
  name: string | null;
  bio: string | null;
  location: string | null;
  blog: string | null;
  public_repos: number;
  public_gists: number;
  followers: number;
  following: number;
  created_at: string;
}

interface GitHubEvent {
  id: string;
  type: string;
  repo: { name: string };
  created_at: string;
  payload: Record<string, unknown>;
}

const LANG_COLORS: Record<string, string> = {
  TypeScript: '#3178c6',
  JavaScript: '#f7df1e',
  Python: '#3572A5',
  HTML: '#e34c26',
  CSS: '#563d7c',
  Go: '#00ADD8',
  Rust: '#dea584',
  Java: '#b07219',
  Vue: '#41b883',
  Svelte: '#ff3e00',
  Shell: '#89e051',
  PHP: '#4F5D95',
  C: '#555555',
  'C++': '#f34b7d',
  'C#': '#178600',
  Ruby: '#701516',
  Lua: '#000080',
  Kotlin: '#A97BFF',
  Swift: '#F05138',
  Dart: '#00B4AB',
  SCSS: '#c6538c',
};

const EVENT_LABELS: Record<string, string> = {
  PushEvent: 'Push',
  CreateEvent: 'Erstellt',
  DeleteEvent: 'Gelöscht',
  PullRequestEvent: 'PR',
  IssuesEvent: 'Issue',
  WatchEvent: 'Star',
  ForkEvent: 'Fork',
  ReleaseEvent: 'Release',
  IssueCommentEvent: 'Kommentar',
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Jetzt';
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d`;
  return `${Math.floor(days / 30)}mo`;
}

export function GitHubWidget() {
  const { data: user } = useQuery<GitHubUser>({
    queryKey: ['github-user'],
    queryFn: async () => {
      const res = await fetch(`https://api.github.com/users/${GITHUB_USER}`);
      if (!res.ok) throw new Error('GitHub API error');
      return res.json();
    },
    staleTime: 300000,
  });

  const { data: repos } = useQuery<GitHubRepo[]>({
    queryKey: ['github-repos'],
    queryFn: async () => {
      const res = await fetch(`https://api.github.com/users/${GITHUB_USER}/repos?sort=updated&per_page=10`);
      if (!res.ok) throw new Error('GitHub API error');
      const all: GitHubRepo[] = await res.json();
      return all.filter(r => !r.fork).slice(0, 6);
    },
    staleTime: 300000,
  });

  const { data: events } = useQuery<GitHubEvent[]>({
    queryKey: ['github-events'],
    queryFn: async () => {
      const res = await fetch(`https://api.github.com/users/${GITHUB_USER}/events/public?per_page=10`);
      if (!res.ok) throw new Error('GitHub API error');
      return res.json();
    },
    staleTime: 300000,
  });

  if (!user) return null;

  const totalStars = repos?.reduce((sum, r) => sum + r.stargazers_count, 0) || 0;
  const totalForks = repos?.reduce((sum, r) => sum + r.forks_count, 0) || 0;
  const languages = new Map<string, number>();
  repos?.forEach(r => {
    if (r.language) languages.set(r.language, (languages.get(r.language) || 0) + r.size);
  });
  const topLanguages = Array.from(languages.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const totalSize = topLanguages.reduce((s, [, v]) => s + v, 0);

  const recentEvents = events?.slice(0, 5) || [];
  const memberSince = new Date(user.created_at).toLocaleDateString('de-DE', { month: 'short', year: 'numeric' });

  return (
    <GlassCard delay={0.35} hover>
      <div className="relative z-10">
        {/* Header */}
        <div className="flex items-start gap-3 mb-4">
          <img src={user.avatar_url} alt={user.login} className="w-12 h-12 rounded-xl border border-white/10" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <a href={user.html_url} target="_blank" rel="noopener noreferrer" className="text-sm font-semibold hover:text-accent-light transition-colors">
                {user.name || user.login}
              </a>
              <span className="text-[10px] text-white/30 font-mono">@{user.login}</span>
            </div>
            {user.bio && <p className="text-xs text-white/40 mt-0.5 line-clamp-1">{user.bio}</p>}
            <div className="flex items-center gap-3 mt-1 text-[10px] text-white/30">
              {user.location && (
                <span className="flex items-center gap-0.5"><MapPin className="w-2.5 h-2.5" />{user.location}</span>
              )}
              {user.blog && (
                <a href={user.blog.startsWith('http') ? user.blog : `https://${user.blog}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-0.5 hover:text-white/50">
                  <LinkIcon className="w-2.5 h-2.5" />{user.blog.replace(/^https?:\/\//, '')}
                </a>
              )}
              <span className="flex items-center gap-0.5"><Clock className="w-2.5 h-2.5" />Seit {memberSince}</span>
            </div>
          </div>
          <a href={user.html_url} target="_blank" rel="noopener noreferrer" className="text-white/20 hover:text-white/50 transition-colors">
            <svg className="w-5 h-5" viewBox="0 0 16 16" fill="currentColor">
              <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
            </svg>
          </a>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-4 gap-2 mb-4">
          <div className="text-center p-2 rounded-lg bg-white/[0.02]">
            <span className="text-sm font-bold text-white/90 block"><AnimatedNumber value={user.public_repos} /></span>
            <span className="text-[9px] text-white/30 uppercase tracking-wider">Repos</span>
          </div>
          <div className="text-center p-2 rounded-lg bg-white/[0.02]">
            <span className="text-sm font-bold text-amber-400 block"><AnimatedNumber value={totalStars} /></span>
            <span className="text-[9px] text-white/30 uppercase tracking-wider">Stars</span>
          </div>
          <div className="text-center p-2 rounded-lg bg-white/[0.02]">
            <span className="text-sm font-bold text-white/90 block"><AnimatedNumber value={totalForks} /></span>
            <span className="text-[9px] text-white/30 uppercase tracking-wider">Forks</span>
          </div>
          <div className="text-center p-2 rounded-lg bg-white/[0.02]">
            <span className="text-sm font-bold text-white/90 block"><AnimatedNumber value={user.followers} /></span>
            <span className="text-[9px] text-white/30 uppercase tracking-wider">Follower</span>
          </div>
        </div>

        {/* Language Bar */}
        {topLanguages.length > 0 && (
          <div className="mb-4">
            <div className="flex h-1.5 rounded-full overflow-hidden mb-2">
              {topLanguages.map(([lang, size]) => (
                <div
                  key={lang}
                  className="h-full first:rounded-l-full last:rounded-r-full"
                  style={{ width: `${(size / totalSize) * 100}%`, backgroundColor: LANG_COLORS[lang] || '#888' }}
                  title={`${lang}: ${((size / totalSize) * 100).toFixed(1)}%`}
                />
              ))}
            </div>
            <div className="flex flex-wrap gap-x-3 gap-y-0.5">
              {topLanguages.map(([lang, size]) => (
                <span key={lang} className="flex items-center gap-1 text-[10px] text-white/40">
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: LANG_COLORS[lang] || '#888' }} />
                  {lang} <span className="text-white/20">{((size / totalSize) * 100).toFixed(0)}%</span>
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Repos */}
        {repos && repos.length > 0 && (
          <div className="mb-4">
            <span className="text-[10px] text-white/30 uppercase tracking-wider mb-2 block">Repositories</span>
            <div className="space-y-1">
              {repos.map(repo => (
                <a
                  key={repo.id}
                  href={repo.html_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 py-1.5 px-2 -mx-2 rounded-lg hover:bg-white/[0.04] transition-colors group"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="text-xs font-medium truncate group-hover:text-accent-light transition-colors">{repo.name}</p>
                      <ExternalLink className="w-2.5 h-2.5 text-white/0 group-hover:text-white/30 transition-colors flex-shrink-0" />
                    </div>
                    {repo.description && (
                      <p className="text-[10px] text-white/25 truncate mt-0.5">{repo.description}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {repo.language && (
                      <span className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: LANG_COLORS[repo.language] || '#888' }} />
                        <span className="text-[10px] text-white/30">{repo.language}</span>
                      </span>
                    )}
                    {repo.stargazers_count > 0 && (
                      <span className="flex items-center gap-0.5 text-[10px] text-amber-400/60">
                        <Star className="w-2.5 h-2.5" />{repo.stargazers_count}
                      </span>
                    )}
                    {repo.forks_count > 0 && (
                      <span className="flex items-center gap-0.5 text-[10px] text-white/25">
                        <GitFork className="w-2.5 h-2.5" />{repo.forks_count}
                      </span>
                    )}
                  </div>
                </a>
              ))}
            </div>
          </div>
        )}

        {/* Recent Activity */}
        {recentEvents.length > 0 && (
          <div>
            <span className="text-[10px] text-white/30 uppercase tracking-wider mb-2 block">Letzte Aktivität</span>
            <div className="space-y-1">
              {recentEvents.map(event => (
                <div key={event.id} className="flex items-center gap-2 py-1 text-[10px]">
                  <span className="px-1.5 py-0.5 rounded bg-white/[0.04] text-white/40 font-mono">
                    {EVENT_LABELS[event.type] || event.type.replace('Event', '')}
                  </span>
                  <span className="text-white/50 truncate flex-1">{event.repo.name.replace(`${GITHUB_USER}/`, '')}</span>
                  <span className="text-white/20 flex-shrink-0">{timeAgo(event.created_at)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </GlassCard>
  );
}
