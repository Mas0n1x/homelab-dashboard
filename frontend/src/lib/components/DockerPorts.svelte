<script>
  import { onMount } from 'svelte';
  import { Globe, RefreshCw, Box, ExternalLink } from 'lucide-svelte';

  let ports = [];
  let loading = true;
  let error = null;

  const API_BASE = '/api/docker';

  async function fetchPorts() {
    loading = true;
    error = null;
    try {
      const res = await fetch(`${API_BASE}/ports`);
      if (!res.ok) throw new Error('Failed to fetch ports');
      ports = await res.json();
    } catch (e) {
      error = e.message;
    } finally {
      loading = false;
    }
  }

  function getStateColor(state) {
    switch (state) {
      case 'running': return 'text-green-400 bg-green-500/10';
      case 'exited': return 'text-red-400 bg-red-500/10';
      case 'paused': return 'text-yellow-400 bg-yellow-500/10';
      default: return 'text-dark-400 bg-dark-700';
    }
  }

  function getPortTypeColor(type) {
    return type === 'tcp' ? 'text-blue-400' : 'text-purple-400';
  }

  onMount(fetchPorts);
</script>

<div class="space-y-4">
  <!-- Header -->
  <div class="flex flex-wrap items-center justify-between gap-4">
    <div class="flex items-center gap-4">
      <div class="flex items-center gap-2 px-3 py-1.5 bg-dark-800 rounded-lg">
        <Globe class="w-4 h-4 text-orange-400" />
        <span class="text-sm text-dark-300">{ports.length} Port Mappings</span>
      </div>
    </div>

    <button
      on:click={fetchPorts}
      class="btn btn-ghost"
      disabled={loading}
    >
      <RefreshCw class="w-4 h-4 {loading ? 'animate-spin' : ''}" />
      <span class="hidden sm:inline">Aktualisieren</span>
    </button>
  </div>

  <!-- Ports Liste -->
  {#if loading && ports.length === 0}
    <div class="card flex items-center justify-center py-12">
      <RefreshCw class="w-8 h-8 text-dark-400 animate-spin" />
    </div>
  {:else if error}
    <div class="card bg-red-500/10 border-red-500/20">
      <p class="text-red-400">{error}</p>
    </div>
  {:else if ports.length === 0}
    <div class="card text-center py-12">
      <Globe class="w-12 h-12 text-dark-500 mx-auto mb-3" />
      <p class="text-dark-400">Keine Port Mappings gefunden</p>
    </div>
  {:else}
    <div class="overflow-x-auto">
      <table class="w-full">
        <thead>
          <tr class="border-b border-dark-700">
            <th class="text-left py-3 px-4 text-xs font-medium text-dark-400 uppercase tracking-wider">Port</th>
            <th class="text-left py-3 px-4 text-xs font-medium text-dark-400 uppercase tracking-wider">Container</th>
            <th class="text-left py-3 px-4 text-xs font-medium text-dark-400 uppercase tracking-wider">Container Port</th>
            <th class="text-center py-3 px-4 text-xs font-medium text-dark-400 uppercase tracking-wider">Protokoll</th>
            <th class="text-center py-3 px-4 text-xs font-medium text-dark-400 uppercase tracking-wider">Status</th>
            <th class="text-right py-3 px-4 text-xs font-medium text-dark-400 uppercase tracking-wider">Öffnen</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-dark-800">
          {#each ports as port}
            <tr class="hover:bg-dark-800/50 transition-colors">
              <td class="py-3 px-4">
                <div class="flex items-center gap-2">
                  <Globe class="w-4 h-4 text-orange-400" />
                  <span class="text-lg font-bold text-white">{port.publicPort}</span>
                </div>
              </td>
              <td class="py-3 px-4">
                <div class="flex items-center gap-2">
                  <Box class="w-4 h-4 text-blue-400" />
                  <span class="text-sm text-white">{port.containerName}</span>
                  <code class="text-xs text-dark-500">{port.containerId}</code>
                </div>
              </td>
              <td class="py-3 px-4">
                <span class="text-sm text-dark-300">{port.privatePort}</span>
              </td>
              <td class="py-3 px-4 text-center">
                <span class="text-xs font-mono uppercase {getPortTypeColor(port.type)}">
                  {port.type}
                </span>
              </td>
              <td class="py-3 px-4 text-center">
                <span class="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full {getStateColor(port.containerState)}">
                  <span class="w-1.5 h-1.5 rounded-full {port.containerState === 'running' ? 'bg-green-400' : port.containerState === 'exited' ? 'bg-red-400' : 'bg-dark-400'}"></span>
                  {port.containerState}
                </span>
              </td>
              <td class="py-3 px-4 text-right">
                {#if port.containerState === 'running'}
                  <a
                    href="http://{port.ip === '0.0.0.0' ? 'localhost' : port.ip}:{port.publicPort}"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="btn btn-ghost btn-sm text-blue-400 hover:text-blue-300"
                  >
                    <ExternalLink class="w-4 h-4" />
                  </a>
                {:else}
                  <span class="text-dark-600">-</span>
                {/if}
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}
</div>
