"""Demo tools: the shared clock, learner tweaks and the demo reset.

The routes are always mounted; `require_dev_tools` answers 403 when the tools are switched off.
"""

from fastapi import APIRouter, Depends

from app.api.deps import require_dev_tools

router = APIRouter(tags=["dev"], dependencies=[Depends(require_dev_tools)])
