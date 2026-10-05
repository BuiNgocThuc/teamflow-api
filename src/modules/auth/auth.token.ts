import { createHash, randomBytes } from "node:crypto";
import { SignJWT, jwtVerify } from "jose";

export type AuthenticatedUser = {
    userId: string;
    email: string;
};

function getAccessTokenSecret(): Uint8Array {
    const secret = process.env.JWT_ACCESS_SECRET;

    if (!secret || secret.length < 32) {
        throw new Error("JWT_ACCESS_SECRET must be at least 32 characters long.");
    }

    return new TextEncoder().encode(secret);
}

function getRefreshTokenLifetimeInDays(): number {
    const value = Number(process.env.REFRESH_TOKEN_TTL_DAYS ?? "7");

    if (!Number.isInteger(value) || value < 1 || value > 365) {
        throw new Error("REFRESH_TOKEN_TTL_DAYS must be an integer between 1 and 365.");
    }

    return value;
}

export async function createAccessToken(user: AuthenticatedUser): Promise<string> {
    return new SignJWT({ email: user.email })
        .setProtectedHeader({ alg: "HS256", typ: "JWT" })
        .setSubject(user.userId)
        .setIssuedAt()
        .setExpirationTime(process.env.ACCESS_TOKEN_TTL ?? "15m")
        .sign(getAccessTokenSecret());
}

export async function verifyAccessToken(token: string): Promise<AuthenticatedUser> {
    const { payload } = await jwtVerify(token, getAccessTokenSecret(), {
        algorithms: ["HS256"],
    });

    if (typeof payload.sub !== "string" || typeof payload.email !== "string") {
        throw new Error("Access token payload is invalid.");
    }

    return {
        userId: payload.sub,
        email: payload.email,
    };
}

export function createRefreshToken(): {
    token: string;
    tokenHash: string;
    expiresAt: Date;
} {
    const token = randomBytes(48).toString("base64url");
    const tokenHash = hashRefreshToken(token);
    const expiresAt = new Date(
        Date.now() + getRefreshTokenLifetimeInDays() * 24 * 60 * 60 * 1000,
    );

    return {
        token,
        tokenHash,
        expiresAt,
    };
}

export function hashRefreshToken(token: string): string {
    return createHash("sha256").update(token).digest("hex");
}
