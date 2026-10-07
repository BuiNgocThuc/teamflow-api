import { Router } from "express";
import { authenticate } from "@/middleware";
import { create, getById, list, remove, update } from "./projects.controller.js";

const organizationProjectsRouter = Router();
const projectsRouter = Router();

organizationProjectsRouter.use(authenticate);
organizationProjectsRouter.post("/:organizationId/projects", create);
organizationProjectsRouter.get("/:organizationId/projects", list);

projectsRouter.use(authenticate);
projectsRouter.get("/:id", getById);
projectsRouter.patch("/:id", update);
projectsRouter.delete("/:id", remove);

export { organizationProjectsRouter, projectsRouter };
