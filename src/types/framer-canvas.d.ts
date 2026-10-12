/**
 * Minimal declarations for the `framer` runtime module. Task 1.7.
 *
 * `framer` is not a dependency of this repository and must not become one. It
 * is supplied by the Framer runtime to code running on the canvas and on a
 * published site. This repo depends on `framer-plugin`, which is a different
 * library serving a different surface: the plugin panel.
 *
 * `src/canvas-components/*.tsx` is authored here, typechecked here, and then
 * deployed verbatim into the creator's own Framer project, where the real
 * `framer` module exists. Without these declarations the deployed component
 * could not be typechecked at all, and a syntax or type error in it would reach
 * a creator's published website. See
 * `docs/development-docs/01-member-gate.md` section 3.2.
 *
 * ## The risk this file carries
 *
 * A shim cannot be wrong in a way the compiler notices. If `RenderTarget` is
 * not shaped the way this file claims, nothing here fails and the component
 * misbehaves on the canvas instead. So the surface below is deliberately only
 * what MemberFrame calls, written from the Framer API documentation, and the
 * first row of section 7 in the F01 development doc is a human check in the
 * Framer desktop app. Widen it in the task that first needs a wider surface,
 * never speculatively.
 */

declare module "framer" {
  /**
   * The subset of `ControlType` the canvas components use. Each value is the
   * string Framer's property panel keys its editor off.
   */
  export const ControlType: {
    readonly ComponentInstance: "componentinstance";
    readonly Enum: "enum";
    readonly String: "string";
    readonly Number: "number";
    readonly Boolean: "boolean";
    readonly Link: "link";
    readonly Color: "color";
  };

  /**
   * One property control. Framer's real type is a large discriminated union
   * keyed on `type`; this is the open shape, because the authored components
   * are the only writers and a wrong key here would be invisible either way.
   */
  export interface PropertyControlDescription {
    type: string;
    title?: string;
    defaultValue?: unknown;
    options?: ReadonlyArray<string>;
    optionTitles?: ReadonlyArray<string>;
    min?: number;
    max?: number;
    step?: number;
    unit?: string;
    displayStepper?: boolean;
    /** Framer calls this with the instance's current props on every render. */
    hidden?: (props: Record<string, unknown>) => boolean;
  }

  export function addPropertyControls(
    component: unknown,
    controls: Record<string, PropertyControlDescription>
  ): void;

  /**
   * Where the component is currently rendering. The gate uses this for two
   * things only: it never fetches on the canvas, and it never navigates away
   * from the editor when a `redirect` gate is locked.
   */
  export const RenderTarget: {
    readonly canvas: "CANVAS";
    readonly export: "EXPORT";
    readonly thumbnail: "THUMBNAIL";
    readonly preview: "PREVIEW";
    current(): "CANVAS" | "EXPORT" | "THUMBNAIL" | "PREVIEW";
  };
}
