"""Time helpers."""
from datetime import datetime, timezone


def utcnow() -> datetime:
    """Naive UTC 'now' — drop-in replacement for the deprecated datetime.utcnow().

    Returns the same naive-UTC value utcnow() did, so existing comparisons and
    DB writes keep identical behavior without the deprecation warning.
    """
    return datetime.now(timezone.utc).replace(tzinfo=None)
