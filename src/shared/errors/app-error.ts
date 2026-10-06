import { getErrorDefinition, type AppErrorCode } from "./error-definitions.js";

export class AppError extends Error {
    public readonly statusCode: number;

    constructor(public readonly code: AppErrorCode) {
        const definition = getErrorDefinition(code);

        super(definition.message);
        this.statusCode = definition.statusCode;
        this.name = "AppError";
    }
}
