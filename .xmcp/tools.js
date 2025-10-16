import { z } from "zod";

import * as tool0 from "../src/tools/home.ts";

/** 
 * Runtime-accessible tools function that works from any context.
 * Generated at build time - always up to date with discovered tools.
 * @returns {Promise<ToolRegistry>}
 */
export async function getTools() {
  const toolsData = [
    {
          path: "src/tools/home.ts",
          name: "home",
          module: tool0
        }
  ];

  const registry = {};

  for (const toolData of toolsData) {
    const { path, name: defaultName, module } = toolData;
    const { default: handler, metadata, schema } = module;

    const toolConfig = {
      name: defaultName,
      description: "No description provided",
      ...((typeof metadata === "object" && metadata !== null) ? metadata : {})
    };

    // Determine the actual schema to use
    let toolSchema = {};
    if (schema && typeof schema === "object" && schema !== null) {
      // Basic validation for Zod schema object
      const isValidSchema = Object.entries(schema).every(([key, val]) => {
        if (typeof key !== "string") return false;
        if (typeof val !== "object" || val === null) return false;
        if (!("parse" in val) || typeof val.parse !== "function") return false;
        return true;
      });
      
      if (isValidSchema) {
        toolSchema = schema;
      } else {
        console.warn(`Invalid schema for tool "${toolConfig.name}" at ${path}. Expected Record<string, z.ZodType>`);
      }
    }

    // Make sure tools has annotations with a title
    if (toolConfig.annotations === undefined) {
      toolConfig.annotations = {};
    }
    if (toolConfig.annotations.title === undefined) {
      toolConfig.annotations.title = toolConfig.name;
    }

    // Add to registry in the formatted structure
    registry[toolConfig.name] = {
      description: toolConfig.description,
      inputSchema: z.object(toolSchema || {}),
      execute: async (args, extra) => {
        const result = await handler(args, extra);
        return result;
      },
    };
  }

  return registry;
}

export const tools = await getTools();