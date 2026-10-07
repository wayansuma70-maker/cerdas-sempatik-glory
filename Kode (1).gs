/** CERDAS — Backend (Kode.gs) v1.0 · SPA: doGet hanya mengembalikan shell */
const BUILD = 'v2.2-cepat';
// Isi dengan alamat GitHub Pages Anda setelah aktif (dipakai pada link di email notifikasi guru)
const URL_APLIKASI = 'https://GANTI-USERNAME.github.io/GANTI-NAMA-REPO/';
const SEKOLAH = 'SMP NEGERI 3 KEDIRI';
const nm = s => String(s == null ? '' : s).replace(/\s+/g, ' ').trim().toLowerCase();
const APP_NAME = 'CERDAS', SS_NAME = 'DB_CERDAS', MAXLEN = 2000;
const SKEMA = {
  Murid: ['ID', 'NIS', 'Nama_Murid', 'Kelas', 'Email_Akun', 'ID_Guru_Wali', 'Status', 'Kode_Hash', 'Salt'],
  Guru: ['ID', 'Nama_Guru', 'Email_Akun', 'Kelas_Binaan', 'Status', 'Kode_Hash', 'Salt'],
  Admin: ['Email', 'Kode_Hash', 'Salt'],
  Pengaturan: ['Key', 'Value'],
  Cerita: ['ID', 'ID_Murid', 'Periode', 'Judul', 'Facts', 'Feelings', 'Findings', 'Future',
    'Tanggal_Tulis', 'Status', 'Komentar_Guru', 'Nilai', 'Notif', 'Bintang'],
  Log_Email: ['Waktu', 'Penerima', 'Jumlah', 'Status'],
  Foto: ['ID', 'Data']
};

