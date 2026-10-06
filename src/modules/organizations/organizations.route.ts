import { Router } from "express";

import { authenticate } from "@/middleware";

import { create, getById, list, remove, update } from "./organizations.controller.js";

const organizationsRouter = Router();

organizationsRouter.use(authenticate);

organizationsRouter.post("/", create);
organizationsRouter.get("/", list);
organizationsRouter.get("/:id", getById);
organizationsRouter.patch("/:id", update);
organizationsRouter.delete("/:id", remove);

export default organizationsRouter;
