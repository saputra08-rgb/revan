export function today() {
  return new Date().toISOString().slice(0, 10);
}

export function uid(prefix = '') {
  const rand = typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID().slice(0, 10).replace(/-/g, '')
    : Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);
  return prefix ? `${prefix}_${rand}` : rand;
}

export function rupiah(amount) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(Number(amount) || 0);
}

export function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[ch]));
}

export function normalizePlate(raw) {
  return String(raw || '').trim().toUpperCase().replace(/\s+/g, ' ');
}

export function debounce(fn, delayMs = 150) {
  let timer = null;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delayMs);
  };
}

export function downloadFile(filename, content, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function serviceTotal(service) {
  const base = Number(service.biayaJasa) || 0;
  const extras = (service.details || []).reduce(
    (sum, item) => sum + (Number(item.jumlah) || 0) * (Number(item.harga) || 0),
    0
  );
  return base + extras;
}

export function servicePaid(service) {
  return (service.payments || []).reduce((sum, p) => sum + (Number(p.jumlah) || 0), 0);
}

export function servicePayStatus(service) {
  if (service.status === 'Dibatalkan') return 'Dibatalkan';
  const paidAmount = servicePaid(service);
  const totalAmount = serviceTotal(service);
  if (paidAmount <= 0) return 'Belum lunas';
  if (paidAmount >= totalAmount) return 'Lunas';
  return 'Sebagian';
}
