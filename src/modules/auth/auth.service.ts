import argon2 from "argon2";

import { AppError } from "@/shared";
import { authRepository } from "./auth.repository.js";
import type { LoginInput, RefreshTokenInput, RegisterInput } from "./auth.schema.js";
import {
    createAccessToken,
    createRefreshToken,
    hashRefreshToken,
} from "./auth.token.js";

function isUniqueViolation(error: unknown): boolean {
    return (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === "23505"
    );
}

export async function registerUser(input: RegisterInput) {
    const existingUser = await authRepository.findByEmail(input.email);

    if (existingUser) {
        throw new AppError(409, "EMAIL_ALREADY_EXISTS", "Email is already registered.");
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
        if (isUniqueViolation(error)) {
            throw new AppError(
                409,
                "EMAIL_ALREADY_EXISTS",
                "Email is already registered.",
            );
        }

        throw error;
    }
}

export async function loginUser(input: LoginInput) {
    const user = await authRepository.findByEmail(input.email);

    if (!user || !(await argon2.verify(user.passwordHash, input.password))) {
        throw new AppError(
            401,
            "INVALID_CREDENTIALS",
            "Email or password is incorrect.",
        );
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
        throw new AppError(
            401,
            "INVALID_REFRESH_TOKEN",
            "Refresh token is invalid or expired.",
        );
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
