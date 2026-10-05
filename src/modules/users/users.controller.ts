import type { Request, Response } from "express";

import { AppError } from "@/shared";

export function getCurrentUser(request: Request, response: Response): Response {
    if (!request.auth) {
        throw new AppError(
            401,
            "AUTHENTICATION_REQUIRED",
            "Authentication is required.",
        );
    }

    return response.status(200).json({
        user: request.auth,
    });
}
