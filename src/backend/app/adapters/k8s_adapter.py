from kubernetes import client, config
from kubernetes.client.rest import ApiException
import logging

logger = logging.getLogger(__name__)

class K8sAdapter:
    def __init__(self):
        try:
            config.load_incluster_config()
            logger.info("Loaded in-cluster config")
        except config.ConfigException:
            try:
                config.load_kube_config()
                logger.info("Loaded kube-config")
            except config.ConfigException:
                logger.warning("Could not load K8s config. usage might fail.")

        self.core_v1 = client.CoreV1Api()
        self.apps_v1 = client.AppsV1Api()
        self.networking_v1 = client.NetworkingV1Api()

    def create_namespace(self, name: str):
        try:
            self.core_v1.read_namespace(name)
            logger.info(f"Namespace {name} already exists")
        except ApiException as e:
            if e.status == 404:
                ns = client.V1Namespace(metadata=client.V1ObjectMeta(name=name))
                self.core_v1.create_namespace(ns)
                logger.info(f"Created namespace {name}")
            else:
                raise e

    def delete_namespace(self, name: str):
        try:
            self.core_v1.delete_namespace(name)
            logger.info(f"Deleted namespace {name}")
        except ApiException as e:
            if e.status != 404:
                raise e

    def get_namespace_status(self, name: str) -> str:
        try:
            ns = self.core_v1.read_namespace(name)
            return ns.status.phase
        except ApiException as e:
            if e.status == 404:
                return "Terminated"
            raise e

    def list_secret_names(self, namespace: str, label_selector: str) -> list:
        try:
            secrets = self.core_v1.list_namespaced_secret(namespace, label_selector=label_selector)
            return [item.metadata.name for item in secrets.items]
        except ApiException as e:
            if e.status == 404:
                return []
            raise e

    def get_secret_data(self, namespace: str, name: str) -> dict:
        try:
            secret = self.core_v1.read_namespaced_secret(name=name, namespace=namespace)
            return secret.data or {}
        except ApiException as e:
            if e.status == 404:
                return {}
            raise e
