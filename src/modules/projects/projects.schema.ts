import { z } from "zod";
import { paginationSchema } from "@/shared";

const projectNameSchema = z.string().trim().min(1).max(100);
const projectDescriptionSchema = z.string().trim().max(2_000);

export const createProjectSchema = z.object({
    name: projectNameSchema,
    description: projectDescriptionSchema.optional(),
});

export type CreateProjectInput = z.infer<typeof createProjectSchema>;

export const updateProjectSchema = z
    .object({
        name: projectNameSchema.optional(),
        description: projectDescriptionSchema.nullable().optional(),
    })
    .refine((input) => input.name !== undefined || input.description !== undefined, {
        message: "At least one project field must be provided.",
    });

export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;

export const organizationProjectsParamsSchema = z.object({
    organizationId: z.uuid(),
});

export const projectParamsSchema = z.object({
    id: z.uuid(),
});

export const listProjectsQuerySchema = paginationSchema.extend({});

export type ListProjectsQuery = z.infer<typeof listProjectsQuerySchema>;
