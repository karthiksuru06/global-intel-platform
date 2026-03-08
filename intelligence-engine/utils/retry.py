import asyncio
import functools
import logging
from typing import Any, Callable, Tuple, Type

logger = logging.getLogger(__name__)


def async_retry(
    max_retries: int = 3,
    base_delay: float = 1.0,
    max_delay: float = 60.0,
    exponential_base: float = 2.0,
    exceptions: Tuple[Type[Exception], ...] = (Exception,),
) -> Callable:
    """Async retry decorator with exponential backoff."""

    def decorator(func: Callable) -> Callable:
        @functools.wraps(func)
        async def wrapper(*args: Any, **kwargs: Any) -> Any:
            last_exception = None
            for attempt in range(max_retries + 1):
                try:
                    return await func(*args, **kwargs)
                except exceptions as e:
                    last_exception = e
                    if attempt == max_retries:
                        logger.error(
                            "%s failed after %d retries: %s",
                            func.__name__,
                            max_retries,
                            e,
                        )
                        raise
                    delay = min(
                        base_delay * (exponential_base ** attempt),
                        max_delay,
                    )
                    logger.warning(
                        "%s attempt %d/%d failed (%s), retrying in %.1fs",
                        func.__name__,
                        attempt + 1,
                        max_retries,
                        e,
                        delay,
                    )
                    await asyncio.sleep(delay)
            raise last_exception  # Should not reach here

        return wrapper
    return decorator
