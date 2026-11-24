#!/usr/bin/env bash
set -euo pipefail

# Build a sideloadable Android APK (Trusted Web Activity) wrapping https://cdn.mikeodnis.dev/upload
# Prerequisites: JDK 17+, Android SDK ($ANDROID_HOME), and Bun (`bunx @bubblewrap/cli`).

OUT_DIR="${1:-./android-twa}"
MANIFEST_URL="${MANIFEST_URL:-https://cdn.mikeodnis.dev/manifest.webmanifest}"

echo "Building Mike CDN Android TWA APK in: ${OUT_DIR}"
echo "Manifest: ${MANIFEST_URL}"
mkdir -p "${OUT_DIR}"
cd "${OUT_DIR}"

if [ ! -f twa-manifest.json ]; then
  bunx @bubblewrap/cli init --manifest="${MANIFEST_URL}"
fi

bunx @bubblewrap/cli build

echo ""
echo "APK built! Look for app-release-signed.apk in ${OUT_DIR}."
echo "To remove the browser bar on Android, publish your keystore SHA-256 fingerprint at:"
echo "  https://cdn.mikeodnis.dev/.well-known/assetlinks.json"
