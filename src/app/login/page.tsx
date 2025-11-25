"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle } from "lucide-react";

export default function LoginPage() {
    const router = useRouter();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setIsLoading(true);

        // Simple hardcoded authentication
        if (email === "claire@claireschillaci.com" && password === "22Picnic!") {
            // Set authentication cookie for 7 days
            const maxAge = 7 * 24 * 60 * 60; // 7 days in seconds
            document.cookie = `isAuthenticated=true; path=/; max-age=${maxAge}; SameSite=Lax`;
            document.cookie = `userEmail=${email}; path=/; max-age=${maxAge}; SameSite=Lax`;

            // Also set in localStorage as backup
            localStorage.setItem("isAuthenticated", "true");
            localStorage.setItem("userEmail", email);

            // Redirect to dashboard
            router.push("/dashboard");
        } else {
            setError("Invalid email or password");
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-secondary/5 p-4 sm:p-6">
            <Card className="w-full max-w-sm shadow-lg">
                <CardHeader className="space-y-1.5 px-5 pt-5 pb-3">
                    <div className="flex justify-center mb-3">
                        <Image
                            src="/logo.png"
                            alt="My Practice Helper"
                            width={200}
                            height={44}
                            className="h-10 w-auto"
                            priority
                        />
                    </div>
                    <CardTitle className="text-2xl font-bold text-center">Welcome Back</CardTitle>
                    <CardDescription className="text-center text-sm">
                        Sign in to access your Algarve Therapy Centre account
                    </CardDescription>
                </CardHeader>
                <CardContent className="px-5 pb-5">
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="space-y-1.5">
                            <Label htmlFor="email" className="text-sm font-medium">Email</Label>
                            <Input
                                id="email"
                                type="email"
                                placeholder="claire@claireschillaci.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                                disabled={isLoading}
                                className="h-10"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="password" className="text-sm font-medium">Password</Label>
                            <Input
                                id="password"
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                disabled={isLoading}
                                className="h-10"
                            />
                        </div>

                        {error && (
                            <div className="flex items-center gap-2 rounded-lg bg-red-500/10 p-2.5 text-sm text-red-500">
                                <AlertCircle className="h-4 w-4" />
                                {error}
                            </div>
                        )}

                        <Button type="submit" className="w-full h-10 font-semibold" disabled={isLoading}>
                            {isLoading ? "Signing in..." : "Sign In"}
                        </Button>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
}
