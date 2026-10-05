import { z } from "zod";

export const updateCurrentUserSchema = z
    .object({
        name: z.string().trim().min(1).max(100).optional(),
        email: z
            .email()
            .trim()
            .max(255)
            .transform((email) => email.toLowerCase())
            .optional(),
    })
    .strict()
    .refine((input) => input.name !== undefined || input.email !== undefined, {
        message: "At least one profile field must be provided.",
    });

export type UpdateCurrentUserInput = z.infer<typeof updateCurrentUserSchema>;
