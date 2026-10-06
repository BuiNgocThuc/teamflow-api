import type { Request, Response } from "express";

import { getAuthenticatedUserId } from "@/shared";

import { updateCurrentUserSchema } from "./users.schema.js";
import { getUserProfile, updateUserProfile } from "./users.service.js";

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
