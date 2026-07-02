import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MovieMatch",
  description: "Dein Filmgeschmack. Dein nächster Film.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="de">
      <body>{children}</body>
    </html>
  );
}
