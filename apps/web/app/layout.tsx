import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AML Insight",
  description: "Transaction network analysis for anti-money-laundering investigations",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
