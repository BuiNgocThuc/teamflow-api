import { z } from "zod";

const organizationNameSchema = z.string().trim().min(1).max(100);

export const createOrganizationSchema = z.object({
    name: organizationNameSchema,
});

export type CreateOrganizationInput = z.infer<typeof createOrganizationSchema>;

export const updateOrganizationSchema = z.object({
    name: organizationNameSchema,
});

export type UpdateOrganizationInput = z.infer<typeof updateOrganizationSchema>;

export const organizationParamsSchema = z.object({
    id: z.uuid(),
});
