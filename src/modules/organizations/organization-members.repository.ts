import { and, asc, eq } from "drizzle-orm";

import { db, organizationMembers, users } from "@/database";

const organizationMemberDetailFields = {
    userId: users.id,
    name: users.name,
    email: users.email,
    role: organizationMembers.role,
    joinedAt: organizationMembers.createdAt,
};

export const organizationMembersRepository = {
    async findByUserAndOrganization(userId: string, organizationId: string) {
        const [membership] = await db
            .select({
                userId: organizationMembers.userId,
                role: organizationMembers.role,
                joinedAt: organizationMembers.createdAt,
            })
            .from(organizationMembers)
            .where(
                and(
                    eq(organizationMembers.userId, userId),
                    eq(organizationMembers.organizationId, organizationId),
                ),
            );

        return membership ?? null;
    },

    async findDetailByUserAndOrganization(userId: string, organizationId: string) {
        const [member] = await db
            .select(organizationMemberDetailFields)
            .from(organizationMembers)
            .innerJoin(users, eq(organizationMembers.userId, users.id))
            .where(
                and(
                    eq(organizationMembers.userId, userId),
                    eq(organizationMembers.organizationId, organizationId),
                ),
            );

        return member ?? null;
    },

    async listForOrganization(organizationId: string) {
        return db
            .select(organizationMemberDetailFields)
            .from(organizationMembers)
            .innerJoin(users, eq(organizationMembers.userId, users.id))
            .where(eq(organizationMembers.organizationId, organizationId))
            .orderBy(asc(organizationMembers.createdAt), asc(users.id));
    },

    async create(input: { organizationId: string; userId: string }) {
        await db.insert(organizationMembers).values({
            ...input,
            role: "MEMBER",
        });

        return this.findDetailByUserAndOrganization(input.userId, input.organizationId);
    },

    async updateRole(input: {
        organizationId: string;
        userId: string;
        role: "ADMIN" | "MEMBER";
    }) {
        await db
            .update(organizationMembers)
            .set({ role: input.role })
            .where(
                and(
                    eq(organizationMembers.organizationId, input.organizationId),
                    eq(organizationMembers.userId, input.userId),
                ),
            );

        return this.findDetailByUserAndOrganization(input.userId, input.organizationId);
    },

    async delete(input: { organizationId: string; userId: string }) {
        const [membership] = await db
            .delete(organizationMembers)
            .where(
                and(
                    eq(organizationMembers.organizationId, input.organizationId),
                    eq(organizationMembers.userId, input.userId),
                ),
            )
            .returning({ userId: organizationMembers.userId });

        return membership ?? null;
    },
};
