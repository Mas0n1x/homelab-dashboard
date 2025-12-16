<script>
  import ServiceLinks from '$lib/components/ServiceLinks.svelte';
  import { services } from '$lib/stores/stats.js';
  import { Link } from 'lucide-svelte';
</script>

<svelte:head>
  <title>Services - Homelab Dashboard</title>
</svelte:head>

<div class="space-y-6">
  <div class="flex items-center justify-between">
    <h2 class="text-2xl font-bold text-white">Services</h2>
    <span class="badge badge-info">
      {$services.length} Service{$services.length !== 1 ? 's' : ''}
    </span>
  </div>

  <p class="text-dark-400">
    Quick-Links zu all deinen Homelab-Services. Klicke auf einen Service, um ihn in einem neuen Tab zu öffnen.
  </p>

  <ServiceLinks />
</div>
