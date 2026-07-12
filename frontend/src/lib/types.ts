/*
 * Homelab Dashboard
 * Copyright (c) 2024-2026 DEV Mas0n1x.
 * Licensed under the MIT License.
 */
export interface SystemStats {
  cpu: {
    total: number
    user: number
    system: number
    idle: number
  }
  memory: {
    total: number
    used: number
    free: number
    percent: number
  }
  disk: DiskInfo[]
  network: NetworkInterface[]
  temperature: TempSensor[]
  uptime: string
}

export interface DiskInfo {
  mountPoint: string
  device: string
  total: number
  used: number
  free: number
  percent: number
}

export interface NetworkInterface {
  interface: string
  rxBytes: number
  txBytes: number
  rxRate: number
  txRate: number
}

export interface TempSensor {
  label: string
  value: number
}

export interface Container {
  id: string
  shortId: string
  name: string
  image: string
  state: string
  status: string
  created: number
  ports: PortMapping[]
  project: string | null
  service: string | null
  labels: Record<string, string>
}

export interface PortMapping {
  private: number
  public: number | null
  type: string
}

export interface DockerInfo {
  containers: number
  containersRunning: number
  containersPaused: number
  containersStopped: number
  images: number
  dockerVersion: string
  os: string
  architecture: string
  memTotal: number
  cpus: number
}

export interface Service {
  id: string
  containerId?: string
  source: 'docker' | 'manual'
  serverId: string
  name: string
  icon: string
  url: string | null
  description: string
  category: string
  order: number
  state?: string
  status?: string
  image?: string
  project?: string
  uptime?: {
    uptime24h: number | null
    uptime7d: number | null
    avgResponseTime: number
  } | null
}

export interface Server {
  id: string
  name: string
  host: string
  is_local: number
  glances_url: string | null
  docker_socket: string | null
  docker_host: string | null
  ssh_host?: string | null
  ssh_port?: number | null
  ssh_user?: string | null
  ssh_key_path?: string | null
  provider?: string | null
  location?: string | null
  monthly_cost?: number | null
  currency?: string | null
  expires_at?: string | null
  tunnel_name?: string | null
  notes?: string | null
  status: string
  lastSeen: string | null
}

export interface MetricSample {
  cpu: number | null
  mem: number | null
  disk: number | null
  rx: number | null
  tx: number | null
  ts: string
}

export interface TunnelInfo {
  id: string
  name: string
  status: string
  connections: number
}

export interface ServiceStatusEntry {
  uptime24h: number | null
  uptime7d: number | null
  avgResponseTime: number
  current: boolean | null
  lastCheck: string | null
  timeline: { date: string; uptime: number | null; checks: number }[]
}

export interface PortfolioData {
  stats: {
    projects: number
    customers: number
    openRequests: number
    totalRevenue: number
    paidRevenue: number
    openRevenue: number
    overdueRevenue: number
  }
  activities: PortfolioActivity[]
  timestamp: string
}

export interface PortfolioActivity {
  id: number
  type: string
  description: string
  created_at: string
}

export interface PortfolioRequest {
  id: number
  name: string
  email: string
  project_type: string
  budget: string
  status: string
  created_at: string
  message?: string
}

export interface PortfolioInvoice {
  id: number
  invoice_number: string
  customer_name: string
  amount: number
  status: string
  due_date: string
  created_at: string
}

export interface PortfolioCustomer {
  id: number
  name: string
  email: string
  company?: string
  phone?: string
  created_at: string
}

export interface Notification {
  id: string
  type: string
  title: string
  message: string
  timestamp: string
  read: boolean
}

export interface ContainerDetails {
  id: string
  shortId: string
  name: string
  image: string
  state: string
  running: boolean
  paused: boolean
  restarting: boolean
  pid: number
  exitCode: number
  startedAt: string
  finishedAt: string
  restartCount: number
  platform: string
  created: string
  ports: { container: string; host: string | null }[]
  mounts: { type: string; source: string; destination: string; mode: string; rw: boolean }[]
  env: string[]
  networks: string[]
  labels: Record<string, string>
}

