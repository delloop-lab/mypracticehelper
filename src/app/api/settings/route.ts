import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { checkAuthentication } from '@/lib/auth';

const DEFAULT_SETTINGS = {
    calendlyUrl: "",
    appointmentTypes: [
        { name: "Initial Consultation", duration: 60, fee: 80, enabled: true },
        { name: "Follow-up Session", duration: 60, fee: 80, enabled: true },
        { name: "Therapy Session", duration: 60, fee: 80, enabled: true },
        { name: "Couples Therapy Session", duration: 60, fee: 100, enabled: true },
        { name: "Family Therapy", duration: 60, fee: 80, enabled: true },
        { name: "Discovery Session", duration: 30, fee: 0, enabled: true },
    ],
    defaultDuration: 60,
    defaultFee: 80,
    currency: "EUR",
    timezone: "UTC",
    blockedDays: [],
    companyName: "",
    companyLogo: "",
    reminderHoursBefore: 24, // Hours before appointment to send reminder
    reminderEmailTemplate: {
        subject: "Reminder: Your appointment tomorrow - {{date}}",
        htmlBody: `<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
    <!-- Logo centered at top -->
    <div style="text-align: center; margin-bottom: 30px;">
        <img src="{{logoUrl}}" alt="Algarve Therapy Centre" style="max-width: 150px; width: 150px; height: auto; display: block; margin: 0 auto;" />
    </div>
    
    <p>Hi {{clientName}},</p>
    
    <p>This is a quick reminder about your {{appointmentType}} scheduled for {{dateTime}}. The session will run for {{duration}}.</p>
    
    <p>If you need to reschedule, just let me know.</p>
    
    <p>See you then,</p>
    
    <p>Claire<br>
    <strong>Algarve Therapy Centre</strong><br>
    Tel: 937596665</p>
    
    <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
    <p style="font-size: 11px; color: #999; margin: 0 0 10px 0;">
        This is an automated reminder. Please do not reply to this email.
    </p>
    <p style="font-size: 11px; color: #999; margin: 0;">
        <em>Add this email to your whitelist to ensure it arrives in your inbox safely next time.</em>
    </p>
</body>
</html>`,
        textBody: `Appointment Reminder

Hi {{clientName}},

This is a quick reminder about your {{appointmentType}} scheduled for {{dateTime}}. The session will run for {{duration}}.

If you need to reschedule, just let me know.

See you then,

Claire
Algarve Therapy Centre
Tel: 937596665

---
This is an automated reminder. Please do not reply to this email.

Add this email to your whitelist to ensure it arrives in your inbox safely next time.`,
    },
};

