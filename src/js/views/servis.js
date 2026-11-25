import { ICONS } from '../icons.js';
import {
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
import { esc, rupiah, servicePaid, serviceTotal, today, uid } from '../utils.js';
import { openEntityForm } from './forms.js';
import { openServiceReceiptModal } from './portal.js';

export function renderServis() {
  const user = getCurrentUser();
  if (!user) return;
  const db = getDb();
  const query = (document.getElementById('searchServis')?.value || '').trim().toLowerCase();
  const statusFilter = document.getElementById('filterStatusServis')?.value || '';
  const opStatsEl = document.getElementById('operatorQueueStats');

  if (opStatsEl) {
    if (user.role === 'operator') {
      opStatsEl.hidden = false;
      const waiting = db.servis.filter((s) => s.status === 'Menunggu').length;
      const working = db.servis.filter((s) => s.status === 'Dikerjakan').length;
      const doneToday = db.servis.filter((s) => s.status === 'Selesai' && s.tanggal === today()).length;

      opStatsEl.innerHTML = [
        { label: 'Antrean Menunggu', value: waiting, hint: 'Perlu segera diproses', icon: ICONS.clock },
        { label: 'Sedang Dikerjakan', value: working, hint: 'Ditangani mekanik', icon: ICONS.wrench },
        { label: 'Selesai Hari Ini', value: doneToday, hint: 'Siap serah terima', icon: ICONS.check },
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
    } else {
      opStatsEl.hidden = true;
      opStatsEl.innerHTML = '';
    }
  }

  const list = [...db.servis]
    .sort((a, b) => b.tanggal.localeCompare(a.tanggal))
    .filter((s) => {
      if (statusFilter && s.status !== statusFilter) return false;
      if (!query) return true;
      const v = findVehicle(s.kendaraanId);
      const haystack = `${v?.plat || ''} ${findCustomerName(v?.pelangganId)} ${s.keluhan} ${s.jenis}`.toLowerCase();
      return haystack.includes(query);
    });

  const rows = list.map((s) => {
    const v = findVehicle(s.kendaraanId);
    return `
    <tr>
      <td class="mono">${esc(s.tanggal)}</td>
      <td>
        <div class="cell-primary mono">${esc(v?.plat || '—')}</div>
        <div class="cell-sub">${esc(findCustomerName(v?.pelangganId))}</div>
      </td>
      <td>
        <div class="cell-primary">${esc(s.jenis)}</div>
        <div class="cell-sub">${esc(s.keluhan)}</div>
      </td>
      <td>${esc(findMechanicName(s.mekanikId))}</td>
      <td>${statusTag(s.status)}</td>
      <td>${paymentTag(s)}</td>
      <td class="num-col"><strong>${rupiah(serviceTotal(s))}</strong></td>
      <td><button type="button" class="btn small accent" data-open-service="${esc(s.id)}">Kelola</button></td>
    </tr>`;
  });

  const tableEl = document.getElementById('tableServis');
  if (tableEl) {
    tableEl.innerHTML = renderTable(
      ['Tanggal', 'Kendaraan / Pemilik', 'Keluhan & Jenis', 'Mekanik', 'Status', 'Pembayaran', { label: 'Total', numeric: true }, 'Aksi'],
      rows,
      'Tidak ada antrean servis yang cocok dengan filter saat ini.'
    );
  }
}

export function openServiceWorkbench(sid, onChange = null) {
  const db = getDb();
  const s = db.servis.find((x) => x.id === sid);
  if (!s) return;

  const v = findVehicle(s.kendaraanId);
  const nextStatus = s.status === 'Menunggu' ? 'Dikerjakan' : s.status === 'Dikerjakan' ? 'Selesai' : null;
  const isCanceled = s.status === 'Dibatalkan';
  const sisa = isCanceled ? 0 : Math.max(0, serviceTotal(s) - servicePaid(s));

  const detailRows = (s.details || []).map(
    (d) => `
    <tr>
      <td>${esc(d.tipe)}</td>
      <td>${esc(d.deskripsi)}</td>
      <td class="num-col">${Number(d.jumlah)}</td>
      <td class="num-col">${rupiah(d.harga)}</td>
      <td class="num-col">${rupiah(Number(d.jumlah) * Number(d.harga))}</td>
      <td>${!isCanceled ? `<button type="button" class="link-btn" data-remove-detail="${esc(d.id)}">Hapus</button>` : ''}</td>
    </tr>`
  );

  const paymentRows = (s.payments || []).map(
    (p) => `
    <tr>
      <td class="mono">${esc(p.tanggal)}</td>
      <td>${esc(p.metode)}</td>
      <td class="num-col">${rupiah(p.jumlah)}</td>
    </tr>`
  );

  openModal(
    `Kelola Servis · ${v?.plat || ''}`,
    `
    <div class="service-summary-strip">
      <div class="service-summary-cell">
        <span>Pelanggan</span>
        <strong style="font-family:var(--font-sans);">${esc(findCustomerName(v?.pelangganId))}</strong>
      </div>
      <div class="service-summary-cell">
        <span>Total Tagihan</span>
        <strong>${rupiah(serviceTotal(s))}</strong>
      </div>
      <div class="service-summary-cell">
        <span>Sisa Tagihan</span>
        <strong style="color:${sisa > 0 ? 'var(--danger)' : 'var(--success)'};">${rupiah(sisa)}</strong>
      </div>
    </div>

    <div class="receipt-notes">
      <div><strong>Keluhan:</strong> ${esc(s.keluhan)}</div>
      <div><strong>Diagnosa:</strong> ${esc(s.diagnosa || 'Belum ada diagnosa')}</div>
      <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:4px;">
        <span><strong>Mekanik:</strong> ${esc(findMechanicName(s.mekanikId))}</span>
        ${statusTag(s.status)}
        ${paymentTag(s)}
      </div>
    </div>

    <div class="modal-actions" style="justify-content:flex-start;margin:12px 0 18px;">
      ${!isCanceled && nextStatus ? `<button type="button" class="btn accent" id="wbAdvanceBtn">Proses ke ${esc(nextStatus)}</button>` : ''}
      ${!isCanceled ? `<button type="button" class="btn secondary" id="wbEditBtn">Edit / Tugaskan Mekanik</button>` : ''}
      ${!isCanceled ? `<button type="button" class="btn secondary" id="wbAddDetailBtn">Tambah Jasa / Sparepart</button>` : ''}
      ${!isCanceled && sisa > 0 ? `<button type="button" class="btn success" id="wbAddPaymentBtn">Catat Pembayaran</button>` : ''}
      <button type="button" class="btn secondary" id="wbReceiptBtn">${ICONS.printer}<span>Nota</span></button>
      ${!isCanceled && s.status !== 'Selesai' && servicePaid(s) === 0 ? `<button type="button" class="btn danger" id="wbCancelServiceBtn">Batalkan Servis</button>` : ''}
    </div>

    <h3 style="font-size:14px;font-weight:700;margin-bottom:8px;">Rincian Jasa &amp; Sparepart</h3>
    <div class="table-wrap">
      ${renderTable(
        ['Tipe', 'Deskripsi', { label: 'Qty', numeric: true }, { label: 'Harga', numeric: true }, { label: 'Subtotal', numeric: true }, ''],
        detailRows,
        'Belum ada tambahan jasa atau sparepart.'
      )}
    </div>
    <div class="receipt-totals" style="margin-bottom:18px;">
      <div class="receipt-total-row"><span>Biaya jasa utama</span><strong>${rupiah(s.biayaJasa)}</strong></div>
      <div class="receipt-total-row"><strong>Total Tagihan Servis</strong><strong>${rupiah(serviceTotal(s))}</strong></div>
    </div>

    <h3 style="font-size:14px;font-weight:700;margin-bottom:8px;">Riwayat Pembayaran</h3>
    <div class="table-wrap">
      ${renderTable(
        ['Tanggal', 'Metode', { label: 'Jumlah', numeric: true }],
        paymentRows,
        'Belum ada pembayaran tercatat.'
      )}
    </div>
    <div class="receipt-totals">
      <div class="receipt-total-row"><strong>Total Dibayar</strong><strong style="color:var(--success);">${rupiah(servicePaid(s))}</strong></div>
    </div>`
  );

  document.getElementById('wbAdvanceBtn')?.addEventListener('click', () => {
    if (s.status === 'Menunggu') s.status = 'Dikerjakan';
    else if (s.status === 'Dikerjakan') s.status = 'Selesai';
    saveDb();
    onChange?.();
    openServiceWorkbench(sid, onChange);
    showToast(`Status antrean diperbarui ke ${s.status}.`);
  });

  document.getElementById('wbEditBtn')?.addEventListener('click', () => {
    closeModal();
    openEntityForm('servis', sid, onChange);
  });

  document.getElementById('wbAddDetailBtn')?.addEventListener('click', () => {
    openAddDetailModal(sid, onChange);
  });

  document.getElementById('wbAddPaymentBtn')?.addEventListener('click', () => {
    openAddPaymentModal(sid, onChange);
  });

  document.getElementById('wbReceiptBtn')?.addEventListener('click', () => {
    openServiceReceiptModal(sid);
  });

  document.getElementById('wbCancelServiceBtn')?.addEventListener('click', async () => {
    const confirmed = await confirmDialog({
      title: 'Batalkan Antrean Servis',
      message: 'Antrean servis ini akan ditandai sebagai Dibatalkan. Lanjutkan?',
      confirmLabel: 'Ya, Batalkan',
      danger: true,
    });
    if (!confirmed) {
      openServiceWorkbench(sid, onChange);
      return;
    }
    s.status = 'Dibatalkan';
    saveDb();
    onChange?.();
    openServiceWorkbench(sid, onChange);
    showToast('Antrean servis dibatalkan.');
  });

  document.getElementById('modalBody')?.querySelectorAll('[data-remove-detail]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const did = btn.getAttribute('data-remove-detail');
      s.details = (s.details || []).filter((d) => d.id !== did);
      saveDb();
      onChange?.();
      openServiceWorkbench(sid, onChange);
      showToast('Rincian dihapus.');
    });
  });
}

