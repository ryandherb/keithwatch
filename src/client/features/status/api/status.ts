import type { StatusResponse } from "@shared/types";
import { getJson } from "@/lib/api";

export const getStatus = (signal?: AbortSignal) => 
    getJson<StatusResponse>("/api/status", {}, signal); 