import type { Metadata, Viewport } from "next";
import {
  Newsreader,
  Noto_Sans_Devanagari,
  Noto_Sans_Kannada,
  Noto_Sans_Tamil,
  Noto_Sans_Telugu,
  Source_Sans_3,
} from "next/font/google";
import "./globals.css";

const sourceSans = Source_Sans_3({
  subsets: ["latin"],
  weight: ["400", "600"],
  display: "swap",
  variable: "--font-sans",
});

const newsreader = Newsreader({
  subsets: ["latin"],
  weight: ["500", "600"],
  display: "swap",
  variable: "--font-serif",
});

const telugu = Noto_Sans_Telugu({
  subsets: ["telugu"],
  weight: "500",
  display: "swap",
  preload: false,
  variable: "--font-te",
});

const devanagari = Noto_Sans_Devanagari({
  subsets: ["devanagari"],
  weight: "500",
  display: "swap",
  preload: false,
  variable: "--font-deva",
});

const kannada = Noto_Sans_Kannada({
  subsets: ["kannada"],
  weight: "500",
  display: "swap",
  preload: false,
  variable: "--font-kn",
});

const tamil = Noto_Sans_Tamil({
  subsets: ["tamil"],
  weight: "500",
  display: "swap",
  preload: false,
  variable: "--font-ta",
});

export const metadata: Metadata = {
  title: "Farmer AI",
  description: "Crop advice for one farm: chat and today's weather.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#f4f1e8",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${sourceSans.variable} ${newsreader.variable} ${telugu.variable} ${devanagari.variable} ${kannada.variable} ${tamil.variable}`}
    >
      <body className="min-h-screen bg-canvas font-sans text-base text-ink antialiased">
        {children}
      </body>
    </html>
  );
}
