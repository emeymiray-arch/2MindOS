import type { Metadata } from "next";
import { QueryProvider } from "@/components/providers/QueryProvider";
import { AppShell } from "@/components/shell/AppShell";
import { AuthGate } from "@/components/shell/AuthGate";
import { DataGuard } from "@/components/shell/DataGuard";
import { ToastProvider } from "@/components/ui/Toast";
import "./globals.css";

export const metadata: Metadata = {
  title: "2Mind OS",
  description: "Личная операционная система жизни",
};

const themeBoot = `(function(){try{var t=localStorage.getItem("mindos-theme");document.documentElement.setAttribute("data-theme",t==="light"?"light":"dark");var a=localStorage.getItem("mindos-accent");var ok=["blue","green","purple","red","yellow"];document.documentElement.setAttribute("data-accent",ok.indexOf(a)>=0?a:"green");}catch(e){document.documentElement.setAttribute("data-theme","dark");document.documentElement.setAttribute("data-accent","green");}})();`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru" data-theme="dark" data-accent="green" className="h-full" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBoot }} />
      </head>
      <body className="min-h-full">
        <QueryProvider>
          <AuthGate>
            <DataGuard>
              <ToastProvider>
                <AppShell>{children}</AppShell>
              </ToastProvider>
            </DataGuard>
          </AuthGate>
        </QueryProvider>
      </body>
    </html>
  );
}
