#!/usr/bin/env bash
# Rebuild the patched K12Online XAPK (frida-gadget + in-app overlay).
#
#   ./port/build.sh            # full rebuild into port/out/ + ../K12Online_2.2.2_hacked.xapk
#   ./port/build.sh --merge    # ... plus a single universal ../K12Online_2.2.2_hacked.apk
#
# Needs: apktool, JDK, Android build-tools (aapt2/d8/zipalign/apksigner), python3, curl, unzip.
set -euo pipefail

MERGE=0
for arg in "$@"; do
    case "$arg" in
        --merge) MERGE=1 ;;
        *) echo "unknown option: $arg (only --merge)" >&2; exit 1 ;;
    esac
done

HERE="$(cd "$(dirname "$0")" && pwd)"
SRC="$(cd "$HERE/.." && pwd)"
B="$SRC/.build"
OUT="$HERE/out"
GADGET_VERSION=17.24.3
APKEDITOR_VERSION=1.4.9
BT="${BUILD_TOOLS:-/opt/android-sdk/build-tools/37.0.0}"
ANDROID_JAR="${ANDROID_JAR:-/home/hien/android-sdk/platforms/android-36/android.jar}"
KS="$B/k12.keystore"
KS_PASS=k12port

mkdir -p "$B" "$OUT"

need() { command -v "$1" >/dev/null || { echo "missing: $1" >&2; exit 1; }; }
need apktool; need javac; need keytool; need python3; need unzip
for t in aapt2 d8 zipalign apksigner; do [ -x "$BT/$t" ] || { echo "missing $BT/$t" >&2; exit 1; }; done

# 1. frida-gadget (arm64) ------------------------------------------------------
if [ ! -f "$B/gadget.so" ]; then
    echo "== downloading frida-gadget $GADGET_VERSION"
    curl -fsSL -o "$B/gadget.zip" \
        "https://github.com/frida/frida/releases/download/$GADGET_VERSION/frida-gadget-$GADGET_VERSION-android-arm64.so.xz" || {
        echo "download failed; place the arm64 gadget at $B/gadget.so" >&2; exit 1; }
    unxz -c "$B/gadget.zip" > "$B/gadget.so"
fi

