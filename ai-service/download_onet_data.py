from pathlib import Path
from urllib.request import Request, urlopen

from onet_import import import_archive


DATA_DIR = Path(__file__).resolve().parent / 'onet_data'
BASE_URL = 'https://www.onetcenter.org/dl_files/database/db_31_0_csv'
FILES = ('essential_skills.csv', 'transferable_skills.csv', 'software_skills.csv')


def download_file(filename: str) -> None:
    destination = DATA_DIR / filename
    request = Request(
        f'{BASE_URL}/{filename}',
        headers={'User-Agent': 'InternConnect/1.0 (O*NET data setup)'},
    )
    with urlopen(request, timeout=60) as response:
        content = response.read()
    if not content:
        raise RuntimeError(f'O*NET returned an empty file for {filename}.')
    destination.write_bytes(content)
    print(f'Saved {destination} ({len(content):,} bytes)')


def main() -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    archive_path = DATA_DIR / 'onet_database.zip'
    if archive_path.is_file():
        manifest = import_archive(archive_path, DATA_DIR)
        for filename, count in manifest['row_counts'].items():
            print(f'Imported {filename}: {count:,} rows')
        print('O*NET 31.0 imported locally. Restart the AI service to load the data.')
        return
    for filename in FILES:
        download_file(filename)


if __name__ == '__main__':
    main()
