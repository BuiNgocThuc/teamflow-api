import type { Request } from "express";

import { AppError } from "@/shared/errors";

export function getAuthenticatedUserId(request: Request): string {
    if (!request.auth) {
        throw new AppError("AUTHENTICATION_REQUIRED");
    }

    return request.auth.userId;
}
