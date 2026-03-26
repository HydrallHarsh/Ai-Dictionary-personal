from datetime import date, timedelta


# Get Previous Days Calculations
def get_previous_day(today: date | None = None) -> date:
    """
    Returns a date offset for article queries.

    Uses a 2-day offset to ensure sufficient article availability.
    Args:
        today (date, optional): Provide a date for testing.
                                Defaults to today's local date.
    Returns:
        date: The date two days before `today`.
    """
    if today is None:
        today = date.today()
    return today - timedelta(days=2)
