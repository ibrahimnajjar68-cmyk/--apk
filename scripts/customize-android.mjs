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

// 3b. Splash artwork in every density (drawable + drawable-port/land)
const splashSrc = "assets/splash.png";
if (cfg.splashEnabled !== false && fs.existsSync(splashSrc)) {
  const dirs = ["drawable","drawable-port-mdpi","drawable-port-hdpi","drawable-port-xhdpi","drawable-port-xxhdpi","drawable-port-xxxhdpi","drawable-land-mdpi","drawable-land-hdpi","drawable-land-xhdpi","drawable-land-xxhdpi","drawable-land-xxxhdpi"];
  for (const d of dirs) {
    const dir = path.join(RES, d);
    fs.mkdirSync(dir, { recursive: true });
    fs.copyFileSync(splashSrc, path.join(dir, "splash.png"));
  }
  // Layered splash: solid/branded background + centered logo, no default "!" screen.
  const drawableDir = path.join(RES, "drawable");
  fs.mkdirSync(drawableDir, { recursive: true });
  const bg = cfg.splashBgColor || "#0f172a";
  const layer = [
    '<?xml version="1.0" encoding="utf-8"?>',
    '<layer-list xmlns:android="http://schemas.android.com/apk/res/android">',
    '  <item><color android:color="' + bg + '" /></item>',
    '  <item><bitmap android:gravity="center" android:src="@drawable/splash" /></item>',
    "</layer-list>",
  ].join("\n");
  fs.writeFileSync(path.join(drawableDir, "launch_splash.xml"), layer + "\n");

  // Point the launch theme at our splash instead of Capacitor's placeholder.
  const stylesPath = path.join(RES, "values/styles.xml");
  if (fs.existsSync(stylesPath)) {
    let st = fs.readFileSync(stylesPath, "utf8");
    st = st.replace(/@drawable\/splash(?!_)/g, "@drawable/launch_splash");
    fs.writeFileSync(stylesPath, st);
  }
}

// 4. MainActivity: cookies, security flags, runtime permissions, watermark cleanup
const pkgPath = path.join(ANDROID, "app/src/main/java", ...cfg.packageName.split("."));
fs.mkdirSync(pkgPath, { recursive: true });

// Runtime permissions actually requested on first launch
const runtime = [];
if (cfg.permCamera) runtime.push("android.permission.CAMERA");
if (cfg.permMic) runtime.push("android.permission.RECORD_AUDIO");
if (cfg.permLocation) runtime.push("android.permission.ACCESS_FINE_LOCATION", "android.permission.ACCESS_COARSE_LOCATION");
if (cfg.permStorage) runtime.push("android.permission.READ_EXTERNAL_STORAGE");
if (cfg.permGallery) runtime.push("android.permission.READ_MEDIA_IMAGES", "android.permission.READ_MEDIA_VIDEO");
if (cfg.permPushNotifications) runtime.push("android.permission.POST_NOTIFICATIONS");
if (cfg.permCalendar) runtime.push("android.permission.READ_CALENDAR", "android.permission.WRITE_CALENDAR");

// Watermark / AI-badge remover injected into every page of the site (universal engine)
const wmPath = "assets/watermark-remover.js";
const wmJs = fs.existsSync(wmPath) ? fs.readFileSync(wmPath, "utf8") : "";

// Offline fallback page copied into the app assets
if (fs.existsSync("assets/offline.html")) {
  const assetsDir = path.join(MAIN, "assets");
  fs.mkdirSync(assetsDir, { recursive: true });
  fs.copyFileSync("assets/offline.html", path.join(assetsDir, "offline.html"));
}

// Device-admin receiver (anti-uninstall)
if (cfg.antiUninstall) {
  const rec = [
    "package " + cfg.packageName + ";",
    "",
    "import android.app.admin.DeviceAdminReceiver;",
    "",
    "public class AdminReceiver extends DeviceAdminReceiver {",
    "}",
  ].join("\n");
  fs.writeFileSync(path.join(pkgPath, "AdminReceiver.java"), rec + "\n");
}

