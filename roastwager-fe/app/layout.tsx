import "./globals.css";
import type { Metadata, Viewport } from "next";
import ClientShellNoSSR from "./client-shell-no-ssr";

export const metadata: Metadata = {
  applicationName: "RoastWager",
  title: "RoastWager",
  description: "Predict, debate, and settle hot takes on-chain.",
  icons: {
    icon: [
      { url: "/favicon.ico" },
      { url: "/favicon/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon/favicon-32x32.png", sizes: "32x32", type: "image/png" },
    ],
    apple: [{ url: "/favicon/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "RoastWager",
    statusBarStyle: "black-translucent",
  },

};

export const viewport: Viewport = {
  themeColor: "#0f1117",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <meta name="talentapp:project_verification" content="fa90d5568a76f3107e764ad113395a534e44cd72536855ce80bcc02b558bd00132e7f24346f8670f0a6e8a4af97586207fd0b29277837447128999158ab6989c"></meta>
      <body className="bg-(--bg-main) text-(--text-main)">
        <ClientShellNoSSR>{children}</ClientShellNoSSR>
      </body>
    </html>
  );
}
