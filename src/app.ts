import express from "express";

import { cors, errorHandler } from "@/middleware";
import {
    authRouter,
    projectTasksRouter,
    organizationsRouter,
    usersRouter,
    organizationProjectsRouter,
    projectsRouter,
    tasksRouter,
} from "@/modules";

const app = express();

app.use(cors);
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
app.use("/projects", projectTasksRouter);
app.use("/tasks", tasksRouter);

app.use(errorHandler);

export default app;
