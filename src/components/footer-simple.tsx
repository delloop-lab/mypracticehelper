"use client";

import Link from "next/link";

export function FooterSimple() {
    return (
        <footer className="border-t bg-muted/40 mt-auto">
            <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-4">
                <div className="text-center text-sm text-muted-foreground">
                    <p>
                        <span className="sm:hidden">© 2026 </span>
                        <span className="hidden sm:inline">© 2025-2026 </span>
                        <a
                            href="mailto:help@mypracticehelper.com"
                            className="text-primary hover:underline font-medium"
                        >
                            My Practice Helper
                        </a>
                        <span className="hidden sm:inline">. All rights reserved.</span>
                        {" "}
                        <Link
                            href="/terms"
                            className="text-primary hover:underline"
                            aria-label="Terms and Conditions"
                        >
                            <span className="sm:hidden">T&C</span>
                            <span className="hidden sm:inline">Terms and Conditions</span>
                        </Link>
                        {" | "}
                        <Link
                            href="/privacy"
                            className="text-primary hover:underline"
                            aria-label="Privacy Policy"
                        >
                            <span className="sm:hidden">Privacy</span>
                            <span className="hidden sm:inline">Privacy Policy</span>
                        </Link>
                    </p>
                </div>
            </div>
        </footer>
    );
}



