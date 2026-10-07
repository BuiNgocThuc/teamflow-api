import type { Request, Response } from "express";

import { getAuthenticatedUserId } from "@/shared";

import {
    addOrganizationMemberSchema,
    organizationMemberParamsSchema,
    updateOrganizationMemberRoleSchema,
} from "./organization-members.schema.js";
import {
    addOrganizationMember,
    listOrganizationMembers,
    removeOrganizationMember,
    updateOrganizationMemberRole,
} from "./organization-members.service.js";
import { organizationParamsSchema } from "./organizations.schema.js";

export async function addMember(
    request: Request,
    response: Response,
): Promise<Response> {
    const { id } = organizationParamsSchema.parse(request.params);
    const input = addOrganizationMemberSchema.parse(request.body);
    const member = await addOrganizationMember(
        getAuthenticatedUserId(request),
        id,
        input,
    );

    return response.status(201).json({ member });
}

export async function listMembers(
    request: Request,
    response: Response,
): Promise<Response> {
    const { id } = organizationParamsSchema.parse(request.params);
    const members = await listOrganizationMembers(getAuthenticatedUserId(request), id);

    return response.status(200).json({ members });
}

export async function updateMemberRole(
    request: Request,
    response: Response,
): Promise<Response> {
    const { id, userId } = organizationMemberParamsSchema.parse(request.params);
    const input = updateOrganizationMemberRoleSchema.parse(request.body);
    const member = await updateOrganizationMemberRole(
        getAuthenticatedUserId(request),
        id,
        userId,
        input,
    );

    return response.status(200).json({ member });
}

export async function removeMember(
    request: Request,
    response: Response,
): Promise<void> {
    const { id, userId } = organizationMemberParamsSchema.parse(request.params);

    await removeOrganizationMember(getAuthenticatedUserId(request), id, userId);
    response.status(204).end();
}
