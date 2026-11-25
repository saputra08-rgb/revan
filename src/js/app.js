import { ICONS } from './icons.js';
import { canAccessView, isAdmin, ROLE_CONFIG, VIEW_TITLES } from './rbac.js';
import {
  buildSeedData,
  getCurrentUser,
  getDb,
  initStore,
  replaceDb,
  restoreSessionUser,
  setCurrentUser,
} from './store.js';
import { confirmDialog, initModalListeners, roleLabel, showToast } from './ui.js';
import { debounce, esc } from './utils.js';
import {
  exportJsonBackup,
  exportReportsCsv,
  importJsonBackup,
  openUserAccountForm,
  openVehicleHistoryModal,
  renderKendaraan,
  renderMekanik,
  renderPengguna,
  renderReports,
  toggleUserActive,
} from './views/admin.js';
import { initAuth, refreshAuthScreen, switchAuthTab } from './views/auth.js';
import { renderDashboard } from './views/dashboard.js';
import { openEntityForm, openQuickVehicleForCustomer, removeEntityItem } from './views/forms.js';
import { renderPelanggan } from './views/pelanggan.js';
import {
  cancelUserBooking,
  openServiceReceiptModal,
  openUserBookingForm,
  openUserVehicleForm,
  renderUserBills,
  renderUserPortal,
} from './views/portal.js';
import { openServiceWorkbench, renderServis } from './views/servis.js';

let activeView = null;

export function renderActiveViews() {
  const user = getCurrentUser();
  if (!user) return;

  if (user.role === 'user') {
    renderUserPortal();
    renderUserBills();
    return;
  }

  if (user.role === 'operator') {
    renderServis();
    renderPelanggan();
    return;
  }

  renderDashboard();
  renderServis();
  renderPelanggan();
  renderKendaraan();
  renderMekanik();
  renderReports();
  renderPengguna();
}

function showView(viewId) {
  const user = getCurrentUser();
  if (!user) return;

  const targetView = canAccessView(user, viewId) ? viewId : ROLE_CONFIG[user.role].defaultView;
  activeView = targetView;

  document.querySelectorAll('.view').forEach((section) => {
    section.classList.toggle('active', section.id === `view-${targetView}`);
  });

  document.querySelectorAll('#nav button[data-view], #mobileBottomNav button[data-view]').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.view === targetView);
  });

  const pageLabel = VIEW_TITLES[targetView] || 'AUTORA';
  const pageTitleEl = document.getElementById('pageTitle');
  const mobileTitleEl = document.getElementById('mobilePageTitle');
  if (pageTitleEl) pageTitleEl.textContent = pageLabel;
  if (mobileTitleEl) mobileTitleEl.textContent = pageLabel;

  renderActiveViews();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function applySession(user) {
  const authScreen = document.getElementById('authScreen');
  const appShell = document.getElementById('appShell');
  if (authScreen) authScreen.hidden = true;
  if (appShell) appShell.hidden = false;

  const cfg = ROLE_CONFIG[user.role];
  const roleIcon = ICONS[cfg.icon] || ICONS.shield;

  const signedInEl = document.getElementById('signedInUser');
  if (signedInEl) {
    signedInEl.innerHTML = `${esc(user.nama)} (@${esc(user.username)}) ${roleLabel(user.role)}`;
  }

  const eyebrowEl = document.getElementById('pageEyebrow');
  if (eyebrowEl) eyebrowEl.textContent = cfg.eyebrow;

  const noticeEl = document.getElementById('roleNotice');
  if (noticeEl) {
    noticeEl.innerHTML = `${ICONS.info}<span>${esc(cfg.notice)}</span>`;
  }

  const sideNoteEl = document.getElementById('sideNote');
  if (sideNoteEl) {
    sideNoteEl.innerHTML = `<strong>${esc(cfg.sideTitle)}</strong>${cfg.sideItems.map((line) => `<div>· ${esc(line)}</div>`).join('')}`;
  }

  const sidebarUserCard = document.getElementById('sidebarUserCard');
  if (sidebarUserCard) {
    sidebarUserCard.innerHTML = `
      <div class="role-avatar-box">${roleIcon}</div>
      <div class="role-meta">
        <div class="role-meta-name">${esc(user.nama)}</div>
        <div class="role-meta-sub">@${esc(user.username)}</div>
        <div style="margin-top:4px;">${roleLabel(user.role)}</div>
      </div>`;
  }

  const resetBtn = document.getElementById('resetBtn');
  const mobileResetBtn = document.getElementById('mobileResetBtn');
  const allowAdmin = isAdmin(user);
  if (resetBtn) resetBtn.hidden = !allowAdmin;
  if (mobileResetBtn) mobileResetBtn.hidden = !allowAdmin;

  const mobileSub = document.getElementById('mobileUserSub');
  if (mobileSub) mobileSub.textContent = `${user.nama} · ${cfg.label}`;

  const navEl = document.getElementById('nav');
  if (navEl) {
    navEl.innerHTML = cfg.menus
      .map(
        (m) => `
      <button type="button" data-view="${esc(m.id)}">
        ${ICONS[m.icon] || ''}
        <span>${esc(m.label)}</span>
      </button>`
      )
      .join('');
  }

  const mobileNavEl = document.getElementById('mobileBottomNav');
  if (mobileNavEl) {
    mobileNavEl.innerHTML = cfg.menus
      .map(
        (m) => `
      <button type="button" data-view="${esc(m.id)}">
        ${ICONS[m.icon] || ''}
        <span>${esc(m.label.split(' ')[0])}</span>
      </button>`
      )
      .join('');
  }

  showView(cfg.defaultView);
}

