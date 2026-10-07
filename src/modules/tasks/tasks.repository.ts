import { and, count, desc, eq, exists } from "drizzle-orm";

import { db, organizationMembers, tasks } from "@/database";
import { getPaginationOffset, type PaginationQuery } from "@/shared";

const taskFields = {
    id: tasks.id,
    projectId: tasks.projectId,
    creatorId: tasks.creatorId,
    assigneeId: tasks.assigneeId,
    title: tasks.title,
    description: tasks.description,
    status: tasks.status,
    priority: tasks.priority,
    dueDate: tasks.dueDate,
    createdAt: tasks.createdAt,
    updatedAt: tasks.updatedAt,
};

export const tasksRepository = {
    async create(input: {
        projectId: string;
        creatorId: string;
        title: string;
        description?: string;
        priority?: "LOW" | "MEDIUM" | "HIGH";
        dueDate?: string;
    }) {
        const [task] = await db
            .insert(tasks)
            .values({
                projectId: input.projectId,
                creatorId: input.creatorId,
                title: input.title,
                description: input.description ?? null,
                priority: input.priority ?? "MEDIUM",
                dueDate: input.dueDate ? new Date(input.dueDate) : null,
            })
            .returning(taskFields);

        if (!task) {
            throw new Error("Task creation did not return a task.");
        }

        return task;
    },

    async listForProject(projectId: string, pagination: PaginationQuery) {
        const [data, totalRows] = await Promise.all([
            db
                .select(taskFields)
                .from(tasks)
                .where(eq(tasks.projectId, projectId))
                .orderBy(desc(tasks.createdAt), desc(tasks.id))
                .limit(pagination.limit)
                .offset(getPaginationOffset(pagination)),
            db
                .select({ total: count() })
                .from(tasks)
                .where(eq(tasks.projectId, projectId)),
        ]);

        return {
            data,
            total: totalRows[0]?.total ?? 0,
        };
    },

    async findById(taskId: string) {
        const [task] = await db
            .select(taskFields)
            .from(tasks)
            .where(eq(tasks.id, taskId));

        return task ?? null;
    },

    async update(
        taskId: string,
        input: {
            title?: string;
            description?: string | null;
            priority?: "LOW" | "MEDIUM" | "HIGH";
            dueDate?: string | null;
        },
    ) {
        const values: {
            title?: string;
            description?: string | null;
            priority?: "LOW" | "MEDIUM" | "HIGH";
            dueDate?: Date | null;
            updatedAt: Date;
        } = {
            updatedAt: new Date(),
        };

        if (input.title !== undefined) {
            values.title = input.title;
        }

        if (input.description !== undefined) {
            values.description = input.description;
        }

        if (input.priority !== undefined) {
            values.priority = input.priority;
        }

        if (input.dueDate !== undefined) {
            values.dueDate = input.dueDate ? new Date(input.dueDate) : null;
        }

        const [task] = await db
            .update(tasks)
            .set(values)
            .where(eq(tasks.id, taskId))
            .returning(taskFields);

        return task ?? null;
    },

    async assignAssignee(input: {
        taskId: string;
        organizationId: string;
        assigneeId: string;
    }) {
        const [task] = await db
            .update(tasks)
            .set({
                assigneeId: input.assigneeId,
                updatedAt: new Date(),
            })
            .where(
                and(
                    eq(tasks.id, input.taskId),
                    exists(
                        db
                            .select({ userId: organizationMembers.userId })
                            .from(organizationMembers)
                            .where(
                                and(
                                    eq(
                                        organizationMembers.organizationId,
                                        input.organizationId,
                                    ),
                                    eq(organizationMembers.userId, input.assigneeId),
                                ),
                            ),
                    ),
                ),
            )
            .returning(taskFields);

        return task ?? null;
    },

    async deleteById(taskId: string) {
        const [task] = await db
            .delete(tasks)
            .where(eq(tasks.id, taskId))
            .returning({ id: tasks.id });

        return task ?? null;
    },
};
