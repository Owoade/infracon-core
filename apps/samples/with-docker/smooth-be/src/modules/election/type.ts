import { UserModelInterface } from "@modules/user/type";

export interface ElectionModelInrterface {
    id?: number; // Assuming primary_key() resolves to a number type
    name: string;
    slug: string;
    election_date?: string; // Optional string
    UserId: number;
    voters_acquisition_channel?: "csv" | "form"; // Corrected "chennel" to "channel"
    start_time: string;
    end_time: string;
    broadcast_date?: string,
    is_disabled?: boolean;
    has_sent_broadcast?: boolean,
    csv_file?: {
        id: string;
        link: string;
    }
    indexed_voters_attributes?: string[],
    result:  {
        id: string;
        link: string;
    }
    result_is_visible?: boolean;
    mode?: "online" | "hybrid";
    election_post_filter_attribute?: string;
    election_vote_weight_attribute?: string;
    hide_result_link?: boolean;
    search_attribute?: string;
}

export interface ElectionPostModelInterface {
    id? : number;          // Assuming schema_type.primary_key() resolves to a number
    title: string;       // schema_type.string() resolves to a string
    ElectionId: number;  // schema_type.int() resolves to a number
    slug: string;        // schema_type.string() resolves to a string
    UserId: number;      // schema_type.int() resolves to a number; 
    filter_value?: string[],
    maximum_vote_per_voter?: number;
}

export interface CandidateModelInterface {
    id?: number;             // Assuming schema_type.primary_key() resolves to a number and is optional
    ElectionPostId: number;  // schema_type.int() resolves to a number
    name: string;            // schema_type.string() resolves to a string
    image: {
        link: string;
        id: string;
        extension: string;
    };                        // schema_type.jsonb() resolves to any type, usually an object
    bio: string;             // schema_type.long_text() resolves to a string
    ElectionId: number;      // schema_type.string() resolves to a string
    UserId: number;          // schema_type.int() resolves to a number
}

export interface VoterModelInterface {
    id?: number;
    ElectionId: number,
    UserId: number,
    email: string;
    password: string;
    is_suspended: boolean;
    _job_id?: number;
    has_voted?: boolean; 
    email_sent?: number
    data: {},
    has_sent_voters_auth_credential?: boolean;
}

export interface VoteModelInterface {
    id?: number; // Assuming primary_key() returns a number
    UserId: number;
    VoteProfileId: number;
    VoterId: number;
    voter_email: string;
    voter_data: Record<string, any>; // Assuming jsonb() returns a JSON object
    ElectionId: number;
    CandidateId?: number;
    candidate_name?: string;
    candidate_photo?: string;
    ElectionPostId: number;
    election_post_title: string;
    weight?: number;
}

export interface VoteProfileModelInterface {
    id?: number; // Assuming primary_key() returns a number
    election_title: string;
    election_date: string;
    start_time: string;
    ElectionId: number;
    UserId: number;
    user_email: string;
    user_first_name: string;
    user_last_name: string;
}


export interface AccreditationFormModelInterface {
    id?: number; // primary key
    ElectionId: number;
    form_title?: string;
    form_description?: string; // long text
    is_accepting_response: boolean;
    UserId: number;
    labels?: string[];
}

export interface AccreditationFormQuestionModelInterface {
    id?: number; // primary key
    label?: string;
    is_required?: boolean;
    type?: "short-answer" | "multiple-choice";
    options?: string[];
    ElectionId: number;
    AccreditationFormId: number;
    UserId: number;
}

export interface GetPaginatedCandidates {
    page: number;
    per_page: number;
    ElectionId: number;
}

export interface GetVotersWithFilter {
    page: number,
    per_page: number,
    filter: Partial<VoterModelInterface>,
    search?: string;
    query?: Record<string, string>
}

export type GetVotersWithFilterServicePayload =  GetVotersWithFilter & Partial<Pick<VoterModelInterface, 'ElectionId' | 'UserId'>>

export interface BulkOperationPayload {
    voter_ids: number[];
    type: "email" | "delete" | "activate" | "deactivate",
    UserId: number;
    ElectionId: number;
}

export interface SendBulkEmails {
    voters: ({toJSON(): VoterModelInterface})[],
    voters_count: number;
    election: any,
    UserId: number,
    ElectionId: number;
}

export type ElectionAuthPayload = Pick<ElectionModelInrterface, 'id' | 'UserId' >; 

export interface CreateVotersFromAccreditationForm {
    slug: string;
    voter: VoterModelInterface
}

export interface CreateVotersFromAccreditationFormWithShortCode {
    short_code: string,
    voter: VoterModelInterface
}

export interface AuthenticateVoters {
    email: string;
    password: string;
    slug: string;
}

export interface CastVote {
    votes: Vote[]
}

export interface Vote {
    ElectionPostId: number;
    CandidateId: number
}

export interface ProcessVote {
    votes: Vote[],
    voter: VoterModelInterface
}

export interface GetVotersDistinctDataValues {
    key: string; 
    filter: Partial<VoterModelInterface>
}

export interface DeleteElectionPost {
    ElectionId: number,
    UserId: number;
    ElectionPostId: number
}

export interface GetAggregatedVotesForVoters
    extends Pick<VoteModelInterface, 'CandidateId' | 'ElectionPostId'> {
        slug: ElectionModelInrterface['slug'],
        aggregation_key: string;
    }

export interface GetIndexedAttributeDistinctValues {
    election_id: number;
    user_id: number;
    indexed_fields: string[];
}

export interface GetElectionsWithUserInfo {
    filter?: Partial<ElectionModelInrterface> & { status: "upcoming" | "past" },
    attributes?: (keyof ElectionModelInrterface)[]
    user_attributes?: (keyof UserModelInterface)[]
    search?: string;
    page: number;
    per_page: number;
}

export interface VoteAuditLogModelInterface {
    _id: string;
    payload: {
        votes: Pick<VoteModelInterface, 'CandidateId' | 'ElectionPostId'>[],
        voter: VoterModelInterface
    },
    ElectionId: number;
}

export interface SendResultFlag {
    initiated_by_superadmin: boolean;
}

export interface GetAccreditedVoters {
    search_value?: string;
    slug: string;
    filter:Array<Record<string, string>>,
    search_key: string,
    page?: number,
    per_page?: number,
    election_id: number
}
