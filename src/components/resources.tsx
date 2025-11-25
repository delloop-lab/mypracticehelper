"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowRight, BookOpen, Download, Calendar } from "lucide-react";

export function Resources() {
    return (
        <section id="resources" className="py-20">
            <div className="container px-4 md:px-8">
                <div className="flex flex-col items-center justify-center space-y-4 text-center mb-12">
                    <h2 className="text-3xl font-bold tracking-tighter sm:text-4xl md:text-5xl">
                        Resources for Your Practice
                    </h2>
                    <div className="grid gap-8 md:grid-cols-3">
                        {/* Blog */}
                        <Card className="flex flex-col group relative overflow-hidden border-primary/10 bg-background/50 backdrop-blur-sm transition-all hover:shadow-lg hover:-translate-y-1">
                            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
                            <CardHeader>
                                <div className="mb-4 w-fit rounded-full bg-primary/10 p-3 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                                    <BookOpen className="h-6 w-6" />
                                </div>
                                <CardTitle>Blog</CardTitle>
                                <CardDescription>
                                    Insights on practice management, marketing, and clinical trends.
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="flex-1 relative z-10">
                                <ul className="space-y-4 text-sm text-muted-foreground">
                                    <li className="hover:text-primary cursor-pointer transition-colors flex items-center">
                                        <span className="mr-2 text-primary">•</span> 5 Tips for Telehealth Success
                                    </li>
                                    <li className="hover:text-primary cursor-pointer transition-colors flex items-center">
                                        <span className="mr-2 text-primary">•</span> Understanding New Billing Codes
                                    </li>
                                    <li className="hover:text-primary cursor-pointer transition-colors flex items-center">
                                        <span className="mr-2 text-primary">•</span> Marketing Your Private Practice
                                    </li>
                                </ul>
                            </CardContent>
                            <CardFooter className="relative z-10">
                                <Button variant="ghost" className="w-full justify-between group/btn">
                                    Read Articles <ArrowRight className="h-4 w-4 transition-transform group-hover/btn:translate-x-1" />
                                </Button>
                            </CardFooter>
                        </Card>

                        {/* Downloads */}
                        <Card className="flex flex-col group relative overflow-hidden border-secondary/20 bg-background/50 backdrop-blur-sm transition-all hover:shadow-lg hover:-translate-y-1">
                            <div className="absolute inset-0 bg-gradient-to-br from-secondary/10 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
                            <CardHeader>
                                <div className="mb-4 w-fit rounded-full bg-secondary/10 p-3 text-secondary-foreground group-hover:bg-secondary group-hover:text-secondary-foreground transition-colors">
                                    <Download className="h-6 w-6" />
                                </div>
                                <CardTitle>Free Downloads</CardTitle>
                                <CardDescription>
                                    Worksheets, intake forms, and templates for your practice.
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="flex-1 relative z-10">
                                <ul className="space-y-4 text-sm text-muted-foreground">
                                    <li className="hover:text-primary cursor-pointer transition-colors flex items-center">
                                        <span className="mr-2 text-secondary">•</span> New Client Intake Form
                                    </li>
                                    <li className="hover:text-primary cursor-pointer transition-colors flex items-center">
                                        <span className="mr-2 text-secondary">•</span> HIPAA Release Template
                                    </li>
                                    <li className="hover:text-primary cursor-pointer transition-colors flex items-center">
                                        <span className="mr-2 text-secondary">•</span> Superbill Template
                                    </li>
                                </ul>
                            </CardContent>
                            <CardFooter className="relative z-10">
                                <Button variant="ghost" className="w-full justify-between group/btn">
                                    View Library <ArrowRight className="h-4 w-4 transition-transform group-hover/btn:translate-x-1" />
                                </Button>
                            </CardFooter>
                        </Card>

                        {/* Events */}
                        <Card className="flex flex-col group relative overflow-hidden border-accent/20 bg-background/50 backdrop-blur-sm transition-all hover:shadow-lg hover:-translate-y-1">
                            <div className="absolute inset-0 bg-gradient-to-br from-accent/10 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
                            <CardHeader>
                                <div className="mb-4 w-fit rounded-full bg-accent/10 p-3 text-accent-foreground group-hover:bg-accent group-hover:text-accent-foreground transition-colors">
                                    <Calendar className="h-6 w-6" />
                                </div>
                                <CardTitle>Events & Webinars</CardTitle>
                                <CardDescription>
                                    Expert-led sessions on demand and upcoming live workshops.
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="flex-1 relative z-10">
                                <ul className="space-y-4 text-sm text-muted-foreground">
                                    <li className="hover:text-primary cursor-pointer transition-colors flex items-center">
                                        <span className="mr-2 text-accent-foreground">•</span> Live Q&A: Insurance 101 (Nov 25)
                                    </li>
                                    <li className="hover:text-primary cursor-pointer transition-colors flex items-center">
                                        <span className="mr-2 text-accent-foreground">•</span> Workshop: Building Your Brand
                                    </li>
                                    <li className="hover:text-primary cursor-pointer transition-colors flex items-center">
                                        <span className="mr-2 text-accent-foreground">•</span> CEU Opportunity: Ethics in 2025
                                    </li>
                                </ul>
                            </CardContent>
                            <CardFooter className="relative z-10">
                                <Button variant="ghost" className="w-full justify-between group/btn">
                                    See Schedule <ArrowRight className="h-4 w-4 transition-transform group-hover/btn:translate-x-1" />
                                </Button>
                            </CardFooter>
                        </Card>
                    </div>
                </div>
            </div>
        </section>
    );
}
