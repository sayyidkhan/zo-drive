import { createHmac, timingSafeEqual } from "node:crypto";

type SessionPayload = {
  userId: string;
  expiresAt: number;
};

export class SessionService {
  constructor(private readonly secret: string, private readonly now = () => Date.now()) {
    if (secret.length < 32) throw new Error("ZO_DRIVE_SESSION_SECRET must be at least 32 characters");
  }

  create(userId: string): string {
    const payload = Buffer.from(JSON.stringify({ userId, expiresAt: this.now() + 7 * 24 * 60 * 60 * 1_000 })).toString("base64url");
    return `${payload}.${this.sign(payload)}`;
  }

  userIdFromToken(token: string | undefined): string | null {
    if (!token) return null;
    const [payload, signature] = token.split(".");
    if (!payload || !signature || !safeEqual(signature, this.sign(payload))) return null;
    try {
      const decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as SessionPayload;
      return typeof decoded.userId === "string" && decoded.expiresAt > this.now() ? decoded.userId : null;
    } catch {
      return null;
    }
  }

  userIdFromRequest(request: Request): string | null {
    const authorization = request.headers.get("authorization");
    const bearerToken = authorization?.match(/^Bearer (.+)$/i)?.[1];
    return this.userIdFromToken(bearerToken ?? cookieValue(request.headers.get("cookie"), "zo_drive_session"));
  }

  cookieHeader(token: string, secure: boolean): string {
    return `zo_drive_session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800${secure ? "; Secure" : ""}`;
  }

  clearCookieHeader(secure: boolean): string {
    return `zo_drive_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure ? "; Secure" : ""}`;
  }

  private sign(payload: string): string {
    return createHmac("sha256", this.secret).update(payload).digest("base64url");
  }
}

function cookieValue(cookieHeader: string | null, name: string): string | undefined {
  return cookieHeader?.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${name}=`))?.slice(name.length + 1);
}

function safeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}
