# Backup Script for Therapist App
# Run this before making any major changes
# Usage: .\backup-files.ps1

$timestamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$backupDir = ".backups\backup-$timestamp"

Write-Host "Creating backup at: $backupDir" -ForegroundColor Green

# Create backup directory
New-Item -ItemType Directory -Force -Path $backupDir | Out-Null

# Backup all critical app files
$filesToBackup = @(
    "src\app\clients\page.tsx",
    "src\app\session-notes\page.tsx",
    "src\app\reminders\page.tsx",
    "src\app\schedule\page.tsx",
    "src\app\recordings\page.tsx",
    "src\components\voice-notes.tsx",
    "src\components\client-import-export.tsx",
    "src\app\api\clients\route.ts",
    "src\app\api\appointments\route.ts",
    "src\app\api\session-notes\route.ts",
    "src\app\api\recordings\route.ts"
)

foreach ($file in $filesToBackup) {
    if (Test-Path $file) {
        $destination = Join-Path $backupDir $file
        $destDir = Split-Path $destination -Parent
        New-Item -ItemType Directory -Force -Path $destDir | Out-Null
        Copy-Item -Path $file -Destination $destination -Force
        Write-Host "✓ Backed up: $file" -ForegroundColor Cyan
    } else {
        Write-Host "⚠ Skipped (not found): $file" -ForegroundColor Yellow
    }
}

Write-Host "`nBackup complete! Files saved to: $backupDir" -ForegroundColor Green
Write-Host "To restore, copy files from backup folder back to their original locations." -ForegroundColor Gray
