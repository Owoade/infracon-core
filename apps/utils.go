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

func Map[T comparable](arr []T, cb func(T) T) []T {
	newArr := []T{}
	for _, each := range arr {
		mappedValue := cb(each)
		newArr = append(newArr, mappedValue)
	}
	return newArr
}
