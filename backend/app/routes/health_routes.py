from fastapi import APIRouter

router = APIRouter(prefix="/api", tags=["Health"])


@router.get("/health")
async def health() -> dict[str, str]:
    """Process liveness only; this does not check whether Elexon is reachable."""
    return {"status": "ok", "service": "windscope", "source": "elexon"}
