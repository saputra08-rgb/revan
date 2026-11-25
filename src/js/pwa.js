import { closeModal, openModal, showToast } from './ui.js';

let deferredInstallPrompt = null;
let isInstalled = false;
let isIOS = false;

function updateInstallButtons() {
  const canPrompt = Boolean(deferredInstallPrompt) || isIOS;
  const shouldShow = !isInstalled && canPrompt;

  ['pwaInstallBtn', 'mobileInstallBtn'].forEach((id) => {
    const btn = document.getElementById(id);
    if (!btn) return;
    btn.hidden = !shouldShow;
  });
}

function updateOfflineIndicator() {
  const banner = document.getElementById('offlineBanner');
  if (!banner) return;
  banner.hidden = typeof navigator !== 'undefined' ? navigator.onLine : true;
}

async function triggerInstall() {
  if (deferredInstallPrompt) {
    await deferredInstallPrompt.prompt();
    const choice = await deferredInstallPrompt.userChoice;
    if (choice?.outcome === 'accepted') {
      isInstalled = true;
      deferredInstallPrompt = null;
      updateInstallButtons();
      showToast('AUTORA Workshop berhasil dipasang di perangkat Anda.');
    }
    return;
  }

  if (isIOS) {
    openModal(
      'Pasang di iPhone / iPad',
      `
      <p style="font-size:14px;color:var(--ink-secondary);line-height:1.6;">
        1. Ketuk tombol <strong>Bagikan (Share)</strong> pada bilah Safari.<br />
        2. Gulir ke bawah lalu pilih <strong>Tambahkan ke Layar Utama (Add to Home Screen)</strong>.<br />
        3. Ketuk <strong>Tambah</strong> untuk menggunakan AUTORA sebagai aplikasi.
      </p>
      <div class="modal-actions">
        <button type="button" class="btn accent" id="iosGuideCloseBtn">Mengerti</button>
      </div>`
    );
    document.getElementById('iosGuideCloseBtn')?.addEventListener('click', closeModal);
  }
}

export function initPwa() {
  if (typeof window === 'undefined') return;

  isInstalled =
    window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true;

  const ua = window.navigator.userAgent.toLowerCase();
  isIOS = /iphone|ipad|ipod/.test(ua);

  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferredInstallPrompt = event;
    updateInstallButtons();
  });

  window.addEventListener('appinstalled', () => {
    isInstalled = true;
    deferredInstallPrompt = null;
    updateInstallButtons();
    showToast('AUTORA Workshop terpasang.');
  });

  window.addEventListener('online', updateOfflineIndicator);
  window.addEventListener('offline', updateOfflineIndicator);

  document.getElementById('pwaInstallBtn')?.addEventListener('click', triggerInstall);
  document.getElementById('mobileInstallBtn')?.addEventListener('click', triggerInstall);

  updateInstallButtons();
  updateOfflineIndicator();

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // Service worker registration skipped if blocked in restricted preview
    });
  }
}
