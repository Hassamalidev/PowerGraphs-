import { z } from "zod";
import { chartConfigSchema } from "@/lib/chart/config";
import { MAX_INTRO, MAX_MEETING_NOTES } from "@/lib/theme";

export const contactSchema = z.object({
  name: z.string().trim().min(1, "Please enter a name.").max(100, "That name is too long."),
  email: z.email("Please enter a valid email address.").max(200, "That email address is too long."),
  group: z
    .string()
    .trim()
    .max(60, "That group name is too long.")
    .nullish()
    .transform((g) => g || null),
});

export const savedChartSchema = z.object({
  title: z.string().trim().min(1, "Please give the chart a title.").max(300, "That title is too long."),
  config: chartConfigSchema,
  topText: z.string().max(5000, "The statistics text is too long."),
  bottomText: z.string().max(MAX_MEETING_NOTES, "The notes are too long."),
  imagePng: z
    .string()
    .min(1, "The chart picture is missing.")
    .max(8_000_000, "The chart picture is too large."),
  dataAsOf: z.iso.datetime({ offset: true }).or(z.iso.date()),
});

const dateOrNull = z
  .string()
  .nullish()
  .transform((v) => v || null)
  .refine((v) => v === null || !Number.isNaN(Date.parse(v)), "Please enter a valid meeting date.");

export const reportCreateSchema = z.object({
  title: z.string().trim().min(1, "Please give the report a title.").max(200, "That title is too long."),
});

export const reportUpdateSchema = z.object({
  title: z.string().trim().min(1, "Please give the report a title.").max(200, "That title is too long.").optional(),
  meetingDate: dateOrNull.optional(),
  preparedBy: z.string().trim().max(120, "That name is too long.").nullish(),
  intro: z.string().max(MAX_INTRO, `The introduction can be at most ${MAX_INTRO} characters.`).nullish(),
});

export const reportItemSchema = z.object({ chartId: z.string().min(1) });
export const reportOrderSchema = z.object({ itemIds: z.array(z.string().min(1)) });

const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;

export const emailSchema = z.object({
  recipients: z
    .array(z.email("One of the email addresses is not valid. Please check it."))
    .min(1, "Please choose at least one person to send to.")
    .max(50, "You can send to at most 50 people at a time."),
  subject: z.string().trim().min(1, "Please enter a subject.").max(200, "That subject is too long."),
  message: z.string().max(5000, "That message is too long."),
  pdfBase64: z
    .string()
    .min(1, "The PDF attachment is missing.")
    .refine((s) => (s.length * 3) / 4 <= MAX_ATTACHMENT_BYTES, "The attachment is larger than 10 MB. Try a report with fewer charts."),
  filename: z.string().trim().min(1).max(200),
});

export const loginSchema = z.object({ password: z.string().min(1, "Please enter the password.") });
