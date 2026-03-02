import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Merchants Map | Up Hellas",
  description: "Interactive map of all partner merchants powered by Up Hellas."
};

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="el">
      <body>{children}</body>
    </html>
  );
}

