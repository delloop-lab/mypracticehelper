"use client";

import * as React from "react";
import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
import { HelpCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { APP_VERSION } from "@/lib/version";
import { Button } from "@/components/ui/button";
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
  navigationMenuTriggerStyle,
} from "@/components/ui/navigation-menu";
import { Sheet, SheetContent, SheetTrigger, SheetClose, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";

const components: { title: string; href: string; description: string }[] = [
  {
    title: "Scheduling",
    href: "#features",
    description: "Effortless calendar management for your practice.",
  },
  {
    title: "Billing & Payments",
    href: "#features",
    description: "Secure payment processing and automated invoicing.",
  },
  {
    title: "Insurance",
    href: "#features",
    description: "Streamlined insurance claims and verification.",
  },
  {
    title: "Notes & Documentation",
    href: "#features",
    description: "HIPAA-compliant session notes and templates.",
  },
];

export function Navbar() {
  const [isOpen, setIsOpen] = React.useState(false);
  const [companyLogo, setCompanyLogo] = useState<string | undefined>(undefined);
  const [logoVersion, setLogoVersion] = useState(0); // Version counter to force refresh

  // Fetch company logo from settings (only on mount and when logo-updated event fires)
  useEffect(() => {
    const fetchCompanyLogo = async (forceRefresh: boolean = false) => {
      try {
        const response = await fetch(`/api/settings?t=${Date.now()}`, {
          credentials: 'include', // Include cookies for authentication
        });
        
        if (response.ok) {
          const data = await response.json();
          console.log('[Navbar] Settings API response:', { 
            hasCompanyLogo: !!data.companyLogo, 
            companyLogo: data.companyLogo,
            companyLogoLength: data.companyLogo?.length || 0
          });
          
          // The API returns the config directly, so companyLogo is at the root level
          const newLogo = (data.companyLogo && data.companyLogo.trim() !== "") ? data.companyLogo : undefined;
          console.log('[Navbar] Processed logo:', { newLogo, isEmpty: !newLogo });
          
          setCompanyLogo((currentLogo) => {
            // Only update if logo changed or if forcing refresh
            if (newLogo !== currentLogo || forceRefresh) {
              // Increment version to force image refresh when logo changes
              if (forceRefresh || newLogo !== currentLogo) {
                setLogoVersion(prev => prev + 1);
                console.log('[Navbar] Logo updated, incrementing version. New logo:', newLogo, 'Old logo:', currentLogo);
              }
              return newLogo;
            }
            return currentLogo;
          });
        } else if (response.status === 401) {
          // 401 is expected when user is not authenticated - don't log as error
          // This can happen during redirects or when session expires
          console.log('[Navbar] Settings API returned 401 (not authenticated)');
        } else {
          console.error('[Navbar] Settings API response not OK:', response.status, response.statusText);
          const errorText = await response.text();
          console.error('[Navbar] Error response:', errorText);
        }
      } catch (error) {
        console.error('[Navbar] Error fetching company logo:', error);
      }
    };
    
    // Fetch immediately on mount
    fetchCompanyLogo();
    
    // Listen for custom event when logo is updated (no polling needed)
    const handleLogoUpdate = () => {
      console.log('Logo update event received in navbar, forcing refresh...');
      fetchCompanyLogo(true);
    };
    window.addEventListener('logo-updated', handleLogoUpdate);
    
    return () => {
      window.removeEventListener('logo-updated', handleLogoUpdate);
    };
  }, []); // Empty dependency array - only run on mount

  // Calculate logo source for mobile menu - should NEVER show logo.png, only custom logo or your-logo-here.png
  const menuLogoSrc = useMemo(() => {
    console.log('[Navbar] Calculating menuLogoSrc:', { 
      companyLogo, 
      hasCompanyLogo: !!companyLogo,
      logoVersion 
    });
    
    // Only use companyLogo if it exists, is not empty, and is NOT the default app logo (/logo.png)
    // Allow company-logo.png and other uploaded logos, just exclude the default /logo.png
    const isDefaultAppLogo = companyLogo === '/logo.png';
    let src = (companyLogo && companyLogo.trim() !== "" && !isDefaultAppLogo) 
        ? companyLogo 
        : "/your-logo-here.png";
    
    console.log('[Navbar] Initial src calculation:', { src, companyLogo, isDefaultAppLogo });
    
    // Final safety check: ensure we never use the default app logo.png in menu
    if (src === '/logo.png') {
      src = "/your-logo-here.png";
      console.log('[Navbar] Filtered out default logo.png, using default');
    }
    
    if (src.startsWith('http') || src.includes('supabase.co')) {
      // Remove any existing timestamp query params and add a new one with version
      const url = new URL(src);
      url.searchParams.set('v', (logoVersion || 0).toString());
      url.searchParams.set('t', Date.now().toString());
      const finalSrc = url.toString();
      console.log('[Navbar] Final logo src (URL):', finalSrc);
      return finalSrc;
    }
    
    console.log('[Navbar] Final logo src (local):', src);
    return src;
  }, [companyLogo, logoVersion]);

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/80 backdrop-blur-md supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-16 items-center justify-between">
        <div className="flex items-center pl-[50px]">
          <Link href="/dashboard" className="flex items-center">
            {menuLogoSrc.startsWith('http') || menuLogoSrc.includes('supabase.co') ? (
              <img
                src={menuLogoSrc}
                alt="ALGHARVE Therapy Centre"
                key={`header-logo-${companyLogo || 'default'}`}
                className="h-12 sm:h-16 w-auto object-contain"
                onError={(e) => {
                  console.error('Header logo failed to load:', menuLogoSrc);
                  (e.target as HTMLImageElement).src = "/your-logo-here.png";
                }}
              />
            ) : (
              <Image
                src={menuLogoSrc}
                alt="ALGHARVE Therapy Centre"
                width={200}
                height={64}
                className="h-12 sm:h-16 w-auto"
                priority
                key={`header-logo-${companyLogo || 'default'}`}
              />
            )}
          </Link>
        </div>

        {/* Mobile Menu - Swipe only, no hamburger */}
        <Sheet open={isOpen} onOpenChange={setIsOpen}>
          <SheetContent side="left" className="pr-0">
            <SheetHeader className="px-6 py-4">
              <SheetTitle className="sr-only">Navigation Menu</SheetTitle>
              <SheetDescription className="sr-only">Main navigation menu</SheetDescription>
            </SheetHeader>
            <Link href="/dashboard" className="flex items-center px-6" onClick={() => setIsOpen(false)}>
              {menuLogoSrc.startsWith('http') || menuLogoSrc.includes('supabase.co') ? (
                <img
                  src={menuLogoSrc}
                  alt="My Practice Helper"
                  key={`menu-logo-${companyLogo || 'default'}`}
                  className="h-8 w-auto object-contain"
                  onError={(e) => {
                    console.error('Menu logo failed to load:', menuLogoSrc);
                    // Fallback to default logo if image fails to load
                    (e.target as HTMLImageElement).src = "/your-logo-here.png";
                  }}
                  onLoad={() => {
                    console.log('Menu logo loaded successfully:', menuLogoSrc);
                  }}
                />
              ) : (
                <Image
                  src={menuLogoSrc}
                  alt="My Practice Helper"
                  width={150}
                  height={32}
                  className="h-8 w-auto"
                  priority
                  key={`menu-logo-${companyLogo || 'default'}`}
                />
              )}
            </Link>
            <div className="my-4 h-[calc(100vh-8rem)] pb-10 pl-6">
              <div className="flex flex-col space-y-3">
                <SheetClose asChild>
                  <Link href="/dashboard" className="flex items-center py-2 text-lg font-medium">
                    Dashboard
                  </Link>
                </SheetClose>
                <SheetClose asChild>
                  <Link href="/clients" className="flex items-center py-2 text-lg font-medium">
                    Clients
                  </Link>
                </SheetClose>
                <SheetClose asChild>
                  <Link href="/recordings" className="flex items-center py-2 text-lg font-medium">
                    Recording
                  </Link>
                </SheetClose>
                <SheetClose asChild>
                  <Link href="/schedule" className="flex items-center py-2 text-lg font-medium">
                    Schedule
                  </Link>
                </SheetClose>
                <SheetClose asChild>
                  <Link href="/reminders" className="flex items-center py-2 text-lg font-medium">
                    Reminders
                  </Link>
                </SheetClose>
                <SheetClose asChild>
                  <Link href="/session-notes" className="flex items-center py-2 text-lg font-medium">
                    Sessions
                  </Link>
                </SheetClose>
                <SheetClose asChild>
                  <Link href="/payments" className="flex items-center py-2 text-lg font-medium">
                    Revenue
                  </Link>
                </SheetClose>
                <SheetClose asChild>
                  <Link href="/documents" className="flex items-center py-2 text-lg font-medium">
                    Documents
                  </Link>
                </SheetClose>
                <SheetClose asChild>
                  <Link href="/settings" className="flex items-center py-2 text-lg font-medium">
                    Settings
                  </Link>
                </SheetClose>
                <SheetClose asChild>
                  <Link href="/help" className="flex items-center py-2 text-lg font-medium">
                    <HelpCircle className="h-5 w-5 mr-2" />
                    Help
                  </Link>
                </SheetClose>
                <SheetClose asChild>
                  <Link href="/contact" className="flex items-center py-2 text-lg font-medium">
                    Contact
                  </Link>
                </SheetClose>
              </div>
              <div className="mt-auto border-t px-6 py-4">
                <div className="text-xs text-muted-foreground text-center">
                  Version {APP_VERSION}
                </div>
              </div>
            </div>
          </SheetContent>
        </Sheet>

        <div className="flex items-center justify-between space-x-2 md:justify-end pr-4 md:pr-8">
          <div className="w-full flex-1 md:w-auto md:flex-none">
            {/* Add search or other items here if needed */}
          </div>
          <nav className="flex items-center space-x-2">
            <NavigationMenu className="hidden md:block">
              <NavigationMenuList>
                <NavigationMenuItem>
                  <NavigationMenuLink asChild>
                    <Link href="/dashboard" className={navigationMenuTriggerStyle()}>
                      Dashboard
                    </Link>
                  </NavigationMenuLink>
                </NavigationMenuItem>
                <NavigationMenuItem>
                  <NavigationMenuLink asChild>
                    <Link href="/settings" className={navigationMenuTriggerStyle()}>
                      Settings
                    </Link>
                  </NavigationMenuLink>
                </NavigationMenuItem>
                <NavigationMenuItem>
                  <NavigationMenuLink asChild>
                    <Link href="/help" className={navigationMenuTriggerStyle()}>
                      Help
                    </Link>
                  </NavigationMenuLink>
                </NavigationMenuItem>
                <NavigationMenuItem>
                  <NavigationMenuLink asChild>
                    <Link href="/contact" className={navigationMenuTriggerStyle()}>
                      Contact
                    </Link>
                  </NavigationMenuLink>
                </NavigationMenuItem>
              </NavigationMenuList>
            </NavigationMenu>
            <Button
              variant="outline"
              onClick={() => {
                document.cookie = "isAuthenticated=; path=/; max-age=0";
                localStorage.removeItem("isAuthenticated");
                localStorage.removeItem("userEmail");
                window.location.href = "/login";
              }}
            >
              Log out
            </Button>
          </nav>
        </div>
      </div>
    </header>
  );
}

const ListItem = React.forwardRef<
  React.ElementRef<"a">,
  React.ComponentPropsWithoutRef<"a">
>(({ className, title, children, ...props }, ref) => {
  return (
    <li>
      <NavigationMenuLink asChild>
        <a
          ref={ref}
          className={cn(
            "block select-none space-y-1 rounded-md p-3 leading-none no-underline outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground",
            className
          )}
          {...props}
        >
          <div className="text-sm font-medium leading-none">{title}</div>
          <p className="line-clamp-2 text-sm leading-snug text-muted-foreground">
            {children}
          </p>
        </a>
      </NavigationMenuLink>
    </li>
  );
});
ListItem.displayName = "ListItem";
