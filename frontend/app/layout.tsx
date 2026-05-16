import type { Metadata } from "next";
import "./globals.css";
import Navbar from "@/components/Navbar";
import { Toaster } from "sonner";

export const metadata: Metadata = {
  title: "EcoWatch SJDM | Sustainable Environmental Monitoring",
  description: "Advanced geospatial reporting and monitoring for San Jose del Monte.",
  icons: {
    icon: "/logo.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased min-h-screen">
        <Navbar />
        <main className="pt-16">
          {children}
        </main>
        <Toaster richColors position="top-right" theme="dark" />
      </body>
    </html>
  );
}