# 2. boot provider dex ---------------------------------------------------------
if [ ! -f "$B/dex/classes16.dex" ]; then
    echo "== building BootApplication"
    rm -rf "$B/classes"; mkdir -p "$B/classes" "$B/dex"
    javac --release 8 -classpath "$ANDROID_JAR" -d "$B/classes" "$HERE"/loader/k12/port/*.java
    "$BT/d8" --min-api 28 --lib "$ANDROID_JAR" --output "$B/dex" $(find "$B/classes" -name '*.class')
    mv "$B/dex/classes.dex" "$B/dex/classes16.dex"
fi

# 3. base APK: provider in manifest + extra dex --------------------------------
if [ ! -f "$B/base-unsigned.apk" ]; then
    echo "== decoding base APK"
    rm -rf "$B/decode"
    apktool d -f --no-src -o "$B/decode" "$SRC/vn.viettelstudy.k12.apk" >/dev/null

    python3 - "$B/decode/AndroidManifest.xml" <<'PY'
import sys
p = sys.argv[1]
s = open(p, encoding='utf-8').read()
# PairIP's Application only runs LicenseClient.checkLicense() (which refuses to
# run outside a Play install). BootApplication loads the gadget instead.
s = s.replace('android:name="com.pairip.application.Application"',
              'android:name="k12.port.BootApplication"')
# gadget only finds libgadget.config.so / libhook.so on a real filesystem
s = s.replace('android:extractNativeLibs="false"', 'android:extractNativeLibs="true"')
# This resource only exists in the density split, so apktool decodes it as
# @null and the framework then rejects the meta-data. 0 = fall back to app icon.
s = s.replace(
    'android:name="com.google.firebase.messaging.default_notification_icon" android:resource="@null"',
    'android:name="com.google.firebase.messaging.default_notification_icon" android:value="0"')
open(p, 'w', encoding='utf-8').write(s)
PY

    echo "== rebuilding base APK"
    apktool b -f -o "$B/base-unsigned.apk" "$B/decode" >/dev/null
fi

if ! python3 -c "import zipfile,sys; sys.exit('classes16.dex' not in zipfile.ZipFile('$B/base-unsigned.apk').namelist())"; then
    python3 - "$B/base-unsigned.apk" "$B/dex/classes16.dex" <<'PY'
import sys, zipfile
apk, dex = sys.argv[1], sys.argv[2]
with zipfile.ZipFile(apk, 'a') as z:
    z.write(dex, 'classes16.dex')
PY
fi

# 4. ABI split: gadget + config + agent ---------------------------------------
echo "== assembling arm64 split"
cp "$SRC/config.arm64_v8a.apk" "$B/abi-work.apk"
mkdir -p "$B/lib/arm64-v8a"
cp "$B/gadget.so" "$B/lib/arm64-v8a/libgadget.so"
printf '%s' '{"interaction":{"type":"script","path":"libhook.so","on_change":"reload"}}' > "$B/lib/arm64-v8a/libgadget.config.so"

# Frida 17 no longer bundles the Java bridge, so the agent has to be compiled.
if [ ! -d "$HERE/node_modules" ]; then
    echo "== installing agent build deps"
    (cd "$HERE" && npm i --no-audit --no-fund >/dev/null)
fi
{ echo "import Java from 'frida-java-bridge';"; cat "$HERE/agent/ui.js" "$HERE/agent/hook.js"; } > "$HERE/.agent-entry.js"
(cd "$HERE" && npx frida-compile .agent-entry.js -o "$B/lib/arm64-v8a/libhook.so") || {
    echo "frida-compile failed" >&2; exit 1; }

python3 - "$B/abi-work.apk" "$B/lib/arm64-v8a" <<'PY'
import os, sys, zipfile
apk, lib = sys.argv[1], sys.argv[2]
with zipfile.ZipFile(apk, 'a', zipfile.ZIP_STORED) as z:
    have = set(z.namelist())
    for name in ('libgadget.so', 'libgadget.config.so', 'libhook.so'):
        dst = 'lib/arm64-v8a/' + name
        if dst not in have:
            z.write(os.path.join(lib, name), dst)
PY

echo "== aligning"
"$BT/zipalign" -P 16 -f 4 "$B/base-unsigned.apk" "$B/base-aligned.apk" 2>/dev/null
"$BT/zipalign" -P 16 -f 4 "$B/abi-work.apk" "$B/abi-aligned.apk" 2>/dev/null
"$BT/zipalign" -c -P 16 -v 4 "$B/base-aligned.apk" >/dev/null
"$BT/zipalign" -c -P 16 -v 4 "$B/abi-aligned.apk" >/dev/null

# 5. sign ---------------------------------------------------------------------
[ -f "$KS" ] || keytool -genkeypair -keystore "$KS" -storetype PKCS12 -alias k12 \
    -keyalg RSA -keysize 2048 -validity 10000 -storepass "$KS_PASS" -keypass "$KS_PASS" \
    -dname "CN=K12 Port, O=Local, C=VN" >/dev/null 2>&1

SIGN=("$BT/apksigner" sign --ks "$KS" --ks-pass "pass:$KS_PASS" --key-pass "pass:$KS_PASS"
      --ks-key-alias k12 --min-sdk-version 28)

echo "== signing"
"${SIGN[@]}" --out "$OUT/vn.viettelstudy.k12.apk" "$B/base-aligned.apk"
"${SIGN[@]}" --out "$OUT/config.arm64_v8a.apk"   "$B/abi-aligned.apk"
"${SIGN[@]}" --out "$OUT/config.en.apk"          "$SRC/config.en.apk"
"${SIGN[@]}" --out "$OUT/config.xxhdpi.apk"      "$SRC/config.xxhdpi.apk"
for f in "$OUT"/*.apk; do "$BT/apksigner" verify --min-sdk-version 28 "$f" 2>/dev/null; done

# 6. package XAPK -------------------------------------------------------------
cp "$SRC/icon.png" "$OUT/icon.png"
python3 - "$SRC/manifest.json" "$OUT" "$SRC/K12Online_2.2.2_hacked.xapk" <<'PY'
import json, os, sys, zipfile
manifest, out, xapk = sys.argv[1], sys.argv[2], sys.argv[3]
files = [('vn.viettelstudy.k12.apk', 'base'), ('config.arm64_v8a.apk', 'config.arm64_v8a'),
         ('config.en.apk', 'config.en'), ('config.xxhdpi.apk', 'config.xxhdpi')]
m = json.load(open(manifest))
m['split_apks'] = [{'file': f, 'id': i} for f, i in files]
m['total_size'] = sum(os.path.getsize(os.path.join(out, f)) for f, _ in files)
json.dump(m, open(os.path.join(out, 'manifest.json'), 'w'), indent=2)
with zipfile.ZipFile(xapk, 'w', zipfile.ZIP_STORED) as z:
    for f, _ in files:
        z.write(os.path.join(out, f), f)
    z.write(os.path.join(out, 'icon.png'), 'icon.png')
    z.write(os.path.join(out, 'manifest.json'), 'manifest.json')
print('wrote', xapk, os.path.getsize(xapk))
PY

# 7. universal APK (--merge) ---------------------------------------------------
# APKEditor merges the split resources.arsc + manifest, so this is one installable
# APK with the same package/signature. arm64 only, like the XAPK.
if [ "$MERGE" = 1 ]; then
    echo "== merging universal APK"
    if [ ! -f "$B/APKEditor.jar" ]; then
        curl -fsSL -o "$B/APKEditor.jar" \
            "https://github.com/REAndroid/APKEditor/releases/download/V$APKEDITOR_VERSION/APKEditor-$APKEDITOR_VERSION.jar" || {
            echo "download failed; place APKEditor-$APKEDITOR_VERSION.jar at $B/APKEditor.jar" >&2; exit 1; }
    fi

    rm -rf "$B/merge-in"; mkdir -p "$B/merge-in"
    cp "$OUT"/vn.viettelstudy.k12.apk "$OUT"/config.*.apk "$B/merge-in/"
    java -jar "$B/APKEditor.jar" m -i "$B/merge-in" -o "$B/universal-raw.apk" -f >/dev/null

    "$BT/zipalign" -P 16 -f 4 "$B/universal-raw.apk" "$B/universal-aligned.apk" 2>/dev/null
    "${SIGN[@]}" --v4-signing-enabled false --out "$SRC/K12Online_2.2.2_hacked.apk" "$B/universal-aligned.apk"
    "$BT/apksigner" verify --min-sdk-version 28 "$SRC/K12Online_2.2.2_hacked.apk"
    echo "wrote $SRC/K12Online_2.2.2_hacked.apk"
fi

echo "done: $OUT and $SRC/K12Online_2.2.2_hacked.xapk"
