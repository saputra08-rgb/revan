import { ICONS } from '../icons.js';
import {
  ensureCustomerProfileForUser,
  findCustomerName,
  findMechanicName,
  findVehicle,
  getCurrentUser,
  getDb,
  saveDb,
} from '../store.js';
import {
  closeModal,
  confirmDialog,
  openModal,
  paymentTag,
  renderTable,
  showToast,
  statusTag,
} from '../ui.js';
import {
  esc,
  normalizePlate,
  rupiah,
  servicePaid,
  serviceTotal,
  today,
  uid,
} from '../utils.js';

export function renderUserPortal() {
  const user = getCurrentUser();
  if (!user) return;
  const db = getDb();
  const pid = ensureCustomerProfileForUser(user);
  const myVehicles = db.kendaraan.filter((k) => k.pelangganId === pid);
  const myVehicleIds = myVehicles.map((v) => v.id);
  const myServices = [...db.servis]
    .filter((s) => myVehicleIds.includes(s.kendaraanId))
    .sort((a, b) => b.tanggal.localeCompare(a.tanggal));

  const activeCount = myServices.filter((s) => s.status === 'Menunggu' || s.status === 'Dikerjakan').length;
  const doneCount = myServices.filter((s) => s.status === 'Selesai').length;

  const statsEl = document.getElementById('userStats');
  if (statsEl) {
    statsEl.innerHTML = [
      { label: 'Kendaraan Saya', value: myVehicles.length, hint: 'Terdaftar atas nama Anda', icon: ICONS.car },
      { label: 'Dalam Antrean / Proses', value: activeCount, hint: 'Menunggu atau dikerjakan', icon: ICONS.clock },
      { label: 'Servis Selesai', value: doneCount, hint: 'Riwayat pengerjaan selesai', icon: ICONS.check },
    ]
      .map(
        (x) => `
      <div class="stat">
        <div class="stat-body">
          <div class="label">${esc(x.label)}</div>
          <div class="value">${esc(x.value)}</div>
          <div class="hint">${esc(x.hint)}</div>
        </div>
        <div class="symbol">${x.icon}</div>
      </div>`
      )
      .join('');
  }

  const vehiclesEl = document.getElementById('userVehiclesList');
  if (vehiclesEl) {
    vehiclesEl.innerHTML = myVehicles.length
      ? `<div class="vehicle-cards">${myVehicles
          .map((v) => {
            const srvCount = myServices.filter((s) => s.kendaraanId === v.id).length;
            return `
            <div class="v-card">
              <div class="v-card-head">
                <span class="v-card-plate">${esc(v.plat)}</span>
                <span class="muted mono" style="font-size:12px;">${srvCount} servis</span>
              </div>
              <div class="v-card-title">${esc(v.merek)} ${esc(v.model)}</div>
              <div class="muted" style="font-size:12px;">Tahun: ${esc(v.tahun || '—')}</div>
              <div class="v-card-actions">
                <button type="button" class="btn small accent" data-user-book="${esc(v.id)}">Booking Servis</button>
                <button type="button" class="btn small secondary" data-user-edit-vehicle="${esc(v.id)}">Edit Unit</button>
              </div>
            </div>`;
          })
          .join('')}</div>`
      : `<div class="empty">Anda belum mendaftarkan kendaraan. Klik <strong>Tambah Kendaraan</strong> untuk mulai booking servis.</div>`;
  }

  const tableEl = document.getElementById('userServicesTable');
  if (tableEl) {
    const rows = myServices.map((s) => {
      const v = findVehicle(s.kendaraanId);
      const canCancel = s.status === 'Menunggu' && servicePaid(s) === 0;
      return `
      <tr>
        <td class="mono">${esc(s.tanggal)}</td>
        <td>
          <div class="cell-primary mono">${esc(v?.plat || '—')}</div>
          <div class="cell-sub">${esc(v?.merek || '')} ${esc(v?.model || '')}</div>
        </td>
        <td>
          <div class="cell-primary">${esc(s.jenis)}</div>
          <div class="cell-sub">${esc(s.keluhan)}</div>
        </td>
        <td>${esc(findMechanicName(s.mekanikId))}</td>
        <td>${statusTag(s.status)}</td>
        <td class="num-col">
          <strong>${rupiah(serviceTotal(s))}</strong>
          <div style="margin-top:4px;">${paymentTag(s)}</div>
        </td>
        <td>
          <div class="row-actions">
            <button type="button" class="btn small secondary" data-user-receipt="${esc(s.id)}">Pantau &amp; Nota</button>
            ${canCancel ? `<button type="button" class="btn small danger" data-user-cancel="${esc(s.id)}">Batalkan</button>` : ''}
          </div>
        </td>
      </tr>`;
    });

    tableEl.innerHTML = renderTable(
      ['Tanggal', 'Kendaraan', 'Layanan & Keluhan', 'Mekanik', 'Progres', { label: 'Estimasi / Tagihan', numeric: true }, 'Aksi'],
      rows,
      'Belum ada riwayat booking servis. Klik "Booking Servis Baru" untuk membuat jadwal.'
    );
  }
}

