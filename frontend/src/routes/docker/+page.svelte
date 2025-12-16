<script>
  import DockerContainers from '$lib/components/DockerContainers.svelte';
  import { dockerInfo, containers } from '$lib/stores/stats.js';
  import { Box, CheckCircle, PauseCircle, XCircle } from 'lucide-svelte';

  $: runningCount = $containers.filter(c => c.state === 'running').length;
  $: stoppedCount = $containers.filter(c => c.state === 'exited').length;
  $: otherCount = $containers.filter(c => c.state !== 'running' && c.state !== 'exited').length;
</script>

<svelte:head>
  <title>Docker - Homelab Dashboard</title>
</svelte:head>

<div class="space-y-6">
  <div class="flex items-center justify-between">
    <h2 class="text-2xl font-bold text-white">Docker Container</h2>
    <div class="flex items-center gap-2">
      <span class="badge badge-success flex items-center gap-1">
        <CheckCircle class="w-3 h-3" />
        {runningCount} Running
      </span>
      <span class="badge badge-danger flex items-center gap-1">
        <XCircle class="w-3 h-3" />
        {stoppedCount} Stopped
      </span>
      {#if otherCount > 0}
        <span class="badge badge-warning flex items-center gap-1">
          <PauseCircle class="w-3 h-3" />
          {otherCount} Other
        </span>
      {/if}
    </div>
  </div>

  {#if $dockerInfo}
    <div class="grid grid-cols-2 sm:grid-cols-4 gap-4">
      <div class="card text-center">
        <p class="stat-value">{$dockerInfo.containers}</p>
        <p class="stat-label">Container Total</p>
      </div>
      <div class="card text-center">
        <p class="stat-value text-green-400">{$dockerInfo.containersRunning}</p>
        <p class="stat-label">Running</p>
      </div>
      <div class="card text-center">
        <p class="stat-value">{$dockerInfo.images}</p>
        <p class="stat-label">Images</p>
      </div>
      <div class="card text-center">
        <p class="stat-value text-sm">{$dockerInfo.dockerVersion}</p>
        <p class="stat-label">Docker Version</p>
      </div>
    </div>
  {/if}

  <DockerContainers />
</div>
