"""Picture-card illustrations: the keys a multiple-choice option may name in its `image` field.

The frontend draws one original illustration per key and lists the same keys, in the same order,
in `frontend/src/components/illustrations/illustration-keys.json`; a test keeps the two in sync.
"""

from typing import Final

ILLUSTRATION_KEYS: Final[tuple[str, ...]] = (
    "wave",
    "bye",
    "thanks",
    "sun",
    "moon",
    "boy",
    "girl",
    "man",
    "woman",
    "bread",
    "apple",
    "cheese",
    "orange",
    "water",
    "coffee",
    "milk",
    "tea",
    "juice",
    "sugar",
    "bill",
    "mother",
    "father",
    "brother",
    "sister",
    "tall",
    "short",
)