// ── REST API: semua aksi lewat POST JSON {action, token, args:[...]} ──
// Frontend WAJIB kirim Content-Type "text/plain" agar browser tidak melakukan preflight CORS.
function responJson(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
function doGet() { return responJson({ success: true, data: { app: APP_NAME, sekolah: SEKOLAH, build: BUILD, status: 'online' } }); }
function doPost(e) {
  try {
    const p = JSON.parse((e.postData && e.postData.contents) || '{}'), args = Array.isArray(p.args) ? p.args : [];
    if (p.action !== 'logout') skemaOk();
    const rute = { getCerita, muatAwal, login, logout, getInit, simpanCerita, getDataGuru, nilaiCerita, getDataAdmin, aturPeriode, importData, buatPdf, hapusData, getDaftar, resetKode, simpanFoto };
    if (!Object.prototype.hasOwnProperty.call(rute, p.action)) return responJson({ success: false, message: 'Aksi tidak dikenal: ' + p.action });
    return responJson(p.action === 'login' ? rute.login(...args) : rute[p.action](p.token, ...args));
  } catch (err) { return responJson({ success: false, message: err.message }); }
}
const ok = d => ({ success: true, data: d }), gagal = m => ({ success: false, message: m });
function aman(fn) { try { return ok(fn()); } catch (e) { return gagal(e.message); } }


/** Memastikan SEMUA sheet & kolom sesuai SKEMA (menambah kolom yang hilang, mis. Kode_Hash/Salt dari instalasi lama). */
function pastikanSkema(ss) {
  Object.keys(SKEMA).forEach(n => {
    const s = ss.getSheetByName(n) || ss.insertSheet(n);
    let cur = s.getLastColumn() ? s.getRange(1, 1, 1, s.getLastColumn()).getValues()[0].map(String) : [];
    // buang kolom tanpa judul (sisa data rusak), dari kanan ke kiri
    for (let i = cur.length - 1; i >= 0; i--) if (!cur[i].trim() && s.getMaxColumns() > 1) { s.deleteColumn(i + 1); cur.splice(i, 1); }
    SKEMA[n].forEach(col => {
      if (cur.indexOf(col) >= 0) return;
      cur.push(col);
      if (s.getMaxColumns() < cur.length) s.insertColumnsAfter(s.getMaxColumns(), cur.length - s.getMaxColumns());
      s.getRange(1, cur.length).setValue(col).setFontWeight('bold').setBackground('#006194').setFontColor('#fff');
    });
  });
}

// ── Setup otomatis (jalankan sekali, aman diulang) ──
function setupAppEnvironment() {
  const sp = PropertiesService.getScriptProperties();
  let ss = sp.getProperty('ssId') ? SpreadsheetApp.openById(sp.getProperty('ssId')) : SpreadsheetApp.create(SS_NAME);
  sp.setProperty('ssId', ss.getId());
  Object.keys(SKEMA).forEach(n => {
    if (ss.getSheetByName(n)) return;
    const s = ss.insertSheet(n), h = SKEMA[n];
    if (n !== 'Cerita' && n !== 'Log_Email') s.getRange(1, 1, s.getMaxRows(), h.length).setNumberFormat('@'); else if (n === 'Cerita') s.getRange(1, 3, s.getMaxRows(), 1).setNumberFormat('@');
    s.getRange(1, 1, 1, h.length).setValues([h]).setFontWeight('bold').setBackground('#006194').setFontColor('#fff');
  });
  pastikanSkema(ss);
  const a = ss.getSheetByName('Admin');
  if (a.getLastRow() < 2) { const o = {}, kd = setKode(o); a.appendRow(['admin', o.Kode_Hash, o.Salt]); Logger.log('ADMIN → Username: admin | Kode Akses: ' + kd + '  (catat, hanya tampil sekali)'); }
  const p = ss.getSheetByName('Pengaturan');
  if (p.getLastRow() < 2) p.getRange(2, 1, 2, 2).setValues([['periode', Utilities.formatDate(new Date(), 'Asia/Makassar', 'yyyy-MM')], ['sekolah', SEKOLAH]]);
  const d = ss.getSheetByName('Sheet1'); if (d && ss.getSheets().length > 1) ss.deleteSheet(d);
  ScriptApp.getProjectTriggers().filter(t => t.getHandlerFunction() === 'kirimDigest').forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('kirimDigest').timeBased().everyDays(1).atHour(15).create();
  Logger.log('Spreadsheet: ' + ss.getUrl());
}

// ── Util data (baca sekali, proses di memori) ──
let _ss = null, _tb = {};
function db() { return _ss || (_ss = SpreadsheetApp.openById(PropertiesService.getScriptProperties().getProperty('ssId'))); }
function tabel(n) { return _tb[n] || (_tb[n] = tabelBaca(n)); }
function tabelBaca(n) {
  const s = db().getSheetByName(n), v = s.getDataRange().getValues(), h = v.shift();
  return { s, h, r: v.map((x, i) => { const o = { _i: i + 2 }; h.forEach((k, j) => o[k] = x[j] instanceof Date ? Utilities.formatDate(x[j], 'Asia/Makassar', 'dd/MM/yyyy HH:mm') : x[j]); return o; }) };
}
function cfg(k) { const all = dariCache('cfg', 3600, () => { const o = {}; tabel('Pengaturan').r.forEach(r => o[r.Key] = String(r.Value)); return o; }); return all[k] || ''; }
// ── Cache lintas-request (CacheService) + versi: setiap tulis menaikkan versi → semua cache lama otomatis tidak terpakai ──
function ver() { const c = CacheService.getScriptCache(); let v = c.get('ver'); if (!v) { v = String(Date.now()); c.put('ver', v, 21600); } return v; }
function naikVer() { CacheService.getScriptCache().put('ver', String(Date.now()), 21600); }
function dariCache(kunci, ttl, fn) {
  const c = CacheService.getScriptCache(), kk = kunci + ':' + ver(), h = c.get(kk);
  if (h) return JSON.parse(h);
  const d = fn(); try { const s = JSON.stringify(d); if (s.length < 90000) c.put(kk, s, ttl); } catch (e) {}
  return d;
}
function tulisBaris(t, obj) { naikVer(); if (/^(Murid|Guru|Admin)$/.test(t.s.getName())) naikCver(); t.s.getRange(obj._i, 1, 1, t.h.length).setValues([t.h.map(k => obj[k] === undefined ? '' : obj[k])]); }

// ── Login kode akses & sesi (token disimpan di CacheService, 6 jam) ──
function cver() { const c = CacheService.getScriptCache(); let v = c.get('cver'); if (!v) { v = String(Date.now()); c.put('cver', v, 21600); } return v; }
function naikCver() { CacheService.getScriptCache().put('cver', String(Date.now()), 21600); }
// Cari baris lewat TextFinder: hanya baris yang cocok yang dibaca (bukan seluruh sheet)
function barisDengan(nama, kolom, nilai) {
  const s = db().getSheetByName(nama); if (!s || s.getLastRow() < 2) return [];
  const w = s.getLastColumn(), hdr = s.getRange(1, 1, 1, w).getValues()[0].map(String), col = hdr.indexOf(kolom) + 1; if (!col) return [];
  return s.getRange(2, col, s.getLastRow() - 1, 1).createTextFinder(String(nilai)).matchEntireCell(true).matchCase(true).findAll().map(f => {
    const v = s.getRange(f.getRow(), 1, 1, w).getValues()[0], o = {}; hdr.forEach((q, j) => o[q] = v[j] instanceof Date ? Utilities.formatDate(v[j], 'Asia/Makassar', 'dd/MM/yyyy HH:mm') : v[j]); return o;
  });
}
function kredensial(peran, user) {   // data login 1 pengguna; di-cache 1 jam, otomatis batal bila data murid/guru/admin berubah
  const c = CacheService.getScriptCache(), key = 'cr:' + peran + ':' + String(user).trim().toLowerCase() + ':' + cver(), h = c.get(key);
  if (h) return JSON.parse(h);
  const n = { murid: ['Murid', 'NIS'], guru: ['Guru', 'Email_Akun'], admin: ['Admin', 'Email'] }[peran]; if (!n) return null;
  const s = db().getSheetByName(n[0]); if (!s || s.getLastRow() < 2) return null;
  const w = s.getLastColumn(), hdr = s.getRange(1, 1, 1, w).getValues()[0].map(String), col = hdr.indexOf(n[1]) + 1; if (!col) return null;
  const f = s.getRange(2, col, s.getLastRow() - 1, 1).createTextFinder(String(user).trim()).matchEntireCell(true).matchCase(false).findNext(); if (!f) return null;
  const v = s.getRange(f.getRow(), 1, 1, w).getValues()[0], o = {}; hdr.forEach((q, j) => o[q] = v[j]);
  const r = { ID: o.ID || (peran === 'admin' ? 'admin' : ''), nama: o.Nama_Murid || o.Nama_Guru || 'Admin', kelas: o.Kelas || '', status: o.Status || '', hash: o.Kode_Hash, salt: o.Salt };
  c.put(key, JSON.stringify(r), 3600); return r;
}
function hash(k, s) { return Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, s + ':' + k)); }
function setKode(o) { const k = String(Math.floor(100000 + Math.random() * 900000)); o.Salt = 's' + Utilities.getUuid().slice(0, 7); o.Kode_Hash = hash(k, o.Salt); return k; }
function login(peran, user, kode) {
  return aman(() => {
    const c = CacheService.getScriptCache(), key = 'gagal_' + peran + String(user).toLowerCase();
    if (Number(c.get(key) || 0) >= 5) throw new Error('Terlalu banyak percobaan salah. Coba lagi 10 menit lagi.');
    if (['murid', 'guru', 'admin'].indexOf(peran) < 0) throw new Error('Peran tidak valid.');
    const r = kredensial(peran, user);
    if (!r || r.status === 'Nonaktif' || !r.hash || hash(String(kode).trim(), r.salt) !== r.hash) { c.put(key, String(Number(c.get(key) || 0) + 1), 600); throw new Error('NIS/email atau kode akses salah.'); }
    c.remove(key); const t = Utilities.getUuid();
    c.put('s_' + t, JSON.stringify({ role: peran, id: r.ID, nama: r.nama, kelas: r.kelas }), 21600);
    const aw = muatAwal(t); return { token: t, awal: aw.success ? aw.data : null };
  });
}
function logout(token) { CacheService.getScriptCache().remove('s_' + token); return ok(true); }
function siapa(token) {
  const s = token && CacheService.getScriptCache().get('s_' + token);
  if (!s) throw new Error('SESI_HABIS'); return JSON.parse(s);
}
function boleh(u, c) {
  if (u.role === 'admin') return true;
  const m = barisDengan('Murid', 'ID', c.ID_Murid)[0];
  return u.role === 'murid' ? c.ID_Murid === u.id : !!m && m.ID_Guru_Wali === u.id;
}
function resetKode(token, jenis, user) {
  return aman(() => {
    if (siapa(token).role !== 'admin') throw new Error('Akses ditolak.');
    const n = { Murid: 'NIS', Guru: 'Email_Akun' }[jenis]; if (!n) throw new Error('Jenis tidak valid.');
    const t = tabel(jenis), r = t.r.find(x => String(x[n]).trim().toLowerCase() === String(user).trim().toLowerCase());
    if (!r) throw new Error('Pengguna tidak ditemukan.');
    const kd = setKode(r); tulisBaris(t, r); return { user, kode: kd };
  });
}

