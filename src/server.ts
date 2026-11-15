import app from "./app";
import { connectDatabase } from "./config/database";
import { env } from "./config/env";
import dns from "node:dns";

dns.setServers(["8.8.8.8", "1.1.1.1"]);
async function startServer() {
  await connectDatabase();

  app.listen(env.PORT, () => {
    console.log(
      `Server running on http://localhost:${env.PORT}`
    );
  });
}

startServer();