from pathlib import Path

from huggingface_hub import snapshot_download


MODEL_REPO = 'sentence-transformers/all-MiniLM-L6-v2'
MODEL_PATH = Path(__file__).resolve().parent / 'models' / 'all-MiniLM-L6-v2'


if __name__ == '__main__':
    snapshot_download(repo_id=MODEL_REPO, local_dir=MODEL_PATH)
    print(f'Model files saved to {MODEL_PATH}')
