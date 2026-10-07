import { Router } from "express";

import { authenticate } from "@/middleware";

import {
    assign,
    create,
    getById,
    list,
    remove,
    update,
    updateStatus,
} from "./tasks.controller.js";

const projectTasksRouter = Router();
const tasksRouter = Router();

projectTasksRouter.use(authenticate);
projectTasksRouter.post("/:projectId/tasks", create);
projectTasksRouter.get("/:projectId/tasks", list);

tasksRouter.use(authenticate);
tasksRouter.get("/:id", getById);
tasksRouter.patch("/:id/assignee", assign);
tasksRouter.patch("/:id/status", updateStatus);
tasksRouter.patch("/:id", update);
tasksRouter.delete("/:id", remove);

export { projectTasksRouter, tasksRouter };
