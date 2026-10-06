/**
 * Lapisan komunikasi ke backend (Google Apps Script REST API).
 * Semua aksi dikirim lewat POST JSON. Header WAJIB text/plain agar browser tidak melakukan
 * preflight CORS (yang ditolak oleh Apps Script). Token sesi dikirim di body, bukan di URL.
 */
async function api(aksi, ...args) {
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
