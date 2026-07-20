import { z } from "zod";

export const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9_-]+$/, "Use lowercase letters, numbers, underscores, or hyphens")
  .min(3, "Username must be at least 3 characters")
  .max(24, "Username must be at most 24 characters");
