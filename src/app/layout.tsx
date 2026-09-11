import type { Metadata } from "next";
import { Onest } from "next/font/google";
import { AppShell } from "@/components/shell/AppShell";
import { AuthGate } from "@/components/shell/AuthGate";
import { DataGuard } from "@/components/shell/DataGuard";
import { ToastProvider } from "@/components/ui/Toast";
import "./globals.css";

const sans = Onest({
  subsets: ["latin", "cyrillic"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "2Mind OS",
  description: "Личная операционная система жизни",
};

const themeBoot = `(function(){try{var t=localStorage.getItem("mindos-theme");if(t==="dark"||t==="light")document.documentElement.setAttribute("data-theme",t);}catch(e){}})();`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru" className={`h-full ${sans.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBoot }} />
      </head>
      <body className="min-h-full" style={{ fontFamily: "var(--font-sans), Onest, system-ui, sans-serif" }}>
        <AuthGate>
          <DataGuard>
            <ToastProvider>
              <AppShell>{children}</AppShell>
            </ToastProvider>
          </DataGuard>
        </AuthGate>
      </body>
    </html>
  );
}
