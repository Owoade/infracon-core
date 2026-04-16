import * as Joi from "joi";

export const create_election_schema = Joi.object({
    name: Joi.string().required(), // name is required and must be a string
    election_date: Joi.string().optional(), // election_date is optional and must be a string
});

export const election_post_schema = Joi.object({
    id: Joi.optional(),
    name: Joi.string()
}).required()

export const upsert_election_post = Joi.object({
    id: Joi.number().optional(),                   // id is optional and must be a number
    title: Joi.string().required(),                // title is required and must be a string
    ElectionId: Joi.number().required(),           // ElectionId is required and must be a number            // UserId is required and must be a number
    filter_value: Joi.array().items(Joi.string()).length(1),
    maximum_vote_per_voter: Joi.number().min(1),
});

export const update_election_validator = Joi.object({
    id: Joi.number().integer().required(),
    name: Joi.string(),
    election_date: Joi.string().isoDate(),
    start_time: Joi.string().isoDate(),
    end_time: Joi.string().isoDate(),
    voters_acquisition_channel: Joi.string().valid("form", "csv"),
    election_post_filter_attribute: Joi.string(),
    csv_file: Joi.object({
      id: Joi.string().uuid().required(),
      size: Joi.number().required(),
      link: Joi.string().uri().required()
    })
}).required()

export const upsert_candidate_validator = Joi.object({
    id: Joi.number().optional(),                     // id is optional and must be a number
    ElectionPostId: Joi.number().required(),         // ElectionPostId is required and must be a number
    name: Joi.string().required(),                   // name is required and must be a string
    image: Joi.object({
        link: Joi.string().required(),
        id: Joi.string().required(),
        extension: Joi.string().required()
    }).required(),                     // image is required and can be any type, usually an object
    bio: Joi.string().required(),                    // bio is required and must be a string
    ElectionId: Joi.number().required(),             // ElectionId is required and must be a string
}).required();

export const get_candidates_validator = Joi.object({
    page: Joi.number().default(1),
    per_page: Joi.number().default(50),
    ElectionId: Joi.number().integer().required()
}).required()

export const edit_accreditation_form_validator = Joi.object({

    id: Joi.number().integer().required(), // Ensure it's a primary key
  
    ElectionId: Joi.number().integer().required(), // Make ElectionId required
  
    form_title: Joi.string().allow('', null), // Allow empty string or null for optional title
  
    form_description: Joi.string().allow('', null), // Allow empty string or null for optional description
  
    is_accepting_response: Joi.boolean().required(), // Make is_accepting_response required

  }).required();
  
  export const upsert_accreditation_question_validator = Joi.object({

    id: Joi.number().integer(), // Ensure it's a primary key
  
    label: Joi.string(), // Allow empty string or null for optional label
  
    is_required: Joi.boolean().optional(), // Optional is_required,

    ElectionId: Joi.number().integer().required(),
  
    type: Joi.string().valid('short-answer', 'multiple-choice').optional(), // Validate type
  
    options: Joi.array().items(Joi.string().allow("")).when('type', {
      is: 'multiple-choice',
      then: Joi.required(), // Require options only for multiple-choice questions
    }), // Conditional validation for options

    answer: Joi.string(),

    AccreditationFormId: Joi.number().required()

  });


  export const create_voters_from_form_response_validator = Joi.object({

    email: Joi.string().email().required(),

    data: Joi.object().required(),

    slug: Joi.string().required(),

    accreditation_form_id: Joi.number().required()

  }).required()

  export const create_voters_validator = Joi.object({

    email: Joi.string().email().required(),

    data: Joi.object().required(),

    ElectionId: Joi.number().integer().required()

  }).required()

export const get_election_post_with_candidate_count_validator = Joi.object({
    page: Joi.number().integer().default(1),
    per_page: Joi.number().integer().default(50),
    ElectionId: Joi.number().integer().required()
}).required()

