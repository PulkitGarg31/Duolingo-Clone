"""The OpenAPI document and the interactive docs."""

import re
from collections.abc import Iterator
from typing import Any

import pytest
from fastapi.testclient import TestClient

from app.api.problems import PROBLEM_JSON, problem_responses
from app.api.v1.router import API_V1_PREFIX
from app.schemas.problems import ProblemDetails
from tests.api.contract_keys import (
    ENDPOINTS,
)

# ---- OpenAPI ----


@pytest.fixture
def openapi(bare_client: TestClient) -> dict[str, Any]:
    """The OpenAPI document of the app as deployed (without the probe routes)."""
    response = bare_client.get(f"{API_V1_PREFIX}/openapi.json")
    assert response.status_code == 200
    schema: dict[str, Any] = response.json()
    return schema


def operations(schema: dict[str, Any]) -> Iterator[tuple[str, dict[str, Any]]]:
    for path, item in schema["paths"].items():
        for method, operation in item.items():
            yield f"{method.upper()} {path}", operation


def test_every_operation_has_a_stable_id_and_a_tag(openapi: dict[str, Any]) -> None:
    ids = {name: operation.get("operationId", "") for name, operation in operations(openapi)}
    assert ids["GET /api/v1/health"] == "getHealth"
    assert all(re.fullmatch(r"[a-z][A-Za-z]+", operation_id) for operation_id in ids.values()), ids
    assert all(operation.get("tags") for _, operation in operations(openapi))


def test_error_responses_are_documented_as_problem_details(openapi: dict[str, Any]) -> None:
    for name, operation in operations(openapi):
        for status, response in operation["responses"].items():
            if status.startswith(("4", "5")):
                assert set(response["content"]) == {PROBLEM_JSON}, name
                assert response["content"][PROBLEM_JSON]["schema"] == {
                    "$ref": "#/components/schemas/ProblemDetails"
                }
    assert "HTTPValidationError" not in openapi["components"]["schemas"]


def test_routes_list_their_problem_statuses_with_the_problem_schema() -> None:
    assert problem_responses(404, 409) == {
        404: {"model": ProblemDetails, "description": "Not Found"},
        409: {"model": ProblemDetails, "description": "Conflict"},
    }


def test_the_interactive_docs_are_served(bare_client: TestClient) -> None:
    response = bare_client.get(f"{API_V1_PREFIX}/docs")
    assert response.status_code == 200
    assert "swagger" in response.text.lower()


def test_the_api_serves_exactly_the_documented_endpoints(openapi: dict[str, Any]) -> None:
    served = {
        (method.upper(), path.removeprefix(API_V1_PREFIX)): operation["operationId"]
        for path, item in openapi["paths"].items()
        for method, operation in item.items()
    }
    assert served == {(method, path): operation for operation, (method, path, _) in ENDPOINTS.items()}
    for operation, (method, path, answer_type) in ENDPOINTS.items():
        responses = openapi["paths"][API_V1_PREFIX + path][method.lower()]["responses"]
        successes = [response for status, response in responses.items() if status.startswith("2")]
        assert successes, operation
        for response in successes:  # 201 Created and the 200 replay of a creation alike
            schema = response["content"]["application/json"]["schema"]
            assert schema == {"$ref": f"#/components/schemas/{answer_type}"}, operation
