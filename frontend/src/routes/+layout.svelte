<script>
  import '../app.css';
  import { onMount, onDestroy } from 'svelte';
  import { connectWebSocket, disconnectWebSocket, connected, fetchServices } from '$lib/stores/stats.js';
  import { Server, Activity, Box, Link, RefreshCw } from 'lucide-svelte';

  let currentTime = new Date();
  let timeInterval;

  onMount(() => {
    connectWebSocket();
    fetchServices();
    timeInterval = setInterval(() => {
      currentTime = new Date();
    }, 1000);
  });

  onDestroy(() => {
    disconnectWebSocket();
    if (timeInterval) clearInterval(timeInterval);
  });

  $: formattedTime = currentTime.toLocaleTimeString('de-DE');
  $: formattedDate = currentTime.toLocaleDateString('de-DE', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
</script>

<div class="min-h-screen bg-dark-950">
  <!-- Header -->
  <header class="bg-dark-900 border-b border-dark-700 sticky top-0 z-50">
    <div class="container mx-auto px-4 py-3">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-3">
          <div class="p-2 bg-blue-600 rounded-lg">
            <Server class="w-6 h-6" />
          </div>
          <div>
            <h1 class="text-xl font-bold text-white">Homelab Dashboard</h1>
            <p class="text-xs text-dark-400">Raspberry Pi 5</p>
          </div>
        </div>

        <nav class="hidden md:flex items-center gap-1">
          <a href="/" class="btn btn-ghost">
            <Activity class="w-4 h-4" />
            <span>System</span>
          </a>
          <a href="/docker" class="btn btn-ghost">
            <Box class="w-4 h-4" />
            <span>Docker</span>
          </a>
          <a href="/services" class="btn btn-ghost">
            <Link class="w-4 h-4" />
            <span>Services</span>
          </a>
        </nav>

        <div class="flex items-center gap-4">
          <div class="text-right hidden sm:block">
            <p class="text-sm text-white font-medium">{formattedTime}</p>
            <p class="text-xs text-dark-400">{formattedDate}</p>
          </div>
          <div class="flex items-center gap-2">
            {#if $connected}
              <span class="badge badge-success flex items-center gap-1">
                <span class="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
                Live
              </span>
            {:else}
              <span class="badge badge-danger flex items-center gap-1">
                <RefreshCw class="w-3 h-3 animate-spin" />
                Verbinden...
              </span>
            {/if}
          </div>
        </div>
      </div>
    </div>
  </header>

  <!-- Mobile Navigation -->
  <nav class="md:hidden fixed bottom-0 left-0 right-0 bg-dark-900 border-t border-dark-700 z-50">
    <div class="flex justify-around py-2">
      <a href="/" class="flex flex-col items-center gap-1 p-2 text-dark-400 hover:text-white">
        <Activity class="w-5 h-5" />
        <span class="text-xs">System</span>
      </a>
      <a href="/docker" class="flex flex-col items-center gap-1 p-2 text-dark-400 hover:text-white">
        <Box class="w-5 h-5" />
        <span class="text-xs">Docker</span>
      </a>
      <a href="/services" class="flex flex-col items-center gap-1 p-2 text-dark-400 hover:text-white">
        <Link class="w-5 h-5" />
        <span class="text-xs">Services</span>
      </a>
    </div>
  </nav>

  <!-- Main Content -->
  <main class="container mx-auto px-4 py-6 pb-20 md:pb-6">
    <slot />
  </main>
</div>
