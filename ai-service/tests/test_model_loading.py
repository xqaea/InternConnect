import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import main


class ModelLoadingTests(unittest.TestCase):
    def tearDown(self):
        main.get_model.cache_clear()

    def test_model_load_uses_local_path_and_offline_mode(self):
        with tempfile.TemporaryDirectory(dir=Path(__file__).resolve().parent) as model_dir:
            model_path = Path(model_dir)
            (model_path / 'config.json').write_text('{}', encoding='utf-8')
            model_instance = object()
            with patch.object(main, 'MODEL_PATH', model_path), patch.object(
                main, 'SentenceTransformer', return_value=model_instance
            ) as sentence_transformer:
                main.get_model.cache_clear()

                self.assertIs(main.get_model(), model_instance)

            sentence_transformer.assert_called_once_with(
                str(model_path), local_files_only=True
            )

    def test_missing_local_model_fails_before_loading(self):
        with tempfile.TemporaryDirectory(dir=Path(__file__).resolve().parent) as directory:
            missing_path = Path(directory) / 'missing-model'
            with patch.object(main, 'MODEL_PATH', missing_path), patch.object(
                main, 'SentenceTransformer'
            ) as sentence_transformer:
                main.get_model.cache_clear()

                with self.assertRaisesRegex(RuntimeError, 'download_model.py'):
                    main.get_model()

            sentence_transformer.assert_not_called()


if __name__ == '__main__':
    unittest.main()
