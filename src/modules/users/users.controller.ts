import type { Request, Response } from "express";

import { AppError } from "@/shared";

import { updateCurrentUserSchema } from "./users.schema.js";
import { getUserProfile, updateUserProfile } from "./users.service.js";

function getAuthenticatedUserId(request: Request): string {
    if (!request.auth) {
        throw new AppError(
            401,
            "AUTHENTICATION_REQUIRED",
            "Authentication is required.",
        );
    }

    return request.auth.userId;
}

export async function getCurrentUser(
    request: Request,
    response: Response,
): Promise<Response> {
    const user = await getUserProfile(getAuthenticatedUserId(request));

    return response.status(200).json({
        user,
    });
}

export async function updateCurrentUser(
    request: Request,
    response: Response,
): Promise<Response> {
    const input = updateCurrentUserSchema.parse(request.body);
    const user = await updateUserProfile(getAuthenticatedUserId(request), input);

    return response.status(200).json({
        user,
    });
}
