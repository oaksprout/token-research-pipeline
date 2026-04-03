import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Nav } from "@/components/nav";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Token Research Pipeline",
  description: "Crypto research dashboard",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`dark ${inter.className}`}>
      <body className="min-h-screen bg-zinc-950 text-zinc-100 antialiased">
        <TooltipProvider>
          <Nav />
          <main className="mx-auto max-w-7xl px-4 py-6">{children}</main>
        </TooltipProvider>
      </body>
    </html>
  );
}
