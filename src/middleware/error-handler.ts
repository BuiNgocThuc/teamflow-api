import type { ErrorRequestHandler } from "express";
import { ZodError } from "zod";

import { AppError, getErrorDefinition } from "@/shared";

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
        const definition = getErrorDefinition("INVALID_JSON");

        return response.status(definition.statusCode).json({
            error: {
                code: "INVALID_JSON",
                message: definition.message,
            },
        });
    }

    if (error instanceof ZodError) {
        const definition = getErrorDefinition("INVALID_INPUT");

        return response.status(definition.statusCode).json({
            error: {
                code: "INVALID_INPUT",
                message: definition.message,
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

    const definition = getErrorDefinition("INTERNAL_SERVER_ERROR");

    return response.status(definition.statusCode).json({
        error: {
            code: "INTERNAL_SERVER_ERROR",
            message: definition.message,
        },
    });
};
