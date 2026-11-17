import { test, expect } from "@playwright/test";
import { openEditor } from "./support/editor";

function makeSseBody(events: unknown[]): string {
  return events
    .map((evt) => `event: ${(evt as { type: string }).type}\ndata: ${JSON.stringify(evt)}\n\n`)
    .join("");
}

test.describe("Dock AI, viewport auto-tagging, and AI approval controls", () => {
  test("dock AI stays open on viewport clicks, auto-tags element, shows compact response/approval, and syncs to right AI bar", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });

    await page.route("**/api/ai/chat", async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            routeEnabled: true,
            byokSupported: true,
            providers: {
              anthropic: { configured: false, defaultModel: "claude-sonnet-5-5" },
              gemini: { configured: false, defaultModel: "gemini-2.5-flash" },
              nvidia: { configured: false, defaultModel: "nvidia/nemotron-3.5-super-vl-120b-a12b" },
              offline: { configured: true, defaultModel: "lazylayout-deterministic-v1.1" },
            },
          }),
        });
        return;
      }

      const sse = makeSseBody([
        {
          type: "meta",
          provider: "nvidia",
          model: "nvidia/nemotron-3.5-super-vl-120b-a12b",
          cachePrefixHash: "abc123",
          keySource: "byok",
        },
        {
          type: "text_delta",
          delta: "Applied a glass hover glow to Get started.",
        },
        {
          type: "tool_use",
          id: "call_1",
          name: "invoke_editor_command",
          input: {
            commandId: "edit.undo",
            argsJson: "{}",
            rationale: "Undo check command staged for approval",
          },
        },
        {
          type: "stop",
          handling: { stopReason: "tool_use", outcome: "tool_use", retryable: false },
        },
      ]);

      await route.fulfill({
        status: 200,
        contentType: "text/event-stream; charset=utf-8",
        body: sse,
      });
    });

    await openEditor(page);

    // 1. Open bottom dock AI
    await page.getByRole("button", { name: "Ask AI (/)" }).click();
    const aiBox = page.locator(".ll-aibox");
    await expect(aiBox).toBeVisible();

    // 2. Click an element in the viewport while Dock AI is open
    const targetBox = await page.evaluate(() => {
      const candidates = Array.from(
        document.querySelectorAll<HTMLElement>('[data-testid="stage-element"][data-layer-role="content"]'),
      ).filter((el) => {
        const id = el.getAttribute("data-element-id");
        const rect = el.getBoundingClientRect();
        return id && id !== "elem_canvas_root" && rect.width > 12 && rect.height > 12 && rect.top >= 60 && rect.bottom <= 740;
      });
      const el = candidates[candidates.length - 1] ?? candidates[0];
      if (!el) return null;
      const box = el.getBoundingClientRect();
      return {
        id: el.getAttribute("data-element-id"),
        x: box.x + box.width / 2,
        y: box.y + box.height / 2,
      };
    });

    if (targetBox) {
      await page.mouse.click(targetBox.x, targetBox.y);
    } else {
      const stage = page.locator(".ll-stage-viewport");
      const sb = (await stage.boundingBox())!;
      await page.mouse.click(sb.x + sb.width / 2, sb.y + sb.height / 2);
    }

    // Dock AI must NOT vanish on viewport click and context tag must be visible
    await expect(aiBox).toBeVisible();
    const tag = aiBox.getByTestId("aibox-context-tag");
    await expect(tag).toBeVisible();
    await expect(tag).toContainText("@");

    // 3. Submit prompt in Dock AI -> stays open, does NOT open Right AI panel automatically
    const input = aiBox.getByRole("textbox", { name: "Ask AI" });
    await input.fill("make this glassmorphic on hover");
    await input.press("Enter");

    await expect(aiBox).toBeVisible();
    await expect(page.getByRole("region", { name: "AI chat" })).toHaveCount(0);

    // Compact response + Approve/Reject controls appear directly inside Dock AI
    const compactResp = aiBox.getByTestId("aibox-response");
    await expect(compactResp).toBeVisible();
    await expect(compactResp).toContainText("Applied a glass hover glow");

    const approvalBar = aiBox.getByTestId("aibox-approval");
    await expect(approvalBar).toBeVisible();
    await expect(approvalBar.getByRole("button", { name: "Reject" })).toBeVisible();
    await expect(approvalBar.getByRole("button", { name: "Approve" })).toBeVisible();

    // 4. Expand to Right AI bar -> same question, answer, AND pending approval appear there too
    await aiBox.getByRole("button", { name: "Open AI chat panel" }).click();
    const rightChat = page.getByRole("region", { name: "AI chat" });
    await expect(rightChat).toBeVisible();
    await expect(rightChat).toContainText("make this glassmorphic on hover");
    await expect(rightChat).toContainText("Applied a glass hover glow");

    // Clicking in viewport while Right AI bar is open auto-tags the element chip there too
    await expect(rightChat.getByTestId("ai-tagged-chip")).toBeVisible();

    const rightApproval = rightChat.getByLabel("Pending AI command approval");
    await expect(rightApproval).toBeVisible();
    await expect(rightApproval.getByRole("button", { name: "Reject" })).toBeVisible();
    await rightApproval.getByRole("button", { name: "Approve" }).click();

    await expect(rightApproval).toHaveCount(0);
    await expect(rightChat).toContainText("Applied:");
  });
});
