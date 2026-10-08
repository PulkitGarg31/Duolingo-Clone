"""GET /health: liveness, readiness and the process's boot identity. It never syncs and never writes."""

from fastapi import APIRouter

from app.api.deps import BootDep, NowDep, SeededDep, SettingsDep
from app.schemas.health import HealthOut

router = APIRouter(tags=["system"])


@router.get("/health", response_model=HealthOut, operation_id="getHealth", summary="Server health")
def get_health(now: NowDep, seeded: SeededDep, boot: BootDep, settings: SettingsDep) -> HealthOut:
    """Answers once the database is ready. The host's health check and the client's wake-up screen
    call it; a changed `bootId` tells the client that the server restarted and re-seeded the demo."""
    return HealthOut(
        seeded=seeded,
        boot_id=boot.id,
        booted_at=boot.at,
        server_time=now,
        version=settings.app_version,
    )
