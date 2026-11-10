"use client";

import { useEffect, useId, useRef } from "react";

export default function Modal({ title, eyebrow, onClose, busy = false, children, wide = false }) {
  const ref = useRef(null);
  const id = useId();
  useEffect(() => { const dialog = ref.current; dialog.showModal(); return () => dialog.close(); }, []);
  return <dialog ref={ref} className={`crm-dialog ${wide ? "crm-dialog-wide" : ""}`} aria-labelledby={id} onCancel={(event) => { event.preventDefault(); if (!busy) onClose(); }}>
    <div className="crm-dialog-heading"><div>{eyebrow && <div className="crm-eyebrow">{eyebrow}</div>}<h2 id={id}>{title}</h2></div><button type="button" className="crm-icon-button" onClick={onClose} disabled={busy} aria-label="Close dialog">×</button></div>
    {children}
  </dialog>;
}
