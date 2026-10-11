import { framer } from "framer-plugin";
import { getCanvasComponentSource } from "./canvasComponentCodeGenerator";

export interface CodeExportItem {
  name: string;
  type: string;
  insertURL?: string;
}

export interface FramerCodeFileResult {
  id: string;
  name: string;
  path?: string;
  exports?: readonly CodeExportItem[];
}

export interface InsertionResult {
  success: boolean;
  message: string;
  placedOnCanvas: boolean;
  filename: string;
  error?: string;
}

class FramerCanvasService {
  /**
   * Check if running inside Framer's plugin host iframe
   */
  isFramerHost(): boolean {
    if (typeof window === "undefined") return false;
    // Inside Framer, the plugin is loaded in an iframe
    const inIframe = window.parent !== window;
    const hasFramer = typeof framer !== "undefined";
    return inIframe && hasFramer;
  }

  /**
   * Insert a React code file into the Framer project and place it onto the canvas
   */
  async insertComponent(componentName: string): Promise<InsertionResult> {
    const filename = `${componentName}.tsx`;
    const sourceCode = getCanvasComponentSource(componentName);

    console.log(`%c[MemberFrame]%c Inserting <${componentName} /> (${sourceCode.length} chars)...`, "color: #5271ff; font-weight: bold", "color: inherit");
    console.log("[MemberFrame] Diagnostic Environment:", {
      inIframe: typeof window !== "undefined" && window.parent !== window,
      mode: (framer as any)?.mode,
      hasDirectCreateCodeFile: typeof (framer as any)?.createCodeFile === "function",
      hasInvokeRPC: typeof (framer as any)?.invoke === "function",
      hasNotify: typeof (framer as any)?.notify === "function",
      hasAddComponentInstance: typeof (framer as any)?.addComponentInstance === "function",
    });

    try {
      let codeFile: FramerCodeFileResult | null = null;

      // Strategy 1: Direct SDK createCodeFile method
      if (typeof (framer as any).createCodeFile === "function") {
        console.log(`[MemberFrame] Invoking framer.createCodeFile("${filename}")...`);
        codeFile = await (framer as any).createCodeFile(filename, sourceCode);
      }
      // Strategy 2: RPC postMessage invoke("createCodeFile", filename, sourceCode)
      else if (typeof (framer as any).invoke === "function" && this.isFramerHost()) {
        console.log(`[MemberFrame] Invoking "createCodeFile" via Framer RPC message broker...`);
        try {
          codeFile = await (framer as any).invoke("createCodeFile", filename, sourceCode);
        } catch (rpcErr) {
          console.warn("[MemberFrame] RPC createCodeFile error:", rpcErr);
          throw rpcErr;
        }
      }

      console.log("[MemberFrame] Result from createCodeFile:", codeFile);

      let placedOnCanvas = false;

      if (codeFile) {
        // Attempt to auto-place component on canvas if an insertURL was returned
        if (codeFile.exports && typeof (framer as any).addComponentInstance === "function") {
          const compExport = codeFile.exports.find(
            (e) => (e.type === "component" || Boolean(e.insertURL)) && Boolean(e.insertURL)
          );
          if (compExport?.insertURL) {
            try {
              console.log(`[MemberFrame] Placing instance on canvas with URL: ${compExport.insertURL}`);
              await (framer as any).addComponentInstance({ url: compExport.insertURL });
              placedOnCanvas = true;
            } catch (instErr) {
              console.warn(
                "[MemberFrame] addComponentInstance notice: File was added to Assets > Code, but could not auto-place on canvas. Drag it manually from the left sidebar.",
                instErr
              );
            }
          }
        }

        const successMsg = placedOnCanvas
          ? `Added <${componentName} /> to Canvas & Assets > Code!`
          : `Created ${filename} in Assets > Code! (Drag to canvas)`;

        if (typeof (framer as any).notify === "function") {
          await (framer as any).notify(successMsg, { variant: "success" });
        }

        return {
          success: true,
          message: successMsg,
          placedOnCanvas,
          filename,
        };
      }

      // Standalone browser preview fallback (e.g. running in localhost:5173 outside Framer)
      console.info(
        `[MemberFrame Preview] Running outside Framer iframe. <${componentName} /> code is ready (${sourceCode.length} chars).`
      );

      return {
        success: true,
        message: `Preview Mode: <${componentName} /> ready. In Framer, this creates Assets > Code > ${filename}.`,
        placedOnCanvas: false,
        filename,
      };
    } catch (err: any) {
      const errMsg = err?.message || String(err);
      console.error(`[MemberFrame] Failed to insert "${filename}":`, err);

      if (typeof (framer as any)?.notify === "function") {
        await (framer as any).notify(`Error creating ${filename}: ${errMsg}`, {
          variant: "error",
        });
      }

      return {
        success: false,
        message: `Error creating ${filename}: ${errMsg}`,
        placedOnCanvas: false,
        filename,
        error: errMsg,
      };
    }
  }

  /**
   * Copy the raw self-contained component source code to clipboard
   */
  async copyComponentSource(componentName: string): Promise<boolean> {
    try {
      const source = getCanvasComponentSource(componentName);
      if (typeof navigator !== "undefined" && navigator.clipboard) {
        await navigator.clipboard.writeText(source);
        if (typeof (framer as any)?.notify === "function") {
          await (framer as any).notify(`Copied <${componentName} /> code to clipboard!`, {
            variant: "success",
          });
        }
        return true;
      }
      return false;
    } catch (err) {
      console.error("[MemberFrame] Failed to copy source to clipboard:", err);
      return false;
    }
  }

  /**
   * Close the plugin window
   */
  close(): void {
    try {
      if (typeof framer.closePlugin === "function") {
        framer.closePlugin();
      }
    } catch {
      window.close();
    }
  }

  /**
   * Set window geometry
   */
  setWindowGeometry(width = 360, height = 640): void {
    try {
      if (typeof framer.showUI === "function") {
        framer.showUI({
          position: "top right",
          width,
          height,
        });
      }
    } catch {
      // Standalone browser preview
    }
  }
}

export const framerCanvasService = new FramerCanvasService();
