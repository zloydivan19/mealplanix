<script lang="ts">
  import { onMount } from 'svelte';
  import ApexCharts from 'apexcharts';

  interface Props {
    protein: number; // %
    fat:     number;
    carbs:   number;
  }

  let { protein, fat, carbs }: Props = $props();

  let chartEl: HTMLDivElement;
  let chart: ApexCharts | null = null;

  function makeOptions(): ApexCharts.ApexOptions {
    const isDark = document.documentElement.dataset.theme === 'dark';
    const textColor = isDark ? '#e5e7eb' : '#374151';

    return {
      chart: {
        type: 'donut',
        height: 200,
        toolbar: { show: false },
        animations: { enabled: true, speed: 500 },
        fontFamily: 'inherit',
        background: 'transparent'
      },
      theme: { mode: isDark ? 'dark' : 'light' },
      series: [protein, fat, carbs],
      labels: ['Белки', 'Жиры', 'Углеводы'],
      colors: ['#3b82f6', '#f59e0b', '#a855f7'],
      stroke: { width: 2, colors: ['transparent'] },
      dataLabels: {
        enabled: true,
        formatter: (val: number) => `${Math.round(val)}%`,
        style: { fontSize: '12px', fontWeight: 600 },
        dropShadow: { enabled: false }
      },
      legend: {
        position: 'bottom',
        labels: { colors: textColor },
        fontSize: '12px',
        markers: { size: 6 },
        itemMargin: { horizontal: 8 }
      },
      plotOptions: {
        pie: {
          donut: {
            size: '60%',
            labels: {
              show: false
            }
          }
        }
      },
      tooltip: {
        theme: isDark ? 'dark' : 'light',
        y: { formatter: (v: number) => `${Math.round(v)}% калорий` }
      }
    };
  }

  onMount(() => {
    chart = new ApexCharts(chartEl, makeOptions());
    chart.render();
    return () => { chart?.destroy(); };
  });
</script>

<div bind:this={chartEl} class="donut-host"></div>

<style>
  .donut-host {
    width: 100%;
    min-height: 200px;
  }
</style>
