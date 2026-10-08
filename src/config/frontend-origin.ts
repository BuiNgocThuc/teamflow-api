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

export const frontendOrigin = getFrontendOrigin();