// ── API ──
function skemaOk() { const c = CacheService.getScriptCache(); if (c.get('skema_' + BUILD)) return; pastikanSkema(db()); c.put('skema_' + BUILD, '1', 21600); }
function muatAwal(token) {
  return aman(() => {
    const g = x => { if (!x.success) throw new Error(x.message); return x.data; };
    const u = siapa(token), r = { init: g(getInit(token)) };
    if (u.role === 'guru') r.guru = g(getDataGuru(token));
    if (u.role === 'admin') r.admin = g(getDataAdmin(token));
    return r;
  });
}
function getInit(token) {
  return aman(() => {
    skemaOk(); const u = siapa(token);
    return dariCache('in:' + u.role + ':' + u.id, 600, () => {
      const o = { user: Object.assign({}, u, { foto: ambilFoto(u) }), periode: cfg('periode'), sekolah: SEKOLAH, build: BUILD };
      if (u.role === 'murid') o.cerita = barisDengan('Cerita', 'ID_Murid', u.id).sort((a, b) => b.Periode > a.Periode ? 1 : -1);
      return o;
    });
  });
}
function simpanCerita(token, c, kirim) {
  return aman(() => {
    const u = siapa(token); if (u.role !== 'murid') throw new Error('Hanya murid yang dapat menulis cerita.');
    const L = LockService.getScriptLock(); L.waitLock(15000);
    try {
      const periode = cfg('periode'), t = tabel('Cerita');
      ['Judul', 'Facts', 'Feelings', 'Findings', 'Future'].forEach(k => {
        c[k] = String(c[k] || '').trim();
        if (c[k].length > MAXLEN) throw new Error(k + ' maksimal ' + MAXLEN + ' karakter.');
        if (kirim && !c[k]) throw new Error('Lengkapi semua bagian 4F dan judul sebelum mengirim.');
      });
      let r = t.r.find(x => x.ID_Murid === u.id && x.Periode === periode);
      if (r && r.Status !== 'Draft') throw new Error('Ceritamu bulan ini sudah terkirim (hanya 1x per bulan).');
      r = Object.assign(r || { _i: t.s.getLastRow() + 1, ID: Utilities.getUuid(), ID_Murid: u.id, Periode: periode, Notif: '' }, c,
        { Tanggal_Tulis: new Date(), Status: kirim ? 'Terkirim' : 'Draft' });
      tulisBaris(t, r); return { status: r.Status };
    } finally { L.releaseLock(); }
  });
}
function metaCerita(c) { return c ? { ID: c.ID, Judul: c.Judul, Status: c.Status, Bintang: c.Bintang, Nilai: c.Nilai, Tanggal_Tulis: c.Tanggal_Tulis } : null; }
function getCerita(token, id) {   // isi lengkap 1 cerita (dipanggil saat guru membuka cerita)
  return aman(() => {
    const u = siapa(token); if (u.role === 'murid') throw new Error('Akses ditolak.');
    const c = barisDengan('Cerita', 'ID', id)[0]; if (!c || !boleh(u, c)) throw new Error('Cerita tidak ditemukan / bukan murid binaan Anda.');
    delete c.Notif; return c;
  });
}
function getDataGuru(token) {
  return aman(() => {
    const u = siapa(token); if (u.role === 'murid') throw new Error('Akses ditolak.');
    return dariCache('gr:' + u.role + ':' + u.id, 600, () => {
      const periode = cfg('periode'), cs = new Map(); tabel('Cerita').r.forEach(c => { if (c.Periode === periode) cs.set(c.ID_Murid, c); });
      return { periode, murid: tabel('Murid').r.filter(m => u.role === 'admin' || m.ID_Guru_Wali === u.id)
        .map(m => ({ ID: m.ID, Nama_Murid: m.Nama_Murid, Kelas: m.Kelas, cerita: metaCerita(cs.get(m.ID)) })) };
    });
  });
}
function nilaiCerita(token, id, bintang, komentar, nilai) {
  return aman(() => {
    const u = siapa(token); if (u.role === 'murid') throw new Error('Akses ditolak.');
    bintang = Number(bintang); if (!Number.isInteger(bintang) || bintang < 1 || bintang > 5) throw new Error('Pilih bintang 1 sampai 5.');
    if (nilai === '' || nilai == null) nilai = ''; else { nilai = Number(nilai); if (!(nilai >= 0 && nilai <= 100)) throw new Error('Nilai angka harus 0–100.'); }
    const t = tabel('Cerita'), c = t.r.find(x => x.ID === id);
    if (!c || !boleh(u, c)) throw new Error('Cerita tidak ditemukan / bukan murid binaan Anda.');
    if (c.Status === 'Draft') throw new Error('Cerita masih draf, belum dikirim murid.');
    tulisBaris(t, Object.assign(c, { Bintang: bintang, Nilai: nilai, Komentar_Guru: String(komentar || '').slice(0, 1000), Status: 'Sudah Dinilai' }));
    return true;
  });
}
function getDataAdmin(token) {
  return aman(() => {
    const u = siapa(token); if (u.role !== 'admin') throw new Error('Akses ditolak.');
    return dariCache('adm', 600, () => {
      const periode = cfg('periode'), ms = tabel('Murid').r, cs = tabel('Cerita').r.filter(c => c.Periode === periode && c.Status !== 'Draft');
      const sudah = new Set(cs.map(c => c.ID_Murid)), kelas = {};
      ms.forEach(m => { const q = kelas[m.Kelas] = kelas[m.Kelas] || { total: 0, sudah: 0 }; q.total++; if (sudah.has(m.ID)) q.sudah++; });
      return { periode, murid: ms.length, guru: tabel('Guru').r.length, cerita: cs.length, kelas };
    });
  });
}
function aturPeriode(token, p) { return aman(() => { if (siapa(token).role !== 'admin') throw new Error('Akses ditolak.'); const t = tabel('Pengaturan'), r = t.r.find(x => x.Key === 'periode'); r.Value = p; tulisBaris(t, r); return true; }); }

