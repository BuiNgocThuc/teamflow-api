import type { CookieOptions, Request, Response } from "express";

import { getRefreshTokenLifetimeInDays } from "./auth.token.js";

const refreshTokenCookieName = "teamflow_refresh_token";

function getRefreshTokenCookieOptions(): CookieOptions {
    return {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/auth",
        maxAge: getRefreshTokenLifetimeInDays() * 24 * 60 * 60 * 1000,
    };
}

export function getRefreshTokenFromCookie(request: Request): string | null {
    const cookieHeader = request.header("cookie");

    if (!cookieHeader) {
        return null;
    }

    for (const cookie of cookieHeader.split(";")) {
        const [name, ...valueParts] = cookie.trim().split("=");

        if (name !== refreshTokenCookieName) {
            continue;
        }

        const value = valueParts.join("=");

        if (!value) {
            return null;
        }

        try {
            return decodeURIComponent(value);
        } catch {
            return null;
        }
    }

    return null;
}

export function setRefreshTokenCookie(response: Response, refreshToken: string): void {
    response.cookie(
        refreshTokenCookieName,
        refreshToken,
        getRefreshTokenCookieOptions(),
    );
}

export function clearRefreshTokenCookie(response: Response): void {
    const { maxAge: _maxAge, ...options } = getRefreshTokenCookieOptions();

    response.clearCookie(refreshTokenCookieName, options);
}
