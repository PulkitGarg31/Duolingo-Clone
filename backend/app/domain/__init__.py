"""Pure game rules.

Modules here import only the standard library and each other: no database, no web framework,
no Pydantic and no clock reads. Every rule receives `now` or `today` as an argument, which is
what lets the tests exercise it in milliseconds.
"""