function idDari(s) { return Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, s).map(b => ('0' + (b & 0xff).toString(16)).slice(-2)).join('').slice(0, 10); }
// Impor Excel (di-parse di browser). Murid dikunci NIS, guru dikunci email. Kode akses dibuat otomatis untuk data BARU.
function importData(token, jenis, baris, ulang) {
  return aman(() => {
    if (siapa(token).role !== 'admin') throw new Error('Akses ditolak.');
    if (jenis !== 'Murid' && jenis !== 'Guru') throw new Error('Jenis data tidak valid.');
    const L = LockService.getScriptLock(); L.waitLock(20000);
    try {
      const t = tabel(jenis), kunci = jenis === 'Murid' ? 'NIS' : 'Email_Akun', gs = tabel('Guru').r, peta = {}, kode = [], tolak = [];
      let baru = 0, ubah = 0; t.r.forEach(r => peta[String(r[kunci]).trim().toLowerCase()] = r);
      baris.forEach((b, i) => {
        const v = String(b[kunci] || '').trim(), kk = v.toLowerCase(), bar = 'Baris ' + (i + 2) + ': ';
        if (!v) { tolak.push(bar + kunci + ' kosong'); return; }
        const kosong = (jenis === 'Murid' ? ['Nama_Murid', 'Kelas'] : ['Nama_Guru']).filter(x => !String(b[x] || '').trim());
        if (kosong.length) { tolak.push(bar + 'kolom ' + kosong.join(', ') + ' kosong / judul kolom tidak sesuai template'); return; }
        if (jenis === 'Guru' && !/^\S+@\S+\.\S+$/.test(v)) { tolak.push(bar + 'email guru tidak valid'); return; }
        if (jenis === 'Murid') {
          const eg = String(b.Email_Guru_Wali || '').trim().toLowerCase();
          if (eg) { const g = gs.find(x => String(x.Email_Akun).toLowerCase() === eg); if (!g) { tolak.push(bar + 'guru wali ' + eg + ' belum terdaftar (impor data guru dulu)'); return; } b.ID_Guru_Wali = g.ID; }
        }
        ['Email_Guru_Wali', 'Kode_Hash', 'Salt', 'ID', 'Status'].forEach(x => delete b[x]); b[kunci] = v;
        let r = peta[kk];
        if (r) { Object.assign(r, b); ubah++; if (ulang) kode.push({ user: v, nama: b.Nama_Murid || b.Nama_Guru || r.Nama_Murid || r.Nama_Guru || '', kode: setKode(r) }); }
        else { r = Object.assign({ ID: jenis === 'Murid' ? 'M-' + v : 'G-' + idDari(kk), Status: 'Aktif' }, b); kode.push({ user: v, nama: b.Nama_Murid || b.Nama_Guru || '', kode: setKode(r) }); peta[kk] = r; baru++; }
      });
      const semua = Object.values(peta);
      if (t.s.getLastRow() > 1) t.s.getRange(2, 1, t.s.getLastRow() - 1, t.h.length).clearContent();
      if (semua.length) t.s.getRange(2, 1, semua.length, t.h.length).setValues(semua.map(r => t.h.map(h => r[h] === undefined ? '' : r[h])));
      naikVer(); naikCver(); return { baru, ubah, tolak, kode };
    } finally { L.releaseLock(); }
  });
}

