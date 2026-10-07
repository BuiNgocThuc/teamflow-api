import { usersRepository } from "@/modules/users";
import { AppError, isPostgresUniqueViolation } from "@/shared";

import {
    requireMemberManager,
    requireMembership,
    requireOrganization,
    requireOwner,
} from "./organizations.authorization.js";
import { organizationMembersRepository } from "./organization-members.repository.js";
import type {
    AddOrganizationMemberInput,
    UpdateOrganizationMemberRoleInput,
} from "./organization-members.schema.js";

function toOrganizationMemberResponse(member: {
    userId: string;
    name: string;
    email: string;
    role: "OWNER" | "ADMIN" | "MEMBER";
    joinedAt: Date;
}) {
    return {
        user: {
            id: member.userId,
            name: member.name,
            email: member.email,
        },
        role: member.role,
        joinedAt: member.joinedAt,
    };
}

export async function addOrganizationMember(
    actorUserId: string,
    organizationId: string,
    input: AddOrganizationMemberInput,
) {
    await requireOrganization(organizationId);
    await requireMemberManager(actorUserId, organizationId);

    const user = await usersRepository.findPublicById(input.userId);

    if (!user) {
        throw new AppError("USER_NOT_FOUND");
    }

    const existingMembership =
        await organizationMembersRepository.findByUserAndOrganization(
            input.userId,
            organizationId,
        );

    if (existingMembership) {
        throw new AppError("ORGANIZATION_MEMBER_ALREADY_EXISTS");
    }

    try {
        const member = await organizationMembersRepository.create({
            organizationId,
            userId: input.userId,
        });

        if (!member) {
            throw new Error("Organization member creation did not return a member.");
        }

        return toOrganizationMemberResponse(member);
    } catch (error) {
        if (isPostgresUniqueViolation(error)) {
            throw new AppError("ORGANIZATION_MEMBER_ALREADY_EXISTS");
        }

        throw error;
    }
}

export async function listOrganizationMembers(
    actorUserId: string,
    organizationId: string,
) {
    await requireOrganization(organizationId);
    await requireMembership(actorUserId, organizationId);

    const members =
        await organizationMembersRepository.listForOrganization(organizationId);

    return members.map(toOrganizationMemberResponse);
}

export async function updateOrganizationMemberRole(
    actorUserId: string,
    organizationId: string,
    targetUserId: string,
    input: UpdateOrganizationMemberRoleInput,
) {
    await requireOrganization(organizationId);
    await requireOwner(actorUserId, organizationId);

    const targetMembership =
        await organizationMembersRepository.findByUserAndOrganization(
            targetUserId,
            organizationId,
        );

    if (!targetMembership) {
        throw new AppError("ORGANIZATION_MEMBER_NOT_FOUND");
    }

    if (targetMembership.role === "OWNER") {
        throw new AppError("ORGANIZATION_OWNER_CANNOT_BE_MANAGED");
    }

    if (targetMembership.role === input.role) {
        throw new AppError("INVALID_ORGANIZATION_ROLE_TRANSITION");
    }

    const member = await organizationMembersRepository.updateRole({
        organizationId,
        userId: targetUserId,
        role: input.role,
    });

    if (!member) {
        throw new AppError("ORGANIZATION_MEMBER_NOT_FOUND");
    }

    return toOrganizationMemberResponse(member);
}

export async function removeOrganizationMember(
    actorUserId: string,
    organizationId: string,
    targetUserId: string,
) {
    await requireOrganization(organizationId);
    const actorMembership = await requireMemberManager(actorUserId, organizationId);
    const targetMembership =
        await organizationMembersRepository.findByUserAndOrganization(
            targetUserId,
            organizationId,
        );

    if (!targetMembership) {
        throw new AppError("ORGANIZATION_MEMBER_NOT_FOUND");
    }

    if (targetMembership.role === "OWNER") {
        throw new AppError("ORGANIZATION_OWNER_CANNOT_BE_MANAGED");
    }

    if (actorMembership.role === "ADMIN" && targetMembership.role !== "MEMBER") {
        throw new AppError("ORGANIZATION_MEMBER_MANAGEMENT_DENIED");
    }

    const member = await organizationMembersRepository.delete({
        organizationId,
        userId: targetUserId,
    });

    if (!member) {
        throw new AppError("ORGANIZATION_MEMBER_NOT_FOUND");
    }
}
