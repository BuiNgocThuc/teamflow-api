import { z } from "zod";

export const addOrganizationMemberSchema = z.object({
    userId: z.uuid(),
});

export type AddOrganizationMemberInput = z.infer<typeof addOrganizationMemberSchema>;

export const updateOrganizationMemberRoleSchema = z.object({
    role: z.enum(["ADMIN", "MEMBER"]),
});

export type UpdateOrganizationMemberRoleInput = z.infer<
    typeof updateOrganizationMemberRoleSchema
>;

export const organizationMemberParamsSchema = z.object({
    id: z.uuid(),
    userId: z.uuid(),
});
