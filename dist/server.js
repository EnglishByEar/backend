import app from "./app.js";
import { connectDatabase } from "./config/database.js";
import { env } from "./config/env.js";
import dns from "node:dns";
dns.setServers(["8.8.8.8", "1.1.1.1"]);
async function startServer() {
    await connectDatabase();
    app.listen(env.PORT, () => {
        console.log(`Server running on http://localhost:${env.PORT}`);
    });
}
startServer();
