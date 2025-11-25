"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-secondary/5 p-4 sm:p-6 md:p-8">
            <Card className="w-full max-w-md shadow-lg">
                <CardHeader className="space-y-2 px-6 pt-6 pb-4">
                    <CardTitle className="text-3xl md:text-4xl font-bold text-center">Welcome Back</CardTitle>
                    <CardDescription className="text-center text-base md:text-lg">
                        Sign in to access your Algarve Therapy Centre account
                    </CardDescription>
                </CardHeader>
                <CardContent className="px-6 pb-6">
                    <form onSubmit={handleSubmit} className="space-y-5">
                        <div className="space-y-2">
                            <Label htmlFor="email" className="text-base font-medium">Email</Label>
                            <Input
                                id="email"
                                type="email"
                                placeholder="claire@claireschillaci.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                                disabled={isLoading}
                                className="h-11 text-base"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="password" className="text-base font-medium">Password</Label>
                            <Input
                                id="password"
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                disabled={isLoading}
                                className="h-11 text-base"
                            />
                        </div>

                        {error && (
                            <div className="flex items-center gap-2 rounded-lg bg-red-500/10 p-3 text-base text-red-500">
                                <AlertCircle className="h-5 w-5" />
                                {error}
                            </div>
                        )}

                        <Button type="submit" className="w-full h-11 text-base font-semibold" disabled={isLoading}>
                            {isLoading ? "Signing in..." : "Sign In"}
                        </Button>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
}
