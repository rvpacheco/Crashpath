import { describe, it, expect } from "vitest";
import crypto from "node:crypto";
import {
  firmar,
  verificar,
  emailPermitido,
  redirectPermitido,
  pkceValido,
  claveFirma,
  escaparHtml,
} from "../lib/mcpAuth.js";

const ENV = { NEXTAUTH_SECRET: "secreto-de-prueba", MCP_ALLOWED_EMAILS: "rvpacheco17@gmail.com, Otro@Gmail.com" };

describe("tokens", () => {
  it("un token solo vale para su tipo", () => {
    const code = firmar("code", { email: "a@b.c" }, ENV);
    expect(verificar(code, "code", ENV)?.email).toBe("a@b.c");
    expect(verificar(code, "access", ENV)).toBeNull();
    expect(verificar(code, "refresh", ENV)).toBeNull();
  });

  it("firmado con otra clave no vale", () => {
    const t = firmar("access", { email: "a@b.c" }, { NEXTAUTH_SECRET: "otra" });
    expect(verificar(t, "access", ENV)).toBeNull();
  });

  it("la clave derivada no es NEXTAUTH_SECRET (un token del MCP no es una sesión)", () => {
    expect(claveFirma(ENV)).not.toBe(ENV.NEXTAUTH_SECRET);
    expect(claveFirma({ ...ENV, MCP_JWT_SECRET: "propia" })).toBe("propia");
  });

  it("basura no revienta", () => {
    expect(verificar("no-es-jwt", "access", ENV)).toBeNull();
    expect(verificar(undefined, "access", ENV)).toBeNull();
  });
});

describe("emailPermitido", () => {
  it("tiene que estar en la lista Y ser admin", () => {
    expect(emailPermitido("RVPacheco17@gmail.com", ENV)).toBe(true);
    // En la lista pero no es admin:
    expect(emailPermitido("otro@gmail.com", ENV)).toBe(false);
    // Admin pero no está en la lista:
    expect(emailPermitido("jdba.94@gmail.com", ENV)).toBe(false);
  });

  it("sin MCP_ALLOWED_EMAILS no entra nadie", () => {
    expect(emailPermitido("rvpacheco17@gmail.com", { NEXTAUTH_SECRET: "x" })).toBe(false);
  });
});

describe("redirectPermitido", () => {
  it("deja Claude y localhost", () => {
    expect(redirectPermitido("https://claude.ai/api/mcp/auth_callback")).toBe(true);
    expect(redirectPermitido("https://claude.com/api/mcp/auth_callback")).toBe(true);
    expect(redirectPermitido("http://localhost:6274/oauth/callback")).toBe(true);
    expect(redirectPermitido("http://127.0.0.1:33418/callback")).toBe(true);
  });

  it("rechaza cualquier otro host, http remoto y trucos de host", () => {
    expect(redirectPermitido("https://evil.com/cb")).toBe(false);
    expect(redirectPermitido("http://claude.ai/cb")).toBe(false);
    expect(redirectPermitido("https://claude.ai.evil.com/cb")).toBe(false);
    expect(redirectPermitido("https://evilclaude.ai/cb")).toBe(false);
    expect(redirectPermitido("javascript:alert(1)")).toBe(false);
    expect(redirectPermitido("no es url")).toBe(false);
  });

  it("MCP_REDIRECT_HOSTS agrega hosts", () => {
    expect(redirectPermitido("https://mi.app/cb", { MCP_REDIRECT_HOSTS: "mi.app" })).toBe(true);
  });
});

describe("PKCE", () => {
  it("S256", () => {
    const verifier = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk";
    const challenge = crypto.createHash("sha256").update(verifier).digest("base64url");
    expect(pkceValido(verifier, challenge)).toBe(true);
    expect(pkceValido("otro", challenge)).toBe(false);
    expect(pkceValido(undefined, challenge)).toBe(false);
  });
});

it("escaparHtml", () => {
  expect(escaparHtml(`<a href="x">'&`)).toBe("&lt;a href=&quot;x&quot;&gt;&#39;&amp;");
});
