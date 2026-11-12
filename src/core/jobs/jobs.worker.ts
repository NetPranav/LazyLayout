/// <reference lib="webworker" />
/**
 * ROADMAP_3D 3D-006: the one worker script the pool runs. It looks the job's kind up in `handlers` and answers with
 * progress and a result, or an error.
 */
import { handlers } from "./handlers";

self.onmessage = (e: MessageEvent<{ id: number; kind: string; payload: unknown }>) => {
  const { id, kind, payload } = e.data;
  const post = (m: unknown, transfer?: Transferable[]) => (self as unknown as Worker).postMessage(m, transfer ?? []);
  const handler = handlers[kind];
  if (!handler) {
    post({ id, type: "error", message: `no handler for "${kind}"` });
    return;
  }
  try {
    const out = handler(payload as never, { progress: (progress) => post({ id, type: "progress", progress }) });
    post({ id, type: "done", result: out.result }, out.transfer);
  } catch (err) {
    post({ id, type: "error", message: err instanceof Error ? err.message : String(err) });
  }
};
