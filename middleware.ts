import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
    // Get the pathname
    const { pathname } = request.nextUrl;

    // Allow access to login page, root page (redirects to login), public assets, webhook setup pages, and landing page
    // Also allow static files (images, fonts, etc.) from public folder
    // IMPORTANT: Also allow PWA files (manifest.json, offline.html)
    if (
        pathname === '/login' ||
        pathname === '/' ||
        pathname === '/landing' ||
        pathname.startsWith('/_next') ||
        pathname.startsWith('/api') ||
        pathname.startsWith('/favicon') ||
        pathname === '/webhook-setup' ||
        pathname === '/webhook-status' ||
        pathname === '/manifest.json' ||  // PWA manifest
        pathname === '/offline.html' ||    // PWA offline page
        // Allow static files from public folder
        pathname.endsWith('.png') ||
        pathname.endsWith('.jpg') ||
        pathname.endsWith('.jpeg') ||
        pathname.endsWith('.gif') ||
        pathname.endsWith('.svg') ||
        pathname.endsWith('.webp') ||
        pathname.endsWith('.ico') ||
        pathname.endsWith('.woff') ||
        pathname.endsWith('.woff2') ||
        pathname.endsWith('.ttf') ||
        pathname.endsWith('.js') ||
        pathname.endsWith('.css') ||
        pathname.endsWith('.html')
    ) {
        return NextResponse.next();
    }

    // Check for authentication cookie
    const isAuthenticated = request.cookies.get('isAuthenticated')?.value === 'true';

    // If not authenticated, redirect to login
    if (!isAuthenticated) {
        const loginUrl = new URL('/login', request.url);
        return NextResponse.redirect(loginUrl);
    }

    return NextResponse.next();
}

export const config = {
    matcher: [
        /*
         * Match all request paths except for the ones starting with:
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico (favicon file)
         * - Static file extensions (.png, .jpg, .svg, etc.)
         */
        '/((?!_next/static|_next/image|favicon.ico|.*\\.png$|.*\\.jpg$|.*\\.jpeg$|.*\\.gif$|.*\\.svg$|.*\\.webp$|.*\\.ico$).*)',
    ],
};
