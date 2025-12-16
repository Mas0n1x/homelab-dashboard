<script>
  import SystemStats from '$lib/components/SystemStats.svelte';
  import CpuChart from '$lib/components/CpuChart.svelte';
  import MemoryChart from '$lib/components/MemoryChart.svelte';
  import NetworkChart from '$lib/components/NetworkChart.svelte';
  import { dockerInfo } from '$lib/stores/stats.js';
  import { Box, Image, Server } from 'lucide-svelte';
</script>

<svelte:head>
  <title>System - Homelab Dashboard</title>
</svelte:head>

<div class="space-y-6">
  <h2 class="text-2xl font-bold text-white">System Übersicht</h2>

  <!-- System Stats Cards -->
  <SystemStats />

  <!-- Docker Summary -->
  {#if $dockerInfo}
    <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
      <div class="card flex items-center gap-4">
        <div class="p-3 bg-blue-600/20 rounded-lg">
          <Box class="w-6 h-6 text-blue-400" />
        </div>
        <div>
          <p class="stat-label">Container</p>
          <div class="flex gap-2 items-baseline">
            <span class="text-xl font-semibold text-green-400">{$dockerInfo.containersRunning}</span>
            <span class="text-dark-400">/</span>
            <span class="text-lg text-dark-300">{$dockerInfo.containers}</span>
          </div>
        </div>
      </div>

      <div class="card flex items-center gap-4">
        <div class="p-3 bg-purple-600/20 rounded-lg">
          <Image class="w-6 h-6 text-purple-400" />
        </div>
        <div>
          <p class="stat-label">Images</p>
          <p class="text-xl font-semibold text-white">{$dockerInfo.images}</p>
        </div>
      </div>

      <div class="card flex items-center gap-4">
        <div class="p-3 bg-cyan-600/20 rounded-lg">
          <Server class="w-6 h-6 text-cyan-400" />
        </div>
        <div>
          <p class="stat-label">Docker Version</p>
          <p class="text-xl font-semibold text-white">{$dockerInfo.dockerVersion}</p>
        </div>
      </div>
    </div>
  {/if}

  <!-- Charts -->
  <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
    <CpuChart />
    <MemoryChart />
  </div>

  <NetworkChart />
</div>
