import { z } from "zod";

import { paginationSchema } from "@/shared";

const taskTitleSchema = z.string().trim().min(1).max(200);
const taskDescriptionSchema = z.string().trim().max(5_000);
export const taskStatusSchema = z.enum(["TODO", "IN_PROGRESS", "DONE"]);
export type TaskStatus = z.infer<typeof taskStatusSchema>;
const taskPrioritySchema = z.enum(["LOW", "MEDIUM", "HIGH"]);
const dueDateSchema = z.iso.datetime({ offset: true });

export const createTaskSchema = z.object({
    title: taskTitleSchema,
    description: taskDescriptionSchema.optional(),
    priority: taskPrioritySchema.optional(),
    dueDate: dueDateSchema.optional(),
});

export type CreateTaskInput = z.infer<typeof createTaskSchema>;

export const updateTaskSchema = z
    .object({
        title: taskTitleSchema.optional(),
        description: taskDescriptionSchema.nullable().optional(),
        priority: taskPrioritySchema.optional(),
        dueDate: dueDateSchema.nullable().optional(),
    })
    .refine(
        (input) =>
            input.title !== undefined ||
            input.description !== undefined ||
            input.priority !== undefined ||
            input.dueDate !== undefined,
        { message: "At least one task field must be provided." },
    );

export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;

export const assignTaskSchema = z.object({
    assigneeId: z.uuid(),
});

export type AssignTaskInput = z.infer<typeof assignTaskSchema>;

export const updateTaskStatusSchema = z.object({
    status: taskStatusSchema,
});

export type UpdateTaskStatusInput = z.infer<typeof updateTaskStatusSchema>;

export const projectTasksParamsSchema = z.object({
    projectId: z.uuid(),
});

export const taskParamsSchema = z.object({
    id: z.uuid(),
});

export const listTasksQuerySchema = paginationSchema.extend({});

export type ListTasksQuery = z.infer<typeof listTasksQuerySchema>;
