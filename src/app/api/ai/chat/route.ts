import { handleAiChatGet, handleAiChatPost } from "@/ai/llm/routeHandler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  return handleAiChatGet();
}

export async function POST(request: Request): Promise<Response> {
  return handleAiChatPost(request);
}
