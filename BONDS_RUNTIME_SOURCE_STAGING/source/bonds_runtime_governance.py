"""Fail-closed staging governance boundary for imported BONDS Python runtime source.

This adapter intentionally grants no authority. Production integration must bind
these staged capabilities through the existing BONDS Capability Registry,
Governed Action Fabric, authorization and audit path.
"""
from dataclasses import dataclass

@dataclass(frozen=True)
class AuthorityRequest:
    action: str
    path: str = ""

@dataclass(frozen=True)
class AuthorityDecision:
    outcome: str
    reason: str

def resolve(_request: AuthorityRequest) -> AuthorityDecision:
    return AuthorityDecision(
        outcome="DENY",
        reason="BONDS_STAGING_NOT_ACTIVATED",
    )
