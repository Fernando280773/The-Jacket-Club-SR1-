import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { SiteFooter } from "@/components/SiteFooter";
import "./globals.css";

// Fonts are bundled with the app (SIL Open Font Licence, see src/app/fonts).
const display = localFont({ src: "./fonts/AlfaSlabOne-latin.woff2", weight: "400", variable: "--font-display", display: "swap" });
const body = localFont({ src: "./fonts/DMSans-latin-variable.woff2", weight: "100 1000", variable: "--font-body", display: "swap" });

export const metadata: Metadata = {
  title: "The Jacket Club SR1",
  description: "Jacket potatoes, smash burgers and breakfast at 12–14 Park Lane, Sunderland. Collect, eat in, book or get it delivered.",
  icons: { icon: "/icon-192.png", apple: "/icon-192.png" },
};

export const viewport: Viewport = {
  themeColor: "#1F4A2C",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en-GB">
      <body className={`${display.variable} ${body.variable} antialiased`}>
        {children}
        <SiteFooter />
      </body>
    </html>
  );
}
