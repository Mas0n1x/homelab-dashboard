<script>
  import { containers, containerAction, getContainerLogs } from '$lib/stores/stats.js';
  import { Play, Square, RotateCcw, FileText, X, ChevronDown, ChevronUp } from 'lucide-svelte';

  let showLogs = false;
  let logsContent = '';
  let logsContainerName = '';
  let loadingLogs = false;
  let expandedContainer = null;
  let actionLoading = {};

  async function handleAction(containerId, action) {
    actionLoading[containerId] = action;
    try {
      await containerAction(containerId, action);
    } catch (error) {
      console.error(`Failed to ${action} container:`, error);
    }
    actionLoading[containerId] = null;
  }

  async function openLogs(containerId, name) {
    logsContainerName = name;
    loadingLogs = true;
    showLogs = true;
    try {
      logsContent = await getContainerLogs(containerId, 200);
    } catch (error) {
      logsContent = 'Fehler beim Laden der Logs: ' + error.message;
    }
    loadingLogs = false;
  }

  function closeLogs() {
    showLogs = false;
    logsContent = '';
  }

  function toggleExpand(id) {
    expandedContainer = expandedContainer === id ? null : id;
  }

  function getStatusBadge(state) {
    switch (state) {
      case 'running':
        return 'badge-success';
      case 'exited':
        return 'badge-danger';
      case 'paused':
        return 'badge-warning';
      default:
        return 'badge-info';
    }
  }

  function formatPorts(ports) {
    return ports
      .filter(p => p.public)
      .map(p => `${p.public}:${p.private}`)
      .join(', ') || '-';
  }
</script>

<div class="space-y-3">
  {#each $containers as container (container.id)}
    <div class="card hover:border-dark-600 transition-colors">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-3 flex-1 min-w-0">
          <button
            class="btn btn-ghost btn-sm p-1"
            on:click={() => toggleExpand(container.id)}
          >
            {#if expandedContainer === container.id}
              <ChevronUp class="w-4 h-4" />
            {:else}
              <ChevronDown class="w-4 h-4" />
            {/if}
          </button>

          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-2">
              <h3 class="font-medium text-white truncate">{container.name}</h3>
              <span class="badge {getStatusBadge(container.state)}">{container.state}</span>
            </div>
            <p class="text-xs text-dark-400 truncate">{container.image}</p>
          </div>
        </div>

        <div class="flex items-center gap-1">
          {#if container.state === 'running'}
            <button
              class="btn btn-ghost btn-sm"
              on:click={() => handleAction(container.id, 'stop')}
              disabled={actionLoading[container.id]}
              title="Stoppen"
            >
              {#if actionLoading[container.id] === 'stop'}
                <RotateCcw class="w-4 h-4 animate-spin" />
              {:else}
                <Square class="w-4 h-4 text-red-400" />
              {/if}
            </button>
            <button
              class="btn btn-ghost btn-sm"
              on:click={() => handleAction(container.id, 'restart')}
              disabled={actionLoading[container.id]}
              title="Neustarten"
            >
              {#if actionLoading[container.id] === 'restart'}
                <RotateCcw class="w-4 h-4 animate-spin" />
              {:else}
                <RotateCcw class="w-4 h-4 text-yellow-400" />
              {/if}
            </button>
          {:else}
            <button
              class="btn btn-ghost btn-sm"
              on:click={() => handleAction(container.id, 'start')}
              disabled={actionLoading[container.id]}
              title="Starten"
            >
              {#if actionLoading[container.id] === 'start'}
                <RotateCcw class="w-4 h-4 animate-spin" />
              {:else}
                <Play class="w-4 h-4 text-green-400" />
              {/if}
            </button>
          {/if}
          <button
            class="btn btn-ghost btn-sm"
            on:click={() => openLogs(container.id, container.name)}
            title="Logs"
          >
            <FileText class="w-4 h-4 text-blue-400" />
          </button>
        </div>
      </div>

      {#if expandedContainer === container.id}
        <div class="mt-4 pt-4 border-t border-dark-700 grid grid-cols-2 gap-4 text-sm">
          <div>
            <span class="text-dark-400">ID:</span>
            <span class="text-dark-200 ml-2 font-mono">{container.shortId}</span>
          </div>
          <div>
            <span class="text-dark-400">Status:</span>
            <span class="text-dark-200 ml-2">{container.status}</span>
          </div>
          <div>
            <span class="text-dark-400">Ports:</span>
            <span class="text-dark-200 ml-2 font-mono">{formatPorts(container.ports)}</span>
          </div>
          <div>
            <span class="text-dark-400">Image:</span>
            <span class="text-dark-200 ml-2 truncate">{container.image}</span>
          </div>
        </div>
      {/if}
    </div>
  {:else}
    <div class="card text-center py-8">
      <p class="text-dark-400">Keine Container gefunden</p>
    </div>
  {/each}
</div>

<!-- Logs Modal -->
{#if showLogs}
  <div class="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
    <div class="bg-dark-900 rounded-xl border border-dark-700 w-full max-w-4xl max-h-[80vh] flex flex-col">
      <div class="flex items-center justify-between p-4 border-b border-dark-700">
        <h3 class="font-semibold text-white">Logs: {logsContainerName}</h3>
        <button class="btn btn-ghost btn-sm" on:click={closeLogs}>
          <X class="w-5 h-5" />
        </button>
      </div>
      <div class="flex-1 overflow-auto p-4">
        {#if loadingLogs}
          <div class="flex items-center justify-center py-8">
            <RotateCcw class="w-6 h-6 animate-spin text-blue-400" />
          </div>
        {:else}
          <pre class="text-xs text-dark-300 font-mono whitespace-pre-wrap break-all">{logsContent || 'Keine Logs vorhanden'}</pre>
        {/if}
      </div>
    </div>
  </div>
{/if}
