"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign, CreditCard, FileText, TrendingUp, Download } from "lucide-react";
import { motion } from "framer-motion";

interface Invoice {
    id: string;
    clientName: string;
    amount: number;
    status: "paid" | "pending" | "overdue";
    date: string;
    service: string;
}

export function Billing() {
    const [invoices] = useState<Invoice[]>([]);

    const totalRevenue = invoices.filter(i => i.status === "paid").reduce((sum, i) => sum + i.amount, 0);
    const pendingAmount = invoices.filter(i => i.status === "pending").reduce((sum, i) => sum + i.amount, 0);
    const overdueAmount = invoices.filter(i => i.status === "overdue").reduce((sum, i) => sum + i.amount, 0);

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Billing & Payments</h2>
                    <p className="text-muted-foreground">Track revenue and manage invoices</p>
                </div>
                <Button className="gap-2">
                    <FileText className="h-4 w-4" />
                    Create Invoice
                </Button>
            </div>

            {/* Stats Cards */}
            <div className="grid gap-4 md:grid-cols-3">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
                        <DollarSign className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">${totalRevenue.toLocaleString()}</div>
                        <p className="text-xs text-muted-foreground">This month</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Pending</CardTitle>
                        <CreditCard className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">${pendingAmount.toLocaleString()}</div>
                        <p className="text-xs text-muted-foreground">{invoices.filter(i => i.status === "pending").length} invoices</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Overdue</CardTitle>
                        <TrendingUp className="h-4 w-4 text-red-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-red-500">${overdueAmount.toLocaleString()}</div>
                        <p className="text-xs text-muted-foreground">{invoices.filter(i => i.status === "overdue").length} invoices</p>
                    </CardContent>
                </Card>
            </div>

            {/* Invoices Table */}
            <Card>
                <CardHeader>
                    <CardTitle>Recent Invoices</CardTitle>
                    <CardDescription>Manage and track all your invoices</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="space-y-3">
                        {invoices.length === 0 ? (
                            <div className="flex items-center justify-center py-12 text-muted-foreground">
                                <p className="text-sm">No invoices yet. Click "Create Invoice" to get started.</p>
                            </div>
                        ) : (
                            invoices.map((invoice, index) => (
                                <motion.div
                                    key={invoice.id}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: index * 0.05 }}
                                    className="flex items-center justify-between p-4 rounded-lg border hover:bg-muted/50 transition-colors"
                                >
                                    <div className="flex items-center gap-4">
                                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                                            <FileText className="h-5 w-5 text-primary" />
                                        </div>
                                        <div>
                                            <h4 className="font-semibold">{invoice.clientName}</h4>
                                            <p className="text-sm text-muted-foreground">{invoice.service} • {invoice.id}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <div className="text-right">
                                            <p className="font-semibold">${invoice.amount}</p>
                                            <p className="text-xs text-muted-foreground">{new Date(invoice.date).toLocaleDateString()}</p>
                                        </div>
                                        <div className={`px-3 py-1 rounded-full text-xs font-medium ${invoice.status === "paid" ? "bg-green-500/10 text-green-500" :
                                            invoice.status === "pending" ? "bg-yellow-500/10 text-yellow-500" :
                                                "bg-red-500/10 text-red-500"
                                            }`}>
                                            {invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1)}
                                        </div>
                                        <Button size="sm" variant="ghost">
                                            <Download className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </motion.div>
                            ))
                        )}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
