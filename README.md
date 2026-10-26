<h1 align="center">K12Online Mod APK<br><small>Tìm đáp án bài kiểm tra K12Online trên app</small></h1>

<div align="center">
<img width="35%" alt="image" src="https://github.com/user-attachments/assets/31f7942f-882f-4c5b-a781-2f61fe2c9014" />
</div>

## Cách cài đặt
1. Xóa app K12Online gốc nếu đã cài
2. Tải APK mod từ [Release](https://github.com/HiennNek/K12Online-Mod-APK/releases/download/v2.2.2-6/K12Online-Mod-APK_2.2.2.apk)
3. Cài đặt file APK đã tải (sẽ tốn một lúc vì file là bundled apk được merge thành 1 file apk)

## Cách build dự án này (cho development)

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

> [!WARNING]
> K12Online Mod APK được tạo ra nhằm mục đích nghiên cứu, tìm hiểu và nâng cao ý thức về bảo mật. Không sử dụng K12Online Mod APK để gian lận trong thi cử, vi phạm nội quy nhà trường và pháp luật. Chỉ sử dụng K12Online Mod APK khi có sự cho phép của giáo viên ‌/ người ra bài kiểm tra hoặc người có thẩm quyền. Mọi hành vi vi phạm nội quy thi cử, nội quy nhà trường, quy định pháp luật cũng như gian lận trong thi cử hay sử dụng công cụ này trong bài kiểm tra mà không có sự đồng ý của giáo viên, người ra bài kiểm tra hoặc người có thẩm quyền đều do cá nhân, đơn vị sử dụng chịu trách nhiệm.
> 
> Mã nguồn của K12Online Mod APK được phân phối dưới giấy phép PolyForm Noncommercial 1.0.0 (Giấy phép phi thương mại PolyForm 1.0.0)
