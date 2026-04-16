export type ElectionResult = {
    post_title: string;
    total_votes: number;
    results: Array<{ candidate_name: string; vote_received: number; percentage: string, weight: number }>;
};

export type ElectionData = {
    election_title: string;
    election_date: string;
    total_registered_voters: number;
    voter_turnout: number;
    voting_period: string;
    election_results: ElectionResult[];
    ELECTION_VOTE_IS_WEIGHTED: boolean;
};