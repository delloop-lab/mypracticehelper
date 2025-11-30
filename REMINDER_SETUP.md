# Appointment Reminder System Setup

## Overview
Automated email reminders sent 24 hours before appointments using Vercel Cron Jobs and IONOS SMTP.

## Environment Variables Required in Vercel

Add these to your Vercel project → Settings → Environment Variables:

### SMTP Configuration (IONOS)
- **SMTP_HOST**: `smtp.ionos.com`
- **SMTP_PORT**: `587`
- **SMTP_USER**: `help@mypracticehelper.com`
- **SMTP_PASS**: `MyFerrari6152!` (your email password)
- **SMTP_FROM**: `help@mypracticehelper.com`
- **SMTP_FROM_NAME**: `Claire Schillaci`

### Optional Security (Recommended)
- **CRON_SECRET**: (optional) A secret token to protect the cron endpoint

**Important:** Make sure to enable these for:
- ✅ Production
- ✅ Preview  
- ✅ Development

## How It Works

1. **Vercel Cron Job** runs every hour (`0 * * * *`)
2. Checks for appointments **24 hours from now** (±1 hour window)
3. Sends email reminders to clients
4. Marks reminders as sent in session metadata (prevents duplicates)

## Email Template

The reminder email includes:
- Client name
- Appointment date and time (formatted nicely)
- Appointment type and duration
- Professional message from Claire Schillaci

## Testing

### Test Locally
1. Make sure environment variables are in `.env.local`
2. Manually call: `GET http://localhost:3000/api/cron/send-reminders`

### Test in Production
1. Create a test appointment for 24 hours from now
2. Wait for the cron job to run (runs every hour at :00)
3. Or manually trigger: `GET https://your-app.vercel.app/api/cron/send-reminders`

## Troubleshooting

**Reminders not sending:**
- Check Vercel logs for errors
- Verify SMTP credentials are correct
- Check that client emails are set
- Verify timezone settings

**Duplicate reminders:**
- The system tracks sent reminders in session metadata
- If you see duplicates, check the `reminderSent` field in session metadata

**SMTP errors:**
- Verify IONOS SMTP settings are correct
- Check that port 587 allows TLS
- Ensure email account is active

## Cron Schedule

Current schedule: `0 * * * *` (every hour at :00)

To change, edit `vercel.json`:
- `0 * * * *` - Every hour
- `0 9 * * *` - Daily at 9 AM
- `*/30 * * * *` - Every 30 minutes




