import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Card Upload",
  description: "Next.js port in progress for the credit card PDF to CSV converter.",
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
