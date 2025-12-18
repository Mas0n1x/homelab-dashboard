<script>
  import { containers, containerAction, getContainerLogs } from '$lib/stores/stats.js';
  import { Play, Square, RotateCcw, FileText, X, ChevronDown, ChevronUp, Layers, List } from 'lucide-svelte';
  import ContainerDetailModal from './ContainerDetailModal.svelte';

  let showLogs = false;
  let logsContent = '';
  let logsContainerName = '';
  let loadingLogs = false;
  let expandedContainer = null;
  let actionLoading = {};
  let groupByProject = true;
  let collapsedProjects = {};

  // Detail Modal
  let showDetailModal = false;
  let selectedContainerId = null;
  let selectedContainerName = '';

  function openDetailModal(container) {
    selectedContainerId = container.id;
    selectedContainerName = container.name;
    showDetailModal = true;
  }

  function closeDetailModal() {
    showDetailModal = false;
    selectedContainerId = null;
    selectedContainerName = '';
  }

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

  function toggleProjectCollapse(project) {
    collapsedProjects[project] = !collapsedProjects[project];
    collapsedProjects = collapsedProjects;
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

  // Group containers by project
  $: groupedContainers = (() => {
    if (!groupByProject) return null;

    const groups = {};
    $containers.forEach(c => {
      const project = c.project || 'Standalone';
      if (!groups[project]) {
        groups[project] = [];
      }
      groups[project].push(c);
    });

    // Sort projects by name, but put Standalone last
    return Object.entries(groups).sort((a, b) => {
      if (a[0] === 'Standalone') return 1;
      if (b[0] === 'Standalone') return -1;
      return a[0].localeCompare(b[0]);
    });
  })();

  function getProjectStats(containersInProject) {
    const running = containersInProject.filter(c => c.state === 'running').length;
    const total = containersInProject.length;
    return { running, total };
  }
</script>

<!-- View Toggle -->
<div class="flex items-center justify-end gap-2 mb-4">
  <span class="text-xs text-dark-400">Ansicht:</span>
  <button
    on:click={() => groupByProject = true}
    class="btn btn-sm {groupByProject ? 'btn-primary' : 'btn-ghost'}"
    title="Nach Projekt gruppieren"
  >
    <Layers class="w-4 h-4" />
  </button>
  <button
    on:click={() => groupByProject = false}
    class="btn btn-sm {!groupByProject ? 'btn-primary' : 'btn-ghost'}"
    title="Listenansicht"
  >
    <List class="w-4 h-4" />
  </button>
</div>

{#if groupByProject && groupedContainers}
  <!-- Grouped View -->
  <div class="space-y-4">
    {#each groupedContainers as [project, projectContainers]}
      {@const stats = getProjectStats(projectContainers)}
      <div class="border border-dark-700 rounded-xl overflow-hidden">
        <!-- Project Header -->
        <button
          on:click={() => toggleProjectCollapse(project)}
          class="w-full flex items-center justify-between p-4 bg-dark-800/50 hover:bg-dark-800 transition-colors"
        >
          <div class="flex items-center gap-3">
            {#if collapsedProjects[project]}
              <ChevronDown class="w-5 h-5 text-dark-400" />
            {:else}
              <ChevronUp class="w-5 h-5 text-dark-400" />
            {/if}
            <Layers class="w-5 h-5 {project === 'Standalone' ? 'text-dark-400' : 'text-blue-400'}" />
            <span class="font-medium text-white">{project}</span>
          </div>
          <div class="flex items-center gap-2">
            <span class="text-xs px-2 py-0.5 rounded-full {stats.running === stats.total ? 'bg-green-500/10 text-green-400' : stats.running === 0 ? 'bg-red-500/10 text-red-400' : 'bg-yellow-500/10 text-yellow-400'}">
              {stats.running}/{stats.total} running
            </span>
          </div>
        </button>

        <!-- Project Containers -->
        {#if !collapsedProjects[project]}
          <div class="divide-y divide-dark-800">
            {#each projectContainers as container (container.id)}
              <div class="p-4 hover:bg-dark-800/30 transition-colors cursor-pointer" on:click={() => openDetailModal(container)}>
                <div class="flex items-center justify-between">
                  <div class="flex items-center gap-3 flex-1 min-w-0">
                    <button
                      class="btn btn-ghost btn-sm p-1"
                      on:click|stopPropagation={() => toggleExpand(container.id)}
                    >
                      {#if expandedContainer === container.id}
                        <ChevronUp class="w-4 h-4" />
                      {:else}
                        <ChevronDown class="w-4 h-4" />
                      {/if}
                    </button>

                    <div class="min-w-0 flex-1">
                      <div class="flex items-center gap-2">
                        <h3 class="font-medium text-white truncate">{container.service || container.name}</h3>
                        <span class="badge {getStatusBadge(container.state)}">{container.state}</span>
                      </div>
                      <p class="text-xs text-dark-400 truncate">{container.image}</p>
                    </div>
                  </div>

                  <div class="flex items-center gap-1">
                    {#if container.state === 'running'}
                      <button
                        class="btn btn-ghost btn-sm"
                        on:click|stopPropagation={() => handleAction(container.id, 'stop')}
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
                        on:click|stopPropagation={() => handleAction(container.id, 'restart')}
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
                        on:click|stopPropagation={() => handleAction(container.id, 'start')}
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
                      on:click|stopPropagation={() => openLogs(container.id, container.name)}
                      title="Logs"
                    >
                      <FileText class="w-4 h-4 text-green-400" />
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
            {/each}
          </div>
        {/if}
      </div>
    {:else}
      <div class="card text-center py-8">
        <p class="text-dark-400">Keine Container gefunden</p>
      </div>
    {/each}
  </div>
{:else}
  <!-- List View -->
  <div class="space-y-3">
    {#each $containers as container (container.id)}
      <div class="card hover:border-dark-600 transition-colors cursor-pointer" on:click={() => openDetailModal(container)}>
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-3 flex-1 min-w-0">
            <button
              class="btn btn-ghost btn-sm p-1"
              on:click|stopPropagation={() => toggleExpand(container.id)}
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
                {#if container.project}
                  <span class="text-xs px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
                    {container.project}
                  </span>
                {/if}
              </div>
              <p class="text-xs text-dark-400 truncate">{container.image}</p>
            </div>
          </div>

          <div class="flex items-center gap-1">
            {#if container.state === 'running'}
              <button
                class="btn btn-ghost btn-sm"
                on:click|stopPropagation={() => handleAction(container.id, 'stop')}
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
                on:click|stopPropagation={() => handleAction(container.id, 'restart')}
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
                on:click|stopPropagation={() => handleAction(container.id, 'start')}
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
              on:click|stopPropagation={() => openLogs(container.id, container.name)}
              title="Logs"
            >
              <FileText class="w-4 h-4 text-green-400" />
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
{/if}

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
            <RotateCcw class="w-6 h-6 animate-spin text-green-400" />
          </div>
        {:else}
          <pre class="text-xs text-dark-300 font-mono whitespace-pre-wrap break-all">{logsContent || 'Keine Logs vorhanden'}</pre>
        {/if}
      </div>
    </div>
  </div>
{/if}

<!-- Container Detail Modal -->
{#if showDetailModal && selectedContainerId}
  <ContainerDetailModal
    containerId={selectedContainerId}
    containerName={selectedContainerName}
    on:close={closeDetailModal}
  />
{/if}
