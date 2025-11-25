"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Users, Mic, Calendar, DollarSign, FileText, Bell, X } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";

const sidebarItems = [
    {
        title: "Clients",
        href: "/clients",
        icon: Users,
        color: "text-sky-500",
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
        color: "text-orange-500",
    },
    {
        title: "Session Notes",
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
        color: "text-amber-500",
    },
];

const SidebarContent = ({ onNavigate }: { onNavigate?: () => void }) => {
    const pathname = usePathname();

    return (
        <>
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
                    Version 0.9.1
                </div>
            </div>
        </>
    );
};

export function Sidebar() {
    const [isMobileOpen, setIsMobileOpen] = useState(false);
    const pathname = usePathname();

    // Close mobile menu when route changes
    useEffect(() => {
        setIsMobileOpen(false);
    }, [pathname]);

    return (
        <>
            {/* Desktop Sidebar */}
            <div className="hidden border-r bg-muted/40 md:block md:w-64 lg:w-72 h-[calc(100vh-4rem)] sticky top-16">
                <div className="flex h-full max-h-screen flex-col gap-2">
                    <SidebarContent />
                </div>
            </div>

            {/* Mobile Sidebar Drawer */}
            <Sheet open={isMobileOpen} onOpenChange={setIsMobileOpen}>
                <SheetTrigger asChild className="md:hidden">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="fixed bottom-4 right-4 z-50 h-14 w-14 rounded-full shadow-lg bg-primary text-primary-foreground hover:bg-primary/90 md:hidden"
                        aria-label="Open menu"
                    >
                        <Users className="h-6 w-6" />
                    </Button>
                </SheetTrigger>
                <SheetContent side="left" className="w-72 p-0">
                    <div className="flex h-full flex-col">
                        <div className="flex items-center justify-between border-b px-6 py-4">
                            <h2 className="text-lg font-semibold">Menu</h2>
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setIsMobileOpen(false)}
                            >
                                <X className="h-5 w-5" />
                            </Button>
                        </div>
                        <SidebarContent onNavigate={() => setIsMobileOpen(false)} />
                    </div>
                </SheetContent>
            </Sheet>
        </>
    );
}
