import { hashPassword, makeSalt, verifyPassword } from '../crypto.js';
import { ROLE_CONFIG } from '../rbac.js';
import {
  getDb,
  getDemoCustomers,
  hasAdminAccount,
  saveDb,
  setCurrentUser,
} from '../store.js';
import { closeModal, openModal, showToast } from '../ui.js';
import { esc, today, uid } from '../utils.js';

let authTab = 'login';
let onAuthenticatedCallback = null;

function showAuthError(message) {
  const errEl = document.getElementById('authError');
  if (!errEl) return;
  errEl.textContent = message;
  errEl.hidden = false;
}

function clearAuthError() {
  const errEl = document.getElementById('authError');
  if (!errEl) return;
  errEl.textContent = '';
  errEl.hidden = true;
}

export function switchAuthTab(tab) {
  authTab = tab;
  const isReg = tab === 'register';

  document.getElementById('tabLogin')?.classList.toggle('active', !isReg);
  document.getElementById('tabRegister')?.classList.toggle('active', isReg);
  document.getElementById('tabLogin')?.setAttribute('aria-selected', String(!isReg));
  document.getElementById('tabRegister')?.setAttribute('aria-selected', String(isReg));

  const regNameField = document.getElementById('regNameField');
  const regPhoneField = document.getElementById('regPhoneField');
  const confirmField = document.getElementById('confirmField');
  const demoBox = document.getElementById('demoBox');

  if (regNameField) regNameField.hidden = !isReg;
  if (regPhoneField) regPhoneField.hidden = !isReg;
  if (confirmField) confirmField.hidden = !isReg;
  if (demoBox) demoBox.hidden = isReg;

  const titleEl = document.getElementById('authTitle');
  const descEl = document.getElementById('authDesc');
  const submitEl = document.getElementById('authSubmit');
  const passInput = document.getElementById('authPass');

  if (titleEl) titleEl.textContent = isReg ? 'Daftar Akun Pelanggan Baru' : 'Masuk ke Sistem AUTORA';
  if (descEl) {
    descEl.textContent = isReg
      ? 'Buat akun pribadi untuk memesan servis, memantau progres, dan melihat tagihan.'
      : 'Gunakan akun sesuai hak akses Anda (Admin, Operator, atau Pelanggan).';
  }
  if (submitEl) submitEl.textContent = isReg ? 'Daftar & Masuk Sekarang' : 'Masuk ke AUTORA';
  if (passInput) passInput.setAttribute('autocomplete', isReg ? 'new-password' : 'current-password');

  clearAuthError();
}

export function refreshAuthScreen() {
  const banner = document.getElementById('firstRunBanner');
  if (banner) {
    banner.hidden = hasAdminAccount();
  }

  const demoList = document.getElementById('demoCustomerList');
  if (demoList) {
    const customers = getDemoCustomers();
    demoList.innerHTML = customers
      .map(
        (u) => `
      <div class="demo-item">
        <div class="demo-item-info">
          <strong>${esc(u.nama)} (@${esc(u.username)})</strong>
          <span>Portal Pelanggan · Booking &amp; Tagihan</span>
        </div>
        <button type="button" class="btn small secondary" data-demo-login="${esc(u.id)}">Masuk</button>
      </div>`
      )
      .join('');
  }
}

