/**
 * Design track D4: writes the CSS variables drivers set (`hero.cssvar.glow` becomes `--glow` on the layer's element), so plain CSS
 * can react to the pointer, the scroll or time. Writes only what changed, and takes a variable off again when no driver sets it any
 * more or the engine stops, so what React drew is put back.
 */
export interface VarElement {
  style: { setProperty(name: string, value: string): void; removeProperty(name: string): string; getPropertyValue(name: string): string };
}

export class CssVarWriter {
  /** What was last written, per layer and variable, and what the element held before the first write. */
  private readonly written = new Map<string, Map<string, { value: string; original: string }>>();

  constructor(private readonly node: (layerId: string) => VarElement | undefined) {}

  /** Make the elements show exactly these variables. */
  apply(vars: ReadonlyMap<string, ReadonlyMap<string, number>>): void {
    for (const [layerId, names] of vars) {
      const el = this.node(layerId);
      if (!el) continue;
      let mine = this.written.get(layerId);
      if (!mine) this.written.set(layerId, (mine = new Map()));
      for (const [name, value] of names) {
        const text = String(Math.round(value * 1e6) / 1e6);
        const prev = mine.get(name);
        if (prev?.value === text) continue;
        if (!prev) mine.set(name, { value: text, original: el.style.getPropertyValue(`--${name}`) });
        else prev.value = text;
        el.style.setProperty(`--${name}`, text);
      }
    }
    // a variable no driver sets any more goes back to what was drawn
    for (const [layerId, mine] of this.written) {
      for (const [name, rec] of [...mine]) {
        if (vars.get(layerId)?.has(name)) continue;
        this.put(layerId, name, rec.original);
        mine.delete(name);
      }
    }
  }

  private put(layerId: string, name: string, original: string): void {
    const el = this.node(layerId);
    if (!el) return;
    if (original) el.style.setProperty(`--${name}`, original);
    else el.style.removeProperty(`--${name}`);
  }

  /** Put every variable back. */
  dispose(): void {
    for (const [layerId, mine] of this.written) for (const [name, rec] of mine) this.put(layerId, name, rec.original);
    this.written.clear();
  }
}
