"""Consume new-job events from the queue.

The scheduled task (Cloud Scheduler / Azure Logic Apps) hits
/internal/run-job-alert. We drain the queue in one batch, build a list of
freshly-posted jobs, then for each user alert see which ones match and
issue a notification.
"""
from __future__ import annotations

import json
import logging
from typing import Iterable

from .config import get_settings

log = logging.getLogger(__name__)
settings = get_settings()


def drain_new_jobs(max_messages: int = 100) -> list[dict]:
    """Returns up to `max_messages` payloads, ack-ing them."""
    if settings.SERVICE_BUS_CONNECTION_STRING:
        return list(_drain_servicebus(max_messages))
    return list(_drain_rabbitmq(max_messages))


def _drain_servicebus(max_messages: int) -> Iterable[dict]:
    from azure.servicebus import ServiceBusClient

    with ServiceBusClient.from_connection_string(settings.SERVICE_BUS_CONNECTION_STRING) as client:
        receiver = client.get_queue_receiver(queue_name=settings.SERVICE_BUS_QUEUE_NEW_JOBS)
        with receiver:
            messages = receiver.receive_messages(max_message_count=max_messages, max_wait_time=2)
            for m in messages:
                try:
                    body = b"".join(m.body) if hasattr(m, "body") else bytes(m)
                    yield json.loads(body)
                    receiver.complete_message(m)
                except Exception as e:  # noqa: BLE001
                    log.warning("Failed to process Service Bus message: %s", e)
                    receiver.abandon_message(m)


def _drain_rabbitmq(max_messages: int) -> Iterable[dict]:
    import pika

    try:
        params = pika.URLParameters(settings.RABBITMQ_URL)
        with pika.BlockingConnection(params) as conn:
            channel = conn.channel()
            channel.queue_declare(queue=settings.SERVICE_BUS_QUEUE_NEW_JOBS, durable=True)
            for _ in range(max_messages):
                method, _props, body = channel.basic_get(queue=settings.SERVICE_BUS_QUEUE_NEW_JOBS, auto_ack=True)
                if method is None:
                    break
                try:
                    yield json.loads(body)
                except Exception as e:  # noqa: BLE001
                    log.warning("Skipping unparseable RabbitMQ msg: %s", e)
    except Exception as e:  # noqa: BLE001
        log.warning("Cannot read from RabbitMQ: %s", e)
