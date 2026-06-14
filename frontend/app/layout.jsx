import "./globals.css";
import { Space_Grotesk, Manrope, JetBrains_Mono } from "next/font/google";

const space = Space_Grotesk({ subsets: ["latin"], weight: ["500", "600", "700"], variable: "--font-space", display: "swap" });
const manrope = Manrope({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-manrope", display: "swap" });
const mono = JetBrains_Mono({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-mono-jb", display: "swap" });

export const metadata = {
  title: "Prompt2Resume — From prompt to polished résumé",
  description: "The AI resume builder & application tracker. From prompt to polished résumé in seconds.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${space.variable} ${manrope.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
