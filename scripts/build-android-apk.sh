#!/usr/bin/env bash
set -euo pipefail

# Build a sideloadable, signed Android TWA APK wrapping https://cdn.mikeodnis.dev/upload
# Supports Android Share Sheet (Web Share Target) + Digital Asset Links (full-screen, no URL bar).
# Prerequisites: JDK 17 or 21, Android SDK ($ANDROID_HOME with build-tools + platforms/android-36), Bun.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
OUT_DIR="${1:-${REPO_ROOT}/android-twa}"
MANIFEST_URL="${MANIFEST_URL:-https://cdn.mikeodnis.dev/manifest.webmanifest}"
PACKAGE_ID="${PACKAGE_ID:-dev.mikeodnis.cdn}"
KEY_DIR="${HOME}/.config/mike-cdn"
KEYSTORE_PATH="${KEYSTORE_PATH:-${KEY_DIR}/android-upload.keystore}"
KEY_ENV_PATH="${KEY_DIR}/keystore.env"
KEY_ALIAS="${KEY_ALIAS:-mike-cdn-upload}"

# Resolve JAVA_HOME (prefer JDK 17/21 on Arch Linux or existing JAVA_HOME)
if [ -z "${JAVA_HOME:-}" ]; then
  if [ -d /usr/lib/jvm/java-21-openjdk ]; then
    export JAVA_HOME="/usr/lib/jvm/java-21-openjdk"
  elif [ -d /usr/lib/jvm/java-17-openjdk ]; then
    export JAVA_HOME="/usr/lib/jvm/java-17-openjdk"
  elif [ -d /usr/lib/jvm/default ]; then
    export JAVA_HOME="/usr/lib/jvm/default"
  fi
fi

# Resolve ANDROID_HOME
if [ -z "${ANDROID_HOME:-}" ]; then
  if [ -d "${HOME}/Android/Sdk" ]; then
    export ANDROID_HOME="${HOME}/Android/Sdk"
  fi
fi

if [ -z "${ANDROID_HOME:-}" ] || [ ! -d "${ANDROID_HOME}" ]; then
  echo "ERROR: ANDROID_HOME not found. Set ANDROID_HOME to your Android SDK directory." >&2
  exit 1
fi

BUILD_TOOLS_DIR="$(find "${ANDROID_HOME}/build-tools" -mindepth 1 -maxdepth 1 -type d | sort -V | grep -v rc | tail -n 1 || true)"
if [ -z "${BUILD_TOOLS_DIR}" ]; then
  BUILD_TOOLS_DIR="$(find "${ANDROID_HOME}/build-tools" -mindepth 1 -maxdepth 1 -type d | sort -V | tail -n 1)"
fi

echo "==> Mike CDN Android TWA APK Builder"
echo "    JAVA_HOME:    ${JAVA_HOME:-$(which java)}"
echo "    ANDROID_HOME: ${ANDROID_HOME}"
echo "    BUILD_TOOLS:  ${BUILD_TOOLS_DIR}"
echo "    OUT_DIR:      ${OUT_DIR}"

# 1. Create or reuse a persistent local signing keystore (never committed to git)
mkdir -p "${KEY_DIR}"
chmod 700 "${KEY_DIR}"

if [ ! -f "${KEYSTORE_PATH}" ] || [ ! -f "${KEY_ENV_PATH}" ]; then
  echo "==> Generating persistent Android release keystore in ${KEYSTORE_PATH}..."
  GEN_PASS="$(openssl rand -base64 24 | tr -dc 'A-Za-z0-9' | head -c 24)"
  umask 077
  printf 'KEYSTORE_PASS=%q\nKEY_PASS=%q\n' "${GEN_PASS}" "${GEN_PASS}" > "${KEY_ENV_PATH}"
  chmod 600 "${KEY_ENV_PATH}"
  rm -f "${KEYSTORE_PATH}"
  "${JAVA_HOME}/bin/keytool" -genkeypair -v \
    -keystore "${KEYSTORE_PATH}" \
    -storetype PKCS12 \
    -alias "${KEY_ALIAS}" \
    -keyalg RSA \
    -keysize 2048 \
    -validity 10000 \
    -storepass "${GEN_PASS}" \
    -keypass "${GEN_PASS}" \
    -dname "CN=Mike Odnis, OU=Engineering, O=Mike Odnis, L=New York, S=NY, C=US" >/dev/null 2>&1
  chmod 600 "${KEYSTORE_PATH}"
fi

# shellcheck disable=SC1090
source "${KEY_ENV_PATH}"

SHA256_FP="$("${JAVA_HOME}/bin/keytool" -list -v \
  -keystore "${KEYSTORE_PATH}" \
  -alias "${KEY_ALIAS}" \
  -storepass "${KEYSTORE_PASS}" \
  | awk '/SHA256:/ {print $2; exit}')"

if [ -z "${SHA256_FP}" ]; then
  echo "ERROR: Failed to read SHA-256 fingerprint from ${KEYSTORE_PATH}" >&2
  exit 1
fi
echo "==> Signing key SHA-256: ${SHA256_FP}"

