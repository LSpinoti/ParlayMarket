import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Navigation from "@/components/Navigation";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "ParlayMarket - Decentralized Parlay Trading",
  description: "Create and trade fully collateralized parlay markets on Flare Network",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.className} bg-gray-950 text-white min-h-screen flex flex-col`}>
        <Navigation />
        <main className="container mx-auto px-4 py-8 flex-1">
          {children}
        </main>
        <footer className="py-4 text-center text-gray-500 text-xs">
          © {new Date().getFullYear()} ParlayMarket. All rights reserved.
        </footer>
      </body>
    </html>
  );
}