// PDF cerita (base64) — hak akses diperiksa
function buatPdf(token, id) {
  return aman(() => {
    const u = siapa(token), c = tabel('Cerita').r.find(x => x.ID === id), m = c && tabel('Murid').r.find(x => x.ID === c.ID_Murid);
    if (!c || !boleh(u, c)) throw new Error('Cerita tidak ditemukan.');
    const e = s => String(s || '').replace(/[&<>]/g, x => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[x])).replace(/\n/g, '<br>');
    const bag = [['Facts (Peristiwa)', c.Facts], ['Feelings (Perasaan)', c.Feelings], ['Findings (Pelajaran)', c.Findings], ['Future (Aksi Nyata)', c.Future]]
      .map(x => '<h3 style="color:#006194">' + x[0] + '</h3><p>' + e(x[1]) + '</p>').join('');
    const html = '<div style="font-family:Arial;padding:24px"><h2>' + e(SEKOLAH) + ' — CERDAS</h2><p><b>' + e(m.Nama_Murid) + '</b> · Kelas ' + e(m.Kelas) +
      ' · Periode ' + c.Periode + '</p><h1>' + e(c.Judul) + '</h1>' + bag + (c.Bintang || c.Nilai !== '' ? '<hr><p><b>' + (c.Bintang ? 'Bintang: ' + '★'.repeat(c.Bintang) + '☆'.repeat(5 - c.Bintang) : '') + (c.Nilai !== '' ? '  Nilai: ' + c.Nilai : '') + '</b><br>Masukan guru: ' + e(c.Komentar_Guru) + '</p>' : '') + '</div>';
    return Utilities.base64Encode(Utilities.newBlob(html, 'text/html').getAs('application/pdf').getBytes());
  });
}

