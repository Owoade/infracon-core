package main

import (
	"fmt"
)

func main() {
	err := DeployApplicationWithDockerfile(IDeployApplicationWithDocker{
		FilePath:        "samples/with-docker/smooth-be",
		ApplicationPort: 3000,
		HostPort:        3000,
		DockerfileName:  "Dockerfile",
	})
	if err != nil {
		fmt.Println(err)
	}

	// err = DeployApplicationWithoutDockerfile(IDeployApplicationWithoutDockerfile{
	// 	Path:            "samples/without-docker/ruby",
	// 	ApplicationType: "ruby",
	// 	RunCommand:      "ruby server.rb",
	// 	BuildCommand:    "gem install webrick --no-document",
	// 	ApplicationPort: 8000,
	// 	HostPort:        8000,
	// })
	// if err != nil {
	// 	panic(err)
	// }
}
