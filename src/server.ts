import "dotenv/config";

import app from "./app.js";

const portValue = process.env.PORT ?? 3000;
const port = Number(portValue);

if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(
        `PORT must be an integer between 1 and 65535. Received: ${portValue}`,
    );
}

app.listen(port, () => {
    console.log(`Server is running at http://localhost:${port}`);
});