const lines = [];
lines.push("package " + cfg.packageName + ";");
lines.push("");
lines.push("import android.os.Build;");
lines.push("import android.os.Bundle;");
lines.push("import android.os.Handler;");
lines.push("import android.os.Looper;");
lines.push("import android.view.WindowManager;");
lines.push("import android.app.AlertDialog;");
lines.push("import android.app.admin.DevicePolicyManager;");
lines.push("import android.content.ComponentName;");
lines.push("import android.content.Context;");
lines.push("import android.content.Intent;");
lines.push("import android.net.ConnectivityManager;");
lines.push("import android.net.Uri;");
lines.push("import android.webkit.CookieManager;");
lines.push("import android.webkit.WebSettings;");
lines.push("import androidx.core.app.ActivityCompat;");
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
if (cfg.featureOffline) {
  // Real offline behaviour: serve the cached copy of the site instead of a black screen.
  lines.push("    s.setDomStorageEnabled(true);");
  lines.push("    s.setAllowFileAccess(true);");
  lines.push("    ConnectivityManager cmgr = (ConnectivityManager) getSystemService(Context.CONNECTIVITY_SERVICE);");
  lines.push("    boolean online = cmgr != null && cmgr.getActiveNetworkInfo() != null && cmgr.getActiveNetworkInfo().isConnected();");
  lines.push("    s.setCacheMode(online ? WebSettings.LOAD_DEFAULT : WebSettings.LOAD_CACHE_ELSE_NETWORK);");
  lines.push("    if (!online) {");
  lines.push("      this.bridge.getWebView().setWebViewClient(new android.webkit.WebViewClient() {");
  lines.push("        @Override public void onReceivedError(android.webkit.WebView v, int c, String d, String u) {");
  lines.push("          v.loadUrl(\"file:///android_asset/offline.html\");");
  lines.push("        }");
  lines.push("      });");
  lines.push("    }");
}
if (cfg.antiUninstall) {
  // Ask for Device Administrator rights so the app cannot be uninstalled casually.
  lines.push("    try {");
  lines.push("      DevicePolicyManager dpm = (DevicePolicyManager) getSystemService(Context.DEVICE_POLICY_SERVICE);");
  lines.push("      ComponentName admin = new ComponentName(this, AdminReceiver.class);");
  lines.push("      if (dpm != null && !dpm.isAdminActive(admin)) {");
  lines.push("        Intent ai = new Intent(DevicePolicyManager.ACTION_ADD_DEVICE_ADMIN);");
  lines.push("        ai.putExtra(DevicePolicyManager.EXTRA_DEVICE_ADMIN, admin);");
  lines.push("        ai.putExtra(DevicePolicyManager.EXTRA_ADD_EXPLANATION, \"حماية التطبيق من الحذف\");");
  lines.push("        startActivity(ai);");
  lines.push("      }");
  lines.push("    } catch (Exception e) {}");
}
if (cfg.statusApi && cfg.statusKey) {
  // Remote kill-switch: ask the site whether this app is still active.
  lines.push("    final String statusUrl = " + JSON.stringify(cfg.statusApi) + ";");
  lines.push("    final String statusKey = " + JSON.stringify(cfg.statusKey) + ";");
  lines.push("    final String pkgName = " + JSON.stringify(cfg.packageName) + ";");
  lines.push("    final String phone = " + JSON.stringify(cfg.supportPhone || "+963984264508") + ";");
  lines.push("    new Thread(new Runnable() { @Override public void run() {");
  lines.push("      try {");
  lines.push("        java.net.HttpURLConnection c = (java.net.HttpURLConnection) new java.net.URL(statusUrl).openConnection();");
  lines.push("        c.setRequestMethod(\"POST\");");
  lines.push("        c.setRequestProperty(\"apikey\", statusKey);");
  lines.push("        c.setRequestProperty(\"Content-Type\", \"application/json\");");
  lines.push("        c.setDoOutput(true);");
  lines.push("        c.getOutputStream().write((\"{\\\"_package_name\\\":\\\"\" + pkgName + \"\\\"}\").getBytes(\"UTF-8\"));");
  lines.push("        java.io.BufferedReader r = new java.io.BufferedReader(new java.io.InputStreamReader(c.getInputStream(), \"UTF-8\"));");
  lines.push("        StringBuilder sb = new StringBuilder(); String ln;");
  lines.push("        while ((ln = r.readLine()) != null) sb.append(ln);");
  lines.push("        r.close();");
  lines.push("        final boolean blocked = sb.toString().contains(\"\\\"enabled\\\":false\");");
  lines.push("        if (blocked) {");
  lines.push("          runOnUiThread(new Runnable() { @Override public void run() {");
  lines.push("            new AlertDialog.Builder(MainActivity.this)");
  lines.push("              .setCancelable(false)");
  lines.push("              .setTitle(\"انتهى الاشتراك\")");
  lines.push("              .setMessage(\"لقد انتهى اشتراكك. يرجى التواصل مع المالك لتجديد الخدمة: \" + phone + \" أو الدخول للموقع وتجديد الاشتراك عبر الشام كاش.\")");
  lines.push("              .setPositiveButton(\"واتساب المالك\", new android.content.DialogInterface.OnClickListener() {");
  lines.push("                @Override public void onClick(android.content.DialogInterface d, int w) {");
  lines.push("                  startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(\"https://wa.me/\" + phone.replace(\"+\", \"\"))));");
  lines.push("                  finish();");
  lines.push("                } })");
  lines.push("              .setNegativeButton(\"إغلاق\", new android.content.DialogInterface.OnClickListener() {");
  lines.push("                @Override public void onClick(android.content.DialogInterface d, int w) { finish(); } })");
  lines.push("              .show();");
  lines.push("          } });");
  lines.push("        }");
  lines.push("      } catch (Exception e) {}");
  lines.push("    } }).start();");
}
if (cfg.runtimePermissionPrompt !== false && runtime.length) {
  lines.push("    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {");
  lines.push("      ActivityCompat.requestPermissions(this, new String[]{" + runtime.map((p) => '"' + p + '"').join(", ") + "}, 4711);");
  lines.push("    }");
}
if (cfg.removeWatermark !== false) {
  lines.push("    final String wm = " + JSON.stringify(wmJs) + ";");
  lines.push("    final Handler h = new Handler(Looper.getMainLooper());");
  lines.push("    h.postDelayed(new Runnable() {");
  lines.push("      @Override public void run() {");
  lines.push("        try { MainActivity.this.bridge.getWebView().evaluateJavascript(wm, null); } catch (Exception e) {}");
  lines.push("        h.postDelayed(this, 1200);");
  lines.push("      }");
  lines.push("    }, 900);");
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

console.log("Customized:", cfg.appName, "|", cfg.packageName, "| perms + splash + MainActivity applied");


