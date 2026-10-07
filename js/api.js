/**
 * Lapisan komunikasi ke backend (Google Apps Script REST API).
 * Semua aksi dikirim lewat POST JSON. Header WAJIB text/plain agar browser tidak melakukan
 * preflight CORS (yang ditolak oleh Apps Script). Token sesi dikirim di body, bukan di URL.
 */
async function apiInti(aksi, ...args) {
  if (!CONFIG.GAS_URL || CONFIG.GAS_URL.indexOf('script.google.com') < 0) {
    const m = 'URL backend belum diisi. Edit js/config.js dan isi GAS_URL dengan URL /exec dari Apps Script.';
    toast(m, 1); throw new Error(m);
  }
  let res;
  try {
    res = await fetch(CONFIG.GAS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action: aksi, token: S.token || '', args })
    });
  } catch (e) { const m = 'Tidak bisa terhubung ke server. Periksa internet atau URL backend.'; toast(m, 1); throw new Error(m); }
  let r;
  try { r = await res.json(); }
  catch (e) { const m = 'Respons server tidak valid. Pastikan Apps Script sudah di-deploy: Execute as "Me", akses "Anyone".'; toast(m, 1); throw new Error(m); }
  if (r && r.success === false) {
    if (r.message === 'SESI_HABIS') keluar(true); else toast(r.message, 1);
    throw r;
  }
  return r && r.data;
}

// Pembungkus: mencatat waktu respons (tampil kecil di footer) untuk memudahkan pemantauan kecepatan
async function api(aksi, ...args) {
  const t0 = performance.now();
  try { return await apiInti(aksi, ...args); }
  finally { const el = document.getElementById('ms'); if (el) el.textContent = '· respons ' + Math.round(performance.now() - t0) + ' ms (' + aksi + ')'; }
}
// Kirim-dan-lupa: tidak menunggu server, tidak terikat halaman (dipakai saat Keluar)
function kirimLatar(aksi, args) {
  try {
    const b = JSON.stringify({ action: aksi, token: S.token || '', args: args || [] });
    if (!(navigator.sendBeacon && navigator.sendBeacon(CONFIG.GAS_URL, b)))
      fetch(CONFIG.GAS_URL, { method: 'POST', mode: 'no-cors', keepalive: true, headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: b });
  } catch (e) {}
}
