import { getDb } from './store.js';
import { rupiah } from './utils.js';

let chartBars = [];
let resizeObserver = null;
let listenersBound = false;

function computeMonthlyData() {
  const db = getDb();
  const months = [];
  const now = new Date();
  for (let i = 5; i >= 0; i -= 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({
      key: d.toISOString().slice(0, 7),
      label: d.toLocaleDateString('id-ID', { month: 'short' }),
      fullLabel: d.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' }),
    });
  }

  return months.map((m) => {
    const amount = db.servis.reduce((acc, s) => {
      const monthSum = (s.payments || [])
        .filter((p) => p.tanggal && p.tanggal.slice(0, 7) === m.key)
        .reduce((x, p) => x + (Number(p.jumlah) || 0), 0);
      return acc + monthSum;
    }, 0);
    return { ...m, amount };
  });
}

export function drawRevenueChart() {
  const canvas = document.getElementById('revenueChart');
  const tooltip = document.getElementById('chartTooltip');
  if (!canvas) return;

  const parent = canvas.parentElement;
  const cssWidth = parent ? parent.clientWidth : 640;
  const cssHeight = 220;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);

  canvas.width = Math.max(300, Math.floor(cssWidth * dpr));
  canvas.height = Math.floor(cssHeight * dpr);
  canvas.style.width = `${cssWidth}px`;
  canvas.style.height = `${cssHeight}px`;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, cssWidth, cssHeight);

  const data = computeMonthlyData();
  const maxVal = Math.max(100000, ...data.map((d) => d.amount));

  const padLeft = 66;
  const padRight = 14;
  const padTop = 18;
  const padBottom = 34;
  const chartW = cssWidth - padLeft - padRight;
  const chartH = cssHeight - padTop - padBottom;

  ctx.strokeStyle = '#e5dfd6';
  ctx.lineWidth = 1;
  ctx.fillStyle = '#6e675f';
  ctx.font = '500 11px "JetBrains Mono", monospace';
  ctx.textAlign = 'right';

  const gridSteps = 3;
  for (let i = 0; i <= gridSteps; i += 1) {
    const y = padTop + (i * chartH) / gridSteps;
    const val = Math.round(maxVal * (1 - i / gridSteps));
    ctx.beginPath();
    ctx.moveTo(padLeft, y);
    ctx.lineTo(cssWidth - padRight, y);
    ctx.stroke();

    const shortLabel = val === 0 ? '0' : val >= 1000000 ? `${(val / 1000000).toFixed(1)}jt` : `${Math.round(val / 1000)}rb`;
    ctx.fillText(shortLabel, padLeft - 8, y + 4);
  }

  const slot = chartW / data.length;
  const barWidth = Math.min(44, Math.max(18, slot * 0.48));
  chartBars = [];

  data.forEach((item, index) => {
    const ratio = item.amount / maxVal;
    const barHeight = Math.max(item.amount > 0 ? 6 : 2, ratio * (chartH - 4));
    const x = padLeft + index * slot + (slot - barWidth) / 2;
    const y = padTop + chartH - barHeight;

    ctx.fillStyle = item.amount > 0 ? '#a16207' : '#e5dfd6';
    ctx.beginPath();
    if (ctx.roundRect) {
      ctx.roundRect(x, y, barWidth, barHeight, [6, 6, 0, 0]);
    } else {
      ctx.rect(x, y, barWidth, barHeight);
    }
    ctx.fill();

    ctx.fillStyle = '#44403c';
    ctx.font = '600 11px "Plus Jakarta Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(item.label, x + barWidth / 2, padTop + chartH + 20);

    chartBars.push({ x, y, w: barWidth, h: barHeight, item });
  });

  if (!listenersBound) {
    listenersBound = true;
    canvas.addEventListener('mousemove', (event) => {
      if (!tooltip) return;
      const rect = canvas.getBoundingClientRect();
      const mx = event.clientX - rect.left;
      const my = event.clientY - rect.top;
      const hit = chartBars.find(
        (b) => mx >= b.x - 6 && mx <= b.x + b.w + 6 && my >= padTop && my <= padTop + chartH
      );
      if (hit) {
        tooltip.hidden = false;
        tooltip.style.left = `${hit.x + hit.w / 2}px`;
        tooltip.style.top = `${Math.max(24, hit.y - 8)}px`;
        tooltip.textContent = `${hit.item.fullLabel}: ${rupiah(hit.item.amount)}`;
      } else {
        tooltip.hidden = true;
      }
    });

    canvas.addEventListener('mouseleave', () => {
      if (tooltip) tooltip.hidden = true;
    });

    if (typeof ResizeObserver !== 'undefined' && parent) {
      resizeObserver = new ResizeObserver(() => {
        if (canvas.offsetParent !== null) {
          drawRevenueChart();
        }
      });
      resizeObserver.observe(parent);
    }
  }
}
