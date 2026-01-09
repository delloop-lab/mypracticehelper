import nodemailer from 'nodemailer';
import fs from 'fs';
import path from 'path';
import { supabase } from './supabase';

// Create SMTP transporter for IONOS
function createTransporter() {
    const smtpHost = process.env.SMTP_HOST || 'smtp.ionos.com';
    const smtpPort = parseInt(process.env.SMTP_PORT || '587');
    const smtpUser = process.env.SMTP_USER;
    const smtpPass = process.env.SMTP_PASS;
    const smtpFrom = process.env.SMTP_FROM || smtpUser;
    const smtpFromName = process.env.SMTP_FROM_NAME || 'Claire Schillaci';

    if (!smtpUser || !smtpPass) {
        throw new Error('SMTP credentials not configured');
    }

    return nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpPort === 465, // true for 465, false for other ports
        auth: {
            user: smtpUser,
            pass: smtpPass,
        },
    });
}

// Format appointment date/time for email
function formatAppointmentDateTime(date: Date, timezone?: string): string {
    const options: Intl.DateTimeFormatOptions = {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: timezone || 'UTC',
    };
    return date.toLocaleString('en-US', options);
}

// Replace placeholders in template
function replacePlaceholders(template: string, replacements: Record<string, string>): string {
    let result = template;
    for (const [key, value] of Object.entries(replacements)) {
        const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
        result = result.replace(regex, value);
    }
    return result;
}

// Create reminder email template
export function createReminderEmail(
    clientName: string,
    appointmentDate: Date,
    appointmentType: string,
    duration: number,
    timezone?: string,
    customTemplate?: { subject: string; htmlBody: string; textBody: string }
): { subject: string; html: string; text: string } {
    const formattedDateTime = formatAppointmentDateTime(appointmentDate, timezone);
    const formattedDate = formattedDateTime.split(',')[0];
    const durationText = duration ? `${duration} minutes` : '1 hour';

    // Use custom template if provided, otherwise use default
    if (customTemplate) {
        const replacements = {
            clientName,
            dateTime: formattedDateTime,
            date: formattedDate,
            appointmentType,
            duration: durationText,
            logoUrl: '{{logoUrl}}', // Will be replaced in sendReminderEmail
        };

        const subject = customTemplate.subject 
            ? replacePlaceholders(customTemplate.subject, replacements)
            : `Reminder: Your appointment tomorrow - ${formattedDate}`;

        return {
            subject: subject,
            html: replacePlaceholders(customTemplate.htmlBody, replacements),
            text: replacePlaceholders(customTemplate.textBody, replacements),
        };
    }

    // Default template
    const subject = `Reminder: Your appointment tomorrow - ${formattedDate}`;

    const html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Appointment Reminder</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
        <h1 style="color: #0069ff; margin-top: 0;">Appointment Reminder</h1>
    </div>
    
    <p>Dear ${clientName},</p>
    
    <p>This is a friendly reminder that you have an appointment scheduled for:</p>
    
    <div style="background-color: #e7f3ff; padding: 15px; border-left: 4px solid #0069ff; margin: 20px 0;">
        <p style="margin: 0; font-size: 18px; font-weight: bold;">${formattedDateTime}</p>
        <p style="margin: 5px 0 0 0; color: #666;">${appointmentType} • ${durationText}</p>
    </div>
    
    <p>If you need to reschedule or cancel, please contact me as soon as possible.</p>
    
    <p>I look forward to seeing you tomorrow.</p>
    
    <p>Best regards,<br>
    <strong>Claire Schillaci</strong></p>
    
    <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
    <p style="font-size: 12px; color: #999; margin: 0;">
        This is an automated reminder. Please do not reply to this email.
    </p>
</body>
</html>
    `.trim();

    const text = `
Appointment Reminder

Dear ${clientName},

This is a friendly reminder that you have an appointment scheduled for:

${formattedDateTime}
${appointmentType} • ${durationText}

If you need to reschedule or cancel, please contact me as soon as possible.

I look forward to seeing you tomorrow.

Best regards,
Claire Schillaci

---
This is an automated reminder. Please do not reply to this email.
    `.trim();

    return { subject, html, text };
}

// Get base URL for logo in emails
function getBaseUrl(): string {
    // In production, use the actual domain
    if (process.env.NEXT_PUBLIC_APP_URL) {
        return process.env.NEXT_PUBLIC_APP_URL;
    }
    if (process.env.VERCEL_URL) {
        return `https://${process.env.VERCEL_URL}`;
    }
    // Fallback for local development
    return 'http://localhost:3000';
}

