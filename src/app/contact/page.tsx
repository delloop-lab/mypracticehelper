"use client";

import { useState } from "react";
import { Mail, Phone, MapPin, Globe, Send } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export default function ContactPage() {
    const [formData, setFormData] = useState({
        name: "",
        email: "",
        message: "",
    });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitStatus, setSubmitStatus] = useState<"idle" | "success" | "error">("idle");

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        setSubmitStatus("idle");

        try {
            const response = await fetch('/api/contact', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(formData),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to send message');
            }

            // Reset form
            setFormData({ name: "", email: "", message: "" });
            setSubmitStatus("success");
            setTimeout(() => setSubmitStatus("idle"), 5000);
        } catch (error: any) {
            console.error('Error submitting contact form:', error);
            setSubmitStatus("error");
            setTimeout(() => setSubmitStatus("idle"), 5000);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 max-w-4xl">
            <div className="text-center mb-6">
                <h1 className="text-3xl font-bold mb-2">Contact Us</h1>
                <p className="text-muted-foreground">
                    Get in touch with us - we're here to help
                </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
                {/* Address Card */}
                <Card className="border-2 hover:shadow-lg transition-shadow">
                    <CardContent className="p-4">
                        <div className="flex items-start gap-4">
                            <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                                <MapPin className="h-6 w-6 text-blue-500" />
                            </div>
                            <div className="flex-1">
                                <h3 className="font-semibold text-base mb-2">Address</h3>
                                <div className="space-y-0.5 text-sm text-muted-foreground">
                                    <p className="font-medium text-foreground">My Practice Helper</p>
                                    <p>202/1101 Hay Street</p>
                                    <p>West Perth 6005</p>
                                    <p>Western Australia</p>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Phone Numbers Card */}
                <Card className="border-2 hover:shadow-lg transition-shadow">
                    <CardContent className="p-4">
                        <div className="flex items-start gap-3">
                            <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                                <Phone className="h-5 w-5 text-green-500" />
                            </div>
                            <div className="flex-1">
                                <h3 className="font-semibold text-base mb-2">Phone</h3>
                                <div className="space-y-1.5 text-sm text-muted-foreground">
                                    <div>
                                        <span className="text-xs font-medium text-foreground uppercase">Australia:</span>
                                        <p className="text-base">+61 412 900 002</p>
                                    </div>
                                    <div>
                                        <span className="text-xs font-medium text-foreground uppercase">Europe:</span>
                                        <p className="text-base">+351 937 596 665</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Email Card - Full Width */}
                <Card className="border-2 hover:shadow-lg transition-shadow md:col-span-2">
                    <CardContent className="p-4">
                        <div className="flex items-start gap-3">
                            <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                                <Mail className="h-5 w-5 text-purple-500" />
                            </div>
                            <div className="flex-1">
                                <h3 className="font-semibold text-base mb-2">Email</h3>
                                <a 
                                    href="mailto:help@mypracticehelper.com" 
                                    className="text-base text-purple-600 dark:text-purple-400 hover:underline font-medium"
                                >
                                    help@mypracticehelper.com
                                </a>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Contact Form */}
            <Card className="mt-6 border-2">
                <CardContent className="p-4">
                    <h2 className="text-xl font-bold mb-4">Send us a Message</h2>
                    <form onSubmit={handleSubmit} className="space-y-3">
                        <div className="space-y-2">
                            <Label htmlFor="name">Name *</Label>
                            <Input
                                id="name"
                                type="text"
                                placeholder="Your name"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                required
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="email">Email *</Label>
                            <Input
                                id="email"
                                type="email"
                                placeholder="your.email@example.com"
                                value={formData.email}
                                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                required
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="message">Message *</Label>
                            <Textarea
                                id="message"
                                placeholder="Your message..."
                                rows={6}
                                value={formData.message}
                                onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                                required
                            />
                        </div>
                        <div className="flex items-center gap-4">
                            <Button 
                                type="submit" 
                                disabled={isSubmitting}
                                className="bg-purple-600 hover:bg-purple-700 text-white"
                            >
                                <Send className="h-4 w-4 mr-2" />
                                {isSubmitting ? "Sending..." : "Send Message"}
                            </Button>
                            {submitStatus === "success" && (
                                <p className="text-sm text-green-600">Message sent successfully! We'll get back to you soon.</p>
                            )}
                            {submitStatus === "error" && (
                                <p className="text-sm text-red-600">Error sending message. Please try again or email us directly.</p>
                            )}
                        </div>
                    </form>
                </CardContent>
            </Card>

            {/* Additional Info */}
            <div className="mt-6 text-center">
                <div className="inline-flex items-center gap-2 text-muted-foreground">
                    <Globe className="h-4 w-4" />
                    <p className="text-xs">Serving clients worldwide</p>
                </div>
            </div>
        </div>
    );
}

