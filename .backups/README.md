# Backup System

## Quick Backup
Run this command anytime before making changes:
```powershell
.\backup-files.ps1
```

This creates a timestamped backup of all critical files in `.backups\backup-[timestamp]\`

## Manual Backup
To backup a specific file manually:
```powershell
Copy-Item -Path "src\app\clients\page.tsx" -Destination ".backups\clients-page-$(Get-Date -Format 'yyyyMMdd-HHmmss').tsx"
```

## Restore from Backup
1. Navigate to `.backups\` folder
2. Find the backup you want (sorted by timestamp)
3. Copy the file back to its original location

Example:
```powershell
Copy-Item -Path ".backups\backup-20251124-181500\src\app\clients\page.tsx" -Destination "src\app\clients\page.tsx" -Force
```

## Backup Location
All backups are stored in: `c:\projects\therapist\.backups\`

## What Gets Backed Up
- All page components (clients, session-notes, reminders, schedule, recordings)
- Critical components (voice-notes, client-import-export)
- API routes (clients, appointments, session-notes, recordings)

## Cleanup Old Backups
To remove backups older than 30 days:
```powershell
Get-ChildItem .backups -Directory | Where-Object { $_.CreationTime -lt (Get-Date).AddDays(-30) } | Remove-Item -Recurse -Force
```
