# Unishop Android app (Play Store)

The app is a Trusted Web Activity: a thin Android shell that opens https://unishopit.com full screen. Website changes
reach the app immediately, with no store update. Only change the shell (icon, name, colours, package settings) by
rebuilding. Package id `com.unishopit.twa` cannot change once it is on Google Play.

Files in `public/downloads/`: `unishop.aab` goes to Google Play, `unishop.apk` is the direct download for the
download page. Both are signed with the upload key (SHA-256 `E4:E1:54:D5:...:A2:28`).

## Rebuild after changing the shell

1. Install JDK 17 and the Android SDK (build-tools 36.1.0, platform android-36) and `npm i -g @bubblewrap/cli`.
2. Put the upload keystore next to `twa-manifest.json` as `unishop-upload.keystore` (alias `unishop`). It is never
   committed. Keep it and its password somewhere safe.
3. Raise `appVersionCode` (and `appVersionName`) in `twa-manifest.json`. Play rejects a version code it has seen.
4. `BUBBLEWRAP_KEYSTORE_PASSWORD=... BUBBLEWRAP_KEY_PASSWORD=... bubblewrap update && bubblewrap build --skipPwaValidation`
5. Copy `app-release-bundle.aab` and `app-release-signed.apk` to `public/downloads/` as `unishop.aab` and `unishop.apk`.

## Digital Asset Links

`public/.well-known/assetlinks.json` must list the SHA-256 of every key that signs an installed copy of the app. Once
Google Play App Signing is on, Play re-signs the app: copy the "App signing key certificate" SHA-256 from Play Console
(Setup, App signing) into the same `sha256_cert_fingerprints` list, next to the upload key. Without it, the Play
version shows a browser address bar instead of opening full screen.

## iOS

A TWA is Android only. The App Store needs a separate iOS build on a Mac with Xcode and an Apple Developer account.
