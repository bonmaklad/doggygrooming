import "./globals.css";
import { Poppins, Quicksand } from "next/font/google";

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-heading",
  display: "swap",
});

const quicksand = Quicksand({
  subsets: ["latin"],
  weight: ["400", "600"],
  variable: "--font-body",
  display: "swap",
});

export const metadata = {
  title: "Cut & Cuddle Grooming",
  description:
    "Cut & Cuddle offers loving, gentle grooming experiences for every dog in Whanganui. Explore services, book online, and discover our happy pups gallery.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={`${poppins.variable} ${quicksand.variable}`}>{children}</body>
    </html>
  );
}