// Trigger harian: satu ringkasan email per guru (hemat kuota MailApp)
function kirimDigest() {
  const t = tabel('Cerita'), ms = tabel('Murid').r, gs = tabel('Guru').r, per = {};
  t.r.filter(c => c.Status === 'Terkirim' && !c.Notif).forEach(c => {
    const m = ms.find(x => x.ID === c.ID_Murid); if (!m) return;
    (per[m.ID_Guru_Wali] = per[m.ID_Guru_Wali] || []).push({ c, m });
  });
  const log = db().getSheetByName('Log_Email'), url = URL_APLIKASI;
  Object.keys(per).forEach(gid => {
    const g = gs.find(x => x.ID === gid); if (!g || MailApp.getRemainingDailyQuota() < 1) return;
    const daftar = per[gid].map(x => '• ' + x.m.Nama_Murid + ' (' + x.m.Kelas + '): ' + x.c.Judul).join('\n');
    try {
      MailApp.sendEmail(g.Email_Akun, 'CERDAS: ' + per[gid].length + ' cerita baru dari murid binaan', 'Halo ' + g.Nama_Guru + ',\n\n' + daftar + '\n\nBuka aplikasi: ' + url);
      tandaiNotif(t, per[gid].map(x => x.c._i));
      log.appendRow([new Date(), g.Email_Akun, per[gid].length, 'Terkirim']);
    } catch (e) { log.appendRow([new Date(), g.Email_Akun, per[gid].length, 'Gagal: ' + e.message]); }
  });
}

