import { hashPassword, makeSalt, verifyPassword } from '../crypto.js';
import { isAdmin } from '../rbac.js';
import { getCurrentUser, getDb, saveDb } from '../store.js';
import { closeModal, openModal, showToast } from '../ui.js';
import { esc } from '../utils.js';

export function openMyProfileModal(onChange = null) {
  const user = getCurrentUser();
  if (!user) return;
  const isDemo = Boolean(user.isDemoCustomer && !user.hash);

  openModal(
    `Profil Akun · @${user.username}`,
    `
    <form id="myProfileForm">
      <div class="form-grid">
        <div class="field">
          <label for="mpUsername">Username</label>
          <input id="mpUsername" value="@${esc(user.username)}" readonly />
        </div>
        <div class="field">
          <label for="mpNama">Nama Tampilan</label>
          <input id="mpNama" name="nama" value="${esc(user.nama)}" required />
        </div>
        ${
          !isDemo
            ? `
          <div class="field full" style="border-top:1px solid var(--border);padding-top:12px;margin-top:4px;">
            <label for="mpCurrentPass">Password Saat Ini (Wajib diisi jika ingin mengganti password)</label>
            <input id="mpCurrentPass" name="currentPassword" type="password" autocomplete="current-password" placeholder="Kosongkan jika hanya mengubah nama" />
          </div>
          <div class="field">
            <label for="mpNewPass">Password Baru (min. 6 karakter)</label>
            <input id="mpNewPass" name="newPassword" type="password" autocomplete="new-password" placeholder="Password baru" />
          </div>
          <div class="field">
            <label for="mpConfirmPass">Konfirmasi Password Baru</label>
            <input id="mpConfirmPass" name="confirmPassword" type="password" autocomplete="new-password" placeholder="Ulangi password baru" />
          </div>`
            : `<p class="muted field full" style="font-size:12px;">Akun demo pratinjau dapat memperbarui nama tampilan. Untuk akun pribadi penuh, silakan daftar melalui tab Daftar Pelanggan.</p>`
        }
      </div>
      <div class="modal-actions">
        <button type="button" class="btn secondary" id="mpCancelBtn">Batal</button>
        <button type="submit" class="btn accent">Simpan Profil</button>
      </div>
    </form>`
  );

  document.getElementById('mpCancelBtn')?.addEventListener('click', closeModal);
  document.getElementById('myProfileForm')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const d = Object.fromEntries(new FormData(event.currentTarget).entries());
    const nama = String(d.nama || '').trim();
    if (!nama) {
      showToast('Nama tampilan wajib diisi.');
      return;
    }

    const newPass = String(d.newPassword || '');
    const currentPass = String(d.currentPassword || '');
    const confirmPass = String(d.confirmPassword || '');

    if (newPass) {
      if (newPass.length < 6) {
        showToast('Password baru minimal 6 karakter.');
        return;
      }
      if (newPass !== confirmPass) {
        showToast('Konfirmasi password baru tidak cocok.');
        return;
      }
      const valid = await verifyPassword(currentPass, user);
      if (!valid) {
        showToast('Password saat ini tidak sesuai.');
        return;
      }
      user.salt = makeSalt();
      user.hash = await hashPassword(newPass, user.salt);
    }

    user.nama = nama;
    if (user.pelangganId) {
      const cust = getDb().pelanggan.find((p) => p.id === user.pelangganId);
      if (cust) cust.nama = nama;
    }

    saveDb();
    closeModal();
    onChange?.(user);
    showToast('Profil akun berhasil diperbarui.');
  });
}

export function openWorkshopSettingsModal(onChange = null) {
  if (!isAdmin(getCurrentUser())) {
    showToast('Hanya Administrator yang dapat mengubah identitas bengkel.');
    return;
  }

  const db = getDb();
  const s = db.settings || {};

  openModal(
    'Identitas & Nota Bengkel',
    `
    <p class="muted" style="font-size:13px;margin-bottom:14px;">Informasi ini tampil di header nota resmi pelanggan saat dicetak.</p>
    <form id="workshopSettingsForm">
      <div class="form-grid">
        <div class="field">
          <label for="wsName">Nama Bengkel</label>
          <input id="wsName" name="namaBengkel" value="${esc(s.namaBengkel || 'BENGKEL AUTORA')}" required />
        </div>
        <div class="field">
          <label for="wsPhone">Nomor Telepon / WhatsApp</label>
          <input id="wsPhone" name="teleponBengkel" value="${esc(s.teleponBengkel || '')}" />
        </div>
        <div class="field full">
          <label for="wsAddress">Alamat Bengkel</label>
          <input id="wsAddress" name="alamatBengkel" value="${esc(s.alamatBengkel || '')}" />
        </div>
        <div class="field full">
          <label for="wsFooter">Catatan Kaki Nota</label>
          <textarea id="wsFooter" name="catatanNota">${esc(s.catatanNota || '')}</textarea>
        </div>
      </div>
      <div class="modal-actions">
        <button type="button" class="btn secondary" id="wsCancelBtn">Batal</button>
        <button type="submit" class="btn accent">Simpan Identitas</button>
      </div>
    </form>`
  );

  document.getElementById('wsCancelBtn')?.addEventListener('click', closeModal);
  document.getElementById('workshopSettingsForm')?.addEventListener('submit', (event) => {
    event.preventDefault();
    const d = Object.fromEntries(new FormData(event.currentTarget).entries());
    db.settings = {
      namaBengkel: String(d.namaBengkel || '').trim() || 'BENGKEL AUTORA',
      teleponBengkel: String(d.teleponBengkel || '').trim(),
      alamatBengkel: String(d.alamatBengkel || '').trim(),
      catatanNota: String(d.catatanNota || '').trim(),
    };
    saveDb();
    closeModal();
    onChange?.();
    showToast('Identitas bengkel berhasil disimpan.');
  });
}
