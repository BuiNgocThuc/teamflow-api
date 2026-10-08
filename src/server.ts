import "dotenv/config";

import { startRefreshTokenCleanup } from "./modules/auth/index.js";
import app from "./app.js";

const portValue = process.env.PORT ?? 3000;
const port = Number(portValue);

if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(
        `PORT must be an integer between 1 and 65535. Received: ${portValue}`,
    );
}

const stopRefreshTokenCleanup = startRefreshTokenCleanup();

const server = app.listen(port, () => {
    console.log(`Server is running at http://localhost:${port}`);
});

function shutdown(signal: string): void {
    console.log(`${signal} received. Shutting down.`);
    stopRefreshTokenCleanup();
    server.close((error) => {
        if (error) {
            console.error("HTTP server shutdown failed:", error);
            process.exitCode = 1;
        }
    });
}

process.once("SIGTERM", () => shutdown("SIGTERM"));
process.once("SIGINT", () => shutdown("SIGINT"));
