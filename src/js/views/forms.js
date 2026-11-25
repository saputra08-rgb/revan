import { isAdmin } from '../rbac.js';
import { findCustomerName, getCurrentUser, getDb, saveDb } from '../store.js';
import { closeModal, confirmDialog, openModal, showToast } from '../ui.js';
import { esc, normalizePlate, today, uid } from '../utils.js';

export function openQuickVehicleForCustomer(pid, onChange = null) {
  const db = getDb();
  const cust = db.pelanggan.find((p) => p.id === pid);
  if (!cust) return;

  openModal(
    `Tambah Kendaraan · ${cust.nama}`,
    `
    <form id="quickVehForm">
      <div class="form-grid">
        <div class="field">
          <label for="qvPlat">Plat Nomor</label>
          <input id="qvPlat" name="plat" required placeholder="Contoh: BL 7788 ZZ" />
        </div>
        <div class="field">
          <label for="qvMerek">Merek</label>
          <input id="qvMerek" name="merek" required placeholder="Honda / Yamaha / Toyota" />
        </div>
        <div class="field">
          <label for="qvModel">Model</label>
          <input id="qvModel" name="model" required placeholder="Beat / Avanza" />
        </div>
        <div class="field">
          <label for="qvTahun">Tahun</label>
          <input id="qvTahun" name="tahun" type="number" min="1950" max="${new Date().getFullYear() + 1}" value="2022" />
        </div>
      </div>
      <div class="modal-actions">
        <button type="button" class="btn secondary" id="qvCancelBtn">Batal</button>
        <button type="submit" class="btn accent">Simpan Kendaraan</button>
      </div>
    </form>`
  );

  document.getElementById('qvCancelBtn')?.addEventListener('click', closeModal);
  document.getElementById('quickVehForm')?.addEventListener('submit', (event) => {
    event.preventDefault();
    const d = Object.fromEntries(new FormData(event.currentTarget).entries());
    const plat = normalizePlate(d.plat);
    if (!plat) {
      showToast('Plat nomor wajib diisi.');
      return;
    }
    if (db.kendaraan.some((k) => k.plat === plat)) {
      showToast('Plat nomor sudah terdaftar.');
      return;
    }
    db.kendaraan.push({
      id: uid('k'),
      pelangganId: pid,
      plat,
      merek: String(d.merek || '').trim(),
      model: String(d.model || '').trim(),
      tahun: d.tahun ? Number(d.tahun) : null,
    });
    saveDb();
    closeModal();
    onChange?.();
    showToast(`Kendaraan ditambahkan untuk ${cust.nama}.`);
  });
}

function buildField(name, label, value = '', opts = {}) {
  const idAttr = `field_${name}`;
  let control = '';
  if (opts.select) {
    control = `<select id="${idAttr}" name="${name}" ${opts.required ? 'required' : ''}>
      ${opts.select
        .map(
          (o) =>
            `<option value="${esc(o.value)}" ${String(value) === String(o.value) ? 'selected' : ''}>${esc(o.label)}</option>`
        )
        .join('')}
    </select>`;
  } else if (opts.textarea) {
    control = `<textarea id="${idAttr}" name="${name}" ${opts.required ? 'required' : ''}>${esc(value)}</textarea>`;
  } else {
    const minAttr = opts.min !== undefined ? `min="${opts.min}"` : '';
    const maxAttr = opts.max !== undefined ? `max="${opts.max}"` : '';
    control = `<input id="${idAttr}" name="${name}" type="${opts.type || 'text'}" value="${esc(value)}" ${opts.required ? 'required' : ''} ${minAttr} ${maxAttr} />`;
  }
  return `<div class="field ${opts.full ? 'full' : ''}"><label for="${idAttr}">${esc(label)}</label>${control}</div>`;
}

