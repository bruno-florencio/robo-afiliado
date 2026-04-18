const crypto = require("node:crypto");

const SESSION_DURATION_MS = 1000 * 60 * 60 * 12;

function parseCookies(header = "") {
  return header
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean)
    .reduce((cookies, item) => {
      const separatorIndex = item.indexOf("=");

      if (separatorIndex === -1) {
        return cookies;
      }

      const key = item.slice(0, separatorIndex);
      const value = item.slice(separatorIndex + 1);
      cookies[key] = decodeURIComponent(value);
      return cookies;
    }, {});
}

function toSafeBuffer(value) {
  return Buffer.from(String(value || ""), "utf8");
}

function constantTimeEquals(left, right) {
  const leftBuffer = toSafeBuffer(left);
  const rightBuffer = toSafeBuffer(right);

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function sha256(value) {
  return crypto.createHash("sha256").update(String(value || ""), "utf8").digest("hex");
}

function verifyPassword(inputPassword, expectedPasswordHash) {
  if (!expectedPasswordHash) {
    return false;
  }

  const [algorithm, salt, storedHash] = String(expectedPasswordHash).split(":");

  if (algorithm !== "scrypt" || !salt || !storedHash) {
    return false;
  }

  const derivedHash = crypto.scryptSync(String(inputPassword || ""), salt, 64).toString("hex");
  return constantTimeEquals(derivedHash, storedHash);
}

function createAuthManager({ usernameHash, passwordHash, sessionSecret }) {
  const sessions = new Map();

  function createSession(usernameValue) {
    const sessionId = crypto.randomBytes(24).toString("hex");
    const csrfToken = crypto.randomBytes(24).toString("hex");
    sessions.set(sessionId, {
      username: usernameValue,
      csrfToken,
      expiresAt: Date.now() + SESSION_DURATION_MS,
    });

    return { sessionId, csrfToken };
  }

  function getSession(sessionId) {
    if (!sessionId) {
      return null;
    }

    const session = sessions.get(sessionId);
    if (!session) {
      return null;
    }

    if (session.expiresAt < Date.now()) {
      sessions.delete(sessionId);
      return null;
    }

    session.expiresAt = Date.now() + SESSION_DURATION_MS;
    return session;
  }

  function destroySession(sessionId) {
    sessions.delete(sessionId);
  }

  function verifyCredentials(inputUsername, inputPassword) {
    return (
      constantTimeEquals(sha256(inputUsername), usernameHash) &&
      verifyPassword(inputPassword, passwordHash)
    );
  }

  function signLogoutCookie() {
    return "admin_session=; HttpOnly; Path=/; Max-Age=0; SameSite=Strict";
  }

  function signSessionCookie(sessionId) {
    const signature = crypto
      .createHmac("sha256", sessionSecret)
      .update(sessionId)
      .digest("hex");

    const cookieValue = `${sessionId}.${signature}`;
    return `admin_session=${cookieValue}; HttpOnly; Path=/; Max-Age=${
      SESSION_DURATION_MS / 1000
    }; SameSite=Strict`;
  }

  function readSessionFromRequest(request) {
    const cookies = parseCookies(request.headers.cookie);
    const rawCookie = cookies.admin_session;

    if (!rawCookie) {
      return null;
    }

    const [sessionId, signature] = rawCookie.split(".");
    const expectedSignature = crypto
      .createHmac("sha256", sessionSecret)
      .update(sessionId || "")
      .digest("hex");

    if (!sessionId || !signature || !constantTimeEquals(signature, expectedSignature)) {
      return null;
    }

    return getSession(sessionId);
  }

  return {
    createSession,
    destroySession,
    parseCookies,
    readSessionFromRequest,
    signLogoutCookie,
    signSessionCookie,
    verifyCredentials,
  };
}

module.exports = {
  createAuthManager,
};
