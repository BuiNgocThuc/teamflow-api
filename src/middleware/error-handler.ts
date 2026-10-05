import type { ErrorRequestHandler } from "express";
import { ZodError } from "zod";

import { AppError } from "@/shared";

function isMalformedJsonError(error: unknown): boolean {
    return (
        error instanceof SyntaxError &&
        "type" in error &&
        error.type === "entity.parse.failed"
    );
}

export const errorHandler: ErrorRequestHandler = (
    error: unknown,
    _request,
    response,
    _next,
) => {
    if (isMalformedJsonError(error)) {
        return response.status(400).json({
            error: {
                code: "INVALID_JSON",
                message: "Request body must be valid JSON.",
            },
        });
    }

    if (error instanceof ZodError) {
        return response.status(400).json({
            error: {
                code: "INVALID_INPUT",
                message: "Request validation failed.",
                details: error.issues.map((issue) => ({
                    path: issue.path.join("."),
                    message: issue.message,
                })),
            },
        });
    }

    if (error instanceof AppError) {
        return response.status(error.statusCode).json({
            error: {
                code: error.code,
                message: error.message,
            },
        });
    }

    console.error("Unhandled application error:", error);

    return response.status(500).json({
        error: {
            code: "INTERNAL_SERVER_ERROR",
            message: "An unexpected error occurred.",
        },
    });
};
