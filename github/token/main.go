package main

import (
	"database/sql"
	"errors"
	"net/http"
	"os"
	"time"
)

func init() {
	db, err := GetDatabase()
	if err != nil {
		panic(err)
	}

	if _, err := db.Exec(
		`
			CREATE TABLE IF NOT EXISTS github_tokens (
				user_id INTEGER PRIMARY KEY AUTOINCREMENT,
				token TEXT NOT NULL,
				updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
				created_at DATETIME DEFAULT CURRENT_TIMESTAMP
			);
		`,
	); err != nil {
		panic(err)
	}
}

func main() {
	if err := saveAccessToken(os.Getenv("GITHUB_ACCESS_TOKEN"), 1); err != nil {
		panic(err)
	}
}

func saveAccessToken(token string, userId int) error {
	println(token)
	if token == "" {
		return errors.New("invalid token")
	}

	req, _ := http.NewRequest("GET", "https://api.github.com/user", nil)
	req.Header.Set("Authorization", "Bearer "+token)

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		return err
	}

	db, err := GetDatabase()
	if err != nil {
		return err
	}

	err = db.QueryRow(
		`
			SELECT true FROM github_tokens WHERE user_id = $1
		`,
		userId,
	).Scan(new(bool))

	if errors.Is(err, sql.ErrNoRows) {
		err = db.QueryRow(`INSERT INTO github_tokens (user_id, token) VALUES ($1, $2) RETURNING user_id`, userId, token).Scan(new(int))
		if err != nil {
			return err
		}
	} 

	if err != nil && !errors.Is(err, sql.ErrNoRows) {
		return err
	}

	err = db.QueryRow(`UPDATE github_tokens SET token = $1, updated_at = $2 WHERE user_id = $3 RETURNING user_id`, token, time.Now().UTC().Format("2006-01-02 15:04:05"), userId).Scan(new(int))
	if err != nil {
		return err
	}

	return nil

}
