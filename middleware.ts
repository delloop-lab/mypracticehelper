import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
    // Get the pathname
    const { pathname } = request.nextUrl;

    // Allow access to login page, root page (redirects to login), public assets, and webhook setup pages
    if (
        pathname === '/login' ||
        pathname === '/' ||
        pathname.startsWith('/_next') ||
        pathname.startsWith('/api') ||
        pathname.startsWith('/favicon') ||
        pathname === '/webhook-setup' ||
        pathname === '/webhook-status'
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
         */
        '/((?!_next/static|_next/image|favicon.ico).*)',
    ],
};
