# PowerShell script to setup git hook for automatic version bumping
# Run this once: .\scripts\setup-version-hook.ps1

$hookContent = @'
#!/bin/sh
# Pre-commit hook to automatically bump version if package.json was modified

# Check if package.json was modified
if git diff --cached --name-only | grep -q "package.json"; then
    # Check if version was manually changed
    if git diff --cached package.json | grep -q "\"version\""; then
        echo "ℹ️  Version was manually updated in package.json"
        exit 0
    fi
    
    # If package.json changed but version wasn't updated, bump it
    echo "📦 package.json modified but version not updated. Bumping patch version..."
    node scripts/bump-version.js patch
    git add package.json
    echo "✅ Version bumped and staged"
fi

exit 0
'@

$hookPath = ".git\hooks\pre-commit"
$hookContent | Out-File -FilePath $hookPath -Encoding utf8 -NoNewline

# Make it executable (if using Git Bash)
if (Get-Command git -ErrorAction SilentlyContinue) {
    git update-index --chmod=+x .git/hooks/pre-commit
}

Write-Host "✅ Git pre-commit hook installed for automatic version bumping" -ForegroundColor Green