function handleLogout() {
  setCurrentUser(null);
  activeView = null;
  const authScreen = document.getElementById('authScreen');
  const appShell = document.getElementById('appShell');
  if (appShell) appShell.hidden = true;
  if (authScreen) authScreen.hidden = false;

  const form = document.getElementById('authForm');
  if (form instanceof HTMLFormElement) form.reset();
  switchAuthTab('login');
  refreshAuthScreen();
  showToast('Anda telah keluar dari sistem.');
}

async function handleResetDemo() {
  const user = getCurrentUser();
  if (!isAdmin(user)) return;

  const confirmed = await confirmDialog({
    title: 'Reset Data Bengkel',
    message: 'Data pelanggan, kendaraan, mekanik, dan servis akan dikembalikan ke data awal demo. Akun Admin dan Operator Anda tetap dipertahankan.',
    confirmLabel: 'Reset Data Demo',
    danger: true,
  });
  if (!confirmed) return;

  const staffAccounts = getDb().users.filter((u) => u.role === 'admin' || u.role === 'operator');
  const nextDb = buildSeedData({ preserveStaffAccounts: staffAccounts });
  replaceDb(nextDb);

  const currentStaff = getDb().users.find((u) => u.id === user.id) || getDb().users.find((u) => u.role === 'admin');
  if (currentStaff) {
    setCurrentUser(currentStaff);
    applySession(currentStaff);
  }
  showToast('Data bengkel berhasil direset ke kondisi awal demo.');
}

