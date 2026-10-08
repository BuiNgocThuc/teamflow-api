import { authRepository } from "./auth.repository.js";

function getCleanupIntervalInHours(): number {
    const value = Number(process.env.REFRESH_TOKEN_CLEANUP_INTERVAL_HOURS ?? "24");

    if (!Number.isInteger(value) || value < 1 || value > 168) {
        throw new Error(
            "REFRESH_TOKEN_CLEANUP_INTERVAL_HOURS must be an integer between 1 and 168.",
        );
    }

    return value;
}

export function startRefreshTokenCleanup(): () => void {
    const cleanup = async () => {
        try {
            await authRepository.deleteExpiredRefreshTokens(new Date());
        } catch (error) {
            console.error("Refresh-token cleanup failed:", error);
        }
    };

    void cleanup();

    const interval = setInterval(
        () => void cleanup(),
        getCleanupIntervalInHours() * 60 * 60 * 1000,
    );
    interval.unref();

    return () => clearInterval(interval);
}
