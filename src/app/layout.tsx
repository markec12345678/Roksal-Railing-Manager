import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { ThemeProvider } from "next-themes";
import { ServiceWorkerRegister } from "@/components/roksal/sw-register";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Roksal Railing Manager",
  description: "Profesionalno orodje za monterje balkonskih ograj — meritve, AR vizualizacija, kalkulator, skice, galerija.",
  keywords: ["Roksal", "ograde", "WPC", "Inox", "montaža", "balkon", "Slovenija"],
  authors: [{ name: "Roksal d.o.o. Kranj" }],
  manifest: "/manifest.json",
  icons: {
    icon: "/icon.svg",
    apple: "/icon-192.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Roksal",
  },
};

export const viewport: Viewport = {
  themeColor: "#1d2b3e",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="sl" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem={false}
          disableTransitionOnChange
        >
          {children}
        </ThemeProvider>
        <ServiceWorkerRegister />
        <Toaster />
      </body>
    </html>
  );
}
