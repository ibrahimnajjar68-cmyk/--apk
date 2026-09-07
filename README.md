# .منصة تصميم المواقع

مشروع Web-to-App من **محول المواقع الذكي — المطور حمزة نجار**.

- الموقع: https://build-syria-genius.lovable.app/
- اسم الحزمة: `com.app.mnshts`
- الأذونات المفعّلة: INTERNET، ACCESS_NETWORK_STATE، ACCESS_WIFI_STATE، CAMERA، READ_EXTERNAL_STORAGE، WRITE_EXTERNAL_STORAGE، READ_MEDIA_IMAGES، READ_MEDIA_VIDEO، ACCESS_FINE_LOCATION، ACCESS_COARSE_LOCATION، RECORD_AUDIO، MODIFY_AUDIO_SETTINGS، VIBRATE، POST_NOTIFICATIONS، WAKE_LOCK، RECEIVE_BOOT_COMPLETED، REQUEST_IGNORE_BATTERY_OPTIMIZATIONS، READ_CALENDAR، WRITE_CALENDAR، USE_BIOMETRIC، USE_FINGERPRINT، SYSTEM_ALERT_WINDOW، GET_ACCOUNTS، FOREGROUND_SERVICE، FOREGROUND_SERVICE_MEDIA_PLAYBACK

## 🚀 الطريقة (١): APK تلقائياً عبر GitHub Actions

1. أنشئ مستودعاً جديداً **Public** على GitHub.
2. فك ضغط هذا الملف وارفع **محتوياته** (وليس ملف ZIP نفسه) عبر *Add file → Upload files* ثم *Commit*.
3. تبويب **Actions** يبدأ البناء تلقائياً (٣–٦ دقائق).
4. عند الانتهاء افتح **Releases** وحمّل `app.apk` وثبّته مباشرة على هاتفك.

## 🛠 الطريقة (٢): Android Studio

```bash
npm install
npx cap add android
npx cap sync android
node scripts/customize-android.mjs
```

ثم افتح مجلد `android` بـ Android Studio واضغط Run، أو:

```bash
cd android && ./gradlew assembleDebug
# الناتج: android/app/build/outputs/apk/debug/app-debug.apk
```

> كل الإعدادات (الاسم، الأيقونة، الألوان، الاتجاه، الأذونات) مطبّقة من `android-overrides/` و `appconfig.json` عبر `scripts/customize-android.mjs`.
