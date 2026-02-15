import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Growthm - TikTok Content Intelligence",
  description: "Data-driven insights for your TikTok content strategy",
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
