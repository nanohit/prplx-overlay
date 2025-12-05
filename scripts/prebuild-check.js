#!/usr/bin/env node

/**
 * Pre-build validation script
 * Ensures all required files and configurations are in place
 */

const fs = require('fs');
const path = require('path');

const projectRoot = path.join(__dirname, '..');

console.log('🔍 Running pre-build checks...\n');

const checks = [];

// Check 1: Required files exist
const requiredFiles = [
  'package.json',
  'electron/main.ts',
  'electron/preload.ts',
  'scripts/perplexity_send.jxa',
  'scripts/perplexity_attachments.jxa',
  'assets/icons/mac/icon.icns',
  'assets/entitlements.mac.plist',
  'assets/entitlements.mac.inherit.plist',
  'index.html',
  'src/main.tsx',
  'vite.config.ts',
];

console.log('📁 Checking required files...');
requiredFiles.forEach(file => {
  const filePath = path.join(projectRoot, file);
  const exists = fs.existsSync(filePath);
  console.log(`   ${exists ? '✅' : '❌'} ${file}`);
  if (!exists) {
    checks.push(`Missing required file: ${file}`);
  }
});
console.log('');

// Check 2: JXA scripts are executable
console.log('📜 Checking JXA script permissions...');
const jxaScripts = [
  'scripts/perplexity_send.jxa',
  'scripts/perplexity_attachments.jxa',
];

jxaScripts.forEach(script => {
  const scriptPath = path.join(projectRoot, script);
  if (fs.existsSync(scriptPath)) {
    try {
      const stats = fs.statSync(scriptPath);
      const isExecutable = (stats.mode & parseInt('0111', 8)) !== 0;
      if (!isExecutable) {
        console.log(`   ⚠️  ${script} is not executable, fixing...`);
        fs.chmodSync(scriptPath, stats.mode | parseInt('0755', 8));
        console.log(`   ✅ ${script} made executable`);
      } else {
        console.log(`   ✅ ${script}`);
      }
    } catch (err) {
      console.log(`   ❌ ${script}: ${err.message}`);
      checks.push(`Cannot check permissions for: ${script}`);
    }
  }
});
console.log('');

// Check 3: Package.json has correct build config
console.log('📦 Checking package.json configuration...');
try {
  const packageJson = require(path.join(projectRoot, 'package.json'));
  
  if (!packageJson.build) {
    checks.push('Missing "build" configuration in package.json');
    console.log('   ❌ Missing build configuration');
  } else {
    console.log('   ✅ Build configuration present');
    
    if (!packageJson.build.mac) {
      checks.push('Missing mac build configuration');
      console.log('   ❌ Missing mac configuration');
    } else {
      console.log('   ✅ Mac build configuration present');
    }
    
    if (!packageJson.build.extraResources) {
      checks.push('Missing extraResources configuration');
      console.log('   ❌ Missing extraResources');
    } else {
      console.log('   ✅ Extra resources configured');
    }
    
    if (!packageJson.build.asarUnpack) {
      checks.push('Missing asarUnpack configuration');
      console.log('   ⚠️  Missing asarUnpack (native modules may not work)');
    } else {
      console.log('   ✅ Asar unpack configured');
    }
  }
} catch (err) {
  checks.push(`Cannot read package.json: ${err.message}`);
  console.log(`   ❌ Cannot read package.json: ${err.message}`);
}
console.log('');

// Check 4: Node modules installed
console.log('📚 Checking dependencies...');
const nodeModulesPath = path.join(projectRoot, 'node_modules');
if (fs.existsSync(nodeModulesPath)) {
  console.log('   ✅ node_modules exists');
  
  // Check for critical native modules
  const criticalModules = ['sharp', 'screenshot-desktop', 'electron'];
  criticalModules.forEach(mod => {
    const modPath = path.join(nodeModulesPath, mod);
    if (fs.existsSync(modPath)) {
      console.log(`   ✅ ${mod} installed`);
    } else {
      console.log(`   ❌ ${mod} not found`);
      checks.push(`Missing critical module: ${mod}`);
    }
  });
} else {
  console.log('   ❌ node_modules not found - run npm install');
  checks.push('node_modules not found');
}
console.log('');

// Summary
console.log('========================================');
if (checks.length === 0) {
  console.log('✅ All checks passed! Ready to build.');
  console.log('========================================');
  process.exit(0);
} else {
  console.log('❌ Some checks failed:');
  checks.forEach(check => console.log(`   - ${check}`));
  console.log('========================================');
  console.log('Please fix the issues above before building.');
  process.exit(1);
}
