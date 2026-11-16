import Link from "next/link";
import "../information.css";

export const metadata = {
  title: "Privacy | Cut & Cuddle Grooming",
  description: "How the Cut & Cuddle website and booking workspace use booking information and connected Google data.",
};

export default function PrivacyPage() {
  return (
    <main className="information-page">
      <nav aria-label="Page navigation"><Link href="/">Back to Cut &amp; Cuddle</Link><Link href="/terms">Booking terms</Link></nav>
      <h1>Privacy notice</h1>
      <p className="updated">Updated 17 November 2026</p>
      <p>This notice covers information processed by the Cut &amp; Cuddle grooming website and its Google-connected booking workspace.</p>

      <h2>Information used for bookings</h2>
      <p>When you book, we collect your name, email address, phone number if provided, appointment time, selected service, dog name and size, and any notes you submit. The booking record can also contain a quoted price, attendance status and payment amounts recorded by staff.</p>
      <p>We use this information to arrange and manage grooming appointments, send booking confirmations, maintain customer and dog histories, and identify when a dog may be due for another groom. Please only include information needed for the appointment in booking notes.</p>

      <h2>Google Calendar, Contacts and Sheets</h2>
      <p>An authorised staff member connects the business Google account. Customers do not need to connect their own Google accounts to book.</p>
      <ul>
        <li>The website checks calendar availability and creates appointments in the configured business calendar.</li>
        <li>The staff workspace reads calendar appointments and, when authorised, Google Contacts to show customer records and grooming history.</li>
        <li>Staff can create follow-up appointments in Calendar. When staff save a customer’s name, email or phone in the workspace, those details are also updated in Google Contacts; a contact is created if needed.</li>
        <li>A dedicated Google Sheet in the business account stores customer links, dog profiles, staff notes, attendance and payment records. Saved revisions preserve the history of changes.</li>
        <li>Google Calendar receives the booking details and the customer email address so it can send a calendar invitation or confirmation.</li>
      </ul>
      <p>The website uses connected Google data for these booking and customer-care functions. It does not send Google Calendar, Contacts or Sheets data to advertising services.</p>

      <h2>Storage and service providers</h2>
      <p>Booking records are stored in the connected business Google Calendar. Contacts and the dedicated customer-care spreadsheet remain in the connected business Google account. Payment records can include the total amount paid, method, date and reference; the workspace does not collect card numbers or process payments. HIVE hosts the website, and Cloudflare provides network delivery and protection. These providers process information needed to operate their services, including technical request information.</p>
      <p>Google connection credentials are stored on the website server to allow ongoing access. The staff workspace requires an administrator login. Booking and contact records are used by authorised staff for customer care.</p>

      <h2>Cookies and embedded content</h2>
      <p>The administrator login uses a session cookie to keep staff signed in. The public website includes an embedded Google map and images served by external providers; loading these resources sends normal browser request information to those providers.</p>

      <h2>Access, correction and removal</h2>
      <p>Booking history remains in the business calendar and saved customer-care records remain in the spreadsheet until they are removed. Corrections can leave earlier revisions in the spreadsheet’s record history. Contact Cut &amp; Cuddle to ask about information held about you or to request access, correction or deletion. Staff will review the request and explain any information that needs to be retained.</p>
      <p>The Google account holder can revoke the booking application&apos;s access through their <a href="https://myaccount.google.com/connections" target="_blank" rel="noreferrer">Google account connections</a>. Revoking access stops future access through that connection; it does not delete existing calendar appointments, contacts or spreadsheets.</p>

      <h2>Contact</h2>
      <p>For privacy questions or requests, email <a href="mailto:cutandcuddle01@gmail.com">cutandcuddle01@gmail.com</a>.</p>
    </main>
  );
}
