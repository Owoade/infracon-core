package main

import (
	"bufio"
	"errors"
	"fmt"
	"os"
	"strings"
)

func DeployApplicationWithoutDockerfile(p IDeployApplicationWithoutDockerfile) error {
	if err := generateDockerFile(p); err != nil {
		return err
	}

	err := DeployApplicationWithDockerfile(IDeployApplicationWithDocker{
		ApplicationPort: p.ApplicationPort,
		DockerfileName:  "Dockerfile.ic",
		HostPort:        8000,
		FilePath:        p.Path,
	})

	if err != nil {
		return err
	}

	return nil
}

func generateDockerFile(p IDeployApplicationWithoutDockerfile) error {
	dockerImage := dockerImageMap[p.ApplicationType]
	if dockerImage == "" {
		return errors.New("appication not supported")
	}

	content := []string{}
	content = append(content, fmt.Sprintf("FROM %s\n", dockerImage))
	content = append(content, "WORKDIR /app\n")
	content = append(content, "COPY . .\n")
	if p.BuildCommand != "" {
		content = append(content, fmt.Sprintf("RUN %s\n", p.BuildCommand))
	}
	content = append(content, fmt.Sprintf("EXPOSE %d\n", p.ApplicationPort))
	content = append(
		content,
		fmt.Sprintf(
			"CMD [%s]\n",
			strings.Join(
				Map(
					strings.Split(p.RunCommand, " "),
					func(cmd string) string {
						return fmt.Sprintf(`"%s"`, cmd)
					},
				),
				", ",
			),
		))

	file, err := os.Create(fmt.Sprintf("%s/Dockerfile.ic", p.Path))
	if err != nil {
		return err
	}
	defer file.Close()

	writter := bufio.NewWriter(file)
	for _, line := range content {
		writter.WriteString(line)
	}
	writter.Flush()

	return nil
}
