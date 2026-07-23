import type { Metadata, Viewport } from "next";
import { Inter, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as SonnerToaster } from "@/components/ui/sonner";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "CACI Hub — Assakae Central Assembly",
  description:
    "Christ Apostolic Church International — Assakae Central Assembly management platform. Members, groups, broadcasts, sermons and more.",
  keywords: [
    "CACI",
    "Christ Apostolic Church",
    "church management",
    "Assakae Central Assembly",
    "Ghana church",
  ],
  authors: [{ name: "CACI Hub" }],
  icons: {
    icon: "/logo.svg",
  },
  manifest: undefined,
  openGraph: {
    title: "CACI Hub — Assakae Central Assembly",
    description:
      "Christ Apostolic Church International management platform for Assakae Central Assembly.",
    siteName: "CACI Hub",
    type: "website",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false, // prevent zoom on input focus iOS
  themeColor: "#004BA0",
  viewportFit: "cover", // respect safe areas
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${inter.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster />
        <SonnerToaster position="top-center" />
      </body>
    </html>
  );
}
