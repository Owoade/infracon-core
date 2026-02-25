package main

import (
	"fmt"
	"os"
)

func main() {
	home, _ := os.UserHomeDir()
	err := DeployApplicationWithDockerfile(IDeployApplicationWithDocker{
		FilePath:        fmt.Sprintf("%s/Desktop/growth/infracon-core/apps/samples/with-docker/node", home),
		ApplicationPort: 5000,
		HostPort:        3000,
		DockerfileName:  "Dockerfile",
	})
	if err != nil {
		fmt.Println(err)
	}

	err = DeployApplicationWithoutDockerfile(IDeployApplicationWithoutDockerfile{
		Path:            "samples/without-docker/ruby",
		ApplicationType: "ruby",
		RunCommand:      "ruby server.rb",
		BuildCommand:    "gem install webrick --no-document",
		ApplicationPort: 8000,
		HostPort:        8000,
	})
	if err != nil {
		panic(err)
	}
}
