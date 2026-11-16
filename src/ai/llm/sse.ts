/**
 * Pure Web Streams SSE frame reader shared by Gemini, NVIDIA NIM, and browser streaming.
 */
export async function* readSseFrames(
  body: ReadableStream<Uint8Array>,
): AsyncIterable<{ event?: string; data: string }> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  const parseBlock = (block: string): { event?: string; data: string } | null => {
    const lines = block.split(/\r?\n/);
    let eventName: string | undefined;
    const dataParts: string[] = [];

    for (const line of lines) {
      if (line.startsWith("event:")) {
        eventName = line.slice(6).trim();
      } else if (line.startsWith("data:")) {
        dataParts.push(line.slice(5).trimStart());
      }
    }

    if (dataParts.length === 0) return null;
    return {
      ...(eventName ? { event: eventName } : {}),
      data: dataParts.join("\n").trim(),
    };
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let splitIdx = buffer.search(/\r?\n\r?\n/);
    while (splitIdx !== -1) {
      const sepMatch = buffer.slice(splitIdx).match(/^\r?\n\r?\n/);
      const sepLen = sepMatch ? sepMatch[0].length : 2;
      const block = buffer.slice(0, splitIdx);
      buffer = buffer.slice(splitIdx + sepLen);
      const parsed = parseBlock(block);
      if (parsed) yield parsed;
      splitIdx = buffer.search(/\r?\n\r?\n/);
    }
  }

  const tail = buffer.trim();
  if (tail) {
    const parsed = parseBlock(tail);
    if (parsed) yield parsed;
  }
}
