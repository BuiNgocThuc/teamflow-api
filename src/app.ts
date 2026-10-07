import express from "express";

import { errorHandler } from "@/middleware";
import {
    authRouter,
    organizationsRouter,
    usersRouter,
    organizationProjectsRouter,
    projectsRouter,
} from "@/modules";

const app = express();

app.use(express.json());

app.get("/health", (_request, response) => {
    return response.status(200).json({
        status: "ok",
    });
});

app.use("/auth", authRouter);
app.use("/users", usersRouter);
app.use("/organizations", organizationsRouter);
app.use("/organizations", organizationProjectsRouter);
app.use("/projects", projectsRouter);

app.use(errorHandler);

export default app;
