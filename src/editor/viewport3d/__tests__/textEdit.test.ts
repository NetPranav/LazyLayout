import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { register3dTextCommands } from "@/core/3d/text/commands";
import { getCachedFont } from "@/core/3d/text/fontCache";
import { runCommand, tryRunCommand } from "@/core/commands";
import { documentCommands, getDocument } from "@/core/store/useDocumentStore";
import { useViewportStore } from "@/core/render/scene3d/viewportStore";
import { createId } from "@/core/ids";
import {
  base64ToArrayBuffer,
  fetchFontBuffer,
  installTestFontSeam,
} from "../textFontSeam";
import {
  useTextEditRequest3d,
  requestTextEdit3d,
  endTextEdit3d,
} from "../TextEditOverlay3d";

describe("Phase 3D-026: 3D Text & Test Font Seam", () => {
  beforeEach(() => {
    useViewportStore.getState().reset();
    endTextEdit3d();
    documentCommands.mutate("Reset Test Doc", (draft) => {
      draft.scenes = {};
      draft.objects = {};
      draft.meshes = {};
      draft.texts = {};
    });
  });

  it("base64ToArrayBuffer correctly round-trips binary data", () => {
    const raw = "Hello LazyLayout 3D Text";
    const b64 = Buffer.from(raw, "utf-8").toString("base64");
    const ab = base64ToArrayBuffer(b64);
    const decoded = Buffer.from(ab).toString("utf-8");
    assert.equal(decoded, raw);
  });

  it("installTestFontSeam registers Geist font buffer from test font seam", async () => {
    const fontPath = path.resolve("node_modules/next/dist/compiled/@vercel/og/Geist-Regular.ttf");
    assert.ok(fs.existsSync(fontPath), "Geist font fixture exists");
    const fontBuf = fs.readFileSync(fontPath);
    const fontBase64 = fontBuf.toString("base64");

    // Simulate window.__LL_TEST_FONT__
    const win = globalThis as unknown as { __LL_TEST_FONT__?: string };
    win.__LL_TEST_FONT__ = fontBase64;

    installTestFontSeam();

    const fetched = await fetchFontBuffer("https://fonts.example.com/Geist.ttf");
    assert.equal(fetched.byteLength, fontBuf.byteLength);

    const cached = getCachedFont("Geist");
    assert.ok(cached, "Geist should be registered in cache");
  });

  it("requestTextEdit3d tracks active editing object", () => {
    assert.equal(useTextEditRequest3d.getState().objectId, null);
    requestTextEdit3d("obj_text_1");
    assert.equal(useTextEditRequest3d.getState().objectId, "obj_text_1");
    assert.equal(useTextEditRequest3d.getState().seq, 1);

    endTextEdit3d();
    assert.equal(useTextEditRequest3d.getState().objectId, null);
  });

  it("3d.add.text, 3d.text.set, and 3d.text.convert_to_mesh lifecycle", () => {
    const unreg = register3dTextCommands();

    const sceneId = createId("scn");
    documentCommands.mutate("Setup Scene", (draft) => {
      draft.scenes = {
        [sceneId]: {
          id: sceneId,
          name: "Scene",
          objects: [],
        },
      };
    });
    useViewportStore.getState().setEditingSceneId(sceneId);

    // 1. Add 3D text
    const outcome = tryRunCommand("3d.add.text", {
      text: "SALE",
      size: 1.5,
      depth: 0.3,
    });
    const res = (outcome.ok ? outcome.result : {}) as { ok?: boolean; objectId?: string; textId?: string };

    assert.ok(res.ok);
    assert.ok(res.objectId);

    const doc = getDocument();
    const textObj = doc.objects?.[res.objectId];
    assert.ok(textObj, "Object created");
    assert.equal(textObj.type, "text");

    const textBlock = doc.texts?.[textObj.dataId!];
    assert.ok(textBlock, "Text3d data block created");
    assert.equal(textBlock.text, "SALE");

    // 2. Set text properties via 3d.text.set
    runCommand("3d.text.set", {
      objectId: res.objectId,
      text: "SUMMER SALE",
      depth: 0.5,
    });

    const docUpdated = getDocument();
    const updatedBlock = docUpdated.texts?.[textObj.dataId!];
    assert.equal(updatedBlock?.text, "SUMMER SALE");
    assert.equal(updatedBlock?.depth, 0.5);

    // 3. Convert to mesh
    runCommand("3d.text.convert_to_mesh", {
      objectId: res.objectId,
    });

    const docConverted = getDocument();
    const convertedObj = docConverted.objects?.[res.objectId];
    assert.ok(convertedObj);
    assert.equal(convertedObj.type, "mesh", "Object converted to plain mesh");
    assert.notEqual(convertedObj.dataId, res.textId, "Data link to texts removed");

    unreg();
  });
});
