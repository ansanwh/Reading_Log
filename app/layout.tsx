import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Reading Log",
  description: "나만의 독서기록장",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
