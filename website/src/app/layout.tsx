import type { Metadata } from "next";
import { Manrope } from "next/font/google";
import "./globals.css";

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Choice — Everyday a match",
  description: "Choice ist eine Dating-App mit einem Match am Tag, klaren Phasen und mehr Klarheit statt endlosem Swipen.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="de" className={manrope.variable}>
      <body>{children}</body>
    </html>
  );
}
