import type { Metadata } from "next";
import { withBasePath } from "@/lib/base-path";
import "./globals.css";
import { MembershipScript } from "./membership-script";

export const metadata: Metadata = {
  title: "Shop drawing thép sàn | GiaHuy.Net",
  description:
    "Nhập số liệu sàn BTCT và xuất shop thép sàn + bảng thống kê cốt thép ra PDF A2",
  icons: {
    icon: [
      { url: withBasePath("/favicon-96x96.png"), sizes: "96x96", type: "image/png" },
      { url: withBasePath("/favicon.ico") },
    ],
    apple: [{ url: withBasePath("/favicon-96x96.png"), sizes: "96x96", type: "image/png" }],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi" className="h-full antialiased">
      <body className="min-h-full">
        <MembershipScript />
        {children}
      </body>
    </html>
  );
}
