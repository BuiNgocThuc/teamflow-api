import { db, projects } from "@/database";
import { getPaginationOffset, PaginationQuery } from "@/shared";
import { count, desc, eq } from "drizzle-orm";

const projectFields = {
    id: projects.id,
    organizationId: projects.organizationId,
    name: projects.name,
    description: projects.description,
    createdAt: projects.createdAt,
    updatedAt: projects.updatedAt,
};

export const projectsRepository = {
    async create(input: {
        organizationId: string;
        name: string;
        description?: string;
    }) {
        const [project] = await db
            .insert(projects)
            .values({
                organizationId: input.organizationId,
                name: input.name,
                description: input.description ?? null,
            })
            .returning(projectFields);

        if (!project) {
            throw new Error("Project creation did not return a project.");
        }

        return project;
    },

    async listForOrganization(organizationId: string, pagination: PaginationQuery) {
        const [data, totalRows] = await Promise.all([
            db
                .select(projectFields)
                .from(projects)
                .where(eq(projects.organizationId, organizationId))
                .orderBy(desc(projects.createdAt), desc(projects.id))
                .limit(pagination.limit)
                .offset(getPaginationOffset(pagination)),
            db
                .select({ total: count() })
                .from(projects)
                .where(eq(projects.organizationId, organizationId)),
        ]);

        return {
            data,
            total: totalRows[0]?.total ?? 0,
        };
    },

    async findById(projectId: string) {
        const [project] = await db
            .select(projectFields)
            .from(projects)
            .where(eq(projects.id, projectId));

        return project ?? null;
    },

    async update(
        projectId: string,
        input: {
            name?: string;
            description?: string | null;
        },
    ) {
        const values: {
            name?: string;
            description?: string | null;
            updatedAt: Date;
        } = {
            updatedAt: new Date(),
        };

        if (input.name !== undefined) {
            values.name = input.name;
        }

        if (input.description !== undefined) {
            values.description = input.description;
        }

        const [project] = await db
            .update(projects)
            .set(values)
            .where(eq(projects.id, projectId))
            .returning(projectFields);

        return project ?? null;
    },

    async deleteById(projectId: string) {
        const [project] = await db
            .delete(projects)
            .where(eq(projects.id, projectId))
            .returning({ id: projects.id });

        return project ?? null;
    },
};
