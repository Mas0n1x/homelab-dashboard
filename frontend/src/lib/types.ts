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
  status: string
  lastSeen: string | null
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
