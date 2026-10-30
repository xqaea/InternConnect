import unittest

from onet_skills import normalize_skills


class SkillNormalizationTests(unittest.TestCase):
    def test_matches_case_and_spacing_to_onet_label(self):
        result = normalize_skills(
            ['  teamwork ', 'CRITICAL thinking'],
            ['Teamwork', 'Critical Thinking'],
        )

        self.assertEqual(result, ['Teamwork', 'Critical Thinking'])

    def test_unknown_skills_are_preserved(self):
        result = normalize_skills(['Rust programming'], ['Teamwork'])

        self.assertEqual(result, ['Rust programming'])

    def test_duplicate_skills_after_normalization_are_removed(self):
        result = normalize_skills(
            ['teamwork', 'Teamwork'],
            ['Teamwork'],
        )

        self.assertEqual(result, ['Teamwork'])


if __name__ == '__main__':
    unittest.main()
