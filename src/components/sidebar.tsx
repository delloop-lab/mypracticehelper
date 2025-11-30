"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { APP_VERSION } from "@/lib/version";
import { Users, Mic, Calendar, DollarSign, FileText, Bell, X, Link as LinkIcon, Archive } from "lucide-react";
import Image from "next/image";
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { useState, useEffect, useMemo } from "react";

const sidebarItems = [
    {
        title: "Clients",
        href: "/clients",
        icon: Users,
        color: "text-blue-500",
    },
    {
        title: "Voice Notes",
        href: "/recordings",
        icon: Mic,
        color: "text-purple-500",
    },
    {
        title: "Calendar",
        href: "/schedule",
        icon: Calendar,
        color: "text-blue-500",
    },
    {
        title: "Reminders",
        href: "/reminders",
        icon: Bell,
        color: "text-pink-500",
    },
    {
        title: "Sessions",
        href: "/session-notes",
        icon: FileText,
        color: "text-green-500",
    },
    {
        title: "Revenue",
        href: "/payments",
        icon: DollarSign,
        color: "text-pink-500",
    },
    {
        title: "Documents",
        href: "/documents",
        icon: FileText,
        color: "text-blue-500",
    },
    {
        title: "Links",
        href: "/links",
        icon: LinkIcon,
        color: "text-purple-500",
    },
];

const SidebarContent = ({ onNavigate, companyLogo, logoVersion }: { onNavigate?: () => void; companyLogo?: string; logoVersion?: number }) => {
    const pathname = usePathname();
    // Always use company logo if it's set and not empty, otherwise use default
    // Add cache-busting timestamp to force reload of latest logo
    const logoSrc = useMemo(() => {
        let src = (companyLogo && companyLogo.trim() !== "") ? companyLogo : "/your-logo-here.png";
        if (src.startsWith('http') || src.includes('supabase.co')) {
            // Remove any existing timestamp query params and add a new one with version
            const url = new URL(src);
            url.searchParams.set('v', (logoVersion || 0).toString());
            url.searchParams.set('t', Date.now().toString());
            return url.toString();
        }
        return src;
    }, [companyLogo, logoVersion]);

    return (
        <>
            {/* Logo */}
            <div className="px-4 py-4">
                <Link href="/dashboard" className="flex items-center">
                    {logoSrc.startsWith('http') || logoSrc.includes('supabase.co') ? (
                        <img
                            src={logoSrc}
                            alt="My Practice Helper"
                            key={`company-logo-${companyLogo || 'default'}`}
                            className="w-1/2 h-auto object-contain mx-auto"
                            onError={(e) => {
                                console.error('Sidebar logo failed to load:', logoSrc);
                                // Fallback to default logo if image fails to load
                                (e.target as HTMLImageElement).src = "/your-logo-here.png";
                            }}
                            onLoad={() => {
                                console.log('Sidebar logo loaded successfully:', logoSrc);
                            }}
                        />
                    ) : (
                        <Image
                            src={logoSrc}
                            alt="My Practice Helper"
                            width={90}
                            height={30}
                            className="w-1/2 h-auto mx-auto"
                            priority
                            key={`company-logo-${companyLogo || 'default'}`}
                        />
                    )}
                </Link>
            </div>
            <div className="flex-1 overflow-auto py-2">
                <nav className="grid items-start px-4 text-sm lg:text-base font-medium">
                    {sidebarItems.map((item) => (
                        <Link
                            key={item.href}
                            href={item.href}
                            onClick={onNavigate}
                            className={cn(
                                "flex items-center gap-3 rounded-lg px-3 py-2.5 lg:py-3 transition-all hover:text-primary",
                                pathname === item.href
                                    ? "bg-muted text-primary font-semibold"
                                    : "text-muted-foreground"
                            )}
                        >
                            <item.icon
                                className={cn(
                                    "h-5 w-5 transition-colors",
                                    pathname === item.href
                                        ? item.color
                                        : `${item.color} opacity-80`
                                )}
                            />
                            {item.title}
                        </Link>
                    ))}
                </nav>
            </div>
            <div className="mt-auto border-t px-4 py-3">
                <div className="text-xs text-muted-foreground text-center">
                    Version {APP_VERSION}
                </div>
            </div>
        </>
    );
};

