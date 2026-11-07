import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { insertAfter, isLoadingPage, orderedPages, referencePages } from "../loadingPages";
import type { PageDefinition } from "@/core/store/projectTypes";

const page = (id: string, extra: Partial<PageDefinition> = {}): PageDefinition => ({ id, name: id, slug: `/${id}`, rootElementId: `root_${id}`, ...extra });

describe("loading pages", () => {
  it("lists pages by order, then as they were added", () => {
    const pages = { b: page("b", { order: 1 }), a: page("a", { order: 0 }), c: page("c") };
    assert.deepEqual(orderedPages(pages).map((p) => p.id), ["a", "b", "c"]);
    assert.deepEqual(orderedPages({ x: page("x"), y: page("y") }).map((p) => p.id), ["x", "y"]);
  });

  it("puts a new entry straight after the page it follows", () => {
    assert.deepEqual(insertAfter(["home", "about"], "home", "load"), ["home", "load", "about"]);
    assert.deepEqual(insertAfter(["home", "about"], "about", "load"), ["home", "about", "load"]);
    assert.deepEqual(insertAfter(["home", "about"], "missing", "load"), ["home", "about", "load"]);
    assert.deepEqual(insertAfter(["home", "load", "about"], "about", "load"), ["home", "about", "load"], "moving it does not duplicate it");
  });

  it("tells a loading page from a page, and offers only pages as references", () => {
    const pages = { home: page("home", { order: 0 }), load: page("load", { kind: "loading", order: 1 }), about: page("about", { order: 2 }) };
    assert.equal(isLoadingPage(pages.load), true);
    assert.equal(isLoadingPage(pages.home), false);
    assert.equal(isLoadingPage(undefined), false);
    assert.deepEqual(referencePages(pages).map((p) => p.id), ["home", "about"]);
  });
});