export function openFirstRunSetupModal() {
  if (hasAdminAccount()) {
    showToast('Akun Administrator sudah terkonfigurasi.');
    return;
  }

  openModal(
    'Aktivasi Awal Administrator',
    `
    <p class="muted" style="margin-bottom:14px;font-size:13px;">
      Tentukan kredensial Administrator utama untuk mengamankan sistem bengkel. Anda juga dapat langsung membuat akun Operator front-desk secara opsional.
    </p>
    <form id="firstRunForm">
      <div class="form-grid">
        <div class="field">
          <label for="setupAdminName">Nama Administrator</label>
          <input id="setupAdminName" name="adminNama" value="Administrator Utama" required />
        </div>
        <div class="field">
          <label for="setupAdminUser">Username Admin</label>
          <input id="setupAdminUser" name="adminUsername" value="admin" required pattern="[a-z0-9_.-]{3,20}" />
        </div>
        <div class="field">
          <label for="setupAdminPass">Password Admin (min. 6 karakter)</label>
          <input id="setupAdminPass" name="adminPassword" type="password" minlength="6" required placeholder="Buat password kuat" />
        </div>
        <div class="field">
          <label for="setupAdminConfirm">Konfirmasi Password</label>
          <input id="setupAdminConfirm" name="adminConfirm" type="password" minlength="6" required placeholder="Ulangi password" />
        </div>
        <div class="field full" style="border-top:1px solid var(--border);padding-top:12px;margin-top:4px;">
          <label for="setupOpUser">Buat Sekaligus Akun Operator (Opsional)</label>
          <div class="form-grid" style="margin-top:4px;">
            <input id="setupOpUser" name="opUsername" placeholder="Username operator (mis. operator)" />
            <input id="setupOpPass" name="opPassword" type="password" placeholder="Password operator (min. 6 karakter)" />
          </div>
        </div>
      </div>
      <div class="modal-actions">
        <button type="button" class="btn secondary" data-close-modal="true">Batal</button>
        <button type="submit" class="btn accent">Simpan &amp; Masuk sebagai Admin</button>
      </div>
    </form>`
  );

  const form = document.getElementById('firstRunForm');
  form?.querySelector('[data-close-modal]')?.addEventListener('click', closeModal);
  form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const d = Object.fromEntries(new FormData(form).entries());
    const adminUsername = String(d.adminUsername || '').trim().toLowerCase();
    const adminNama = String(d.adminNama || '').trim();
    const adminPassword = String(d.adminPassword || '');
    const adminConfirm = String(d.adminConfirm || '');

    if (!/^[a-z0-9_.-]{3,20}$/.test(adminUsername)) {
      showToast('Username admin 3–20 karakter huruf kecil, angka, titik, atau garis bawah.');
      return;
    }
    if (adminPassword.length < 6) {
      showToast('Password Admin minimal 6 karakter.');
      return;
    }
    if (adminPassword !== adminConfirm) {
      showToast('Konfirmasi password Admin tidak cocok.');
      return;
    }

    const db = getDb();
    if (db.users.some((u) => u.username.toLowerCase() === adminUsername)) {
      showToast('Username sudah dipakai. Gunakan username lain.');
      return;
    }

    const opUsername = String(d.opUsername || '').trim().toLowerCase();
    const opPassword = String(d.opPassword || '');
    if (opUsername) {
      if (!/^[a-z0-9_.-]{3,20}$/.test(opUsername) || opUsername === adminUsername) {
        showToast('Username Operator tidak valid atau sama dengan Admin.');
        return;
      }
      if (opPassword.length < 6) {
        showToast('Password Operator minimal 6 karakter.');
        return;
      }
    }

    const adminSalt = makeSalt();
    const adminHash = await hashPassword(adminPassword, adminSalt);
    const adminUser = {
      id: uid('u'),
      username: adminUsername,
      nama: adminNama || 'Administrator Utama',
      role: 'admin',
      pelangganId: null,
      salt: adminSalt,
      hash: adminHash,
      aktif: true,
      createdAt: today(),
    };
    db.users.push(adminUser);

    if (opUsername && opPassword) {
      const opSalt = makeSalt();
      const opHash = await hashPassword(opPassword, opSalt);
      db.users.push({
        id: uid('u'),
        username: opUsername,
        nama: 'Operator Front-Desk',
        role: 'operator',
        pelangganId: null,
        salt: opSalt,
        hash: opHash,
        aktif: true,
        createdAt: today(),
      });
    }

    saveDb();
    closeModal();
    setCurrentUser(adminUser);
    refreshAuthScreen();
    onAuthenticatedCallback?.(adminUser);
    showToast(`Akun Administrator @${adminUser.username} aktif.`);
  });
}

