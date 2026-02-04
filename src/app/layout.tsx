import type { Metadata, Viewport } from "next";
import { Outfit, Inter } from "next/font/google";
import "./globals.css";
import { ConditionalLayout } from "@/components/conditional-layout";
import { PWAInstallPrompt } from "@/components/pwa-install-prompt";
import { VersionUpdateModal } from "@/components/version-update-modal";

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "My Practice Helper",
  description: "The all-in-one platform for modern therapy practices. Scheduling, billing, notes, and more.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "My Practice Helper",
  },
  icons: {
    icon: [
      { url: "/icon-192x192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512x512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  themeColor: "#4F46E5",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className="scroll-smooth"
      data-scroll-behavior="smooth"
      suppressHydrationWarning
    >
      <body
        className={`${outfit.variable} ${inter.variable} antialiased font-sans bg-background text-foreground`}
        suppressHydrationWarning
      >
        <PWAInstallPrompt />
        <VersionUpdateModal />
        <ConditionalLayout>{children}</ConditionalLayout>
      </body>
    </html>
  );
}
