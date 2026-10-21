"""
api/demo.py – /demo/* endpoints for Demo Mode control.
"""

from fastapi import APIRouter
from pydantic import BaseModel
from app.demo.simulator import (
    start_simulation, stop_simulation, get_simulation_status, get_simulation_runs
)

router = APIRouter(prefix="/demo", tags=["demo"])


class SimRequest(BaseModel):
    scenario: str


@router.post("/start")
def demo_start(body: SimRequest):
    """Start a demo simulation scenario."""
    return start_simulation(body.scenario)


@router.post("/stop")
def demo_stop():
    """Stop the running demo simulation."""
    return stop_simulation()


@router.get("/status")
def demo_status():
    """Return current simulation status and observable metrics."""
    return get_simulation_status()


@router.get("/runs")
def demo_runs():
    """Return audit trail of historical simulation runs."""
    return {"runs": get_simulation_runs()}


@router.get("/scenarios")
def demo_scenarios():
    """List available demo scenarios."""
    return {
        "scenarios": [
            {
                "id":          "cpu_stress",
                "label":       "Simulate CPU Stress",
                "description": "CPU climbs to 90%+ with Chrome as the top consumer. Triggers Rule A.",
            },
            {
                "id":          "memory_pressure",
                "label":       "Simulate Memory Pressure",
                "description": "RAM climbs to 90%+ with disk activity increase. Triggers Rule B.",
            },
            {
                "id":          "disk_io",
                "label":       "Simulate Disk I/O",
                "description": "Disk read/write spikes 400x above baseline. Triggers Rule C.",
            },
            {
                "id":          "network_load",
                "label":       "Simulate Network Load",
                "description": "Network throughput spikes 1000x. Triggers Rule D.",
            },
            {
                "id":          "process_memory_growth",
                "label":       "Simulate Process Memory Growth",
                "description": "Chrome memory grows steadily. Triggers Rule E.",
            },
        ]
    }
