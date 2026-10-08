"""GET /health: liveness for the host's health check and the client's cold-start screen."""

from datetime import datetime
from typing import Literal

from app.schemas.base import ApiModel


class HealthOut(ApiModel):
    """The server is up. A changed `bootId` means the process restarted and the demo was re-seeded."""

    status: Literal["ok"] = "ok"
    seeded: bool
    boot_id: str
    booted_at: datetime
    server_time: datetime  # real time plus the demo clock offset
    version: str
