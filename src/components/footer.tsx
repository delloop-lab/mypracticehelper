import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function Footer() {
    return (
        <footer className="border-t bg-muted/50">
            <div className="container px-4 py-12 md:px-8 md:py-16 lg:py-20">
                <div className="grid gap-8 lg:grid-cols-4">
                    <div className="space-y-4">
                        <h3 className="text-2xl font-bold text-primary">My Practice Helper</h3>
                        <p className="text-sm text-muted-foreground">
                            Empowering therapists with simple, beautiful tools to manage their practice.
                        </p>
                    </div>
                    <div className="space-y-4">
                        <h4 className="text-sm font-semibold">Product</h4>
                        <ul className="space-y-2 text-sm text-muted-foreground">
                            <li><Link href="#" className="hover:text-primary">Features</Link></li>
                            <li><Link href="#" className="hover:text-primary">Pricing</Link></li>
                            <li><Link href="#" className="hover:text-primary">Security</Link></li>
                            <li><Link href="#" className="hover:text-primary">Roadmap</Link></li>
                        </ul>
                    </div>
                    <div className="space-y-4">
                        <h4 className="text-sm font-semibold">Resources</h4>
                        <ul className="space-y-2 text-sm text-muted-foreground">
                            <li><Link href="#" className="hover:text-primary">Blog</Link></li>
                            <li><Link href="#" className="hover:text-primary">Help Center</Link></li>
                            <li><Link href="#" className="hover:text-primary">Community</Link></li>
                            <li><Link href="#" className="hover:text-primary">Contact Support</Link></li>
                        </ul>
                    </div>
                    <div className="space-y-4">
                        <h4 className="text-sm font-semibold">Stay Updated</h4>
                        <p className="text-sm text-muted-foreground">
                            Subscribe to our newsletter for the latest practice tips.
                        </p>
                        <div className="flex space-x-2">
                            <Input placeholder="Enter your email" className="max-w-[200px]" />
                            <Button>Subscribe</Button>
                        </div>
                    </div>
                </div>
                <div className="mt-12 border-t pt-8 text-center text-sm text-muted-foreground">
                    <p>
                        &copy; {new Date().getFullYear()} My Practice Helper. All rights reserved.{" "}
                        <Link href="/terms" className="text-primary hover:underline">
                            Terms and Conditions
                        </Link>
                        {" | "}
                        <Link href="/privacy" className="text-primary hover:underline">
                            Privacy Policy
                        </Link>
                    </p>
                </div>
            </div>
        </footer>
    );
}
