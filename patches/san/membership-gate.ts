/**
 * Khóa Xuất PDF bằng membership.js trên hosting hub.
 * Không copy JS cũ, không OTP/đăng nhập trong app sàn.
 */

type MembershipApi = {
  requireActive?: (opts: {
    feature: string;
    app?: string;
  }) => Promise<unknown>;
};

function isLocalDevHost(): boolean {
  if (typeof window === "undefined") return true;
  const proto = String(window.location.protocol || "").toLowerCase();
  if (proto === "file:") return true;
  const h = window.location.hostname.replace(/^www\./i, "").toLowerCase();
  // localhost / IP nội bộ / hostname trống — chạy độc lập không cần CDN
  if (!h || h === "localhost" || h === "127.0.0.1" || h === "::1") return true;
  if (/^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[0-1])\.)/.test(h)) return true;
  return false;
}

function membershipApi(): MembershipApi | undefined {
  if (typeof window === "undefined") return undefined;
  return (window as Window & { GiaHuyMembership?: MembershipApi }).GiaHuyMembership;
}

/** true = được xuất; false = đã khóa / user hủy popup đăng nhập. */
export async function ensureMemberForExport(feature: string): Promise<boolean> {
  if (isLocalDevHost()) return true;
  const api = membershipApi();
  if (!api || typeof api.requireActive !== "function") return true;
  const ok = await api.requireActive({ feature, app: "san" });
  return !!ok;
}