export function openEntityForm(type, itemId = null, onChange = null) {
  const user = getCurrentUser();
  if ((type === 'mekanik' || type === 'kendaraan') && !isAdmin(user)) {
    showToast('Akses ditolak: Hanya Administrator yang dapat mengelola modul ini.');
    return;
  }

  const db = getDb();
  const item = itemId ? db[type].find((x) => x.id === itemId) || {} : {};
  const edit = Boolean(itemId);
  let fields = '';

  if (type === 'pelanggan') {
    fields =
      buildField('nama', 'Nama Pelanggan', item.nama || '', { required: true }) +
      buildField('telepon', 'Nomor Telepon', item.telepon || '') +
      buildField('alamat', 'Alamat', item.alamat || '', { full: true });
  } else if (type === 'kendaraan') {
    if (!db.pelanggan.length) {
      showToast('Tambahkan data pelanggan terlebih dahulu.');
      return;
    }
    fields =
      buildField('plat', 'Plat Nomor', item.plat || '', { required: true }) +
      buildField('merek', 'Merek', item.merek || '', { required: true }) +
      buildField('model', 'Model', item.model || '', { required: true }) +
      buildField('tahun', 'Tahun', item.tahun || '', {
        type: 'number',
        min: 1950,
        max: new Date().getFullYear() + 1,
      }) +
      buildField('pelangganId', 'Pemilik Kendaraan', item.pelangganId || '', {
        required: true,
        full: true,
        select: db.pelanggan.map((p) => ({ value: p.id, label: p.nama })),
      });
  } else if (type === 'mekanik') {
    fields =
      buildField('nama', 'Nama Mekanik', item.nama || '', { required: true }) +
      buildField('telepon', 'Nomor Telepon', item.telepon || '') +
      buildField('keahlian', 'Keahlian', item.keahlian || '', { full: true }) +
      buildField('aktif', 'Status Keaktifan', String(item.aktif !== false), {
        select: [
          { value: 'true', label: 'Aktif' },
          { value: 'false', label: 'Nonaktif' },
        ],
      });
  } else if (type === 'servis') {
    if (!db.kendaraan.length) {
      showToast('Tambahkan kendaraan terlebih dahulu.');
      return;
    }
    fields =
      buildField('kendaraanId', 'Kendaraan & Pemilik', item.kendaraanId || '', {
        required: true,
        select: db.kendaraan.map((k) => ({
          value: k.id,
          label: `${k.plat} — ${k.merek} ${k.model} (${findCustomerName(k.pelangganId)})`,
        })),
      }) +
      buildField('tanggal', 'Tanggal Servis', item.tanggal || today(), { type: 'date', required: true }) +
      buildField('jenis', 'Jenis Servis', item.jenis || 'Servis Umum', { required: true }) +
      buildField('mekanikId', 'Mekanik Ditugaskan', item.mekanikId || '', {
        select: [
          { value: '', label: 'Belum ditugaskan' },
          ...db.mekanik.filter((m) => m.aktif).map((m) => ({ value: m.id, label: m.nama })),
        ],
      }) +
      buildField('biayaJasa', 'Biaya Jasa Utama (Rp)', item.biayaJasa ?? 50000, {
        type: 'number',
        min: 0,
        required: true,
      }) +
      buildField('keluhan', 'Keluhan Pelanggan', item.keluhan || '', {
        textarea: true,
        full: true,
        required: true,
      }) +
      buildField('diagnosa', 'Diagnosa / Catatan Mekanik', item.diagnosa || '', {
        textarea: true,
        full: true,
      });
  }

  const labels = {
    pelanggan: 'Pelanggan',
    kendaraan: 'Kendaraan',
    mekanik: 'Mekanik',
    servis: 'Antrean Servis',
  };

  openModal(
    `${edit ? 'Edit' : 'Tambah'} ${labels[type] || type}`,
    `
    <form id="entityForm">
      <div class="form-grid">${fields}</div>
      <div class="modal-actions">
        <button type="button" class="btn secondary" id="entityCancelBtn">Batal</button>
        <button type="submit" class="btn accent">Simpan Data</button>
      </div>
    </form>`
  );

  document.getElementById('entityCancelBtn')?.addEventListener('click', closeModal);
  document.getElementById('entityForm')?.addEventListener('submit', (event) => {
    event.preventDefault();
    const d = Object.fromEntries(new FormData(event.currentTarget).entries());

    if (type === 'pelanggan') {
      d.nama = String(d.nama || '').trim();
      d.telepon = String(d.telepon || '').trim();
      d.alamat = String(d.alamat || '').trim();
      if (!d.nama) {
        showToast('Nama pelanggan wajib diisi.');
        return;
      }
    }

    if (type === 'kendaraan') {
      d.plat = normalizePlate(d.plat);
      if (!d.plat) {
        showToast('Plat nomor wajib diisi.');
        return;
      }
      if (db.kendaraan.some((k) => k.plat === d.plat && k.id !== itemId)) {
        showToast('Plat nomor sudah terdaftar.');
        return;
      }
      d.merek = String(d.merek || '').trim();
      d.model = String(d.model || '').trim();
      d.tahun = d.tahun ? Number(d.tahun) : null;
    }

    if (type === 'mekanik') {
      d.nama = String(d.nama || '').trim();
      d.telepon = String(d.telepon || '').trim();
      d.keahlian = String(d.keahlian || '').trim();
      d.aktif = d.aktif === 'true';
      if (!d.nama) {
        showToast('Nama mekanik wajib diisi.');
        return;
      }
    }

    if (type === 'servis') {
      d.biayaJasa = Math.max(0, Number(d.biayaJasa) || 0);
      d.jenis = String(d.jenis || '').trim() || 'Servis Umum';
      d.keluhan = String(d.keluhan || '').trim();
      d.diagnosa = String(d.diagnosa || '').trim();
      d.status = item.status || 'Menunggu';
      d.details = item.details || [];
      d.payments = item.payments || [];
      d.mekanikId = d.mekanikId || null;
      if (!d.keluhan) {
        showToast('Keluhan wajib diisi.');
        return;
      }
    }

    if (edit) {
      Object.assign(item, d);
    } else {
      const prefix = type === 'pelanggan' ? 'p' : type === 'kendaraan' ? 'k' : type === 'mekanik' ? 'm' : 's';
      db[type].push({ id: uid(prefix), ...d });
    }

    saveDb();
    closeModal();
    onChange?.();
    showToast('Data berhasil disimpan.');
  });
}

