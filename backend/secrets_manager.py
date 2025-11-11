"""
Secrets Manager - handles secure secret retrieval
Supports both Google Cloud Secret Manager (production) and local .env (development)
"""
import os
from functools import lru_cache
from typing import Optional
from logger import get_logger

logger = get_logger(__name__)


class SecretsManager:
    """Manages secret retrieval from Google Cloud Secret Manager or local environment"""

    def __init__(self):
        self.environment = os.getenv("ENVIRONMENT", "development")
        self.use_gcp = self.environment == "production" and os.getenv("USE_GCP_SECRETS", "false").lower() == "true"

        if self.use_gcp:
            try:
                from google.cloud import secretmanager
                self.gcp_client = secretmanager.SecretManagerServiceClient()
                self.gcp_project = os.getenv("GCP_PROJECT_ID")
                if not self.gcp_project:
                    logger.warning("GCP_PROJECT_ID not set, falling back to environment variables")
                    self.use_gcp = False
                else:
                    logger.info(f"Using Google Cloud Secret Manager for project: {self.gcp_project}")
            except ImportError:
                logger.warning("google-cloud-secret-manager not installed, falling back to environment variables")
                self.use_gcp = False
            except Exception as e:
                logger.error(f"Failed to initialize GCP Secret Manager: {e}")
                self.use_gcp = False
        else:
            logger.info("Using local environment variables for secrets")
            self.gcp_client = None

    def get_secret(self, secret_name: str, version: str = "latest") -> Optional[str]:
        """
        Retrieve a secret from Google Cloud Secret Manager or environment variable

        Args:
            secret_name: Name of the secret (e.g., "SECRET_KEY", "ENCRYPTION_KEY")
            version: Version of the secret (default: "latest")

        Returns:
            Secret value or None if not found

        Example:
            # Production (GCP): projects/123/secrets/SECRET_KEY/versions/latest
            # Development: os.getenv("SECRET_KEY")
        """
        if self.use_gcp and self.gcp_client:
            return self._get_from_gcp(secret_name, version)
        else:
            return self._get_from_env(secret_name)

    def _get_from_gcp(self, secret_name: str, version: str = "latest") -> Optional[str]:
        """Retrieve secret from Google Cloud Secret Manager"""
        try:
            name = f"projects/{self.gcp_project}/secrets/{secret_name}/versions/{version}"
            response = self.gcp_client.access_secret_version(request={"name": name})
            secret_value = response.payload.data.decode("UTF-8")
            logger.debug(f"Retrieved secret '{secret_name}' from GCP Secret Manager")
            return secret_value
        except Exception as e:
            logger.error(f"Failed to retrieve secret '{secret_name}' from GCP: {e}")
            # Fallback to environment variable
            return self._get_from_env(secret_name)

    def _get_from_env(self, secret_name: str) -> Optional[str]:
        """Retrieve secret from environment variable"""
        value = os.getenv(secret_name)
        if value:
            logger.debug(f"Retrieved secret '{secret_name}' from environment variable")
        else:
            logger.warning(f"Secret '{secret_name}' not found in environment variables")
        return value


@lru_cache()
def get_secrets_manager() -> SecretsManager:
    """Get cached secrets manager instance"""
    return SecretsManager()
