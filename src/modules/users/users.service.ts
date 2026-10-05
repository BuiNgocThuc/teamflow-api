import { AppError } from "@/shared";

import { usersRepository } from "./users.repository.js";
import type { UpdateCurrentUserInput } from "./users.schema.js";

function isUniqueViolation(error: unknown): boolean {
    return (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === "23505"
    );
}

export async function getUserProfile(userId: string) {
    const user = await usersRepository.findPublicById(userId);

    if (!user) {
        throw new AppError(404, "USER_NOT_FOUND", "User was not found.");
    }

    return user;
}

export async function updateUserProfile(userId: string, input: UpdateCurrentUserInput) {
    if (input.email) {
        const existingUser = await usersRepository.findByEmail(input.email);

        if (existingUser && existingUser.id !== userId) {
            throw new AppError(
                409,
                "EMAIL_ALREADY_EXISTS",
                "Email is already registered.",
            );
        }
    }

    try {
        const user = await usersRepository.updateProfile(userId, input);

        if (!user) {
            throw new AppError(404, "USER_NOT_FOUND", "User was not found.");
        }

        return user;
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
