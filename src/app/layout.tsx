import type { Metadata } from "next";
import { AppShell } from "@/components/shell/AppShell";
import { AuthGate } from "@/components/shell/AuthGate";
import { DataGuard } from "@/components/shell/DataGuard";
import { ToastProvider } from "@/components/ui/Toast";
import "./globals.css";

export const metadata: Metadata = {
  title: "2Mind OS",
  description: "Личная операционная система жизни",
};

const themeBoot = `(function(){try{var t=localStorage.getItem("mindos-theme");document.documentElement.setAttribute("data-theme",t==="light"?"light":"dark");}catch(e){document.documentElement.setAttribute("data-theme","dark");}})();`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru" data-theme="dark" className="h-full" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBoot }} />
      </head>
      <body className="min-h-full">
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
