#!/bin/bash
# Setup script to install git hook for automatic version bumping
# Run this once: chmod +x scripts/setup-version-hook.sh && ./scripts/setup-version-hook.sh

cat > .git/hooks/pre-commit << 'EOF'
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
EOF

chmod +x .git/hooks/pre-commit
echo "✅ Git pre-commit hook installed for automatic version bumping"




