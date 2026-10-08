"""GET /me/path on the seeded demo: node states, crowns, rings, actions and unit states; and chests."""

from fastapi.testclient import TestClient

from tests.api.contract_keys import CONTRACT_KEYS
from tests.helpers import API, assert_problem, path_nodes

NO_ACTIONS = {"canStart": False, "startXp": None, "canPractice": False, "canLegendary": False}
# The always-present prices on every node's actions.
PRICES = {"practiceXp": 5, "legendaryXp": 40, "legendaryPriceGems": 100}


def test_the_path_has_the_contract_shape(client: TestClient) -> None:
    path = client.get(f"{API}/me/path").json()
    assert set(path) == CONTRACT_KEYS["PathOut"]
    assert path["course"]["slug"] == "es-en"
    for unit in path["units"]:
        assert set(unit) == CONTRACT_KEYS["PathUnitOut"]
        for node in unit["nodes"]:
            assert set(node) == CONTRACT_KEYS["PathNodeOut"]
            assert set(node["actions"]) == CONTRACT_KEYS["PathNodeActions"]


def test_the_seeded_path_shows_every_node_state(client: TestClient) -> None:
    path = client.get(f"{API}/me/path").json()
    units = path["units"]
    assert [(unit["number"], unit["color"], unit["state"], unit["hasGuidebook"]) for unit in units] == [
        (1, "green", "completed", True),
        (2, "purple", "in_progress", True),
        (3, "teal", "locked", True),
    ]
    assert [
        [(node["kind"], node["state"], node["crownLevel"]) for node in unit["nodes"]] for unit in units
    ] == [
        [
            ("skill", "legendary", 2),
            ("skill", "completed", 1),
            ("chest", "completed", 0),
            ("review", "completed", 1),
        ],
        [("skill", "completed", 1), ("skill", "active", 0), ("chest", "locked", 0), ("review", "locked", 0)],
        [("skill", "locked", 0), ("skill", "locked", 0), ("review", "locked", 0)],
    ]
    drinks = units[1]["nodes"][1]
    assert path["currentNodeId"] == drinks["id"]
    assert (
        drinks["title"],
        drinks["lessonsCompleted"],
        drinks["lessonCount"],
        drinks["nextLessonNumber"],
    ) == (
        "Drinks",
        1,
        3,
        2,
    )
    chests = [node for unit in units for node in unit["nodes"] if node["kind"] == "chest"]
    assert [(chest["chestGems"], chest["lessonCount"]) for chest in chests] == [(20, 0), (20, 0)]


def test_actions_follow_each_nodes_kind_and_state(client: TestClient) -> None:
    nodes = path_nodes(client)
    expected = {
        (1, 1): NO_ACTIONS | {"canPractice": True},  # legendary: practice only
        (1, 2): NO_ACTIONS | {"canPractice": True, "canLegendary": True},
        (1, 3): NO_ACTIONS,  # an opened chest
        (1, 4): NO_ACTIONS | {"canPractice": True},  # a review is never legendary
        (2, 2): NO_ACTIONS | {"canStart": True, "startXp": 10},  # the active skill
        (2, 3): NO_ACTIONS,  # locked
    }
    for place, actions in expected.items():
        assert nodes[place]["actions"] == actions | PRICES, place


def test_an_opened_chest_replays_its_reward(client: TestClient) -> None:
    chest = path_nodes(client)[(1, 3)]
    response = client.post(f"{API}/me/chests/{chest['id']}/claim")
    assert response.status_code == 200
    assert response.json() == {"nodeId": chest["id"], "gemsAwarded": 20, "gems": 820, "replayed": True}


def test_a_chest_ahead_on_the_path_stays_locked(client: TestClient) -> None:
    chest = path_nodes(client)[(2, 3)]
    assert_problem(client.post(f"{API}/me/chests/{chest['id']}/claim"), 409, "CHEST_LOCKED")
    assert client.get(f"{API}/me").json()["gems"] == 820


def test_only_a_chest_of_the_course_can_be_opened(client: TestClient) -> None:
    skill = path_nodes(client)[(1, 1)]
    assert_problem(client.post(f"{API}/me/chests/{skill['id']}/claim"), 409, "NODE_NOT_PLAYABLE")
    assert_problem(client.post(f"{API}/me/chests/999999/claim"), 404, "NOT_FOUND")


# ---- public content ----


def test_the_course_menu_lists_every_course_and_may_be_cached(client: TestClient) -> None:
    response = client.get(f"{API}/courses")
    assert response.status_code == 200
    assert response.headers["cache-control"] == "public, max-age=300"
    assert "x-server-time" not in response.headers  # public content never reads the learner's clock
    courses = response.json()["items"]
    assert [(c["slug"], c["title"], c["ttsLocale"], c["isPublished"]) for c in courses] == [
        ("es-en", "Spanish", "es-ES", True),
        ("fr-en", "French", "fr-FR", False),
        ("de-en", "German", "de-DE", False),
    ]
    assert courses[0] == client.get(f"{API}/me").json()["course"]


def test_a_guidebook_holds_the_units_phrases_and_tips(client: TestClient) -> None:
    unit = client.get(f"{API}/me/path").json()["units"][1]
    response = client.get(f"{API}/units/{unit['id']}/guidebook")
    assert response.status_code == 200
    assert response.headers["cache-control"] == "public, max-age=300"
    guidebook = response.json()
    assert guidebook["unit"] == {
        "id": unit["id"],
        "number": 2,
        "title": "Order food and drinks",
        "color": "purple",
    }
    assert guidebook["ttsLocale"] == "es-ES"
    assert len(guidebook["keyPhrases"]) == 6
    assert guidebook["keyPhrases"][0] == {
        "text": "Quiero un café, por favor.",
        "translation": "I want a coffee, please.",
    }
    assert guidebook["tipsMd"].startswith("## Nouns have gender\n")


def test_an_unknown_unit_has_no_guidebook(client: TestClient) -> None:
    response = client.get(f"{API}/units/999999/guidebook")
    assert_problem(response, 404, "NOT_FOUND")
    assert response.headers["cache-control"] == "no-store"  # errors are never cached
