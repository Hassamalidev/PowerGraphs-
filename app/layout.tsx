import type { Metadata, Viewport } from "next";
import type { CSSProperties, ReactNode } from "react";
import { UiProvider } from "@/components/ui/UiProvider";
import { SITE_NAME, themeCssVars } from "@/lib/theme";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: SITE_NAME, template: `%s – ${SITE_NAME}` },
  description: "Turn government economic data into clean, presentation-ready charts for management meetings.",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" style={themeCssVars() as CSSProperties}>
      <body>
        <UiProvider>{children}</UiProvider>
      </body>
    </html>
  );
}
