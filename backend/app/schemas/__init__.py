"""Wire contracts: the Pydantic models of every request and response body.

Each module mirrors one area of the TypeScript contract the frontend codes against, with the
same class names. Every model extends `ApiModel` (camelCase JSON, UTC instants ending in "Z").
"""
