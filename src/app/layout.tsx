import type { Metadata, Viewport } from "next";
import { Outfit, Syne, JetBrains_Mono } from "next/font/google";
import { ThemeProvider } from "@/components/theme/theme-provider";
import { LocaleProvider } from "@/components/i18n/locale-provider";
import { WelcomeGate } from "@/components/welcome-gate";
import { brand } from "@/config/site";
import "./globals.css";

const body = Outfit({
  variable: "--font-body",
  subsets: ["latin"],
  display: "swap",
});

const display = Syne({
  variable: "--font-display",
  subsets: ["latin"],
  display: "swap",
});

const mono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: brand.name,
    template: `%s · ${brand.name}`,
  },
  description: brand.description,
  applicationName: brand.name,
  metadataBase: new URL(brand.url),
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: brand.name,
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/favicon-32.png", type: "image/png", sizes: "32x32" },
    ],
    apple: [{ url: "/favicon-32.png", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#000000",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="tg"
      suppressHydrationWarning
      className="h-full"
      data-scroll-behavior="smooth"
    >
      <body
        className={`${body.variable} ${display.variable} ${mono.variable} min-h-full antialiased`}
      >
        <ThemeProvider>
          <LocaleProvider>
            <WelcomeGate>{children}</WelcomeGate>
          </LocaleProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