export function Sidebar() {
    const [isMobileOpen, setIsMobileOpen] = useState(false);
    const [touchStart, setTouchStart] = useState<number | null>(null);
    const [touchEnd, setTouchEnd] = useState<number | null>(null);
    const [companyLogo, setCompanyLogo] = useState<string | undefined>(undefined);
    const [logoVersion, setLogoVersion] = useState(0); // Version counter to force refresh
    const pathname = usePathname();

    // Fetch company logo from settings (only on mount and when logo-updated event fires)
    useEffect(() => {
        const fetchCompanyLogo = async (forceRefresh: boolean = false) => {
            try {
                const response = await fetch(`/api/settings?t=${Date.now()}`);
                if (response.ok) {
                    const data = await response.json();
                    // The API returns the config directly, so companyLogo is at the root level
                    const newLogo = (data.companyLogo && data.companyLogo.trim() !== "") ? data.companyLogo : undefined;
                    
                    setCompanyLogo((currentLogo) => {
                        // Only update if logo changed or if forcing refresh
                        if (newLogo !== currentLogo || forceRefresh) {
                            // Increment version to force image refresh when logo changes
                            if (forceRefresh || newLogo !== currentLogo) {
                                setLogoVersion(prev => prev + 1);
                                console.log('Logo updated, incrementing version. New logo:', newLogo);
                            }
                            return newLogo;
                        }
                        return currentLogo;
                    });
                }
            } catch (error) {
                console.error('Error fetching company logo:', error);
            }
        };
        
        // Fetch immediately on mount
        fetchCompanyLogo();
        
        // Listen for custom event when logo is updated (no polling needed)
        const handleLogoUpdate = () => {
            console.log('Logo update event received, forcing refresh...');
            fetchCompanyLogo(true);
        };
        window.addEventListener('logo-updated', handleLogoUpdate);
        
        return () => {
            window.removeEventListener('logo-updated', handleLogoUpdate);
        };
    }, []); // Empty dependency array - only run on mount

    // Close mobile menu when route changes
    useEffect(() => {
        setIsMobileOpen(false);
    }, [pathname]);

    // Minimum swipe distance (in pixels)
    const minSwipeDistance = 50;

    const onTouchStart = (e: React.TouchEvent) => {
        setTouchEnd(null);
        setTouchStart(e.targetTouches[0].clientX);
    };

    const onTouchMove = (e: React.TouchEvent) => {
        setTouchEnd(e.targetTouches[0].clientX);
    };

    const onTouchEnd = () => {
        if (!touchStart || !touchEnd) return;
        
        const distance = touchStart - touchEnd;
        const isRightSwipe = distance < -minSwipeDistance;
        const isLeftSwipe = distance > minSwipeDistance;
        
        // Swipe from left edge (within 60px) to the right to open menu
        if (touchStart < 60 && isRightSwipe && !isMobileOpen) {
            setIsMobileOpen(true);
        }
        
        // Swipe left to close menu (when menu is open) - swipe from anywhere on the menu
        if (isLeftSwipe && isMobileOpen && Math.abs(distance) > minSwipeDistance) {
            setIsMobileOpen(false);
        }
        
        // Reset touch positions
        setTouchStart(null);
        setTouchEnd(null);
    };

    return (
        <>
            {/* Desktop Sidebar */}
            <div className="hidden border-r bg-muted/40 md:block md:w-64 lg:w-72 h-[calc(100vh-4rem)] sticky top-16">
                <div className="flex h-full max-h-screen flex-col gap-2">
                    <SidebarContent companyLogo={companyLogo} logoVersion={logoVersion} />
                </div>
            </div>

            {/* Mobile Sidebar Drawer */}
            <Sheet open={isMobileOpen} onOpenChange={setIsMobileOpen}>
                <SheetContent 
                    side="left" 
                    className="w-72 p-0"
                    onTouchStart={onTouchStart}
                    onTouchMove={onTouchMove}
                    onTouchEnd={onTouchEnd}
                >
                    <SheetHeader className="border-b px-6 py-4">
                        <SheetTitle>Menu</SheetTitle>
                        <SheetDescription className="sr-only">Navigation menu</SheetDescription>
                    </SheetHeader>
                    <div className="flex h-full flex-col overflow-hidden">
                        <SidebarContent onNavigate={() => setIsMobileOpen(false)} companyLogo={companyLogo} logoVersion={logoVersion} />
                    </div>
                </SheetContent>
            </Sheet>
            
            {/* Touch handler overlay for swipe gesture - only on mobile when menu is closed */}
            {!isMobileOpen && (
                <div
                    className="md:hidden fixed left-0 top-0 bottom-0 w-[60px] z-30 touch-none"
                    onTouchStart={onTouchStart}
                    onTouchMove={onTouchMove}
                    onTouchEnd={onTouchEnd}
                    style={{ touchAction: 'none' }}
                />
            )}
            
            {/* Touch handler for closing menu - overlay when menu is open */}
            {isMobileOpen && (
                <div
                    className="md:hidden fixed inset-0 z-40 bg-black/50"
                    onTouchStart={onTouchStart}
                    onTouchMove={onTouchMove}
                    onTouchEnd={onTouchEnd}
                    onClick={() => setIsMobileOpen(false)}
                    style={{ touchAction: 'pan-x pan-y' }}
                />
            )}
        </>
    );
}
