import { afterEach, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { DocBuilder } from "../../document/__tests__/fixtures/builder";
import { setDocument, getDocument } from "../../store/documentState";
import { tryRunCommand } from "../../commands";
import { registerDriverCommands } from "../driverCommands";

let off: () => void;
let hero = "";
beforeEach(() => {
  const b = new DocBuilder();
  hero = b.layer("container", "Hero", null, {});
  setDocument(b.build());
  off = registerDriverCommands();
});
afterEach(() => off());

describe("driver commands (D4)", () => {
  it("add a driver from the grammar, by layer name; it lands in the document", () => {
    const out = tryRunCommand("layer.addDriver", { id: hero, text: "pointer.x |> remap(0, 1000, 0, 100)\n-> Hero.transform.x", name: "Follow x" });
    assert.ok(out.ok);
    assert.equal((out.result as { ok: boolean }).ok, true);
    const [b] = Object.values(getDocument().bindings ?? {});
    assert.equal(b.ownerLayerId, hero);
    assert.equal(b.name, "Follow x");
    assert.equal(b.target.kind === "property" && b.target.on.kind === "layer" && b.target.on.ref, hero);
  });

  it("a bad driver is refused with a message, and nothing is stored", () => {
    const out = tryRunCommand("layer.addDriver", { id: hero, text: "pointer.x |> frobnicate(3)\n-> Hero.transform.x" });
    const r = out.ok ? (out.result as { ok: boolean; code?: string; message?: string }) : null;
    assert.equal(r?.ok, false);
    assert.equal(r?.code, "BAD_DRIVER");
    assert.ok((r?.message ?? "").length > 0);
    assert.equal(Object.keys(getDocument().bindings ?? {}).length, 0);
  });

  it("no layer, or an unknown one, is refused", () => {
    const out = tryRunCommand("layer.addDriver", { id: "nope", text: "pointer.x -> Hero.transform.x" });
    assert.equal((out.ok ? (out.result as { code?: string }) : {}).code, "NO_LAYER");
  });

  it("turn off, turn on and remove", () => {
    const add = tryRunCommand("layer.addDriver", { id: hero, text: "scroll.progress |> remap(0, 1, 0, 90)\n-> Hero.transform.rotate" });
    const id = (add.ok ? (add.result as { id: string }).id : "") as string;
    tryRunCommand("layer.setDriverEnabled", { driverId: id, enabled: false });
    assert.equal(getDocument().bindings![id].enabled, false);
    tryRunCommand("layer.setDriverEnabled", { driverId: id, enabled: true });
    assert.equal(getDocument().bindings![id].enabled, true);
    const gone = tryRunCommand("layer.removeDriver", { driverId: id });
    assert.deepEqual(gone.ok ? gone.result : null, { removed: 1 });
    assert.equal(Object.keys(getDocument().bindings ?? {}).length, 0);
    const none = tryRunCommand("layer.setDriverEnabled", { driverId: "ghost", enabled: true });
    assert.equal((none.ok ? (none.result as { code?: string }) : {}).code, "NO_DRIVER");
  });
});
