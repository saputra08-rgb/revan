import { today, uid } from './utils.js';

const DB_KEY = 'autora_workshop_db_v4';
const LEGACY_DB_KEY = 'autora_workshop_db_v3';
const SESSION_KEY = 'autora_active_session_v4';

let db = null;
let currentUser = null;

export function buildSeedData({ preserveStaffAccounts = [] } = {}) {
  const sampleUsers = [
    {
      id: 'u_demo_andi',
      username: 'andi',
      nama: 'Andi Pratama',
      role: 'user',
      pelangganId: 'p1',
      isDemoCustomer: true,
      salt: null,
      hash: null,
      aktif: true,
      createdAt: today(),
    },
    {
      id: 'u_demo_siti',
      username: 'siti',
      nama: 'Siti Rahma',
      role: 'user',
      pelangganId: 'p2',
      isDemoCustomer: true,
      salt: null,
      hash: null,
      aktif: true,
      createdAt: today(),
    },
  ];

  const users = [...preserveStaffAccounts];
  for (const su of sampleUsers) {
    if (!users.some((u) => u.username === su.username)) {
      users.push(su);
    }
  }

  return {
    schemaVersion: 4,
    users,
    pelanggan: [
      { id: 'p1', nama: 'Andi Pratama', telepon: '0812-0000-0101', alamat: 'Jl. Melati No. 12, Banda Aceh' },
      { id: 'p2', nama: 'Siti Rahma', telepon: '0812-0000-0102', alamat: 'Jl. Kenanga No. 5, Banda Aceh' },
      { id: 'p3', nama: 'Budi Santoso', telepon: '0812-0000-0103', alamat: 'Jl. Mawar No. 8, Banda Aceh' },
    ],
    kendaraan: [
      { id: 'k1', pelangganId: 'p1', plat: 'BL 1234 AB', merek: 'Honda', model: 'Vario 125', tahun: 2021 },
      { id: 'k2', pelangganId: 'p2', plat: 'BL 5678 CD', merek: 'Toyota', model: 'Avanza', tahun: 2019 },
      { id: 'k3', pelangganId: 'p3', plat: 'BL 9012 EF', merek: 'Yamaha', model: 'NMAX', tahun: 2022 },
    ],
    mekanik: [
      { id: 'm1', nama: 'Doni Saputra', telepon: '0813-0000-0201', keahlian: 'Mesin & Tune Up', aktif: true },
      { id: 'm2', nama: 'Rina Amelia', telepon: '0813-0000-0202', keahlian: 'Kelistrikan & ECU', aktif: true },
      { id: 'm3', nama: 'Agus Setiawan', telepon: '0813-0000-0203', keahlian: 'Rem & Kaki-kaki', aktif: true },
    ],
    servis: [
      {
        id: 's1',
        kendaraanId: 'k1',
        mekanikId: 'm1',
        tanggal: today(),
        keluhan: 'Mesin terasa kurang bertenaga saat akselerasi',
        diagnosa: 'Filter udara kotor & perlu pembersihan throttle body',
        jenis: 'Tune Up',
        biayaJasa: 75000,
        status: 'Dikerjakan',
        details: [{ id: 'd1', tipe: 'Sparepart', deskripsi: 'Filter udara OEM', jumlah: 1, harga: 45000 }],
        payments: [],
      },
      {
        id: 's2',
        kendaraanId: 'k2',
        mekanikId: 'm3',
        tanggal: today(),
        keluhan: 'Rem berbunyi decit saat diinjak',
        diagnosa: 'Kampas rem depan sudah tipis',
        jenis: 'Perbaikan Rem',
        biayaJasa: 120000,
        status: 'Selesai',
        details: [{ id: 'd2', tipe: 'Sparepart', deskripsi: 'Kampas rem depan', jumlah: 1, harga: 180000 }],
        payments: [{ id: 'pay2', tanggal: today(), jumlah: 300000, metode: 'Tunai' }],
      },
      {
        id: 's3',
        kendaraanId: 'k3',
        mekanikId: null,
        tanggal: today(),
        keluhan: 'Servis rutin 10.000 km & ganti oli',
        diagnosa: 'Menunggu pengecekan mekanik',
        jenis: 'Servis Berkala',
        biayaJasa: 50000,
        status: 'Menunggu',
        details: [],
        payments: [],
      },
    ],
  };
}

