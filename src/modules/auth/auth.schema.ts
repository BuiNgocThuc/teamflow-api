import { z } from "zod";

export const registerSchema = z.object({
    name: z.string().trim().min(1).max(100),
    email: z
        .email()
        .trim()
        .max(255)
        .transform((email) => email.toLowerCase()),
    password: z.string().min(8).max(128),
});

export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
    email: z
        .email()
        .trim()
        .max(255)
        .transform((email) => email.toLowerCase()),
    password: z.string().min(1).max(128),
});

export type LoginInput = z.infer<typeof loginSchema>;
