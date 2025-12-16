<script>
  import { systemStats } from '$lib/stores/stats.js';
  import { Cpu, MemoryStick, HardDrive, Thermometer, Clock, Wifi } from 'lucide-svelte';

  function formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  function formatUptime(uptime) {
    if (!uptime || uptime === 'N/A') return 'N/A';
    return uptime;
  }

  function getProgressColor(percent) {
    if (percent >= 90) return 'bg-red-500';
    if (percent >= 70) return 'bg-yellow-500';
    return 'bg-green-500';
  }

  $: cpu = $systemStats?.cpu;
  $: memory = $systemStats?.memory;
  $: disk = $systemStats?.disk?.[0];
  $: temperature = $systemStats?.temperature?.[0];
  $: uptime = $systemStats?.uptime;
</script>

<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
  <!-- CPU -->
  <div class="card">
    <div class="flex items-center justify-between mb-3">
      <div class="flex items-center gap-2">
        <div class="p-2 bg-blue-600/20 rounded-lg">
          <Cpu class="w-5 h-5 text-blue-400" />
        </div>
        <span class="font-medium text-dark-200">CPU</span>
      </div>
      <span class="stat-value text-2xl">{cpu?.total?.toFixed(1) || 0}%</span>
    </div>
    <div class="progress-bar">
      <div
        class="progress-fill {getProgressColor(cpu?.total || 0)}"
        style="width: {cpu?.total || 0}%"
      ></div>
    </div>
    <div class="mt-2 flex justify-between text-xs text-dark-400">
      <span>User: {cpu?.user?.toFixed(1) || 0}%</span>
      <span>System: {cpu?.system?.toFixed(1) || 0}%</span>
    </div>
  </div>

  <!-- Memory -->
  <div class="card">
    <div class="flex items-center justify-between mb-3">
      <div class="flex items-center gap-2">
        <div class="p-2 bg-purple-600/20 rounded-lg">
          <MemoryStick class="w-5 h-5 text-purple-400" />
        </div>
        <span class="font-medium text-dark-200">RAM</span>
      </div>
      <span class="stat-value text-2xl">{memory?.percent?.toFixed(1) || 0}%</span>
    </div>
    <div class="progress-bar">
      <div
        class="progress-fill {getProgressColor(memory?.percent || 0)}"
        style="width: {memory?.percent || 0}%"
      ></div>
    </div>
    <div class="mt-2 flex justify-between text-xs text-dark-400">
      <span>{formatBytes(memory?.used || 0)}</span>
      <span>{formatBytes(memory?.total || 0)}</span>
    </div>
  </div>

  <!-- Disk -->
  <div class="card">
    <div class="flex items-center justify-between mb-3">
      <div class="flex items-center gap-2">
        <div class="p-2 bg-orange-600/20 rounded-lg">
          <HardDrive class="w-5 h-5 text-orange-400" />
        </div>
        <span class="font-medium text-dark-200">Disk</span>
      </div>
      <span class="stat-value text-2xl">{disk?.percent?.toFixed(1) || 0}%</span>
    </div>
    <div class="progress-bar">
      <div
        class="progress-fill {getProgressColor(disk?.percent || 0)}"
        style="width: {disk?.percent || 0}%"
      ></div>
    </div>
    <div class="mt-2 flex justify-between text-xs text-dark-400">
      <span>{formatBytes(disk?.used || 0)}</span>
      <span>{formatBytes(disk?.total || 0)}</span>
    </div>
  </div>

  <!-- Temperature -->
  <div class="card">
    <div class="flex items-center justify-between mb-3">
      <div class="flex items-center gap-2">
        <div class="p-2 bg-red-600/20 rounded-lg">
          <Thermometer class="w-5 h-5 text-red-400" />
        </div>
        <span class="font-medium text-dark-200">Temperatur</span>
      </div>
      <span class="stat-value text-2xl">{temperature?.value?.toFixed(1) || '--'}°C</span>
    </div>
    <div class="progress-bar">
      <div
        class="progress-fill {getProgressColor((temperature?.value || 0) / 0.85)}"
        style="width: {Math.min((temperature?.value || 0) / 85 * 100, 100)}%"
      ></div>
    </div>
    <div class="mt-2 flex justify-between text-xs text-dark-400">
      <span>{temperature?.label || 'CPU'}</span>
      <span>Max: 85°C</span>
    </div>
  </div>
</div>

<!-- Additional Stats Row -->
<div class="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
  <!-- Uptime -->
  <div class="card flex items-center gap-4">
    <div class="p-3 bg-green-600/20 rounded-lg">
      <Clock class="w-6 h-6 text-green-400" />
    </div>
    <div>
      <p class="stat-label">Uptime</p>
      <p class="text-xl font-semibold text-white">{formatUptime(uptime)}</p>
    </div>
  </div>

  <!-- Network -->
  <div class="card flex items-center gap-4">
    <div class="p-3 bg-cyan-600/20 rounded-lg">
      <Wifi class="w-6 h-6 text-cyan-400" />
    </div>
    <div class="flex-1">
      <p class="stat-label">Netzwerk</p>
      {#if $systemStats?.network?.length > 0}
        {@const net = $systemStats.network[0]}
        <div class="flex gap-4 text-sm">
          <span class="text-green-400">↓ {formatBytes(net.rxRate || 0)}/s</span>
          <span class="text-blue-400">↑ {formatBytes(net.txRate || 0)}/s</span>
        </div>
      {:else}
        <p class="text-sm text-dark-400">Keine Daten</p>
      {/if}
    </div>
  </div>
</div>
