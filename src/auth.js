import crypto from "node:crypto";

export class AuthManager {
  constructor(config, traceStore) {
    this.config = config;
    this.traceStore = traceStore;
    this.sessions = new Map();
  }

  login(username, passkey, requestMeta = {}) {
    const validUser = username === this.config.operatorUser;
    const validPasskey = passkey === this.config.operatorPasskey;
    if (!validUser || !validPasskey) {
      this.traceStore.addAudit({ type: "auth-failure", username, requestMeta, timestamp: Date.now() });
      return null;
    }
    const token = crypto.randomBytes(24).toString("base64url");
    const session = {
      token,
      username,
      role: "admin",
      issuedAt: Date.now(),
      expiresAt: Date.now() + this.config.sessionTtlMs,
      requestMeta
    };
    this.sessions.set(token, session);
    this.traceStore.addAudit({ type: "auth-login", username, tokenPreview: token.slice(0, 8), requestMeta, timestamp: Date.now() });
    this.traceStore.events.emit("auth", { type: "login", username, role: session.role, timestamp: Date.now() });
    return session;
  }

  verify(token) {
    if (!token) {
      return null;
    }
    const session = this.sessions.get(token);
    if (!session) {
      return null;
    }
    if (session.expiresAt < Date.now()) {
      this.sessions.delete(token);
      return null;
    }
    return session;
  }

  logout(token) {
    const session = this.sessions.get(token);
    if (session) {
      this.sessions.delete(token);
      this.traceStore.addAudit({ type: "auth-logout", username: session.username, tokenPreview: token.slice(0, 8), timestamp: Date.now() });
      this.traceStore.events.emit("auth", { type: "logout", username: session.username, timestamp: Date.now() });
    }
  }
}

export function extractBearerToken(request) {
  const authHeader = request.headers.authorization || "";
  if (authHeader.startsWith("Bearer ")) {
    return authHeader.slice(7).trim();
  }
  const cookie = request.headers.cookie || "";
  const match = cookie.match(/netracer_session=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}
