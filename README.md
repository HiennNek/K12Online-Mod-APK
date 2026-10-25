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
