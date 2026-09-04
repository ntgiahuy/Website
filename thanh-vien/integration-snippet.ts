/**
 * Mẫu tích hợp — dán logic này vào handler Xuất PDF của từng app.
 * App id: "cot" | "mong" | "dam"
 *
 * HTML: <script src="https://xd.giahuy.net/js/membership.js"></script>
 */

declare global {
  interface Window {
    GiaHuyMembership?: {
      requireActive: (opts?: {
        feature?: string;
        app?: string;
        onLocked?: (status: unknown) => void;
      }) => Promise<unknown | null>;
      getStatus: () => Promise<{ active: boolean; daysLeft: number; plan: string }>;
      formatExpiry: (status: { active: boolean; expiresAtMs: number; daysLeft: number }) => string;
    };
  }
}

export async function ensureMember(app: "cot" | "mong" | "dam", feature = "Xuất PDF") {
  const api = window.GiaHuyMembership;
  if (!api) {
    console.warn("Chưa nạp membership.js từ CDN");
    return false;
  }
  const ok = await api.requireActive({ feature, app });
  return !!ok;
}
