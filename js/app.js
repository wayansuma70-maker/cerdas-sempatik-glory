/** CERDAS — logika aplikasi (SPA). Backend: Google Apps Script REST API (lihat js/api.js). */
/** CERDAS — SPA klien. URL tidak pernah berubah; halaman disuntikkan ke #app-container. */
const S = { init: null, chart: null }, $ = s => document.querySelector(s);
const esc = t => String(t == null ? '' : t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const F4 = [
  ['Facts', 'Facts (Peristiwa)', 'Apa yang sebenarnya terjadi? Kapan & di mana? Siapa saja yang ada?', '--f1', '--f1t', 'bi-book',
    'Tulis apa adanya seperti reporter: <b>apa</b> yang terjadi, <b>kapan</b>, <b>di mana</b>, dan <b>siapa</b> saja yang terlibat. Belum perlu menulis pendapat atau perasaan.',
    'Pada hari ..., di ..., aku bersama ... sedang ...',
    'Hari Selasa, 6 Oktober 2026, saat pelajaran Prakarya di kelas VII B, aku, Dewi, dan Komang membuat poster kebersihan kelas. Awalnya kami berdebat soal pilihan warna, lalu Bu Guru menyarankan kami membagi tugas.'],
  ['Feelings', 'Feelings (Perasaan)', 'Bagaimana perasaanmu saat peristiwa itu terjadi?', '--f2', '--f2t', 'bi-heart',
    'Ceritakan perasaanmu <b>sebelum, saat, dan sesudah</b> kejadian, dan <b>mengapa</b> kamu merasa begitu (senang, kesal, malu, bangga, takut, dll).',
    'Awalnya aku merasa ... karena ..., tetapi setelah itu aku merasa ...',
    'Awalnya aku kesal dan merasa ideku tidak didengar. Setelah tugas dibagi, aku jadi tenang, lalu bangga saat poster kami dipajang di dinding kelas.'],
  ['Findings', 'Findings (Pelajaran)', 'Pelajaran berharga apa yang kamu dapatkan?', '--f3', '--f3t', 'bi-lightbulb',
    'Apa yang kamu <b>pelajari atau sadari</b> dari kejadian itu tentang dirimu, temanmu, atau cara bekerja sama? Jawab dengan kalimatmu sendiri.',
    'Aku belajar bahwa ... Aku jadi sadar bahwa ...',
    'Aku belajar bahwa perbedaan pendapat bisa selesai kalau kami mau mendengarkan dan membagi tugas. Hasil kerja bersama ternyata lebih bagus daripada kerja sendiri.'],
  ['Future', 'Future (Aksi Nyata)', 'Apa aksi nyata yang akan kamu lakukan di masa depan?', '--f4', '--f4t', 'bi-rocket-takeoff',
    'Tulis rencana <b>konkret</b>: apa yang akan kamu lakukan, <b>kapan</b> mulai, dan <b>bagaimana</b> caranya. Pilih hal kecil yang benar-benar bisa kamu lakukan.',
    'Mulai ..., aku akan ... dengan cara ...',
    'Mulai pekan depan, aku akan mendengarkan pendapat teman sampai selesai sebelum menyampaikan ideku. Setiap kerja kelompok, aku akan mengusulkan pembagian tugas di awal.']];
const MENU = { murid: [['beranda', 'Beranda'], ['tulis', 'Tulis Cerita (4F)'], ['saya', 'Cerita Saya'], ['profil', 'Foto Profil']],
  guru: [['guru', 'Ruang Guru Wali'], ['profil', 'Foto Profil']], admin: [['admin', 'Panel Admin'], ['guru', 'Cerita Murid'], ['impor', 'Impor Excel'], ['kelola', 'Kelola Data'], ['profil', 'Foto Profil']] };

// ── CACHE KLIEN: tampil INSTAN dari cache, segarkan diam-diam di latar. sessionStorage → hilang saat tab ditutup/logout (aman utk komputer bersama) ──
let K = {}; try { K = JSON.parse(sessionStorage.getItem('cerdas_k') || '{}'); } catch (e) {}
let _kt, HAL = '';
const kk = (a, args) => a + JSON.stringify(args);
function setK(a, args, data) { K[kk(a, args)] = { data, s: JSON.stringify(data), t: Date.now() }; clearTimeout(_kt); _kt = setTimeout(() => { try { sessionStorage.setItem('cerdas_k', JSON.stringify(K)); } catch (e) { K = {}; } }, 400); }
function batalCache() { K = {}; sessionStorage.removeItem('cerdas_k'); }
async function swr(aksi, args, render) {
  const key = kk(aksi, args), c = K[key], hal = HAL;
  if (c) { render(c.data); if (Date.now() - c.t < 15000 || S.menunggu) return; }   // cache segar / ada tulis tertunda → tak perlu ke server
  const p = api(aksi, ...args).then(d => { const sama = c && c.s === JSON.stringify(d); setK(aksi, args, d); if (!c || (!sama && HAL === hal)) render(d); });
  if (c) p.catch(() => {}); else await p;
}
// ── OPTIMISTIC UI: UI sudah berubah; ini hanya sinkron ke server di latar. Gagal → balik() mengembalikan keadaan ──
function bg(aksi, args, balik) {
  S.menunggu = (S.menunggu || 0) + 1;
  api(aksi, ...args).then(() => {}, e => { if (balik) balik(e); }).then(() => { S.menunggu--; if (!S.menunggu) segarkan(); });
}
function segarkan() { Object.values(K).forEach(c => c.t = 0); if (['beranda', 'saya', 'guru', 'admin'].includes(HAL)) V[HAL](); }
// ── Pustaka berat dimuat HANYA saat dibutuhkan ──
const URL_CHART = 'https://cdn.jsdelivr.net/npm/chart.js@4.4.4/dist/chart.umd.min.js', URL_XLSX = 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js', _skrip = {};
function muatSkrip(u) { return _skrip[u] || (_skrip[u] = new Promise((ok, no) => { const e = document.createElement('script'); e.src = u; e.onload = ok; e.onerror = () => { delete _skrip[u]; no(new Error('Gagal memuat pustaka. Periksa internet.')); }; document.head.appendChild(e); })); }
function hangatkan() { try { if (CONFIG.GAS_URL.indexOf('script.google.com') > 0) fetch(CONFIG.GAS_URL, { mode: 'no-cors' }); } catch (e) {} }   // bangunkan server saat layar login tampil
function prefetch() {   // siapkan halaman lain & pustaka saat browser menganggur
  if (!S.init) return; const r = S.init.user.role;
  if (r === 'admin') { api('getDataGuru').then(d => setK('getDataGuru', [], d)).catch(() => {}); setTimeout(() => { muatSkrip(URL_CHART).catch(() => {}); muatSkrip(URL_XLSX).catch(() => {}); }, 1500); }
}
function cariDebounce(v) { clearTimeout(cariDebounce.t); cariDebounce.t = setTimeout(() => { S.q = v; terapkanCari(); }, 120); }
function terapkanCari() { const q = (S.q || '').toLowerCase().trim(); document.querySelectorAll('tr[data-q]').forEach(tr => tr.style.display = tr.dataset.q.includes(q) ? '' : 'none'); }
// ── Draf cerita di perangkat (tidak hilang bila internet putus / halaman dimuat ulang) ──
const kDraf = () => 'cerdas_draf_' + (S.init && S.init.user.id);
const kolom4F = ['Judul', 'Facts', 'Feelings', 'Findings', 'Future'];
function simpanDrafLokal(c) { try { sessionStorage.setItem(kDraf(), JSON.stringify(c)); } catch (e) {} }
function autosave() { clearTimeout(autosave.t); autosave.t = setTimeout(() => { const c = {}; kolom4F.forEach(k => { const el = $('#f_' + k); c[k] = el ? el.value : ''; }); simpanDrafLokal(c); const a = $('#autosave'); if (a) a.textContent = '✔ draf tersimpan di perangkat'; }, 400); }
function toast(m, err) { const t = $('#toast'); t.textContent = m; t.className = 'toast show' + (err ? ' err' : ''); setTimeout(() => t.className = 'toast', 3800); }
function siapkanUI() {   // app.js mandiri: buat elemen indikator + gayanya bila index.html/style.css yang terpasang masih versi lama
  if (!$('#bar')) document.body.insertAdjacentHTML('afterbegin', '<div id="bar"></div>');
  if (!$('#blok')) document.body.insertAdjacentHTML('afterbegin', '<div id="blok"></div>');
  if (!document.getElementById('gaya-bar')) {
    const st = document.createElement('style'); st.id = 'gaya-bar';
    st.textContent = "#bar{position:fixed;top:0;left:0;height:3px;width:100%;z-index:120;overflow:hidden;pointer-events:none}#bar.on::after{content:'';display:block;height:100%;width:40%;background:linear-gradient(90deg,#006194,#D97706);border-radius:3px;animation:barjalan 1s ease-in-out infinite}@keyframes barjalan{0%{transform:translateX(-100%)}100%{transform:translateX(260%)}}#blok{display:none;position:fixed;inset:0;z-index:110;cursor:progress}";
    document.head.appendChild(st);
  }
}
function busy(on, blok = true) {
  const l = $('#loader'), b = $('#bar'), k = $('#blok');
  if (l) l.style.display = 'none'; if (b) b.className = on ? 'on' : ''; if (k) k.style.display = on && blok ? 'block' : 'none';
}
// Jaring pengaman: kalau terjadi error saat memuat, tampilkan alasannya di layar (bukan layar kosong)
window.addEventListener('error', e => {
  const m = $('#app-container'); if (!m || m.innerHTML.trim()) return;
  m.innerHTML = `<div class="card" style="max-width:560px;margin:24px auto"><h2>😕 Aplikasi gagal dimuat</h2><p>${esc(e.message)}</p>
    <p class="mute">Tekan Ctrl+Shift+R. Jika masih sama, pastikan <b>index.html</b>, <b>css/style.css</b> dan <b>js/app.js</b> di GitHub sudah versi terbaru semua.</p></div>`;
  const l = $('#loader'); if (l) l.style.display = 'none';
});
async function go(p, arg) {   // navigasi INSTAN: halaman langsung tampil dari cache; bar tipis hanya jika server > 250ms
  HAL = p; document.querySelectorAll('#nav a').forEach(a => a.classList.toggle('on', a.dataset.p === p)); window.scrollTo(0, 0);
  const lambat = setTimeout(() => busy(1, false), 250);
  try { await V[p](arg); } catch (e) {}
  clearTimeout(lambat); busy(0);
}
const page = h => $('#app-container').innerHTML = h;
const periodeLabel = p => p ? new Date(p + '-01').toLocaleDateString('id-ID', { month: 'long', year: 'numeric' }) : '';

window.addEventListener('DOMContentLoaded', async () => {
  siapkanUI();
  const t = sessionStorage.getItem('cerdas_token');
  if (!t) { busy(0); hangatkan(); return tampilLogin(); }
  S.token = t;
  try { await mulai(); } catch (e) { sessionStorage.removeItem('cerdas_token'); S.token = null; tampilLogin(); }
  busy(0);
});

const PERAN = { murid: ['Murid', 'NIS', 'bi-mortarboard', 'Masukkan NIS', 'numeric'], guru: ['Guru Wali', 'Email', 'bi-person-badge', 'nama@gmail.com', 'email'], admin: ['Admin', 'Username', 'bi-shield-lock', 'Username admin', 'text'] };
const LOGO = `<svg viewBox="0 0 120 120" width="92" height="92" aria-hidden="true"><circle cx="60" cy="60" r="56" fill="#fff" stroke="#6CB2E0" stroke-width="6"/>
  <path d="M22 62Q41 54 60 64V96Q41 86 22 94Z" fill="#FDBA74" stroke="#4F9BD0" stroke-width="3" stroke-linejoin="round"/>
  <path d="M98 62Q79 54 60 64V96Q79 86 98 94Z" fill="#7DD3FC" stroke="#4F9BD0" stroke-width="3" stroke-linejoin="round"/>
  <polygon points="60,16 67,32 85,33 71,44 76,61 60,51 44,61 49,44 35,33 53,32" fill="#FCD34D" stroke="#F59E0B" stroke-width="3" stroke-linejoin="round"/>
  <circle cx="54" cy="38" r="2" fill="#92400E"/><circle cx="66" cy="38" r="2" fill="#92400E"/><path d="M55 44Q60 48 65 44" stroke="#92400E" stroke-width="2" fill="none" stroke-linecap="round"/></svg>`;
function tampilLogin() {
  document.body.classList.add('is-login'); $('#nav').innerHTML = ''; $('#who').innerHTML = ''; $('#banner').textContent = '';
  page(`<div class="login-wrap"><span class="deco d1">⭐</span><span class="deco d2">☁️</span><span class="deco d3">📖</span><span class="deco d4">✏️</span><span class="deco d5">🌈</span>
    <div class="login-card"><div class="logo">${LOGO}</div><h1 class="lg-title">CERDAS</h1>
    <p class="lg-sub">Cerita Digital Anak Sempatik<br><b>${CONFIG.SEKOLAH}</b></p>
    <div class="pillnav seg" id="tabs">${Object.keys(PERAN).map(p => `<a data-r="${p}" onclick="pilih('${p}')"><i class="bi ${PERAN[p][2]}"></i> ${PERAN[p][0]}</a>`).join('')}</div>
    <label class="lbl" id="lg_l" for="lg_u"></label>
    <div class="field"><i class="bi bi-person lead"></i><input id="lg_u" autocomplete="off" autocapitalize="none" spellcheck="false" onkeydown="if(event.key==='Enter')$('#lg_k').focus()"></div>
    <label class="lbl" for="lg_k">Kode Akses (6 angka)</label>
    <div class="field"><i class="bi bi-key lead"></i><input id="lg_k" type="password" inputmode="numeric" maxlength="6" autocomplete="off" placeholder="••••••"
      oninput="this.value=this.value.replace(/\D/g,'')" onkeydown="if(event.key==='Enter')masuk()">
      <button type="button" class="eye" id="eye" onclick="lihatKode()" aria-label="Tampilkan kode"><i class="bi bi-eye"></i></button></div>
    <p id="lg_err" role="alert"></p>
    <button class="btn lg-btn" onclick="masuk()">Masuk <i class="bi bi-arrow-right"></i></button>
    <p class="lg-help">Lupa kode akses? Hubungi guru wali atau admin sekolah.</p></div></div>`);
  pilih('murid');
}
function pilih(p) {
  S.peran = p; const r = PERAN[p];
  document.querySelectorAll('#tabs a').forEach(a => a.classList.toggle('on', a.dataset.r === p));
  $('#lg_l').textContent = r[1]; const u = $('#lg_u'); u.placeholder = r[3]; u.setAttribute('inputmode', r[4]); u.value = '';
  document.querySelector('.field .lead').className = 'bi ' + r[2] + ' lead'; u.focus();
}
function lihatKode() {
  const i = $('#lg_k'), s = i.type === 'password'; i.type = s ? 'text' : 'password';
  $('#eye').innerHTML = '<i class="bi ' + (s ? 'bi-eye-slash' : 'bi-eye') + '"></i>'; $('#eye').setAttribute('aria-label', s ? 'Sembunyikan kode' : 'Tampilkan kode');
}
async function masuk() {
  const u = $('#lg_u').value.trim(), k = $('#lg_k').value.trim(); if (!u || !k) return toast('Isi data masuk dan kode akses.', 1);
  $('#lg_err').textContent = ''; busy(1);
  try {
    batalCache(); const j = await api('login', S.peran, u, k);
    S.token = j.token; sessionStorage.setItem('cerdas_token', S.token); await mulai(j.awal);
  } catch (e) { const el = $('#lg_err'); if (el) el.textContent = '⚠ ' + ((e && e.message) || 'Tidak bisa terhubung ke server.'); }
  busy(0);
}
function pasang(r) {   // pasang data awal + isi cache agar halaman pertama tanpa menunggu
  S.init = r.init; setK('getInit', [], r.init); if (r.guru) setK('getDataGuru', [], r.guru); if (r.admin) setK('getDataAdmin', [], r.admin);
  const me = r.init.user; document.body.classList.remove('is-login');
  document.querySelector('footer').textContent = '© CERDAS · Platform Refleksi Karakter 4F · ' + CONFIG.SEKOLAH + ' · ' + (r.init.build || '');
  $('#banner').textContent = '✨ Periode Aktif: ' + periodeLabel(r.init.periode) + ' · Jangan lupa bagikan ceritamu ya! ✨';
  renderWho(); $('#nav').innerHTML = MENU[me.role].map(m => `<a data-p="${m[0]}" onclick="go('${m[0]}')">${m[1]}</a>`).join('');
}
async function mulai(awal) {
  const ci = K[kk('getInit', [])]; let r = awal || (ci && { init: ci.data });
  if (!r) r = await api('muatAwal');
  pasang(r); await go(MENU[r.init.user.role][0][0]);
  if (!awal && ci) api('muatAwal').then(pasangBaru).catch(() => {});   // refresh halaman: tampil dari cache, segarkan di latar
  setTimeout(prefetch, 400);
}
function pasangBaru(r) { const c = K[kk('getInit', [])]; if (!c || c.s !== JSON.stringify(r.init)) { pasang(r); segarkan(); } }
function keluar(auto) {
  if (S.token && !auto) api('logout').catch(() => {});
  S.token = null; S.init = null; S.menunggu = 0; batalCache();
  Object.keys(sessionStorage).filter(x => x.startsWith('cerdas_')).forEach(x => sessionStorage.removeItem(x));
  tampilLogin(); if (auto) toast('Sesi berakhir, silakan masuk lagi.', 1); busy(0);
}

const draft = () => (S.init.cerita || []).find(c => c.Periode === S.init.periode) || {};
const terkirim = () => draft().Status && draft().Status !== 'Draft';

const V = {
  async beranda() {
    await swr('getInit', [], x => { S.init = x; const d = draft(), u = S.init.user;
    page(`<section class="hero"><span class="badge">Kelas ${esc(u.kelas)}</span> <span class="badge">${periodeLabel(S.init.periode)}</span>
      <h1>Halo, ${esc(u.nama)}! 👋</h1><p>Setiap pengalamanmu adalah petualangan berharga. Ceritakan kejadian, perasaan, dan idemu dengan metode 4F!</p>
      <button class="btn" onclick="go('tulis')">${terkirim() ? 'Lihat Ceritamu' : d.Judul ? 'Lanjutkan Cerita' : 'Mulai Menulis Cerita'} →</button></section>
      <div class="grid g4">${F4.map((f, i) => `<div class="card q click" style="--c:var(${f[3]});--t:var(${f[4]})" onclick="go('tulis')">
      <span class="badge"><i class="bi ${f[5]}"></i> Fase ${i + 1}</span><h3>${f[1]}</h3><p class="hint">${f[2]}</p>
      <b style="color:var(${f[3]})">${d[f[0]] ? '✔ Sudah ditulis' : 'Belum ditulis'}</b></div>`).join('')}</div>${fbCard()}`); });
  },
  async tulis() {
    let d = draft(); const kunci = terkirim();
    if (!kunci) { try { const l = JSON.parse(sessionStorage.getItem(kDraf()) || 'null'); if (l) d = Object.assign({}, d, l); } catch (e) {} }
    page(`<div class="card"><span class="badge">LEMBAR REFLEKSI DIRI</span><h2>Beri Judul yang Seru untuk Ceritamu 🎨</h2>
      <input id="f_Judul" maxlength="150" oninput="autosave()" value="${esc(d.Judul)}" placeholder="Contoh: Kerja Kelompok Membuat Poster Kebersihan" ${kunci ? 'disabled' : ''}><p class="hint" style="margin-top:8px">💡 Judul singkat yang menggambarkan kejadian yang kamu ceritakan.</p></div><br>
      <div class="grid">${F4.map((f, i) => `<div class="card q" style="--c:var(${f[3]});--t:var(${f[4]})">
      <span class="badge"><i class="bi ${f[5]}"></i> ${i + 1}. ${f[1]}</span><h3 style="margin-top:10px">${f[2]}</h3>
      <div class="tip">💡 <b>Panduan:</b> ${f[6]}</div><details class="ex"><summary>👀 Lihat contoh cerita</summary><p>${f[8]}</p></details>
      <textarea id="f_${f[0]}" maxlength="2000" placeholder="${esc(f[7])}" oninput="hit('${f[0]}');autosave()" ${kunci ? 'disabled' : ''}>${esc(d[f[0]])}</textarea>
      <div class="cnt"><span id="h_${f[0]}"></span><span id="c_${f[0]}"></span></div></div>`).join('')}</div>
      <div class="sticky"><span class="mute" style="margin-right:auto">🛡 Hanya 1x kirim per bulan · <span id="autosave"></span></span>
      ${kunci ? '<b>Ceritamu sudah terkirim ✅</b>' : `<button class="btn sec" onclick="simpan(false)">Simpan Draf</button><button class="btn" onclick="simpan(true)">Kirim Cerita ke Guru Wali 🚀</button>`}</div>`);
    F4.forEach(f => hit(f[0]));
  },
  async saya() {
    await swr('getInit', [], x => { S.init = x; const l = S.init.cerita;
    page(`<h2>Cerita Saya</h2><div class="grid">${l.length ? l.map(c => `<div class="card"><span class="badge">${periodeLabel(c.Periode)} · ${c.Status}</span>
      <h3>${esc(c.Judul)}</h3>${umpanBalik(c)}
      <button class="btn sec" onclick="pdf('${c.ID}')"><i class="bi bi-download"></i> Unduh PDF</button></div>`).join('') : '<div class="card">Belum ada cerita. Yuk mulai menulis!</div>'}</div>`); });
  },
  async guru() {
    await swr('getDataGuru', [], d => { S.guru = d;
    const n = d.murid.filter(m => m.cerita && m.cerita.Status !== 'Draft').length, r = d.murid.filter(m => m.cerita && m.cerita.Bintang).length;
    page(`<h2>Murid Binaan</h2><p class="mute">Periode ${periodeLabel(d.periode)} · ${n} dari ${d.murid.length} sudah mengirim · ${r} sudah diberi masukan</p>
      <input id="cari" placeholder="🔍 Cari nama / kelas…" value="${esc(S.q || '')}" oninput="cariDebounce(this.value)" style="max-width:360px;margin-bottom:12px"><div class="card" style="overflow:auto"><table><tr><th>Nama</th><th>Kelas</th><th>Judul</th><th>Status</th><th>Bintang</th><th></th></tr>${d.murid.map(m => {
        const c = m.cerita, kirim = c && c.Status !== 'Draft';
        return `<tr data-q="${esc((m.Nama_Murid + ' ' + m.Kelas).toLowerCase())}"><td>${esc(m.Nama_Murid)}</td><td>${esc(m.Kelas)}</td><td>${c ? esc(c.Judul) : '-'}</td><td>${c ? c.Status : 'Belum menulis'}</td>
        <td style="color:#F59E0B;white-space:nowrap">${c && c.Bintang ? bintangStr(Number(c.Bintang)) : '-'}</td>
        <td>${kirim ? `<button class="btn ${c.Bintang ? 'sec' : ''}" style="min-height:36px;padding:0 16px" onclick="go('detail','${m.ID}')">${c.Bintang ? 'Ubah Masukan' : 'Beri Masukan'}</button>` : ''}</td></tr>`; }).join('')}</table></div>`); terapkanCari(); });
  },
  async detail(id) {
    const m = S.guru.murid.find(x => x.ID === id), c = m.cerita; S.bt = Number(c.Bintang) || 0;
    page(`<button class="btn sec" onclick="go('guru')">← Kembali</button><h2>${esc(c.Judul)}</h2><p class="mute">${esc(m.Nama_Murid)} · ${esc(m.Kelas)} · ${c.Tanggal_Tulis}</p>
      <div class="grid g2">${F4.map(f => `<div class="card q" style="--c:var(${f[3]})"><span class="badge" style="--t:var(${f[4]})">${f[1]}</span><p>${esc(c[f[0]]).replace(/\n/g, '<br>')}</p></div>`).join('')}</div><br>
      <div class="card"><h3>💌 Masukan untuk ${esc(m.Nama_Murid)}</h3><p class="mute">Setelah dikirim, bintang dan masukan langsung tampil di akun murid.</p>
      <div id="stars" style="font-size:46px;line-height:1;cursor:pointer;user-select:none"></div><div id="stlab" class="mute" style="font-weight:700"></div><br>
      <label>Masukan untuk murid (pujian & saran)</label><textarea id="kom" maxlength="1000" placeholder="Contoh: Ceritamu sangat jujur dan runtut. Lain kali coba tambahkan rencana aksi yang lebih rinci.">${esc(c.Komentar_Guru)}</textarea><br>
      <details><summary class="mute" style="cursor:pointer">Nilai angka 0–100 (opsional)</summary><br><input id="nilai" type="number" min="0" max="100" value="${c.Nilai}" style="max-width:200px"></details><br>
      <button class="btn" onclick="nilai('${c.ID}')">⭐ Kirim Masukan ke Murid</button> <button class="btn sec" onclick="pdf('${c.ID}')">Cetak PDF</button></div>`);
    pilihBintang(S.bt);
  },
  async admin() {
    await swr('getDataAdmin', [], d => { const k = Object.entries(d.kelas), tot = k.reduce((a, x) => a + x[1].total, 0) || 1;
    page(`<h2>Panel Administrator</h2><div class="grid g4">${[['Murid', d.murid], ['Guru Wali', d.guru], ['Cerita Terkumpul', d.cerita], ['Partisipasi', Math.round(d.cerita / tot * 100) + '%']]
      .map(x => `<div class="card"><span class="mute">${x[0]}</span><div class="stat">${x[1]}</div></div>`).join('')}</div><br>
      <div class="card"><h3>Pengumpulan Cerita per Kelas (${periodeLabel(d.periode)})</h3><canvas id="ch" height="110"></canvas></div><br>
      <div class="card"><h3>Periode aktif</h3><input id="per" type="month" value="${d.periode}" style="max-width:240px"> <button class="btn" onclick="atur()">Simpan</button></div>`);
    muatSkrip(URL_CHART).then(() => { if (S.chart) S.chart.destroy(); S.chart = new Chart($('#ch'), { type: 'bar', data: { labels: k.map(x => x[0]), datasets: [{ label: 'Sudah mengirim (%)', data: k.map(x => Math.round(x[1].sudah / (x[1].total || 1) * 100)), backgroundColor: '#059669', borderRadius: 12 }] }, options: { scales: { y: { max: 100, beginAtZero: true } } } }); }).catch(() => {}); });
  },
  async kelola() {
    await swr('getDataAdmin', [], d => { const kl = Object.keys(d.kelas).filter(Boolean).sort();
    const kartu = (j, n, opsi, ph, extra) => `<div class="card"><h3>Data ${j === 'Murid' ? 'Murid Binaan' : 'Guru Wali'} (${n})</h3>
      <select id="${j}_m" onchange="modeHapus('${j}')" style="width:100%;padding:12px;border-radius:16px;border:2px solid var(--line)">${opsi}</select><br><br>
      ${j === 'Murid' ? `<select id="Murid_k" style="display:none;width:100%;padding:12px;border-radius:16px;border:2px solid var(--line)">${kl.map(x => `<option value="${esc(x)}">${esc(x)}</option>`).join('')}</select>` : ''}
      <input id="${j}_n" placeholder="${ph}" style="display:none"><br>${extra}
      <input id="${j}_x" placeholder="Ketik HAPUS untuk konfirmasi"><br><br>
      <button class="btn coral" onclick="hapus('${j}')"><i class="bi bi-trash"></i> Hapus Data ${j}</button> <button class="btn sec" onclick="lihat('${j}')">Lihat Data</button></div>`;
    page(`<h2>Kelola Data</h2><p class="mute">Salah unggah? Hapus datanya, lalu impor ulang (guru dulu, baru murid). Penghapusan tidak bisa dibatalkan.</p><div id="kmsg"></div><div class="grid g2">
      ${kartu('Murid', d.murid, '<option value="semua">Semua murid</option><option value="kelas">Per kelas</option><option value="satu">Satu murid (NIS)</option>', 'NIS murid',
        '<label style="font-size:14px"><input type="checkbox" id="Murid_c" style="width:auto;display:inline;margin-right:8px">Ikut hapus cerita murid yang dihapus</label><br><br>')}
      ${kartu('Guru', d.guru, '<option value="semua">Semua guru</option><option value="satu">Satu guru (email)</option>', 'Email guru', '')}</div><div id="lihat"></div>`); });
  },
  async profil() {
    const u = S.init.user; S.foto = null;
    page(`<h2>Foto Profil</h2><div class="card" style="max-width:520px;margin:0 auto;text-align:center"><div id="pv">${avatarHtml(140)}</div><h3 style="margin-top:12px">${esc(u.nama)}</h3>
      <p class="mute">Pilih foto yang sopan dan jelas. Foto otomatis dipotong persegi dan dikecilkan. Foto tampil di samping namamu di pojok kanan atas.</p>
      <input type="file" id="fp" accept="image/*" onchange="pilihFoto(this)"><br><br>
      <button class="btn" id="fs" onclick="kirimFoto()" disabled>Simpan Foto</button> <button class="btn sec" onclick="hapusFoto()">Hapus Foto</button></div>`);
  },
  async impor() {
    page(`<h2>Impor Data dari Excel/CSV</h2><p class="mute">Impor <b>Guru dulu</b>, baru Murid. Kode akses dibuat otomatis untuk data baru dan hanya tampil sekali.</p>
      <div class="grid g2">${[['Guru', 'Nama_Guru, Email_Akun, Kelas_Binaan'], ['Murid', 'NIS, Nama_Murid, Kelas, Email_Guru_Wali']].map(x => `<div class="card">
      <h3>Data ${x[0]}</h3><p class="mute">Kolom wajib: ${x[1]}</p><button class="btn sec" onclick="template('${x[0]}')"><i class="bi bi-download"></i> Unduh Template Excel</button><br><br><label style="font-size:14px;cursor:pointer"><input type="checkbox" id="ul_${x[0]}" style="width:auto;display:inline;margin-right:8px">Buat ulang kode akses untuk <b>semua</b> baris di file (kode lama tidak berlaku lagi)</label><br><br><div class="drop"><input type="file" id="x_${x[0]}" accept=".xlsx,.xls,.csv"></div><br>
      <button class="btn" onclick="impor('${x[0]}')">Impor ${x[0]}</button></div>`).join('')}</div><br>
      <div class="card"><h3>Reset kode akses</h3><div class="grid g2"><select id="rs_j" style="padding:12px;border-radius:16px;border:2px solid var(--line)"><option>Murid</option><option>Guru</option></select>
      <input id="rs_u" placeholder="NIS murid / email guru"></div><br><button class="btn coral" onclick="reset()">Buat Kode Baru</button></div><div id="hasil"></div>`);
  }
};

function hit(k) { const t = $('#f_' + k), n = t.value.length; $('#c_' + k).textContent = n + ' / 2000 karakter'; $('#h_' + k).textContent = n ? '✔ Terisi' : ''; }
function simpan(kirim) {
  const c = {}; kolom4F.forEach(k => c[k] = $('#f_' + k).value);
  if (kirim) {
    if (kolom4F.some(k => !c[k].trim())) return toast('Lengkapi judul dan semua bagian 4F sebelum mengirim.', 1);
    if (!confirm('Kirim cerita ke Guru Wali? Setelah dikirim tidak bisa diubah.')) return;
  }
  const lama = JSON.parse(JSON.stringify(S.init.cerita || [])), d = draft();
  // 1) UI berubah SEKETIKA
  const baru = Object.assign({ ID: d.ID || 'tmp', Periode: S.init.periode, Komentar_Guru: '', Nilai: '', Bintang: '' }, d, c, { Status: kirim ? 'Terkirim' : 'Draft' });
  S.init.cerita = (S.init.cerita || []).filter(x => x.Periode !== S.init.periode).concat(baru); setK('getInit', [], S.init);
  simpanDrafLokal(c); toast(kirim ? 'Hore! Ceritamu terkirim 🚀' : 'Draf tersimpan ✔'); if (kirim) { sessionStorage.removeItem(kDraf()); go('beranda'); }
  // 2) Sinkron ke server di latar belakang; gagal → kembalikan
  bg('simpanCerita', [c, kirim], () => { S.init.cerita = lama; setK('getInit', [], S.init); simpanDrafLokal(c); if (kirim) { toast('Gagal mengirim — ceritamu kembali menjadi draf, coba lagi.', 1); go('tulis'); } });
}
const LAB = ['', 'Perlu bimbingan', 'Cukup', 'Baik', 'Sangat baik', 'Luar biasa!'];
const bintangStr = n => '★'.repeat(n) + '☆'.repeat(5 - n);
function pilihBintang(n) {
  S.bt = n; $('#stars').innerHTML = [1, 2, 3, 4, 5].map(i => `<span onclick="pilihBintang(${i})" style="color:${i <= n ? '#F59E0B' : '#CBD5E1'}">★</span>`).join('');
  $('#stlab').textContent = n ? n + ' bintang · ' + LAB[n] : 'Ketuk bintang untuk memberi nilai';
}
function nilai(id) {
  if (!S.bt) return toast('Pilih bintang 1–5 dulu.', 1);
  const bt = S.bt, kom = $('#kom').value, ang = $('#nilai').value, d = S.guru, lama = JSON.stringify(d), m = d.murid.find(x => x.cerita && x.cerita.ID === id); if (!m) return;
  Object.assign(m.cerita, { Bintang: bt, Komentar_Guru: kom, Nilai: ang === '' ? '' : Number(ang), Status: 'Sudah Dinilai' });
  setK('getDataGuru', [], d); toast('Masukan & bintang terkirim ke murid ✔'); go('guru');
  bg('nilaiCerita', [id, bt, kom, ang], () => { S.guru = JSON.parse(lama); setK('getDataGuru', [], S.guru); go('guru'); });
}
// Tampilan umpan balik di sisi murid
function umpanBalik(c) {
  return c.Bintang ? `<div style="font-size:30px;color:#F59E0B">${bintangStr(Number(c.Bintang))}</div><p><b>Masukan dari Guru Wali:</b><br><i>“${esc(c.Komentar_Guru) || 'Hebat, terus menulis ya!'}”</i></p>${c.Nilai !== '' ? `<p><b>Nilai: ${c.Nilai}</b></p>` : ''}` : '<p class="mute">Menunggu masukan dari Guru Wali.</p>';
}
function fbCard() {
  const f = (S.init.cerita || []).find(c => c.Bintang);
  return f ? `<br><div class="card q" style="--c:var(--f2)"><h3>💌 Masukan terbaru dari Guru Wali</h3><b>${esc(f.Judul)}</b>${umpanBalik(f)}</div>` : '';
}
async function atur() { busy(1); try { await api('aturPeriode', $('#per').value); batalCache(); S.init.periode = $('#per').value; toast('Periode diperbarui'); } catch (e) {} busy(0); }
async function pdf(id) {
  busy(1);
  try {
    const b = await api('buatPdf', id), bin = atob(b), a = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) a[i] = bin.charCodeAt(i);
    const l = document.createElement('a'); l.href = URL.createObjectURL(new Blob([a], { type: 'application/pdf' })); l.download = 'Cerita_CERDAS.pdf'; l.click();
  } catch (e) {}
  busy(0);
}
async function impor(jenis) {
  const f = $('#x_' + jenis).files[0]; if (!f) return toast('Pilih berkas dulu.', 1);
  if (f.size > 10 * 1024 * 1024) return toast('Maksimal 10MB.', 1);
  busy(1);
  try {
    await muatSkrip(URL_XLSX); const wb = XLSX.read(await f.arrayBuffer()), rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '', raw: false });
    const r = await api('importData', jenis, rows.filter(x => Object.values(x).some(v => String(v).trim())).map(x => { const o = {}; Object.keys(x).forEach(k => o[kanon(jenis, k)] = x[k]); return o; }), $('#ul_' + jenis).checked);
    batalCache(); S.kode = r.kode.map(x => [x.nama, x.user, x.kode]);
    $('#hasil').innerHTML = `<br><div class="card"><h3>Hasil impor ${jenis}</h3><p>Baru: <b>${r.baru}</b> · Diperbarui: <b>${r.ubah}</b> · Ditolak: <b>${r.tolak.length}</b></p>${r.tolak.map(esc).join('<br>')}
      ${r.kode.length ? `<p><b>Kode akses (hanya tampil sekali, simpan sekarang!):</b></p><button class="btn" onclick="unduhKode('${jenis}')"><i class="bi bi-download"></i> Unduh Daftar Kode (CSV)</button>
      <div style="overflow:auto;max-height:340px;margin-top:12px"><table><tr><th>Nama</th><th>${jenis === 'Murid' ? 'NIS' : 'Email'}</th><th>Kode Akses</th></tr>${S.kode.map(x => `<tr><td>${esc(x[0])}</td><td>${esc(x[1])}</td><td><b>${esc(x[2])}</b></td></tr>`).join('')}</table></div>` : '<p class="mute">Tidak ada kode baru. Centang "Buat ulang kode akses" jika ingin menerbitkan kode baru.</p>'}</div>`;
    toast('Impor selesai ✔');
  } catch (e) {}
  busy(0);
}
function unduhKode(j) {
  const csv = 'Nama,' + (j === 'Murid' ? 'NIS' : 'Email') + ',Kode Akses\n' + S.kode.map(r => r.map(c => '"' + String(c).replace(/"/g, '""') + '"').join(',')).join('\n');
  const l = document.createElement('a'); l.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); l.download = 'Kode_Akses_' + j + '.csv'; l.click();
}
async function reset() {
  const u = $('#rs_u').value.trim(); if (!u) return toast('Isi NIS atau email.', 1);
  busy(1); try { const r = await api('resetKode', $('#rs_j').value, u); $('#hasil').innerHTML = `<br><div class="card">Kode baru untuk <b>${esc(r.user)}</b>: <span class="stat">${r.kode}</span></div>`; } catch (e) {}
  busy(0);
}

/** Unduh template .xlsx: sheet "Data" (hanya judul kolom, siap diisi) + sheet "Petunjuk" (aturan & contoh). */
async function template(j) {
  try { await muatSkrip(URL_XLSX); } catch (e) { return toast(e.message, 1); }
  const T = {
    Guru: { h: ['Nama_Guru', 'Email_Akun', 'Kelas_Binaan'], p: [
      ['PETUNJUK PENGISIAN DATA GURU WALI'], [''],
      ['1. Isi data mulai baris 2 pada sheet "Data". Jangan mengubah atau menghapus judul kolom.'],
      ['2. Email_Akun wajib diisi, harus benar dan unik. Dipakai untuk login dan menerima email notifikasi cerita baru.'],
      ['3. Kelas_Binaan: tulis kelas yang dibina, contoh 4A (jika lebih dari satu, pisahkan dengan koma).'],
      ['4. Impor data Guru LEBIH DULU, baru data Murid.'], [''],
      ['CONTOH BARIS (jangan ditulis di sheet Data kecuali diganti data asli):'],
      ['Nama_Guru', 'Email_Akun', 'Kelas_Binaan'], ['Ibu Ratna Sari, S.Pd', 'ratna.sari@gmail.com', '4A']] },
    Murid: { h: ['NIS', 'Nama_Murid', 'Kelas', 'Email_Guru_Wali'], p: [
      ['PETUNJUK PENGISIAN DATA MURID'], [''],
      ['1. Isi data mulai baris 2 pada sheet "Data". Jangan mengubah atau menghapus judul kolom.'],
      ['2. NIS wajib diisi dan unik (dipakai murid untuk login). Jika NIS berawalan angka 0, format kolom NIS sebagai Teks (Format → Angka → Teks) sebelum mengetik.'],
      ['3. Email_Guru_Wali harus SAMA PERSIS dengan Email_Akun guru yang sudah diimpor.'],
      ['4. Impor data Guru lebih dulu, baru data Murid.'],
      ['5. Kode akses murid dibuat otomatis saat impor; unduh daftar kodenya setelah impor selesai.'], [''],
      ['CONTOH BARIS (jangan ditulis di sheet Data kecuali diganti data asli):'],
      ['NIS', 'Nama_Murid', 'Kelas', 'Email_Guru_Wali'], ['0123456789', 'Budi Pratama', '4A', 'ratna.sari@gmail.com']] }
  }[j];
  const wb = XLSX.utils.book_new(), d = XLSX.utils.aoa_to_sheet([T.h]), p = XLSX.utils.aoa_to_sheet(T.p);
  d['!cols'] = T.h.map(() => ({ wch: 30 })); p['!cols'] = [{ wch: 110 }, { wch: 30 }, { wch: 30 }, { wch: 30 }];
  XLSX.utils.book_append_sheet(wb, d, 'Data'); XLSX.utils.book_append_sheet(wb, p, 'Petunjuk');
  const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const l = document.createElement('a'); l.href = URL.createObjectURL(new Blob([out], { type: 'application/octet-stream' })); l.download = 'Template_Data_' + j + '.xlsx'; l.click();
}

const KOLOM = { Murid: ['NIS', 'Nama_Murid', 'Kelas', 'Email_Guru_Wali'], Guru: ['Nama_Guru', 'Email_Akun', 'Kelas_Binaan'] };
function kanon(jenis, k) { const n = s => String(s).trim().toLowerCase().replace(/[\s\-]+/g, '_'); return KOLOM[jenis].find(c => n(c) === n(k)) || String(k).trim(); }
function modeHapus(j) { const m = $('#' + j + '_m').value, k = $('#Murid_k'); if (k) k.style.display = j === 'Murid' && m === 'kelas' ? '' : 'none'; $('#' + j + '_n').style.display = m === 'satu' ? '' : 'none'; }
const kmsg = (t, err) => { const el = $('#kmsg'); if (!el) return; const c = err ? 'var(--err)' : 'var(--f3)'; el.innerHTML = t ? `<div class="card" style="border-color:${c};margin-bottom:16px"><b style="color:${c}">${t}</b></div>` : ''; window.scrollTo(0, 0); };
async function hapus(j) {
  const mode = $('#' + j + '_m').value;
  if ($('#' + j + '_x').value.trim().toUpperCase() !== 'HAPUS') return kmsg('⚠ Ketik kata HAPUS pada kotak konfirmasi terlebih dulu.', 1);
  const nilai = mode === 'kelas' ? $('#Murid_k').value : mode === 'satu' ? $('#' + j + '_n').value.trim() : '';
  if (mode !== 'semua' && !nilai) return kmsg('⚠ Pilih atau isi data yang akan dihapus.', 1);
  kmsg('⏳ Menghapus data, mohon tunggu…'); busy(1);
  try {
    const r = await api('hapusData', j, mode, nilai, j === 'Murid' && $('#Murid_c').checked);
    batalCache(); await go('kelola'); kmsg('✅ ' + r.terhapus + ' data ' + j + ' berhasil dihapus' + (r.cerita ? ', ' + r.cerita + ' cerita ikut dihapus' : '') + '.');
  } catch (e) {
    kmsg('❌ Gagal menghapus: ' + esc((e && e.message) || 'tidak bisa terhubung ke server') + '. Jika pesannya "Script function not found: hapusData", berarti Kode.gs belum diperbarui / belum di-deploy versi baru.', 1);
  }
  busy(0);
}
async function lihat(j) {
  busy(1);
  try {
    const d = await api('getDaftar', j), h = j === 'Murid' ? ['NIS', 'Nama', 'Kelas', 'Guru Wali'] : ['Email', 'Nama', 'Kelas Binaan'];
    $('#lihat').innerHTML = `<br><div class="card"><h3>Data ${j} (${d.length})</h3><div style="overflow:auto;max-height:360px"><table><tr>${h.map(x => `<th>${x}</th>`).join('')}</tr>
      ${d.map(r => `<tr>${r.map(c => `<td>${esc(c) || '<span class="mute">(kosong)</span>'}</td>`).join('')}</tr>`).join('')}</table></div></div>`;
  } catch (e) {}
  busy(0);
}

// ── Foto profil ──
const inisial = () => (S.init.user.nama || '?').trim().charAt(0).toUpperCase();
function avatarHtml(px) {
  const u = S.init.user, st = `width:${px}px;height:${px}px;font-size:${Math.round(px / 2.3)}px`;
  return u.foto ? `<img class="ava" style="${st}" alt="Foto profil" src="${u.foto}">` : `<span class="ava ph" style="${st}">${esc(inisial())}</span>`;
}
function renderWho() {
  const me = S.init.user;
  $('#who').innerHTML = `<a class="avawrap" onclick="go('profil')" title="Ganti foto profil">${avatarHtml(38)}</a>${esc(me.nama)} (${me.role}) · <a onclick="keluar()" style="cursor:pointer;color:var(--pri);margin-left:4px">Keluar</a>`;
}
function pilihFoto(el) {
  const f = el.files[0]; if (!f) return; if (!/^image\//.test(f.type)) return toast('Pilih berkas gambar (JPG/PNG).', 1);
  const rd = new FileReader();
  rd.onload = () => {
    const im = new Image();
    im.onload = () => {
      const c = document.createElement('canvas'); c.width = c.height = 192; const x = c.getContext('2d'), s = Math.min(im.width, im.height);
      x.fillStyle = '#fff'; x.fillRect(0, 0, 192, 192); x.drawImage(im, (im.width - s) / 2, (im.height - s) / 2, s, s, 0, 0, 192, 192);
      let q = 0.85, d = c.toDataURL('image/jpeg', q); while (d.length > 38000 && q > 0.3) { q -= 0.1; d = c.toDataURL('image/jpeg', q); }
      S.foto = d; $('#pv').innerHTML = `<img class="ava" style="width:140px;height:140px" alt="Pratinjau" src="${d}">`; $('#fs').disabled = false;
    };
    im.onerror = () => toast('Gambar tidak bisa dibaca.', 1); im.src = rd.result;
  };
  rd.readAsDataURL(f);
}
function kirimFoto() {
  if (!S.foto) return; const lama = S.init.user.foto, f = S.foto;
  S.init.user.foto = f; setK('getInit', [], S.init); renderWho(); toast('Foto profil tersimpan ✔'); $('#fs').disabled = true;
  bg('simpanFoto', [f], () => { S.init.user.foto = lama; setK('getInit', [], S.init); renderWho(); const pv = $('#pv'); if (pv) pv.innerHTML = avatarHtml(140); });
}
function hapusFoto() {
  const lama = S.init.user.foto; S.init.user.foto = ''; S.foto = null; setK('getInit', [], S.init); renderWho(); $('#pv').innerHTML = avatarHtml(140); toast('Foto profil dihapus');
  bg('simpanFoto', [''], () => { S.init.user.foto = lama; setK('getInit', [], S.init); renderWho(); const pv = $('#pv'); if (pv) pv.innerHTML = avatarHtml(140); });
}