export function renderUserBills() {
  const user = getCurrentUser();
  if (!user) return;
  const db = getDb();
  const pid = ensureCustomerProfileForUser(user);
  const myVehicleIds = db.kendaraan.filter((k) => k.pelangganId === pid).map((v) => v.id);
  const myBills = [...db.servis]
    .filter((s) => myVehicleIds.includes(s.kendaraanId) && s.status !== 'Dibatalkan')
    .sort((a, b) => b.tanggal.localeCompare(a.tanggal));

  const totalBilled = myBills.reduce((a, s) => a + serviceTotal(s), 0);
  const totalPaid = myBills.reduce((a, s) => a + servicePaid(s), 0);
  const totalUnpaid = Math.max(0, totalBilled - totalPaid);

  const statsEl = document.getElementById('userBillStats');
  if (statsEl) {
    statsEl.innerHTML = [
      { label: 'Total Biaya Servis', value: rupiah(totalBilled), hint: 'Akumulasi seluruh transaksi', icon: ICONS.card },
      { label: 'Sudah Dibayarkan', value: rupiah(totalPaid), hint: 'Pembayaran terverifikasi', icon: ICONS.check },
      {
        label: 'Sisa Tagihan Anda',
        value: rupiah(totalUnpaid),
        hint: totalUnpaid > 0 ? 'Selesaikan pembayaran di kasir bengkel' : 'Seluruh tagihan lunas',
        icon: ICONS.wallet,
      },
    ]
      .map(
        (x) => `
      <div class="stat">
        <div class="stat-body">
          <div class="label">${esc(x.label)}</div>
          <div class="value">${esc(x.value)}</div>
          <div class="hint">${esc(x.hint)}</div>
        </div>
        <div class="symbol">${x.icon}</div>
      </div>`
      )
      .join('');
  }

  const tableEl = document.getElementById('userBillsTable');
  if (tableEl) {
    const rows = myBills.map((s) => {
      const v = findVehicle(s.kendaraanId);
      const sisa = Math.max(0, serviceTotal(s) - servicePaid(s));
      return `
      <tr>
        <td class="mono">${esc(s.tanggal)}</td>
        <td>
          <div class="cell-primary mono">${esc(v?.plat || '—')}</div>
          <div class="cell-sub">${esc(s.jenis)}</div>
        </td>
        <td>${statusTag(s.status)}</td>
        <td class="num-col">${rupiah(serviceTotal(s))}</td>
        <td class="num-col" style="color:var(--success);font-weight:600;">${rupiah(servicePaid(s))}</td>
        <td class="num-col" style="color:${sisa > 0 ? 'var(--danger)' : 'var(--muted)'};font-weight:600;">${rupiah(sisa)}</td>
        <td>${paymentTag(s)}</td>
        <td><button type="button" class="btn small accent" data-user-receipt="${esc(s.id)}">Rincian &amp; Nota</button></td>
      </tr>`;
    });

    tableEl.innerHTML = renderTable(
      ['Tanggal', 'Kendaraan & Servis', 'Status Servis', { label: 'Total', numeric: true }, { label: 'Dibayar', numeric: true }, { label: 'Sisa', numeric: true }, 'Status Bayar', 'Aksi'],
      rows,
      'Belum ada tagihan servis untuk akun Anda.'
    );
  }
}

