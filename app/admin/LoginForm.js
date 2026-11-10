"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { FaPaw, FaArrowRight, FaLock } from "react-icons/fa";

export default function LoginForm() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const submit = async (event) => {
    event.preventDefault();
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/admin/session", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setPassword("");
      router.replace("/admin/due"); router.refresh();
    } catch (failure) { setError(failure.message || "Couldn't sign in. Please try again."); setBusy(false); }
  };
  return <main className="crm-login">
    <div className="crm-login-art" aria-hidden="true"><div className="crm-login-orbit"><FaPaw /></div><span>A little care.<br />A happy dog.<br />A client for life.</span><p>Cut & Cuddle · Ohaeawai</p></div>
    <div className="crm-login-side"><div className="crm-login-card">
      <Link href="/" className="crm-brand"><span className="crm-brand-mark"><FaPaw /></span><span>Cut & Cuddle<small>CLIENT CARE</small></span></Link>
      <div className="crm-eyebrow">WELCOME BACK</div><h1>A good day for<br />a little grooming.</h1><p>Sign in to look after your clients, catch up on grooms and plan what’s next.</p>
      <form onSubmit={submit} className="crm-form">
        <label htmlFor="admin-password">Admin password</label><input id="admin-password" type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} />
        {error && <p role="alert" className="crm-error">{error}</p>}
        <button className="crm-button" disabled={busy}>{busy ? "Signing in…" : "Sign in"}<FaArrowRight /></button>
      </form><p className="crm-login-foot"><FaLock /> A private space for the Cut & Cuddle team.</p><Link href="/" className="crm-text-link">Back to the website</Link>
    </div></div>
  </main>;
}
