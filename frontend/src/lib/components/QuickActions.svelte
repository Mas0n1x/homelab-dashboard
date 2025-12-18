<script>
  import { RefreshCw, Trash2, Package, Database, Network, Check, AlertTriangle } from 'lucide-svelte';

  let pruning = false;
  let showConfirm = false;
  let selectedActions = {
    containers: false,
    images: true,
    volumes: false,
    networks: false
  };
  let result = null;

  const API_BASE = '/api/docker';

  async function runPrune() {
    pruning = true;
    result = null;
    try {
      const res = await fetch(`${API_BASE}/system/prune`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(selectedActions)
      });
      if (!res.ok) throw new Error('Prune failed');
      result = await res.json();
    } catch (e) {
      result = { success: false, error: e.message };
    } finally {
      pruning = false;
      showConfirm = false;
    }
  }

  function formatBytes(bytes) {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  function toggleAction(action) {
    selectedActions[action] = !selectedActions[action];
  }

  $: hasSelection = Object.values(selectedActions).some(v => v);
</script>

<div class="card">
  <div class="flex items-center gap-3 mb-4">
    <div class="w-10 h-10 rounded-lg bg-red-500/10 flex items-center justify-center">
      <Trash2 class="w-5 h-5 text-red-400" />
    </div>
    <div>
      <h3 class="text-lg font-semibold text-white">System Cleanup</h3>
      <p class="text-xs text-dark-400">Unbenutzte Docker-Ressourcen entfernen</p>
    </div>
  </div>

  <!-- Action Selection -->
  <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
    <button
      on:click={() => toggleAction('containers')}
      class="p-3 rounded-lg border transition-all {selectedActions.containers ? 'bg-blue-500/10 border-blue-500/30 text-blue-400' : 'bg-dark-800 border-dark-700 text-dark-400 hover:border-dark-600'}"
    >
      <Package class="w-5 h-5 mx-auto mb-1" />
      <span class="text-xs">Container</span>
    </button>

    <button
      on:click={() => toggleAction('images')}
      class="p-3 rounded-lg border transition-all {selectedActions.images ? 'bg-purple-500/10 border-purple-500/30 text-purple-400' : 'bg-dark-800 border-dark-700 text-dark-400 hover:border-dark-600'}"
    >
      <Package class="w-5 h-5 mx-auto mb-1" />
      <span class="text-xs">Images</span>
    </button>

    <button
      on:click={() => toggleAction('volumes')}
      class="p-3 rounded-lg border transition-all {selectedActions.volumes ? 'bg-cyan-500/10 border-cyan-500/30 text-cyan-400' : 'bg-dark-800 border-dark-700 text-dark-400 hover:border-dark-600'}"
    >
      <Database class="w-5 h-5 mx-auto mb-1" />
      <span class="text-xs">Volumes</span>
    </button>

    <button
      on:click={() => toggleAction('networks')}
      class="p-3 rounded-lg border transition-all {selectedActions.networks ? 'bg-green-500/10 border-green-500/30 text-green-400' : 'bg-dark-800 border-dark-700 text-dark-400 hover:border-dark-600'}"
    >
      <Network class="w-5 h-5 mx-auto mb-1" />
      <span class="text-xs">Networks</span>
    </button>
  </div>

  <!-- Warning for Volumes -->
  {#if selectedActions.volumes}
    <div class="flex items-start gap-2 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg mb-4">
      <AlertTriangle class="w-4 h-4 text-yellow-400 flex-shrink-0 mt-0.5" />
      <p class="text-xs text-yellow-400">
        Achtung: Das Löschen von Volumes entfernt alle gespeicherten Daten permanent!
      </p>
    </div>
  {/if}

  <!-- Action Button -->
  {#if showConfirm}
    <div class="flex items-center justify-between p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
      <span class="text-sm text-red-400">Wirklich ausführen?</span>
      <div class="flex items-center gap-2">
        <button
          on:click={runPrune}
          class="btn btn-danger btn-sm"
          disabled={pruning}
        >
          {#if pruning}
            <RefreshCw class="w-3 h-3 animate-spin" />
          {:else}
            <Check class="w-3 h-3" />
          {/if}
          Ja, ausführen
        </button>
        <button
          on:click={() => showConfirm = false}
          class="btn btn-ghost btn-sm"
        >
          Abbrechen
        </button>
      </div>
    </div>
  {:else}
    <button
      on:click={() => showConfirm = true}
      class="btn btn-danger w-full"
      disabled={!hasSelection || pruning}
    >
      {#if pruning}
        <RefreshCw class="w-4 h-4 animate-spin" />
        Wird ausgeführt...
      {:else}
        <Trash2 class="w-4 h-4" />
        Cleanup starten
      {/if}
    </button>
  {/if}

  <!-- Results -->
  {#if result}
    <div class="mt-4 p-3 rounded-lg {result.success ? 'bg-green-500/10 border border-green-500/20' : 'bg-red-500/10 border border-red-500/20'}">
      {#if result.success}
        <p class="text-sm text-green-400 font-medium mb-2">Cleanup abgeschlossen!</p>
        <div class="space-y-1 text-xs text-dark-300">
          {#if result.results.containers}
            <p>Container entfernt: {result.results.containers.ContainersDeleted?.length || 0}</p>
          {/if}
          {#if result.results.images}
            <p>Images entfernt: {result.results.images.ImagesDeleted?.length || 0} ({formatBytes(result.results.images.SpaceReclaimed || 0)})</p>
          {/if}
          {#if result.results.volumes}
            <p>Volumes entfernt: {result.results.volumes.VolumesDeleted?.length || 0} ({formatBytes(result.results.volumes.SpaceReclaimed || 0)})</p>
          {/if}
          {#if result.results.networks}
            <p>Networks entfernt: {result.results.networks.NetworksDeleted?.length || 0}</p>
          {/if}
        </div>
      {:else}
        <p class="text-sm text-red-400">Fehler: {result.error}</p>
      {/if}
    </div>
  {/if}
</div>
