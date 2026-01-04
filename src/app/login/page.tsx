"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, Eye, EyeOff } from "lucide-react";

export default function LoginPage() {
    const router = useRouter();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    // For login page, always use application logo since user isn't authenticated yet
    // This ensures the logo always displays correctly
    const DEFAULT_LOGO = "/logo.png";
    const logoSrc = DEFAULT_LOGO;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setIsLoading(true);

        try {
            // Try API login first (for database users)
            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ email: email.trim(), password }),
            });

            const data = await response.json();

            if (response.ok && data.success) {
                // Login successful via API
                // Cookies are set by the API response
                // Also set in localStorage for backwards compatibility
                localStorage.setItem("isAuthenticated", "true");
                localStorage.setItem("userEmail", data.user.email);

                // Redirect to dashboard
                setTimeout(() => {
                    window.location.href = "/dashboard";
                }, 100);
            } else {
                // API login failed - show error
                setError(data.error || "Invalid email or password");
                setIsLoading(false);
            }
        } catch (error) {
            console.error("Login error:", error);
            setError("An error occurred during login. Please try again.");
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-secondary/5 p-4 sm:p-6">
            <Card className="w-full max-w-sm shadow-lg">
                <CardHeader className="space-y-1.5 px-5 pt-5 pb-3">
                    <div className="flex justify-center mb-3">
                        <img
                            src={logoSrc}
                            alt="My Practice Helper"
                            className="h-20 w-auto object-contain"
                            onError={(e) => {
                                const target = e.target as HTMLImageElement;
                                console.error('[Login] Logo failed to load:', logoSrc);
                                // If default logo fails, try to reload it (might be caching issue)
                                if (!target.src.includes('?nocache')) {
                                    target.src = logoSrc + '?nocache=' + Date.now();
                                }
                            }}
                            onLoad={() => {
                                console.log('[Login] Logo loaded successfully:', logoSrc);
                            }}
                        />
                    </div>
                    <CardTitle className="text-2xl font-bold text-center">Welcome Back</CardTitle>
                    <CardDescription className="text-center text-sm">
                        Sign in to access My Practice Helper account
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
                                autoComplete="email"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="password" className="text-sm font-medium">Password</Label>
                            <div className="relative">
                                <Input
                                    id="password"
                                    type={showPassword ? "text" : "password"}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                    disabled={isLoading}
                                    className="h-10 pr-10"
                                    autoComplete="current-password"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                                    disabled={isLoading}
                                >
                                    {showPassword ? (
                                        <EyeOff className="h-4 w-4" />
                                    ) : (
                                        <Eye className="h-4 w-4" />
                                    )}
                                </button>
                            </div>
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
