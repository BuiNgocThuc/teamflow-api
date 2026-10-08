import type { RequestHandler } from "express";

import { frontendOrigin } from "@/config/frontend-origin";
import { AppError } from "@/shared";

export const validateRefreshTokenOrigin: RequestHandler = (
    request,
    _response,
    next,
) => {
    if (request.header("origin") !== frontendOrigin) {
        next(new AppError("INVALID_REFRESH_TOKEN_ORIGIN"));
        return;
    }

    next();
};
