export type SupportTicket = {
    category: 
    | "authentication"
    | "technical"
    | "billing"
    | "bug"
    | "other";
    priority:
    | "low"
    | "medium"
    | "high";
    summary: string;
}