export function openUserVehicleForm(kid = null, onChange = null) {
  const user = getCurrentUser();
  if (!user) return;
  const db = getDb();
  const pid = ensureCustomerProfileForUser(user);
  const item = kid ? db.kendaraan.find((k) => k.id === kid && k.pelangganId === pid) : {};

  openModal(
    kid ? 'Edit Kendaraan Saya' : 'Tambah Kendaraan Saya',
    `
    <form id="userVehicleForm">
      <div class="form-grid">
        <div class="field">
          <label for="uvPlat">Plat Nomor</label>
          <input id="uvPlat" name="plat" value="${esc(item?.plat || '')}" required placeholder="Contoh: BL 4567 XY" />
        </div>
        <div class="field">
          <label for="uvMerek">Merek</label>
          <input id="uvMerek" name="merek" value="${esc(item?.merek || '')}" required placeholder="Honda / Toyota / Yamaha" />
        </div>
        <div class="field">
          <label for="uvModel">Model / Tipe</label>
          <input id="uvModel" name="model" value="${esc(item?.model || '')}" required placeholder="Vario 125 / Avanza" />
        </div>
        <div class="field">
          <label for="uvTahun">Tahun</label>
          <input id="uvTahun" name="tahun" type="number" min="1970" max="${new Date().getFullYear() + 1}" value="${esc(item?.tahun || 2022)}" />
        </div>
      </div>
      <div class="modal-actions">
        <button type="button" class="btn secondary" id="uvCancelBtn">Batal</button>
        <button type="submit" class="btn accent">Simpan Kendaraan</button>
      </div>
    </form>`
  );

  document.getElementById('uvCancelBtn')?.addEventListener('click', closeModal);
  document.getElementById('userVehicleForm')?.addEventListener('submit', (event) => {
    event.preventDefault();
    const d = Object.fromEntries(new FormData(event.currentTarget).entries());
    const plat = normalizePlate(d.plat);
    if (!plat) {
      showToast('Plat nomor wajib diisi.');
      return;
    }
    if (db.kendaraan.some((k) => k.plat === plat && k.id !== kid)) {
      showToast('Nomor plat sudah terdaftar dalam sistem.');
      return;
    }
    const payload = {
      plat,
      merek: String(d.merek || '').trim(),
      model: String(d.model || '').trim(),
      tahun: d.tahun ? Number(d.tahun) : null,
    };

    if (kid && item) {
      Object.assign(item, payload);
    } else {
      db.kendaraan.push({ id: uid('k'), pelangganId: pid, ...payload });
    }
    saveDb();
    closeModal();
    onChange?.();
    showToast('Kendaraan Anda berhasil disimpan.');
  });
}

