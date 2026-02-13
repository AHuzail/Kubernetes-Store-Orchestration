import subprocess
import yaml
import logging
import os
from typing import Dict, Any

logger = logging.getLogger(__name__)

class HelmAdapter:
    def __init__(self, kube_config_path: str = None):
        self.kube_config_path = kube_config_path

    def _run_command(self, cmd: list) -> str:
        try:
            result = subprocess.check_output(cmd, stderr=subprocess.STDOUT)
            return result.decode("utf-8")
        except subprocess.CalledProcessError as e:
            logger.error(f"Helm command failed: {e.output.decode('utf-8')}")
            raise Exception(f"Helm command failed: {e.output.decode('utf-8')}")

    def install_or_upgrade(self, release_name: str, chart_path: str, namespace: str, values: Dict[str, Any]):
        # Write values to a temporary file or pass via -f?
        # Better to pass via --values <file>
        # For simplicity in this demo, we can dump to a tmp file.
        import tempfile
        
        with tempfile.NamedTemporaryFile(mode='w', suffix='.yaml', delete=False) as tmp:
            yaml.dump(values, tmp)
            tmp_path = tmp.name

        try:
            helm_timeout = os.getenv("HELM_TIMEOUT", "10m")
            cmd = [
                "helm", "upgrade", "--install", release_name, chart_path,
                "--namespace", namespace,
                "--create-namespace",
                "--values", tmp_path,
                "--wait", # Wait for pods to be ready? Maybe too long for API.
                "--timeout", helm_timeout
            ]
            logger.info(f"Running Helm upgrade for {release_name} in {namespace}")
            self._run_command(cmd)
        finally:
            os.remove(tmp_path)

    def uninstall(self, release_name: str, namespace: str):
        cmd = ["helm", "uninstall", release_name, "--namespace", namespace]
        try:
            self._run_command(cmd)
        except Exception as e:
             # Ignore if not found
            if "release: not found" in str(e):
                return
            logger.warning(f"Helm uninstall failed: {e}")
