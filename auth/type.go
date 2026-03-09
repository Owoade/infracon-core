package main

type SignUpPayload struct {
	Email    string
	Password string
	SetupKey string
}

type SignInPayload struct {
	Email    string
	Password string
}

type ForgotPasswordPayload struct {
	SetupKey    string
	NewPassword string
}

type UserRow struct {
	UserId   int    `json:"id"`
	Email    string `json:"email"`
	Password string `json:"password"`
}
