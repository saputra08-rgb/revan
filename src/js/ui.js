import { ICONS } from './icons.js';
import { esc, servicePayStatus } from './utils.js';

let toastTimer = null;
let lastFocusedElement = null;

export function showToast(message) {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = message;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2800);
}

export function openModal(title, htmlContent) {
  const backdrop = document.getElementById('modalBackdrop');
  const titleEl = document.getElementById('modalTitle');
  const bodyEl = document.getElementById('modalBody');
  if (!backdrop || !titleEl || !bodyEl) return;

  lastFocusedElement = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  titleEl.textContent = title;
  bodyEl.innerHTML = htmlContent;
  backdrop.hidden = false;

  const firstInput = bodyEl.querySelector('input, select, textarea, button');
  if (firstInput instanceof HTMLElement) {
    requestAnimationFrame(() => firstInput.focus());
  }
}

export function closeModal() {
  const backdrop = document.getElementById('modalBackdrop');
  const bodyEl = document.getElementById('modalBody');
  if (!backdrop || backdrop.hidden) return;
  backdrop.hidden = true;
  if (bodyEl) bodyEl.innerHTML = '';
  if (lastFocusedElement && document.contains(lastFocusedElement)) {
    lastFocusedElement.focus();
  }
  lastFocusedElement = null;
}

export function confirmDialog({ title, message, confirmLabel = 'Ya, Lanjutkan', danger = true }) {
  return new Promise((resolve) => {
    openModal(title, `
      <p style="font-size:14px;color:var(--ink-secondary);line-height:1.55;">${esc(message)}</p>
      <div class="modal-actions">
        <button type="button" class="btn secondary" id="confirmCancelBtn">Batal</button>
        <button type="button" class="btn ${danger ? 'danger' : 'accent'}" id="confirmAcceptBtn">${esc(confirmLabel)}</button>
      </div>
    `);

    const cancelBtn = document.getElementById('confirmCancelBtn');
    const acceptBtn = document.getElementById('confirmAcceptBtn');

    cancelBtn?.addEventListener('click', () => {
      closeModal();
      resolve(false);
    });

    acceptBtn?.addEventListener('click', () => {
      closeModal();
      resolve(true);
    });
  });
}

export function initModalListeners() {
  const backdrop = document.getElementById('modalBackdrop');
  const closeBtn = document.getElementById('modalCloseBtn');

  closeBtn?.addEventListener('click', closeModal);
  backdrop?.addEventListener('click', (event) => {
    if (event.target === backdrop) closeModal();
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && backdrop && !backdrop.hidden) {
      closeModal();
    }
  });
}

export function renderTable(headers, rows, emptyMessage = 'Belum ada data untuk ditampilkan.') {
  if (!rows.length) {
    return `<div class="empty">${esc(emptyMessage)}</div>`;
  }
  const headHtml = headers
    .map((h) => {
      const isNum = typeof h === 'object' && h.numeric;
      const label = typeof h === 'object' ? h.label : h;
      return `<th class="${isNum ? 'num-col' : ''}">${esc(label)}</th>`;
    })
    .join('');

  return `<table><thead><tr>${headHtml}</tr></thead><tbody>${rows.join('')}</tbody></table>`;
}

export function statusTag(status) {
  const map = {
    Selesai: { cls: 'done', icon: ICONS.check },
    Dikerjakan: { cls: 'work', icon: ICONS.wrench },
    Dibatalkan: { cls: 'cancel', icon: ICONS.cancel },
    Menunggu: { cls: 'wait', icon: ICONS.clock },
  };
  const meta = map[status] || { cls: 'wait', icon: ICONS.clock };
  return `<span class="status-tag ${meta.cls}">${meta.icon}<span>${esc(status)}</span></span>`;
}

export function paymentTag(service) {
  const state = servicePayStatus(service);
  const map = {
    Lunas: { cls: 'paid', icon: ICONS.check },
    Dibatalkan: { cls: 'cancel', icon: ICONS.cancel },
    Sebagian: { cls: 'work', icon: ICONS.clock },
    'Belum lunas': { cls: 'wait', icon: ICONS.clock },
  };
  const meta = map[state] || { cls: 'wait', icon: ICONS.clock };
  return `<span class="status-tag ${meta.cls}">${meta.icon}<span>${esc(state)}</span></span>`;
}

export function roleLabel(role) {
  const labels = {
    admin: 'Admin',
    operator: 'Operator',
    user: 'Pelanggan',
  };
  return `<span class="role-label ${esc(role)}">${esc(labels[role] || role)}</span>`;
}
