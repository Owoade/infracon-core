package main

import (
	"archive/zip"
	"bytes"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
)

type PullfromGithub struct {
	Owner       string
	Repo        string
	Ref         string
	AccessToken string
}

func main() {
	commitHash, err := pullFromGithub(PullfromGithub{
		Repo:        "SMOOTH-BALLOT-BE",
		Ref:         "main",
		Owner:       "BAMSSA-DEVS",
		AccessToken: os.Getenv("GITHUB_ACCESS_TOKEN"),
	})

	if err != nil {
		panic(err)
	}

	fmt.Println("commit hash: ", commitHash)
}

func pullFromGithub(p PullfromGithub) (commitHash string, err error) {
	if p.AccessToken == "" {
		return "", errors.New("GITHUB_ACCESS_TOKEN is not set")
	}

	url := fmt.Sprintf("https://api.github.com/repos/%s/%s/zipball/%s", p.Owner, p.Repo, p.Ref)

	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return "", err
	}

	req.Header.Set("Accept", "application/vnd.github+json")
	req.Header.Set("Authorization", "Bearer "+p.AccessToken)
	req.Header.Set("X-GitHub-Api-Version", "2022-11-28")

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		return "", err
	}

	var buf bytes.Buffer
	size, err := io.Copy(&buf, resp.Body)
	if err != nil {
		return "", err
	}

	r, err := zip.NewReader(bytes.NewReader(buf.Bytes()), size)
	if err != nil {
		return "", err
	}

	for _, f := range r.File {
		dest := filepath.Join("extracts", "")
		fpath := filepath.Join(dest, f.Name)

		if !strings.HasPrefix(fpath, filepath.Clean(dest)+string(os.PathSeparator)) {
			return "", fmt.Errorf("illegal file path: %s", fpath)
		}

		if f.FileInfo().IsDir() {
			os.MkdirAll(fpath, os.ModePerm)
			continue
		}

		if err := os.MkdirAll(filepath.Dir(fpath), os.ModePerm); err != nil {
			return "", err
		}

		inFile, err := f.Open()
		if err != nil {
			return "", err
		}

		outFile, err := os.OpenFile(fpath, os.O_WRONLY|os.O_CREATE|os.O_TRUNC, f.Mode())
		if err != nil {
			inFile.Close()
			return "", err
		}

		_, err = io.Copy(outFile, inFile)
		inFile.Close()
		outFile.Close()
		if err != nil {
			return "", err
		}
	}

	return r.Comment, nil
}
