import { isAdmin } from '../rbac.js';
import { getCurrentUser, getDb } from '../store.js';
import { renderTable } from '../ui.js';
import { esc } from '../utils.js';

export function renderPelanggan() {
  const user = getCurrentUser();
  if (!user) return;
  const db = getDb();
  const adminFlag = isAdmin(user);
  const query = (document.getElementById('searchPelanggan')?.value || '').trim().toLowerCase();

  const list = db.pelanggan.filter((p) => {
    if (!query) return true;
    return `${p.nama} ${p.telepon || ''} ${p.alamat || ''}`.toLowerCase().includes(query);
  });

  const rows = list.map((p) => {
    const linkedUser = db.users.find((u) => u.pelangganId === p.id);
    const unitCount = db.kendaraan.filter((k) => k.pelangganId === p.id).length;

    return `
    <tr>
      <td><div class="cell-primary">${esc(p.nama)}</div></td>
      <td class="mono">${esc(p.telepon || '—')}</td>
      <td><div class="cell-sub" style="margin-top:0;">${esc(p.alamat || '—')}</div></td>
      <td>${linkedUser ? `<span class="status-tag done">@${esc(linkedUser.username)}</span>` : '<span class="muted">Offline</span>'}</td>
      <td class="num-col">${unitCount} unit</td>
      <td>
        <div class="row-actions">
          <button type="button" class="btn small secondary" data-edit-entity="pelanggan" data-id="${esc(p.id)}">Edit</button>
          <button type="button" class="btn small secondary" data-quick-vehicle="${esc(p.id)}">Tambah Unit</button>
          ${adminFlag ? `<button type="button" class="btn small danger" data-remove-entity="pelanggan" data-id="${esc(p.id)}">Hapus</button>` : ''}
        </div>
      </td>
    </tr>`;
  });

  const tableEl = document.getElementById('tablePelanggan');
  if (tableEl) {
    tableEl.innerHTML = renderTable(
      ['Nama Pelanggan', 'Telepon', 'Alamat', 'Akun Portal', { label: 'Kendaraan', numeric: true }, 'Aksi'],
      rows,
      'Belum ada data pelanggan yang cocok.'
    );
  }
}
