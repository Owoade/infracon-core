export interface JobModelInterface {
  id?: number; // Assuming primary_key() translates to a number
  payload: object; // Assuming jsonb() translates to a generic object
  cancellation_reason?: string;
  status: 'pending' | 'done' | 'failed'; // Enum with specific string values
  Userid: number;
  _election_id?: number;
  type: "voters-population" | "voters-auth" | 'send-result' | "contest-revenue-report-generation";
}
