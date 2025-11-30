import { Card, CardContent } from "@/components/ui/card";

export default function PrivacyPage() {
    return (
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12 max-w-4xl">
            <div className="mb-8">
                <h1 className="text-3xl md:text-4xl font-bold mb-4">Privacy Policy</h1>
                <p className="text-muted-foreground">Last updated: {new Date().toLocaleDateString()}</p>
            </div>

            <Card className="mb-6">
                <CardContent className="pt-6">
                    <p className="text-muted-foreground mb-6">
                        This Privacy Policy explains how MyPracticeHelper collects, uses, and protects personal data when you use our website and related services (the "Platform"). By using the Platform, you agree to the practices described in this policy.
                    </p>
                </CardContent>
            </Card>

            <div className="space-y-8">
                <section>
                    <h2 className="text-2xl font-semibold mb-4">1. Data Controller</h2>
                    <p className="text-muted-foreground leading-relaxed">
                        MyPracticeHelper acts as the data controller for all personal data collected through the Platform.
                    </p>
                    <p className="text-muted-foreground leading-relaxed mt-2">
                        Contact:{" "}
                        <a 
                            href="mailto:help@mypracticehelper.com" 
                            className="text-primary hover:underline font-medium"
                        >
                            help@mypracticehelper.com
                        </a>
                    </p>
                </section>

                <section>
                    <h2 className="text-2xl font-semibold mb-4">2. Information We Collect</h2>
                    <p className="text-muted-foreground leading-relaxed mb-4">
                        We may collect the following information:
                    </p>
                    <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
                        <li><strong>Account Information:</strong> Name, email address, phone number, password.</li>
                        <li><strong>Client and Therapist Data:</strong> Appointment details, communication history, notes, payment information.</li>
                        <li><strong>Usage Data:</strong> IP address, device information, browser type, access times.</li>
                        <li><strong>Cookies and Tracking:</strong> To improve user experience and monitor Platform performance.</li>
                    </ul>
                </section>

                <section>
                    <h2 className="text-2xl font-semibold mb-4">3. How We Use Personal Data</h2>
                    <p className="text-muted-foreground leading-relaxed mb-4">
                        We use personal data for the following purposes:
                    </p>
                    <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
                        <li>To provide and improve the services of the Platform.</li>
                        <li>To facilitate communication between therapists and clients.</li>
                        <li>To process payments securely via third-party providers.</li>
                        <li>To send notifications, reminders, or administrative messages.</li>
                        <li>To comply with legal obligations and protect our rights.</li>
                    </ul>
                </section>

                <section>
                    <h2 className="text-2xl font-semibold mb-4">4. Legal Basis for Processing</h2>
                    <p className="text-muted-foreground leading-relaxed mb-4">
                        For users in the EU/EEA, we process personal data based on one or more of the following legal grounds:
                    </p>
                    <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
                        <li>Consent (e.g., agreeing to receive notifications).</li>
                        <li>Performance of a contract (e.g., providing scheduling or messaging services).</li>
                        <li>Legitimate interests (e.g., maintaining Platform security and functionality).</li>
                        <li>Compliance with legal obligations.</li>
                    </ul>
                </section>

                <section>
                    <h2 className="text-2xl font-semibold mb-4">5. Sharing Personal Data</h2>
                    <p className="text-muted-foreground leading-relaxed mb-4">
                        We do not sell personal data. We may share personal data with:
                    </p>
                    <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
                        <li><strong>Therapists:</strong> For delivering services to their clients.</li>
                        <li><strong>Service Providers:</strong> Third-party payment processors, hosting providers, or analytics tools.</li>
                        <li><strong>Legal Authorities:</strong> When required by law or to protect our rights.</li>
                    </ul>
                </section>

                <section>
                    <h2 className="text-2xl font-semibold mb-4">6. Data Retention</h2>
                    <p className="text-muted-foreground leading-relaxed">
                        We retain personal data only as long as necessary to provide services or comply with legal obligations. Users may request deletion of their data by contacting us at{" "}
                        <a 
                            href="mailto:help@mypracticehelper.com" 
                            className="text-primary hover:underline font-medium"
                        >
                            help@mypracticehelper.com
                        </a>
                        .
                    </p>
                </section>

                <section>
                    <h2 className="text-2xl font-semibold mb-4">7. User Rights (GDPR)</h2>
                    <p className="text-muted-foreground leading-relaxed mb-4">
                        EU/EEA users have the following rights regarding their personal data:
                    </p>
                    <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
                        <li>Right to access and receive a copy of your data.</li>
                        <li>Right to correct inaccurate or incomplete data.</li>
                        <li>Right to request deletion or restriction of processing.</li>
                        <li>Right to object to certain processing activities.</li>
                        <li>Right to data portability.</li>
                        <li>Right to withdraw consent at any time.</li>
                    </ul>
                </section>

                <section>
                    <h2 className="text-2xl font-semibold mb-4">8. Security</h2>
                    <p className="text-muted-foreground leading-relaxed">
                        We implement appropriate technical and organisational measures to protect personal data from unauthorised access, alteration, disclosure, or destruction.
                    </p>
                </section>

                <section>
                    <h2 className="text-2xl font-semibold mb-4">9. Cookies</h2>
                    <p className="text-muted-foreground leading-relaxed">
                        We use cookies to improve your experience on the Platform, analyse usage patterns, and personalise content. You can manage cookie settings in your browser.
                    </p>
                </section>

                <section>
                    <h2 className="text-2xl font-semibold mb-4">10. International Transfers</h2>
                    <p className="text-muted-foreground leading-relaxed">
                        Data may be stored or processed outside the EU/EEA. We ensure appropriate safeguards are in place for such transfers.
                    </p>
                </section>

                <section>
                    <h2 className="text-2xl font-semibold mb-4">11. Changes to Privacy Policy</h2>
                    <p className="text-muted-foreground leading-relaxed">
                        We may update this Privacy Policy from time to time. Continued use of the Platform constitutes acceptance of any changes.
                    </p>
                </section>

                <section>
                    <h2 className="text-2xl font-semibold mb-4">12. Contact</h2>
                    <p className="text-muted-foreground leading-relaxed mb-2">
                        For questions or requests regarding your personal data, please contact:
                    </p>
                    <div className="space-y-2 text-muted-foreground">
                        <p>
                            Email:{" "}
                            <a 
                                href="mailto:help@mypracticehelper.com" 
                                className="text-primary hover:underline font-medium"
                            >
                                help@mypracticehelper.com
                            </a>
                        </p>
                        <p>
                            Address: 202/1101 Hay Street, West Perth, 6005 Australia
                        </p>
                    </div>
                </section>
            </div>
        </div>
    );
}

