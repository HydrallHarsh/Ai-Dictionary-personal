import re


class PipelineUnavailable(RuntimeError):
    """A required provider or database gate is unavailable; leave work retryable."""


class PipelineItemError(RuntimeError):
    """The unchanged item's input exceeds a provider limit; bound its attempts."""


def is_deterministic_provider_error(error: Exception) -> bool:
    """Only explicit HTTP 400 input-size limits are item failures.

    Authentication, missing models, rate limits, server errors, malformed generated
    JSON and unknown bad requests remain retryable. Inspect causes because gate
    nodes and SDK adapters may wrap the original provider exception.
    """
    seen = set()
    while error is not None and id(error) not in seen:
        seen.add(id(error))
        if isinstance(error, PipelineItemError):
            return True
        status = getattr(error, "status_code", None) or getattr(error, "code", None)
        if status == 400:
            body = getattr(error, "body", None) or getattr(error, "details", None)
            if isinstance(body, dict):
                detail = body.get("error", body)
                if isinstance(detail, dict):
                    code = detail.get("code")
                    if isinstance(code, str) and code in {"context_length_exceeded", "input_too_long"}:
                        return True
                    message = detail.get("message", "")
                    if isinstance(message, str) and re.search(
                        r"input token count.*exceeds.*maximum.*tokens", message, re.I
                    ):
                        return True
        error = error.__cause__
    return False


def raise_provider_error(error: Exception, message: str) -> None:
    exception = PipelineItemError if is_deterministic_provider_error(error) else PipelineUnavailable
    raise exception(message) from error
