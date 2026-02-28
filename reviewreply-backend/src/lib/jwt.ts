import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET!;

export interface ExtensionTokenPayload {
  userId: string;
  email: string;
  iat?: number;
  exp?: number;
}

/**
 * Sign a JWT for the Chrome Extension.
 * Expires in 30 days.
 */
export function signExtensionToken(payload: {
  userId: string;
  email: string;
}): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "30d" });
}

/**
 * Verify and decode a JWT from the Chrome Extension.
 * Returns the payload or null if invalid/expired.
 */
export function verifyExtensionToken(
  token: string
): ExtensionTokenPayload | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as ExtensionTokenPayload;
    return decoded;
  } catch {
    return null;
  }
}
