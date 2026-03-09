package main

import (
	"crypto/rand"
	"encoding/base64"
	"os"

	"github.com/joho/godotenv"
)

func generateSetupKeyFile() error {
	fileName := "setup-key.txt"
	if _, err := os.Stat(fileName); err == nil {
		return nil
	}

	bytes := make([]byte, 16)
	_, err := rand.Read(bytes)
	if err != nil {
		return err
	}

	key := base64.URLEncoding.EncodeToString(bytes)
	return os.WriteFile(fileName, []byte(key), 0600)
}

func init() {
	godotenv.Load()
	generateSetupKeyFile()
	db, err := GetDatabase()
	if err != nil {
		panic(err)
	}
	db.Exec(
		`
			CREATE TABLE IF NOT EXISTS users (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				email TEXT NOT NULL UNIQUE,
				password TEXT NOT NULL,
				created_at DATETIME DEFAULT CURRENT_TIMESTAMP
			);
		`,
	)

}

func main() {
	db, err := GetDatabase()
	if err != nil {
		panic(err)
	}

	token, err := SignIn(db, SignInPayload{
		Email:    "owoadeanu@yahoo.com",
		Password: "ayoade123",
	})

	err = ForgotPassword(db, ForgotPasswordPayload{
		NewPassword: "ayoade123",
		SetupKey:    "4AiQs98u6lmfgjKTurf_fQ==",
	})

	token, err = SignUp(db, SignUpPayload{
		Email:    "owoadeanu@yahoo.com",
		Password: "owoadeanu",
		SetupKey: "4AiQs98u6lmfgjKTurf_fQ==",
	})

	if err != nil {
		panic(err)
	}

	println(token)
}
