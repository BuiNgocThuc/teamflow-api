import { and, eq, gt, isNull } from "drizzle-orm";

import { db, refreshTokens, users } from "@/database";

export const authRepository = {
    async findByEmail(email: string) {
        const [user] = await db
            .select()
            .from(users)
            .where(eq(users.email, email))
            .limit(1);

        return user ?? null;
    },

    async create(input: { name: string; email: string; passwordHash: string }) {
        const [user] = await db.insert(users).values(input).returning({
            id: users.id,
            name: users.name,
            email: users.email,
            createdAt: users.createdAt,
        });

        if (!user) {
            throw new Error("User creation did not return a user.");
        }

        return user;
    },

    async createRefreshToken(input: {
        userId: string;
        tokenHash: string;
        expiresAt: Date;
    }) {
        await db.insert(refreshTokens).values(input);
    },

    async rotateRefreshToken(input: {
        currentTokenHash: string;
        nextTokenHash: string;
        nextExpiresAt: Date;
    }) {
        return db.transaction(async (transaction) => {
            const [consumedToken] = await transaction
                .update(refreshTokens)
                .set({ revokedAt: new Date() })
                .where(
                    and(
                        eq(refreshTokens.tokenHash, input.currentTokenHash),
                        isNull(refreshTokens.revokedAt),
                        gt(refreshTokens.expiresAt, new Date()),
                    ),
                )
                .returning({ userId: refreshTokens.userId });

            if (!consumedToken) {
                return null;
            }

            const [user] = await transaction
                .select({ id: users.id, email: users.email })
                .from(users)
                .where(eq(users.id, consumedToken.userId));

            if (!user) {
                throw new Error("Refresh token references a missing user.");
            }

            await transaction.insert(refreshTokens).values({
                userId: user.id,
                tokenHash: input.nextTokenHash,
                expiresAt: input.nextExpiresAt,
            });

            return user;
        });
    },

    async revokeRefreshToken(tokenHash: string) {
        await db
            .update(refreshTokens)
            .set({ revokedAt: new Date() })
            .where(
                and(
                    eq(refreshTokens.tokenHash, tokenHash),
                    isNull(refreshTokens.revokedAt),
                ),
            );
    },
};
