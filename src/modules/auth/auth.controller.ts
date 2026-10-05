import type { Request, Response } from "express";

import { loginSchema, refreshTokenSchema, registerSchema } from "./auth.schema.js";
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

    return response.status(200).json(authentication);
}

export async function refresh(request: Request, response: Response): Promise<Response> {
    const input = refreshTokenSchema.parse(request.body);
    const authentication = await refreshAuthentication(input);

    return response.status(200).json(authentication);
}

export async function logout(request: Request, response: Response): Promise<void> {
    const input = refreshTokenSchema.parse(request.body);

    await logoutUser(input);
    response.status(204).end();
}
