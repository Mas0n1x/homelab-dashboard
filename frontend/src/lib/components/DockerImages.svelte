<script>
  import { onMount } from 'svelte';
  import { HardDrive, Trash2, RefreshCw, AlertTriangle, Check, Package } from 'lucide-svelte';

  let images = [];
  let loading = true;
  let error = null;
  let deletingId = null;
  let pruning = false;
  let showConfirmPrune = false;
  let deleteConfirm = null;

  const API_BASE = '/api/docker';

  async function fetchImages() {
    loading = true;
    error = null;
    try {
      const res = await fetch(`${API_BASE}/images`);
      if (!res.ok) throw new Error('Failed to fetch images');
      images = await res.json();
    } catch (e) {
      error = e.message;
    } finally {
      loading = false;
    }
  }

  async function deleteImage(imageId, force = false) {
    deletingId = imageId;
    try {
      const res = await fetch(`${API_BASE}/images/${encodeURIComponent(imageId)}?force=${force}`, {
        method: 'DELETE'
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || 'Failed to delete image');
      }
      await fetchImages();
    } catch (e) {
      alert('Fehler: ' + e.message);
    } finally {
      deletingId = null;
      deleteConfirm = null;
    }
  }

  async function pruneImages() {
    pruning = true;
    try {
      const res = await fetch(`${API_BASE}/images/prune`, { method: 'POST' });
      if (!res.ok) throw new Error('Failed to prune images');
      const result = await res.json();
      const count = result.imagesDeleted?.length || 0;
      const space = formatBytes(result.spaceReclaimed || 0);
      alert(`${count} Images gelöscht, ${space} freigegeben`);
      await fetchImages();
    } catch (e) {
      alert('Fehler: ' + e.message);
    } finally {
      pruning = false;
      showConfirmPrune = false;
    }
  }

  function formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  function formatDate(timestamp) {
    return new Date(timestamp * 1000).toLocaleDateString('de-DE', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }

  function getImageName(repoTags) {
    if (!repoTags || repoTags.length === 0 || repoTags[0] === '<none>:<none>') {
      return '<none>';
    }
    return repoTags[0];
  }

  $: totalSize = images.reduce((acc, img) => acc + img.size, 0);
  $: unusedImages = images.filter(img => !img.inUse);
  $: unusedSize = unusedImages.reduce((acc, img) => acc + img.size, 0);

  onMount(fetchImages);
</script>

<div class="space-y-4">
  <!-- Header mit Stats -->
  <div class="flex flex-wrap items-center justify-between gap-4">
    <div class="flex items-center gap-4">
      <div class="flex items-center gap-2 px-3 py-1.5 bg-dark-800 rounded-lg">
        <Package class="w-4 h-4 text-blue-400" />
        <span class="text-sm text-dark-300">{images.length} Images</span>
      </div>
      <div class="flex items-center gap-2 px-3 py-1.5 bg-dark-800 rounded-lg">
        <HardDrive class="w-4 h-4 text-purple-400" />
        <span class="text-sm text-dark-300">{formatBytes(totalSize)}</span>
      </div>
      {#if unusedImages.length > 0}
        <div class="flex items-center gap-2 px-3 py-1.5 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
          <AlertTriangle class="w-4 h-4 text-yellow-400" />
          <span class="text-sm text-yellow-400">{unusedImages.length} unbenutzt ({formatBytes(unusedSize)})</span>
        </div>
      {/if}
    </div>

    <div class="flex items-center gap-2">
      <button
        on:click={fetchImages}
        class="btn btn-ghost"
        disabled={loading}
      >
        <RefreshCw class="w-4 h-4 {loading ? 'animate-spin' : ''}" />
        <span class="hidden sm:inline">Aktualisieren</span>
      </button>

      {#if unusedImages.length > 0}
        {#if showConfirmPrune}
          <div class="flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-1.5">
            <span class="text-sm text-red-400">Wirklich löschen?</span>
            <button
              on:click={pruneImages}
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

  <!-- Image Liste -->
  {#if loading && images.length === 0}
    <div class="card flex items-center justify-center py-12">
      <RefreshCw class="w-8 h-8 text-dark-400 animate-spin" />
    </div>
  {:else if error}
    <div class="card bg-red-500/10 border-red-500/20">
      <p class="text-red-400">{error}</p>
    </div>
  {:else if images.length === 0}
    <div class="card text-center py-12">
      <Package class="w-12 h-12 text-dark-500 mx-auto mb-3" />
      <p class="text-dark-400">Keine Docker Images gefunden</p>
    </div>
  {:else}
    <div class="overflow-x-auto">
      <table class="w-full">
        <thead>
          <tr class="border-b border-dark-700">
            <th class="text-left py-3 px-4 text-xs font-medium text-dark-400 uppercase tracking-wider">Image</th>
            <th class="text-left py-3 px-4 text-xs font-medium text-dark-400 uppercase tracking-wider">Tag</th>
            <th class="text-left py-3 px-4 text-xs font-medium text-dark-400 uppercase tracking-wider">ID</th>
            <th class="text-right py-3 px-4 text-xs font-medium text-dark-400 uppercase tracking-wider">Größe</th>
            <th class="text-left py-3 px-4 text-xs font-medium text-dark-400 uppercase tracking-wider">Erstellt</th>
            <th class="text-center py-3 px-4 text-xs font-medium text-dark-400 uppercase tracking-wider">Status</th>
            <th class="text-right py-3 px-4 text-xs font-medium text-dark-400 uppercase tracking-wider">Aktion</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-dark-800">
          {#each images as image (image.id)}
            {@const imageName = getImageName(image.repoTags)}
            {@const [name, tag] = imageName.includes(':') ? imageName.split(':') : [imageName, 'latest']}
            <tr class="hover:bg-dark-800/50 transition-colors {!image.inUse ? 'bg-yellow-500/5' : ''}">
              <td class="py-3 px-4">
                <div class="flex items-center gap-2">
                  <Package class="w-4 h-4 text-blue-400 flex-shrink-0" />
                  <span class="text-sm text-white font-medium truncate max-w-[200px]" title={name}>
                    {name}
                  </span>
                </div>
              </td>
              <td class="py-3 px-4">
                <span class="text-xs px-2 py-0.5 rounded bg-dark-700 text-dark-300">{tag}</span>
              </td>
              <td class="py-3 px-4">
                <code class="text-xs text-dark-400">{image.shortId}</code>
              </td>
              <td class="py-3 px-4 text-right">
                <span class="text-sm text-dark-300">{formatBytes(image.size)}</span>
              </td>
              <td class="py-3 px-4">
                <span class="text-sm text-dark-400">{formatDate(image.created)}</span>
              </td>
              <td class="py-3 px-4 text-center">
                {#if image.inUse}
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
              </td>
              <td class="py-3 px-4 text-right">
                {#if deleteConfirm === image.id}
                  <div class="flex items-center justify-end gap-1">
                    <button
                      on:click={() => deleteImage(image.id, true)}
                      class="btn btn-danger btn-sm"
                      disabled={deletingId === image.id}
                    >
                      {#if deletingId === image.id}
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
                    on:click={() => deleteConfirm = image.id}
                    class="btn btn-ghost btn-sm text-red-400 hover:text-red-300 hover:bg-red-500/10"
                    disabled={image.inUse}
                    title={image.inUse ? 'Image wird verwendet' : 'Image löschen'}
                  >
                    <Trash2 class="w-4 h-4" />
                  </button>
                {/if}
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}
</div>