# 2. Generate TWA Gradle project via @bubblewrap/core (non-interactive, JDK 21 compatible)
mkdir -p "${OUT_DIR}/.builder"
if [ ! -d "${OUT_DIR}/.builder/node_modules/@bubblewrap/core" ]; then
  echo "==> Installing @bubblewrap/core into ${OUT_DIR}/.builder..."
  (cd "${OUT_DIR}/.builder" && bun init -y >/dev/null 2>&1 || true)
  (cd "${OUT_DIR}/.builder" && bun add @bubblewrap/core >/dev/null)
fi

cat > "${OUT_DIR}/.builder/generate.mjs" <<'EOF'
import fs from 'node:fs/promises';
import path from 'node:path';
import { TwaGenerator, TwaManifest, ConsoleLog } from '@bubblewrap/core';

const outDir = process.env.OUT_DIR;
const manifestUrl = process.env.MANIFEST_URL;
const packageId = process.env.PACKAGE_ID;
const keystorePath = process.env.KEYSTORE_PATH;
const keyAlias = process.env.KEY_ALIAS;
const sha256 = process.env.SHA256_FP;

const log = new ConsoleLog('twa-gen');
const manifest = await TwaManifest.fromWebManifest(manifestUrl);

manifest.packageId = packageId;
manifest.name = 'Mike CDN — Upload Studio';
manifest.launcherName = 'Mike CDN';
manifest.startUrl = '/upload';
manifest.host = 'cdn.mikeodnis.dev';
manifest.iconUrl = 'https://cdn.mikeodnis.dev/icon-512.png';
manifest.maskableIconUrl = 'https://cdn.mikeodnis.dev/icon-512.png';
manifest.themeColor = manifest.themeColor;
manifest.themeColorDark = manifest.themeColor;
manifest.navigationColor = manifest.backgroundColor;
manifest.navigationColorDark = manifest.backgroundColor;
manifest.navigationDividerColor = manifest.backgroundColor;
manifest.navigationDividerColorDark = manifest.backgroundColor;
manifest.fallbackType = 'customtabs';
manifest.enableNotifications = false;
manifest.enableSiteSettingsShortcut = true;
manifest.minSdkVersion = 24;
manifest.appVersionCode = 1;
manifest.appVersionName = '1.0.0';
manifest.signingKey = { path: keystorePath, alias: keyAlias };
manifest.fingerprints = [{ name: 'Mike CDN Release', value: sha256 }];

const validationError = manifest.validate();
if (validationError) {
  throw new Error(`Invalid TWA manifest: ${validationError}`);
}

const projectDir = path.join(outDir, 'project');
await fs.rm(projectDir, { recursive: true, force: true });
await fs.mkdir(projectDir, { recursive: true });

await manifest.saveToFile(path.join(projectDir, 'twa-manifest.json'));
const generator = new TwaGenerator();
await generator.createTwaProject(projectDir, manifest, log);

// Replace deprecated jcenter() with mavenCentral() for reliable Gradle 8.11 builds
const rootGradlePath = path.join(projectDir, 'build.gradle');
const rootGradle = await fs.readFile(rootGradlePath, 'utf8');
await fs.writeFile(rootGradlePath, rootGradle.replaceAll('jcenter()', 'mavenCentral()'), 'utf8');

console.log('Generated TWA project in', projectDir);
EOF

echo "==> Generating TWA project from ${MANIFEST_URL}..."
OUT_DIR="${OUT_DIR}" \
MANIFEST_URL="${MANIFEST_URL}" \
PACKAGE_ID="${PACKAGE_ID}" \
KEYSTORE_PATH="${KEYSTORE_PATH}" \
KEY_ALIAS="${KEY_ALIAS}" \
SHA256_FP="${SHA256_FP}" \
  bun "${OUT_DIR}/.builder/generate.mjs"

# 3. Compile release APK via Gradle
PROJECT_DIR="${OUT_DIR}/project"
echo "==> Compiling Android release APK via Gradle..."
(
  cd "${PROJECT_DIR}"
  chmod +x ./gradlew
  ./gradlew assembleRelease --no-daemon
)

UNSIGNED_APK="${PROJECT_DIR}/app/build/outputs/apk/release/app-release-unsigned.apk"
ALIGNED_APK="${OUT_DIR}/app-release-aligned.apk"
SIGNED_APK="${OUT_DIR}/mike-cdn-upload.apk"

# 4. Zipalign & sign with apksigner
echo "==> Zipaligning and signing APK..."
"${BUILD_TOOLS_DIR}/zipalign" -f -p 4 "${UNSIGNED_APK}" "${ALIGNED_APK}"
"${BUILD_TOOLS_DIR}/apksigner" sign \
  --ks "${KEYSTORE_PATH}" \
  --ks-key-alias "${KEY_ALIAS}" \
  --ks-pass "pass:${KEYSTORE_PASS}" \
  --key-pass "pass:${KEY_PASS}" \
  --out "${SIGNED_APK}" \
  "${ALIGNED_APK}"
rm -f "${ALIGNED_APK}"

echo "==> Verifying APK signature..."
"${BUILD_TOOLS_DIR}/apksigner" verify --print-certs "${SIGNED_APK}"

echo ""
echo "SUCCESS! Signed APK ready at:"
echo "  ${SIGNED_APK}"
echo "Package ID: ${PACKAGE_ID}"
echo "SHA-256:    ${SHA256_FP}"
echo ""
echo "Install via ADB:  adb install -r ${SIGNED_APK}"
