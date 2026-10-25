# K12Online 2.2.2 — patched Android build

The K12Online app (`vn.viettelstudy.k12`) with [frida-gadget](https://frida.re)
inside and an in-app answer panel ported from the `k12onlinehack.user.js`
userscript. The app is native Flutter, so the userscript is reimplemented as a
Frida agent that reads the exam payload off BoringSSL and renders the answers in
a Material 3 overlay.

Details, install steps and caveats: **[port/README.md](port/README.md)**.

## Layout

```
port/agent/       Frida agent: TLS capture, payload parser, panel WebView, FAB
port/loader/      BootApplication that loads the gadget instead of PairIP
port/build.sh     rebuild + sign the APKs, XAPK, and (--merge) a universal APK
port/test.js      parser/reassembly self-check, no device needed
port/out/         build output (ignored)
.build/           cache, keystore (ignored)
```

## Build it from your own fork

The code, the agent and the CI are all in the repo. You only supply the original
app and a signing key.

1. **Fork and clone.** Actions must run in *your* repo, not in a PR:

   ```bash
   git clone https://github.com/<you>/K12Online-Mod-APK.git
   cd K12Online-Mod-APK
   ```

2. **Enable Actions.** Open the **Actions** tab in your fork and click
   *I understand my workflows, go ahead and enable them* — forks start with
   workflows disabled.

3. **Make a signing key.** This is your app identity: Android only installs an
   update over a build signed with the same key, so keep the file.

   ```bash
   keytool -genkeypair -keystore k12.keystore -storetype PKCS12 -alias k12 \
       -keyalg RSA -keysize 2048 -validity 10000 \
       -storepass k12port -keypass k12port \
       -dname "CN=K12 Port, O=Local, C=VN"
   ```

   `port/build.sh` signs with the password `k12port`; change `KS_PASS` there if
   you want a different one.

4. **Add the key as a secret.** Base64 it and paste the output into
   *Settings → Secrets and variables → Actions → New repository secret*:

   ```bash
   base64 -w0 k12.keystore          # macOS: base64 -i k12.keystore
   ```

   Name: `KEYSTORE_B64`. Never commit the keystore itself.

5. **Check the original XAPK source.** `.github/workflows/build.yml` downloads it
   from a release asset:

   ```yaml
   XAPK_URL: https://github.com/HiennNek/storage/releases/download/k/K12Online_2.2.2.xapk
   ```

   That URL is public and works from a fork unchanged. To use your own copy,
   attach the XAPK to a release in any repo and edit that one line.

6. **Run it.** *Actions → build → Run workflow*. Leave the tag blank for
   `v2.2.2-<run number>`, or type your own. In ~15 minutes the run publishes a
   release containing `K12Online-Mod-APK_2.2.2.apk` (and keeps it as an artifact
   for 7 days).

7. **Install.** The released APK is universal (arm64, no splits):

   ```bash
   adb install -r K12Online-Mod-APK_2.2.2.apk
   ```

   If the device has the official app, or a build signed with a different key,
   uninstall first — `adb uninstall vn.viettelstudy.k12` — which also wipes the
   app's data and login.

## Build locally (no GitHub Actions)

Same output, built and signed on your machine. Needs ~4 GB of disk.

1. **Clone** your fork (or this repo).

2. **Get the original XAPK** — `K12Online_2.2.2_APKPure.xapk` from APKPure, or
   the copy CI uses:

   ```bash
   curl -fL -o K12Online_2.2.2_APKPure.xapk \
     https://github.com/HiennNek/storage/releases/download/k/K12Online_2.2.2.xapk
   unzip K12Online_2.2.2_APKPure.xapk
   ```

   That leaves the four splits plus `icon.png` and `manifest.json` in the repo
   root, which is where `build.sh` looks for them.

3. **Install the tools:** `apktool`, a JDK (11+), Android build-tools (`aapt2`,
   `d8`, `zipalign`, `apksigner`), `python3`, `npm`, `curl`, `unzip`, `unxz`.

4. **Point it at your SDK** if it isn't in the default place — `build.sh`
   defaults to `/opt/android-sdk/build-tools/37.0.0` and
   `$HOME/android-sdk/platforms/android-36/android.jar`:

   ```bash
   export BUILD_TOOLS="$HOME/Android/Sdk/build-tools/36.0.0"
   export ANDROID_JAR="$HOME/Android/Sdk/platforms/android-36/android.jar"
   ```

5. **Build:**

   ```bash
   ./port/build.sh --merge
   ```

   The first run generates a signing key at `.build/k12.keystore` (password
   `k12port`), downloads frida-gadget and APKEditor, and builds the agent with
   `npm`. Later runs reuse `.build/`; delete it for a clean build.

6. **Collect:** `K12Online_2.2.2_hacked.apk` (universal — install this one),
   `K12Online_2.2.2_hacked.xapk` and `port/out/*.apk` (split install).

7. **Install:** `adb install -r K12Online_2.2.2_hacked.apk`. Without `--merge`
   you only get the XAPK/splits, which need `adb install-multiple` or an XAPK
   installer.

Keep `.build/k12.keystore` — later builds must use the same key or the device
needs an uninstall. `.build/` is gitignored, so back it up yourself.
Optional: `node port/test.js` checks the payload parser without a device.

## Not in this repo

Ignored on purpose — copyrighted, huge, or secret:

- `vn.viettelstudy.k12.apk`, `config.arm64_v8a.apk`, `config.en.apk`,
  `config.xxhdpi.apk`, `icon.png`, `manifest.json` — the original XAPK, ~500 MB
- `K12Online_2.2.2_hacked.xapk` / `K12Online_2.2.2_hacked.apk` — built output
- `.build/` — decoded APK, intermediates and the signing key
- `port/node_modules/`
