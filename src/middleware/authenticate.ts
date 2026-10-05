import type { RequestHandler } from "express";

import { verifyAccessToken } from "@/modules/auth";
import { AppError } from "@/shared";

export const authenticate: RequestHandler = async (request, _response, next) => {
    const authorization = request.header("authorization");

    if (!authorization?.startsWith("Bearer ")) {
        next(
            new AppError(
                401,
                "AUTHENTICATION_REQUIRED",
                "A bearer access token is required.",
            ),
        );
        return;
    }

    const token = authorization.slice("Bearer ".length).trim();

    if (!token) {
        next(
            new AppError(
                401,
                "AUTHENTICATION_REQUIRED",
                "A bearer access token is required.",
            ),
        );
        return;
    }

    try {
        request.auth = await verifyAccessToken(token);
        next();
    } catch {
        next(
            new AppError(
                401,
                "INVALID_ACCESS_TOKEN",
                "Access token is invalid or expired.",
            ),
        );
    }
};
