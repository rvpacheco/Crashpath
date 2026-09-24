/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // Descubrimiento OAuth del MCP (lib/mcpAuth.js). Los clientes lo buscan en
  // la raíz y también con la ruta del recurso como sufijo (RFC 9728/8414).
  async rewrites() {
    return [
      { source: "/.well-known/oauth-protected-resource", destination: "/api/oauth/protected-resource" },
      { source: "/.well-known/oauth-protected-resource/:path*", destination: "/api/oauth/protected-resource" },
      { source: "/.well-known/oauth-authorization-server", destination: "/api/oauth/metadata" },
      { source: "/.well-known/oauth-authorization-server/:path*", destination: "/api/oauth/metadata" },
      { source: "/.well-known/openid-configuration", destination: "/api/oauth/metadata" },
    ];
  },
}

module.exports = nextConfig