function normalizeDatabase(raw) {
  if (!raw || typeof raw !== 'object') return null;
  if (!Array.isArray(raw.users) || !Array.isArray(raw.pelanggan) || !Array.isArray(raw.kendaraan) || !Array.isArray(raw.mekanik) || !Array.isArray(raw.servis)) {
    return null;
  }
  return {
    schemaVersion: 4,
    users: raw.users,
    pelanggan: raw.pelanggan,
    kendaraan: raw.kendaraan,
    mekanik: raw.mekanik,
    servis: raw.servis.map((s) => ({
      ...s,
      details: Array.isArray(s.details) ? s.details : [],
      payments: Array.isArray(s.payments) ? s.payments : [],
    })),
  };
}

export function initStore() {
  try {
    const rawV4 = localStorage.getItem(DB_KEY);
    if (rawV4) {
      db = normalizeDatabase(JSON.parse(rawV4));
    } else {
      const rawV3 = localStorage.getItem(LEGACY_DB_KEY);
      if (rawV3) {
        db = normalizeDatabase(JSON.parse(rawV3));
        if (db) saveDb();
      }
    }
  } catch {
    db = null;
  }

  if (!db) {
    db = buildSeedData();
    saveDb();
  }
  return db;
}

export function getDb() {
  if (!db) initStore();
  return db;
}

export function replaceDb(nextDb) {
  const normalized = normalizeDatabase(nextDb);
  if (!normalized) throw new Error('Struktur data backup tidak valid.');
  db = normalized;
  saveDb();
  return db;
}

export function saveDb() {
  if (db) {
    localStorage.setItem(DB_KEY, JSON.stringify(db));
  }
}

export function hasAdminAccount() {
  return getDb().users.some((u) => u.role === 'admin' && u.aktif);
}

export function getDemoCustomers() {
  return getDb().users.filter((u) => u.role === 'user' && u.isDemoCustomer && u.aktif);
}

export function getCurrentUser() {
  return currentUser;
}

export function setCurrentUser(user) {
  currentUser = user || null;
  if (currentUser) {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify({ id: currentUser.id }));
  } else {
    sessionStorage.removeItem(SESSION_KEY);
  }
}

export function restoreSessionUser() {
  try {
    const sess = JSON.parse(sessionStorage.getItem(SESSION_KEY) || 'null');
    if (sess && sess.id) {
      const found = getDb().users.find((u) => u.id === sess.id && u.aktif);
      if (found) {
        currentUser = found;
        return found;
      }
    }
  } catch {
    // Ignore malformed session state
  }
  return null;
}

export function findCustomerName(pelangganId) {
  return getDb().pelanggan.find((p) => p.id === pelangganId)?.nama || '—';
}

export function findVehicle(kendaraanId) {
  return getDb().kendaraan.find((k) => k.id === kendaraanId) || null;
}

export function findMechanicName(mekanikId) {
  return getDb().mekanik.find((m) => m.id === mekanikId)?.nama || 'Belum ditugaskan';
}

export function ensureCustomerProfileForUser(user) {
  const state = getDb();
  if (user.pelangganId && state.pelanggan.some((p) => p.id === user.pelangganId)) {
    return user.pelangganId;
  }
  const pid = uid('p');
  state.pelanggan.push({ id: pid, nama: user.nama, telepon: '-', alamat: '-' });
  user.pelangganId = pid;
  saveDb();
  return pid;
}
