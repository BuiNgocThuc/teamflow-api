import type { Request, Response } from "express";

import { AppError } from "@/shared";

import { loginSchema, registerSchema } from "./auth.schema.js";
import {
    clearRefreshTokenCookie,
    getRefreshTokenFromCookie,
    setRefreshTokenCookie,
} from "./refresh-token-cookie.js";
import {
    loginUser,
    logoutUser,
    refreshAuthentication,
    registerUser,
} from "./auth.service.js";

export async function register(
    request: Request,
    response: Response,
): Promise<Response> {
    const input = registerSchema.parse(request.body);
    const user = await registerUser(input);

    return response.status(201).json({
        user,
    });
}

export async function login(request: Request, response: Response): Promise<Response> {
    const input = loginSchema.parse(request.body);
    const authentication = await loginUser(input);

    setRefreshTokenCookie(response, authentication.refreshToken);

    return response.status(200).json({ accessToken: authentication.accessToken });
}

export async function refresh(request: Request, response: Response): Promise<Response> {
    const refreshToken = getRefreshTokenFromCookie(request);

    if (!refreshToken) {
        throw new AppError("INVALID_REFRESH_TOKEN");
    }

    const authentication = await refreshAuthentication(refreshToken);
    setRefreshTokenCookie(response, authentication.refreshToken);

    return response.status(200).json({ accessToken: authentication.accessToken });
}

export async function logout(request: Request, response: Response): Promise<void> {
    const refreshToken = getRefreshTokenFromCookie(request);

    if (refreshToken) {
        await logoutUser(refreshToken);
    }

    clearRefreshTokenCookie(response);
    response.status(204).end();
}
