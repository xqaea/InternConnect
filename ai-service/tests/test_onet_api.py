import unittest
from unittest.mock import patch

from fastapi import HTTPException
from pydantic import ValidationError
import numpy as np

import main


class FakeModel:
    def encode(self, texts, **kwargs):
        self.texts = texts
        return np.array([[1.0, 0.0], [1.0, 1.0]])


class OnetApiTests(unittest.TestCase):
    def test_confirmed_occupation_is_context_without_changing_embedding_input(self):
        model = FakeModel()
        request = main.RankRequest(student_skills=['Python'], postings=[{
            'id': 'developer', 'required_skills': ['SQL'], 'onet_soc_code': '15-1252.00',
        }])
        occupation = {'code': '15-1252.00', 'title': 'Software Developers'}
        with patch.object(main, 'require_occupation_catalog') as catalog, patch.object(
            main, 'get_model', return_value=model
        ), patch.object(main, 'get_onet_skill_catalog', return_value=()):
            catalog.return_value.get.return_value = occupation
            response = main.rank_matches(request)
        self.assertEqual(model.texts, ['Python', 'SQL'])
        self.assertEqual(response['matches'][0]['similarity'], 0.707107)
        self.assertEqual(response['matches'][0]['onet_occupation'], occupation)

    def test_unknown_occupation_is_rejected_before_model_inference(self):
        request = main.RankRequest(student_skills=['Python'], postings=[{
            'id': 'developer', 'required_skills': ['SQL'], 'onet_soc_code': '00-0000.00',
        }])
        with patch.object(main, 'require_occupation_catalog') as catalog, patch.object(main, 'get_model') as model:
            catalog.return_value.get.return_value = None
            with self.assertRaises(HTTPException) as error:
                main.rank_matches(request)
        self.assertEqual(error.exception.status_code, 422)
        model.assert_not_called()

    def test_duplicate_ids_cannot_assign_ambiguous_occupation_context(self):
        with self.assertRaises(ValidationError):
            main.RankRequest(student_skills=['Python'], postings=[
                {'id': 'same', 'required_skills': ['SQL']},
                {'id': 'same', 'required_skills': ['Python']},
            ])
