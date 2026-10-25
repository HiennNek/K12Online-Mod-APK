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

Prefer to build locally? Skip steps 1–6: extract the original XAPK into the repo
root (see below) and run `./port/build.sh --merge`.

## Not in this repo

Ignored on purpose — copyrighted, huge, or secret:

- `vn.viettelstudy.k12.apk`, `config.arm64_v8a.apk`, `config.en.apk`,
  `config.xxhdpi.apk`, `icon.png`, `manifest.json` — the original XAPK, ~500 MB
- `K12Online_2.2.2_hacked.xapk` / `K12Online_2.2.2_hacked.apk` — built output
- `.build/` — decoded APK, intermediates and the signing key
- `port/node_modules/`

To build, extract the original `K12Online_2.2.2_APKPure.xapk` into the repo
root, then:

```bash
unzip K12Online_2.2.2_APKPure.xapk
./port/build.sh           # XAPK + split APKs
./port/build.sh --merge   # ... plus one universal APK
```
