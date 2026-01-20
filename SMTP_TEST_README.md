# 📧 SMTP Email Test Guide

This guide will help you test your SMTP email configuration **without affecting the production app**.

## ✅ What This Does

- Tests your SMTP server connection
- Sends a test email to verify everything works
- Shows detailed error messages if something is wrong
- **Does NOT touch your production app or database**

## 📋 Quick Start

### 1. Add Your SMTP Settings to `.env.local`

Open your `.env.local` file and add (or verify) these lines:

```env
# SMTP Configuration
SMTP_HOST=smtp.ionos.com
SMTP_PORT=587
SMTP_USER=your-email@yourdomain.com
SMTP_PASS=your-password-here
SMTP_FROM=noreply@yourdomain.com
SMTP_FROM_NAME=Your Name or Company Name

# Test recipient (where to send the test email)
TEST_EMAIL=your-personal-email@gmail.com
```

**Important Notes:**
- Replace `your-email@yourdomain.com` with your actual SMTP username
- Replace `your-password-here` with your actual SMTP password
- Replace `your-personal-email@gmail.com` with YOUR email to receive the test

### 2. Run the Test Script

Open PowerShell in this folder and run:

```powershell
node test-smtp.js
```

### 3. Check the Results

The script will:
1. ✅ Verify your SMTP configuration
2. ✅ Test the connection to your SMTP server
3. ✅ Send a test email
4. ✅ Show you success or error messages

### 4. Check Your Email

- Look in your inbox (the email you set as `TEST_EMAIL`)
- **Check spam folder** if you don't see it in inbox
- If you receive the test email → Your SMTP is working! ✅

## 🔧 Common SMTP Settings

### IONOS (smtp.ionos.com)
```env
SMTP_HOST=smtp.ionos.com
SMTP_PORT=587
SMTP_USER=your-email@yourdomain.com
SMTP_PASS=your-password
```

### Gmail (smtp.gmail.com)
```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-specific-password
```
**Note:** Gmail requires an [App-Specific Password](https://support.google.com/accounts/answer/185833)

### Office 365 (smtp.office365.com)
```env
SMTP_HOST=smtp.office365.com
SMTP_PORT=587
SMTP_USER=your-email@yourdomain.com
SMTP_PASS=your-password
```

### SendGrid (smtp.sendgrid.net)
```env
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASS=your-sendgrid-api-key
```

## ❌ Troubleshooting

### Error: "SMTP_USER and SMTP_PASS are required"
**Fix:** Make sure your `.env.local` file has `SMTP_USER` and `SMTP_PASS` set

### Error: "EAUTH - Authentication failed"
**Common causes:**
- ✗ Wrong username or password
- ✗ Two-factor authentication enabled (need app-specific password)
- ✗ SMTP access not enabled

**Fix:**
1. Double-check your SMTP username and password
2. If using Gmail, generate an [App-Specific Password](https://support.google.com/accounts/answer/185833)
3. Check with your email provider if SMTP is enabled

### Error: "ECONNECTION" or "ETIMEDOUT"
**Common causes:**
- ✗ Wrong SMTP host or port
- ✗ Firewall blocking connection
- ✗ SSL/TLS configuration mismatch

**Fix:**
1. Verify `SMTP_HOST` and `SMTP_PORT` with your email provider
2. Try port `587` (TLS) or `465` (SSL)
3. Check if your firewall is blocking outbound connections

### Email sent but not received
**Check:**
- 📬 Spam/Junk folder
- 📧 Email filtering rules
- ⏰ Wait a few minutes (can be delayed)

## 🎯 Next Steps After Successful Test

If your test email was sent successfully:

1. ✅ Your SMTP configuration is correct
2. ✅ You can now use these settings in production
3. ✅ Update your Vercel environment variables with the same settings:
   - Go to Vercel → Your Project → Settings → Environment Variables
   - Add/Update: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`, `SMTP_FROM_NAME`
   - Redeploy your app

## 🗑️ Cleanup

After testing, you can:
- Keep `test-smtp.js` for future testing (won't affect production)
- Or delete it: `Remove-Item test-smtp.js`
- Keep `SMTP_TEST_README.md` for reference
- **DO NOT** commit `.env.local` to git (it's already in `.gitignore`)

## 📞 Need Help?

Common issues and solutions:
- **Can't find `.env.local`** → Create it in the root folder next to `package.json`
- **Script not running** → Make sure you're in the project folder and Node.js is installed
- **Still getting errors** → Share the error message (hide passwords!)

---

**Remember:** This test script is completely separate from your app. It only tests your SMTP server and sends one test email. Your app and database are not affected! ✅