function bindWorkspaceEvents() {
  document.getElementById('nav')?.addEventListener('click', (event) => {
    const btn = event.target.closest('button[data-view]');
    if (btn) showView(btn.dataset.view);
  });

  document.getElementById('mobileBottomNav')?.addEventListener('click', (event) => {
    const btn = event.target.closest('button[data-view]');
    if (btn) showView(btn.dataset.view);
  });

  document.getElementById('logoutBtn')?.addEventListener('click', handleLogout);
  document.getElementById('mobileLogoutBtn')?.addEventListener('click', handleLogout);
  document.getElementById('resetBtn')?.addEventListener('click', handleResetDemo);
  document.getElementById('mobileResetBtn')?.addEventListener('click', handleResetDemo);

  document.getElementById('btnUserAddVehicle')?.addEventListener('click', () => {
    openUserVehicleForm(null, renderActiveViews);
  });

  document.getElementById('btnUserBookService')?.addEventListener('click', () => {
    openUserBookingForm('', renderActiveViews);
  });

  document.getElementById('btnAddAccount')?.addEventListener('click', () => {
    openUserAccountForm(null, renderActiveViews);
  });

  document.getElementById('exportBtn')?.addEventListener('click', exportReportsCsv);
  document.getElementById('backupJsonBtn')?.addEventListener('click', exportJsonBackup);
  document.getElementById('restoreJsonInput')?.addEventListener('change', async (event) => {
    const input = event.currentTarget;
    if (!(input instanceof HTMLInputElement)) return;
    const file = input.files?.[0];
    if (file) {
      await importJsonBackup(file, renderActiveViews);
      input.value = '';
    }
  });

  document.getElementById('filterStatusServis')?.addEventListener('change', renderServis);

  const searchMap = {
    searchServis: renderServis,
    searchPelanggan: renderPelanggan,
    searchKendaraan: renderKendaraan,
    searchMekanik: renderMekanik,
    searchPengguna: renderPengguna,
  };
  Object.entries(searchMap).forEach(([inputId, renderFn]) => {
    document.getElementById(inputId)?.addEventListener('input', debounce(renderFn, 120));
  });

  // Event delegation for all interactive buttons inside #mainContent
  document.getElementById('mainContent')?.addEventListener('click', (event) => {
    const target = event.target.closest('button');
    if (!target) return;

    if (target.dataset.navTarget) {
      showView(target.dataset.navTarget);
      return;
    }
    if (target.dataset.openForm) {
      openEntityForm(target.dataset.openForm, null, renderActiveViews);
      return;
    }
    if (target.dataset.editEntity && target.dataset.id) {
      openEntityForm(target.dataset.editEntity, target.dataset.id, renderActiveViews);
      return;
    }
    if (target.dataset.removeEntity && target.dataset.id) {
      removeEntityItem(target.dataset.removeEntity, target.dataset.id, renderActiveViews);
      return;
    }
    if (target.dataset.openService) {
      openServiceWorkbench(target.dataset.openService, renderActiveViews);
      return;
    }
    if (target.dataset.quickVehicle) {
      openQuickVehicleForCustomer(target.dataset.quickVehicle, renderActiveViews);
      return;
    }
    if (target.dataset.vehicleHistory) {
      openVehicleHistoryModal(target.dataset.vehicleHistory);
      return;
    }
    if (target.dataset.editAccount) {
      openUserAccountForm(target.dataset.editAccount, renderActiveViews);
      return;
    }
    if (target.dataset.toggleAccount) {
      toggleUserActive(target.dataset.toggleAccount, renderActiveViews);
      return;
    }
    if (target.dataset.userBook) {
      openUserBookingForm(target.dataset.userBook, renderActiveViews);
      return;
    }
    if (target.dataset.userEditVehicle) {
      openUserVehicleForm(target.dataset.userEditVehicle, renderActiveViews);
      return;
    }
    if (target.dataset.userReceipt) {
      openServiceReceiptModal(target.dataset.userReceipt);
      return;
    }
    if (target.dataset.userCancel) {
      cancelUserBooking(target.dataset.userCancel, renderActiveViews);
    }
  });
}

export function bootstrapApp() {
  initStore();
  initModalListeners();
  initAuth(applySession);
  bindWorkspaceEvents();

  const existingUser = restoreSessionUser();
  if (existingUser) {
    applySession(existingUser);
  } else {
    const authScreen = document.getElementById('authScreen');
    const appShell = document.getElementById('appShell');
    if (authScreen) authScreen.hidden = false;
    if (appShell) appShell.hidden = true;
  }
}

export function getActiveView() {
  return activeView;
}
