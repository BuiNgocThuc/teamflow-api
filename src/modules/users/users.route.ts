import { Router } from "express";

import { authenticate } from "@/middleware";
import { getCurrentUser, updateCurrentUser } from "./users.controller.js";

const usersRouter = Router();

usersRouter.get("/me", authenticate, getCurrentUser);
usersRouter.patch("/me", authenticate, updateCurrentUser);

export default usersRouter;
