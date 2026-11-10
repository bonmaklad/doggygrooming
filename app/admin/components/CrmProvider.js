"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { FaPaw, FaUsers, FaCalendarAlt, FaClock, FaSyncAlt, FaSignOutAlt, FaExternalLinkAlt } from "react-icons/fa";
import CustomerDialog from "./CustomerDialog";
import RebookDialog from "./RebookDialog";

const CrmContext = createContext(null);
export const useCrm = () => useContext(CrmContext);

export default function CrmProvider({ children }) {
  const router = useRouter();
  const pathname = usePathname();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [customerId, setCustomerId] = useState(null);
  const [booking, setBooking] = useState(null);
  const refresh = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const response = await fetch("/api/admin/crm", { cache: "no-store" });
      if (response.status === 401) { router.replace("/admin"); router.refresh(); return; }
      const body = await response.json();
      if (!response.ok) throw new Error(body.error);
      setData(body);
    } catch (failure) { setError(failure.message || "Unable to refresh your clients. Please try again."); }
    finally { setLoading(false); }
  }, [router]);
  useEffect(() => { refresh(); }, [refresh]);
  // Recalculate date-based queues after midnight and refresh when returning to the app.
  useEffect(() => {
    const onVisible = () => { if (document.visibilityState === "visible") refresh(); };
    document.addEventListener("visibilitychange", onVisible);
    const timer = setInterval(() => { if (document.visibilityState === "visible") refresh(); }, 15 * 60 * 1000);
    return () => { clearInterval(timer); document.removeEventListener("visibilitychange", onVisible); };
  }, [refresh]);
  const signOut = async () => {
    try {
      const response = await fetch("/api/admin/session", { method: "DELETE" });
      if (!response.ok) throw new Error();
      setData(null); router.replace("/admin"); router.refresh();
    } catch { setNotice("Couldn't sign out. Please try again."); }
  };
  const rebook = (customer, dog = null) => { setCustomerId(null); setBooking({ customer, dog }); };
  const currentCustomer = data?.customers.find((customer) => customer.id === customerId);
  const nav = [{ href: "/admin/due", label: "Due for a groom", icon: FaClock }, { href: "/admin/clients", label: "All clients", icon: FaUsers }, { href: "/admin/upcoming", label: "Upcoming", icon: FaCalendarAlt }];
  return <CrmContext.Provider value={{ data, loading, error, refresh, rebook, openCustomer: (customer) => setCustomerId(customer.id), setNotice }}>
    <div className="crm-shell">
      <aside className="crm-sidebar">
        <Link href="/admin/due" className="crm-brand"><span className="crm-brand-mark"><FaPaw /></span><span>Cut & Cuddle<small>CLIENT CARE</small></span></Link>
        <div className="crm-nav-label">YOUR WORKSPACE</div><nav aria-label="Admin navigation">{nav.map(({ href, label, icon: Icon }) => <Link key={href} href={href} className={`crm-nav-link ${pathname === href ? "is-active" : ""}`} aria-current={pathname === href ? "page" : undefined}><Icon />{label}</Link>)}</nav>
        <div className="crm-sidebar-note"><FaPaw /><strong>A little nudge, a lot of care.</strong><p>Small dogs every 6 months.<br />Medium every 4. Large every 3.</p></div>
        <div className="crm-sidebar-bottom"><Link href="/" target="_blank" rel="noreferrer"><FaExternalLinkAlt /> View website</Link><button onClick={signOut}><FaSignOutAlt /> Sign out</button></div>
      </aside>
      <div className="crm-main-wrap"><header className="crm-topbar"><span><span className={`crm-connection-dot ${data ? "is-connected" : ""}`} />{data ? "Google Calendar connected" : "Client care workspace"}</span><button className="crm-button crm-secondary crm-small" onClick={refresh} disabled={loading}><FaSyncAlt className={loading ? "crm-spin" : ""} />{loading ? "Refreshing…" : "Refresh"}</button></header>
        <main className="crm-main">
          {notice && <div role="status" className="crm-notice">{notice}<button aria-label="Dismiss notification" onClick={() => setNotice("")}>×</button></div>}
          {error && <div role="alert" className="crm-error-panel"><strong>We couldn’t refresh your Google data.</strong><p>{error}</p>{data && <p>You’re viewing the last successful refresh. Refresh before rebooking.</p>}<button className="crm-button crm-secondary crm-small" onClick={refresh} disabled={loading}>Try again</button></div>}
          {data?.warnings.map((warning) => <div key={warning} role="status" className="crm-warning">{warning}</div>)}
          {loading && !data ? <div className="crm-loading" role="status"><FaPaw className="crm-spin" /><h1>Gathering your clients…</h1><p>Reading contacts and appointments from Google.</p></div> : data ? children : !error ? <p>Loading your workspace…</p> : null}
        </main><footer className="crm-footer">Cut & Cuddle · A little care goes a long way.{data && <span>Last refreshed {new Intl.DateTimeFormat("en-NZ", { hour: "numeric", minute: "2-digit", timeZone: data.timeZone }).format(new Date(data.syncedAt))} · {data.timeZone}</span>}</footer>
      </div>
    </div>
    {currentCustomer && <CustomerDialog customer={currentCustomer} onClose={() => setCustomerId(null)} />}
    {booking && <RebookDialog customer={booking.customer} dog={booking.dog} onClose={() => setBooking(null)} onBooked={async () => { setBooking(null); setNotice("Appointment booked. Google Calendar has been asked to send the customer a confirmation."); await refresh(); }} />}
  </CrmContext.Provider>;
}
