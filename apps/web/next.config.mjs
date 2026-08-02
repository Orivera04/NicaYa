const configuredApiUrl = process.env.MOTOYA_API_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api";
const apiOrigin = configuredApiUrl.replace(/\/?api\/?$/, "");

/**
 * Browser requests are deliberately same-origin. Render gives the web and API
 * different public subdomains; a direct HttpOnly refresh cookie can therefore
 * be treated as a third-party cookie on some mobile browsers. Proxying `/api`
 * through the web makes the cookie first-party without exposing refresh tokens
 * to JavaScript.
 */
const nextConfig = {
  transpilePackages: ["@motoya/shared"],
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${apiOrigin}/api/:path*` }];
  },
};

export default nextConfig;
