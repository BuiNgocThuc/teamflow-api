import argon2 from "argon2";

import { AppError, isPostgresUniqueViolation } from "@/shared";
import { authRepository } from "./auth.repository.js";
import type { LoginInput, RefreshTokenInput, RegisterInput } from "./auth.schema.js";
import {
    createAccessToken,
    createRefreshToken,
    hashRefreshToken,
} from "./auth.token.js";

export async function registerUser(input: RegisterInput) {
    const existingUser = await authRepository.findByEmail(input.email);

    if (existingUser) {
        throw new AppError("EMAIL_ALREADY_EXISTS");
    }

    const passwordHash = await argon2.hash(input.password, {
        type: argon2.argon2id,
    });

    try {
        return await authRepository.create({
            name: input.name,
            email: input.email,
            passwordHash,
        });
    } catch (error) {
        if (isPostgresUniqueViolation(error)) {
            throw new AppError("EMAIL_ALREADY_EXISTS");
        }

        throw error;
    }
}

export async function loginUser(input: LoginInput) {
    const user = await authRepository.findByEmail(input.email);

    if (!user || !(await argon2.verify(user.passwordHash, input.password))) {
        throw new AppError("INVALID_CREDENTIALS");
    }

    const refreshToken = createRefreshToken();

    await authRepository.createRefreshToken({
        userId: user.id,
        tokenHash: refreshToken.tokenHash,
        expiresAt: refreshToken.expiresAt,
    });

    return {
        accessToken: await createAccessToken({
            userId: user.id,
            email: user.email,
        }),
        refreshToken: refreshToken.token,
    };
}

export async function refreshAuthentication(input: RefreshTokenInput) {
    const nextRefreshToken = createRefreshToken();
    const user = await authRepository.rotateRefreshToken({
        currentTokenHash: hashRefreshToken(input.refreshToken),
        nextTokenHash: nextRefreshToken.tokenHash,
        nextExpiresAt: nextRefreshToken.expiresAt,
    });

    if (!user) {
        throw new AppError("INVALID_REFRESH_TOKEN");
    }

    return {
        accessToken: await createAccessToken({
            userId: user.id,
            email: user.email,
        }),
        refreshToken: nextRefreshToken.token,
    };
}

export async function logoutUser(input: RefreshTokenInput) {
    await authRepository.revokeRefreshToken(hashRefreshToken(input.refreshToken));
}
