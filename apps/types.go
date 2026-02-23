package main

type IDeployApplicationWithDocker struct {
	FilePath        string
	ApplicationPort int
	DockerfileName  string
}
