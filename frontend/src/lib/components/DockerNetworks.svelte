<script>
  import { onMount } from 'svelte';
  import { Network, RefreshCw, Box, Globe, Lock } from 'lucide-svelte';

  let networks = [];
  let loading = true;
  let error = null;
  let expandedNetwork = null;

  const API_BASE = '/api/docker';

  async function fetchNetworks() {
    loading = true;
    error = null;
    try {
      const res = await fetch(`${API_BASE}/networks`);
      if (!res.ok) throw new Error('Failed to fetch networks');
      networks = await res.json();
    } catch (e) {
      error = e.message;
    } finally {
      loading = false;
    }
  }

  function getDriverColor(driver) {
    switch (driver) {
      case 'bridge': return 'text-blue-400 bg-blue-500/10 border-blue-500/20';
      case 'host': return 'text-green-400 bg-green-500/10 border-green-500/20';
      case 'none': return 'text-dark-400 bg-dark-700 border-dark-600';
      case 'overlay': return 'text-purple-400 bg-purple-500/10 border-purple-500/20';
      default: return 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20';
    }
  }

  function toggleExpand(networkId) {
    if (expandedNetwork === networkId) {
      expandedNetwork = null;
    } else {
      expandedNetwork = networkId;
    }
  }

  onMount(fetchNetworks);
</script>

<div class="space-y-4">
  <!-- Header -->
  <div class="flex flex-wrap items-center justify-between gap-4">
    <div class="flex items-center gap-4">
      <div class="flex items-center gap-2 px-3 py-1.5 bg-dark-800 rounded-lg">
        <Network class="w-4 h-4 text-green-400" />
        <span class="text-sm text-dark-300">{networks.length} Networks</span>
      </div>
    </div>

    <button
      on:click={fetchNetworks}
      class="btn btn-ghost"
      disabled={loading}
    >
      <RefreshCw class="w-4 h-4 {loading ? 'animate-spin' : ''}" />
      <span class="hidden sm:inline">Aktualisieren</span>
    </button>
  </div>

  <!-- Network Liste -->
  {#if loading && networks.length === 0}
    <div class="card flex items-center justify-center py-12">
      <RefreshCw class="w-8 h-8 text-dark-400 animate-spin" />
    </div>
  {:else if error}
    <div class="card bg-red-500/10 border-red-500/20">
      <p class="text-red-400">{error}</p>
    </div>
  {:else if networks.length === 0}
    <div class="card text-center py-12">
      <Network class="w-12 h-12 text-dark-500 mx-auto mb-3" />
      <p class="text-dark-400">Keine Docker Networks gefunden</p>
    </div>
  {:else}
    <div class="grid gap-3">
      {#each networks as network (network.id)}
        <div
          class="card hover:border-dark-600 transition-all cursor-pointer"
          on:click={() => toggleExpand(network.id)}
          on:keydown={(e) => e.key === 'Enter' && toggleExpand(network.id)}
          role="button"
          tabindex="0"
        >
          <div class="flex flex-wrap items-center justify-between gap-4">
            <div class="flex items-center gap-3 min-w-0">
              <div class="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center flex-shrink-0">
                <Network class="w-5 h-5 text-green-400" />
              </div>
              <div class="min-w-0">
                <h3 class="text-sm font-medium text-white flex items-center gap-2">
                  {network.name}
                  {#if network.internal}
                    <Lock class="w-3 h-3 text-dark-400" title="Internal Network" />
                  {/if}
                </h3>
                <p class="text-xs text-dark-400">
                  {network.shortId} · {network.scope}
                </p>
              </div>
            </div>

            <div class="flex items-center gap-3">
              <span class="text-xs px-2 py-0.5 rounded border {getDriverColor(network.driver)}">
                {network.driver}
              </span>

              {#if network.containers.length > 0}
                <div class="flex items-center gap-1 text-xs text-dark-300 bg-dark-800 px-2 py-1 rounded">
                  <Box class="w-3 h-3" />
                  {network.containers.length}
                </div>
              {/if}

              {#if network.ipam && network.ipam.length > 0}
                <div class="hidden sm:flex items-center gap-1 text-xs text-dark-400">
                  <Globe class="w-3 h-3" />
                  {network.ipam[0].Subnet || '-'}
                </div>
              {/if}
            </div>
          </div>

          <!-- Expanded Details -->
          {#if expandedNetwork === network.id}
            <div class="mt-4 pt-4 border-t border-dark-700">
              <!-- IPAM Config -->
              {#if network.ipam && network.ipam.length > 0}
                <div class="mb-4">
                  <h4 class="text-xs font-medium text-dark-400 uppercase tracking-wider mb-2">IPAM Konfiguration</h4>
                  <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {#each network.ipam as config}
                      <div class="bg-dark-800 rounded px-3 py-2">
                        <p class="text-xs text-dark-400">Subnet</p>
                        <p class="text-sm text-white">{config.Subnet || '-'}</p>
                        {#if config.Gateway}
                          <p class="text-xs text-dark-400 mt-1">Gateway</p>
                          <p class="text-sm text-white">{config.Gateway}</p>
                        {/if}
                      </div>
                    {/each}
                  </div>
                </div>
              {/if}

              <!-- Connected Containers -->
              {#if network.containers.length > 0}
                <div>
                  <h4 class="text-xs font-medium text-dark-400 uppercase tracking-wider mb-2">
                    Verbundene Container ({network.containers.length})
                  </h4>
                  <div class="grid gap-2">
                    {#each network.containers as container}
                      <div class="flex items-center justify-between bg-dark-800 rounded px-3 py-2">
                        <div class="flex items-center gap-2">
                          <Box class="w-4 h-4 text-blue-400" />
                          <span class="text-sm text-white">{container.name}</span>
                        </div>
                        <div class="flex items-center gap-3 text-xs text-dark-400">
                          {#if container.ipv4}
                            <span class="font-mono">{container.ipv4}</span>
                          {/if}
                          {#if container.ipv6}
                            <span class="font-mono hidden sm:inline">{container.ipv6}</span>
                          {/if}
                        </div>
                      </div>
                    {/each}
                  </div>
                </div>
              {:else}
                <p class="text-sm text-dark-500">Keine Container verbunden</p>
              {/if}
            </div>
          {/if}
        </div>
      {/each}
    </div>
  {/if}
</div>
