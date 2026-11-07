import type { Metadata } from "next";
import { IBM_Plex_Mono, Pixelify_Sans } from "next/font/google";
import "@solana/wallet-adapter-react-ui/styles.css";
import "./globals.css";
import { Desktop } from "@/components/os/Desktop";
import { OSProvider } from "@/components/os/OS";
import { Providers } from "@/components/Providers";

const pixelify = Pixelify_Sans({ variable: "--font-pixelify", subsets: ["latin"], weight: ["400", "600", "700"] });
const plex = IBM_Plex_Mono({ variable: "--font-plex", subsets: ["latin"], weight: ["400", "500", "600", "700"] });

export const metadata: Metadata = {
  title: "DropSafe OS",
  description: "Group buys on Solana Devnet where buyers pay into an escrow account with no private key.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${pixelify.variable} ${plex.variable}`}>
      <body>
        <Providers>
          <OSProvider>
            <Desktop>{children}</Desktop>
          </OSProvider>
        </Providers>
      </body>
    </html>
  );
}