export async function GET(request: Request) {
    try {
        console.log('[Settings API GET] Starting GET request');
        
        // Check authentication (handles both new and fallback methods)
        const { userId, isFallback, userEmail } = await checkAuthentication(request);
        console.log('[Settings API GET] Authentication check - userId:', userId, 'isFallback:', isFallback, 'userEmail:', userEmail);
        
        // If fallback auth, show legacy settings (default or without user_id)
        if (isFallback && userEmail === 'claire@claireschillaci.com') {
            console.log('[Settings API GET] Fallback auth detected, showing legacy settings');
            
            // First, try to find user by email to get their user_id
            const { data: userData } = await supabase
                .from('users')
                .select('id')
                .eq('email', userEmail.toLowerCase().trim())
                .maybeSingle();
            
            console.log('[Settings API GET] User lookup result:', { userData, userId: userData?.id });
            
            // If user exists, try to get their user-specific settings
            if (userData?.id) {
                console.log('[Settings API GET] User found, checking user-specific settings for user_id:', userData.id);
                
                // Try by user_id first
                const { data: userSettingsData, error: userSettingsError } = await supabase
                    .from('settings')
                    .select('id, user_id, config, updated_at')
                    .eq('user_id', userData.id)
                    .order('updated_at', { ascending: false })
                    .limit(1);
                
                console.log('[Settings API GET] Query by user_id:', { 
                    count: userSettingsData?.length || 0, 
                    error: userSettingsError,
                    hasConfig: userSettingsData?.[0]?.config ? true : false,
                    companyLogo: userSettingsData?.[0]?.config?.companyLogo
                });
                
                if (userSettingsData && userSettingsData.length > 0 && userSettingsData[0].config) {
                    console.log('[Settings API GET] Found user-specific settings by user_id, returning config');
                    console.log('[Settings API GET] Config companyLogo:', userSettingsData[0].config.companyLogo);
                    return NextResponse.json(userSettingsData[0].config);
                }
                
                // Also try by id format
                const settingsId = `user-${userData.id}`;
                const { data: idSettingsData, error: idSettingsError } = await supabase
                    .from('settings')
                    .select('id, user_id, config, updated_at')
                    .eq('id', settingsId)
                    .maybeSingle();
                
                console.log('[Settings API GET] Query by id:', { 
                    id: settingsId,
                    hasData: !!idSettingsData,
                    error: idSettingsError,
                    companyLogo: idSettingsData?.config?.companyLogo
                });
                
                if (idSettingsData?.config) {
                    console.log('[Settings API GET] Found user-specific settings by id, returning config');
                    console.log('[Settings API GET] Config companyLogo:', idSettingsData.config.companyLogo);
                    return NextResponse.json(idSettingsData.config);
                }
            }
            
            // Try to get 'default' settings
            const { data: defaultData, error: defaultError } = await supabase
                .from('settings')
                .select('id, config, updated_at')
                .eq('id', 'default')
                .maybeSingle();

            console.log('[Settings API GET] Default settings query result:', { 
                hasData: !!defaultData,
                error: defaultError,
                companyLogo: defaultData?.config?.companyLogo
            });

            if (defaultData?.config) {
                console.log('[Settings API GET] Returning default settings');
                console.log('[Settings API GET] Default config companyLogo:', defaultData.config.companyLogo);
                return NextResponse.json(defaultData.config);
            }

            // If no default settings, return defaults
            console.log('[Settings API GET] No default settings found, returning DEFAULT_SETTINGS');
            console.log('[Settings API GET] DEFAULT_SETTINGS companyLogo:', DEFAULT_SETTINGS.companyLogo);
            return NextResponse.json(DEFAULT_SETTINGS);
        }
        
        // Special handling for claire@claireschillaci.com - also check for settings without user_id
        if (userEmail === 'claire@claireschillaci.com' && !userId) {
            console.log('[Settings API GET] claire@claireschillaci.com without userId, checking for legacy settings');
            // Check for settings without user_id (legacy)
            const { data: legacySettings } = await supabase
                .from('settings')
                .select('config')
                .is('user_id', null)
                .order('updated_at', { ascending: false })
                .limit(1)
                .maybeSingle();
            
            if (legacySettings?.config) {
                console.log('[Settings API GET] Found legacy settings (no user_id), companyLogo:', legacySettings.config.companyLogo);
                return NextResponse.json(legacySettings.config);
            }
        }
        
        if (!userId) {
            console.error('[Settings API GET] Unauthorized - no userId');
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const settingsId = `user-${userId}`;
        console.log('[Settings API GET] Looking for settings with user_id:', userId, 'or id:', settingsId);

        // Try to get user-specific settings by user_id first
        // Use .maybeSingle() or handle array to avoid errors with multiple rows
        const { data: userSettingsData, error: userError } = await supabase
            .from('settings')
            .select('id, user_id, config, updated_at')
            .eq('user_id', userId)
            .order('updated_at', { ascending: false }); // Get most recent first

        console.log('[Settings API GET] Query by user_id result:', { 
            dataCount: userSettingsData?.length || 0,
            error: userError 
        });

        // Handle duplicate records - use the most recent one
        let data = null;
        if (userSettingsData && userSettingsData.length > 0) {
            // If multiple records found, use the most recent one
            if (userSettingsData.length > 1) {
                console.warn(`[Settings API GET] Found ${userSettingsData.length} duplicate settings records for user_id ${userId}. Using most recent.`);
                // Clean up duplicates in background (don't block the request)
                supabase
                    .from('settings')
                    .delete()
                    .eq('user_id', userId)
                    .neq('id', userSettingsData[0].id)
                    .then(({ error: deleteError }) => {
                        if (deleteError) {
                            console.error('[Settings API GET] Error cleaning up duplicates:', deleteError);
                        } else {
                            console.log(`[Settings API GET] Cleaned up ${userSettingsData.length - 1} duplicate settings records`);
                        }
                    });
            }
            data = userSettingsData[0];
        }

        if (!data) {
            console.log('[Settings API GET] Settings not found by user_id, trying by id:', settingsId);
            
            // Try querying by id as fallback
            const { data: idData, error: idError } = await supabase
                .from('settings')
                .select('id, user_id, config, updated_at')
                .eq('id', settingsId)
                .maybeSingle(); // Use maybeSingle to avoid errors

            console.log('[Settings API GET] Query by id result:', { 
                data: idData ? { id: idData.id, user_id: idData.user_id, hasConfig: !!idData.config, updated_at: idData.updated_at } : null, 
                error: idError 
            });

            if (idData && idData.config) {
                console.log('[Settings API GET] Found settings by id, returning config');
                console.log('[Settings API GET] Appointment types in loaded config:', idData.config.appointmentTypes?.length || 0);
                console.log('[Settings API GET] Config companyLogo:', idData.config.companyLogo);
                
                // If user-specific settings don't have a logo, check 'default' settings as fallback
                if (!idData.config?.companyLogo || idData.config.companyLogo.trim() === '') {
                    console.log('[Settings API GET] User settings (by id) have no logo, checking default settings');
                    const { data: defaultData } = await supabase
                        .from('settings')
                        .select('config')
                        .eq('id', 'default')
                        .maybeSingle();
                    
                    if (defaultData?.config?.companyLogo && defaultData.config.companyLogo.trim() !== '') {
                        console.log('[Settings API GET] Found logo in default settings, merging:', defaultData.config.companyLogo);
                        // Merge default logo into user settings
                        idData.config.companyLogo = defaultData.config.companyLogo;
                    }
                }
                
                return NextResponse.json(idData.config);
            }

            // Fallback to 'default' settings for backwards compatibility
            const { data: defaultData, error: defaultError } = await supabase
                .from('settings')
                .select('config')
                .eq('id', 'default')
                .maybeSingle();

            console.log('[Settings API GET] Default settings query result:', { data: defaultData, error: defaultError });

            if (defaultData) {
                console.log('[Settings API GET] Returning default settings');
                return NextResponse.json(defaultData.config);
            }

            console.warn('[Settings API GET] Settings not found, returning defaults');
            return NextResponse.json(DEFAULT_SETTINGS);
        }

        console.log('[Settings API GET] Found settings by user_id, returning config');
        console.log('[Settings API GET] Appointment types in loaded config:', data.config?.appointmentTypes?.length || 0);
        console.log('[Settings API GET] Sample appointment types:', data.config?.appointmentTypes?.slice(0, 2));
        console.log('[Settings API GET] Config companyLogo:', data.config?.companyLogo);
        
        // If user-specific settings don't have a logo, check 'default' settings as fallback
        if (!data.config?.companyLogo || data.config.companyLogo.trim() === '') {
            console.log('[Settings API GET] User settings have no logo, checking default settings');
            const { data: defaultData } = await supabase
                .from('settings')
                .select('config')
                .eq('id', 'default')
                .maybeSingle();
            
            if (defaultData?.config?.companyLogo && defaultData.config.companyLogo.trim() !== '') {
                console.log('[Settings API GET] Found logo in default settings, merging:', defaultData.config.companyLogo);
                // Merge default logo into user settings
                data.config.companyLogo = defaultData.config.companyLogo;
            }
        }
        
        return NextResponse.json(data.config);
    } catch (error) {
        console.error('[Settings API GET] Exception caught:', error);
        console.error('[Settings API GET] Error type:', error instanceof Error ? error.constructor.name : typeof error);
        console.error('[Settings API GET] Error message:', error instanceof Error ? error.message : String(error));
        return NextResponse.json(DEFAULT_SETTINGS);
    }
}

export async function POST(request: Request) {
    try {
        console.log('[Settings API POST] Starting POST request');
        
        // Check authentication
        const { userId, isFallback, userEmail } = await checkAuthentication(request);
        console.log('[Settings API POST] Authentication check - userId:', userId, 'isFallback:', isFallback, 'userEmail:', userEmail);
        
        // For fallback auth, we need to create the user first or use a temporary ID
        // For now, reject saves if user doesn't exist (they need to run migration)
        if (isFallback) {
            console.error('[Settings API POST] Rejected - fallback user needs migration');
            return NextResponse.json({ 
                error: 'User account not found. Please run the database migration to create your user account.',
                requiresMigration: true
            }, { status: 403 });
        }
        
        if (!userId) {
            console.error('[Settings API POST] Unauthorized - no userId');
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const settings = await request.json();
        console.log('[Settings API POST] Received settings data');
        console.log('[Settings API POST] Settings keys:', Object.keys(settings));
        console.log('[Settings API POST] Appointment types count:', settings.appointmentTypes?.length || 0);
        console.log('[Settings API POST] Appointment types:', settings.appointmentTypes);

        // Generate a unique ID for user settings (or use user_id as id)
        const settingsId = `user-${userId}`;
        console.log('[Settings API POST] Settings ID:', settingsId);

        const upsertData = {
            id: settingsId,
            user_id: userId,
            config: settings,
            updated_at: new Date().toISOString()
        };
        console.log('[Settings API POST] Upsert data prepared:', {
            id: upsertData.id,
            user_id: upsertData.user_id,
            configKeys: Object.keys(upsertData.config),
            updated_at: upsertData.updated_at
        });

        const { data, error } = await supabase
            .from('settings')
            .upsert(upsertData)
            .select();

        if (error) {
            console.error('[Settings API POST] Supabase error saving settings:', error);
            console.error('[Settings API POST] Error code:', error.code);
            console.error('[Settings API POST] Error message:', error.message);
            console.error('[Settings API POST] Error details:', error.details);
            console.error('[Settings API POST] Error hint:', error.hint);
            throw error;
        }

        console.log('[Settings API POST] Upsert successful. Records affected:', data?.length || 0);
        console.log('[Settings API POST] Saved settings:', data?.[0]);
        
        return NextResponse.json({ success: true, recordsAffected: data?.length || 0 });
    } catch (error) {
        console.error('[Settings API POST] Exception caught:', error);
        console.error('[Settings API POST] Error type:', error instanceof Error ? error.constructor.name : typeof error);
        console.error('[Settings API POST] Error message:', error instanceof Error ? error.message : String(error));
        console.error('[Settings API POST] Error stack:', error instanceof Error ? error.stack : 'No stack');
        return NextResponse.json({ error: 'Failed to save settings' }, { status: 500 });
    }
}

