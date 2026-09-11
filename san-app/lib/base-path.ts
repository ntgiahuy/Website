/** GitHub Pages path under Website CDN: https://ntgiahuy.github.io/home/san/ */
export const BASE_PATH = "/home/san";

export function withBasePath(path: string) {
  const p = path.startsWith("/") ? path : `/${path}`;
  if (p === BASE_PATH || p.startsWith(`${BASE_PATH}/`)) return p;
  return `${BASE_PATH}${p}`;
}
