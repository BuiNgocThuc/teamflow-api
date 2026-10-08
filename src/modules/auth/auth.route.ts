import { Router } from "express";

import { login, logout, refresh, register } from "./auth.controller.js";
import { authRateLimit } from "./auth.rate-limit.js";
import { validateRefreshTokenOrigin } from "./validate-refresh-token-origin.js";

const authRouter = Router();

authRouter.post("/register", authRateLimit, register);
authRouter.post("/login", authRateLimit, login);
authRouter.post("/refresh", validateRefreshTokenOrigin, refresh);
authRouter.post("/logout", validateRefreshTokenOrigin, logout);

export default authRouter;
