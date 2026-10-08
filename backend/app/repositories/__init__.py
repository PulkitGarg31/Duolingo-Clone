"""Data access: small typed query functions over the models.

Repositories read and write rows but hold no game rules, and they never commit: the request's
unit of work decides when changes become permanent.
"""
