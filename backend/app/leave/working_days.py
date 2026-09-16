from datetime import date, timedelta
from typing import Union
from app.leave.validator import parse_iso_date


def calculate_working_days(start_date: Union[date, str], end_date: Union[date, str]) -> int:
    """
    Calculate inclusive Monday-Friday working days between start_date and end_date.
    Saturdays (weekday 5) and Sundays (weekday 6) are excluded.
    Public holidays are excluded from demo scope per architectural boundaries.
    """
    if isinstance(start_date, str):
        parsed_start = parse_iso_date(start_date)
        if parsed_start is None:
            raise ValueError(f"Invalid start_date '{start_date}'. Must be in YYYY-MM-DD ISO format.")
        start = parsed_start
    else:
        start = start_date

    if isinstance(end_date, str):
        parsed_end = parse_iso_date(end_date)
        if parsed_end is None:
            raise ValueError(f"Invalid end_date '{end_date}'. Must be in YYYY-MM-DD ISO format.")
        end = parsed_end
    else:
        end = end_date

    if end < start:
        raise ValueError(f"end_date ({end.isoformat()}) cannot be earlier than start_date ({start.isoformat()}).")

    working_days = 0
    current = start
    one_day = timedelta(days=1)

    while current <= end:
        # weekday(): Monday is 0, Sunday is 6
        if current.weekday() < 5:
            working_days += 1
        current += one_day

    return working_days
