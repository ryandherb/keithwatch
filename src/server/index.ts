/**
 * Server entry point. Serves the React app and the JSON API from one Bun
 * process. ani-cli is driven from `ani-cli.ts`; HTTP handlers live in `api/`; register new ones in `routes` below.
 */
import index from "../client/index.html";
import { findAniCli } from "./ani-cli";
import { handleEpisodes, handleLinks, handleSearch } from "./api/anime";
import { handleStream } from "./api/stream";

const server = Bun.serve({
  port: Number(process.env.PORT ?? 3000),

  routes: {
    "/api/search": { GET: handleSearch },
    "/api/episodes": { GET: handleEpisodes },
    "/api/links": { GET: handleLinks },
    "/api/stream": { GET: handleStream },
    "/api/*": Response.json({ error: "Not found" }, { status: 404 }),

    // Everything else is the SPA; react-router handles client-side routes.
    "/*": index,
  },

  development: process.env.NODE_ENV !== "production" && {
    hmr: true,
    // Echo browser console logs to the server terminal.
    console: true,
  },
});

console.log(`keithwatch running at ${server.url}`);

const aniCliPath = findAniCli(); 
if(aniCliPath){
  console.log(`Using ani-cli at ${aniCliPath}`);
} else {
  console.warn("No path found for ani-cli.");
}