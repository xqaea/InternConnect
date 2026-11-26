import unittest

import numpy as np

from matching import DEFAULT_THRESHOLD, cosine_similarity, meets_threshold, parse_threshold, rank_embeddings


class CosineSimilarityTests(unittest.TestCase):
    def test_identical_skill_vectors_score_one(self):
        self.assertAlmostEqual(cosine_similarity([1.0, 2.0], [1.0, 2.0]), 1.0)

    def test_unrelated_orthogonal_vectors_score_zero(self):
        self.assertAlmostEqual(cosine_similarity([1.0, 0.0], [0.0, 1.0]), 0.0)

    def test_numpy_embedding_vectors_are_supported(self):
        score = cosine_similarity(
            np.array([1.0, 0.0], dtype=np.float32),
            np.array([1.0, 1.0], dtype=np.float32),
        )
        self.assertAlmostEqual(score, 0.70710678, places=7)
        self.assertIsInstance(score, float)

    def test_different_vector_lengths_are_rejected(self):
        with self.assertRaises(ValueError):
            cosine_similarity([1.0, 0.0], [1.0])


class RankingTests(unittest.TestCase):
    def test_postings_are_sorted_by_similarity_highest_first(self):
        ranked = rank_embeddings(
            [1.0, 0.0],
            [('unrelated', [0.0, 1.0]), ('related', [1.0, 1.0])],
        )

        self.assertEqual([item['posting_id'] for item in ranked], ['related', 'unrelated'])
        self.assertEqual(ranked[0]['similarity'], 0.707107)
        self.assertEqual(ranked[1]['similarity'], 0.0)


class ThresholdTests(unittest.TestCase):
    def test_default_threshold_is_the_chapter_three_baseline(self):
        self.assertEqual(DEFAULT_THRESHOLD, 0.60)
        self.assertEqual(parse_threshold(None), 0.60)
        self.assertEqual(parse_threshold(''), 0.60)

    def test_valid_configuration_overrides_the_default(self):
        self.assertEqual(parse_threshold('0.55'), 0.55)
        self.assertEqual(parse_threshold(0.7), 0.7)
        self.assertEqual(parse_threshold('0'), 0.0)
        self.assertEqual(parse_threshold('1'), 1.0)

    def test_invalid_configuration_falls_back_to_the_default(self):
        for bad in ('abc', '-0.1', '1.5', 'nan', 'inf', [], {}):
            with self.subTest(bad=bad):
                self.assertEqual(parse_threshold(bad), DEFAULT_THRESHOLD)

    def test_a_score_equal_to_tau_meets_it(self):
        self.assertTrue(meets_threshold(0.6, 0.6))
        self.assertTrue(meets_threshold(0.61, 0.6))
        self.assertFalse(meets_threshold(0.599999, 0.6))

    def test_ranking_marks_which_postings_reach_tau_without_reordering(self):
        ranked = rank_embeddings(
            [1.0, 0.0],
            [('unrelated', [0.0, 1.0]), ('related', [1.0, 1.0]), ('same', [1.0, 0.0])],
            threshold=0.7,
        )
        self.assertEqual([item['posting_id'] for item in ranked], ['same', 'related', 'unrelated'])
        self.assertEqual([item['meets_threshold'] for item in ranked], [True, True, False])
        self.assertEqual([item['similarity'] for item in ranked], [1.0, 0.707107, 0.0])

    def test_ranking_without_a_threshold_keeps_the_original_shape(self):
        ranked = rank_embeddings([1.0, 0.0], [('a', [1.0, 0.0])])
        self.assertEqual(ranked, [{'posting_id': 'a', 'similarity': 1.0}])


if __name__ == '__main__':
    unittest.main()
