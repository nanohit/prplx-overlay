#!/bin/bash

# Build script for macOS DMG
# This script creates a standalone .dmg file that includes all dependencies

set -e

echo "========================================"
echo "Perplexity Overlay - macOS Build Script"
echo "========================================"
echo ""

# Get the directory of this script
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_DIR="$( cd "$SCRIPT_DIR/.." && pwd )"

cd "$PROJECT_DIR"

echo "📁 Project directory: $PROJECT_DIR"
echo ""

# Detect architecture
ARCH=$(uname -m)
echo "🖥️  Detected architecture: $ARCH"
echo ""

# Clean previous builds
echo "🧹 Cleaning previous builds..."
npm run clean
echo ""

# Install dependencies
echo "📦 Installing dependencies..."
npm install
echo ""

# Rebuild native modules for Electron
echo "🔧 Rebuilding native modules for Electron..."
npm run postinstall
echo ""

# Build TypeScript and React
echo "🏗️  Building application..."
npm run build
echo ""

# Verify scripts are executable
echo "📜 Ensuring JXA scripts are executable..."
chmod +x scripts/*.jxa 2>/dev/null || true
echo ""

# Build DMG based on architecture
if [ "$ARCH" = "arm64" ]; then
    echo "🍎 Building DMG for Apple Silicon (arm64)..."
    npm run app:build:arm64
elif [ "$ARCH" = "x86_64" ]; then
    echo "🍎 Building DMG for Intel (x64)..."
    npm run app:build:x64
else
    echo "🍎 Building DMG for current architecture..."
    npm run app:build
fi

echo ""
echo "========================================"
echo "✅ Build complete!"
echo "========================================"
echo ""
echo "📦 Output files are in: $PROJECT_DIR/release/"
echo ""

# List the generated files
if [ -d "release" ]; then
    echo "Generated files:"
    ls -la release/*.dmg 2>/dev/null || echo "  No DMG files found"
    ls -la release/*.zip 2>/dev/null || echo "  No ZIP files found"
fi

echo ""
echo "🚀 To install: Open the .dmg file and drag the app to Applications"
echo ""
echo "⚠️  First run requirements:"
echo "   1. Open System Settings → Privacy & Security → Screen Recording"
echo "      Enable 'Perplexity Overlay'"
echo "   2. Open System Settings → Privacy & Security → Accessibility" 
echo "      Enable 'Perplexity Overlay'"
echo "   3. In Safari: Settings → Advanced → Enable 'Show Develop menu'"
echo "      Then: Develop → Allow JavaScript from Apple Events"
echo ""
