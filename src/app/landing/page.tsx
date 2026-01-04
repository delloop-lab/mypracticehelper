"use client";

import { Testimonials } from "@/components/testimonials";
import { Hero } from "@/components/hero";

export default function LandingPage() {
    return (
        <div className="min-h-screen">
            {/* Testimonials Section - appears before slogan */}
            <Testimonials />
            
            {/* Slogan Section (Hero component contains the slogan/tagline) */}
            <Hero />
        </div>
    );
}



