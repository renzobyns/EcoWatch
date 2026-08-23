import type { Metadata } from "next";
import "./globals.css";
import Navbar from "@/components/Navbar";
import { Toaster } from "sonner";
import { ThemeProvider } from "@/components/ThemeProvider";
import { ShortcutsProvider } from "@/contexts/ShortcutsContext";
import { GoogleOAuthProvider } from '@react-oauth/google';
import Script from "next/script";
import { Analytics } from '@vercel/analytics/next';

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
        <Script src="https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit" strategy="afterInteractive" />
        <Script id="google-translate-init" strategy="afterInteractive">
          {`
            function googleTranslateElementInit() {
              new google.translate.TranslateElement({pageLanguage: 'en', includedLanguages: 'tl'}, 'google_translate_element');
            }

            // MutationObserver: fight Google Translate's inline margin-top injection on <html>
            (function() {
              function stripGTMargin() {
                var html = document.documentElement;
                var body = document.body;
                if (html && html.style.marginTop) html.style.marginTop = '';
                if (html && html.style.top) html.style.top = '';
                if (body && body.style.marginTop) body.style.marginTop = '';
                if (body && body.style.top) body.style.top = '';
              }

              var observer = new MutationObserver(function(mutations) {
                mutations.forEach(function(m) {
                  if (m.attributeName === 'style') stripGTMargin();
                });
              });

              function startObserver() {
                stripGTMargin();
                observer.observe(document.documentElement, { attributes: true, attributeFilter: ['style'] });
                if (document.body) {
                  observer.observe(document.body, { attributes: true, attributeFilter: ['style'] });
                }
              }

              if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', startObserver);
              } else {
                startObserver();
              }
            })();
          `}
        </Script>
        <style dangerouslySetInnerHTML={{ __html: `
          /* Hide old and new Google Translate banners */
          .goog-te-banner-frame.skiptranslate, .goog-te-banner-frame { display: none !important; }
          iframe.skiptranslate { display: none !important; }
          html, body { 
              top: 0px !important; 
              position: static !important; 
              margin-top: 0px !important; 
          }
          
          /* Hide newer Material-style banner */
          .VIpgJd-Zvi9od-ORHb-OEVmcd { display: none !important; }
          .VIpgJd-Zvi9od-aZ2wEe-wOHMyf { display: none !important; }
          
          /* Hide tooltip and highlight */
          #google_translate_element { display: none !important; }
          .goog-tooltip { display: none !important; }
          .goog-tooltip:hover { display: none !important; }
          .goog-text-highlight { background-color: transparent !important; border: none !important; box-shadow: none !important; }
        `}} />
      </head>
      <body className="antialiased min-h-screen" suppressHydrationWarning>
        <GoogleOAuthProvider clientId={process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || ""}>
          <ThemeProvider>
            <ShortcutsProvider>
              <div id="google_translate_element" suppressHydrationWarning></div>
              <Navbar />
              <main className="pt-20">
                {children}
              </main>
              <Toaster richColors position="top-right" theme="system" />
            </ShortcutsProvider>
          </ThemeProvider>
        </GoogleOAuthProvider>
        <Analytics />
      </body>
    </html>
  );
}
