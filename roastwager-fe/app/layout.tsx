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
      <body className="bg-(--bg-main) text-(--text-main)">
        <ClientShellNoSSR>{children}</ClientShellNoSSR>
      </body>
    </html>
  );
}
