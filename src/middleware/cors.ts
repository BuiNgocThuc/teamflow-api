import type { RequestHandler } from "express";

import { frontendOrigin } from "@/config/frontend-origin";

export const cors: RequestHandler = (request, response, next) => {
    const origin = request.header("origin");

    if (origin === frontendOrigin) {
        response.setHeader("Access-Control-Allow-Origin", frontendOrigin);
        response.setHeader("Access-Control-Allow-Credentials", "true");
        response.setHeader("Vary", "Origin");
    }

    if (request.method === "OPTIONS" && origin === frontendOrigin) {
        response.setHeader(
            "Access-Control-Allow-Methods",
            "GET, HEAD, PATCH, POST, PUT, DELETE, OPTIONS",
        );
        response.setHeader(
            "Access-Control-Allow-Headers",
            request.header("access-control-request-headers") ??
                "Authorization, Content-Type",
        );
        response.status(204).end();
        return;
    }

    next();
};
