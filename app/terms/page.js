import Link from "next/link";
import "../information.css";

export const metadata = {
  title: "Booking terms | Cut & Cuddle Grooming",
  description: "Information about using the Cut & Cuddle website and booking workspace.",
};

export default function TermsPage() {
  return (
    <main className="information-page">
      <nav aria-label="Page navigation"><Link href="/">Back to Cut &amp; Cuddle</Link><Link href="/privacy">Privacy notice</Link></nav>
      <h1>Website booking terms</h1>
      <p className="updated">Updated 17 November 2026</p>

      <h2>Booking an appointment</h2>
      <p>This website lets you view grooming services and book an available appointment with Cut &amp; Cuddle. Please provide accurate contact and dog information so staff can arrange the appointment and contact you when needed.</p>
      <p>Appointment availability is checked against the business Google Calendar. A successful booking creates a calendar appointment and asks Google Calendar to send a confirmation to the email address you provide. If you see an error or are unsure whether a booking succeeded, contact us before submitting it again.</p>

      <h2>Prices and appointment changes</h2>
      <p>The website records the quoted grooming price with your booking. Contact Cut &amp; Cuddle to discuss the service, price, payment or any changes to an appointment. To reschedule or cancel, contact us directly.</p>

      <h2>The staff workspace</h2>
      <p>The administrator workspace is for authorised Cut &amp; Cuddle staff. Connecting a Google account allows the application to manage bookings in the configured business calendar and read authorised customer contacts. Only connect an account you are authorised to use for this purpose.</p>

      <h2>Availability and privacy</h2>
      <p>Online booking depends on the website and Google services being available. If online booking is unavailable, email us to arrange an appointment. Our <Link href="/privacy">privacy notice</Link> explains how booking information and connected Google data are used.</p>

      <h2>Contact</h2>
      <p>Email <a href="mailto:cutandcuddle01@gmail.com">cutandcuddle01@gmail.com</a> for booking questions.</p>
    </main>
  );
}
