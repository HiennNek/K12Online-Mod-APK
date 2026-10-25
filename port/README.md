# K12Online 2.2.2 — Android port of k12onlinehack.user.js

The app is native Flutter (Dart AOT), so a userscript has nothing to attach to.
This build runs [frida-gadget](https://frida.re) inside the app, reads the exam
payload off BoringSSL in `libflutter.so`, extracts the marked answers and shows
them in a floating panel over the app.

Tested on a Galaxy Tab (Android 16, arm64) against the live exam server.

## Install

```bash
# signature changed, so the old install has to go
adb uninstall vn.viettelstudy.k12
adb install-multiple -r port/out/vn.viettelstudy.k12.apk \
    port/out/config.arm64_v8a.apk port/out/config.en.apk port/out/config.xxhdpi.apk
```

Or install `K12Online_2.2.2_hacked.xapk` with any XAPK installer (APKPure app,
SAI, …). arm64 only — there is no armeabi-v7a or x86 split. Native libs are
extracted on install (`extractNativeLibs=true`), so allow ~700 MB free.

The panel is the userscript's own Material 3 UI, so it looks and behaves like the
browser version: drag it by the title bar, `–` minimizes, `✕` closes it (the K12
bubble in the bottom-right brings it back), `⋯` opens the hue wheel / light-dark
toggle and **Thu gọn** (compact answer key), and the text is selectable. Compact
mode drops the question text and shows only the number plus the answer — `2 D`
for a choice, `28 Đ S S Đ` for true/false — and is on by default on screens
narrower than 600 dp (phones). The only thing not ported is the menu's
**Replay request** tool, which needs a browser page to replay into.

The K12 bubble is drawn natively but uses the same `primary-container` /
`on-primary-container` roles as the panel, computed from the saved theme and
hue, so it always matches the panel's brand bubble.

The panel opens by itself as soon as an exam payload arrives, and the K12 bubble
is always there.

## What it prints

Each question lists its options with the key highlighted (`✓`), exactly like the
userscript. The app's own schema is:

- **Choice**: `point > 0` marks the key, `answerTitle` is the option text. The
  array order is the on-screen order, so options are labelled A, B, C, D;
  `answerCode` (and the `pos` array, which mirrors it) is the answer-sheet
  bubble and does **not** match the screen.
- **True/false**: `answerTitle: "true"/"false"` is the truth of each statement,
  `questionTitle` the statement text, labelled a, b, c, d in array order.
- **Essay / fill-in**: `answerText1..N` joined, or `answerText` when present.

## How it works

| Piece | File |
| --- | --- |
| Application stub, loads the gadget first | `loader/k12/port/BootApplication.java` → `classes16.dex` |
| Hook + parser + overlay host | `agent/hook.js`, bundled to `libhook.so` |
| Panel UI (HTML/CSS/JS) | `agent/ui.js`, rendered in a WebView |
| Gadget config | `{"interaction":{"type":"script","path":"libhook.so","on_change":"reload"}}` |

The stock `com.pairip.application.Application` does nothing but
`LicenseClient.checkLicense()` in `attachBaseContext`, which refuses to run
outside a Play install (the unmodified APK just shows "Something went wrong").
`BootApplication` replaces it, loads the gadget, and PairIP never runs.

`SSL_read` in `libflutter.so` is hooked and its output reassembled into HTTP/1.1
responses (content-length and chunked, gzip/deflate). Any body that looks like an
exam payload is parsed and rendered. Engine: Flutter 3.41.2 / Dart 3.11.0
(build id `fc84702ceb4ef3082433a3a76c506f6532c31c3b`); the offsets in
`agent/hook.js` come from that exact build.

The panel is a transparent WebView sized to the panel (the page reports its own
height, native resizes the view), with the native touch handler dragging it and
`prompt()` as the JS→native channel. The K12 bubble is a native `TextView` styled
like the script's FAB. The chosen theme and hue are saved in the app's
`SharedPreferences` (`k12port`) and restored on the next launch; the panel
position is not saved. Rotation is handled in place: the metrics are re-read on
`onConfigurationChanged`, so the panel can be dragged across the full landscape
width and the body height shrinks to fit.

Frida 17 dropped the built-in Java bridge, so `build.sh` prepends
`import Java from 'frida-java-bridge'` and runs `frida-compile`.

## Rebuild

```bash
./port/build.sh          # -> port/out/*.apk + K12Online_2.2.2_hacked.xapk
./port/build.sh --merge  # ... plus a single K12Online_2.2.2_hacked.apk (universal)
node port/test.js        # parser/reassembly self-check (no device needed)
```

`--merge` merges the four signed APKs into one installable APK with APKEditor
(merged `resources.arsc`, no `split` names, arm64 libs inside), so it can be
shared as a single file. It is arm64-only like the XAPK, and installing it over
a split install of the same package works (`adb install -r`) but leaves you on
the monolithic build.

`build.sh` needs `apktool`, a JDK, Android build-tools (`aapt2`, `d8`,
`zipalign`, `apksigner`), `python3`, `npm`, `unxz`. It installs the agent build
deps into `port/node_modules` on first run and caches the gadget, the provider
dex and the rebuilt base APK in `../.build/`; delete that directory for a clean
run. The signing key is `../.build/k12.keystore` (password `k12port`) — keep it,
or updates need another uninstall. `--merge` also caches `APKEditor.jar` there.

## Caveats

- The hook checks the `SSL_read` prologue before attaching and logs
  `unexpected libflutter build` (doing nothing) when the app ships a different
  engine, so a stale offset fails quietly instead of crashing.
- The panel appears only after an exam payload passes through `SSL_read`; the
  answer key is whatever the server sends, so it is empty if the teacher hid it.
- The panel follows the system light/dark setting, like the userscript does in a
  browser; the `⋯` menu can override it, and both the override and the hue wheel
  are remembered across restarts.
- `Java.registerClass` (FAB, drag, JS bridge) writes a temporary dex; the bridge
  defaults that cache to `/data/local/tmp`, which an app cannot write, so the
  agent points it at the app's own cache dir on the first `onResume`. Without
  that the FAB silently never appears (only `agent loaded` shows in logcat).
- The agent masks `FLAG_SECURE` out of every `Window` call, so the exam screens
  can be screenshotted/recorded (logcat prints `FLAG_SECURE stripped` once per
  call). Side effect: the exam is also visible in the recents thumbnail.
- Nothing is uploaded anywhere; everything runs in-process.
