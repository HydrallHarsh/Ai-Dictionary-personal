class PipelineUnavailable(RuntimeError):
    """A required provider or database gate is unavailable; leave work retryable."""
