import { hashPassword, makeSalt } from '../crypto.js';
import { isAdmin } from '../rbac.js';
import {
  findCustomerName,
  findVehicle,
  getCurrentUser,
  getDb,
  replaceDb,
  saveDb,
} from '../store.js';
import {
  closeModal,
  openModal,
  paymentTag,
  renderTable,
  roleLabel,
  showToast,
  statusTag,
} from '../ui.js';
import {
  downloadFile,
  esc,
  rupiah,
  servicePaid,
  servicePayStatus,
  serviceTotal,
  today,
  uid,
} from '../utils.js';

export function renderKendaraan() {
  if (!isAdmin(getCurrentUser())) return;
  const db = getDb();
  const query = (document.getElementById('searchKendaraan')?.value || '').trim().toLowerCase();

  const list = db.kendaraan.filter((k) => {
    if (!query) return true;
    return `${k.plat} ${k.merek} ${k.model} ${findCustomerName(k.pelangganId)}`.toLowerCase().includes(query);
  });

  const rows = list.map((k) => `
    <tr>
      <td><strong class="mono">${esc(k.plat)}</strong></td>
      <td>${esc(k.merek)} ${esc(k.model)}</td>
      <td class="num-col">${esc(k.tahun || '—')}</td>
      <td>${esc(findCustomerName(k.pelangganId))}</td>
      <td><button type="button" class="link-btn" data-vehicle-history="${esc(k.id)}">Lihat Riwayat</button></td>
      <td>
        <div class="row-actions">
          <button type="button" class="btn small secondary" data-edit-entity="kendaraan" data-id="${esc(k.id)}">Edit</button>
          <button type="button" class="btn small danger" data-remove-entity="kendaraan" data-id="${esc(k.id)}">Hapus</button>
        </div>
      </td>
    </tr>
  `);

  const tableEl = document.getElementById('tableKendaraan');
  if (tableEl) {
    tableEl.innerHTML = renderTable(
      ['Plat Nomor', 'Kendaraan', { label: 'Tahun', numeric: true }, 'Pemilik', 'Riwayat', 'Aksi'],
      rows,
      'Belum ada data kendaraan.'
    );
  }
}

export function openVehicleHistoryModal(kid) {
  const db = getDb();
  const k = findVehicle(kid);
  if (!k) return;
  const arr = db.servis
    .filter((s) => s.kendaraanId === kid)
    .sort((a, b) => b.tanggal.localeCompare(a.tanggal));

  const rows = arr.map((s) => `
    <tr>
      <td class="mono">${esc(s.tanggal)}</td>
      <td>${esc(s.keluhan)}</td>
      <td>${esc(s.diagnosa || '—')}</td>
      <td>${statusTag(s.status)}</td>
      <td class="num-col">${rupiah(serviceTotal(s))}</td>
    </tr>
  `);

  openModal(
    `Riwayat Servis · ${k.plat}`,
    `
    <p style="margin-bottom:12px;">
      <strong>${esc(k.merek)} ${esc(k.model)}</strong> · Pemilik: <strong>${esc(findCustomerName(k.pelangganId))}</strong>
    </p>
    <div class="table-wrap">
      ${renderTable(['Tanggal', 'Keluhan', 'Diagnosa', 'Status', { label: 'Total', numeric: true }], rows, 'Belum ada riwayat servis untuk unit ini.')}
    </div>
    <div class="modal-actions">
      <button type="button" class="btn accent" id="vhCloseBtn">Tutup</button>
    </div>`
  );
  document.getElementById('vhCloseBtn')?.addEventListener('click', closeModal);
}

