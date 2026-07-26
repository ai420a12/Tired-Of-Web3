import type { Metadata } from "next";
import { JetBrains_Mono, Space_Grotesk } from "next/font/google";
import "./globals.css";
// Favicon refresh for Google Search


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
    "Finally, a project that's as tired of this shit as you are. $TIRED — the memecoin for everyone exhausted by rugs, influencers, and Web3 hype.",
  keywords: [
    "TIRED",
    "memecoin",
    "Web3",
    "crypto",
    "solana",
    "TiredOfWeb3",
    "anti-hype",
  ],
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icon-48.png", type: "image/png", sizes: "48x48" },
      { url: "/icon-96.png", type: "image/png", sizes: "96x96" },
      { url: "/icon.png", type: "image/png", sizes: "192x192" },
    ],
    apple: [{ url: "/apple-icon.png", sizes: "180x180", type: "image/png" }],
  },
  openGraph: {
    title: "$TIRED — I'm Tired of Web3",
    description:
      "Finally, a project that's as tired of this shit as you are.",
    images: ["/images/banner.jpg"],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "$TIRED — I'm Tired of Web3",
    description:
      "Finally, a project that's as tired of this shit as you are.",
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
