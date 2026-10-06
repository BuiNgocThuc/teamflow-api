import { and, eq } from "drizzle-orm";

import { db, organizationMembers, organizations } from "@/database";

const organizationFields = {
    id: organizations.id,
    name: organizations.name,
    createdAt: organizations.createdAt,
    updatedAt: organizations.updatedAt,
};

export const organizationsRepository = {
    async createWithOwner(userId: string, name: string) {
        return db.transaction(async (transaction) => {
            const [organization] = await transaction
                .insert(organizations)
                .values({ name })
                .returning(organizationFields);

            if (!organization) {
                throw new Error(
                    "Organization creation did not return an organization.",
                );
            }

            await transaction.insert(organizationMembers).values({
                organizationId: organization.id,
                userId,
                role: "OWNER",
            });

            return organization;
        });
    },

    async listForUser(userId: string) {
        return db
            .select({
                ...organizationFields,
                role: organizationMembers.role,
            })
            .from(organizationMembers)
            .innerJoin(
                organizations,
                eq(organizationMembers.organizationId, organizations.id),
            )
            .where(eq(organizationMembers.userId, userId));
    },

    async findById(organizationId: string) {
        const [organization] = await db
            .select(organizationFields)
            .from(organizations)
            .where(eq(organizations.id, organizationId));

        return organization ?? null;
    },

    async findMembership(userId: string, organizationId: string) {
        const [membership] = await db
            .select({ role: organizationMembers.role })
            .from(organizationMembers)
            .where(
                and(
                    eq(organizationMembers.userId, userId),
                    eq(organizationMembers.organizationId, organizationId),
                ),
            );

        return membership ?? null;
    },

    async updateName(organizationId: string, name: string) {
        const [organization] = await db
            .update(organizations)
            .set({
                name,
                updatedAt: new Date(),
            })
            .where(eq(organizations.id, organizationId))
            .returning(organizationFields);

        return organization ?? null;
    },

    async deleteById(organizationId: string) {
        const [organization] = await db
            .delete(organizations)
            .where(eq(organizations.id, organizationId))
            .returning({ id: organizations.id });

        return organization ?? null;
    },
};
