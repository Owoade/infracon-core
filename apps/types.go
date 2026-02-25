package main

type IDeployApplicationWithDocker struct {
	FilePath        string
	ApplicationPort int
	DockerfileName  string
	HostPort        int
}

type IDeployApplicationWithoutDockerfile struct {
	Path            string
	ApplicationType string
	BuildCommand    string
	RunCommand      string
	ApplicationPort int
	HostPort        int
}
