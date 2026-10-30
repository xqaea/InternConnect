from functools import lru_cache
import os
from pathlib import Path

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, field_validator
from sentence_transformers import SentenceTransformer

from matching import cosine_similarity, rank_embeddings
from onet_skills import load_skill_catalog, normalize_skills
from onet_import import TABLE_COLUMNS
from onet_occupations import OccupationCatalog
from onet_skills import ONET_DATA_DIR
from careers import profile_text, rank_careers


MODEL_NAME = 'sentence-transformers/all-MiniLM-L6-v2'
MODEL_PATH = Path(__file__).resolve().parent / 'models' / 'all-MiniLM-L6-v2'
app = FastAPI(title='InternConnect AI Service')
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        origin.strip()
        for origin in os.getenv('IC_AI_ALLOWED_ORIGINS', '').split(',')
        if origin.strip()
    ],
    allow_origin_regex=r'^https?://(localhost|127\.0\.0\.1)(:\d+)?$',
    allow_methods=['GET', 'POST'],
    allow_headers=['Content-Type'],
)


class MatchRequest(BaseModel):
    student_skills: list[str] = Field(min_length=1)
    required_skills: list[str] = Field(min_length=1)

    @field_validator('student_skills', 'required_skills')
    @classmethod
    def trim_and_check_skills(cls, skills: list[str]) -> list[str]:
        cleaned = [skill.strip() for skill in skills if skill.strip()]
        if not cleaned:
            raise ValueError('Provide at least one non-empty skill.')
        return cleaned


class CareerRequest(BaseModel):
    student_skills: list[str] = Field(min_length=1,max_length=200)
    resume_context: str = Field(default='',max_length=8000)
    limit: int = Field(default=5,ge=1,le=10)

    @field_validator('student_skills')
    @classmethod
    def valid_skills(cls,value):
        cleaned=list(dict.fromkeys(skill.strip() for skill in value if skill.strip()))
        if not cleaned or any(len(skill)>200 for skill in cleaned):
            raise ValueError('Provide saved resume skills of up to 200 characters each.')
        return cleaned


@lru_cache(maxsize=1)
def career_index():
    occupations=sorted(require_occupation_catalog().occupations.values(),key=lambda item:item['code'])
    if not occupations:
        raise HTTPException(503,'The career catalog is empty. Import the occupation data first.')
    vectors=get_model().encode([profile_text(item) for item in occupations],normalize_embeddings=True,convert_to_numpy=True)
    return occupations,vectors


@app.post('/api/match/careers')
def career_matches(request:CareerRequest):
    try:
        occupations,vectors=career_index()
        # Separate skill and narrative embeddings so long skill lists cannot erase resume context.
        texts=['; '.join(request.student_skills)]
        if request.resume_context.strip():
            texts.append(request.resume_context.strip())
        encoded=get_model().encode(texts,normalize_embeddings=True,convert_to_numpy=True)
        vector=encoded.mean(axis=0)
        matches=rank_careers(vector,occupations,vectors,request.student_skills,request.limit)
    except RuntimeError:
        raise HTTPException(503,'The local career model is unavailable. Check the AI service setup.') from None
    return {'model':MODEL_NAME,'source':'O*NET 31.0','score_type':'semantic_alignment',
        'score_note':'Cosine similarity expressed as a percentage. This is not a hiring probability or a qualification assessment.',
        'matches':matches}


class PostingMatch(BaseModel):
    id: str
    required_skills: list[str] = Field(min_length=1)
    onet_soc_code: str | None = Field(default=None, pattern=r'^\d{2}-\d{4}\.\d{2}$')

    @field_validator('id')
    @classmethod
    def trim_posting_id(cls, posting_id: str) -> str:
        cleaned = posting_id.strip()
        if not cleaned:
            raise ValueError('Posting ID must not be empty.')
        return cleaned

    @field_validator('required_skills')
    @classmethod
    def trim_required_skills(cls, skills: list[str]) -> list[str]:
        cleaned = [skill.strip() for skill in skills if skill.strip()]
        if not cleaned:
            raise ValueError('Provide at least one non-empty required skill.')
        return cleaned


