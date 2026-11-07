import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "@solana/wallet-adapter-react-ui/styles.css";
import "./globals.css";
import { Header } from "@/components/Header";
import { Providers } from "@/components/Providers";

const sans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const mono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "DropSafe",
  description: "On-chain escrow for group buys on Solana. Miss the target and buyers take their SOL back.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable}`}>
      <body>
        <Providers>
          <Header />
          <main className="mx-auto max-w-5xl px-4 py-10">{children}</main>
        </Providers>
      </body>
    </html>
  );
}
