import type { RequestHandler } from "express";

function getFrontendOrigin(): string {
    const origin = process.env.FRONTEND_ORIGIN;

    if (!origin) {
        throw new Error("FRONTEND_ORIGIN is required.");
    }

    let parsedOrigin: URL;

    try {
        parsedOrigin = new URL(origin);
    } catch {
        throw new Error("FRONTEND_ORIGIN must be a valid absolute URL.");
    }

    if (parsedOrigin.origin !== origin) {
        throw new Error("FRONTEND_ORIGIN must not include a path, query, or fragment.");
    }

    return origin;
}

const frontendOrigin = getFrontendOrigin();

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
