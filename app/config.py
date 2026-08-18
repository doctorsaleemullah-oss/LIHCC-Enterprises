from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    secret_key: str = "change-this-to-a-long-random-secret-key"
    database_url: str = "sqlite:///./ahc_clinic.db"
    upload_dir: str = "uploads"
    token_prefix: str = "AHC"
    branch_name: str = "Advanced Heart Center"
    branch_address: str = "Saidu Sharif, Swat, KPK, Pakistan"
    cookie_name: str = "ahc_token"
    access_token_expire_minutes: int = 60 * 12


@lru_cache
def get_settings() -> Settings:
    return Settings()
