/**
 * Khóa Xuất PDF bằng membership.js trên hub (/shop-drawing/assets/).
 * KHÔNG copy membership.js vào san/app/. Không OTP / đăng ký trong app sàn.
 */

type MembershipApi = {
  requireActive?: (opts: {
    feature: string;
    app?: string;
  }) => Promise<unknown>;
};

type WinWithMembership = Window & { GiaHuyMembership?: MembershipApi };

function isLocalDevHost(): boolean {
  if (typeof window === "undefined") return true;
  const proto = String(window.location.protocol || "").toLowerCase();
  if (proto === "file:") return true;
  const h = window.location.hostname.replace(/^www\./i, "").toLowerCase();
  if (!h || h === "localhost" || h === "127.0.0.1" || h === "::1") return true;
  if (/^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[0-1])\.)/.test(h)) return true;
  return false;
}

/** Ưu tiên window.parent khi app chạy trong iframe Home. */
function membershipApi(): MembershipApi | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    const parentWin = window.parent as WinWithMembership | null;
    if (
      parentWin &&
      parentWin !== window &&
      parentWin.GiaHuyMembership &&
      typeof parentWin.GiaHuyMembership.requireActive === "function"
    ) {
      return parentWin.GiaHuyMembership;
    }
  } catch {
    /* cross-origin parent */
  }
  return (window as WinWithMembership).GiaHuyMembership;
}

/** true = được xuất; false = đã khóa / user hủy popup đăng nhập. */
export async function ensureMemberForExport(feature: string): Promise<boolean> {
  if (isLocalDevHost()) return true;
  const api = membershipApi();
  if (!api || typeof api.requireActive !== "function") return false;
  const ok = await api.requireActive({ feature, app: "san" });
  return !!ok;
}
