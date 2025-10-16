<<<<<<< ours
import { z } from "zod";

export interface ToolMetadata {
  name: string;
  description: string;
  annotations?: {
    title?: string;
    [key: string]: any;
  };
  [key: string]: any;
}

export interface ToolItem {
  path: string;
  name: string;
  metadata: ToolMetadata;
  schema: Record<string, z.ZodType>;
  handler: (args: any) => Promise<any>;
}

export interface ToolRegistryItem {
  description: string;
  inputSchema: z.ZodObject<any>;
  execute: (args: any) => Promise<any>;
}

export type ToolNames = never;

export type ToolRegistry = {
  [k in ToolNames]: ToolRegistryItem;
};

declare global {
  namespace XMCP {
    interface Tools extends ToolRegistry {}
  }
}

export declare function getTools(): Promise<ToolRegistry>;
export declare const tools: ToolRegistry;
|||||||
=======
import { z } from "zod";

export interface ToolMetadata {
  name: string;
  description: string;
  annotations?: {
    title?: string;
    [key: string]: any;
  };
  [key: string]: any;
}

export interface ToolItem {
  path: string;
  name: string;
  metadata: ToolMetadata;
  schema: Record<string, z.ZodType>;
  handler: (args: any) => Promise<any>;
}

export interface ToolRegistryItem {
  description: string;
  inputSchema: z.ZodObject<any>;
  execute: (args: any) => Promise<any>;
}

export type ToolNames = "home";

export type ToolRegistry = {
  [k in ToolNames]: ToolRegistryItem;
};

declare global {
  namespace XMCP {
    interface Tools extends ToolRegistry {}
  }
}

export declare function getTools(): Promise<ToolRegistry>;
export declare const tools: ToolRegistry;
>>>>>>> theirs
