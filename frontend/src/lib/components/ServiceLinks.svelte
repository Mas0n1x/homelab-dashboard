<script>
  import { services, addService, deleteService } from '$lib/stores/stats.js';
  import { ExternalLink, Plus, Trash2, X, Link, Server, Database, Cloud, Shield, Monitor, Wifi, HardDrive, Mail, Music, Video, Image, FileText, Settings, Terminal, Globe } from 'lucide-svelte';

  let showAddModal = false;
  let newService = { name: '', url: '', icon: 'link', description: '' };
  let adding = false;

  const iconMap = {
    link: Link,
    server: Server,
    database: Database,
    cloud: Cloud,
    shield: Shield,
    monitor: Monitor,
    wifi: Wifi,
    storage: HardDrive,
    mail: Mail,
    music: Music,
    video: Video,
    image: Image,
    file: FileText,
    settings: Settings,
    terminal: Terminal,
    globe: Globe
  };

  const availableIcons = Object.keys(iconMap);

  function getIcon(iconName) {
    return iconMap[iconName] || Link;
  }

  async function handleAdd() {
    if (!newService.name || !newService.url) return;
    adding = true;
    try {
      await addService(newService);
      newService = { name: '', url: '', icon: 'link', description: '' };
      showAddModal = false;
    } catch (error) {
      console.error('Failed to add service:', error);
    }
    adding = false;
  }

  async function handleDelete(id) {
    if (confirm('Service wirklich löschen?')) {
      await deleteService(id);
    }
  }

  function openModal() {
    showAddModal = true;
  }

  function closeModal() {
    showAddModal = false;
    newService = { name: '', url: '', icon: 'link', description: '' };
  }
</script>

<div class="space-y-4">
  <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
    {#each $services as service (service.id)}
      <a
        href={service.url}
        target="_blank"
        rel="noopener noreferrer"
        class="card hover:border-blue-500 hover:bg-dark-800 transition-all group relative"
      >
        <div class="flex items-center gap-3">
          <div class="p-3 bg-blue-600/20 rounded-lg group-hover:bg-blue-600/30 transition-colors">
            <svelte:component this={getIcon(service.icon)} class="w-6 h-6 text-blue-400" />
          </div>
          <div class="flex-1 min-w-0">
            <h3 class="font-medium text-white group-hover:text-blue-400 transition-colors truncate">
              {service.name}
            </h3>
            {#if service.description}
              <p class="text-xs text-dark-400 truncate">{service.description}</p>
            {:else}
              <p class="text-xs text-dark-500 truncate">{service.url}</p>
            {/if}
          </div>
          <ExternalLink class="w-4 h-4 text-dark-500 group-hover:text-blue-400 transition-colors" />
        </div>

        <button
          class="absolute top-2 right-2 p-1 rounded-lg bg-dark-800 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
          on:click|preventDefault|stopPropagation={() => handleDelete(service.id)}
        >
          <Trash2 class="w-3 h-3" />
        </button>
      </a>
    {:else}
      <div class="col-span-full card text-center py-8">
        <p class="text-dark-400 mb-4">Keine Services konfiguriert</p>
        <button class="btn btn-primary mx-auto" on:click={openModal}>
          <Plus class="w-4 h-4" />
          Service hinzufügen
        </button>
      </div>
    {/each}

    {#if $services.length > 0}
      <button
        class="card border-dashed hover:border-blue-500 hover:bg-dark-800 transition-all flex items-center justify-center gap-2 text-dark-400 hover:text-blue-400 min-h-[88px]"
        on:click={openModal}
      >
        <Plus class="w-5 h-5" />
        <span>Service hinzufügen</span>
      </button>
    {/if}
  </div>
</div>

<!-- Add Modal -->
{#if showAddModal}
  <div class="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
    <div class="bg-dark-900 rounded-xl border border-dark-700 w-full max-w-md">
      <div class="flex items-center justify-between p-4 border-b border-dark-700">
        <h3 class="font-semibold text-white">Neuer Service</h3>
        <button class="btn btn-ghost btn-sm" on:click={closeModal}>
          <X class="w-5 h-5" />
        </button>
      </div>

      <form on:submit|preventDefault={handleAdd} class="p-4 space-y-4">
        <div>
          <label class="block text-sm text-dark-300 mb-1">Name *</label>
          <input
            type="text"
            bind:value={newService.name}
            placeholder="z.B. Portainer"
            class="w-full px-3 py-2 bg-dark-800 border border-dark-600 rounded-lg text-white placeholder-dark-500 focus:outline-none focus:border-blue-500"
            required
          />
        </div>

        <div>
          <label class="block text-sm text-dark-300 mb-1">URL *</label>
          <input
            type="url"
            bind:value={newService.url}
            placeholder="http://192.168.1.100:9000"
            class="w-full px-3 py-2 bg-dark-800 border border-dark-600 rounded-lg text-white placeholder-dark-500 focus:outline-none focus:border-blue-500"
            required
          />
        </div>

        <div>
          <label class="block text-sm text-dark-300 mb-1">Beschreibung</label>
          <input
            type="text"
            bind:value={newService.description}
            placeholder="Container Management"
            class="w-full px-3 py-2 bg-dark-800 border border-dark-600 rounded-lg text-white placeholder-dark-500 focus:outline-none focus:border-blue-500"
          />
        </div>

        <div>
          <label class="block text-sm text-dark-300 mb-2">Icon</label>
          <div class="grid grid-cols-8 gap-2">
            {#each availableIcons as icon}
              <button
                type="button"
                class="p-2 rounded-lg border transition-all {newService.icon === icon ? 'border-blue-500 bg-blue-600/20' : 'border-dark-600 hover:border-dark-500'}"
                on:click={() => newService.icon = icon}
              >
                <svelte:component this={getIcon(icon)} class="w-4 h-4 {newService.icon === icon ? 'text-blue-400' : 'text-dark-400'}" />
              </button>
            {/each}
          </div>
        </div>

        <div class="flex gap-2 pt-2">
          <button type="button" class="btn btn-ghost flex-1" on:click={closeModal}>
            Abbrechen
          </button>
          <button type="submit" class="btn btn-primary flex-1" disabled={adding}>
            {#if adding}
              Speichern...
            {:else}
              Speichern
            {/if}
          </button>
        </div>
      </form>
    </div>
  </div>
{/if}
