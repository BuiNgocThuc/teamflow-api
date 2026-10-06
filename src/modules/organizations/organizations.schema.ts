import { z } from "zod";

import { paginationSchema } from "@/shared";

const organizationNameSchema = z.string().trim().min(1).max(100);

export const createOrganizationSchema = z.object({
    name: organizationNameSchema,
});

export type CreateOrganizationInput = z.infer<typeof createOrganizationSchema>;

export const updateOrganizationSchema = z.object({
    name: organizationNameSchema,
});

export type UpdateOrganizationInput = z.infer<typeof updateOrganizationSchema>;

export const listOrganizationsQuerySchema = paginationSchema.extend({});

export type ListOrganizationsQuery = z.infer<typeof listOrganizationsQuerySchema>;

export const organizationParamsSchema = z.object({
    id: z.uuid(),
});
