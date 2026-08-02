import type { Metadata } from "next";
import { Instrument_Serif, JetBrains_Mono } from "next/font/google";
import { GeistSans } from "geist/font";
import "./globals.css";
import { Providers } from "./providers";

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});

// Display face for the research surfaces. Geist alone is Vercel's default and
// reads as generic SaaS; a high-contrast editorial serif frames a prediction as
// a finding with stated uncertainty rather than a signal being shouted. Used
// sparingly — verdicts and section titles only, never for data.
const instrumentSerif = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  variable: "--font-instrument-serif",
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
        className={`min-h-screen antialiased ${GeistSans.variable} ${jetbrainsMono.variable} ${instrumentSerif.variable}`}
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
