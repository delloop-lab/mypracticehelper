# Version Bumping Guide

This project includes automatic version bumping to ensure version numbers are always updated when changes are committed.

## Automatic Version Bumping

### Setup (One-time)

**For Windows (PowerShell):**
```powershell
.\scripts\setup-version-hook.ps1
```

**For Mac/Linux:**
```bash
chmod +x scripts/setup-version-hook.sh
./scripts/setup-version-hook.sh
```

This installs a git pre-commit hook that automatically bumps the patch version if `package.json` is modified but the version wasn't manually updated.

### Manual Version Bumping

You can also manually bump versions using npm scripts:

```bash
# Bump patch version (0.12.9 -> 0.12.10)
npm run version:patch

# Bump minor version (0.12.9 -> 0.13.0)
npm run version:minor

# Bump major version (0.12.9 -> 1.0.0)
npm run version:major

# Bump patch and stage package.json
npm run version:bump
```

## How It Works

1. **Automatic (via git hook):**
   - When you commit changes, if `package.json` was modified but the version wasn't manually changed, the hook automatically bumps the patch version
   - If you manually updated the version in `package.json`, it respects your change

2. **Manual:**
   - Use `npm run version:patch/minor/major` to bump versions manually
   - The script updates `package.json` and you can commit it

## Version Number Format

Follows [Semantic Versioning](https://semver.org/):
- **MAJOR.MINOR.PATCH** (e.g., 0.12.9)
- **MAJOR**: Breaking changes
- **MINOR**: New features (backward compatible)
- **PATCH**: Bug fixes (backward compatible)

## Notes

- The git hook only works if you've run the setup script
- If the hook isn't working, you can always manually bump versions using npm scripts
- Version bumps are automatically staged by the hook, so they'll be included in your commit


