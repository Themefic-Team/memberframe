/**
 * Ambient type definitions for Framer Canvas Runtime
 * Allows canvas components to use addPropertyControls and ControlType with full type safety
 */

declare module "*?raw" {
  const content: string;
  export default content;
}

declare module "framer" {
  import React from "react";

  export const ControlType: {
    Boolean: "Boolean";
    Color: "Color";
    ComponentInstance: "ComponentInstance";
    Enum: "Enum";
    File: "File";
    Image: "Image";
    Number: "Number";
    String: "String";
    Array: "Array";
    Object: "Object";
    ResponsiveImage: "ResponsiveImage";
    Font: "Font";
    Link: "Link";
    Date: "Date";
    EventHandler: "EventHandler";
  };

  export interface PropertyControlBase {
    title?: string;
    description?: string;
    hidden?: (props: any) => boolean;
  }

  export interface NumberControlDescription extends PropertyControlBase {
    type: typeof ControlType.Number;
    defaultValue?: number;
    min?: number;
    max?: number;
    step?: number;
    unit?: string;
    displayStepper?: boolean;
  }

  export interface StringControlDescription extends PropertyControlBase {
    type: typeof ControlType.String;
    defaultValue?: string;
    placeholder?: string;
    displayTextArea?: boolean;
  }

  export interface BooleanControlDescription extends PropertyControlBase {
    type: typeof ControlType.Boolean;
    defaultValue?: boolean;
    enabledTitle?: string;
    disabledTitle?: string;
  }

  export interface ColorControlDescription extends PropertyControlBase {
    type: typeof ControlType.Color;
    defaultValue?: string;
  }

  export interface EnumControlDescription extends PropertyControlBase {
    type: typeof ControlType.Enum;
    defaultValue?: any;
    options: any[];
    optionTitles?: string[];
    displaySegmentedControl?: boolean;
  }

  export interface ComponentInstanceControlDescription extends PropertyControlBase {
    type: typeof ControlType.ComponentInstance;
  }

  export type PropertyControlDescription =
    | NumberControlDescription
    | StringControlDescription
    | BooleanControlDescription
    | ColorControlDescription
    | EnumControlDescription
    | ComponentInstanceControlDescription
    | (PropertyControlBase & { type: any; [key: string]: any });

  export function addPropertyControls(
    component: React.ComponentType<any>,
    controls: Record<string, PropertyControlDescription>
  ): void;

  export type RenderTargetType = "canvas" | "preview" | "export";

  export const RenderTarget: {
    current(): RenderTargetType;
  };
}
