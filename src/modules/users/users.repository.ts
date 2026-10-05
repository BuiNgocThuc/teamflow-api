import { eq } from "drizzle-orm";

import { db, users } from "@/database";

const publicUserFields = {
    id: users.id,
    name: users.name,
    email: users.email,
    createdAt: users.createdAt,
    updatedAt: users.updatedAt,
};

export const usersRepository = {
    async findPublicById(userId: string) {
        const [user] = await db
            .select(publicUserFields)
            .from(users)
            .where(eq(users.id, userId));

        return user ?? null;
    },

    async findByEmail(email: string) {
        const [user] = await db
            .select(publicUserFields)
            .from(users)
            .where(eq(users.email, email));

        return user ?? null;
    },

    async updateProfile(userId: string, input: { name?: string; email?: string }) {
        const [user] = await db
            .update(users)
            .set({
                ...input,
                updatedAt: new Date(),
            })
            .where(eq(users.id, userId))
            .returning(publicUserFields);

        return user ?? null;
    },
};
