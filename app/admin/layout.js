import "./admin.css";

export const metadata = {
  title: "Cut & Cuddle | Admin",
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }) {
  return <div className="crm-root">{children}</div>;
}
