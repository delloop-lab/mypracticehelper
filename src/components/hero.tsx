"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { ArrowRight, Calendar, Shield, Activity } from "lucide-react";

export function Hero() {
    return (
        <section className="relative overflow-hidden py-20 md:py-32 lg:py-40">
            {/* Background Gradients */}
            <div className="absolute inset-0 -z-10 overflow-hidden">
                <div className="absolute -top-[20%] -left-[10%] h-[500px] w-[500px] rounded-full bg-primary/20 blur-[100px]" />
                <div className="absolute top-[10%] -right-[10%] h-[600px] w-[600px] rounded-full bg-secondary/20 blur-[100px]" />
                <div className="absolute bottom-[10%] left-[20%] h-[400px] w-[400px] rounded-full bg-accent/30 blur-[100px]" />
            </div>

            <div className="container px-4 md:px-8">
                <div className="grid gap-12 lg:grid-cols-2 lg:gap-8 items-center">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5 }}
                        className="flex flex-col justify-center space-y-8"
                    >
                        <div className="space-y-4">
                            <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl xl:text-6xl/none bg-clip-text text-transparent bg-gradient-to-r from-primary to-secondary-foreground">
                                The All-in-One Platform for Modern Therapy Practices
                            </h1>
                            <p className="max-w-[600px] text-muted-foreground md:text-xl">
                                Streamline your practice with scheduling, billing, insurance, and notes—all in one beautiful, secure place.
                            </p>
                        </div>
                        <div className="flex flex-col gap-2 min-[400px]:flex-row">
                            <Button size="lg" className="bg-primary hover:bg-primary/90 text-primary-foreground" asChild>
                                <Link href="/login">
                                    Get Started <ArrowRight className="ml-2 h-4 w-4" />
                                </Link>
                            </Button>
                            <Button size="lg" variant="outline" className="border-primary/20 hover:bg-primary/5" asChild>
                                <Link href="/demo">View Demo</Link>
                            </Button>
                        </div>
                        <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                            <div className="flex -space-x-2">
                                {[1, 2, 3, 4].map((i) => (
                                    <div key={i} className="h-8 w-8 rounded-full border-2 border-background bg-muted" />
                                ))}
                            </div>
                            <p>Trusted by 10,000+ therapists</p>
                        </div>
                    </motion.div>

                    {/* Hero Image & Floating Elements */}
                    <div className="relative mx-auto aspect-square w-full max-w-[500px] lg:max-w-none">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ duration: 0.5, delay: 0.2 }}
                            className="relative z-10"
                        >
                            <img
                                src="/hero-image.png"
                                alt="Therapist Dashboard"
                                className="rounded-3xl shadow-2xl border border-white/20 object-cover w-full h-full"
                            />
                        </motion.div>

                        {/* Floating Cards Overlay */}
                        <div className="absolute inset-0 z-20 pointer-events-none">
                            {/* Card 1: Scheduling */}
                            <motion.div
                                animate={{ y: [0, -10, 0] }}
                                transition={{ repeat: Infinity, duration: 5, ease: "easeInOut" }}
                                className="absolute -top-6 -left-6 w-48 rounded-2xl border border-white/40 bg-white/60 p-4 shadow-xl backdrop-blur-md dark:bg-black/40 dark:border-white/10"
                            >
                                <div className="flex items-center space-x-3">
                                    <div className="rounded-full bg-primary/20 p-2 text-primary">
                                        <Calendar className="h-5 w-5" />
                                    </div>
                                    <div>
                                        <h3 className="font-semibold text-sm">Scheduling</h3>
                                        <p className="text-xs text-muted-foreground">Next: 2:00 PM</p>
                                    </div>
                                </div>
                            </motion.div>

                            {/* Card 2: Insurance */}
                            <motion.div
                                animate={{ y: [0, 10, 0] }}
                                transition={{ repeat: Infinity, duration: 6, ease: "easeInOut", delay: 1 }}
                                className="absolute top-1/2 -right-8 w-40 rounded-2xl border border-white/40 bg-white/60 p-4 shadow-xl backdrop-blur-md dark:bg-black/40 dark:border-white/10"
                            >
                                <div className="flex flex-col space-y-2">
                                    <div className="rounded-full bg-secondary/20 p-2 text-secondary-foreground w-fit">
                                        <Shield className="h-5 w-5" />
                                    </div>
                                    <h3 className="font-semibold text-sm">Insurance</h3>
                                    <p className="text-[10px] text-muted-foreground">Verified</p>
                                </div>
                            </motion.div>

                            {/* Card 3: Analytics */}
                            <motion.div
                                animate={{ y: [0, -8, 0] }}
                                transition={{ repeat: Infinity, duration: 7, ease: "easeInOut", delay: 0.5 }}
                                className="absolute -bottom-6 left-8 w-44 rounded-2xl border border-white/40 bg-white/60 p-4 shadow-xl backdrop-blur-md dark:bg-black/40 dark:border-white/10"
                            >
                                <div className="flex items-center space-x-3">
                                    <div className="rounded-full bg-accent/20 p-2 text-accent-foreground">
                                        <Activity className="h-5 w-5" />
                                    </div>
                                    <div>
                                        <h3 className="font-semibold text-sm">Growth</h3>
                                        <p className="text-xs text-muted-foreground">+15% this month</p>
                                    </div>
                                </div>
                            </motion.div>
                        </div>

                        {/* Decorative Glow */}
                        <div className="absolute inset-0 -z-10 rounded-full bg-primary/20 blur-[80px]" />
                    </div>
                </div>
            </div>
        </section>
    );
}
