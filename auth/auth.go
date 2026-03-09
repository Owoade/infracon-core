package main

import (
	"database/sql"
	"errors"
	"os"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/joho/godotenv"
	"golang.org/x/crypto/bcrypt"
)

func SignUp(db *sql.DB, p SignUpPayload) (string, error) {
	setupKey, err := getSetupKey()
	if err != nil {
		return "", err
	}

	if setupKey != p.SetupKey {
		return "", errors.New("invalid set up key")
	}

	var r UserRow
	err = db.QueryRow(
		`
			SELECT id FROM users WHERE email = $1	
		`,
		p.Email,
	).Scan(&r.UserId)

	if err == nil {
		return "", errors.New("user already exists")
	} else if !errors.Is(err, sql.ErrNoRows) {
		return "", err
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(p.Password), bcrypt.DefaultCost)
	if err != nil {
		return "", err
	}
	p.Password = string(hash)

	var id int

	if err := db.QueryRow(
		`
			INSERT INTO users (email, password) VALUES ($1, $2) RETURNING id;	
		`,
		p.Email,
		p.Password,
	).Scan(&id); err != nil {
		return "", err
	}

	token, err := generateJwtToken(id)
	if err != nil {
		return "", err
	}

	return token, nil
}

func SignIn(db *sql.DB, p SignInPayload) (string, error) {
	var r UserRow
	err := db.QueryRow(
		`
			SELECT id, password FROM users WHERE email = $1	
		`,
		p.Email,
	).Scan(&r.UserId, &r.Password)

	if err != nil {
		return "", err
	}

	err = bcrypt.CompareHashAndPassword([]byte(r.Password), []byte(p.Password))
	if err != nil {
		return "", err
	}

	return generateJwtToken(r.UserId)
}

func ForgotPassword(db *sql.DB, p ForgotPasswordPayload) error {
	setupKey, err := getSetupKey()
	if err != nil {
		return err
	}

	if setupKey != p.SetupKey {
		return errors.New("invalid set up key")
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(p.NewPassword), bcrypt.DefaultCost)
	if err != nil {
		return err
	}
	p.NewPassword = string(hash)

	var tmp int
	return db.QueryRow("UPDATE users SET password = $1 RETURNING 1", p.NewPassword).Scan(&tmp)
}

func getSetupKey() (string, error) {
	data, err := os.ReadFile("setup-key.txt")
	if err != nil {
		return "", err
	}

	return string(data), nil
}

func generateJwtToken(userID int) (string, error) {
	if err := godotenv.Load(); err != nil {
		return "", err
	}

	secretKey := os.Getenv("JWT_SECRET")
	if secretKey == "" {
		return "", errors.New("secret key not set")
	}

	claims := jwt.MapClaims{
		"user_id": userID,
		"exp":     time.Now().Add(time.Hour * 24).Unix(),
		"iat":     time.Now().Unix(),
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)

	tokenString, err := token.SignedString([]byte(secretKey))
	return tokenString, err
}
