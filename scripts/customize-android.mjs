// Applies appconfig.json + android-overrides/ onto the generated android/ project.
// Runs locally (npm run android:prepare) and inside GitHub Actions.
import fs from "node:fs";
import path from "node:path";

const cfg = JSON.parse(fs.readFileSync("appconfig.json", "utf8"));
const ANDROID = "android";
const MAIN = path.join(ANDROID, "app/src/main");
const RES = path.join(MAIN, "res");

if (!fs.existsSync(MAIN)) {
  console.error("android/ not found — run: npx cap add android");
  process.exit(1);
}

function copyRecursive(src, dest) {
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      fs.mkdirSync(d, { recursive: true });
      copyRecursive(s, d);
    } else {
      fs.mkdirSync(path.dirname(d), { recursive: true });
      fs.copyFileSync(s, d);
    }
  }
}

// 1. Manifest + res overrides (permissions, orientation, colors, strings)
const OV = "android-overrides";
if (fs.existsSync(path.join(OV, "AndroidManifest.xml"))) {
  fs.copyFileSync(path.join(OV, "AndroidManifest.xml"), path.join(MAIN, "AndroidManifest.xml"));
}
if (fs.existsSync(path.join(OV, "res"))) copyRecursive(path.join(OV, "res"), RES);

// 2. Version code/name
const gradlePath = path.join(ANDROID, "app/build.gradle");
if (fs.existsSync(gradlePath)) {
  let g = fs.readFileSync(gradlePath, "utf8");
  g = g.replace(/versionCode \d+/, `versionCode ${cfg.versionCode || 1}`);
  g = g.replace(/versionName "[^"]*"/, `versionName "${cfg.versionName || "1.0"}"`);
  fs.writeFileSync(gradlePath, g);
}

// 3. Launcher icon in every density
const iconSrc = "assets/icon.png";
if (fs.existsSync(iconSrc)) {
  for (const d of ["mipmap-mdpi","mipmap-hdpi","mipmap-xhdpi","mipmap-xxhdpi","mipmap-xxxhdpi"]) {
    const dir = path.join(RES, d);
    fs.mkdirSync(dir, { recursive: true });
    for (const f of ["ic_launcher.png","ic_launcher_round.png","ic_launcher_foreground.png"]) {
      fs.copyFileSync(iconSrc, path.join(dir, f));
    }
  }
  // remove adaptive-icon XMLs that would override the PNG
  for (const d of ["mipmap-anydpi-v26"]) {
    const dir = path.join(RES, d);
    if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
  }
}

// 4. Splash screen — force the EXACT designed splash (no default white/exclamation screen)
const splashSrc = fs.existsSync("assets/splash.png")
  ? "assets/splash.png"
  : (fs.existsSync("assets/icon.png") ? "assets/icon.png" : null);
const splashDirs = ["drawable","drawable-port-mdpi","drawable-port-hdpi","drawable-port-xhdpi","drawable-port-xxhdpi","drawable-port-xxxhdpi","drawable-land-mdpi","drawable-land-hdpi","drawable-land-xhdpi","drawable-land-xxhdpi","drawable-land-xxxhdpi"];
for (const d of splashDirs) {
  const dir = path.join(RES, d);
  if (fs.existsSync(dir)) {
    for (const f of ["splash.xml"]) {
      const p2 = path.join(dir, f);
      if (fs.existsSync(p2)) fs.rmSync(p2, { force: true });
    }
  }
  if (splashSrc) {
    fs.mkdirSync(dir, { recursive: true });
    fs.copyFileSync(splashSrc, path.join(dir, "splash.png"));
  }
}
const drawableDir = path.join(RES, "drawable");
fs.mkdirSync(drawableDir, { recursive: true });
const layers = [
  '<?xml version="1.0" encoding="utf-8"?>',
  '<layer-list xmlns:android="http://schemas.android.com/apk/res/android">',
  '  <item android:drawable="@color/splash_background" />',
];
if (splashSrc) layers.push('  <item><bitmap android:gravity="center" android:src="@drawable/splash" /></item>');
layers.push('</layer-list>');
fs.writeFileSync(path.join(drawableDir, "splash_bg.xml"), layers.join("\n"));

