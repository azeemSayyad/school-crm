import type { Metadata } from "next";
import { DM_Sans, Inter } from "next/font/google";
import { AuthProvider } from "@/lib/auth-context";
import "./globals.css";

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "GMTTI CRM",
  description: "GMTTI CRM - Enrollment Pipeline Management",
  icons: {
    icon: [
      { url: "/web-app-manifest-192x192.png", sizes: "192x192", type: "image/png" },
      { url: "/web-app-manifest-512x512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: "/web-app-manifest-192x192.png",
  },
  appleWebApp: {
    capable: true,
    title: "GMTTI",
    statusBarStyle: "black-translucent",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${dmSans.variable} ${inter.variable} h-full`}>
      <body className="h-full" style={{ fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'SF Pro Display', sans-serif" }}>
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
