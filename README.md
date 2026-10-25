<h1 align="center">K12Online Mod APK<br><small>Tìm đáp án bài kiểm tra K12Online</small></h1>

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
