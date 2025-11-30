"use client";

import Link from "next/link";

export function FooterSimple() {
    return (
        <footer className="border-t bg-muted/40 mt-auto">
            <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-4">
                <div className="text-center text-sm text-muted-foreground">
                    <p>
                        © 2025{" "}
                        <a
                            href="mailto:help@mypracticehelper.com"
                            className="text-primary hover:underline font-medium"
                        >
                            My Practice Helper
                        </a>
                        . All rights reserved.{" "}
                        <Link href="/terms" className="text-primary hover:underline">
                            Terms and Conditions
                        </Link>
                    </p>
                </div>
            </div>
        </footer>
    );
}



