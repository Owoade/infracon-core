package main

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"
)

type NginxSetup struct {
	Domains []string
	Port    int
}

func main() {
	SetupNginx(NginxSetup{
		Domains: []string{"smoothballot.com", "checkoutonce.com"},
		Port:    3000,
	})
}

func SetupNginx(p NginxSetup) error {
	configDir := "configs"
	file, err := os.OpenFile(
		filepath.Join(configDir, p.Domains[0]),
		os.O_CREATE|os.O_WRONLY|os.O_TRUNC,
		0644,
	)

	if err != nil {
		return err
	}

	defer file.Close()

	nginxContent := []string{}
	nginxContent = append(nginxContent, "server {\n")
	nginxContent = append(nginxContent, fmt.Sprintf("\tlisten %d;\n", 80))
	nginxContent = append(nginxContent, fmt.Sprintf("\tserver_name %s;\n", strings.Join(p.Domains, " ")))
	nginxContent = append(nginxContent, "\n")
	nginxContent = append(nginxContent, "\tlocation / {\n")
	nginxContent = append(nginxContent, fmt.Sprintf("\t\tproxy_pass http://localhost:%d;\n", p.Port))
	nginxContent = append(nginxContent, "\t\tproxy_http_version 1.1;\n")
	nginxContent = append(nginxContent, "\n")
	nginxContent = append(nginxContent, "\t\tproxy_set_header Upgrade $http_upgrade;\n")
	nginxContent = append(nginxContent, fmt.Sprintf(`%sproxy_set_header Connection "upgrade";%s`, "\t\t", "\n"))
	nginxContent = append(nginxContent, "\t\tproxy_set_header Host $host;\n")
	nginxContent = append(nginxContent, "\n")
	nginxContent = append(nginxContent, "\t\tproxy_cache_bypass $http_upgrade;\n")
	nginxContent = append(nginxContent, "\t}\n")
	nginxContent = append(nginxContent, "}\n")

	for _, line := range nginxContent {
		if _, err := file.WriteString(line); err != nil {
			return err
		}
	}

	return nil
}
