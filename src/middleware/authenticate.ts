import type { RequestHandler } from "express";

import { verifyAccessToken } from "@/modules/auth";
import { AppError } from "@/shared";

export const authenticate: RequestHandler = async (request, _response, next) => {
    const authorization = request.header("authorization");

    if (!authorization?.startsWith("Bearer ")) {
        next(new AppError("AUTHENTICATION_REQUIRED"));
        return;
    }

    const token = authorization.slice("Bearer ".length).trim();

    if (!token) {
        next(new AppError("AUTHENTICATION_REQUIRED"));
        return;
    }

    try {
        request.auth = await verifyAccessToken(token);
        next();
    } catch {
        next(new AppError("INVALID_ACCESS_TOKEN"));
    }
};