const valuesDir = path.join(RES, "values");
fs.mkdirSync(valuesDir, { recursive: true });
fs.writeFileSync(path.join(valuesDir, "styles.xml"), [
  '<?xml version="1.0" encoding="utf-8"?>',
  '<resources>',
  '  <style name="AppTheme" parent="Theme.AppCompat.DayNight.NoActionBar" />',
  '  <style name="AppTheme.NoActionBar" parent="Theme.AppCompat.DayNight.NoActionBar">',
  '    <item name="windowActionBar">false</item>',
  '    <item name="windowNoTitle">true</item>',
  '  </style>',
  '  <style name="AppTheme.NoActionBarLaunch" parent="AppTheme.NoActionBar">',
  '    <item name="android:background">@drawable/splash_bg</item>',
  '    <item name="android:windowBackground">@drawable/splash_bg</item>',
  '  </style>',
  '</resources>',
].join("\n"));

// 5. MainActivity: cookies, runtime permissions, watermark cleanup, security flags
const pkgPath = path.join(ANDROID, "app/src/main/java", ...cfg.packageName.split("."));
fs.mkdirSync(pkgPath, { recursive: true });

const runtimePerms = [];
if (cfg.permCamera) runtimePerms.push("android.permission.CAMERA");
if (cfg.permMic) runtimePerms.push("android.permission.RECORD_AUDIO");
if (cfg.permLocation) runtimePerms.push("android.permission.ACCESS_FINE_LOCATION");
if (cfg.permStorage) runtimePerms.push("android.permission.READ_EXTERNAL_STORAGE");
if (cfg.permGallery) runtimePerms.push("android.permission.READ_MEDIA_IMAGES");
if (cfg.permPushNotifications) runtimePerms.push("android.permission.POST_NOTIFICATIONS");
if (cfg.permCalendar) runtimePerms.push("android.permission.READ_CALENDAR");

const WM_SELECTORS = [
  '#lovable-badge','[id*="lovable"]','[class*="lovable"]','a[href*="lovable.dev"]','a[href*="lovable.app"]',
  '#WIX_ADS','[id*="WIX_ADS"]','a[href*="wix.com/website-builder"]','a[href*="wixsite"]',
  '#wpadminbar','.wp-block-site-credit','a[href*="wordpress.org"]','a[href*="wordpress.com"]',
  '[class*="poweredBy"]','[class*="powered-by"]','[id*="powered-by"]','[class*="madewith"]','[class*="made-with"]','[class*="built-with"]',
  'a[href*="bubble.io"]','[class*="bubble-badge"]','.w-webflow-badge','a[href*="webflow.com"]',
  '#carrd-badge','a[href*="carrd.co"]','#framer-badge','a[href*="framer.com"]',
  '[class*="ai-badge"]','[class*="watermark"]','[id*="watermark"]','[class*="branding-badge"]',
].join(",");

const wmJs =
  "(function(){var S=" + JSON.stringify(WM_SELECTORS) + ";" +
  "var s=document.getElementById('__wmk');" +
  "if(!s){s=document.createElement('style');s.id='__wmk';(document.head||document.documentElement).appendChild(s);}" +
  "s.textContent=S+'{display:none!important;visibility:hidden!important;opacity:0!important;pointer-events:none!important;height:0!important;width:0!important;}';" +
  "try{document.querySelectorAll(S).forEach(function(e){e.remove();});}catch(e){}})();";