export function renderMekanik() {
  if (!isAdmin(getCurrentUser())) return;
  const db = getDb();
  const query = (document.getElementById('searchMekanik')?.value || '').trim().toLowerCase();

  const list = db.mekanik.filter((m) => {
    if (!query) return true;
    return `${m.nama} ${m.keahlian || ''}`.toLowerCase().includes(query);
  });

  const rows = list.map((m) => `
    <tr>
      <td><div class="cell-primary">${esc(m.nama)}</div></td>
      <td class="mono">${esc(m.telepon || '—')}</td>
      <td>${esc(m.keahlian || '—')}</td>
      <td>${m.aktif ? '<span class="status-tag done">Aktif</span>' : '<span class="status-tag wait">Nonaktif</span>'}</td>
      <td>
        <div class="row-actions">
          <button type="button" class="btn small secondary" data-edit-entity="mekanik" data-id="${esc(m.id)}">Edit</button>
          <button type="button" class="btn small danger" data-remove-entity="mekanik" data-id="${esc(m.id)}">${m.aktif ? 'Nonaktifkan' : 'Hapus'}</button>
        </div>
      </td>
    </tr>
  `);

  const tableEl = document.getElementById('tableMekanik');
  if (tableEl) {
    tableEl.innerHTML = renderTable(
      ['Nama Mekanik', 'Telepon', 'Keahlian', 'Status', 'Aksi'],
      rows,
      'Belum ada data mekanik.'
    );
  }
}

export function renderReports() {
  if (!isAdmin(getCurrentUser())) return;
  const db = getDb();
  const validServices = db.servis.filter((s) => s.status !== 'Dibatalkan');
  const rev = validServices.reduce((a, s) => a + servicePaid(s), 0);
  const billed = validServices.reduce((a, s) => a + serviceTotal(s), 0);
  const outstanding = Math.max(0, billed - rev);

  const statsEl = document.getElementById('reportStats');
  if (statsEl) {
    statsEl.innerHTML = [
      { label: 'Total Tagihan Aktif', value: rupiah(billed), hint: 'Semua servis tidak dibatalkan' },
      { label: 'Pembayaran Diterima', value: rupiah(rev), hint: 'Kas masuk terverifikasi' },
      { label: 'Sisa Piutang', value: rupiah(outstanding), hint: 'Belum dilunasi pelanggan' },
    ]
      .map(
        (x) => `
      <div class="stat">
        <div class="stat-body">
          <div class="label">${esc(x.label)}</div>
          <div class="value">${esc(x.value)}</div>
          <div class="hint">${esc(x.hint)}</div>
        </div>
      </div>`
      )
      .join('');
  }

  const periodEl = document.getElementById('reportPeriod');
  if (periodEl) {
    periodEl.textContent = `${db.servis.length} total catatan servis`;
  }

  const rows = [...db.servis]
    .sort((a, b) => b.tanggal.localeCompare(a.tanggal))
    .map((s) => {
      const v = findVehicle(s.kendaraanId);
      const sisa = s.status === 'Dibatalkan' ? 0 : Math.max(0, serviceTotal(s) - servicePaid(s));
      return `
      <tr>
        <td class="mono">${esc(s.tanggal)}</td>
        <td><strong class="mono">${esc(v?.plat || '—')}</strong></td>
        <td>${esc(findCustomerName(v?.pelangganId))}</td>
        <td>${esc(s.jenis)}</td>
        <td>${statusTag(s.status)}</td>
        <td>${paymentTag(s)}</td>
        <td class="num-col">${rupiah(serviceTotal(s))}</td>
        <td class="num-col">${rupiah(servicePaid(s))}</td>
        <td class="num-col">${rupiah(sisa)}</td>
      </tr>`;
    });

  const tableEl = document.getElementById('reportTable');
  if (tableEl) {
    tableEl.innerHTML = renderTable(
      [
        'Tanggal',
        'Plat',
        'Pelanggan',
        'Jenis',
        'Status Servis',
        'Pembayaran',
        { label: 'Tagihan', numeric: true },
        { label: 'Dibayar', numeric: true },
        { label: 'Sisa', numeric: true },
      ],
      rows
    );
  }
}

