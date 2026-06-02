import type { ReactNode } from "react";
import "./globals.css";

export const metadata = {
  title: "Open Alpha — Trading OS",
  description: "Autonomous Solana trading operating system. Every decision, explained.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
