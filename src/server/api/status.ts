import type { StatusResponse } from "@shared/types";
import { findAniCli } from "../ani-cli";

export function handleStatus(): Response {
    const path = findAniCli();
    return Response.json({aniCli: {installed: path != null, path}} satisfies StatusResponse);
}