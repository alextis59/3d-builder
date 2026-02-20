import { z } from "zod";

const numberTuple = <Len extends 3 | 4>(len: Len) =>
  z.array(z.number().finite()).length(len) as unknown as z.ZodType<
    Len extends 3 ? [number, number, number] : [number, number, number, number]
  >;

export const nodePathTargetSchema = z.object({
  kind: z.literal("nodePath"),
  path: z.string().min(1)
});

export const materialNameTargetSchema = z.object({
  kind: z.literal("materialName"),
  name: z.string().min(1)
});

export const transformSchema = z
  .object({
    translation: numberTuple(3).optional(),
    rotation: numberTuple(4).optional(),
    scale: numberTuple(3).optional()
  })
  .strict()
  .refine(
    (value) => value.translation !== undefined || value.rotation !== undefined || value.scale !== undefined,
    "At least one of translation/rotation/scale must be provided"
  );

export const nodeSetTransformOpSchema = z
  .object({
    op: z.literal("node.setTransform"),
    target: nodePathTargetSchema,
    value: transformSchema
  })
  .strict();

export const nodeSetVisibleOpSchema = z
  .object({
    op: z.literal("node.setVisible"),
    target: nodePathTargetSchema,
    value: z.object({ visible: z.boolean() }).strict()
  })
  .strict();

export const nodeRenameOpSchema = z
  .object({
    op: z.literal("node.rename"),
    target: nodePathTargetSchema,
    value: z.object({ name: z.string().min(1) }).strict()
  })
  .strict();

export const materialSetBaseColorFactorOpSchema = z
  .object({
    op: z.literal("material.setBaseColorFactor"),
    target: materialNameTargetSchema,
    value: numberTuple(4)
  })
  .strict();

export const pbrPatchSchema = z
  .object({
    metallicFactor: z.number().finite().optional(),
    roughnessFactor: z.number().finite().optional(),
    emissiveFactor: numberTuple(3).optional()
  })
  .strict()
  .refine(
    (value) => value.metallicFactor !== undefined || value.roughnessFactor !== undefined || value.emissiveFactor !== undefined,
    "At least one PBR field must be provided"
  );

export const materialSetPbrOpSchema = z
  .object({
    op: z.literal("material.setPBR"),
    target: materialNameTargetSchema,
    value: pbrPatchSchema
  })
  .strict();

export const opSchema = z.discriminatedUnion("op", [
  nodeSetTransformOpSchema,
  nodeSetVisibleOpSchema,
  nodeRenameOpSchema,
  materialSetBaseColorFactorOpSchema,
  materialSetPbrOpSchema
]);

export const opsDocSchema = z
  .object({
    version: z.literal(1),
    ops: z.array(opSchema)
  })
  .strict();

export const exportPresetSchema = z.enum(["raw-edit", "preview-web"]);
export const exportFormatSchema = z.enum(["glb", "gltf"]);

export const exportRequestSchema = z
  .object({
    assetPath: z.string().min(1),
    outPath: z.string().min(1),
    format: exportFormatSchema.optional(),
    preset: exportPresetSchema.optional(),
    overwrite: z.boolean().optional(),
    ops: opsDocSchema.optional()
  })
  .strict();

export type NodePathTarget = z.infer<typeof nodePathTargetSchema>;
export type MaterialNameTarget = z.infer<typeof materialNameTargetSchema>;
export type Transform = z.infer<typeof transformSchema>;
export type PbrPatch = z.infer<typeof pbrPatchSchema>;
export type Op = z.infer<typeof opSchema>;
export type OpsDoc = z.infer<typeof opsDocSchema>;
export type ExportPreset = z.infer<typeof exportPresetSchema>;
export type ExportFormat = z.infer<typeof exportFormatSchema>;
export type ExportRequest = z.infer<typeof exportRequestSchema>;