/** PEMULIHAN: jalankan dari editor bila login admin gagal / lupa kode. Memperbaiki format data & membuat kode admin baru. */
function resetAdmin() {
  const ss = db(), sekolah = SEKOLAH;
  pastikanSkema(ss); naikVer();
  ['Murid', 'Guru', 'Admin', 'Pengaturan'].forEach(n => { const s = ss.getSheetByName(n); s.getRange(1, 1, s.getMaxRows(), s.getLastColumn()).setNumberFormat('@'); });
  const c = ss.getSheetByName('Cerita'); c.getRange(1, 3, c.getMaxRows(), 1).setNumberFormat('@');
  ss.getSheetByName('Pengaturan').getRange(2, 1, 2, 2).setValues([['periode', Utilities.formatDate(new Date(), 'Asia/Makassar', 'yyyy-MM')], ['sekolah', sekolah]]);
  const a = ss.getSheetByName('Admin'); if (a.getLastRow() > 1) a.getRange(2, 1, a.getLastRow() - 1, 3).clearContent();
  const o = {}, kd = setKode(o); a.getRange(2, 1, 1, 3).setValues([['admin', o.Kode_Hash, o.Salt]]);
  CacheService.getScriptCache().remove('gagal_adminadmin'); naikCver();
  Logger.log('ADMIN BARU → Username: admin | Kode Akses: ' + kd);
}

/**
 * DIAGNOSA + SET KODE ADMIN. Ubah KODE di bawah (6 angka pilihan Anda), simpan, lalu Run fungsi ini.
 * Fungsi ini menulis ulang admin, lalu menguji fungsi login() yang sama dengan yang dipakai web app.
 */
function setAdminKode() {
  const KODE = '246810';   // ← GANTI dengan 6 angka pilihan Anda
  if (!/^\d{6}$/.test(KODE)) throw new Error('KODE harus tepat 6 angka.');
  const id = PropertiesService.getScriptProperties().getProperty('ssId');
  const ss = SpreadsheetApp.openById(id);
  Logger.log('1) Spreadsheet yang dipakai aplikasi: ' + ss.getUrl());
  try { if (DriveApp.getFileById(id).isTrashed()) Logger.log('⚠ PERHATIAN: spreadsheet ini ada di TONG SAMPAH. Hapus properti ssId lalu jalankan setupAppEnvironment.'); } catch (e) {}
  pastikanSkema(ss);
  const a = ss.getSheetByName('Admin'); a.getRange(1, 1, a.getMaxRows(), 3).setNumberFormat('@');
  if (a.getLastRow() > 1) a.getRange(2, 1, a.getLastRow() - 1, 3).clearContent();
  const o = {}; o.Salt = 's' + Utilities.getUuid().slice(0, 7); o.Kode_Hash = hash(KODE, o.Salt);
  a.getRange(2, 1, 1, 3).setValues([['admin', o.Kode_Hash, o.Salt]]);
  CacheService.getScriptCache().remove('gagal_adminadmin'); naikCver();
  const t = tabel('Admin'); const r = t.r[0];
  Logger.log('2) Kolom sheet Admin: ' + t.h.join(', ') + ' | Isi → Email=[' + r.Email + '] Salt=[' + r.Salt + '] panjangHash=' + String(r.Kode_Hash).length);
  const hasil = login('admin', 'admin', KODE);
  Logger.log(hasil.success ? '3) ✅ login() BERHASIL di editor. Username: admin | Kode: ' + KODE : '3) ❌ login() GAGAL di editor: ' + hasil.message);
}

