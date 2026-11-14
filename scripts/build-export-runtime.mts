import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { generatedModuleText } from "./export-runtime-source";

const target = join(process.cwd(), "src/core/export/runtime/expressionRuntimeSource.ts");
writeFileSync(target, generatedModuleText());
console.log(`Wrote ${target}`);
