"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Users, Mic, Calendar, DollarSign, FileText, Bell } from "lucide-react";

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
        title: "Schedule",
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

export function Sidebar() {
    const pathname = usePathname();

    return (
        <div className="hidden border-r bg-muted/40 md:block md:w-64 lg:w-72 h-[calc(100vh-4rem)] sticky top-16">
            <div className="flex h-full max-h-screen flex-col gap-2">
                <div className="flex-1 overflow-auto py-2">
                    <nav className="grid items-start px-4 text-sm font-medium">
                        {sidebarItems.map((item) => (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={cn(
                                    "flex items-center gap-3 rounded-lg px-3 py-2 transition-all hover:text-primary",
                                    pathname === item.href
                                        ? "bg-muted text-primary"
                                        : "text-muted-foreground"
                                )}
                            >
                                <item.icon
                                    className={cn(
                                        "h-4 w-4 transition-colors",
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
            </div>
        </div>
    );
}