export function openUserBookingForm(preselectVehicleId = '', onChange = null) {
  const user = getCurrentUser();
  if (!user) return;
  const db = getDb();
  const pid = ensureCustomerProfileForUser(user);
  const myVehicles = db.kendaraan.filter((k) => k.pelangganId === pid);

  if (!myVehicles.length) {
    showToast('Tambahkan kendaraan terlebih dahulu sebelum booking servis.');
    openUserVehicleForm(null, onChange);
    return;
  }

  openModal(
    'Booking Servis Daring',
    `
    <form id="userBookingForm">
      <div class="form-grid">
        <div class="field">
          <label for="ubVehicle">Kendaraan</label>
          <select id="ubVehicle" name="kendaraanId" required>
            ${myVehicles
              .map(
                (k) =>
                  `<option value="${esc(k.id)}" ${k.id === preselectVehicleId ? 'selected' : ''}>${esc(k.plat)} — ${esc(k.merek)} ${esc(k.model)}</option>`
              )
              .join('')}
          </select>
        </div>
        <div class="field">
          <label for="ubDate">Tanggal Rencana Servis</label>
          <input id="ubDate" type="date" name="tanggal" min="${today()}" value="${today()}" required />
        </div>
        <div class="field full">
          <label for="ubJenis">Jenis Layanan Servis</label>
          <select id="ubJenis" name="jenis" required>
            <option value="Servis Berkala">Servis Berkala &amp; Ganti Oli</option>
            <option value="Tune Up">Tune Up Mesin</option>
            <option value="Perbaikan Rem">Perbaikan Rem &amp; Kaki-kaki</option>
            <option value="Kelistrikan">Pemeriksaan Kelistrikan / Aki</option>
            <option value="Servis Umum">Keluhan Umum / Pemeriksaan</option>
          </select>
        </div>
        <div class="field full">
          <label for="ubKeluhan">Keluhan Kendaraan</label>
          <textarea id="ubKeluhan" name="keluhan" required placeholder="Jelaskan keluhan atau gejala pada kendaraan Anda..."></textarea>
        </div>
      </div>
      <div class="modal-actions">
        <button type="button" class="btn secondary" id="ubCancelBtn">Batal</button>
        <button type="submit" class="btn accent">Kirim Booking Servis</button>
      </div>
    </form>`
  );

  document.getElementById('ubCancelBtn')?.addEventListener('click', closeModal);
  document.getElementById('userBookingForm')?.addEventListener('submit', (event) => {
    event.preventDefault();
    const d = Object.fromEntries(new FormData(event.currentTarget).entries());
    const keluhan = String(d.keluhan || '').trim();
    if (!keluhan) {
      showToast('Mohon tuliskan keluhan kendaraan.');
      return;
    }

    db.servis.push({
      id: uid('s'),
      kendaraanId: String(d.kendaraanId),
      mekanikId: null,
      tanggal: String(d.tanggal || today()),
      keluhan,
      diagnosa: 'Booking daring pelanggan — menunggu pemeriksaan mekanik',
      jenis: String(d.jenis || 'Servis Umum'),
      biayaJasa: 50000,
      status: 'Menunggu',
      details: [],
      payments: [],
    });
    saveDb();
    closeModal();
    onChange?.();
    showToast('Booking servis berhasil dikirim dan masuk ke antrean.');
  });
}

export async function cancelUserBooking(sid, onChange = null) {
  const db = getDb();
  const s = db.servis.find((x) => x.id === sid);
  if (!s || s.status !== 'Menunggu' || servicePaid(s) > 0) return;

  const confirmed = await confirmDialog({
    title: 'Batalkan Booking Servis',
    message: 'Apakah Anda yakin ingin membatalkan pengajuan booking servis ini?',
    confirmLabel: 'Batalkan Booking',
    danger: true,
  });
  if (!confirmed) return;

  s.status = 'Dibatalkan';
  saveDb();
  onChange?.();
  showToast('Booking servis telah dibatalkan.');
}

