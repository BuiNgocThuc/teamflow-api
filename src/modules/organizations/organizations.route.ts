import { Router } from "express";

import { authenticate } from "@/middleware";

import {
    addMember,
    listMembers,
    removeMember,
    updateMemberRole,
} from "./organization-members.controller.js";
import { create, getById, list, remove, update } from "./organizations.controller.js";

const organizationsRouter = Router();

organizationsRouter.use(authenticate);

organizationsRouter.post("/", create);
organizationsRouter.get("/", list);
organizationsRouter.post("/:id/members", addMember);
organizationsRouter.get("/:id/members", listMembers);
organizationsRouter.patch("/:id/members/:userId", updateMemberRole);
organizationsRouter.delete("/:id/members/:userId", removeMember);
organizationsRouter.get("/:id", getById);
organizationsRouter.patch("/:id", update);
organizationsRouter.delete("/:id", remove);

export default organizationsRouter;
