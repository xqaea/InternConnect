from math import sqrt
from typing import Sequence


def cosine_similarity(left: Sequence[float], right: Sequence[float]) -> float:
    """Return the cosine similarity for two vectors."""
    if len(left) != len(right):
        raise ValueError('Vectors must have the same length.')
    if len(left) == 0:
        raise ValueError('Vectors must not be empty.')

    left_magnitude = sqrt(sum(value * value for value in left))
    right_magnitude = sqrt(sum(value * value for value in right))
    if left_magnitude == 0 or right_magnitude == 0:
        raise ValueError('Zero vectors do not have a cosine similarity.')

    dot_product = sum(a * b for a, b in zip(left, right))
    return float(dot_product / (left_magnitude * right_magnitude))


# Similarity cutoff tau. 0.60 is the development baseline named in thesis Chapter 3; the final value comes
# from the human-rated calibration set. Set IC_MATCH_THRESHOLD to override it without code changes.
DEFAULT_THRESHOLD = 0.60


def parse_threshold(value: str | float | None, default: float = DEFAULT_THRESHOLD) -> float:
    """Read tau from configuration. Missing, non-numeric or out-of-range values fall back to the default."""
    if value is None or value == '':
        return default
    try:
        threshold = float(value)
    except (TypeError, ValueError):
        return default
    return threshold if 0.0 <= threshold <= 1.0 else default  # NaN fails the comparison too


def meets_threshold(similarity: float, threshold: float) -> bool:
    """True when a similarity score reaches the cutoff tau."""
    return similarity >= threshold


def rank_embeddings(
    student_embedding: Sequence[float],
    postings: Sequence[tuple[str, Sequence[float]]],
    threshold: float | None = None,
) -> list[dict[str, float | str | bool]]:
    """Rank posting embeddings by raw cosine similarity, highest first.

    With a threshold, each match also says whether it reaches tau. Location is never part of this score.
    """
    ranked = []
    for posting_id, embedding in postings:
        similarity = round(cosine_similarity(student_embedding, embedding), 6)
        item: dict[str, float | str | bool] = {'posting_id': posting_id, 'similarity': similarity}
        if threshold is not None:
            item['meets_threshold'] = meets_threshold(similarity, threshold)
        ranked.append(item)
    return sorted(ranked, key=lambda item: item['similarity'], reverse=True)
