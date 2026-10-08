"""Runtime configuration, read from environment variables and an optional `.env` file."""

from functools import lru_cache
from typing import Annotated, Literal

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict

from app.domain.calendar import is_valid_timezone
from app.domain.rules import DEFAULT_HEART_REGEN_MINUTES

LogLevel = Literal["critical", "error", "warning", "info", "debug"]


class Settings(BaseSettings):
    """Each field is read from the environment variable of the same name, in upper case."""

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # Relative to the working directory; startup creates the parent folder (core.db.ensure_sqlite_dir).
    database_url: str = "sqlite:///./data/app.db"
    # Exact origins, comma-separated in the environment: "http://localhost:3000,https://x.vercel.app".
    cors_origins: Annotated[list[str], NoDecode] = ["http://localhost:3000"]
    cors_origin_regex: str = ""  # optional extra origin pattern, e.g. for preview deployments
    default_username: str = "alex"  # the learner served when no X-User-Id header is honoured
    allow_user_header: bool = True  # honour X-User-Id (local runs and tests); turned off in production
    enable_dev_tools: bool = True  # the /dev time-travel and reset endpoints
    seed_timezone: str = "Asia/Kolkata"  # the sample learner's zone until the browser's zone is adopted
    heart_regen_minutes: int = Field(default=DEFAULT_HEART_REGEN_MINUTES, gt=0)
    log_level: LogLevel = "info"
    app_version: str = "1.0.0"

    @field_validator("cors_origins", mode="before")
    @classmethod
    def _split_origins(cls, value: object) -> object:
        if isinstance(value, str):
            return [origin.strip() for origin in value.split(",") if origin.strip()]
        return value

    @field_validator("seed_timezone")
    @classmethod
    def _require_known_timezone(cls, value: str) -> str:
        if not is_valid_timezone(value):
            raise ValueError(f"unknown IANA time zone {value!r}")
        return value

    @field_validator("log_level", mode="before")
    @classmethod
    def _lowercase_level(cls, value: object) -> object:
        return value.lower() if isinstance(value, str) else value


@lru_cache
def get_settings() -> Settings:
    """The settings of this process, read once. Tests override the dependency instead."""
    return Settings()
