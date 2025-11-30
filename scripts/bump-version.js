#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const packageJsonPath = path.join(__dirname, '..', 'package.json');

// Read package.json
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

// Parse current version
const [major, minor, patch] = packageJson.version.split('.').map(Number);

// Determine bump type from command line argument
const bumpType = process.argv[2] || 'patch'; // default to patch

let newMajor = major;
let newMinor = minor;
let newPatch = patch;

switch (bumpType) {
    case 'major':
        newMajor = major + 1;
        newMinor = 0;
        newPatch = 0;
        break;
    case 'minor':
        newMinor = minor + 1;
        newPatch = 0;
        break;
    case 'patch':
    default:
        newPatch = patch + 1;
        break;
}

const newVersion = `${newMajor}.${newMinor}.${newPatch}`;
const oldVersion = packageJson.version;

// Update version
packageJson.version = newVersion;

// Write back to package.json
fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');

// Also update version.ts file
const versionTsPath = path.join(__dirname, '..', 'src', 'lib', 'version.ts');
if (fs.existsSync(versionTsPath)) {
    const versionTsContent = fs.readFileSync(versionTsPath, 'utf8');
    const updatedVersionTs = versionTsContent.replace(
        /export const APP_VERSION = "[\d.]+";/,
        `export const APP_VERSION = "${newVersion}";`
    );
    fs.writeFileSync(versionTsPath, updatedVersionTs);
    console.log(`✅ Updated src/lib/version.ts to ${newVersion}`);
}

console.log(`✅ Version bumped from ${oldVersion} to ${newVersion}`);
console.log(`📦 New version: ${newVersion}`);

process.exit(0);

