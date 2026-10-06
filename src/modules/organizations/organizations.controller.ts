import type { Request, Response } from "express";

import { getAuthenticatedUserId } from "@/shared";

import {
    createOrganizationSchema,
    organizationParamsSchema,
    updateOrganizationSchema,
} from "./organizations.schema.js";
import {
    createOrganization,
    deleteOrganization,
    getOrganization,
    listOrganizations,
    updateOrganization,
} from "./organizations.service.js";

export async function create(request: Request, response: Response): Promise<Response> {
    const input = createOrganizationSchema.parse(request.body);
    const organization = await createOrganization(
        getAuthenticatedUserId(request),
        input,
    );

    return response.status(201).json({ organization });
}

export async function list(request: Request, response: Response): Promise<Response> {
    const organizations = await listOrganizations(getAuthenticatedUserId(request));

    return response.status(200).json({ organizations });
}

export async function getById(request: Request, response: Response): Promise<Response> {
    const { id } = organizationParamsSchema.parse(request.params);
    const organization = await getOrganization(getAuthenticatedUserId(request), id);

    return response.status(200).json({ organization });
}

export async function update(request: Request, response: Response): Promise<Response> {
    const input = updateOrganizationSchema.parse(request.body);
    const { id } = organizationParamsSchema.parse(request.params);
    const organization = await updateOrganization(
        getAuthenticatedUserId(request),
        id,
        input,
    );

    return response.status(200).json({ organization });
}

export async function remove(request: Request, response: Response): Promise<void> {
    const { id } = organizationParamsSchema.parse(request.params);

    await deleteOrganization(getAuthenticatedUserId(request), id);
    response.status(204).end();
}
