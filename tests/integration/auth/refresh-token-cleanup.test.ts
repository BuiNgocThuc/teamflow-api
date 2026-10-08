import { randomUUID } from "node:crypto";

import { and, eq } from "drizzle-orm";
import { afterEach, describe, expect, it } from "vitest";

import { authRepository } from "@/modules/auth";
import { db, refreshTokens, users } from "@/database";

describe("Refresh-token cleanup", () => {
    afterEach(async () => {
        await db.delete(users);
    });

    it("deletes expired tokens while preserving active tokens", async () => {
        const userId = randomUUID();
        const expiredTokenHash = "a".repeat(64);
        const activeTokenHash = "b".repeat(64);

        await db.insert(users).values({
            id: userId,
            name: "Cleanup User",
            email: `cleanup-${userId}@example.com`,
            passwordHash: "not-used-by-this-test",
        });
        await db.insert(refreshTokens).values([
            {
                userId,
                tokenHash: expiredTokenHash,
                expiresAt: new Date(Date.now() - 60_000),
            },
            {
                userId,
                tokenHash: activeTokenHash,
                expiresAt: new Date(Date.now() + 60_000),
            },
        ]);

        await authRepository.deleteExpiredRefreshTokens(new Date());

        const [expiredToken, activeToken] = await Promise.all([
            db
                .select({ id: refreshTokens.id })
                .from(refreshTokens)
                .where(eq(refreshTokens.tokenHash, expiredTokenHash)),
            db
                .select({ id: refreshTokens.id })
                .from(refreshTokens)
                .where(
                    and(
                        eq(refreshTokens.tokenHash, activeTokenHash),
                        eq(refreshTokens.userId, userId),
                    ),
                ),
        ]);

        expect(expiredToken).toEqual([]);
        expect(activeToken).toHaveLength(1);
    });
});
