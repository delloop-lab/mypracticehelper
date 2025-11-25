"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { Menu } from "lucide-react";
import { cn } from "@/lib/utils";
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
import { Sheet, SheetContent, SheetTrigger, SheetClose } from "@/components/ui/sheet";

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
    description: "HIPAA-compliant clinical notes and templates.",
  },
];

export function Navbar() {
  const [isOpen, setIsOpen] = React.useState(false);

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/80 backdrop-blur-md supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center justify-between px-4 md:px-8">
        <div className="mr-4 flex items-center">
          <Link href="/" className="mr-6 flex items-center">
            <Image
              src="/logo.png"
              alt="My Practice Helper"
              width={180}
              height={40}
              className="h-8 w-auto"
              priority
            />
          </Link>
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
            </NavigationMenuList>
          </NavigationMenu>
        </div>

        {/* Mobile Menu Trigger */}
        <Sheet open={isOpen} onOpenChange={setIsOpen}>
          <SheetTrigger asChild className="md:hidden">
            <Button variant="ghost" size="icon" className="mr-2">
              <Menu className="h-5 w-5" />
              <span className="sr-only">Toggle Menu</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="pr-0">
            <Link href="/" className="flex items-center" onClick={() => setIsOpen(false)}>
              <Image
                src="/logo.png"
                alt="My Practice Helper"
                width={180}
                height={40}
                className="h-8 w-auto"
                priority
              />
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
                    Voice Notes
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
                    Session Notes
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
              </div>
            </div>
          </SheetContent>
        </Sheet>

        <div className="flex items-center justify-between space-x-2 md:justify-end">
          <div className="w-full flex-1 md:w-auto md:flex-none">
            {/* Add search or other items here if needed */}
          </div>
          <nav className="flex items-center space-x-2">
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
