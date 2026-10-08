# KAHFI PHOTOBOOTH — FINAL FRAME ENGINE

Next.js 14 + React + Tailwind CSS photobooth for Xiaomi Pad 6.

## Final frame system

Custom frames are stored **only on the device/browser** using IndexedDB. They are not uploaded to Vercel.

A custom frame is saved only after a one-time **6-slot calibration**:

1. Open **Lihat Frame**.
2. Choose **Tambah Frame** and upload PNG/JPG/WebP.
3. The app may suggest six areas automatically when the image has transparent/dark holes.
4. The **Frame Calibration** screen is the source of truth. Select Slot 1–6 and adjust X, Y, Width, Height.
5. Press **Simpan Frame**.
6. The six coordinates are saved with the frame in IndexedDB.

The app does **not** run hole detection again during a photo session. Therefore each frame can have completely different hole positions and sizes without changing the capture engine.

### Supported A6 output

- Portrait: **1240 × 1748 px** (A6 at 300 DPI)
- Landscape: **1748 × 1240 px** (A6 at 300 DPI)
- Exactly 6 fixed photo slots
- Photo 1 → Slot 1 ... Photo 6 → Slot 6

### Detection strategy

Automatic transparent/chroma/dark-area detection is only a **starting suggestion**. Manual calibration is always available and is the final authority. This avoids bad placements caused by decorations, shadows, irregular shapes, or different frame designs.

## Device storage behavior

- Refresh: frame remains
- Close/reopen browser: frame remains
- Logout/login: frame remains
- Restart tablet: frame remains
- Different browser/device: custom frame does not appear (intentional)
- Delete: use the trash button on a custom frame

## Hardware

- Xiaomi Pad 6
- USB/UVC external camera through supported OTG adapter
- Bluetooth shutter/remote recommended as a Bluetooth HID keyboard button (Space/Enter)
- Camera capture preview: 4:3
- 6 photos per session
- Timer: 1s / 3s / 5s

## Run

```bash
npm install
npm run dev
```

Open the local address shown by Next.js.

For Vercel, push this folder to Git and deploy as a Next.js project. The frame PNGs under `public/frames` are static built-in frames; custom frames remain local to the tablet browser.

## Important

Browser camera access requires HTTPS (Vercel provides HTTPS) or localhost during development. USB camera support depends on the Android/Chrome device and UVC/OTG hardware. Bluetooth HID remotes work through keyboard events such as Space/Enter; browser Web Bluetooth is not required for a HID shutter.

## Bluetooth remote shutter (Volume Up / Volume Down)

Di halaman **Mulai Foto**, bagian kanan terdapat pengaturan **Remote Shutter**:
- **Volume UP**: gunakan tombol volume atas pada remote.
- **Volume DOWN**: gunakan tombol volume bawah pada remote.
- **UP + DOWN aktif**: kedua tombol menjadi trigger.

Pilihan disimpan pada browser/perangkat yang sama. Saat tombol dikenali browser, status di layar berubah menjadi `Remote Volume UP/DOWN terdeteksi` dan jepretan dimulai memakai timer yang dipilih. SPACE/ENTER tetap didukung sebagai trigger keyboard.

**Penting untuk Android/Xiaomi Pad:** Android/Chrome terkadang menangani tombol volume di tingkat sistem untuk mengatur suara dan tidak meneruskan event tombol tersebut ke halaman web. Aplikasi web tidak bisa memaksa browser melewati batasan OS. Jika menekan remote hanya mengubah volume dan status di layar tidak berubah, coba pastikan remote terhubung sebagai Bluetooth keyboard/HID. Jika tetap tidak mengirim event ke browser, solusi yang benar-benar andal adalah menjalankan photobooth di wrapper Android native yang menangani tombol volume lalu meneruskannya ke web app.

## Android native remote shutter (Mi Pad 6)

Jika remote Bluetooth hanya mengubah volume dan Chrome tidak mengirim event tombol ke web, gunakan source wrapper Android pada folder `android-native/` di paket **KAHFI-PHOTOBOOTH-ANDROID-NATIVE-BRIDGE.zip**. Wrapper menangkap Volume UP/DOWN secara native lalu mengirim event `kahfi-native-shutter` ke halaman Capture. Lihat `README-ANDROID-NATIVE-BRIDGE-ID.md` pada root paket untuk petunjuk lengkap.
