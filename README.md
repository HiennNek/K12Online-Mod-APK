<h1 align="center">K12Online Mod APK<br><small>Tìm đáp án bài kiểm tra K12Online trên app</small></h1>

## Cách build dự án này

1. Clone repo
   ```bash
   git clone https://github.com/HiennNek/K12Online-Mod-APK.git
   ```

3. Tải và giải nén file APK K12Online (version 2.2.2) hoặc dùng download link này (giống với CI)

   ```bash
   curl -fL -o K12Online_2.2.2_APKPure.xapk \
     https://github.com/HiennNek/storage/releases/download/k/K12Online_2.2.2.xapk
   unzip K12Online_2.2.2_APKPure.xapk
   ```
   
4. Cài dependencies: `apktool`, JDK (11+), Android build-tools (`aapt2`,
   `d8`, `zipalign`, `apksigner`), `python3`, `npm`, `curl`, `unzip`, `unxz`.

5. Set path cho SDK: `build.sh` sẽ mặc định path là `/opt/android-sdk/build-tools/37.0.0` và `$HOME/android-sdk/platforms/android-36/android.jar`:

   ```bash
   export BUILD_TOOLS="$HOME/Android/Sdk/build-tools/36.0.0"
   export ANDROID_JAR="$HOME/Android/Sdk/platforms/android-36/android.jar"
   ```

6. Build:

   ```bash
   ./port/build.sh --merge
   ```

7. Sau khi build xong, nó sẽ ra 2 file: `K12Online_2.2.2_hacked.apk` (cài file này) và,
   `K12Online_2.2.2_hacked.xapk` (nếu bạn thích dùng dạng XAPK)
