import type { RequestHandler } from "express";

import { AppError } from "@/shared";

type RateLimitEntry = {
    count: number;
    resetAt: number;
};

type RateLimitOptions = {
    maxRequests: number;
    windowMs: number;
    keyGenerator?: (request: Parameters<RequestHandler>[0]) => string;
};

function validateOptions(options: RateLimitOptions): void {
    if (!Number.isInteger(options.maxRequests) || options.maxRequests < 1) {
        throw new Error("Rate-limit maxRequests must be a positive integer.");
    }

    if (!Number.isInteger(options.windowMs) || options.windowMs < 1) {
        throw new Error("Rate-limit windowMs must be a positive integer.");
    }
}

export function createRateLimit(options: RateLimitOptions): RequestHandler {
    validateOptions(options);

    const entries = new Map<string, RateLimitEntry>();
    const keyGenerator = options.keyGenerator ?? ((request) => request.ip);

    const cleanupInterval = setInterval(() => {
        const now = Date.now();

        for (const [key, entry] of entries) {
            if (entry.resetAt <= now) {
                entries.delete(key);
            }
        }
    }, options.windowMs);
    cleanupInterval.unref();

    return (request, response, next) => {
        const now = Date.now();
        const key = keyGenerator(request) || "unknown";
        const existingEntry = entries.get(key);
        const entry =
            !existingEntry || existingEntry.resetAt <= now
                ? { count: 0, resetAt: now + options.windowMs }
                : existingEntry;

        entry.count += 1;
        entries.set(key, entry);

        if (entry.count > options.maxRequests) {
            const retryAfterSeconds = Math.max(
                1,
                Math.ceil((entry.resetAt - now) / 1000),
            );

            response.setHeader("Retry-After", retryAfterSeconds.toString());
            next(new AppError("RATE_LIMIT_EXCEEDED"));
            return;
        }

        next();
    };
}
