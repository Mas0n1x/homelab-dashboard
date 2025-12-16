<script>
  import { onMount, onDestroy } from 'svelte';
  import { systemStats } from '$lib/stores/stats.js';
  import Chart from 'chart.js/auto';

  let canvas;
  let chart;
  let cpuHistory = Array(60).fill(0);

  $: if ($systemStats?.cpu?.total !== undefined) {
    cpuHistory = [...cpuHistory.slice(1), $systemStats.cpu.total];
    if (chart) {
      chart.data.datasets[0].data = cpuHistory;
      chart.update('none');
    }
  }

  onMount(() => {
    const ctx = canvas.getContext('2d');

    chart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: Array(60).fill(''),
        datasets: [{
          label: 'CPU %',
          data: cpuHistory,
          borderColor: 'rgb(34, 197, 94)',
          backgroundColor: 'rgba(34, 197, 94, 0.1)',
          fill: true,
          tension: 0.3,
          pointRadius: 0,
          borderWidth: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        plugins: {
          legend: { display: false },
          tooltip: { enabled: false }
        },
        scales: {
          x: {
            display: false
          },
          y: {
            min: 0,
            max: 100,
            grid: {
              color: 'rgba(100, 116, 139, 0.1)'
            },
            ticks: {
              color: 'rgb(148, 163, 184)',
              callback: (value) => value + '%'
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
  <h3 class="text-lg font-semibold text-white mb-4">CPU Auslastung</h3>
  <div class="h-48">
    <canvas bind:this={canvas}></canvas>
  </div>
</div>
