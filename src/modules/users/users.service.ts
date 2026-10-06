import { AppError, isPostgresUniqueViolation } from "@/shared";

import { usersRepository } from "./users.repository.js";
import type { UpdateCurrentUserInput } from "./users.schema.js";

export async function getUserProfile(userId: string) {
    const user = await usersRepository.findPublicById(userId);

    if (!user) {
        throw new AppError("USER_NOT_FOUND");
    }

    return user;
}

export async function updateUserProfile(userId: string, input: UpdateCurrentUserInput) {
    if (input.email) {
        const existingUser = await usersRepository.findByEmail(input.email);

        if (existingUser && existingUser.id !== userId) {
            throw new AppError("EMAIL_ALREADY_EXISTS");
        }
    }

    try {
        const user = await usersRepository.updateProfile(userId, input);

        if (!user) {
            throw new AppError("USER_NOT_FOUND");
        }

        return user;
    } catch (error) {
        if (isPostgresUniqueViolation(error)) {
            throw new AppError("EMAIL_ALREADY_EXISTS");
        }

        throw error;
    }
}
