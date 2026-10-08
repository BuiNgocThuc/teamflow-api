import { createRateLimit } from "@/middleware/rate-limit";

function getPositiveIntegerEnvironmentValue(name: string, fallback: number): number {
    const value = Number(process.env[name] ?? fallback);

    if (!Number.isInteger(value) || value < 1) {
        throw new Error(`${name} must be a positive integer.`);
    }

    return value;
}

const windowMinutes = getPositiveIntegerEnvironmentValue(
    "AUTH_RATE_LIMIT_WINDOW_MINUTES",
    15,
);
const maxRequests = getPositiveIntegerEnvironmentValue(
    "AUTH_RATE_LIMIT_MAX_REQUESTS",
    process.env.NODE_ENV === "test" ? 1_000 : 5,
);

export const authRateLimit = createRateLimit({
    maxRequests,
    windowMs: windowMinutes * 60 * 1000,
});
