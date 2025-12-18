<script>
  import { createEventDispatcher, onMount, onDestroy } from 'svelte';
  import { getContainerDetails, getContainerStats, getContainerLogs, containerAction } from '$lib/stores/stats.js';
  import { X, RotateCcw, Square, Play, Cpu, HardDrive, Clock, RefreshCw, Terminal, BarChart3, Activity, Network, Box } from 'lucide-svelte';
  import Chart from 'chart.js/auto';

  export let containerId;
  export let containerName;

  const dispatch = createEventDispatcher();

  let activeTab = 'overview';
  let details = null;
  let stats = null;
  let logs = '';
  let loading = true;
  let logsLoading = false;
  let actionLoading = null;
  let statsInterval = null;

  // Chart references
  let cpuCanvas;
  let memCanvas;
  let networkCanvas;
  let cpuChart;
  let memChart;
  let networkChart;
  let cpuHistory = Array(30).fill(0);
  let memHistory = Array(30).fill(0);
  let networkRxHistory = Array(30).fill(0);
  let networkTxHistory = Array(30).fill(0);
  let lastNetworkRx = 0;
  let lastNetworkTx = 0;

  onMount(async () => {
    await loadDetails();
  });

  onDestroy(() => {
    if (statsInterval) clearInterval(statsInterval);
    if (cpuChart) cpuChart.destroy();
    if (memChart) memChart.destroy();
    if (networkChart) networkChart.destroy();
  });

  async function loadDetails() {
    loading = true;
    try {
      details = await getContainerDetails(containerId);
      if (details.running) {
        await loadStats();
        statsInterval = setInterval(loadStats, 2000);
      }
    } catch (error) {
      console.error('Failed to load container details:', error);
    }
    loading = false;
  }

  async function loadStats() {
    if (!details?.running) return;
    try {
      const newStats = await getContainerStats(containerId);
      stats = newStats;

      // Update histories
      cpuHistory = [...cpuHistory.slice(1), parseFloat(newStats.cpu) || 0];
      memHistory = [...memHistory.slice(1), parseFloat(newStats.memory?.percent) || 0];

      // Calculate network rate (bytes per second)
      const currentRx = Object.values(newStats.network || {}).reduce((sum, n) => sum + (n.rx_bytes || 0), 0);
      const currentTx = Object.values(newStats.network || {}).reduce((sum, n) => sum + (n.tx_bytes || 0), 0);

      if (lastNetworkRx > 0) {
        const rxRate = (currentRx - lastNetworkRx) / 2; // 2 second interval
        const txRate = (currentTx - lastNetworkTx) / 2;
        networkRxHistory = [...networkRxHistory.slice(1), rxRate / 1024]; // KB/s
        networkTxHistory = [...networkTxHistory.slice(1), txRate / 1024];
      }
      lastNetworkRx = currentRx;
      lastNetworkTx = currentTx;

      // Update charts if they exist
      updateCharts();
    } catch (error) {
      console.error('Failed to load stats:', error);
    }
  }

  function updateCharts() {
    if (cpuChart) {
      cpuChart.data.datasets[0].data = cpuHistory;
      cpuChart.update('none');
    }
    if (memChart) {
      memChart.data.datasets[0].data = memHistory;
      memChart.update('none');
    }
    if (networkChart) {
      networkChart.data.datasets[0].data = networkRxHistory;
      networkChart.data.datasets[1].data = networkTxHistory;
      networkChart.update('none');
    }
  }

  function initCharts() {
    if (!cpuCanvas || !memCanvas || !networkCanvas) return;

    const chartOptions = {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      plugins: {
        legend: { display: false },
        tooltip: { enabled: true, mode: 'index', intersect: false }
      },
      scales: {
        x: { display: false },
        y: {
          min: 0,
          grid: { color: 'rgba(100, 116, 139, 0.1)' },
          ticks: { color: 'rgb(113, 113, 122)', font: { size: 10 } }
        }
      }
    };

    cpuChart = new Chart(cpuCanvas.getContext('2d'), {
      type: 'line',
      data: {
        labels: Array(30).fill(''),
        datasets: [{
          data: cpuHistory,
          borderColor: 'rgb(34, 197, 94)',
          backgroundColor: 'rgba(34, 197, 94, 0.15)',
          fill: true,
          tension: 0.4,
          pointRadius: 0,
          borderWidth: 2
        }]
      },
      options: {
        ...chartOptions,
        scales: {
          ...chartOptions.scales,
          y: { ...chartOptions.scales.y, max: 100, ticks: { ...chartOptions.scales.y.ticks, callback: v => v + '%' } }
        }
      }
    });

    memChart = new Chart(memCanvas.getContext('2d'), {
      type: 'line',
      data: {
        labels: Array(30).fill(''),
        datasets: [{
          data: memHistory,
          borderColor: 'rgb(59, 130, 246)',
          backgroundColor: 'rgba(59, 130, 246, 0.15)',
          fill: true,
          tension: 0.4,
          pointRadius: 0,
          borderWidth: 2
        }]
      },
      options: {
        ...chartOptions,
        scales: {
          ...chartOptions.scales,
          y: { ...chartOptions.scales.y, max: 100, ticks: { ...chartOptions.scales.y.ticks, callback: v => v + '%' } }
        }
      }
    });

    networkChart = new Chart(networkCanvas.getContext('2d'), {
      type: 'line',
      data: {
        labels: Array(30).fill(''),
        datasets: [
          {
            label: 'RX',
            data: networkRxHistory,
            borderColor: 'rgb(168, 85, 247)',
            backgroundColor: 'rgba(168, 85, 247, 0.1)',
            fill: true,
            tension: 0.4,
            pointRadius: 0,
            borderWidth: 2
          },
          {
            label: 'TX',
            data: networkTxHistory,
            borderColor: 'rgb(236, 72, 153)',
            backgroundColor: 'rgba(236, 72, 153, 0.1)',
            fill: true,
            tension: 0.4,
            pointRadius: 0,
            borderWidth: 2
          }
        ]
      },
      options: {
        ...chartOptions,
        plugins: {
          ...chartOptions.plugins,
          legend: { display: true, position: 'top', labels: { color: 'rgb(113, 113, 122)', boxWidth: 12, padding: 8 } }
        },
        scales: {
          ...chartOptions.scales,
          y: { ...chartOptions.scales.y, ticks: { ...chartOptions.scales.y.ticks, callback: v => v.toFixed(0) + ' KB/s' } }
        }
      }
    });
  }

  async function loadLogs() {
    logsLoading = true;
    try {
      logs = await getContainerLogs(containerId, 200);
    } catch (error) {
      logs = 'Fehler beim Laden der Logs: ' + error.message;
    }
    logsLoading = false;
  }

  async function handleTabChange(tab) {
    activeTab = tab;
    if (tab === 'logs' && !logs) {
      await loadLogs();
    }
    if (tab === 'statistics') {
      setTimeout(initCharts, 50);
    }
  }

  async function handleAction(action) {
    actionLoading = action;
    try {
      await containerAction(containerId, action);
      setTimeout(loadDetails, 1000);
    } catch (error) {
      console.error(`Failed to ${action} container:`, error);
    }
    actionLoading = null;
  }

  function close() {
    dispatch('close');
  }

  function formatBytes(bytes) {
    if (!bytes) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB'];
    let i = 0;
    while (bytes >= 1024 && i < units.length - 1) {
      bytes /= 1024;
      i++;
    }
    return `${bytes.toFixed(2)} ${units[i]}`;
  }

  function formatUptime(startedAt) {
    if (!startedAt) return '-';
    const start = new Date(startedAt);
    const now = new Date();
    const diff = now - start;

    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ${hours % 24}h`;
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  }

  function handleKeydown(e) {
    if (e.key === 'Escape') close();
  }

  function handleBackdropClick(e) {
    if (e.target === e.currentTarget) close();
  }
</script>

<svelte:window on:keydown={handleKeydown} />

<!-- svelte-ignore a11y-click-events-have-key-events -->
<!-- svelte-ignore a11y-no-static-element-interactions -->
<div class="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4" on:click={handleBackdropClick}>
  <div class="bg-gradient-to-b from-dark-900 to-dark-950 rounded-2xl border border-dark-700/50 w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl shadow-black/50">

    <!-- Header -->
    <div class="relative px-6 py-5 border-b border-dark-700/50">
      <div class="absolute inset-0 bg-gradient-to-r from-green-500/5 via-transparent to-transparent"></div>
      <div class="relative flex items-center justify-between">
        <div class="flex items-center gap-4">
          <div class="w-12 h-12 rounded-xl bg-gradient-to-br from-green-500/20 to-green-600/10 border border-green-500/20 flex items-center justify-center">
            <Box class="w-6 h-6 text-green-400" />
          </div>
          <div>
            <h2 class="text-xl font-bold text-white">{containerName}</h2>
            <div class="flex items-center gap-2 mt-1">
              {#if details}
                <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold {details.running ? 'bg-green-500/20 text-green-400 ring-1 ring-green-500/30' : 'bg-red-500/20 text-red-400 ring-1 ring-red-500/30'}">
                  <span class="w-1.5 h-1.5 rounded-full {details.running ? 'bg-green-400 animate-pulse' : 'bg-red-400'}"></span>
                  {details.running ? 'Running' : 'Stopped'}
                </span>
                <span class="text-xs text-dark-400">{details?.shortId}</span>
              {/if}
            </div>
          </div>
        </div>
        <button class="p-2.5 rounded-xl text-dark-400 hover:text-white hover:bg-dark-800/80 transition-all" on:click={close}>
          <X class="w-5 h-5" />
        </button>
      </div>
    </div>

    <!-- Tabs -->
    <div class="flex items-center gap-1 px-6 py-3 border-b border-dark-700/50 bg-dark-900/50">
      <button
        class="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all {activeTab === 'overview' ? 'bg-green-500/15 text-green-400 ring-1 ring-green-500/30' : 'text-dark-400 hover:text-white hover:bg-dark-800/50'}"
        on:click={() => handleTabChange('overview')}
      >
        <BarChart3 class="w-4 h-4" />
        Overview
      </button>
      <button
        class="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all {activeTab === 'statistics' ? 'bg-blue-500/15 text-blue-400 ring-1 ring-blue-500/30' : 'text-dark-400 hover:text-white hover:bg-dark-800/50'}"
        on:click={() => handleTabChange('statistics')}
      >
        <Activity class="w-4 h-4" />
        Statistics
      </button>
      <button
        class="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all {activeTab === 'logs' ? 'bg-purple-500/15 text-purple-400 ring-1 ring-purple-500/30' : 'text-dark-400 hover:text-white hover:bg-dark-800/50'}"
        on:click={() => handleTabChange('logs')}
      >
        <Terminal class="w-4 h-4" />
        Logs
      </button>

      <!-- Actions on right -->
      <div class="ml-auto flex items-center gap-2">
        {#if details}
          {#if details.running}
            <button
              class="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium bg-dark-800/80 text-dark-200 hover:bg-dark-700 border border-dark-600/50 transition-all disabled:opacity-50"
              on:click={() => handleAction('restart')}
              disabled={actionLoading}
            >
              <RotateCcw class="w-4 h-4 {actionLoading === 'restart' ? 'animate-spin' : ''}" />
            </button>
            <button
              class="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/30 transition-all disabled:opacity-50"
              on:click={() => handleAction('stop')}
              disabled={actionLoading}
            >
              <Square class="w-4 h-4 {actionLoading === 'stop' ? 'animate-pulse' : ''}" />
            </button>
          {:else}
            <button
              class="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-green-500/10 text-green-400 hover:bg-green-500/20 border border-green-500/30 transition-all disabled:opacity-50"
              on:click={() => handleAction('start')}
              disabled={actionLoading}
            >
              <Play class="w-4 h-4 {actionLoading === 'start' ? 'animate-pulse' : ''}" />
              Start
            </button>
          {/if}
        {/if}
      </div>
    </div>

    <!-- Content -->
    <div class="flex-1 overflow-auto p-6">
      {#if loading}
        <div class="flex items-center justify-center py-16">
          <div class="flex flex-col items-center gap-3">
            <RotateCcw class="w-8 h-8 animate-spin text-green-400" />
            <span class="text-sm text-dark-400">Loading container details...</span>
          </div>
        </div>

      {:else if activeTab === 'overview'}
        <!-- Stats Cards -->
        <div class="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div class="group relative bg-gradient-to-br from-dark-800/80 to-dark-900/80 rounded-xl p-4 border border-dark-700/50 hover:border-green-500/30 transition-all">
            <div class="absolute inset-0 bg-gradient-to-br from-green-500/5 to-transparent rounded-xl opacity-0 group-hover:opacity-100 transition-opacity"></div>
            <div class="relative">
              <div class="flex items-center gap-2 mb-3">
                <div class="p-2 rounded-lg bg-green-500/10">
                  <Cpu class="w-4 h-4 text-green-400" />
                </div>
                <span class="text-xs font-medium text-dark-400 uppercase tracking-wider">CPU</span>
              </div>
              <span class="text-2xl font-bold text-white">{stats?.cpu || '0'}%</span>
            </div>
          </div>

          <div class="group relative bg-gradient-to-br from-dark-800/80 to-dark-900/80 rounded-xl p-4 border border-dark-700/50 hover:border-blue-500/30 transition-all">
            <div class="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-transparent rounded-xl opacity-0 group-hover:opacity-100 transition-opacity"></div>
            <div class="relative">
              <div class="flex items-center gap-2 mb-3">
                <div class="p-2 rounded-lg bg-blue-500/10">
                  <HardDrive class="w-4 h-4 text-blue-400" />
                </div>
                <span class="text-xs font-medium text-dark-400 uppercase tracking-wider">Memory</span>
              </div>
              <span class="text-2xl font-bold text-white">{stats ? formatBytes(stats.memory?.usage) : '-'}</span>
              {#if stats?.memory?.percent}
                <span class="text-xs text-dark-400 ml-2">({stats.memory.percent}%)</span>
              {/if}
            </div>
          </div>

          <div class="group relative bg-gradient-to-br from-dark-800/80 to-dark-900/80 rounded-xl p-4 border border-dark-700/50 hover:border-yellow-500/30 transition-all">
            <div class="absolute inset-0 bg-gradient-to-br from-yellow-500/5 to-transparent rounded-xl opacity-0 group-hover:opacity-100 transition-opacity"></div>
            <div class="relative">
              <div class="flex items-center gap-2 mb-3">
                <div class="p-2 rounded-lg bg-yellow-500/10">
                  <Clock class="w-4 h-4 text-yellow-400" />
                </div>
                <span class="text-xs font-medium text-dark-400 uppercase tracking-wider">Uptime</span>
              </div>
              <span class="text-2xl font-bold text-white">{details?.running ? formatUptime(details.startedAt) : '-'}</span>
            </div>
          </div>

          <div class="group relative bg-gradient-to-br from-dark-800/80 to-dark-900/80 rounded-xl p-4 border border-dark-700/50 hover:border-purple-500/30 transition-all">
            <div class="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-transparent rounded-xl opacity-0 group-hover:opacity-100 transition-opacity"></div>
            <div class="relative">
              <div class="flex items-center gap-2 mb-3">
                <div class="p-2 rounded-lg bg-purple-500/10">
                  <RefreshCw class="w-4 h-4 text-purple-400" />
                </div>
                <span class="text-xs font-medium text-dark-400 uppercase tracking-wider">Restarts</span>
              </div>
              <span class="text-2xl font-bold text-white">{details?.restartCount ?? 0}</span>
            </div>
          </div>
        </div>

        <!-- Process Information -->
        <div class="bg-dark-800/50 rounded-xl border border-dark-700/50 overflow-hidden mb-4">
          <div class="px-4 py-3 border-b border-dark-700/50 bg-dark-800/30">
            <h3 class="text-sm font-semibold text-white">Container Details</h3>
          </div>
          <div class="divide-y divide-dark-700/30">
            <div class="flex justify-between items-center px-4 py-3 hover:bg-dark-800/30 transition-colors">
              <span class="text-sm text-dark-400">Container ID</span>
              <span class="text-sm text-dark-200 font-mono bg-dark-800/50 px-2 py-0.5 rounded">{details?.shortId}</span>
            </div>
            <div class="flex justify-between items-center px-4 py-3 hover:bg-dark-800/30 transition-colors">
              <span class="text-sm text-dark-400">Process ID (PID)</span>
              <span class="text-sm text-dark-200 font-mono">{details?.pid || '-'}</span>
            </div>
            <div class="flex justify-between items-center px-4 py-3 hover:bg-dark-800/30 transition-colors">
              <span class="text-sm text-dark-400">Image</span>
              <span class="text-sm text-dark-200 font-mono truncate max-w-[280px]">{details?.image}</span>
            </div>
            {#if details?.ports?.length > 0 && details.ports.some(p => p.host)}
              <div class="flex justify-between items-center px-4 py-3 hover:bg-dark-800/30 transition-colors">
                <span class="text-sm text-dark-400">Ports</span>
                <div class="flex flex-wrap gap-1.5 justify-end">
                  {#each details.ports.filter(p => p.host) as port}
                    <span class="text-xs font-mono bg-green-500/10 text-green-400 px-2 py-0.5 rounded-full ring-1 ring-green-500/20">
                      {port.host} → {port.container}
                    </span>
                  {/each}
                </div>
              </div>
            {/if}
            {#if details?.networks?.length > 0}
              <div class="flex justify-between items-center px-4 py-3 hover:bg-dark-800/30 transition-colors">
                <span class="text-sm text-dark-400">Networks</span>
                <div class="flex flex-wrap gap-1.5 justify-end">
                  {#each details.networks as network}
                    <span class="text-xs bg-dark-700/50 text-dark-300 px-2 py-0.5 rounded-full">{network}</span>
                  {/each}
                </div>
              </div>
            {/if}
          </div>
        </div>

        <!-- Mounts -->
        {#if details?.mounts?.length > 0}
          <div class="bg-dark-800/50 rounded-xl border border-dark-700/50 overflow-hidden">
            <div class="px-4 py-3 border-b border-dark-700/50 bg-dark-800/30">
              <h3 class="text-sm font-semibold text-white">Volume Mounts</h3>
            </div>
            <div class="divide-y divide-dark-700/30">
              {#each details.mounts as mount}
                <div class="px-4 py-3 hover:bg-dark-800/30 transition-colors">
                  <div class="flex items-center gap-2 mb-1">
                    <span class="text-xs font-medium uppercase px-1.5 py-0.5 rounded {mount.type === 'bind' ? 'bg-blue-500/10 text-blue-400' : 'bg-purple-500/10 text-purple-400'}">{mount.type}</span>
                    {#if !mount.rw}
                      <span class="text-xs bg-yellow-500/10 text-yellow-400 px-1.5 py-0.5 rounded">readonly</span>
                    {/if}
                  </div>
                  <div class="text-xs font-mono text-dark-400 truncate">
                    <span class="text-dark-300">{mount.source}</span>
                    <span class="text-dark-500 mx-2">→</span>
                    <span class="text-dark-300">{mount.destination}</span>
                  </div>
                </div>
              {/each}
            </div>
          </div>
        {/if}

      {:else if activeTab === 'statistics'}
        {#if !details?.running}
          <div class="flex flex-col items-center justify-center py-16 text-center">
            <div class="p-4 rounded-full bg-dark-800/50 mb-4">
              <Activity class="w-8 h-8 text-dark-500" />
            </div>
            <p class="text-dark-400">Container is not running</p>
            <p class="text-sm text-dark-500 mt-1">Start the container to view statistics</p>
          </div>
        {:else}
          <div class="space-y-6">
            <!-- CPU Chart -->
            <div class="bg-dark-800/50 rounded-xl border border-dark-700/50 p-4">
              <div class="flex items-center justify-between mb-4">
                <div class="flex items-center gap-3">
                  <div class="p-2 rounded-lg bg-green-500/10">
                    <Cpu class="w-4 h-4 text-green-400" />
                  </div>
                  <div>
                    <h3 class="text-sm font-semibold text-white">CPU Usage</h3>
                    <p class="text-xs text-dark-400">Last 60 seconds</p>
                  </div>
                </div>
                <span class="text-2xl font-bold text-green-400">{stats?.cpu || '0'}%</span>
              </div>
              <div class="h-32">
                <canvas bind:this={cpuCanvas}></canvas>
              </div>
            </div>

            <!-- Memory Chart -->
            <div class="bg-dark-800/50 rounded-xl border border-dark-700/50 p-4">
              <div class="flex items-center justify-between mb-4">
                <div class="flex items-center gap-3">
                  <div class="p-2 rounded-lg bg-blue-500/10">
                    <HardDrive class="w-4 h-4 text-blue-400" />
                  </div>
                  <div>
                    <h3 class="text-sm font-semibold text-white">Memory Usage</h3>
                    <p class="text-xs text-dark-400">{stats ? formatBytes(stats.memory?.usage) : '-'} / {stats ? formatBytes(stats.memory?.limit) : '-'}</p>
                  </div>
                </div>
                <span class="text-2xl font-bold text-blue-400">{stats?.memory?.percent || '0'}%</span>
              </div>
              <div class="h-32">
                <canvas bind:this={memCanvas}></canvas>
              </div>
            </div>

            <!-- Network Chart -->
            <div class="bg-dark-800/50 rounded-xl border border-dark-700/50 p-4">
              <div class="flex items-center justify-between mb-4">
                <div class="flex items-center gap-3">
                  <div class="p-2 rounded-lg bg-purple-500/10">
                    <Network class="w-4 h-4 text-purple-400" />
                  </div>
                  <div>
                    <h3 class="text-sm font-semibold text-white">Network I/O</h3>
                    <p class="text-xs text-dark-400">Transfer rate (KB/s)</p>
                  </div>
                </div>
                <div class="text-right">
                  <div class="flex items-center gap-4 text-sm">
                    <span class="flex items-center gap-1.5">
                      <span class="w-2 h-2 rounded-full bg-purple-400"></span>
                      <span class="text-dark-400">RX:</span>
                      <span class="font-mono text-purple-400">{networkRxHistory[networkRxHistory.length-1]?.toFixed(1) || '0'}</span>
                    </span>
                    <span class="flex items-center gap-1.5">
                      <span class="w-2 h-2 rounded-full bg-pink-400"></span>
                      <span class="text-dark-400">TX:</span>
                      <span class="font-mono text-pink-400">{networkTxHistory[networkTxHistory.length-1]?.toFixed(1) || '0'}</span>
                    </span>
                  </div>
                </div>
              </div>
              <div class="h-32">
                <canvas bind:this={networkCanvas}></canvas>
              </div>
            </div>
          </div>
        {/if}

      {:else if activeTab === 'logs'}
        <div class="h-full flex flex-col">
          <div class="flex justify-between items-center mb-3">
            <span class="text-sm text-dark-400">Last 200 lines</span>
            <button
              class="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm text-dark-400 hover:text-white hover:bg-dark-800/50 transition-colors"
              on:click={loadLogs}
              disabled={logsLoading}
            >
              <RotateCcw class="w-4 h-4 {logsLoading ? 'animate-spin' : ''}" />
              Refresh
            </button>
          </div>
          {#if logsLoading}
            <div class="flex items-center justify-center py-12">
              <RotateCcw class="w-6 h-6 animate-spin text-purple-400" />
            </div>
          {:else}
            <pre class="flex-1 bg-dark-950/80 border border-dark-700/50 rounded-xl p-4 text-xs text-dark-300 font-mono whitespace-pre-wrap break-all overflow-auto max-h-[400px] scrollbar-thin scrollbar-thumb-dark-700 scrollbar-track-dark-900">{logs || 'No logs available'}</pre>
          {/if}
        </div>
      {/if}
    </div>
  </div>
</div>
