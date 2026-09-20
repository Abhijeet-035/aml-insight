import type { Metadata } from "next";
import "./globals.css";
import MobileMenu from "./components/MobileMenu";

export const metadata: Metadata = {
  title: "AML Insight",
  description:
    "Transaction network analysis for anti-money-laundering investigations",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <MobileMenu />
        {children}
      </body>
    </html>
  );
}
