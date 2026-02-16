import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || 'https://placeholder.supabase.co'
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() || 'placeholder-key'

// Only log warning in development, not during build
if (process.env.NODE_ENV === 'development' && (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)) {
    console.warn('Missing Supabase environment variables! Check your .env.local file.')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

/** Admin client (bypasses RLS) - use in API routes only. Requires SUPABASE_SERVICE_ROLE_KEY. */
export function getSupabaseAdmin() {
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
    if (!key) {
        throw new Error('SUPABASE_SERVICE_ROLE_KEY is required for admin operations')
    }
    return createClient(supabaseUrl, key)
}

// Helper to check if Supabase is properly configured
export function isSupabaseConfigured(): boolean {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()
    return !!(url && key && url !== 'https://placeholder.supabase.co' && key !== 'placeholder-key')
}
