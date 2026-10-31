import { createServer } from "node:http";
import { Snapshot } from "./snapshot.mjs";
import { Store } from "./store.mjs";
import { ensAdapter } from "./resolver.mjs";
import { createApi } from "./app.mjs";
import { createNodeHandler } from "./http.mjs";

const cliValue = (flag) => {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : undefined;
};
const port = Number(cliValue("--port") || process.env.PORT || 8787);
if (!Number.isInteger(port) || port < 1 || port > 65535)
  throw new Error("Invalid port");
const store =
  process.env.FACE_READ_ONLY === "true"
    ? null
    : new Store(process.env.FACE_DB_PATH || "data/face.sqlite");
const api = createApi({
  snapshot: new Snapshot(),
  store,
  ens: ensAdapter(process.env.ENS_RPC_URL),
  origin: process.env.APP_ORIGIN || `http://localhost:${port}`,
});
const server = createServer(createNodeHandler(api, { port }));
server.listen(port, cliValue("--host") || process.env.HOST || "127.0.0.1", () =>
  console.log(
    `Wallet Face API http://localhost:${port}; writes ${store ? "enabled (SQLite)" : "disabled"}`,
  ),
);
for (const signal of ["SIGTERM", "SIGINT"])
  process.on(signal, () =>
    server.close(() => {
      store?.close();
      process.exit(0);
    }),
  );
