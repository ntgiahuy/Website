"use client";

import Script from "next/script";

/** CDN membership gate — same as cot/mong/dam. */
export function MembershipScript() {
  return (
    <Script
      src="https://ntgiahuy.github.io/home/js/membership.js"
      strategy="afterInteractive"
    />
  );
}
