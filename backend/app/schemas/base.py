"""The base of every wire model: camelCase JSON, strict input and UTC instants that end in "Z"."""

from datetime import UTC, datetime

from pydantic import BaseModel, ConfigDict, SerializerFunctionWrapHandler, field_serializer
from pydantic.alias_generators import to_camel


def format_instant(value: datetime) -> str:
    """An aware datetime as ISO-8601 in UTC with a "Z" suffix, e.g. "2026-10-08T12:00:00Z".

    Whole seconds print without a fraction; finer values keep milliseconds, the most a browser
    `Date` can hold. A naive datetime has no zone to convert from, so it is refused.
    """
    if value.tzinfo is None or value.utcoffset() is None:
        raise ValueError(f"refusing to serialize naive datetime {value.isoformat()}; pass an aware instant")
    utc = value.astimezone(UTC)
    timespec = "milliseconds" if utc.microsecond else "seconds"
    return utc.isoformat(timespec=timespec).replace("+00:00", "Z")


class ApiModel(BaseModel):
    """Base class of every request and response body.

    Fields are snake_case in Python and camelCase on the wire; input is accepted under either name.
    Unknown input fields are rejected, so a misspelt field fails loudly instead of being ignored.
    `from_attributes` lets a response be built straight from an ORM object.
    """

    model_config = ConfigDict(
        alias_generator=to_camel,
        validate_by_name=True,
        validate_by_alias=True,
        serialize_by_alias=True,
        from_attributes=True,
        extra="forbid",
    )

    # Applies to the datetime fields of every subclass, so no instant leaves in another format.
    # No return annotation on purpose: Pydantic would use it as the JSON schema of every field.
    @field_serializer("*", mode="wrap", when_used="json")
    def _serialize_instants(self, value: object, handler: SerializerFunctionWrapHandler):
        return format_instant(value) if isinstance(value, datetime) else handler(value)
