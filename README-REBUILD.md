# KAHFI PHOTOBOOTH — Rebuild ZIP

Contains:
- `webapp/`: Next.js 14 web kiosk, frame library and custom frame upload, camera capture, save/export JPEG, settings, timer and Bluetooth HID/keyboard shutter support.
- `android-native/`: Android Studio Kotlin WebView shell, file chooser, volume-button shutter bridge, USB device diagnostics, native settings/Bluetooth menu, AUSBC UVC library dependency.

## Build native APK
Open `android-native/` in Android Studio and allow Gradle sync, then Build > Build APK(s). This package is source, not a prebuilt APK. The environment used to prepare this ZIP did not have Android SDK/Gradle available, so APK compilation and physical UVC webcam streaming have not been verified.

## Run web app
Open terminal in `webapp/`, run `npm install`, then `npm run dev`. In the Android app, configure the website URL to the computer's LAN IP (example `http://192.168.1.10:3000`) or deployed HTTPS URL, not `localhost`.

## USB UVC status
AUSBC 3.6.0 dependency and USB diagnostic UI are included. The diagnostic reports USB VID/PID and interface classes. USB enumeration and actual video streaming are separate tests; check `android-native/README-UVC.md` before testing. Start at 1080p MJPEG; 4K30 may not be available through every OTG/USB mode.
