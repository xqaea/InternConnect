"""Self-declared resume content, scoped to the authenticated student."""
import base64
import json
import re
from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field, field_validator
from db import database
from student_auth import student

router = APIRouter(prefix='/api/student')
FIELDS = {'ed-name', 'ed-phone', 'ed-email', 'ed-objective', 'ed-workexp',
          'ed-education', 'ed-thesisTitle', 'ed-thesisRole', 'ed-volunteer', 'ed-awards'}
FIELDS.update('ed-'+prefix+kind for prefix in ('work','education','project') for kind in ('Start','End'))


class CustomSection(BaseModel):
    title: str = Field(max_length=200)
    text: str = Field(max_length=10000)


class Resume(BaseModel):
    fields: dict[str, str] = Field(default_factory=dict)
    soft: list[str] = Field(default_factory=list, max_length=200)
    hard: list[str] = Field(default_factory=list, max_length=200)
    thesisOn: bool = False
    certsOn: bool = False
    photoOn: bool = False
    certs: list[list[str]] = Field(default_factory=list, max_length=5)
    langs: list[bool | str] = Field(default_factory=list, max_length=30)
    custom: list[CustomSection] = Field(default_factory=list, max_length=30)
    savedAt: str = Field(default='', max_length=100)
    pdf: str = Field(default='', max_length=255)
    pdfData: str = Field(default='', max_length=2000100)

    @field_validator('fields')
    @classmethod
    def editable_fields(cls, value):
        if set(value) - FIELDS or any(len(text) > 10000 for text in value.values()):
            raise ValueError('Invalid resume fields or field too long.')
        for prefix in ('work','education','project'):
            start,end=(value.get('ed-'+prefix+kind,'') for kind in ('Start','End'))
            if start or end:
                if not all(re.fullmatch(r'\d{4}-(0[1-9]|1[0-2])',date) for date in (start,end)) or end<start:
                    raise ValueError('Choose valid start and end months in chronological order.')
        return value

    @field_validator('soft', 'hard')
    @classmethod
    def skill_lengths(cls, value):
        if any(not text.strip() or len(text) > 200 for text in value):
            raise ValueError('Skills must contain 1 to 200 characters.')
        return value

    @field_validator('certs')
    @classmethod
    def certifications(cls, value):
        if any(len(row) > 3 or any(len(text) > 200 for text in row) for row in value):
            raise ValueError('Invalid certification.')
        return value

    @field_validator('pdfData')
    @classmethod
    def pdf_content(cls, value):
        if value:
            prefix = 'data:application/pdf;base64,'
            if not value.startswith(prefix):
                raise ValueError('Use a PDF attachment.')
            try:
                decoded = base64.b64decode(value[len(prefix):], validate=True)
            except ValueError:
                raise ValueError('Invalid PDF attachment.') from None
            if len(decoded) > 1500000 or not decoded.startswith(b'%PDF-'):
                raise ValueError('Use a PDF under 1.5 MB.')
        return value


class Photo(BaseModel):
    avatar: str = Field(max_length=1400000)

    @field_validator('avatar')
    @classmethod
    def image(cls, value):
        if not value:
            return value
        prefixes = {'data:image/jpeg;base64,': b'\xff\xd8\xff',
                    'data:image/png;base64,': b'\x89PNG\r\n\x1a\n',
                    'data:image/webp;base64,': b'RIFF'}
        for prefix, signature in prefixes.items():
            if value.startswith(prefix):
                try:
                    decoded = base64.b64decode(value[len(prefix):], validate=True)
                except ValueError:
                    break
                if len(decoded) <= 1048576 and decoded.startswith(signature):
                    if signature == b'RIFF' and decoded[8:12] != b'WEBP':
                        break
                    return value
        raise ValueError('Choose a PNG, JPG or WebP photo under 1 MB.')


@router.put('/resume')
def save_resume(body: Resume, account=Depends(student)):
    with database() as connection:
        connection.cursor().execute('INSERT INTO student_resumes (account_id,payload,updated_at) VALUES (%s,%s,UTC_TIMESTAMP()) ON DUPLICATE KEY UPDATE payload=VALUES(payload),updated_at=UTC_TIMESTAMP()',
                                    (account['id'], json.dumps(body.model_dump())))
    return {'ok': True}


@router.put('/profile/photo')
def save_photo(body: Photo, account=Depends(student)):
    with database() as connection:
        connection.cursor().execute('UPDATE student_accounts SET avatar=%s WHERE id=%s', (body.avatar, account['id']))
    return {'ok': True}
