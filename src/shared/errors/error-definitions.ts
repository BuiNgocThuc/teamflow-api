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
    RATE_LIMIT_EXCEEDED: {
        statusCode: 429,
        message: "Too many requests. Please try again later.",
    },
    INVALID_REFRESH_TOKEN_ORIGIN: {
        statusCode: 403,
        message:
            "Refresh-token requests must come from the configured frontend origin.",
    },
    ORGANIZATION_ACCESS_DENIED: {
        statusCode: 403,
        message: "You do not have access to this organization.",
    },
    ORGANIZATION_OWNER_REQUIRED: {
        statusCode: 403,
        message: "Only an organization owner can perform this action.",
    },
    ORGANIZATION_MEMBER_MANAGEMENT_DENIED: {
        statusCode: 403,
        message: "You do not have permission to manage organization members.",
    },
    ORGANIZATION_OWNER_CANNOT_BE_MANAGED: {
        statusCode: 403,
        message: "Organization owners cannot be managed through this endpoint.",
    },
    PROJECT_MANAGEMENT_DENIED: {
        statusCode: 403,
        message: "You do not have permission to manage projects.",
    },
    USER_NOT_FOUND: {
        statusCode: 404,
        message: "User was not found.",
    },
    ORGANIZATION_NOT_FOUND: {
        statusCode: 404,
        message: "Organization was not found.",
    },
    ORGANIZATION_MEMBER_NOT_FOUND: {
        statusCode: 404,
        message: "Organization member was not found.",
    },
    PROJECT_NOT_FOUND: {
        statusCode: 404,
        message: "Project was not found.",
    },
    TASK_NOT_FOUND: {
        statusCode: 404,
        message: "Task was not found.",
    },
    TASK_ASSIGNEE_NOT_ORGANIZATION_MEMBER: {
        statusCode: 400,
        message: "Task assignee must be a member of the organization.",
    },
    INVALID_TASK_STATUS_TRANSITION: {
        statusCode: 400,
        message: "The requested task status transition is not allowed.",
    },
    EMAIL_ALREADY_EXISTS: {
        statusCode: 409,
        message: "Email is already registered.",
    },
    ORGANIZATION_MEMBER_ALREADY_EXISTS: {
        statusCode: 409,
        message: "User is already a member of this organization.",
    },
    INVALID_ORGANIZATION_ROLE_TRANSITION: {
        statusCode: 400,
        message: "The requested organization role transition is invalid.",
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