export const get_voters_with_filter_validator = Joi.object({
  page: Joi.number().integer().default(1),
  per_page: Joi.number().integer().default(50),
  ElectionId: Joi.number().integer().required(),
  search: Joi.string(),
  query: Joi.object()
}).required()

export const update_voter_validator = Joi.object({
  voter_id: Joi.number().integer().required(),
  email: Joi.string().email(),
  is_suspended: Joi.boolean(),
  ElectionId: Joi.number().integer().required()
}).required()

export const bulk_operation_validator = Joi.object({
  voter_ids: Joi.array().items(Joi.number().integer().required()),
  type: Joi.string().valid("email", "delete", "activate", "deactivate"),
  ElectionId: Joi.number().integer().required()
}).required()

export const delete_election_post_validator = Joi.object({
  id: Joi.alternatives().try(Joi.number(), Joi.string().regex(/^[0-9]+$/)).required(),
  ElectionId: Joi.alternatives().try(Joi.number(), Joi.string().regex(/^[0-9]+$/)).required(),
}).required()

export const get_distict_voter_data_values_validator = Joi.object({
  key: Joi.string().required(),
  ElectionId: Joi.number().integer().required()
}).required()

export const get_votes_validator = Joi.object({
  ElectionId: Joi.number().integer().required(),
  ElectionPostId: Joi.number().integer().required(),
}).required()

export const get_aggregated_votes_for_candidates_validator = Joi.object({
  CandidateId: Joi.number().integer().required(),
  ElectionId: Joi.number().integer().required(),
  ElectionPostId: Joi.number().integer().required(),
  aggregation_key: Joi.string().required()
}).required()

export const voter_get_votes_validator = Joi.object({
  slug: Joi.string().required(),
  ElectionPostId: Joi.number().integer().required(),
}).required()

export const voter_get_aggregated_votes_for_candidates_validator = Joi.object({
  CandidateId: Joi.number().integer().required(),
  slug: Joi.string().required(),
  ElectionPostId: Joi.number().integer().required(),
  aggregation_key: Joi.string().required()
}).required()

export const get_election_with_user_info_validator = Joi.object({
  
  page: Joi.number().default(1),

  per_page: Joi.number().default(50),

  search: Joi.string(),

  filter: Joi.object({
    status: Joi.string().valid('past','upcoming'),
    UserId: Joi.number()
  })

}).required()

export const toggle_election_result_visibility = Joi.object({
  ElectionId: Joi.number().integer().required(),
  value: Joi.boolean().required()
}).required()
export const toggle_election_mode = Joi.object({
  ElectionId: Joi.number().integer().required(),
  mode: Joi.string().valid('online','hybrid'),
}).required()

export const verify_short_code_validator = Joi.object({
  short_code: Joi.alternatives().try(Joi.number(), Joi.string().regex(/^[0-9]+$/)).required(),
  token: Joi.string().required()
}).required()

export const save_election_result_validator = Joi.object({

  result: Joi.object({
    id: Joi.string().uuid().required(),
    link: Joi.string().uri().required()
  }).required(),

  election_id: Joi.number().integer().required()

}).required()

export const get_accredited_voters_validator = Joi.object({

  slug: Joi.string().required(),

  search_value: Joi.string(),

  filter: Joi.object(),

  page: Joi.number().default(1),

  per_page: Joi.number().default(50)

})

export const send_bulk_emails_validator = Joi.object({
  api_key: Joi.string().required(),
  election_id: Joi.number().required()
}).required()

export const set_election_post_filter_attribute_validator = Joi.object({
  ElectionId: Joi.number().integer().required(),
  filter_attribute: Joi.string().required()
}).required()

export const set_election_post_filter_value_validator = Joi.object({
  ElectionId: Joi.number().integer().required(),
  filter_value: Joi.string().required(),
  ElectionPostId: Joi.number().integer().required()
}).required()



