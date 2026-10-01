import { z } from "zod";
import { MAX_DATASETS, MAX_NOTE_LENGTH, MAX_NOTES } from "@/lib/theme";

const posSchema = z.object({ x: z.number(), y: z.number() });

export const labelSchema = z.object({
  datasetId: z.string(),
  anchorDate: z.string().nullable(), // null = latest visible point
  pos: posSchema.nullable(), // percent of plot area; null = placed automatically
});

export const noteSchema = z.object({
  id: z.string(),
  datasetId: z.string(),
  anchorDate: z.string(),
  text: z.string().max(MAX_NOTE_LENGTH),
  pos: posSchema.nullable(),
});

export const chartConfigSchema = z.object({
  datasets: z.array(z.string()).min(1).max(MAX_DATASETS), // catalog ids, in slot order
  view: z.enum(["monthly", "quarterly"]),
  range: z.object({ from: z.string(), to: z.string() }), // "YYYY-MM" or "YYYY-Q1"
  statsMode: z.enum(["summary", "trend", "relationship", "none"]),
  percentChangeMode: z.boolean(),
  title: z.string(),
  titleEdited: z.boolean(),
  topTextEdited: z.boolean(),
  labels: z.array(labelSchema),
  notes: z.array(noteSchema).max(MAX_NOTES),
});

export type ChartConfig = z.infer<typeof chartConfigSchema>;
export type LabelState = z.infer<typeof labelSchema>;
export type NoteState = z.infer<typeof noteSchema>;
export type Pos = z.infer<typeof posSchema>;
