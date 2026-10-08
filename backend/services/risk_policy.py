"""Shared defaults for absent risk context; explicit values remain unchanged."""
from scanner.limits import positive_int

RISK_DEFAULTS: dict[str, object] = {
    "business_criticality": "medium",
    "data_sensitivity": "medium",
    "data_lifetime_years": 10,
    "migration_time_years": 3,
    "threat_horizon_years": 15,
    "exposure": "internal",
    "migration_effort": "medium",
}


def apply_risk_defaults(finding: dict) -> dict:
    configured = dict(finding)
    defaults = dict(RISK_DEFAULTS)
    defaults["threat_horizon_years"] = positive_int("ECDAT_DEFAULT_THREAT_HORIZON_YEARS", 15, 100)
    for field, value in defaults.items():
        configured.setdefault(field, value)
    return configured
