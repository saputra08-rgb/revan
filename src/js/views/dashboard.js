import { drawRevenueChart } from '../chart.js';
import { ICONS } from '../icons.js';
import { findCustomerName, findMechanicName, findVehicle, getDb } from '../store.js';
import { renderTable, statusTag } from '../ui.js';
import { esc, rupiah, servicePayStatus, serviceTotal, today } from '../utils.js';

export function renderDashboard() {
  const db = getDb();
  const activeServices = db.servis.filter((s) => s.status !== 'Dibatalkan');
  const revenue = activeServices.reduce(
    (sum, s) => sum + (s.payments || []).reduce((pSum, p) => pSum + (Number(p.jumlah) || 0), 0),
    0
  );
  const todayStr = today();
  const todayCount = activeServices.filter((s) => s.tanggal === todayStr).length;

  const stats = [
    { label: 'Total Pelanggan', value: db.pelanggan.length, hint: 'Pemilik terdaftar', icon: ICONS.users },
    { label: 'Total Kendaraan', value: db.kendaraan.length, hint: 'Unit kendaraan aktif', icon: ICONS.car },
    { label: 'Servis Hari Ini', value: todayCount, hint: 'Antrean tanggal hari ini', icon: ICONS.calendar },
    {
      label: 'Sedang Dikerjakan',
      value: activeServices.filter((s) => s.status === 'Dikerjakan').length,
      hint: 'Unit di area bengkel',
      icon: ICONS.wrench,
    },
    {
      label: 'Servis Selesai',
      value: activeServices.filter((s) => s.status === 'Selesai').length,
      hint: 'Pekerjaan tuntas',
      icon: ICONS.check,
    },
    { label: 'Pendapatan Masuk', value: rupiah(revenue), hint: 'Pembayaran diterima', icon: ICONS.wallet },
  ];

  const statsEl = document.getElementById('stats');
  if (statsEl) {
    statsEl.innerHTML = stats
      .map(
        (item) => `
      <div class="stat">
        <div class="stat-body">
          <div class="label">${esc(item.label)}</div>
          <div class="value">${esc(item.value)}</div>
          <div class="hint">${esc(item.hint)}</div>
        </div>
        <div class="symbol">${item.icon}</div>
      </div>`
      )
      .join('');
  }

  const opsEl = document.getElementById('opsSummary');
  if (opsEl) {
    const statusCounts = ['Menunggu', 'Dikerjakan', 'Selesai'].map((st) => ({
      status: st,
      count: activeServices.filter((s) => s.status === st).length,
    }));

    opsEl.innerHTML = `
      <div class="ops-list">
        ${statusCounts
          .map(
            (row) => `
          <div class="ops-row">
            ${statusTag(row.status)}
            <strong>${row.count} servis</strong>
          </div>`
          )
          .join('')}
      </div>
      <div class="mini-metrics">
        <div class="mini-metric">
          <strong>${activeServices.filter((s) => servicePayStatus(s) !== 'Lunas').length}</strong>
          <span>Belum lunas</span>
        </div>
        <div class="mini-metric">
          <strong>${db.mekanik.filter((m) => m.aktif).length}</strong>
          <span>Mekanik aktif</span>
        </div>
        <div class="mini-metric">
          <strong>${db.users.filter((u) => u.aktif).length}</strong>
          <span>Akun aktif</span>
        </div>
      </div>`;
  }

  const recentEl = document.getElementById('recentTable');
  if (recentEl) {
    const recentRows = [...db.servis]
      .sort((a, b) => b.tanggal.localeCompare(a.tanggal))
      .slice(0, 6)
      .map((s) => {
        const v = findVehicle(s.kendaraanId);
        return `
        <tr>
          <td>
            <div class="cell-primary mono">${esc(v?.plat || '—')}</div>
            <div class="cell-sub">${esc(v?.merek || '')} ${esc(v?.model || '')}</div>
          </td>
          <td>${esc(findCustomerName(v?.pelangganId))}</td>
          <td>${esc(s.jenis)}</td>
          <td>${esc(findMechanicName(s.mekanikId))}</td>
          <td>${statusTag(s.status)}</td>
          <td class="num-col"><strong>${rupiah(serviceTotal(s))}</strong></td>
          <td><button type="button" class="link-btn" data-open-service="${esc(s.id)}">Kelola</button></td>
        </tr>`;
      });

    recentEl.innerHTML = renderTable(
      ['Kendaraan', 'Pelanggan', 'Jenis Servis', 'Mekanik', 'Status', { label: 'Total', numeric: true }, 'Aksi'],
      recentRows,
      'Belum ada transaksi servis.'
    );
  }

  drawRevenueChart();
}
