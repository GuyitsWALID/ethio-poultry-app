import {z} from "zod";

export const branchStructureInput = z.object({
  request_id: z.string().uuid(),
  branch: z.object({name: z.string().trim().min(1).max(120), location: z.string().trim().max(300).default("")}).strict(),
  manager_id: z.string().uuid().nullable().default(null),
  farms: z.array(z.object({
    name: z.string().trim().min(1).max(120),
    houses: z.array(z.object({
      name: z.string().trim().min(1).max(120), capacity: z.number().int().positive().max(10000000),
      house_type: z.enum(["layer", "broiler", "rearing", "parent_stock"]),
    }).strict()).min(1).max(100),
  }).strict()).min(1).max(20),
}).strict();