export function exportReportsCsv() {
  if (!isAdmin(getCurrentUser())) return;
  const db = getDb();
  const rows = [['Tanggal', 'Plat', 'Pelanggan', 'Jenis Servis', 'Status Servis', 'Status Pembayaran', 'Total', 'Dibayar', 'Sisa']];
  db.servis.forEach((s) => {
    const v = findVehicle(s.kendaraanId);
    rows.push([
      s.tanggal,
      v?.plat || '',
      findCustomerName(v?.pelangganId),
      s.jenis,
      s.status,
      servicePayStatus(s),
      serviceTotal(s),
      servicePaid(s),
      s.status === 'Dibatalkan' ? 0 : Math.max(0, serviceTotal(s) - servicePaid(s)),
    ]);
  });
  const csv = rows.map((r) => r.map((val) => `"${String(val).replace(/"/g, '""')}"`).join(',')).join('\r\n');
  downloadFile(`laporan-autora-${today()}.csv`, `\ufeff${csv}`, 'text/csv;charset=utf-8;');
  showToast('Laporan CSV berhasil diunduh.');
}

export function exportJsonBackup() {
  if (!isAdmin(getCurrentUser())) return;
  const json = JSON.stringify(getDb(), null, 2);
  downloadFile(`autora-backup-${today()}.json`, json, 'application/json;charset=utf-8;');
  showToast('Cadangan data JSON berhasil diunduh.');
}

export async function importJsonBackup(file, onChange = null) {
  if (!isAdmin(getCurrentUser()) || !file) return;
  try {
    const text = await file.text();
    const parsed = JSON.parse(text);
    replaceDb(parsed);
    onChange?.();
    showToast('Data cadangan JSON berhasil dipulihkan.');
  } catch (err) {
    showToast(err instanceof Error ? err.message : 'Gagal membaca file backup JSON.');
  }
}

export function renderPengguna() {
  const user = getCurrentUser();
  if (!isAdmin(user)) return;
  const db = getDb();
  const query = (document.getElementById('searchPengguna')?.value || '').trim().toLowerCase();

  const list = db.users.filter((u) => {
    if (!query) return true;
    return `${u.username} ${u.nama} ${u.role}`.toLowerCase().includes(query);
  });

  const rows = list.map((u) => {
    const isSelf = u.id === user.id;
    return `
    <tr>
      <td><strong class="mono">@${esc(u.username)}</strong></td>
      <td>${esc(u.nama)}</td>
      <td>${roleLabel(u.role)}</td>
      <td>${u.pelangganId ? esc(findCustomerName(u.pelangganId)) : '<span class="muted">—</span>'}</td>
      <td>${u.aktif ? '<span class="status-tag done">Aktif</span>' : '<span class="status-tag cancel">Nonaktif</span>'}</td>
      <td>
        <div class="row-actions">
          <button type="button" class="btn small secondary" data-edit-account="${esc(u.id)}">Edit / Reset Pass</button>
          ${!isSelf ? `<button type="button" class="btn small danger" data-toggle-account="${esc(u.id)}">${u.aktif ? 'Nonaktifkan' : 'Aktifkan'}</button>` : '<span class="muted" style="font-size:12px;">(Akun Anda)</span>'}
        </div>
      </td>
    </tr>`;
  });

  const tableEl = document.getElementById('tablePengguna');
  if (tableEl) {
    tableEl.innerHTML = renderTable(
      ['Username', 'Nama Lengkap', 'Peran', 'Profil Pelanggan', 'Status', 'Aksi'],
      rows
    );
  }
}

