"use client";

import { Card, CardContent } from "@/components/ui/card";
import { motion } from "framer-motion";
import Image from "next/image";
import { Quote } from "lucide-react";

interface Testimonial {
    name: string;
    image: string;
    text: string;
}

const testimonials: Testimonial[] = [
    {
        name: "Sue Brimacombe",
        image: "/sue-brimacombe.png",
        text: "I was very impressed with how thorough this guy was. He measured everything precisely. Many would have just shoved it up. It was easy to find help for any task on this site. He responded to my enquiry very quickly and arrived promptly.",
    },
    {
        name: "Victoria Bradley",
        image: "/victoria-bradley.png",
        text: "It was super simple to create the task and find help. The person who came to help did an excellent job and was able to complete the task quickly. Just what I needed.",
    },
    {
        name: "Gail Smith",
        image: "/gail-smith.png",
        text: "Taskorilla made it incredibly easy to find help when I needed it. Posting the task was simple, I got responses quickly, and the help I received was spot on. I would definitely use it again.",
    },
];

export function Testimonials() {
    return (
        <section className="py-20 bg-background">
            <div className="container px-4 md:px-8">
                <div className="flex flex-col items-center justify-center space-y-4 text-center mb-12">
                    <h2 className="text-3xl font-bold tracking-tighter sm:text-4xl md:text-5xl">
                        What Our Users Say
                    </h2>
                    <p className="max-w-[700px] text-muted-foreground md:text-lg">
                        Real experiences from people who found help on Taskorilla
                    </p>
                </div>

                <div className="grid gap-6 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3 max-w-7xl mx-auto">
                    {testimonials.map((testimonial, index) => (
                        <motion.div
                            key={testimonial.name}
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.5, delay: index * 0.1 }}
                        >
                            <Card className="h-full border-primary/10 bg-background/50 backdrop-blur-sm transition-all hover:shadow-lg hover:-translate-y-1">
                                <CardContent className="p-6">
                                    <div className="flex flex-col items-center text-center space-y-4">
                                        {/* Quote Icon */}
                                        <div className="flex justify-center mb-2">
                                            <div className="rounded-full bg-primary/10 p-3 text-primary">
                                                <Quote className="h-5 w-5" />
                                            </div>
                                        </div>

                                        {/* Testimonial Text */}
                                        <p className="text-muted-foreground text-sm leading-relaxed italic">
                                            "{testimonial.text}"
                                        </p>

                                        {/* Profile Image and Name */}
                                        <div className="flex flex-col items-center space-y-3 pt-2">
                                            <div className="relative h-20 w-20 rounded-full overflow-hidden border-2 border-primary/20">
                                                <Image
                                                    src={testimonial.image}
                                                    alt={`Photo of ${testimonial.name}`}
                                                    fill
                                                    className="object-cover"
                                                    sizes="80px"
                                                />
                                            </div>
                                            <div>
                                                <p className="font-semibold text-base">{testimonial.name}</p>
                                            </div>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </motion.div>
                    ))}
                </div>
            </div>
        </section>
    );
}



