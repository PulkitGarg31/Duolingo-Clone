"""Use cases: load the facts, apply the domain rules, persist the outcome, build the response.

Services never commit and never import the web framework; they report failures by raising
`app.core.errors.AppError` subclasses.
"""
