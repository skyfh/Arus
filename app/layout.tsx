import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { TestnetBanner } from "@/components/testnet-banner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Arus — USD wallet with Zeke",
  description:
    "Get paid from anywhere. Cash out to Ryt Bank, Touch 'n Go or any DuitNow bank. Proof for every payment, and an assistant that speaks your language.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <TestnetBanner />
        {children}
      </body>
    </html>
  );
}
