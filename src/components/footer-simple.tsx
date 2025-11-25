"use client";

export function FooterSimple() {
    return (
        <footer className="border-t bg-muted/40 mt-auto">
            <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-4">
                <div className="text-center text-sm text-muted-foreground">
                    <p>
                        © 2025{" "}
                        <a
                            href="mailto:lou@schillaci.me"
                            className="text-primary hover:underline font-medium"
                        >
                            Lou Schillaci
                        </a>
                        . All rights reserved.
                    </p>
                </div>
            </div>
        </footer>
    );
}

