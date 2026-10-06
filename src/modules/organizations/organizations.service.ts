import { AppError, createPaginationMetadata } from "@/shared";

import { organizationsRepository } from "./organizations.repository.js";
import type {
    CreateOrganizationInput,
    ListOrganizationsQuery,
    UpdateOrganizationInput,
} from "./organizations.schema.js";

async function requireMembership(userId: string, organizationId: string) {
    const membership = await organizationsRepository.findMembership(
        userId,
        organizationId,
    );

    if (!membership) {
        throw new AppError("ORGANIZATION_ACCESS_DENIED");
    }

    return membership;
}

async function requireOrganization(organizationId: string) {
    const organization = await organizationsRepository.findById(organizationId);

    if (!organization) {
        throw new AppError("ORGANIZATION_NOT_FOUND");
    }

    return organization;
}

async function requireOwner(userId: string, organizationId: string) {
    const membership = await requireMembership(userId, organizationId);

    if (membership.role !== "OWNER") {
        throw new AppError("ORGANIZATION_OWNER_REQUIRED");
    }
}

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
