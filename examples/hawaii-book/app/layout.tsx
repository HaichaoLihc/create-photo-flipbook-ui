import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Hawaii 2026 — Interactive Photo Book",
  description: "A tactile, page-turning Hawaii travel photo book.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
