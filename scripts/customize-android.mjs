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

console.log("Customized:", cfg.appName, "|", cfg.packageName, "| perms applied from android-overrides/AndroidManifest.xml");
