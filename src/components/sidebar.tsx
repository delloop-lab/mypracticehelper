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
    },
    {
        title: "Voice Notes",
        href: "/recordings",
        icon: Mic,
    },
    {
        title: "Schedule",
        href: "/schedule",
        icon: Calendar,
    },
    {
        title: "Reminders",
        href: "/reminders",
        icon: Bell,
    },
    {
        title: "Session Notes",
        href: "/session-notes",
        icon: FileText,
    },
    {
        title: "Revenue",
        href: "/payments",
        icon: DollarSign,
    },
    {
        title: "Documents",
        href: "/documents",
        icon: FileText,
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
                                <item.icon className="h-4 w-4" />
                                {item.title}
                            </Link>
                        ))}
                    </nav>
                </div>
            </div>
        </div>
    );
}