async function handleLoginSubmit(username, password) {
  const db = getDb();
  const user = db.users.find((u) => u.username.toLowerCase() === username.toLowerCase());
  if (!user) {
    showAuthError('Username tidak ditemukan.');
    return;
  }
  if (!user.aktif) {
    showAuthError('Akun ini sedang dinonaktifkan oleh Administrator.');
    return;
  }
  if (user.isDemoCustomer && !user.hash) {
    showAuthError('Akun sampel ini tidak memiliki password. Gunakan tombol "Masuk" pada panel Pratinjau Pelanggan.');
    return;
  }
  const ok = await verifyPassword(password, user);
  if (!ok) {
    showAuthError('Password yang Anda masukkan tidak sesuai.');
    return;
  }
  setCurrentUser(user);
  onAuthenticatedCallback?.(user);
  showToast(`Selamat datang, ${user.nama} (${ROLE_CONFIG[user.role].label})`);
}

async function handleRegisterSubmit(formValues) {
  const db = getDb();
  const nama = String(formValues.nama || '').trim();
  const telepon = String(formValues.telepon || '').trim();
  const username = String(formValues.username || '').trim().toLowerCase();
  const password = String(formValues.password || '');
  const confirmPassword = String(formValues.confirmPassword || '');

  if (!nama) {
    showAuthError('Nama lengkap wajib diisi.');
    return;
  }
  if (!/^[a-z0-9_.-]{3,20}$/.test(username)) {
    showAuthError('Username 3–20 karakter (huruf kecil, angka, titik, underscore, strip).');
    return;
  }
  if (password.length < 6) {
    showAuthError('Password minimal 6 karakter.');
    return;
  }
  if (password !== confirmPassword) {
    showAuthError('Konfirmasi password tidak cocok.');
    return;
  }
  if (db.users.some((u) => u.username.toLowerCase() === username)) {
    showAuthError('Username sudah terdaftar. Silakan gunakan username lain.');
    return;
  }

  const pid = uid('p');
  db.pelanggan.push({
    id: pid,
    nama,
    telepon: telepon || '-',
    alamat: 'Terdaftar mandiri',
  });

  const salt = makeSalt();
  const hash = await hashPassword(password, salt);
  const newUser = {
    id: uid('u'),
    username,
    nama,
    role: 'user',
    pelangganId: pid,
    salt,
    hash,
    aktif: true,
    createdAt: today(),
  };

  db.users.push(newUser);
  saveDb();
  setCurrentUser(newUser);
  onAuthenticatedCallback?.(newUser);
  showToast(`Akun berhasil dibuat. Selamat datang, ${nama}.`);
}

export function initAuth(onAuthenticated) {
  onAuthenticatedCallback = onAuthenticated;

  document.getElementById('authTabs')?.addEventListener('click', (event) => {
    const btn = event.target.closest('button[data-auth-tab]');
    if (btn) {
      switchAuthTab(btn.dataset.authTab);
    }
  });

  document.getElementById('openFirstRunBtn')?.addEventListener('click', openFirstRunSetupModal);

  document.getElementById('demoCustomerList')?.addEventListener('click', (event) => {
    const btn = event.target.closest('button[data-demo-login]');
    if (!btn) return;
    const user = getDb().users.find(
      (u) => u.id === btn.dataset.demoLogin && u.role === 'user' && u.isDemoCustomer && u.aktif
    );
    if (!user) return;
    setCurrentUser(user);
    onAuthenticatedCallback?.(user);
    showToast(`Masuk sebagai pelanggan demo: ${user.nama}`);
  });

  document.getElementById('authForm')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    clearAuthError();
    const formData = Object.fromEntries(new FormData(event.currentTarget).entries());
    const username = String(formData.username || '').trim().toLowerCase();
    const password = String(formData.password || '');

    if (!username || !password) {
      showAuthError('Username dan password wajib diisi.');
      return;
    }

    if (authTab === 'register') {
      await handleRegisterSubmit(formData);
    } else {
      await handleLoginSubmit(username, password);
    }
  });

  switchAuthTab('login');
  refreshAuthScreen();
}
