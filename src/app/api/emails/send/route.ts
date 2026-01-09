import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { checkAuthentication } from '@/lib/auth';
import { sendGenericEmail } from '@/lib/email';

// POST - Send an email to a client
export async function POST(request: Request) {
    try {
        // Try to get authentication
        let finalUserId: string | null = null;
        
        try {
            const { userId, isFallback, userEmail } = await checkAuthentication(request);
            finalUserId = userId;
            
            if (!finalUserId && isFallback && userEmail) {
                const { data: user } = await supabase
                    .from('users')
                    .select('id')
                    .eq('email', userEmail.toLowerCase().trim())
                    .single();
                if (user) {
                    finalUserId = user.id;
                }
            }
        } catch (authError) {
            console.log('[Send Email API] Auth error (continuing):', authError);
        }

        const body = await request.json();
        const { clientId, clientEmail, clientName, subject, htmlBody, textBody, templateId } = body;

        if (!clientEmail || !subject) {
            return NextResponse.json({ error: 'Client email and subject are required' }, { status: 400 });
        }

        // Send the email
        try {
            await sendGenericEmail({
                to: clientEmail,
                subject,
                html: htmlBody || '',
                text: textBody || ''
            });
        } catch (emailError: any) {
            console.error('[Send Email API] Failed to send email:', emailError);
            return NextResponse.json({ 
                error: `Failed to send email: ${emailError.message}` 
            }, { status: 500 });
        }

        // Log the email in history
        const { data: historyEntry, error: historyError } = await supabase
            .from('email_history')
            .insert({
                user_id: finalUserId,
                client_id: clientId || null,
                client_email: clientEmail,
                client_name: clientName || '',
                subject,
                html_body: htmlBody || '',
                text_body: textBody || '',
                template_id: templateId || null,
                status: 'sent',
                sent_at: new Date().toISOString(),
                created_at: new Date().toISOString()
            })
            .select()
            .single();

        if (historyError) {
            console.error('[Send Email API] Error logging email:', historyError);
            // Don't fail the request if logging fails - email was still sent
        }

        return NextResponse.json({ 
            success: true, 
            message: 'Email sent successfully',
            historyId: historyEntry?.id 
        });
    } catch (error: any) {
        console.error('[Send Email API] Error:', error);
        return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
    }
}

