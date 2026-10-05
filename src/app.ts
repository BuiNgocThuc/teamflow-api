import express from "express";

import { errorHandler } from "@/middleware";
import { authRouter, usersRouter } from "@/modules";

const app = express();

app.use(express.json());

app.get("/health", (_request, response) => {
    return response.status(200).json({
        status: "ok",
    });
});

app.use("/auth", authRouter);
app.use("/users", usersRouter);

app.use(errorHandler);

export default app;
