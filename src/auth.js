import crypto from "node:crypto";

const LOGIN_MAX_ATTEMPTS = 8;
const LOGIN_WINDOW_MS = 5 * 60 * 1000;

export class AuthManager {
  constructor(config, traceStore) {
    this.config = config;
    this.traceStore = traceStore;
    this.sessions = new Map();
    this.loginAttempts = new Map();
  }

  login(username, passkey, requestMeta = {}) {
    const throttleKey = String(requestMeta.ip || "unknown");
    if (this.isThrottled(throttleKey)) {
      this.traceStore.addAudit({ type: "auth-throttled", username, requestMeta, timestamp: Date.now() });
      return null;
    }

    const validUser = timingSafeStringEqual(username, this.config.operatorUser);
    const validPasskey = timingSafeStringEqual(passkey, this.config.operatorPasskey);
    if (!validUser || !validPasskey) {
      this.recordFailedAttempt(throttleKey);
      this.traceStore.addAudit({ type: "auth-failure", username, requestMeta, timestamp: Date.now() });
      return null;
    }
    this.loginAttempts.delete(throttleKey);
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

  isThrottled(key) {
    const record = this.loginAttempts.get(key);
    if (!record) return false;
    if (Date.now() - record.firstAttemptAt > LOGIN_WINDOW_MS) {
      this.loginAttempts.delete(key);
      return false;
    }
    return record.count >= LOGIN_MAX_ATTEMPTS;
  }

  recordFailedAttempt(key) {
    const now = Date.now();
    const record = this.loginAttempts.get(key);
    if (!record || now - record.firstAttemptAt > LOGIN_WINDOW_MS) {
      this.loginAttempts.set(key, { count: 1, firstAttemptAt: now });
      return;
    }
    record.count += 1;
  }
}

function timingSafeStringEqual(a, b) {
  const left = Buffer.from(String(a ?? ""), "utf8");
  const right = Buffer.from(String(b ?? ""), "utf8");
  if (left.length !== right.length) {
    // Still run a constant-time comparison against a same-length buffer so
    // the response time does not leak the expected credential length.
    crypto.timingSafeEqual(left, left);
    return false;
  }
  return crypto.timingSafeEqual(left, right);
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
