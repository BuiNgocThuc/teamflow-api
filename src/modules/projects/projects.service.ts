import {
    CreateProjectInput,
    ListProjectsQuery,
    UpdateProjectInput,
} from "@/modules/projects/projects.schema";
import { requireMembership, requireOrganization } from "@/modules/organizations";
import { requireProjectManager } from "@/modules/organizations/organizations.authorization";
import { projectsRepository } from "@/modules/projects/projects.repository";
import { AppError, createPaginationMetadata } from "@/shared";

export async function createProject(
    userId: string,
    organizationId: string,
    input: CreateProjectInput,
) {
    await requireOrganization(organizationId);
    await requireProjectManager(userId, organizationId);

    return projectsRepository.create({
        organizationId,
        ...input,
    });
}

export async function listProjects(
    userId: string,
    organizationId: string,
    query: ListProjectsQuery,
) {
    await requireOrganization(organizationId);
    await requireMembership(userId, organizationId);

    const { data, total } = await projectsRepository.listForOrganization(
        organizationId,
        query,
    );

    return {
        data,
        pagination: createPaginationMetadata(query, total),
    };
}

export async function getProject(userId: string, projectId: string) {
    const project = await projectsRepository.findById(projectId);

    if (!project) {
        throw new AppError("PROJECT_NOT_FOUND");
    }

    await requireMembership(userId, project.organizationId);

    return project;
}

export async function updateProject(
    userId: string,
    projectId: string,
    input: UpdateProjectInput,
) {
    const project = await projectsRepository.findById(projectId);

    if (!project) {
        throw new AppError("PROJECT_NOT_FOUND");
    }

    await requireProjectManager(userId, project.organizationId);

    const updatedProject = await projectsRepository.update(projectId, input);

    if (!updatedProject) {
        throw new AppError("PROJECT_NOT_FOUND");
    }

    return updatedProject;
}

export async function deleteProject(userId: string, projectId: string) {
    const project = await projectsRepository.findById(projectId);

    if (!project) {
        throw new AppError("PROJECT_NOT_FOUND");
    }

    await requireProjectManager(userId, project.organizationId);

    const deletedProject = await projectsRepository.deleteById(projectId);

    if (!deletedProject) {
        throw new AppError("PROJECT_NOT_FOUND");
    }
}
