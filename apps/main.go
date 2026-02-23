package main

import (
	"fmt"
	"os"
)

func main() {
	home, _ := os.UserHomeDir()
	err := DeployApplicationWithDocker(IDeployApplicationWithDocker{
		FilePath:        fmt.Sprintf("%s/Desktop/growth/infracon-core/apps/samples/with-docker/node", home),
		ApplicationPort: 5000,
		DockerfileName:  "Dockerfile",
	})
	if err != nil {
		fmt.Println(err)
	}
}