export function openUserAccountForm(targetUid = null, onChange = null) {
  const current = getCurrentUser();
  if (!isAdmin(current)) return;
  const db = getDb();
  const item = targetUid ? db.users.find((u) => u.id === targetUid) : {};
  const edit = Boolean(targetUid);
  const isSelf = edit && item.id === current.id;

  openModal(
    edit ? `Edit Akun @${item.username}` : 'Buat Akun Pengguna Baru',
    `
    <form id="accountForm">
      <div class="form-grid">
        <div class="field">
          <label for="accUsername">Username</label>
          <input id="accUsername" name="username" value="${esc(item.username || '')}" ${edit ? 'readonly' : 'required'} placeholder="Username login unik" />
        </div>
        <div class="field">
          <label for="accRole">Peran (Role)</label>
          <select id="accRole" name="role" ${isSelf ? 'disabled' : ''}>
            <option value="user" ${item.role === 'user' ? 'selected' : ''}>Pelanggan (User Biasa)</option>
            <option value="operator" ${item.role === 'operator' ? 'selected' : ''}>Operator Bengkel</option>
            <option value="admin" ${item.role === 'admin' ? 'selected' : ''}>Administrator</option>
          </select>
        </div>
        <div class="field full">
          <label for="accNama">Nama Lengkap</label>
          <input id="accNama" name="nama" value="${esc(item.nama || '')}" required placeholder="Nama lengkap pengguna" />
        </div>
        <div class="field full">
          <label for="accPass">${edit ? 'Password Baru (Kosongkan jika tidak diubah)' : 'Password (min. 6 karakter)'}</label>
          <input id="accPass" name="password" type="password" ${edit ? '' : 'required'} placeholder="Minimal 6 karakter" />
        </div>
      </div>
      <div class="modal-actions">
        <button type="button" class="btn secondary" id="accCancelBtn">Batal</button>
        <button type="submit" class="btn accent">Simpan Akun</button>
      </div>
    </form>`
  );

  document.getElementById('accCancelBtn')?.addEventListener('click', closeModal);
  document.getElementById('accountForm')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const d = Object.fromEntries(new FormData(event.currentTarget).entries());
    const uname = String(d.username || '').trim().toLowerCase();
    const role = isSelf ? 'admin' : String(d.role || 'user');
    const nama = String(d.nama || '').trim();
    const password = String(d.password || '');

    if (!nama) {
      showToast('Nama lengkap wajib diisi.');
      return;
    }
    if (!edit && !/^[a-z0-9_.-]{3,20}$/.test(uname)) {
      showToast('Username 3–20 karakter (huruf kecil, angka, titik, underscore).');
      return;
    }
    if (!edit && db.users.some((u) => u.username.toLowerCase() === uname)) {
      showToast('Username sudah terdaftar.');
      return;
    }
    if (password && password.length < 6) {
      showToast('Password minimal 6 karakter.');
      return;
    }

    if (edit) {
      item.nama = nama;
      item.role = role;
      if (role === 'user' && !item.pelangganId) {
        const pid = uid('p');
        db.pelanggan.push({ id: pid, nama, telepon: '-', alamat: '-' });
        item.pelangganId = pid;
      }
      if (password) {
        item.salt = makeSalt();
        item.hash = await hashPassword(password, item.salt);
        item.isDemoCustomer = false;
      }
    } else {
      let pid = null;
      if (role === 'user') {
        pid = uid('p');
        db.pelanggan.push({ id: pid, nama, telepon: '-', alamat: '-' });
      }
      const salt = makeSalt();
      const hash = await hashPassword(password, salt);
      db.users.push({
        id: uid('u'),
        username: uname,
        nama,
        role,
        pelangganId: pid,
        salt,
        hash,
        aktif: true,
        createdAt: today(),
      });
    }

    saveDb();
    closeModal();
    onChange?.();
    showToast('Data akun pengguna berhasil disimpan.');
  });
}

export function toggleUserActive(targetUid, onChange = null) {
  const current = getCurrentUser();
  if (!isAdmin(current) || targetUid === current.id) return;
  const db = getDb();
  const u = db.users.find((x) => x.id === targetUid);
  if (!u) return;
  u.aktif = !u.aktif;
  saveDb();
  onChange?.();
  showToast(`Akun @${u.username} ${u.aktif ? 'diaktifkan' : 'dinonaktifkan'}.`);
}
