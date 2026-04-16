package main

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os"
)

type FetchRepoParams struct {
	Page      int
	PerPage   int
	Sort      string
	Direction string
}

type FetchGithubRepoAPIResponse struct {
	ID      int    `json:"id"`
	Name    string `json:"name"`
	Private bool   `json:"private"`
	Owner   struct {
		Login string `json:"login"`
	} `json:"owner"`
	DefaultBranch string `json:"default_branch"`
}

func main() {
	repos, err := fetchRepo(os.Getenv("GITHUB_ACCESS_TOKEN"), FetchRepoParams{})
	if err != nil {
		panic(err)
	}
	fmt.Println(repos)
}

func fetchRepo(accessToken string, params FetchRepoParams) ([]FetchGithubRepoAPIResponse, error) {
	fmt.Println(accessToken)
	if params.Page == 0 {
		params.Page = 1
	}

	if params.PerPage == 0 {
		params.PerPage = 100
	}

	if params.Sort == "" {
		params.Sort = "pushed"
	}

	if params.Direction == "" {
		params.Direction = "desc"
	}

	url := fmt.Sprintf("https://api.github.com/user/repos?page=%d&per_page=%d&sort=%s&direction=%s", params.Page, params.PerPage, params.Sort, params.Direction)
	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return nil, err
	}

	req.Header.Set("Accept", "application/vnd.github+json")
	req.Header.Set("Authorization", "Bearer "+accessToken)
	req.Header.Set("X-GitHub-Api-Version", "2022-11-28")

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		return nil, err
	}

	var repos []FetchGithubRepoAPIResponse
	if err := json.NewDecoder(resp.Body).Decode(&repos); err != nil {
		return nil, err
	}

	return repos, nil
}
