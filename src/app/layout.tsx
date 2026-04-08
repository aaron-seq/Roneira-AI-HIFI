import type { Metadata } from "next";
import { JetBrains_Mono } from "next/font/google";
import { GeistSans } from "geist/font";
import "./globals.css";
import { Providers } from "./providers";

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Roneira AI HIFI - High-Impact Finance Intelligence",
    template: "%s | Roneira AI HIFI",
  },
  description:
    "AI-powered stock prediction and portfolio management platform for Indian (NSE/BSE) and US (NYSE/NASDAQ) markets. ML-driven price forecasting with LSTM, Random Forest, and ensemble models.",
  keywords: [
    "stock prediction",
    "AI finance",
    "portfolio management",
    "NSE",
    "BSE",
    "NASDAQ",
    "machine learning",
    "LSTM",
    "trading",
  ],
  authors: [{ name: "Aaron Sequeira" }],
  openGraph: {
    title: "Roneira AI HIFI",
    description: "AI-powered financial intelligence platform",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" data-theme="dark" suppressHydrationWarning>
      <body
        className={`min-h-screen antialiased ${GeistSans.variable} ${jetbrainsMono.variable}`}
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
