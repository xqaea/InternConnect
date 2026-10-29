import csv
import re
from pathlib import Path
from typing import Iterable


ONET_DATA_DIR = Path(__file__).resolve().parent / 'onet_data'
SKILL_COLUMNS = {
    'essential_skills.csv': 'Element Name',
    'transferable_skills.csv': 'Element Name',
    'software_skills.csv': 'Workplace Example',
}


def _lookup_key(skill: str) -> str:
    return re.sub(r'\s+', ' ', skill).strip().casefold()


def normalize_skills(skills: Iterable[str], catalog: Iterable[str]) -> list[str]:
    """Use canonical O*NET spelling for exact matches; retain unknown input."""
    canonical_by_key = {}
    for term in catalog:
        cleaned = term.strip()
        if cleaned:
            canonical_by_key.setdefault(_lookup_key(cleaned), cleaned)

    normalized = []
    seen = set()
    for skill in skills:
        cleaned = skill.strip()
        if not cleaned:
            continue
        canonical = canonical_by_key.get(_lookup_key(cleaned), cleaned)
        key = _lookup_key(canonical)
        if key not in seen:
            normalized.append(canonical)
            seen.add(key)
    return normalized


def load_skill_catalog(data_dir: Path = ONET_DATA_DIR) -> list[str]:
    """Read the locally downloaded O*NET 31.0 skill vocabularies, if present."""
    terms = []
    for filename, column in SKILL_COLUMNS.items():
        csv_path = data_dir / filename
        if not csv_path.is_file():
            continue
        with csv_path.open('r', encoding='utf-8-sig', newline='') as source:
            for row in csv.DictReader(source):
                term = row.get(column, '').strip()
                if term:
                    terms.append(term)
    return list(dict.fromkeys(terms))
