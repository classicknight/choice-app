import type { Metadata } from "next";
import { Cormorant_Garamond, Manrope } from "next/font/google";
import "./globals.css";

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
});

const editorial = Cormorant_Garamond({
  variable: "--font-editorial",
  subsets: ["latin"],
  weight: ["400", "500"],
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
    <html lang="de" className={`${manrope.variable} ${editorial.variable}`}>
      <body>{children}</body>
    </html>
  );
}
