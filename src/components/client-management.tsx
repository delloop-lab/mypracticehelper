"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Users, Search, Plus, Mail, Phone, Calendar } from "lucide-react";
import { motion } from "framer-motion";

interface Client {
    id: string;
    name: string;
    email: string;
    phone: string;
    lastSession: string;
    nextSession: string;
    status: "active" | "inactive";
}

export function ClientManagement() {
    const [searchQuery, setSearchQuery] = useState("");
    const [clients] = useState<Client[]>([
        {
            id: "1",
            name: "Sarah Johnson",
            email: "sarah.j@email.com",
            phone: "(555) 123-4567",
            lastSession: "2024-01-20",
            nextSession: "2024-01-27",
            status: "active"
        },
        {
            id: "2",
            name: "Michael Chen",
            email: "m.chen@email.com",
            phone: "(555) 234-5678",
            lastSession: "2024-01-18",
            nextSession: "2024-01-25",
            status: "active"
        },
        {
            id: "3",
            name: "Emma Davis",
            email: "emma.d@email.com",
            phone: "(555) 345-6789",
            lastSession: "2024-01-15",
            nextSession: "2024-01-29",
            status: "active"
        },
        {
            id: "4",
            name: "James Wilson",
            email: "j.wilson@email.com",
            phone: "(555) 456-7890",
            lastSession: "2024-01-10",
            nextSession: "2024-01-24",
            status: "inactive"
        },
    ]);

    const filteredClients = clients.filter(client =>
        client.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        client.email.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Clients</h2>
                    <p className="text-muted-foreground">Manage your client roster</p>
                </div>
                <Button className="gap-2">
                    <Plus className="h-4 w-4" />
                    Add Client
                </Button>
            </div>

            {/* Stats */}
            <div className="grid gap-4 md:grid-cols-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Clients</CardTitle>
                        <Users className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{clients.length}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Active</CardTitle>
                        <Users className="h-4 w-4 text-green-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{clients.filter(c => c.status === "active").length}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">This Week</CardTitle>
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">12</div>
                        <p className="text-xs text-muted-foreground">sessions scheduled</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">New This Month</CardTitle>
                        <Plus className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">3</div>
                    </CardContent>
                </Card>
            </div>

            {/* Search */}
            <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                    placeholder="Search clients by name or email..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                />
            </div>

            {/* Client List */}
            <div className="grid gap-4 md:grid-cols-2">
                {filteredClients.map((client, index) => (
                    <motion.div
                        key={client.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.05 }}
                    >
                        <Card className="hover:shadow-md transition-shadow">
                            <CardHeader>
                                <div className="flex items-start justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                                            <Users className="h-6 w-6 text-primary" />
                                        </div>
                                        <div>
                                            <CardTitle className="text-lg">{client.name}</CardTitle>
                                            <div className={`mt-1 inline-block px-2 py-0.5 rounded-full text-xs font-medium ${client.status === "active" ? "bg-green-500/10 text-green-500" : "bg-gray-500/10 text-gray-500"
                                                }`}>
                                                {client.status}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                    <Mail className="h-4 w-4" />
                                    {client.email}
                                </div>
                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                    <Phone className="h-4 w-4" />
                                    {client.phone}
                                </div>
                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                    <Calendar className="h-4 w-4" />
                                    Next: {new Date(client.nextSession).toLocaleDateString()}
                                </div>
                                <div className="flex gap-2 pt-2">
                                    <Button size="sm" variant="outline" className="flex-1">View Profile</Button>
                                    <Button size="sm" className="flex-1">Schedule</Button>
                                </div>
                            </CardContent>
                        </Card>
                    </motion.div>
                ))}
            </div>
        </div>
    );
}
