import type { Metadata } from "next";
import { IBM_Plex_Mono, Inter } from "next/font/google";
import { AuthProvider } from "@/context/AuthProvider";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import "./globals.css";

// next/font self-hosts these at build time: no request to Google at runtime, and
// no layout shift while a webfont swaps in.
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-plex-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Trunc — cut it short",
  description:
    "A URL shortener with click analytics and an MCP server. Paste a link and watch the request pass through every layer of the architecture as it runs.",
  openGraph: {
    title: "Trunc — cut it short",
    description:
      "A URL shortener that shows you its own machinery. Postgres, Express, Next.js, MCP.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${inter.variable} ${plexMono.variable}`}>
      <body className="flex min-h-dvh flex-col">
        <AuthProvider>
          <Navbar />
          <main className="flex-1">{children}</main>
          <Footer />
        </AuthProvider>
      </body>
    </html>
  );
}
