# AI model notice

InternConnect uses the pre-trained `sentence-transformers/all-MiniLM-L6-v2` model for semantic matching. The model was created by the Sentence Transformers project and is licensed under Apache-2.0. See the [model card](https://huggingface.co/sentence-transformers/all-MiniLM-L6-v2) and [license](https://www.apache.org/licenses/LICENSE-2.0.txt).

The model files are downloaded during setup and stored locally under `ai-service/models/`. That folder is intentionally excluded from Git. The running AI service loads the local files only; student and company inputs are not sent to Hugging Face or another third-party AI service.
