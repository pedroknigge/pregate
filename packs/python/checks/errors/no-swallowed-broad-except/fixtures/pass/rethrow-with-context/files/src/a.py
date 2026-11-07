import logging

logger = logging.getLogger(__name__)


def load():
    try:
        work()
    except Exception as err:
        logger.exception("load failed")
        raise RuntimeError("load failed") from err
