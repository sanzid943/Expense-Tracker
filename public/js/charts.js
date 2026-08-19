// Chart.js helpers — keeps single instance per canvas, destroys before redraw
const ChartRegistry = {};

function themeColors() {
  const dark = document.documentElement.getAttribute('data-theme') === 'dark';
  return {
    grid: dark ? '#2A3350' : '#E1E5F0',
    text: dark ? '#99A2BE' : '#5B6478',
    income: dark ? '#4ADE80' : '#1FAA59',
    expense: dark ? '#FB7185' : '#E1515C',
    accent: dark ? '#2FD4C0' : '#0F9B8E',
    palette: ['#0F9B8E', '#E1515C', '#DE9A2C', '#5B6478', '#8E7CC3', '#4A90D9', '#D97757', '#1FAA59', '#C34A9D']
  };
}

function drawOrUpdate(canvasId, config) {
  const el = document.getElementById(canvasId);
  if (!el) return;
  if (ChartRegistry[canvasId]) {
    ChartRegistry[canvasId].destroy();
  }
  ChartRegistry[canvasId] = new Chart(el.getContext('2d'), config);
}

function trendChart(months, incomeData, expenseData) {
  const c = themeColors();
  drawOrUpdate('trendChart', {
    type: 'line',
    data: {
      labels: months,
      datasets: [
        { label: 'Income', data: incomeData, borderColor: c.income, backgroundColor: c.income + '22', tension: .35, fill: true },
        { label: 'Expense', data: expenseData, borderColor: c.expense, backgroundColor: c.expense + '22', tension: .35, fill: true }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { labels: { color: c.text } } },
      scales: {
        x: { grid: { color: c.grid }, ticks: { color: c.text } },
        y: { grid: { color: c.grid }, ticks: { color: c.text } }
      }
    }
  });
}

function categoryDonut(canvasId, labels, data) {
  const c = themeColors();
  drawOrUpdate(canvasId, {
    type: 'doughnut',
    data: { labels, datasets: [{ data, backgroundColor: c.palette, borderWidth: 0 }] },
    options: {
      responsive: true, maintainAspectRatio: false, cutout: '62%',
      plugins: { legend: { position: 'bottom', labels: { color: c.text, boxWidth: 10, padding: 12, font: { size: 11 } } } }
    }
  });
}

function patternLineChart(months, series) {
  const c = themeColors();
  drawOrUpdate('patternChart', {
    type: 'line',
    data: {
      labels: months,
      datasets: series.map((s, i) => ({
        label: s.category,
        data: s.data,
        borderColor: c.palette[i % c.palette.length],
        backgroundColor: 'transparent',
        tension: .3
      }))
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { position: 'bottom', labels: { color: c.text, boxWidth: 10, font: { size: 10 } } } },
      scales: {
        x: { grid: { color: c.grid }, ticks: { color: c.text } },
        y: { grid: { color: c.grid }, ticks: { color: c.text } }
      }
    }
  });
}

function predictionBarChart(months, totals, predicted) {
  const c = themeColors();
  const labels = [...months, 'Next Month (predicted)'];
  const data = [...totals, predicted];
  const colors = months.map(() => c.expense).concat([c.warn || '#DE9A2C']);
  drawOrUpdate('predictionChart', {
    type: 'bar',
    data: { labels, datasets: [{ label: 'Expenses', data, backgroundColor: colors, borderRadius: 5 }] },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { display: false }, ticks: { color: c.text, font: { size: 10 } } },
        y: { grid: { color: c.grid }, ticks: { color: c.text } }
      }
    }
  });
}
