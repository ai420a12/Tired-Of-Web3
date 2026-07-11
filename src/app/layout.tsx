import type { Metadata } from "next";
import { JetBrains_Mono, Space_Grotesk } from "next/font/google";
import "./globals.css";

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://tiredofweb3.xyz"),
  title: "$TIRED — I'm Tired of Web3",
  description:
    "Finally, a coin that's as tired of this shit as you are. $TIRED — the memecoin for everyone exhausted by rugs, influencers, and Web3 hype.",
  keywords: [
    "TIRED",
    "memecoin",
    "Web3",
    "crypto",
    "solana",
    "TiredOfWeb3",
    "anti-hype",
  ],
  openGraph: {
    title: "$TIRED — I'm Tired of Web3",
    description:
      "Finally, a coin that's as tired of this shit as you are.",
    images: ["/images/banner.jpg"],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "$TIRED — I'm Tired of Web3",
    description:
      "Finally, a coin that's as tired of this shit as you are.",
    images: ["/images/banner.jpg"],
    creator: "@TiredOfWeb3",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${spaceGrotesk.variable} ${jetbrainsMono.variable} min-h-screen bg-background text-foreground antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
