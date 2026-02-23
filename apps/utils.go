package main

import "os"

func PathExists(path string, as string) bool {
	info, err := os.Stat(path)
	if err != nil {
		return false
	}
	if as == "folder" {
		return info.IsDir()
	}
	return !info.IsDir()
}