export async function removeEntityItem(type, itemId, onChange = null) {
  if (!isAdmin(getCurrentUser())) {
    showToast('Hanya Administrator yang dapat menghapus data.');
    return;
  }

  const db = getDb();
  const item = db[type].find((x) => x.id === itemId);
  if (!item) return;

  if (type === 'pelanggan' && db.kendaraan.some((k) => k.pelangganId === itemId)) {
    showToast('Tidak dapat menghapus: pelanggan masih memiliki kendaraan terdaftar.');
    return;
  }
  if (type === 'kendaraan' && db.servis.some((s) => s.kendaraanId === itemId)) {
    showToast('Tidak dapat menghapus: kendaraan memiliki riwayat servis.');
    return;
  }
  if (type === 'mekanik' && db.servis.some((s) => s.mekanikId === itemId)) {
    item.aktif = false;
    saveDb();
    onChange?.();
    showToast('Mekanik dinonaktifkan karena sudah memiliki riwayat servis.');
    return;
  }

  const confirmed = await confirmDialog({
    title: 'Konfirmasi Penghapusan',
    message: 'Data yang dihapus tidak dapat dikembalikan. Lanjutkan penghapusan permanen?',
    confirmLabel: 'Hapus Permanen',
    danger: true,
  });
  if (!confirmed) return;

  db[type] = db[type].filter((x) => x.id !== itemId);
  saveDb();
  onChange?.();
  showToast('Data berhasil dihapus.');
}