const lines = [];
lines.push("package " + cfg.packageName + ";");
lines.push("");
lines.push("import android.os.Bundle;");
lines.push("import android.view.WindowManager;");
lines.push("import android.webkit.CookieManager;");
lines.push("import android.webkit.WebSettings;");
lines.push("import android.webkit.WebView;");
lines.push("import com.getcapacitor.BridgeActivity;");
lines.push("");
lines.push("public class MainActivity extends BridgeActivity {");
lines.push("  @Override");
lines.push("  public void onCreate(Bundle savedInstanceState) {");
lines.push("    super.onCreate(savedInstanceState);");
if (cfg.blockScreenshots) {
  lines.push("    getWindow().setFlags(WindowManager.LayoutParams.FLAG_SECURE, WindowManager.LayoutParams.FLAG_SECURE);");
}
if (cfg.keepSession !== false) {
  lines.push("    CookieManager cm = CookieManager.getInstance();");
  lines.push("    cm.setAcceptCookie(true);");
  lines.push("    cm.setAcceptThirdPartyCookies(this.bridge.getWebView(), true);");
  lines.push("    cm.flush();");
}
lines.push("    WebSettings s = this.bridge.getWebView().getSettings();");
lines.push("    s.setDomStorageEnabled(true);");
lines.push("    s.setDatabaseEnabled(true);");
lines.push("    s.setJavaScriptCanOpenWindowsAutomatically(true);");
lines.push("    s.setSupportMultipleWindows(false);");
lines.push("    s.setBuiltInZoomControls(" + (cfg.pinchZoom ? "true" : "false") + ");");
lines.push("    s.setDisplayZoomControls(false);");
lines.push("    s.setTextZoom(" + Math.round(cfg.fontScale || 100) + ");");
lines.push("    s.setMediaPlaybackRequiresUserGesture(false);");
lines.push("    s.setCacheMode(" + (cfg.disableCache ? "WebSettings.LOAD_NO_CACHE" : "WebSettings.LOAD_DEFAULT") + ");");

if (runtimePerms.length) {
  lines.push("    java.util.List<String> need = new java.util.ArrayList<String>();");
  lines.push("    String[] wanted = new String[]{" + runtimePerms.map(function (p) { return JSON.stringify(p); }).join(", ") + "};");
  lines.push("    for (String p : wanted) {");
  lines.push("      if (p.equals(\"android.permission.POST_NOTIFICATIONS\") && android.os.Build.VERSION.SDK_INT < 33) continue;");
  lines.push("      if (p.equals(\"android.permission.READ_MEDIA_IMAGES\") && android.os.Build.VERSION.SDK_INT < 33) continue;");
  lines.push("      if (p.equals(\"android.permission.READ_EXTERNAL_STORAGE\") && android.os.Build.VERSION.SDK_INT >= 33) continue;");
  lines.push("      if (androidx.core.content.ContextCompat.checkSelfPermission(this, p) != android.content.pm.PackageManager.PERMISSION_GRANTED) need.add(p);");
  lines.push("    }");
  lines.push("    if (!need.isEmpty()) androidx.core.app.ActivityCompat.requestPermissions(this, need.toArray(new String[0]), 1001);");
}

if (cfg.removeWatermark !== false) {
  lines.push("    final WebView wv = this.bridge.getWebView();");
  lines.push("    final String wmJs = " + JSON.stringify(wmJs) + ";");
  lines.push("    final android.os.Handler h = new android.os.Handler(android.os.Looper.getMainLooper());");
  lines.push("    h.postDelayed(new Runnable() { public void run() { try { wv.evaluateJavascript(wmJs, null); } catch (Exception e) {} h.postDelayed(this, 1500); } }, 900);");
}

lines.push("  }");
lines.push("");
lines.push("  @Override");
lines.push("  public void onPause() {");
lines.push("    super.onPause();");
lines.push("    CookieManager.getInstance().flush();");
lines.push("  }");
lines.push("}");
fs.writeFileSync(path.join(pkgPath, "MainActivity.java"), lines.join("\n") + "\n");

console.log("Customized:", cfg.appName, "|", cfg.packageName, "| splash + runtime perms + watermark cleanup applied");


