"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar, CreditCard, FileText, ShieldCheck, Video, Users } from "lucide-react";

const features = [
    {
        title: "Scheduling & Calendar",
        description: "Client portal, automated reminders, and sync with Google/Outlook calendars.",
        icon: Calendar,
    },
    {
        title: "Billing & Payments",
        description: "Auto-pay, invoices, and secure credit card processing with Stripe integration.",
        icon: CreditCard,
    },
    {
        title: "Insurance Claims",
        description: "File claims electronically and track status in real-time. Automated eligibility checks.",
        icon: ShieldCheck,
    },
    {
        title: "Notes & Documentation",
        description: "Customizable templates, Wiley Treatment Planners, and HIPAA-compliant storage.",
        icon: FileText,
    },
    {
        title: "Telehealth",
        description: "Secure, high-quality video sessions integrated directly into your practice management.",
        icon: Video,
    },
    {
        title: "Client Portal",
        description: "Secure messaging, document sharing, and online booking for your clients.",
        icon: Users,
    },
];

export function Features() {
    return (
        <section id="features" className="py-20 bg-muted/30">
            <div className="container px-4 md:px-8">
                <div className="flex flex-col items-center justify-center space-y-4 text-center mb-12">
                    <h2 className="text-3xl font-bold tracking-tighter sm:text-4xl md:text-5xl">
                        Everything You Need to Run Your Practice
                    </h2>
                    <p className="max-w-[700px] text-muted-foreground md:text-xl/relaxed lg:text-base/relaxed xl:text-xl/relaxed">
                        Focus on your clients while we handle the administrative heavy lifting.
                    </p>
                </div>
                <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                    {features.map((feature, index) => (
                        <Card key={index} className="group relative overflow-hidden border-primary/10 bg-background/50 backdrop-blur-sm transition-all hover:shadow-lg hover:-translate-y-1">
                            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
                            <CardHeader>
                                <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                                    <feature.icon className="h-6 w-6" />
                                </div>
                                <CardTitle className="text-xl">{feature.title}</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <CardDescription className="text-base">
                                    {feature.description}
                                </CardDescription>
                            </CardContent>
                        </Card>
                    ))}
                </div>

                {/* Feature Highlight: Telehealth */}
                <div className="mt-24 grid gap-12 lg:grid-cols-2 items-center">
                    <div className="order-2 lg:order-1 relative aspect-video rounded-2xl overflow-hidden shadow-2xl border border-white/20 group">
                        <img
                            src="/telehealth-image.png"
                            alt="Secure Telehealth Interface"
                            className="object-cover w-full h-full transition-transform duration-700 group-hover:scale-105"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                        <div className="absolute bottom-6 left-6 text-white">
                            <div className="flex items-center space-x-2 mb-1">
                                <div className="h-2 w-2 rounded-full bg-green-400 animate-pulse" />
                                <p className="font-semibold text-sm">Secure Connection</p>
                            </div>
                            <p className="text-xs opacity-80">End-to-end encrypted • HIPAA Compliant</p>
                        </div>
                    </div>
                    <div className="order-1 lg:order-2 space-y-6">
                        <div className="inline-block rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary">
                            Built-in Telehealth
                        </div>
                        <h3 className="text-3xl font-bold tracking-tight md:text-4xl">
                            Connect with Clients Anywhere
                        </h3>
                        <p className="text-muted-foreground text-lg">
                            No more third-party apps or complicated links. Conduct sessions directly from your dashboard with our fully integrated, HIPAA-compliant telehealth solution.
                        </p>
                        <ul className="space-y-3">
                            {["No downloads required for clients", "Virtual waiting room with custom branding", "Integrated session notes & billing", "Screen sharing & whiteboard tools"].map((item, i) => (
                                <li key={i} className="flex items-center text-muted-foreground">
                                    <div className="mr-3 flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-primary">
                                        <Video className="h-3.5 w-3.5" />
                                    </div>
                                    {item}
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>
            </div>
        </section>
    );
}
