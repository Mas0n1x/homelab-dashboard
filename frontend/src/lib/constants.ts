import {
  Monitor, Shield, Server, Database, Cloud, HardDrive, Wifi, Settings,
  Terminal, Globe, Film, FileText, Box, Lock, BarChart3, Search,
  Mail, Calendar, Users, CreditCard, BookOpen, Folder, Activity, Link
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export const ICON_MAP: Record<string, LucideIcon> = {
  monitor: Monitor,
  shield: Shield,
  server: Server,
  database: Database,
  cloud: Cloud,
  storage: HardDrive,
  wifi: Wifi,
  settings: Settings,
  terminal: Terminal,
  globe: Globe,
  video: Film,
  file: FileText,
  box: Box,
  lock: Lock,
  chart: BarChart3,
  search: Search,
  mail: Mail,
  calendar: Calendar,
  users: Users,
  credit: CreditCard,
  book: BookOpen,
  folder: Folder,
  activity: Activity,
  link: Link,
};

export function getIcon(iconName: string): LucideIcon {
  return ICON_MAP[iconName] || Box;
}

export const NAV_ITEMS = [
  { href: '/', label: 'System', icon: 'monitor' },
  { href: '/docker', label: 'Docker', icon: 'box' },
  { href: '/services', label: 'Services', icon: 'globe' },
  { href: '/portfolio', label: 'Portfolio', icon: 'folder' },
] as const;

export const CONTAINER_STATE_COLORS: Record<string, string> = {
  running: 'text-accent-success',
  exited: 'text-accent-danger',
  paused: 'text-accent-warning',
  restarting: 'text-accent-info',
  created: 'text-white/40',
  dead: 'text-accent-danger',
};

export const CONTAINER_STATE_BG: Record<string, string> = {
  running: 'bg-accent-success/10 border-accent-success/20',
  exited: 'bg-accent-danger/10 border-accent-danger/20',
  paused: 'bg-accent-warning/10 border-accent-warning/20',
  restarting: 'bg-accent-info/10 border-accent-info/20',
};
