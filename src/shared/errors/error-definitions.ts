export const errorDefinitions = {
    INVALID_JSON: {
        statusCode: 400,
        message: "Request body must be valid JSON.",
    },
    INVALID_INPUT: {
        statusCode: 400,
        message: "Request validation failed.",
    },
    AUTHENTICATION_REQUIRED: {
        statusCode: 401,
        message: "A bearer access token is required.",
    },
    INVALID_ACCESS_TOKEN: {
        statusCode: 401,
        message: "Access token is invalid or expired.",
    },
    INVALID_CREDENTIALS: {
        statusCode: 401,
        message: "Email or password is incorrect.",
    },
    INVALID_REFRESH_TOKEN: {
        statusCode: 401,
        message: "Refresh token is invalid or expired.",
    },
    ORGANIZATION_ACCESS_DENIED: {
        statusCode: 403,
        message: "You do not have access to this organization.",
    },
    ORGANIZATION_OWNER_REQUIRED: {
        statusCode: 403,
        message: "Only an organization owner can perform this action.",
    },
    USER_NOT_FOUND: {
        statusCode: 404,
        message: "User was not found.",
    },
    ORGANIZATION_NOT_FOUND: {
        statusCode: 404,
        message: "Organization was not found.",
    },
    EMAIL_ALREADY_EXISTS: {
        statusCode: 409,
        message: "Email is already registered.",
    },
    INTERNAL_SERVER_ERROR: {
        statusCode: 500,
        message: "An unexpected error occurred.",
    },
} as const;

export type AppErrorCode = keyof typeof errorDefinitions;

export function getErrorDefinition(code: AppErrorCode) {
    return errorDefinitions[code];
}
