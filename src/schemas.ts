import {z} from "zod";

export const SuppportTicketSchema = z.object({
    category:z.enum([
        "authentication",
        "technical",
        "billing",
        "bug",
        "other",
    ]),
    priority: z.enum(["low", "medium","high"]),
    summary: z.string(),
});

export type SupportTicket = z.infer<typeof SuppportTicketSchema>;