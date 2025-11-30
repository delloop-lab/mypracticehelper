import { Card, CardContent } from "@/components/ui/card";

export default function TermsPage() {
    return (
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12 max-w-4xl">
            <div className="mb-8">
                <h1 className="text-3xl md:text-4xl font-bold mb-4">Terms and Conditions</h1>
                <p className="text-muted-foreground">Last updated: {new Date().toLocaleDateString()}</p>
            </div>

            <Card className="mb-6">
                <CardContent className="pt-6">
                    <p className="text-muted-foreground mb-6">
                        Welcome to MyPracticeHelper. By accessing or using this website and related services (the "Platform"), you agree to these Terms and Conditions. If you do not agree, please do not use the Platform.
                    </p>
                </CardContent>
            </Card>

            <div className="space-y-8">
                <section>
                    <h2 className="text-2xl font-semibold mb-4">1. Introduction</h2>
                    <p className="text-muted-foreground leading-relaxed">
                        MyPracticeHelper is a software tool designed to help therapists and wellness professionals manage aspects of their practice. The Platform provides scheduling, reminders, messaging tools, and other administrative features. MyPracticeHelper does not provide therapy, counselling, or healthcare services. All therapeutic services are delivered solely by the independent therapists who use the Platform.
                    </p>
                </section>

                <section>
                    <h2 className="text-2xl font-semibold mb-4">2. Eligibility</h2>
                    <p className="text-muted-foreground leading-relaxed">
                        To use the Platform, you must be at least 18 years old and legally able to enter into a contract. By using the Platform, you confirm that the information you provide is accurate and complete.
                    </p>
                </section>

                <section>
                    <h2 className="text-2xl font-semibold mb-4">3. Account Registration</h2>
                    <p className="text-muted-foreground leading-relaxed">
                        Users may be required to create an account. You are responsible for maintaining the confidentiality of your login details and for all activity occurring under your account. Notify us immediately if you suspect unauthorised access.
                    </p>
                </section>

                <section>
                    <h2 className="text-2xl font-semibold mb-4">4. Services for Therapists</h2>
                    <p className="text-muted-foreground leading-relaxed mb-4">
                        Therapists who use MyPracticeHelper are solely responsible for:
                    </p>
                    <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
                        <li>Compliance with all applicable professional, licensing, and legal requirements.</li>
                        <li>The accuracy of information supplied to clients.</li>
                        <li>The delivery of therapy or wellness services to their clients. The Platform is a tool and does not supervise, monitor, or verify any therapist's qualifications.</li>
                    </ul>
                </section>

                <section>
                    <h2 className="text-2xl font-semibold mb-4">5. Services for Clients</h2>
                    <p className="text-muted-foreground leading-relaxed mb-4">
                        Clients who use the Platform understand that:
                    </p>
                    <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
                        <li>MyPracticeHelper is not a healthcare provider.</li>
                        <li>All therapy or wellness services are delivered directly by the therapist, not through the Platform.</li>
                        <li>The Platform may send reminders, notifications, or messages on behalf of therapists.</li>
                    </ul>
                </section>

                <section>
                    <h2 className="text-2xl font-semibold mb-4">6. Messaging and Communication</h2>
                    <p className="text-muted-foreground leading-relaxed mb-4">
                        The Platform may provide a messaging system to enable communication between therapists and clients. This messaging system:
                    </p>
                    <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
                        <li>Is intended for administrative and non-urgent communication.</li>
                        <li>Must not be used for emergencies.</li>
                        <li>Should not be used for crisis situations or time-sensitive clinical matters.</li>
                    </ul>
                </section>

                <section>
                    <h2 className="text-2xl font-semibold mb-4">7. Payments</h2>
                    <p className="text-muted-foreground leading-relaxed">
                        If payments are processed through the Platform, they are handled by third-party payment processors. We do not store credit card details. By making a payment, you agree to any terms imposed by the payment provider.
                    </p>
                </section>

                <section>
                    <h2 className="text-2xl font-semibold mb-4">8. Data Protection and Privacy</h2>
                    <p className="text-muted-foreground leading-relaxed">
                        Our handling of personal data is described in our Privacy Policy. By using the Platform, you agree to the collection and processing of your data as outlined in that policy. All data processing is compliant with GDPR requirements. Users have the right to access, correct, or request deletion of their personal data by contacting us.
                    </p>
                </section>

                <section>
                    <h2 className="text-2xl font-semibold mb-4">9. Acceptable Use</h2>
                    <p className="text-muted-foreground leading-relaxed mb-4">
                        You agree not to:
                    </p>
                    <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
                        <li>Use the Platform for unlawful purposes.</li>
                        <li>Upload harmful or inappropriate content.</li>
                        <li>Interfere with the functionality or security of the Platform.</li>
                        <li>Attempt to access unauthorised areas or accounts.</li>
                    </ul>
                </section>

                <section>
                    <h2 className="text-2xl font-semibold mb-4">10. Intellectual Property</h2>
                    <p className="text-muted-foreground leading-relaxed">
                        All content, design, and software on the Platform are owned by MyPracticeHelper or licensed to us. You may not copy, modify, distribute, or reverse-engineer any part of the Platform without written permission.
                    </p>
                </section>

                <section>
                    <h2 className="text-2xl font-semibold mb-4">11. Service Availability</h2>
                    <p className="text-muted-foreground leading-relaxed">
                        We aim to keep the Platform running smoothly but do not guarantee uninterrupted or error-free operation. We may modify or discontinue features at any time.
                    </p>
                </section>

                <section>
                    <h2 className="text-2xl font-semibold mb-4">12. Limitation of Liability</h2>
                    <p className="text-muted-foreground leading-relaxed mb-4">
                        To the fullest extent permitted by law:
                    </p>
                    <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
                        <li>MyPracticeHelper is not liable for any damages arising from the use or inability to use the Platform.</li>
                        <li>We are not responsible for the actions, omissions, advice, or services of therapists using the Platform. Clients and therapists use the Platform at their own risk.</li>
                    </ul>
                </section>

                <section>
                    <h2 className="text-2xl font-semibold mb-4">13. Indemnity</h2>
                    <p className="text-muted-foreground leading-relaxed">
                        You agree to indemnify and hold harmless MyPracticeHelper from any claims, damages, or expenses arising from your use of the Platform or violation of these Terms.
                    </p>
                </section>

                <section>
                    <h2 className="text-2xl font-semibold mb-4">14. Termination</h2>
                    <p className="text-muted-foreground leading-relaxed">
                        We may suspend or terminate accounts that violate these Terms or misuse the service. You may stop using the Platform at any time.
                    </p>
                </section>

                <section>
                    <h2 className="text-2xl font-semibold mb-4">15. Changes to These Terms</h2>
                    <p className="text-muted-foreground leading-relaxed">
                        We may update these Terms occasionally. Continued use of the Platform after changes means you accept the new Terms.
                    </p>
                </section>

                <section>
                    <h2 className="text-2xl font-semibold mb-4">16. Governing Law</h2>
                    <p className="text-muted-foreground leading-relaxed">
                        These Terms are governed by the laws of Portugal, unless otherwise required by local consumer law.
                    </p>
                </section>

                <section>
                    <h2 className="text-2xl font-semibold mb-4">17. Contact Us</h2>
                    <p className="text-muted-foreground leading-relaxed">
                        For questions about these Terms or your personal data rights, please contact us at:{" "}
                        <a 
                            href="mailto:help@mypracticehelper.com" 
                            className="text-primary hover:underline font-medium"
                        >
                            help@mypracticehelper.com
                        </a>
                    </p>
                </section>
            </div>
        </div>
    );
}

