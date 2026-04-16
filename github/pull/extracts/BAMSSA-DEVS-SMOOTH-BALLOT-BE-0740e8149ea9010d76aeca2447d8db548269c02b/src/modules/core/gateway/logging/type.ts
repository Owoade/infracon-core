export interface LogModelInterface {
    UserId: number;
    type: "election" | "billing" | "auth";
    description: string;
}

export interface GetLogs {
    UserId: number,
    date?: {
        from: string,
        to: string;
    },
    page: number,
    per_page: number;
}