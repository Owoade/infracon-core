package main

import (
	"archive/tar"
	"bytes"
	"context"
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strconv"
	"time"

	"github.com/docker/docker/api/types"
	"github.com/docker/docker/api/types/container"
	"github.com/docker/docker/client"
	"github.com/docker/go-connections/nat"
)

func DeployApplicationWithDocker(payload IDeployApplicationWithDocker) error {
	if !PathExists(payload.FilePath, "folder") {
		return errors.New("applications folder doesn't exist")
	}

	dockerFilePath := fmt.Sprintf("%s/%s", payload.FilePath, payload.DockerfileName)
	if !PathExists(dockerFilePath, "file") {
		return errors.New("docker file doesn't exist")
	}

	cli, err := client.NewClientWithOpts(client.FromEnv, client.WithAPIVersionNegotiation())
	if err != nil {
		return err
	}
	defer cli.Close()

	buildContext, err := createBuildContext(payload.FilePath)
	if err != nil {
		return err
	}

	imageName := fmt.Sprintf("infracon-app-test-%d:latest", time.Now().UnixMilli())
	resp, err := cli.ImageBuild(context.Background(), buildContext, types.ImageBuildOptions{
		Tags:       []string{imageName},
		Dockerfile: "Dockerfile",
		Remove:     true,
	})
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if _, err = io.Copy(os.Stdout, resp.Body); err != nil {
		return err
	}

	containerPort, _ := nat.NewPort("tcp", strconv.Itoa(payload.ApplicationPort))
	hostConfig := &container.HostConfig{
		PortBindings: nat.PortMap{
			containerPort: []nat.PortBinding{
				{
					HostIP:   "0.0.0.0",
					HostPort: "3000",
				},
			},
		},
	}

	containerConfig := &container.Config{
		Image: imageName,
		Env: []string{
			"APP_ENV=production",
		},
		ExposedPorts: nat.PortSet{
			containerPort: struct{}{},
		},
	}

	containerBuildResponse, err := cli.ContainerCreate(
		context.Background(),
		containerConfig,
		hostConfig,
		nil,
		nil,
		fmt.Sprintf("infracon-container-%d", time.Now().UnixMilli()),
	)

	if err != nil {
		return err
	}

	if err := cli.ContainerStart(context.Background(), containerBuildResponse.ID, container.StartOptions{}); err != nil {
		return err
	}

	fmt.Printf("Container started successfully\n")

	return nil

}

func createBuildContext(dir string) (io.Reader, error) {
	buf := new(bytes.Buffer)
	tw := tar.NewWriter(buf)
	defer tw.Close()

	err := filepath.Walk(dir, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}

		header, err := tar.FileInfoHeader(info, "")
		if err != nil {
			return err
		}

		relPath, _ := filepath.Rel(dir, path)
		header.Name = relPath

		if err := tw.WriteHeader(header); err != nil {
			return err
		}

		if info.Mode().IsRegular() {
			file, err := os.Open(path)
			if err != nil {
				return err
			}
			defer file.Close()
			_, err = io.Copy(tw, file)
			return err
		}

		return nil
	})

	return buf, err
}
