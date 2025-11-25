import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function PaymentsPage() {
    return (
        <div className="container mx-auto px-4 py-8 max-w-6xl">
            <h1 className="text-4xl font-bold mb-8">Revenue</h1>
            <Card>
                <CardHeader>
                    <CardTitle>Fees Collected</CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-muted-foreground">Payment features coming soon.</p>
                </CardContent>
            </Card>
        </div>
    );
}