class RankRequest(BaseModel):
    student_skills: list[str] = Field(min_length=1)
    postings: list[PostingMatch] = Field(min_length=1)

    @field_validator('postings')
    @classmethod
    def check_unique_ids(cls, postings: list[PostingMatch]) -> list[PostingMatch]:
        if len({posting.id for posting in postings}) != len(postings):
            raise ValueError('Posting IDs must be unique within a rank request.')
        return postings

    @field_validator('student_skills')
    @classmethod
    def trim_student_skills(cls, skills: list[str]) -> list[str]:
        cleaned = [skill.strip() for skill in skills if skill.strip()]
        if not cleaned:
            raise ValueError('Provide at least one non-empty student skill.')
        return cleaned


@lru_cache(maxsize=1)
def get_model() -> SentenceTransformer:
    if not (MODEL_PATH / 'config.json').is_file():
        raise RuntimeError(
            f'Local model files are missing from {MODEL_PATH}. '
            'Run `python download_model.py` once during setup.'
        )
    return SentenceTransformer(str(MODEL_PATH), local_files_only=True)


@lru_cache(maxsize=1)
def get_onet_skill_catalog() -> tuple[str, ...]:
    return tuple(load_skill_catalog())


@lru_cache(maxsize=1)
def get_occupation_catalog() -> OccupationCatalog:
    return OccupationCatalog()


def require_occupation_catalog() -> OccupationCatalog:
    if any(not (ONET_DATA_DIR / name).is_file() for name in TABLE_COLUMNS):
        raise HTTPException(503, 'Import the O*NET ZIP with download_onet_data.py and restart the service.')
    return get_occupation_catalog()


@app.get('/health')
def health() -> dict[str, str]:
    return {'status': 'ok'}


@app.get('/api/onet/status')
def onet_status() -> dict:
    missing = [name for name in TABLE_COLUMNS if not (ONET_DATA_DIR / name).is_file()]
    return {
        'version': '31.0', 'ready': not missing, 'missing_files': missing,
        'skill_terms': len(set(get_onet_skill_catalog())),
        'occupations': len(get_occupation_catalog().occupations) if not missing else 0,
    }


@app.get('/api/onet/occupations')
def search_occupations(query: str = Query(min_length=1, max_length=150), limit: int = Query(default=10, ge=1, le=50)) -> dict:
    return {'version': '31.0', 'occupations': require_occupation_catalog().search(query, limit)}


@app.get('/api/onet/occupations/{code}')
def occupation_details(code: str) -> dict:
    occupation = require_occupation_catalog().get(code)
    if occupation is None:
        raise HTTPException(404, 'Unknown O*NET-SOC occupation code.')
    return {'version': '31.0', 'occupation': occupation}


@app.post('/api/match/score')
def score_match(request: MatchRequest) -> dict[str, float | str]:
    catalog = get_onet_skill_catalog()
    student_skills = normalize_skills(request.student_skills, catalog)
    required_skills = normalize_skills(request.required_skills, catalog)
    student_text = '; '.join(student_skills)
    job_text = '; '.join(required_skills)
    vectors = get_model().encode(
        [student_text, job_text],
        normalize_embeddings=True,
        convert_to_numpy=True,
    )
    score = cosine_similarity(vectors[0], vectors[1])
    return {'model': MODEL_NAME, 'similarity': round(score, 6)}


@app.post('/api/match/rank')
def rank_matches(request: RankRequest) -> dict[str, object]:
    contexts = {}
    for posting in request.postings:
        if posting.onet_soc_code:
            occupation = require_occupation_catalog().get(posting.onet_soc_code)
            if occupation is None:
                raise HTTPException(422, f'Unknown O*NET-SOC code: {posting.onet_soc_code}')
            contexts[posting.id] = {'code': occupation['code'], 'title': occupation['title']}
    catalog = get_onet_skill_catalog()
    student_skills = normalize_skills(request.student_skills, catalog)
    texts = ['; '.join(student_skills)] + [
        '; '.join(normalize_skills(posting.required_skills, catalog))
        for posting in request.postings
    ]
    vectors = get_model().encode(
        texts,
        normalize_embeddings=True,
        convert_to_numpy=True,
    )
    postings = [
        (posting.id, embedding)
        for posting, embedding in zip(request.postings, vectors[1:])
    ]
    matches = rank_embeddings(vectors[0], postings)
    for match in matches:
        if match['posting_id'] in contexts:
            match['onet_occupation'] = contexts[match['posting_id']]
    return {'model': MODEL_NAME, 'matches': matches}
