# Panduan Instalasi CERDAS (Frontend GitHub Pages + Backend Google Apps Script)

Arsitektur baru: **tampilan** (HTML/CSS/JS) di **GitHub Pages**, **data & logika** tetap di **Google Apps Script**.
Aplikasi dibuka lewat alamat `https://USERNAME.github.io/NAMA-REPO/`, bukan lagi alamat `script.google.com`.

> **Folder kerja:** folder hasil ekstrak ZIP bernama **`cerdas-frontend`**. Di dalamnya langsung terlihat
> `index.html`, `css/`, `js/`. **Folder inilah yang di-`git init`** — jangan masuk lebih dalam, jangan naik satu level.

---
## BAGIAN A — Backend (Google Apps Script)

1. Buka proyek Apps Script CERDAS yang sudah ada (akun yang sama, **jangan buat proyek baru** supaya data tetap).
2. Buka `Kode.gs` → hapus seluruh isinya → paste isi `Kode.gs` versi baru (berkas terpisah) → simpan (Ctrl+S).
3. **Hapus** berkas lama `Index`, `Stylesheet`, `JavaScript` (tidak dipakai lagi): arahkan kursor ke nama berkas → ⋮ → Hapus.
4. **Deploy ulang:** Deploy → Kelola deployment → ikon pensil → Versi: **Versi baru** → Deploy.
   Pastikan: *Execute as* = **Me**, *Who has access* = **Anyone**. URL `/exec` tidak berubah.
5. **Salin URL** web app (berakhiran `/exec`).
6. **Tes backend:** tempel URL `/exec` di tab browser baru. Harus tampil teks JSON seperti
   `{"success":true,"data":{"app":"CERDAS", ... "build":"v2.0-api","status":"online"}}`.
   Kalau yang tampil halaman login/Google atau error, cek lagi pengaturan "Anyone" di langkah 4.

## BAGIAN B — Isi URL backend di frontend

1. Ekstrak ZIP → buka folder `cerdas-frontend` → `js` → buka `config.js` dengan Notepad.
2. Ganti `GANTI_DENGAN_URL_EXEC_ANDA` dengan URL `/exec` dari langkah A5 (tetap di dalam tanda kutip `' '`). Simpan.

## BAGIAN C — Deploy ke GitHub Pages (lewat terminal)

**C1. Pasang Git** — Windows: https://git-scm.com/download/win (install default). Lalu buka PowerShell dan cek:
```
git --version
```
**C2. Akun GitHub** — daftar di https://github.com (username jadi bagian alamat situs Anda).

**C3. Identitas Git (sekali saja):**
```
git config --global user.name "Nama Anda"
git config --global user.email "email-akun-github@contoh.com"
```
**C4. Buat repository:** github.com → tombol **+** → **New repository** → nama mis. `cerdas` → **Public** →
**jangan** centang README/.gitignore/license → Create repository.

**C5. Masuk ke folder kerja & verifikasi** (buka folder `cerdas-frontend` di File Explorer → klik address bar → ketik `powershell` → Enter):
```
dir
```
Wajib terlihat: `index.html`, folder `css`, folder `js`. Jika yang terlihat justru folder lain, Anda salah folder — jangan lanjut.

**C6. Push pertama (satu per satu):**
```
git init
git add .
git commit -m "Upload pertama"
git branch -M main
git remote add origin https://github.com/USERNAME/NAMA-REPO.git
git push -u origin main
```
Saat diminta *Password*, tempel **Personal Access Token** (bukan password akun). Layar terlihat kosong saat paste — normal.
Buat token: https://github.com/settings/tokens → Generate new token (classic) → centang **repo** → Generate → salin (`ghp_...`).

**C7. Aktifkan Pages:** repo → **Settings** → **Pages** → Source: *Deploy from a branch* → Branch **main** / **(root)** → Save → ✅ Enforce HTTPS.
Tunggu 1–2 menit; alamat situs muncul: `https://USERNAME.github.io/NAMA-REPO/`.

**C8. Update alamat di email notifikasi:** di `Kode.gs` ubah `URL_APLIKASI` ke alamat GitHub Pages Anda → simpan → deploy **Versi baru**.

## BAGIAN D — Tes
1. Buka alamat GitHub Pages → tekan **Ctrl+Shift+R**.
2. Masuk sebagai Admin (kode lama tetap berlaku — data tidak berubah).
3. Uji: menu Impor/Kelola Data, login murid → tulis cerita, login guru → beri bintang, ganti foto profil, unduh PDF.

## Update di kemudian hari
**Frontend** (ubah tampilan/js): dari folder `cerdas-frontend`:
```
git add .
git commit -m "Perubahan"
git push
```
Tunggu 1–2 menit, lalu Ctrl+Shift+R. **Backend** (ubah `Kode.gs`): paste → Deploy → Versi baru.

## Troubleshooting
| Gejala | Penyebab | Solusi |
|---|---|---|
| Muncul pesan "URL backend belum diisi" | `js/config.js` belum diisi | Isi `GAS_URL`, lalu `git add .` → `git commit -m "fix config"` → `git push` |
| "Respons server tidak valid" | Apps Script belum "Anyone" / belum deploy versi baru | Ulangi A4, tes URL `/exec` di browser (A6) |
| "Tidak bisa terhubung ke server" | Internet putus / URL `/exec` salah | Cek URL (harus `https://script.google.com/macros/s/.../exec`) |
| Situs 404 | `index.html` tidak di root repo (salah folder saat `git init`) | Cek repo di GitHub; push ulang dari folder `cerdas-frontend` dengan `git push -u origin main --force` |
| Halaman tanpa warna/gaya | Folder `css/` `js/` rata di root | Pastikan struktur folder utuh; jangan upload lewat web GitHub |
| `Password authentication is not supported` | Harus pakai token | Buat Personal Access Token (C6) |
| Tampil versi lama setelah push | Cache browser | Ctrl+Shift+R atau Incognito |
| Peringatan `LF will be replaced by CRLF` | Format baris Windows | Abaikan, bukan error |

## Catatan keamanan
Alamat backend (`GAS_URL`) tampil publik di repo — itu wajar. Semua data tetap terlindung kode akses & sesi;
tanpa NIS/email dan kode yang benar, tidak ada data yang bisa dibaca. Jangan pernah menaruh kode akses/CSV kode di repo.
