import { Router } from "express";

import { login, logout, refresh, register } from "./auth.controller.js";
import { authRateLimit } from "./auth.rate-limit.js";

const authRouter = Router();

authRouter.post("/register", authRateLimit, register);
authRouter.post("/login", authRateLimit, login);
authRouter.post("/refresh", refresh);
authRouter.post("/logout", logout);

export default authRouter;
