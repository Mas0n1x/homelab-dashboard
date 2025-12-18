<script>
  import { onMount } from 'svelte';
  import { Database, Trash2, RefreshCw, AlertTriangle, Check, FolderOpen } from 'lucide-svelte';

  let volumes = [];
  let loading = true;
  let error = null;
  let deletingName = null;
  let pruning = false;
  let showConfirmPrune = false;
  let deleteConfirm = null;

  const API_BASE = '/api/docker';

  async function fetchVolumes() {
    loading = true;
    error = null;
    try {
      const res = await fetch(`${API_BASE}/volumes`);
      if (!res.ok) throw new Error('Failed to fetch volumes');
      volumes = await res.json();
    } catch (e) {
      error = e.message;
    } finally {
      loading = false;
    }
  }

  async function deleteVolume(volumeName, force = false) {
    deletingName = volumeName;
    try {
      const res = await fetch(`${API_BASE}/volumes/${encodeURIComponent(volumeName)}?force=${force}`, {
        method: 'DELETE'
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || 'Failed to delete volume');
      }
      await fetchVolumes();
    } catch (e) {
      alert('Fehler: ' + e.message);
    } finally {
      deletingName = null;
      deleteConfirm = null;
    }
  }

  async function pruneVolumes() {
    pruning = true;
    try {
      const res = await fetch(`${API_BASE}/volumes/prune`, { method: 'POST' });
      if (!res.ok) throw new Error('Failed to prune volumes');
      const result = await res.json();
      const count = result.volumesDeleted?.length || 0;
      const space = formatBytes(result.spaceReclaimed || 0);
      alert(`${count} Volumes gelöscht, ${space} freigegeben`);
      await fetchVolumes();
    } catch (e) {
      alert('Fehler: ' + e.message);
    } finally {
      pruning = false;
      showConfirmPrune = false;
    }
  }

  function formatBytes(bytes) {
    if (bytes === 0 || bytes === null) return '-';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  function formatDate(dateStr) {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('de-DE', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }

  function shortenName(name) {
    if (name.length <= 30) return name;
    return name.substring(0, 27) + '...';
  }

  $: totalSize = volumes.reduce((acc, vol) => acc + (vol.size || 0), 0);
  $: unusedVolumes = volumes.filter(vol => !vol.inUse);

  onMount(fetchVolumes);
</script>

<div class="space-y-4">
  <!-- Header mit Stats -->
  <div class="flex flex-wrap items-center justify-between gap-4">
    <div class="flex items-center gap-4">
      <div class="flex items-center gap-2 px-3 py-1.5 bg-dark-800 rounded-lg">
        <Database class="w-4 h-4 text-cyan-400" />
        <span class="text-sm text-dark-300">{volumes.length} Volumes</span>
      </div>
      {#if totalSize > 0}
        <div class="flex items-center gap-2 px-3 py-1.5 bg-dark-800 rounded-lg">
          <FolderOpen class="w-4 h-4 text-purple-400" />
          <span class="text-sm text-dark-300">{formatBytes(totalSize)}</span>
        </div>
      {/if}
      {#if unusedVolumes.length > 0}
        <div class="flex items-center gap-2 px-3 py-1.5 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
          <AlertTriangle class="w-4 h-4 text-yellow-400" />
          <span class="text-sm text-yellow-400">{unusedVolumes.length} unbenutzt</span>
        </div>
      {/if}
    </div>

    <div class="flex items-center gap-2">
      <button
        on:click={fetchVolumes}
        class="btn btn-ghost"
        disabled={loading}
      >
        <RefreshCw class="w-4 h-4 {loading ? 'animate-spin' : ''}" />
        <span class="hidden sm:inline">Aktualisieren</span>
      </button>

      {#if unusedVolumes.length > 0}
        {#if showConfirmPrune}
          <div class="flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-1.5">
            <span class="text-sm text-red-400">Wirklich löschen?</span>
            <button
              on:click={pruneVolumes}
              class="btn btn-danger btn-sm"
              disabled={pruning}
            >
              {#if pruning}
                <RefreshCw class="w-3 h-3 animate-spin" />
              {:else}
                <Check class="w-3 h-3" />
              {/if}
              Ja
            </button>
            <button
              on:click={() => showConfirmPrune = false}
              class="btn btn-ghost btn-sm"
            >
              Nein
            </button>
          </div>
        {:else}
          <button
            on:click={() => showConfirmPrune = true}
            class="btn btn-warning"
          >
            <Trash2 class="w-4 h-4" />
            <span class="hidden sm:inline">Cleanup</span>
          </button>
        {/if}
      {/if}
    </div>
  </div>

  <!-- Volume Liste -->
  {#if loading && volumes.length === 0}
    <div class="card flex items-center justify-center py-12">
      <RefreshCw class="w-8 h-8 text-dark-400 animate-spin" />
    </div>
  {:else if error}
    <div class="card bg-red-500/10 border-red-500/20">
      <p class="text-red-400">{error}</p>
    </div>
  {:else if volumes.length === 0}
    <div class="card text-center py-12">
      <Database class="w-12 h-12 text-dark-500 mx-auto mb-3" />
      <p class="text-dark-400">Keine Docker Volumes gefunden</p>
    </div>
  {:else}
    <div class="grid gap-3">
      {#each volumes as volume (volume.name)}
        <div class="card hover:border-dark-600 transition-colors {!volume.inUse ? 'border-yellow-500/20 bg-yellow-500/5' : ''}">
          <div class="flex flex-wrap items-center justify-between gap-4">
            <div class="flex items-center gap-3 min-w-0">
              <div class="w-10 h-10 rounded-lg bg-cyan-500/10 flex items-center justify-center flex-shrink-0">
                <Database class="w-5 h-5 text-cyan-400" />
              </div>
              <div class="min-w-0">
                <h3 class="text-sm font-medium text-white truncate" title={volume.name}>
                  {shortenName(volume.name)}
                </h3>
                <p class="text-xs text-dark-400 truncate" title={volume.mountpoint}>
                  {volume.mountpoint}
                </p>
              </div>
            </div>

            <div class="flex items-center gap-4">
              <div class="text-right">
                <p class="text-sm text-dark-300">{formatBytes(volume.size)}</p>
                <p class="text-xs text-dark-500">{volume.driver}</p>
              </div>

              <div>
                {#if volume.inUse}
                  <span class="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-green-500/10 text-green-400 border border-green-500/20">
                    <span class="w-1.5 h-1.5 bg-green-400 rounded-full"></span>
                    In Use
                  </span>
                {:else}
                  <span class="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-yellow-500/10 text-yellow-400 border border-yellow-500/20">
                    <span class="w-1.5 h-1.5 bg-yellow-400 rounded-full"></span>
                    Unused
                  </span>
                {/if}
              </div>

              {#if deleteConfirm === volume.name}
                <div class="flex items-center gap-1">
                  <button
                    on:click={() => deleteVolume(volume.name, true)}
                    class="btn btn-danger btn-sm"
                    disabled={deletingName === volume.name}
                  >
                    {#if deletingName === volume.name}
                      <RefreshCw class="w-3 h-3 animate-spin" />
                    {:else}
                      <Check class="w-3 h-3" />
                    {/if}
                  </button>
                  <button
                    on:click={() => deleteConfirm = null}
                    class="btn btn-ghost btn-sm"
                  >
                    X
                  </button>
                </div>
              {:else}
                <button
                  on:click={() => deleteConfirm = volume.name}
                  class="btn btn-ghost btn-sm text-red-400 hover:text-red-300 hover:bg-red-500/10"
                  disabled={volume.inUse}
                  title={volume.inUse ? 'Volume wird verwendet' : 'Volume löschen'}
                >
                  <Trash2 class="w-4 h-4" />
                </button>
              {/if}
            </div>
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>
