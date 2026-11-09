import { z } from "zod";

export const SHA256_HEX = /^[0-9a-fA-F]{64}$/;
export const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const confidenceSchema = z.union([
  z.number().min(0).max(1).refine((n) => Number.isFinite(n), {
    message: "confidence must be finite",
  }),
  z.null(),
]);

export const FieldSchema = z
  .object({
    originalText: z.string().min(1, "originalText must be nonempty"),
    value: z.string().min(1, "value must be nonempty"),
    confidence: confidenceSchema,
    source: z
      .object({
        file: z.string().min(1, "source.file must be nonempty"),
        cell: z.string().min(1, "source.cell must be nonempty"),
      })
      .strict(),
    needsReview: z.boolean(),
  })
  .strict();

export const ItemKindSchema = z.enum(["unspecified", "dessert"]);

export const ItemSchema = z
  .object({
    text: FieldSchema,
    kind: ItemKindSchema,
  })
  .strict();

export const OptionSchema = z
  .object({
    text: FieldSchema,
    items: z.array(ItemSchema).min(1, "option must have at least one item"),
  })
  .strict();

export const MealSchema = z
  .object({
    a: OptionSchema,
    b: OptionSchema,
  })
  .strict();

export const DaySchema = z
  .object({
    date: FieldSchema,
    meals: z
      .object({
        breakfast: MealSchema,
        lunch: MealSchema,
        dinner: MealSchema,
      })
      .strict(),
  })
  .strict();

export const ApprovalSchema = z
  .object({
    reviewer: z.string().min(1, "reviewer must be nonempty"),
    approvedAt: z.string().min(1, "approvedAt must be nonempty"),
    menuHash: z.string().regex(SHA256_HEX, "menuHash must be SHA256 hex"),
  })
  .strict();

export const MenuSchema = z
  .object({
    schemaVersion: z.literal(1),
    facility: z.string().regex(/^[a-z][a-z0-9_-]{0,63}$/, "facility must be a stable area ID"),
    week: z.number().int().positive("week must be a positive integer"),
    startDate: z.string().regex(DATE_RE, "startDate must be YYYY-MM-DD"),
    source: z
      .object({
        file: z.string().min(1, "source.file must be nonempty"),
        sha256: z.string().regex(SHA256_HEX, "source.sha256 must be SHA256 hex"),
      })
      .strict(),
    metadata: z
      .object({
        week: FieldSchema,
        startDate: FieldSchema,
        facility: FieldSchema.optional(),
      })
      .strict(),
    days: z.array(DaySchema).length(7, "days must contain exactly 7 entries"),
    revision: z.object({id:z.string().uuid(),parentMenuId:z.string().optional(),createdAt:z.string().datetime()}).strict().optional(),
    approval: z.union([ApprovalSchema, z.null()]),
  })
  .strict();

export type Field = z.infer<typeof FieldSchema>;
export type ItemKind = z.infer<typeof ItemKindSchema>;
export type Item = z.infer<typeof ItemSchema>;
export type Option = z.infer<typeof OptionSchema>;
export type Meal = z.infer<typeof MealSchema>;
export type Day = z.infer<typeof DaySchema>;
export type Approval = z.infer<typeof ApprovalSchema>;
export type Menu = z.infer<typeof MenuSchema>;
