import { z } from "zod";

export const tripFormSchema = z
  .object({
    name: z.string().trim().min(1, "Trip name is required").max(120),
    destination: z.string().trim().max(160),
    startsOn: z.string(),
    endsOn: z.string(),
    timezone: z.string().trim().min(1),
    currency: z.string().trim().length(3).toUpperCase(),
  })
  .refine(
    ({ startsOn, endsOn }) => !startsOn || !endsOn || endsOn >= startsOn,
    { path: ["endsOn"], message: "End date must be on or after the start date" },
  );

export type TripFormValues = z.infer<typeof tripFormSchema>;
