import { AppError } from "@/shared";

import { organizationMembersRepository } from "./organization-members.repository.js";
import { organizationsRepository } from "./organizations.repository.js";

export async function requireOrganization(organizationId: string) {
    const organization = await organizationsRepository.findById(organizationId);

    if (!organization) {
        throw new AppError("ORGANIZATION_NOT_FOUND");
    }

    return organization;
}

export async function requireMembership(userId: string, organizationId: string) {
    const membership = await organizationMembersRepository.findByUserAndOrganization(
        userId,
        organizationId,
    );

    if (!membership) {
        throw new AppError("ORGANIZATION_ACCESS_DENIED");
    }

    return membership;
}

export async function requireOwner(userId: string, organizationId: string) {
    const membership = await requireMembership(userId, organizationId);

    if (membership.role !== "OWNER") {
        throw new AppError("ORGANIZATION_OWNER_REQUIRED");
    }

    return membership;
}

export async function requireMemberManager(userId: string, organizationId: string) {
    const membership = await requireMembership(userId, organizationId);

    if (membership.role === "MEMBER") {
        throw new AppError("ORGANIZATION_MEMBER_MANAGEMENT_DENIED");
    }

    return membership;
}
