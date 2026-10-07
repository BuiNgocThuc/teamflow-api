import { AppError, createPaginationMetadata } from "@/shared";

import {
    requireMembership,
    requireOrganization,
    requireOwner,
} from "./organizations.authorization.js";
import { organizationsRepository } from "./organizations.repository.js";
import type {
    CreateOrganizationInput,
    ListOrganizationsQuery,
    UpdateOrganizationInput,
} from "./organizations.schema.js";

export async function createOrganization(
    userId: string,
    input: CreateOrganizationInput,
) {
    return organizationsRepository.createWithOwner(userId, input.name);
}

export async function listOrganizations(userId: string, query: ListOrganizationsQuery) {
    const { data, total } = await organizationsRepository.listForUser(userId, query);

    return {
        data,
        pagination: createPaginationMetadata(query, total),
    };
}

export async function getOrganization(userId: string, organizationId: string) {
    const organization = await requireOrganization(organizationId);
    await requireMembership(userId, organizationId);

    return organization;
}

export async function updateOrganization(
    userId: string,
    organizationId: string,
    input: UpdateOrganizationInput,
) {
    await requireOrganization(organizationId);
    await requireOwner(userId, organizationId);

    const organization = await organizationsRepository.updateName(
        organizationId,
        input.name,
    );

    if (!organization) {
        throw new AppError("ORGANIZATION_NOT_FOUND");
    }

    return organization;
}

export async function deleteOrganization(userId: string, organizationId: string) {
    await requireOrganization(organizationId);
    await requireOwner(userId, organizationId);

    const organization = await organizationsRepository.deleteById(organizationId);

    if (!organization) {
        throw new AppError("ORGANIZATION_NOT_FOUND");
    }
}
