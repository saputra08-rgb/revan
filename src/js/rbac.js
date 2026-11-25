export const ROLE_CONFIG = {
  admin: {
    label: 'Admin',
    icon: 'shield',
    eyebrow: 'Panel Administrator',
    defaultView: 'dashboard',
    menus: [
      { id: 'dashboard', icon: 'dashboard', label: 'Dashboard' },
      { id: 'servis', icon: 'wrench', label: 'Antrean Servis' },
      { id: 'pelanggan', icon: 'users', label: 'Pelanggan' },
      { id: 'kendaraan', icon: 'car', label: 'Kendaraan' },
      { id: 'mekanik', icon: 'mechanic', label: 'Mekanik' },
      { id: 'laporan', icon: 'chart', label: 'Laporan' },
      { id: 'pengguna', icon: 'shield', label: 'Manajemen User' },
    ],
    notice: 'Mode Administrator: Anda memiliki kendali penuh atas analitik bengkel, operasional servis, armada, mekanik, laporan keuangan, dan manajemen akun.',
    sideTitle: 'Hak Akses Admin',
    sideItems: [
      'Akses penuh seluruh modul',
      'Hapus data & reset sistem',
      'Laporan keuangan & backup JSON',
      'Kelola akun Admin, Operator & User',
    ],
  },
  operator: {
    label: 'Operator',
    icon: 'wrench',
    eyebrow: 'Front-Desk Operator',
    defaultView: 'servis',
    menus: [
      { id: 'servis', icon: 'wrench', label: 'Antrean Servis' },
      { id: 'pelanggan', icon: 'users', label: 'Pelanggan' },
    ],
    notice: 'Mode Operator: Anda memiliki akses untuk mengelola antrean servis, penugasan mekanik, rincian biaya, pembayaran, dan data pelanggan.',
    sideTitle: 'Hak Akses Operator',
    sideItems: [
      'Kelola antrean servis masuk',
      'Perbarui progres & mekanik',
      'Input sparepart & pembayaran',
      'Kelola data pelanggan',
    ],
  },
  user: {
    label: 'Pelanggan',
    icon: 'car',
    eyebrow: 'Portal Pelanggan',
    defaultView: 'portal',
    menus: [
      { id: 'portal', icon: 'calendar', label: 'Booking & Pantau' },
      { id: 'tagihan', icon: 'card', label: 'Tagihan Saya' },
    ],
    notice: 'Portal Pelanggan: Anda dapat mendaftarkan kendaraan, membuat jadwal booking servis, memantau progres pengerjaan, dan mencetak nota tagihan.',
    sideTitle: 'Fitur Pelanggan',
    sideItems: [
      'Kelola daftar kendaraan pribadi',
      'Booking jadwal servis daring',
      'Pantau progres pengerjaan',
      'Cek tagihan & cetak nota',
    ],
  },
};

export const VIEW_TITLES = {
  dashboard: 'Dashboard Administrator',
  portal: 'Booking & Pantau Servis',
  tagihan: 'Tagihan & Nota Servis',
  pelanggan: 'Data Pelanggan',
  kendaraan: 'Data Kendaraan',
  mekanik: 'Tim Mekanik',
  servis: 'Antrean & Manajemen Servis',
  laporan: 'Laporan Keuangan & Backup',
  pengguna: 'Manajemen Akun & RBAC',
};

export function canAccessView(user, viewId) {
  if (!user) return false;
  const cfg = ROLE_CONFIG[user.role];
  return Boolean(cfg && cfg.menus.some((m) => m.id === viewId));
}

export function isAdmin(user) {
  return Boolean(user && user.role === 'admin');
}

export function isStaff(user) {
  return Boolean(user && (user.role === 'admin' || user.role === 'operator'));
}
