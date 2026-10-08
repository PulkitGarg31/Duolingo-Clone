"""Hearts: a token bucket that refills lazily, one heart per interval, keeping partial progress."""

import random
from datetime import UTC, datetime, timedelta

import pytest

from app.domain.hearts import (
    HeartsState,
    OutOfHearts,
    full_at,
    gain,
    lose_one,
    next_heart_at,
    refill,
    regenerate,
    set_hearts,
)
from app.domain.rules import MAX_HEARTS

INTERVAL = timedelta(hours=5)
FULL = HeartsState(MAX_HEARTS, None)


def at(hour: int, minute: int = 0, second: int = 0) -> datetime:
    """An instant on 2026-10-08 (UTC)."""
    return datetime(2026, 10, 8, hour, minute, second, tzinfo=UTC)


class TestWorkedTimeline:
    def test_losses_then_regeneration_then_a_practice_reward(self) -> None:
        s = lose_one(FULL, at(10), INTERVAL)
        assert (s, next_heart_at(s, INTERVAL)) == (HeartsState(4, at(10)), at(15))
        s = lose_one(s, at(11), INTERVAL)  # the running interval is not restarted
        assert (s, next_heart_at(s, INTERVAL)) == (HeartsState(3, at(10)), at(15))
        s = regenerate(s, at(15), INTERVAL)  # any request at 15:00
        assert (s, next_heart_at(s, INTERVAL)) == (HeartsState(4, at(15)), at(20))
        s = gain(s, 1, at(16), INTERVAL)  # practice completed
        assert (s, next_heart_at(s, INTERVAL)) == (FULL, None)

    def test_a_reward_below_the_maximum_keeps_the_running_interval(self) -> None:
        s = gain(HeartsState(2, at(15)), 1, at(16), INTERVAL)
        assert (s, next_heart_at(s, INTERVAL)) == (HeartsState(3, at(15)), at(20))


def test_reaching_the_maximum_clears_the_anchor() -> None:
    assert regenerate(HeartsState(4, at(10)), at(15), INTERVAL) == FULL
    # Time beyond a full refill is not banked.
    assert regenerate(HeartsState(0, at(10)), at(10) + 8 * INTERVAL, INTERVAL) == FULL


def test_the_first_loss_starts_the_timer() -> None:
    assert lose_one(FULL, at(10, 30), INTERVAL) == HeartsState(4, at(10, 30))


def test_a_later_loss_does_not_restart_the_timer() -> None:
    assert lose_one(HeartsState(3, at(10)), at(14, 59), INTERVAL) == HeartsState(2, at(10))


def test_losing_a_heart_at_zero_raises_with_the_next_heart_time() -> None:
    with pytest.raises(OutOfHearts) as caught:
        lose_one(HeartsState(0, at(10)), at(12), INTERVAL)
    assert caught.value.next_heart_at == at(15)


def test_a_heart_regenerated_by_now_can_be_spent() -> None:
    assert lose_one(HeartsState(0, at(10)), at(15), INTERVAL) == HeartsState(0, at(15))


def test_a_reward_keeps_the_partial_interval() -> None:
    # Two hours into the interval that started at 10:00: the reward adds a heart and those hours still count.
    assert gain(HeartsState(0, at(10)), 1, at(12), INTERVAL) == HeartsState(1, at(10))


def test_exactly_one_interval_gives_one_heart() -> None:
    assert regenerate(HeartsState(3, at(10)), at(15), INTERVAL) == HeartsState(4, at(15))


def test_one_second_short_of_an_interval_gives_nothing() -> None:
    assert regenerate(HeartsState(3, at(10)), at(14, 59, 59), INTERVAL) == HeartsState(3, at(10))


def test_the_remainder_of_an_interval_is_kept() -> None:
    # 11 h 30 m after 10:00 is two whole intervals; the third one started at 20:00.
    assert regenerate(HeartsState(1, at(10)), at(21, 30), INTERVAL) == HeartsState(3, at(20))


def test_regeneration_never_counts_backwards() -> None:
    assert regenerate(HeartsState(2, at(10)), at(9), INTERVAL) == HeartsState(2, at(10))


@pytest.mark.parametrize(
    ("state", "next_heart", "full"),
    [
        (HeartsState(4, at(11)), at(16), at(16)),
        (HeartsState(3, at(11)), at(16), at(21)),
        (HeartsState(0, at(10)), at(15), at(10) + 5 * INTERVAL),
        (FULL, None, None),
    ],
)
def test_next_heart_and_full_refill_times(
    state: HeartsState, next_heart: datetime | None, full: datetime | None
) -> None:
    assert next_heart_at(state, INTERVAL) == next_heart
    assert full_at(state, INTERVAL) == full


def test_refill_fills_the_bucket() -> None:
    assert refill() == FULL


@pytest.mark.parametrize(
    ("hearts", "expected"),
    [(MAX_HEARTS, FULL), (2, HeartsState(2, at(12))), (0, HeartsState(0, at(12)))],
)
def test_setting_hearts_starts_a_fresh_interval(hearts: int, expected: HeartsState) -> None:
    assert set_hearts(hearts, at(12)) == expected


@pytest.mark.parametrize(
    ("hearts", "anchor"),
    [(MAX_HEARTS + 1, None), (-1, at(10)), (4, None), (MAX_HEARTS, at(10))],
    ids=["above-maximum", "negative", "missing-anchor", "anchor-when-full"],
)
def test_impossible_states_are_rejected(hearts: int, anchor: datetime | None) -> None:
    with pytest.raises(ValueError, match="hearts"):
        HeartsState(hearts, anchor)


def test_a_random_walk_of_1000_operations_keeps_the_bucket_valid() -> None:
    rng = random.Random(1000)
    now, s = at(0), FULL
    out_of_hearts = 0
    for _ in range(1000):
        now += timedelta(minutes=rng.randrange(0, 3 * 60))
        current = regenerate(s, now, INTERVAL)
        match rng.choice(("sync", "lose", "gain", "refill", "set")):
            case "sync":
                s = current
            case "lose" if current.hearts == 0:
                with pytest.raises(OutOfHearts):
                    lose_one(s, now, INTERVAL)
                out_of_hearts += 1
                s = current
            case "lose":
                s = lose_one(s, now, INTERVAL)
                assert s.hearts == current.hearts - 1
            case "gain":
                s = gain(s, 1, now, INTERVAL)
                assert s.hearts == min(MAX_HEARTS, current.hearts + 1)
            case "refill":
                s = refill()
            case "set":
                s = set_hearts(rng.randint(0, MAX_HEARTS), now)
        assert 0 <= s.hearts <= MAX_HEARTS
        assert (s.anchor is None) == (s.hearts == MAX_HEARTS)
        assert s.anchor is None or s.anchor <= now
    assert out_of_hearts > 0  # the walk really reached the empty bucket


@pytest.mark.parametrize("seed", range(5))
def test_regenerating_in_small_steps_equals_one_big_step(seed: int) -> None:
    rng = random.Random(seed)
    start = HeartsState(rng.randrange(0, MAX_HEARTS), at(0))
    end = at(0) + timedelta(minutes=rng.randrange(0, 30 * 60))
    stepwise, now = start, at(0)
    while now < end:
        now = min(end, now + timedelta(minutes=rng.randrange(1, 120)))
        stepwise = regenerate(stepwise, now, INTERVAL)
    assert stepwise == regenerate(start, end, INTERVAL)
