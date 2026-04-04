#!/bin/bash
echo "============================================"
echo "   Nexo Messenger - macOS DMG Build"
echo "============================================"
echo ""

cd "$(dirname "$0")/app"

echo "[1/3] Installing dependencies..."
npm install
if [ $? -ne 0 ]; then
    echo "ERROR: Failed to install dependencies"
    exit 1
fi

echo ""
echo "[2/3] Building DMG..."
npm run build
if [ $? -ne 0 ]; then
    echo "ERROR: Failed to build"
    exit 1
fi

echo ""
echo "[3/3] Build complete!"
echo ""
echo "Files created in: $(pwd)/dist/"
ls -la dist/*.dmg 2>/dev/null
echo ""