// ── Kelola data: hapus (admin) ──
function hapusDi(nama, fn) {  // hapus baris yang memenuhi fn(obj); nilai mentah dipertahankan
  const s = db().getSheetByName(nama), n = s.getLastRow(); if (n < 2) return 0;
  const w = s.getLastColumn(), h = s.getRange(1, 1, 1, w).getValues()[0].map(String), v = s.getRange(2, 1, n - 1, w).getValues();
  const sisa = v.filter(row => { const o = {}; h.forEach((c, j) => o[c] = row[j]); return !fn(o); });
  s.getRange(2, 1, n - 1, w).clearContent();
  if (sisa.length) s.getRange(2, 1, sisa.length, w).setValues(sisa);
  return v.length - sisa.length;
}
function hapusData(token, jenis, mode, nilai, denganCerita) {
  return aman(() => {
    if (siapa(token).role !== 'admin') throw new Error('Akses ditolak.');
    if (jenis !== 'Murid' && jenis !== 'Guru') throw new Error('Jenis data tidak valid.');
    const L = LockService.getScriptLock(); L.waitLock(20000);
    try {
      const t = tabel(jenis), kunci = jenis === 'Murid' ? 'NIS' : 'Email_Akun', q = nm(nilai);
      let del;
      if (mode === 'semua') del = t.r;
      else if (mode === 'kelas' && jenis === 'Murid') del = t.r.filter(r => nm(r.Kelas) === q);
      else if (mode === 'satu') del = t.r.filter(r => nm(r[kunci]) === q);
      else throw new Error('Mode hapus tidak valid.');
      if (!del.length) throw new Error('Tidak ada data yang cocok dengan "' + nilai + '".');
      const ids = new Set(del.map(r => r.ID)), hasil = { terhapus: hapusDi(jenis, o => ids.has(o.ID)), cerita: 0 };
      if (jenis === 'Murid' && denganCerita) hasil.cerita = hapusDi('Cerita', o => ids.has(o.ID_Murid));
      if (jenis === 'Guru') {  // putuskan relasi murid → guru yang dihapus
        const sm = db().getSheetByName('Murid'), n = sm.getLastRow();
        if (n > 1) { const c = sm.getRange(1, 1, 1, sm.getLastColumn()).getValues()[0].indexOf('ID_Guru_Wali') + 1, rg = sm.getRange(2, c, n - 1, 1);
          rg.setValues(rg.getValues().map(x => [ids.has(x[0]) ? '' : x[0]])); }
      }
      naikVer(); naikCver(); return hasil;
    } finally { L.releaseLock(); }
  });
}
function getDaftar(token, jenis) {
  return aman(() => {
    if (siapa(token).role !== 'admin') throw new Error('Akses ditolak.');
    return dariCache('dft:' + jenis, 600, () => {
    const gs = tabel('Guru').r;
    if (jenis === 'Guru') return gs.map(g => [g.Email_Akun, g.Nama_Guru, g.Kelas_Binaan]);
    return tabel('Murid').r.map(m => [m.NIS, m.Nama_Murid, m.Kelas, (gs.find(g => g.ID === m.ID_Guru_Wali) || {}).Email_Akun || '(belum terhubung)']);
    });
  });
}

// ── Foto profil (semua peran). Disimpan di sheet "Foto" agar sheet Murid/Guru tetap ringan. ──
function barisFoto(u) {
  const s = db().getSheetByName('Foto'); if (!s || s.getLastRow() < 2) return 0;
  const f = s.getRange(1, 1, s.getLastRow(), 1).createTextFinder(u.role + ':' + u.id).matchEntireCell(true).findNext();
  return f ? f.getRow() : 0;
}
function ambilFoto(u) { const r = barisFoto(u); return r ? String(db().getSheetByName('Foto').getRange(r, 2).getValue()) : ''; }
function simpanFoto(token, data) {
  return aman(() => {
    const u = siapa(token); data = String(data || '');
    if (data && (data.length > 40000 || !/^data:image\/jpeg;base64,[A-Za-z0-9+\/=]+$/.test(data))) throw new Error('Foto tidak valid atau terlalu besar.');
    const L = LockService.getScriptLock(); L.waitLock(15000);
    try {
      if (!db().getSheetByName('Foto')) pastikanSkema(db());
      const s = db().getSheetByName('Foto'), r = barisFoto(u);
      if (r) s.getRange(r, 2).setNumberFormat('@').setValue(data);
      else if (data) s.getRange(s.getLastRow() + 1, 1, 1, 2).setNumberFormat('@').setValues([[u.role + ':' + u.id, data]]);
      naikVer(); return true;
    } finally { L.releaseLock(); }
  });
}

function tandaiNotif(t, idx) {  // 1 baca + 1 tulis untuk banyak baris
  const col = t.h.indexOf('Notif') + 1, rg = t.s.getRange(2, col, t.s.getLastRow() - 1, 1), v = rg.getValues();
  idx.forEach(i => v[i - 2][0] = 'Y'); rg.setValues(v);
}
