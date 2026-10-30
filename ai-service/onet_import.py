"""Import the supported O*NET 31.0 tables without extracting ZIP paths."""
import csv
import hashlib
import io
import json
from pathlib import Path
from zipfile import ZipFile

from onet_skills import ONET_DATA_DIR

TABLE_COLUMNS = {
    'essential_skills.csv': {'O*NET-SOC Code', 'Element ID', 'Element Name', 'Scale ID', 'Data Value', 'Recommend Suppress', 'Not Relevant'},
    'transferable_skills.csv': {'O*NET-SOC Code', 'Element ID', 'Element Name', 'Scale ID', 'Data Value', 'Recommend Suppress', 'Not Relevant'},
    'software_skills.csv': {'O*NET-SOC Code', 'Workplace Example', 'Element ID', 'Element Name'},
    'occupation_data.csv': {'O*NET-SOC Code', 'Title', 'Description'},
    'job_titles.csv': {'O*NET-SOC Code', 'Job Title', 'Short Title'},
    'sample_of_reported_titles.csv': {'O*NET-SOC Code', 'Reported Job Title'},
    'knowledge.csv': {'O*NET-SOC Code', 'Element ID', 'Element Name', 'Scale ID', 'Data Value', 'Recommend Suppress', 'Not Relevant'},
    'task_statements.csv': {'O*NET-SOC Code', 'Task ID', 'Task', 'Task Type'},
}


def import_archive(archive_path: Path, data_dir: Path = ONET_DATA_DIR) -> dict:
    tables = {}
    counts = {}
    with ZipFile(archive_path) as archive:
        for filename, required in TABLE_COLUMNS.items():
            member = f'db_31_0_csv/{filename}'
            if archive.namelist().count(member) != 1:
                raise ValueError(f'Expected one {member} in the O*NET 31.0 CSV archive.')
            content = archive.read(member)
            reader = csv.DictReader(io.StringIO(content.decode('utf-8-sig')))
            if not required.issubset(reader.fieldnames or []):
                raise ValueError(f'{filename} is missing required columns.')
            count = sum(1 for _ in reader)
            if not count:
                raise ValueError(f'{filename} contains no data rows.')
            tables[filename] = content
            counts[filename] = count
    # Validate every selected table before replacing any local files.
    data_dir.mkdir(parents=True, exist_ok=True)
    for filename, content in tables.items():
        temporary = data_dir / (filename + '.tmp')
        temporary.write_bytes(content)
        temporary.replace(data_dir / filename)
    manifest = {
        'version': '31.0',
        'archive_sha256': hashlib.sha256(archive_path.read_bytes()).hexdigest(),
        'row_counts': counts,
    }
    temporary = data_dir / 'manifest.json.tmp'
    temporary.write_text(json.dumps(manifest, indent=2) + '\n', encoding='utf-8')
    temporary.replace(data_dir / 'manifest.json')
    return manifest
