"""Local occupation lookup. Context never adds abilities or requirements to a match."""
import csv
from pathlib import Path

from onet_skills import ONET_DATA_DIR, _lookup_key


class OccupationCatalog:
    def __init__(self, data_dir: Path = ONET_DATA_DIR):
        self.occupations = {}
        self.titles = {}

        def rows(filename):
            path = data_dir / filename
            if path.is_file():
                with path.open(encoding='utf-8-sig', newline='') as source:
                    yield from csv.DictReader(source)

        for row in rows('occupation_data.csv'):
            code = row['O*NET-SOC Code']
            self.occupations[code] = {
                'code': code, 'title': row['Title'], 'description': row['Description'],
                'skills': [], 'knowledge': [], 'software': [], 'tasks': [],
            }
            self.titles[code] = {_lookup_key(row['Title'])}
        for filename, columns in [
            ('job_titles.csv', ['Job Title', 'Short Title']),
            ('sample_of_reported_titles.csv', ['Reported Job Title']),
        ]:
            for row in rows(filename):
                code = row['O*NET-SOC Code']
                if code in self.titles:
                    self.titles[code].update(_lookup_key(row[c]) for c in columns if row[c].strip())
        for filename, category in [
            ('essential_skills.csv', 'skills'),
            ('transferable_skills.csv', 'skills'),
            ('knowledge.csv', 'knowledge'),
        ]:
            for row in rows(filename):
                code = row['O*NET-SOC Code']
                if code not in self.occupations or row['Scale ID'] != 'IM':
                    continue
                if row['Recommend Suppress'] == 'Y' or row['Not Relevant'] == 'Y':
                    continue
                self.occupations[code][category].append({
                    'id': row['Element ID'], 'name': row['Element Name'],
                    'importance': float(row['Data Value']),
                })
        software = {code: set() for code in self.occupations}
        for row in rows('software_skills.csv'):
            code = row['O*NET-SOC Code']
            if code in software:
                software[code].add(row['Workplace Example'])
        for row in rows('task_statements.csv'):
            code = row['O*NET-SOC Code']
            if code in self.occupations:
                self.occupations[code]['tasks'].append({
                    'id': row['Task ID'], 'description': row['Task'], 'type': row['Task Type'],
                })
        for code, occupation in self.occupations.items():
            for category in ('skills', 'knowledge'):
                occupation[category].sort(key=lambda item: (-item['importance'], item['name']))
            occupation['software'] = sorted(software[code])

    def search(self, query: str, limit: int = 10) -> list[dict]:
        key = _lookup_key(query)
        if not key:
            return []
        tokens = key.split()
        matches = []
        for code, titles in self.titles.items():
            exact = key in titles
            if exact or any(all(token in title.split() for token in tokens) for title in titles):
                item = self.occupations[code]
                matches.append((not exact, item['title'], {
                    'code': code, 'title': item['title'], 'description': item['description'],
                    'exact_title_match': exact,
                }))
        return [match[2] for match in sorted(matches, key=lambda item: (item[0], item[1], item[2]['code']))[:limit]]

    def get(self, code: str) -> dict | None:
        return self.occupations.get(code)
