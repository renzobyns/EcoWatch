import type { Metadata } from "next";
import "./globals.css";
import Navbar from "@/components/Navbar";
import { Toaster } from "sonner";
import { ThemeProvider } from "@/components/ThemeProvider";

export const metadata: Metadata = {
  title: "EcoWatch SJDM | Sustainable Environmental Monitoring",
  description: "Advanced geospatial reporting and monitoring for San Jose del Monte.",
  icons: {
    icon: "/logo.png",
  },
};

// Injected synchronously in <head> to prevent FOUC on first paint.
const themeScript = `
try {
  var t = localStorage.getItem('ecowatch_theme');
  var sys = window.matchMedia('(prefers-color-scheme: dark)').matches;
  var dark = t ? t === 'dark' : (sys || true);
  if (dark) document.documentElement.classList.add('dark');
} catch (e) {}
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="antialiased min-h-screen">
        <ThemeProvider>
          <Navbar />
          <main className="pt-16">
            {children}
          </main>
          <Toaster richColors position="top-right" theme="system" />
        </ThemeProvider>
      </body>
    </html>
  );
}
