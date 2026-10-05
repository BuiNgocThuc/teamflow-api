import { Router } from "express";

import { authenticate } from "@/middleware";
import { getCurrentUser } from "./users.controller.js";

const usersRouter = Router();

usersRouter.get("/me", authenticate, getCurrentUser);

export default usersRouter;
