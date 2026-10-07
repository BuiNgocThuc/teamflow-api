import {
    createProjectSchema,
    listProjectsQuerySchema,
    organizationProjectsParamsSchema,
    projectParamsSchema,
    updateProjectSchema,
} from "@/modules/projects/projects.schema";
import type { Request, Response } from "express";
import {
    createProject,
    deleteProject,
    getProject,
    listProjects,
    updateProject,
} from "@/modules/projects/projects.service";
import { getAuthenticatedUserId } from "@/shared";

export async function create(request: Request, response: Response): Promise<Response> {
    const { organizationId } = organizationProjectsParamsSchema.parse(request.params);
    const input = createProjectSchema.parse(request.body);
    const project = await createProject(
        getAuthenticatedUserId(request),
        organizationId,
        input,
    );

    return response.status(201).json({ project });
}

export async function list(request: Request, response: Response): Promise<Response> {
    const { organizationId } = organizationProjectsParamsSchema.parse(request.params);
    const query = listProjectsQuerySchema.parse(request.query);
    const result = await listProjects(
        getAuthenticatedUserId(request),
        organizationId,
        query,
    );

    return response.status(200).json(result);
}

export async function getById(request: Request, response: Response): Promise<Response> {
    const { id } = projectParamsSchema.parse(request.params);
    const project = await getProject(getAuthenticatedUserId(request), id);

    return response.status(200).json({ project });
}

export async function update(request: Request, response: Response): Promise<Response> {
    const { id } = projectParamsSchema.parse(request.params);
    const input = updateProjectSchema.parse(request.body);
    const project = await updateProject(getAuthenticatedUserId(request), id, input);

    return response.status(200).json({ project });
}

export async function remove(request: Request, response: Response): Promise<void> {
    const { id } = projectParamsSchema.parse(request.params);

    await deleteProject(getAuthenticatedUserId(request), id);
    response.status(204).end();
}
