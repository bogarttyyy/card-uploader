import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";

export const metadata: Metadata = {
  title: "Card Upload",
  description: "Next.js port in progress for the credit card PDF to CSV converter.",
  icons: {
    icon: [
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <Script id="theme-bootstrap" strategy="beforeInteractive">
          {`try {
  var storedTheme = window.localStorage.getItem("card-uploader-theme");
  var prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  document.documentElement.classList.toggle("dark", storedTheme ? storedTheme === "dark" : prefersDark);
} catch {
  document.documentElement.classList.remove("dark");
}`}
        </Script>
      </head>
      <body>{children}</body>
    </html>
  );
}
