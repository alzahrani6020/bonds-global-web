# Imported source snapshot for BONDS adaptation.
# Source: alzahrani6020/AFAQ-GIE@b1fec7fa400c57f32c2022a21cf74039379fc3cf:web_acquisition/__init__.py
# STAGING ONLY: not imported by BONDS runtime.

"""Governed external web acquisition runtime."""

from .contracts import AcquisitionState, CrawlRequest
from .crawler import crawl
from .fetch import fetch_url
from .verification import verify_remote_resource

__all__ = [
    "AcquisitionState",
    "CrawlRequest",
    "crawl",
    "fetch_url",
    "verify_remote_resource",
]
