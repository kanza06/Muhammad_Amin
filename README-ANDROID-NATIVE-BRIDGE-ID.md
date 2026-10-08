# KAHFI PHOTOBOOTH — Android Native Remote Shutter Bridge

Paket ini menambahkan wrapper Android native untuk mengatasi remote Bluetooth yang hanya mengirim tombol Volume UP/DOWN dan tidak diteruskan Chrome ke JavaScript.

## Isi paket

- `webapp/` — project Next.js KAHFI PHOTOBOOTH dengan listener event `kahfi-native-shutter`.
- `android-native/` — project Android Studio Kotlin + WebView. Saat aplikasi terbuka, tombol Volume UP/DOWN ditangkap di Android native, lalu diteruskan ke halaman web sebagai event shutter.

## Cara kerja

1. Remote menekan Volume UP atau Volume DOWN.
2. `MainActivity.kt` menangkap `KEYCODE_VOLUME_UP` / `KEYCODE_VOLUME_DOWN`.
3. Aplikasi mengonsumsi tombol tersebut (jadi volume sistem tidak berubah selama KAHFI wrapper sedang aktif).
4. Android mengirim event `kahfi-native-shutter` ke WebView.
5. `webapp/app/page.tsx` memanggil fungsi capture jika mode remote di UI mengizinkan tombol itu.

## Penting: wrapper bukan APK siap pasang

Paket ini berisi source project Android, bukan APK yang sudah dikompilasi. Buka dan build melalui Android Studio pada komputer yang memiliki Android SDK.

## A. Jalankan web KAHFI

1. Buka folder `webapp/` di terminal.
2. Jalankan `npm install`.
3. Jalankan `npm run dev -- --hostname 0.0.0.0` untuk tes jaringan lokal.
4. Untuk produksi/kiosk, lebih disarankan deploy ke hosting HTTPS.

Jika Next.js berjalan di komputer, cari IP LAN komputer tersebut, misalnya `192.168.1.10`. Tablet dan komputer harus di jaringan Wi-Fi yang sama. Di firewall Windows izinkan port 3000.

**Catatan kamera:** akses kamera browser biasanya memerlukan secure context. Hosting HTTPS direkomendasikan. Akses HTTP dengan IP LAN bisa membuat `getUserMedia` tidak tersedia pada sebagian konfigurasi WebView/Android. `localhost` pada tablet menunjuk ke tablet itu sendiri, bukan komputer.

## B. Build aplikasi Android

1. Buka Android Studio.
2. Pilih **Open** lalu pilih folder `android-native/` (folder yang berisi `settings.gradle.kts`).
3. Tunggu Gradle Sync selesai dan instal Android SDK yang diminta Android Studio.
4. Hubungkan Xiaomi Pad 6 dengan USB debugging aktif, atau gunakan emulator (remote fisik hanya bisa dites di tablet).
5. Klik **Run**.
6. Saat pertama dibuka, masukkan URL web KAHFI, contoh `https://alamat-web-kahfi-kamu` atau `http://IP-KOMPUTER:3000` untuk uji coba jaringan lokal.
7. Izinkan akses kamera saat diminta.

Untuk membuat APK: **Build → Build Bundle(s) / APK(s) → Build APK(s)**. APK debug biasanya ada di `android-native/app/build/outputs/apk/debug/` setelah build sukses.

## C. Tes remote

1. Buka KAHFI dari aplikasi Android wrapper ini, bukan dari Chrome.
2. Masuk ke halaman Capture/Kamera.
3. Aktifkan `Volume UP`, `Volume DOWN`, atau `UP + DOWN` pada panel Remote Shutter.
4. Tekan tombol remote. Status pada panel seharusnya berubah menjadi `Native Remote Volume ... terdeteksi` dan timer capture berjalan.

Tombol volume ditangkap hanya ketika wrapper Android ini aktif. Di luar aplikasi ini, tombol volume tetap berfungsi normal. Tekan tombol Back Android untuk membuka pilihan ubah URL atau keluar.

## D. Menggabungkan ke GitHub

Jangan mengganti seluruh repository lama dengan folder `webapp`. Salin/merge perubahan `webapp/app/page.tsx` ke project Next.js lama, dan tambahkan folder `android-native/` sebagai project baru di repository jika ingin menyimpan kode wrapper. Periksa `git diff` sebelum commit. Jangan commit `.env.local`, token, atau password.

## Batasan yang perlu diketahui

- Ini source project Android, belum diuji build pada perangkat pengguna dan bukan APK siap instal.
- Kamera perlu izin Android dan browser WebView; penggunaan HTTPS sangat disarankan.
- Event native dikirim hanya saat halaman Capture terbuka; mode remote yang dipilih di UI tetap dihormati.
- Saat wrapper aktif, Volume UP/DOWN menjadi tombol shutter dan tidak mengubah volume perangkat.
