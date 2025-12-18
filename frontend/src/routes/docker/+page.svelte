<script>
  import DockerContainers from '$lib/components/DockerContainers.svelte';
  import DockerImages from '$lib/components/DockerImages.svelte';
  import DockerVolumes from '$lib/components/DockerVolumes.svelte';
  import DockerNetworks from '$lib/components/DockerNetworks.svelte';
  import DockerPorts from '$lib/components/DockerPorts.svelte';
  import QuickActions from '$lib/components/QuickActions.svelte';
  import { dockerInfo, containers } from '$lib/stores/stats.js';
  import { Box, CheckCircle, PauseCircle, XCircle, Package, Database, Network, Globe, Trash2 } from 'lucide-svelte';

  let activeTab = 'containers';

  const tabs = [
    { id: 'containers', label: 'Container', icon: Box },
    { id: 'images', label: 'Images', icon: Package },
    { id: 'volumes', label: 'Volumes', icon: Database },
    { id: 'networks', label: 'Networks', icon: Network },
    { id: 'ports', label: 'Ports', icon: Globe },
    { id: 'cleanup', label: 'Cleanup', icon: Trash2 }
  ];

  $: runningCount = $containers.filter(c => c.state === 'running').length;
  $: stoppedCount = $containers.filter(c => c.state === 'exited').length;
  $: otherCount = $containers.filter(c => c.state !== 'running' && c.state !== 'exited').length;
</script>

<svelte:head>
  <title>Docker - Homelab Dashboard</title>
</svelte:head>

<div class="space-y-6">
  <div class="flex flex-wrap items-center justify-between gap-4">
    <h2 class="text-2xl font-bold text-white">Docker</h2>
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

  <!-- Tabs -->
  <div class="flex flex-wrap gap-2 border-b border-dark-700 pb-2">
    {#each tabs as tab}
      <button
        on:click={() => activeTab = tab.id}
        class="flex items-center gap-2 px-4 py-2 rounded-t-lg transition-all
          {activeTab === tab.id
            ? 'bg-dark-800 text-white border-b-2 border-blue-500'
            : 'text-dark-400 hover:text-white hover:bg-dark-800/50'}"
      >
        <svelte:component this={tab.icon} class="w-4 h-4" />
        <span class="hidden sm:inline">{tab.label}</span>
      </button>
    {/each}
  </div>

  <!-- Tab Content -->
  <div class="min-h-[400px]">
    {#if activeTab === 'containers'}
      <DockerContainers />
    {:else if activeTab === 'images'}
      <DockerImages />
    {:else if activeTab === 'volumes'}
      <DockerVolumes />
    {:else if activeTab === 'networks'}
      <DockerNetworks />
    {:else if activeTab === 'ports'}
      <DockerPorts />
    {:else if activeTab === 'cleanup'}
      <QuickActions />
    {/if}
  </div>
</div>