// Send reminder email
export async function sendReminderEmail(
    to: string,
    clientName: string,
    appointmentDate: Date,
    appointmentType: string,
    duration: number,
    timezone?: string,
    customTemplate?: { subject: string; htmlBody: string; textBody: string },
    companyLogo?: string // Optional company logo path from settings
): Promise<void> {
    const transporter = createTransporter();
    const smtpFrom = process.env.SMTP_FROM || process.env.SMTP_USER;
    const smtpFromName = process.env.SMTP_FROM_NAME || 'Claire Schillaci';

    if (!smtpFrom) {
        throw new Error('SMTP_FROM not configured');
    }

    const { subject, html, text } = createReminderEmail(
        clientName,
        appointmentDate,
        appointmentType,
        duration,
        timezone,
        customTemplate
    );

    // Prepare attachments with logo embedded using CID
    const attachments: any[] = [];
    let logoCid = null;
    
    console.log('[Email] ===== STARTING LOGO PROCESSING =====');
    console.log('[Email] Company logo parameter:', companyLogo || 'NOT PROVIDED');
    
    try {
        let logoBuffer: Buffer | null = null;
        let logoFilename = 'logo.png';
        let contentType = 'image/png';
        let logoFound = false;
        
        // Determine which logo to use: company logo from settings, or fallback to default logo.png
        if (companyLogo) {
            console.log('[Email] Company logo provided:', companyLogo);
            
            // Check if companyLogo is a Supabase Storage URL or local path
            if (companyLogo.startsWith('http') || companyLogo.includes('supabase.co/storage')) {
                // It's a Supabase Storage URL - download it
                try {
                    // Extract filename from URL (e.g., company-logo.png)
                    // Handle URLs like: https://xxx.supabase.co/storage/v1/object/public/documents/company-logo.png
                    let filename = 'company-logo.png';
                    if (companyLogo.includes('/documents/')) {
                        filename = companyLogo.split('/documents/')[1].split('?')[0];
                    } else {
                        const urlParts = companyLogo.split('/');
                        filename = urlParts[urlParts.length - 1].split('?')[0];
                    }
                    
                    console.log('[Email] Extracted filename from URL:', filename);
                    
                    // Download from Supabase Storage 'documents' bucket
                    const { data, error } = await supabase.storage
                        .from('documents')
                        .download(filename);
                    
                    if (!error && data) {
                        const arrayBuffer = await data.arrayBuffer();
                        logoBuffer = Buffer.from(arrayBuffer);
                        logoFilename = filename;
                        logoFound = true;
                        
                        // Determine content type from file extension
                        const ext = filename.split('.').pop()?.toLowerCase();
                        if (ext === 'jpg' || ext === 'jpeg') {
                            contentType = 'image/jpeg';
                        } else if (ext === 'gif') {
                            contentType = 'image/gif';
                        } else if (ext === 'webp') {
                            contentType = 'image/webp';
                        }
                        
                        console.log('[Email] ✓ Logo downloaded from Supabase Storage:', filename, `(${logoBuffer.length} bytes)`);
                    } else {
                        console.warn('[Email] ✗ Failed to download logo from Supabase:', error?.message || 'Unknown error');
                    }
                } catch (error) {
                    console.error('[Email] ✗ Error downloading logo from Supabase:', error);
                }
            } else {
                // It's a local path - try to read from filesystem
                const logoFile = companyLogo.startsWith('/') ? companyLogo.slice(1) : companyLogo;
                const logoPath = path.join(process.cwd(), 'public', logoFile);
                
                console.log('[Email] Trying local logo path:', logoPath);
                
                if (fs.existsSync(logoPath)) {
                    logoBuffer = fs.readFileSync(logoPath);
                    logoFilename = logoFile;
                    logoFound = true;
                    
                    // Determine content type from file extension
                    const ext = logoFile.split('.').pop()?.toLowerCase();
                    if (ext === 'jpg' || ext === 'jpeg') {
                        contentType = 'image/jpeg';
                    } else if (ext === 'gif') {
                        contentType = 'image/gif';
                    } else if (ext === 'webp') {
                        contentType = 'image/webp';
                    }
                    
                    console.log('[Email] ✓ Logo loaded from local path:', logoPath, `(${logoBuffer.length} bytes)`);
                } else {
                    console.warn('[Email] ✗ Local logo file not found:', logoPath);
                }
            }
        }
        
        // Fallback to default logo.png if company logo not set or not found
        if (!logoFound) {
            console.log('[Email] Company logo not found, trying default logo...');
            const defaultLogoPath = path.join(process.cwd(), 'public', 'logo.png');
            console.log('[Email] Default logo path:', defaultLogoPath);
            console.log('[Email] Current working directory:', process.cwd());
            
            if (fs.existsSync(defaultLogoPath)) {
                logoBuffer = fs.readFileSync(defaultLogoPath);
                logoFilename = 'logo.png';
                contentType = 'image/png';
                logoFound = true;
                console.log('[Email] ✓ Default logo loaded:', defaultLogoPath, `(${logoBuffer.length} bytes)`);
            } else {
                console.warn('[Email] ✗ Default logo file not found:', defaultLogoPath);
                // List public directory to see what's there
                const publicDir = path.join(process.cwd(), 'public');
                if (fs.existsSync(publicDir)) {
                    const files = fs.readdirSync(publicDir);
                    console.log('[Email] Files in public directory:', files.filter(f => f.endsWith('.png') || f.endsWith('.jpg') || f.endsWith('.gif')));
                } else {
                    console.warn('[Email] Public directory does not exist:', publicDir);
                }
            }
        }
        
        if (logoBuffer && logoFound) {
            // Use a simpler CID format that's more compatible with email clients
            // CID should NOT include angle brackets or cid: prefix - nodemailer handles that
            logoCid = 'company-logo';
            
            attachments.push({
                filename: logoFilename,
                content: logoBuffer, // Use buffer instead of path for better reliability
                cid: logoCid, // Content-ID for inline image (just the identifier, no cid: prefix)
                contentDisposition: 'inline', // Ensure it's treated as inline attachment
                contentType: contentType, // Explicitly set content type
            });
            
            console.log('[Email] ✓ Logo attached successfully');
            console.log('[Email]   - CID:', logoCid);
            console.log('[Email]   - Filename:', logoFilename);
            console.log('[Email]   - Size:', logoBuffer.length, 'bytes');
            console.log('[Email]   - Content-Type:', contentType);
        } else {
            console.warn('[Email] ✗ No logo found - email will be sent without logo attachment');
        }
    } catch (error) {
        console.error('[Email] ✗ Error processing logo:', error);
    }

    // Replace logo placeholder with CID reference
    let finalHtml = html;
    if (logoCid) {
        // Replace {{logoUrl}} with cid: reference for inline image
        const cidReference = `cid:${logoCid}`;
        finalHtml = html.replace(/\{\{logoUrl\}\}/g, cidReference);
        
        // Ensure img tags are properly formatted (some email clients don't like self-closing tags)
        // Convert <img ... /> to <img ...> for better compatibility
        finalHtml = finalHtml.replace(/<img([^>]*)\s*\/>/gi, '<img$1>');
        
        // Verify the img tag exists and is properly formatted
        const imgTagRegex = /<img([^>]*)\s+src="cid:[^"]*"([^>]*)>/i;
        const imgMatch = finalHtml.match(imgTagRegex);
        
        if (!imgMatch) {
            // If img tag is broken, try to fix it
            // Look for cid: that's not in an img tag
            const cidIndex = finalHtml.indexOf(cidReference);
            if (cidIndex > -1) {
                // Check if it's inside an img tag
                const beforeCid = finalHtml.substring(Math.max(0, cidIndex - 100), cidIndex);
                const afterCid = finalHtml.substring(cidIndex, Math.min(finalHtml.length, cidIndex + 50));
                
                if (!beforeCid.includes('<img') || !afterCid.includes('>')) {
                    console.warn('[Email] ⚠ CID found but img tag appears broken. Attempting to fix...');
                    // Try to reconstruct the img tag
                    finalHtml = finalHtml.replace(
                        new RegExp(cidReference.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'),
                        `<img src="${cidReference}" alt="Company Logo" style="max-width: 150px; width: 150px; height: auto; display: block; margin: 0 auto;">`
                    );
                }
            }
        }
        
        // Debug logging
        console.log('[Email] Logo replacement completed');
        console.log('[Email] CID reference:', cidReference);
        const finalImgMatch = finalHtml.match(/<img[^>]*src="cid:[^"]*"[^>]*>/i);
        if (finalImgMatch) {
            console.log('[Email] ✓ Final img tag:', finalImgMatch[0]);
        } else {
            console.warn('[Email] ⚠ No valid img tag found after replacement');
            // Log context around CID
            const cidPos = finalHtml.indexOf('cid:');
            if (cidPos > -1) {
                const context = finalHtml.substring(Math.max(0, cidPos - 100), Math.min(finalHtml.length, cidPos + 150));
                console.log('[Email] Context around CID:', context);
            }
        }
    } else {
        // Remove logo div if logo not found to avoid showing broken image or CID text
        finalHtml = html.replace(/<div[^>]*>\s*<img[^>]*src="\{\{logoUrl\}\}"[^>]*>\s*<\/div>/gi, '');
        // Also remove any standalone img tags with the placeholder
        finalHtml = finalHtml.replace(/<img[^>]*src="\{\{logoUrl\}\}"[^>]*>/gi, '');
        console.log('[Email] Logo not found - removed logo placeholder from HTML');
    }

    const mailOptions: any = {
        from: `"${smtpFromName}" <${smtpFrom}>`,
        to: to,
        subject: subject || 'Appointment Reminder', // Ensure subject is always set
        html: finalHtml, // HTML email body only - no plain text
    };

    // Add attachments if we have them - CRITICAL: attachments must be added for inline images
    if (attachments.length > 0) {
        mailOptions.attachments = attachments;
        console.log('[Email] ✓ Attachments added to mailOptions:', attachments.length);
    } else {
        console.warn('[Email] ⚠ WARNING: No attachments to add - logo will not display!');
        // If we have a logoCid but no attachment, something went wrong
        if (logoCid) {
            console.error('[Email] ✗ ERROR: logoCid is set but no attachment was created!');
        }
    }

    // Log for debugging (always log to help debug issues)
    console.log('[Email] ===== EMAIL SEND DEBUG =====');
    console.log('[Email] Sending HTML email');
    console.log('[Email] HTML length:', finalHtml.length, 'characters');
    console.log('[Email] Attachments count:', attachments.length);
    console.log('[Email] Logo CID:', logoCid);
    
    if (attachments.length > 0) {
        console.log('[Email] Attachment details:');
        attachments.forEach((att, idx) => {
            console.log(`[Email]   Attachment ${idx + 1}:`, {
                filename: att.filename,
                cid: att.cid,
                contentType: att.contentType,
                contentDisposition: att.contentDisposition,
                contentSize: att.content ? `${att.content.length} bytes` : 'N/A'
            });
        });
    } else {
        console.warn('[Email] ⚠ NO ATTACHMENTS - Logo will not display!');
    }
    
    console.log('[Email] Mail options:', {
        from: mailOptions.from,
        to: mailOptions.to,
        subject: mailOptions.subject,
        hasHtml: !!mailOptions.html,
        htmlLength: mailOptions.html?.length,
        attachmentsCount: mailOptions.attachments?.length || 0,
    });
    
    // Check if CID is in HTML
    if (logoCid && finalHtml.includes(`cid:${logoCid}`)) {
        console.log('[Email] ✓ CID found in HTML');
        const imgMatch = finalHtml.match(/<img[^>]*src="cid:[^"]*"[^>]*>/i);
        if (imgMatch) {
            console.log('[Email] ✓ Valid img tag found:', imgMatch[0].substring(0, 100));
        } else {
            console.warn('[Email] ⚠ CID in HTML but no valid img tag found!');
        }
    } else if (logoCid) {
        console.warn('[Email] ⚠ Logo CID set but not found in HTML!');
    }
    
    console.log('[Email] ============================');

    await transporter.sendMail(mailOptions);
}

// Send a generic email (for manual emails to clients)
export async function sendGenericEmail(options: {
    to: string;
    subject: string;
    html: string;
    text?: string;
}): Promise<void> {
    const transporter = createTransporter();
    const smtpFrom = process.env.SMTP_FROM || process.env.SMTP_USER;
    const smtpFromName = process.env.SMTP_FROM_NAME || 'Claire Schillaci';

    if (!smtpFrom) {
        throw new Error('SMTP_FROM not configured');
    }

    const mailOptions: any = {
        from: `"${smtpFromName}" <${smtpFrom}>`,
        to: options.to,
        subject: options.subject,
        html: options.html,
    };

    // Only add text if provided
    if (options.text) {
        mailOptions.text = options.text;
    }

    console.log('[Email] Sending generic email to:', options.to);
    console.log('[Email] Subject:', options.subject);

    await transporter.sendMail(mailOptions);
    
    console.log('[Email] Generic email sent successfully');
}
