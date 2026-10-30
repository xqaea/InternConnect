import unittest
from unittest.mock import patch
import numpy as np
from fastapi import HTTPException
from pydantic import ValidationError
import main
from careers import profile_text,rank_careers


def occupation(code,title,skills):
    return dict(code=code,title=title,description='Occupation description',
        skills=[{'name':skill,'importance':4} for skill in skills],knowledge=[],software=[],tasks=[])


class CareerTests(unittest.TestCase):
    def test_ranking_percentages_and_skill_evidence(self):
        occupations=[occupation('tech','Developer',['Python','SQL']),occupation('hotel','Hotel desk',['Customer Service'])]
        rows=rank_careers(np.array([1.,0.]),occupations,np.array([[1.,0.],[0.,1.]]),['python'],5)
        self.assertEqual(rows[0]['code'],'tech')
        self.assertEqual(rows[0]['alignment_percent'],100)
        self.assertEqual(rows[1]['alignment_percent'],0)
        self.assertEqual(rows[0]['matched_skills'],['Python'])
        self.assertEqual(rows[0]['skills_to_explore'],['SQL'])

    def test_identical_scores_have_stable_order_and_limit(self):
        rows=rank_careers([1,0],[occupation('b','B',[]),occupation('a','A',[])],[[1,0],[1,0]],['Python'],1)
        self.assertEqual(rows[0]['code'],'a')

    def test_negative_similarity_does_not_show_negative_percentage(self):
        rows=rank_careers([1,0],[occupation('a','A',[])],[[-1,0]],['Python'],1)
        self.assertEqual(rows[0]['alignment_percent'],0)
        self.assertIn('No direct',rows[0]['reasons'][1])

    def test_request_bounds_and_nonempty_skills(self):
        for values in [dict(student_skills=[' ']),dict(student_skills=['x'*201]),
                       dict(student_skills=['Python'],limit=11),dict(student_skills=['Python'],resume_context='x'*8001)]:
            with self.assertRaises(ValidationError):
                main.CareerRequest(**values)

    def test_profiles_include_catalog_context(self):
        profile=occupation('a','Developer',['Python'])
        self.assertIn('Developer',profile_text(profile))
        self.assertIn('Python',profile_text(profile))

    def test_service_combines_skills_and_narrative_and_labels_score(self):
        model=type('FakeModel',(),{'encode':lambda self,texts,**kwargs:np.array([[1.,0.] for text in texts])})()
        with patch.object(main,'career_index',return_value=([occupation('a','Developer',['Python'])],np.array([[1.,0.]]))),patch.object(main,'get_model',return_value=model):
            result=main.career_matches(main.CareerRequest(student_skills=['Python'],resume_context='Developed software'))
        self.assertEqual(result['score_type'],'semantic_alignment')
        self.assertIn('not a hiring probability',result['score_note'])

    def test_unavailable_model_returns_service_error(self):
        with patch.object(main,'career_index',side_effect=RuntimeError('Missing model')),self.assertRaises(HTTPException) as result:
            main.career_matches(main.CareerRequest(student_skills=['Python']))
        self.assertEqual(result.exception.status_code,503)
