# .منصة تصميم المواقع

مشروع Web-to-App من **محول المواقع الذكي — المطور حمزة نجار**.

- الموقع: https://build-syria-genius.lovable.app/
- اسم الحزمة: `com.hamzanajjar.app`
- الأذونات المفعّلة: INTERNET، ACCESS_NETWORK_STATE، ACCESS_WIFI_STATE، CAMERA، READ_EXTERNAL_STORAGE، WRITE_EXTERNAL_STORAGE، READ_MEDIA_IMAGES، READ_MEDIA_VIDEO، VIBRATE، POST_NOTIFICATIONS، WAKE_LOCK، GET_ACCOUNTS

## 🚀 الطريقة (١): APK مجاني تلقائياً عبر GitHub Actions

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
