import type { BrandingContext, BrandingModule } from "./types.js";

export async function installBrandingModules(
  ctx: BrandingContext,
  modules: BrandingModule[],
  phase: BrandingModule["phase"] = "pre-start",
): Promise<void> {
  for (const module of modules) {
    if (module.phase === phase) {
      await module.install(ctx);
    }
  }
}
