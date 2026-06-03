<script lang="ts">
  import { onMount } from 'svelte';
  import ApexCharts from 'apexcharts';

  interface Props {
    labels:      string[];   // x-axis: ['Пн','Вт',…]
    values:      number[];   // y-axis: [1850, 2100, …]
    target:      number;     // целевое значение (горизонтальная линия)
    metricName:  string;     // 'Калории' | 'Белки' | 'Жиры' | 'Углеводы'
    unit:        string;     // 'ккал' | 'г'
    color:       string;     // основной цвет столбцов
  }

  let { labels, values, target, metricName, unit, color }: Props = $props();

  let chartEl: HTMLDivElement;
  let chart: ApexCharts | null = null;

  // Цветовая маркировка: ±5% — зелёный, ±15% — жёлтый, >15% — красный
  function colorForValue(v: number): string {
    if (target <= 0) return color;
    const dev = Math.abs(v - target) / target;
    if (dev <= 0.05) return color;
    if (dev <= 0.15) return '#f59e0b'; // amber
    return '#ef4444'; // red
  }

  function makeOptions(): ApexCharts.ApexOptions {
    const isDark = document.documentElement.dataset.theme === 'dark';
    const textColor = isDark ? '#e5e7eb' : '#374151';
    const gridColor = isDark ? '#374151' : '#e5e7eb';

    return {
      chart: {
        type: 'bar',
        height: 320,
        toolbar: { show: false },
        animations: { enabled: true, speed: 500 },
        fontFamily: 'inherit',
        background: 'transparent'
      },
      theme: { mode: isDark ? 'dark' : 'light' },
      plotOptions: {
        bar: {
          borderRadius: 8,
          borderRadiusApplication: 'end',
          columnWidth: '60%',
          distributed: true,
          dataLabels: { position: 'top' }
        }
      },
      series: [{ name: metricName, data: values }],
      colors: values.map(colorForValue),
      dataLabels: {
        enabled: true,
        offsetY: -20,
        formatter: (v: number) => (v > 0 ? Math.round(v).toString() : ''),
        style: { fontSize: '11px', colors: [textColor], fontWeight: 600 }
      },
      legend: { show: false },
      xaxis: {
        categories: labels,
        labels: { style: { colors: textColor, fontSize: '12px' } },
        axisBorder: { color: gridColor },
        axisTicks: { color: gridColor }
      },
      yaxis: {
        // Гарантируем, что цель попадает в видимую область графика
        max: Math.max(...values, target) * 1.15,
        labels: {
          style: { colors: textColor, fontSize: '11px' },
          formatter: (v: number) => Math.round(v).toString()
        }
      },
      grid: { borderColor: gridColor, strokeDashArray: 4 },
      tooltip: {
        theme: isDark ? 'dark' : 'light',
        y: { formatter: (v: number) => `${Math.round(v)} ${unit}` }
      },
      annotations: target > 0 ? {
        yaxis: [{
          y: target,
          borderColor: '#0ea5e9',
          borderWidth: 2,
          strokeDashArray: 6,
          label: {
            borderColor: '#0ea5e9',
            style: { color: '#fff', background: '#0ea5e9', fontSize: '11px', fontWeight: 600 },
            text: `Цель: ${Math.round(target)} ${unit}`,
            position: 'left',
            offsetX: 80
          }
        }]
      } : {}
    };
  }

  onMount(() => {
    chart = new ApexCharts(chartEl, makeOptions());
    chart.render();
    return () => { chart?.destroy(); };
  });
</script>

<div bind:this={chartEl} class="chart-host"></div>

<style>
  .chart-host {
    width: 100%;
    min-height: 320px;
  }
  /* Глобальные стили для лучшей интеграции */
  :global(.apexcharts-tooltip) {
    box-shadow: var(--shadow-modal) !important;
    border-radius: var(--radius-md) !important;
    border: 1px solid var(--color-border) !important;
  }
</style>