function openAddDetailModal(sid, onChange) {
  const db = getDb();
  const s = db.servis.find((x) => x.id === sid);
  if (!s) return;

  openModal(
    'Tambah Rincian Jasa / Sparepart',
    `
    <form id="detailForm">
      <div class="form-grid">
        <div class="field">
          <label for="dtTipe">Tipe Rincian</label>
          <select id="dtTipe" name="tipe">
            <option value="Sparepart">Sparepart</option>
            <option value="Jasa">Jasa</option>
          </select>
        </div>
        <div class="field">
          <label for="dtDesk">Deskripsi</label>
          <input id="dtDesk" name="deskripsi" required placeholder="Contoh: Oli Mesin 1L" />
        </div>
        <div class="field">
          <label for="dtJumlah">Jumlah</label>
          <input id="dtJumlah" name="jumlah" type="number" min="1" value="1" required />
        </div>
        <div class="field">
          <label for="dtHarga">Harga Satuan (Rp)</label>
          <input id="dtHarga" name="harga" type="number" min="0" value="50000" required />
        </div>
      </div>
      <div class="modal-actions">
        <button type="button" class="btn secondary" id="dtBackBtn">Kembali</button>
        <button type="submit" class="btn accent">Tambahkan</button>
      </div>
    </form>`
  );

  document.getElementById('dtBackBtn')?.addEventListener('click', () => openServiceWorkbench(sid, onChange));
  document.getElementById('detailForm')?.addEventListener('submit', (event) => {
    event.preventDefault();
    const d = Object.fromEntries(new FormData(event.currentTarget).entries());
    const jumlah = Math.max(1, Number(d.jumlah) || 1);
    const harga = Math.max(0, Number(d.harga) || 0);
    s.details.push({
      id: uid('d'),
      tipe: String(d.tipe || 'Sparepart'),
      deskripsi: String(d.deskripsi || '').trim(),
      jumlah,
      harga,
    });
    saveDb();
    onChange?.();
    openServiceWorkbench(sid, onChange);
    showToast('Rincian ditambahkan.');
  });
}

