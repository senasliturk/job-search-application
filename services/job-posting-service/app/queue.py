"""Queue publisher.

Publishes a 'new-job-posting' event whenever an admin creates a job. The
Notification Service consumes this queue in its scheduled job-alert task.

Strategy: prefer Azure Service Bus when SERVICE_BUS_CONNECTION_STRING is
set, otherwise fall back to RabbitMQ (which the assignment also explicitly
allows).
"""
from __future__ import annotations

import json
import logging

from .config import get_settings

log = logging.getLogger(__name__)
_settings = get_settings()


def publish_new_job(payload: dict) -> None:
    body = json.dumps(payload, default=str).encode()
    if _settings.SERVICE_BUS_CONNECTION_STRING:
        _publish_servicebus(body)
    else:
        _publish_rabbitmq(body)


def _publish_servicebus(body: bytes) -> None:
    from azure.servicebus import ServiceBusClient, ServiceBusMessage

    with ServiceBusClient.from_connection_string(_settings.SERVICE_BUS_CONNECTION_STRING) as client:
        sender = client.get_queue_sender(queue_name=_settings.SERVICE_BUS_QUEUE_NEW_JOBS)
        with sender:
            sender.send_messages(ServiceBusMessage(body))
    log.info("Published new-job event to Service Bus queue %s", _settings.SERVICE_BUS_QUEUE_NEW_JOBS)


def _publish_rabbitmq(body: bytes) -> None:
    import pika

    try:
        params = pika.URLParameters(_settings.RABBITMQ_URL)
        with pika.BlockingConnection(params) as conn:
            channel = conn.channel()
            channel.queue_declare(queue=_settings.SERVICE_BUS_QUEUE_NEW_JOBS, durable=True)
            channel.basic_publish(
                exchange="",
                routing_key=_settings.SERVICE_BUS_QUEUE_NEW_JOBS,
                body=body,
                properties=pika.BasicProperties(delivery_mode=2),  # persistent
            )
        log.info("Published new-job event to RabbitMQ %s", _settings.SERVICE_BUS_QUEUE_NEW_JOBS)
    except Exception as e:  # noqa: BLE001
        # Don't break the API request just because the queue is down.
        log.warning("Failed to publish new-job event: %s", e)