export function openServiceReceiptModal(sid) {
  const db = getDb();
  const s = db.servis.find((x) => x.id === sid);
  if (!s) return;
  const v = findVehicle(s.kendaraanId);
  const step1 = s.status !== 'Dibatalkan' ? 'done' : '';
  const step2 = s.status === 'Dikerjakan' ? 'active' : s.status === 'Selesai' ? 'done' : '';
  const step3 = s.status === 'Selesai' ? 'done' : '';
  const sisa = s.status === 'Dibatalkan' ? 0 : Math.max(0, serviceTotal(s) - servicePaid(s));

  openModal(
    `Progres & Nota Servis · ${v?.plat || ''}`,
    `
    ${
      s.status !== 'Dibatalkan'
        ? `
      <div class="stepper">
        <div class="step ${step1}">1. Antrean Masuk</div>
        <div class="step ${step2}">2. Sedang Dikerjakan</div>
        <div class="step ${step3}">3. Selesai</div>
      </div>`
        : `<div style="margin-bottom:12px;">${statusTag('Dibatalkan')}</div>`
    }
    <div class="receipt-box">
      <div class="receipt-head">
        <div>
          <strong style="font-size:16px;">BENGKEL AUTORA</strong>
          <div class="muted mono" style="font-size:12px;">No. Nota #${esc(s.id.toUpperCase())} · ${esc(s.tanggal)}</div>
        </div>
        <div style="display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end;">
          ${statusTag(s.status)}
          ${paymentTag(s)}
        </div>
      </div>

      <div class="receipt-meta">
        <div><span class="muted">Pelanggan:</span> <strong>${esc(findCustomerName(v?.pelangganId))}</strong></div>
        <div><span class="muted">Kendaraan:</span> <strong class="mono">${esc(v?.plat || '—')}</strong> (${esc(v?.merek || '')} ${esc(v?.model || '')})</div>
        <div><span class="muted">Jenis Servis:</span> <strong>${esc(s.jenis)}</strong></div>
        <div><span class="muted">Mekanik:</span> <strong>${esc(findMechanicName(s.mekanikId))}</strong></div>
      </div>

      <div class="receipt-notes">
        <div><strong>Keluhan:</strong> ${esc(s.keluhan)}</div>
        <div><strong>Diagnosa / Catatan:</strong> ${esc(s.diagnosa || 'Belum ada catatan mekanik')}</div>
      </div>

      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Item / Deskripsi</th>
              <th class="num-col">Qty</th>
              <th class="num-col">Harga</th>
              <th class="num-col">Subtotal</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Biaya Jasa Utama (${esc(s.jenis)})</td>
              <td class="num-col">1</td>
              <td class="num-col">${rupiah(s.biayaJasa)}</td>
              <td class="num-col">${rupiah(s.biayaJasa)}</td>
            </tr>
            ${(s.details || [])
              .map(
                (d) => `
              <tr>
                <td>[${esc(d.tipe)}] ${esc(d.deskripsi)}</td>
                <td class="num-col">${Number(d.jumlah)}</td>
                <td class="num-col">${rupiah(d.harga)}</td>
                <td class="num-col">${rupiah(Number(d.jumlah) * Number(d.harga))}</td>
              </tr>`
              )
              .join('')}
          </tbody>
        </table>
      </div>

      <div class="receipt-totals">
        <div class="receipt-total-row"><span>Total Tagihan</span><strong>${rupiah(serviceTotal(s))}</strong></div>
        <div class="receipt-total-row"><span>Sudah Dibayar</span><strong style="color:var(--success);">${rupiah(servicePaid(s))}</strong></div>
        <div class="receipt-total-row"><span>Sisa Tagihan</span><strong style="color:${sisa > 0 ? 'var(--danger)' : 'var(--muted)'};">${rupiah(sisa)}</strong></div>
      </div>
    </div>

    <div class="modal-actions">
      <button type="button" class="btn secondary" id="printReceiptBtn">${ICONS.printer}<span>Cetak Nota</span></button>
      <button type="button" class="btn accent" id="closeReceiptBtn">Tutup</button>
    </div>`
  );

  document.getElementById('printReceiptBtn')?.addEventListener('click', () => window.print());
  document.getElementById('closeReceiptBtn')?.addEventListener('click', closeModal);
}