export interface UptimeCheck {
  online: number
  response_time: number
  checked_at: string
}

export interface Favorite {
  service_id: string
  sort_order: number
}

export interface ContainerStats {
  id: string
  name: string
  cpu: number
  memUsage: number
  memLimit: number
  memPercent: number
}

export interface SpeedtestResult {
  id?: number
  download: number
  upload: number
  ping: number
  server: string
  tested_at?: string
}

export interface ComposeProject {
  name: string
  workingDir: string | null
  configFiles: string | null
  containers: {
    id: string
    name: string
    service: string
    state: string
    image: string
  }[]
}

export interface DiskUsage {
  containers: { id: string; name: string; size: number; rootFs: number; state: string }[]
  images: { id: string; repo: string; size: number; shared: number; unique: number }[]
  volumes: { name: string; size: number; refCount: number }[]
  buildCache: number
}

export interface AlertChannel {
  id: string
  type: 'discord' | 'telegram'
  name: string
  webhook_url: string
  enabled: boolean
  events: string[]
  created_at?: string
}

export interface ImageUpdate {
  containerId: string
  containerName: string
  image: string
  currentId: string
  latestId: string
  hasUpdate: boolean
}

// ─── Mail ───

export interface MailFolder {
  id: string
  name: string
  role: string | null
  parentId: string | null
  totalEmails: number
  unreadEmails: number
  sortOrder: number
}

export interface MailAddress {
  name: string | null
  email: string
}

export interface MailBodyPart {
  partId: string
  blobId: string
  type: string
}

export interface MailEmail {
  id: string
  threadId: string
  blobId: string
  mailboxIds: Record<string, boolean>
  from: MailAddress[]
  to: MailAddress[]
  cc: MailAddress[]
  bcc: MailAddress[]
  replyTo: MailAddress[]
  subject: string
  receivedAt: string
  sentAt: string
  preview: string
  size: number
  hasAttachment: boolean
  keywords: Record<string, boolean>
  htmlBody: MailBodyPart[]
  textBody: MailBodyPart[]
  attachments: MailAttachment[]
  bodyValues?: Record<string, { value: string; isEncodingProblem: boolean }>
}

export interface MailAttachment {
  partId: string
  blobId: string
  name: string | null
  type: string
  size: number
  cid: string | null
}

export interface MailAccount {
  name: string
  description: string
  emails: string[]
  type: string
}

export interface MailCredentials {
  email: string | null
  password: string | null
  accountId: string | null
}

// ─── Maintenance ───

export interface Process {
  pid: number
  name: string
  username: string
  cpuPercent: number
  memPercent: number
  memRss: number
  status: string
  numThreads: number
  cmdline: string
  nice: number
  ioRead: number
  ioWrite: number
}

export interface NetworkConfig {
  interfaces: NetworkInterfaceDetail[]
  publicIp: string | null
  publicIpv6: string | null
}

export interface NetworkInterfaceDetail {
  name: string
  isUp: boolean
  speed: number
  rxBytes: number
  txBytes: number
  rxRate: number
  txRate: number
}

export interface DiskHealthInfo {
  disks: DiskDetail[]
  io: DiskIO[]
}

export interface DiskDetail {
  mountPoint: string
  device: string
  fsType: string
  total: number
  used: number
  free: number
  percent: number
}

export interface DiskIO {
  name: string
  readBytes: number
  writeBytes: number
  readRate: number
  writeRate: number
}

export interface SystemdService {
  name: string
  status: string
  cpu: number
  mem: number
}

export interface UpdateStatus {
  available: boolean
  packages: { name: string; version: string }[]
  count?: number
  lastCheck: string | null
  error: string | null
}