function openAddPaymentModal(sid, onChange) {
  const db = getDb();
  const s = db.servis.find((x) => x.id === sid);
  if (!s) return;

  const remain = Math.max(0, serviceTotal(s) - servicePaid(s));
  if (remain <= 0) {
    showToast('Tagihan sudah lunas.');
    return;
  }

  openModal(
    'Catat Pembayaran Pelanggan',
    `
    <p class="muted" style="margin-bottom:12px;">Sisa tagihan saat ini: <strong class="mono">${rupiah(remain)}</strong></p>
    <form id="paymentForm">
      <div class="form-grid">
        <div class="field">
          <label for="payDate">Tanggal Pembayaran</label>
          <input id="payDate" type="date" name="tanggal" value="${today()}" required />
        </div>
        <div class="field">
          <label for="payAmount">Jumlah (Rp)</label>
          <input id="payAmount" type="number" name="jumlah" min="1" max="${remain}" value="${remain}" required />
        </div>
        <div class="field full">
          <label for="payMethod">Metode Pembayaran</label>
          <select id="payMethod" name="metode">
            <option value="Tunai">Tunai</option>
            <option value="Transfer Bank">Transfer Bank</option>
            <option value="QRIS">QRIS</option>
            <option value="Debit / Kartu">Debit / Kartu</option>
          </select>
        </div>
      </div>
      <div class="modal-actions">
        <button type="button" class="btn secondary" id="payBackBtn">Kembali</button>
        <button type="submit" class="btn success">Simpan Pembayaran</button>
      </div>
    </form>`
  );

  document.getElementById('payBackBtn')?.addEventListener('click', () => openServiceWorkbench(sid, onChange));
  document.getElementById('paymentForm')?.addEventListener('submit', (event) => {
    event.preventDefault();
    const d = Object.fromEntries(new FormData(event.currentTarget).entries());
    const amount = Number(d.jumlah);
    const currentRemain = Math.max(0, serviceTotal(s) - servicePaid(s));
    if (!Number.isFinite(amount) || amount <= 0 || amount > currentRemain) {
      showToast('Nominal pembayaran harus antara Rp 1 dan sisa tagihan.');
      return;
    }
    s.payments.push({
      id: uid('pay'),
      tanggal: String(d.tanggal || today()),
      jumlah: amount,
      metode: String(d.metode || 'Tunai'),
    });
    saveDb();
    onChange?.();
    openServiceWorkbench(sid, onChange);
    showToast('Pembayaran berhasil dicatat.');
  });
}
