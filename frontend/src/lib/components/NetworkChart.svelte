<script>
  import { onMount, onDestroy } from 'svelte';
  import { systemStats } from '$lib/stores/stats.js';
  import Chart from 'chart.js/auto';

  let canvas;
  let chart;
  let rxHistory = Array(60).fill(0);
  let txHistory = Array(60).fill(0);

  function formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  $: if ($systemStats?.network?.[0]) {
    const net = $systemStats.network[0];
    rxHistory = [...rxHistory.slice(1), net.rxRate || 0];
    txHistory = [...txHistory.slice(1), net.txRate || 0];
    if (chart) {
      chart.data.datasets[0].data = rxHistory;
      chart.data.datasets[1].data = txHistory;
      chart.update('none');
    }
  }

  onMount(() => {
    const ctx = canvas.getContext('2d');

    chart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: Array(60).fill(''),
        datasets: [
          {
            label: 'Download',
            data: rxHistory,
            borderColor: 'rgb(34, 197, 94)',
            backgroundColor: 'rgba(34, 197, 94, 0.1)',
            fill: true,
            tension: 0.3,
            pointRadius: 0,
            borderWidth: 2
          },
          {
            label: 'Upload',
            data: txHistory,
            borderColor: 'rgb(59, 130, 246)',
            backgroundColor: 'rgba(59, 130, 246, 0.1)',
            fill: true,
            tension: 0.3,
            pointRadius: 0,
            borderWidth: 2
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        plugins: {
          legend: {
            display: true,
            position: 'top',
            labels: {
              color: 'rgb(148, 163, 184)',
              usePointStyle: true,
              pointStyle: 'circle'
            }
          },
          tooltip: { enabled: false }
        },
        scales: {
          x: {
            display: false
          },
          y: {
            min: 0,
            grid: {
              color: 'rgba(100, 116, 139, 0.1)'
            },
            ticks: {
              color: 'rgb(148, 163, 184)',
              callback: (value) => formatBytes(value) + '/s'
            }
          }
        }
      }
    });
  });

  onDestroy(() => {
    if (chart) {
      chart.destroy();
    }
  });
</script>

<div class="card">
  <h3 class="text-lg font-semibold text-white mb-4">Netzwerk</h3>
  <div class="h-48">
    <canvas bind:this={canvas}></canvas>
  </div>
</div>
