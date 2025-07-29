"""
Timezone-aware datetime utilities to replace deprecated datetime.utcnow().
"""

from datetime import datetime, timezone
from typing import Optional


def utc_now() -> datetime:
    """
    Get current UTC datetime with timezone awareness.
    
    Replaces deprecated datetime.utcnow().
    
    Returns:
        datetime: Current UTC datetime with timezone info
    """
    return datetime.now(timezone.utc)


def utc_now_iso() -> str:
    """
    Get current UTC datetime as ISO string.
    
    Returns:
        str: Current UTC datetime in ISO format
    """
    return utc_now().isoformat()


def to_iso_string(dt: datetime) -> str:
    """
    Convert datetime to ISO string format.
    
    Args:
        dt: Datetime object to convert
        
    Returns:
        str: ISO formatted datetime string
    """
    return dt.isoformat()


def from_iso_string(iso_string: str) -> datetime:
    """
    Parse ISO string to datetime object.
    
    Args:
        iso_string: ISO formatted datetime string
        
    Returns:
        datetime: Parsed datetime object
    """
    return datetime.fromisoformat(iso_string)


def ensure_utc(dt: datetime) -> datetime:
    """
    Ensure datetime is in UTC timezone.
    
    Args:
        dt: Datetime object to convert
        
    Returns:
        datetime: UTC datetime
    """
    if dt.tzinfo is None:
        # Assume naive datetime is UTC
        return dt.replace(tzinfo=timezone.utc)
    elif dt.tzinfo != timezone.utc:
        # Convert to UTC
        return dt.astimezone(timezone.utc)
    return dt


def format_for_database(dt: Optional[datetime] = None) -> str:
    """
    Format datetime for database storage.
    
    Args:
        dt: Datetime to format, defaults to current UTC time
        
    Returns:
        str: Database-formatted datetime string
    """
    if dt is None:
        dt = utc_now()
    return ensure_utc(dt).isoformat()


def get_timestamp_for_filename() -> str:
    """
    Get timestamp suitable for use in filenames.
    
    Returns:
        str: Timestamp in YYYYMMDD_HHMMSS format
    """
    return utc_now().strftime("%Y%m%d_%H%M%S")


def get_current_year() -> int:
    """
    Get current year.
    
    Returns:
        int: Current year
    """
    return utc_now().year


def get_current_date_string() -> str:
    """
    Get current date as string in YYYY-MM-DD format.
    
    Returns:
        str: Current date string
    """
    return utc_now().strftime('%Y-%m-%d') 