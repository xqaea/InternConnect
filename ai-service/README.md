# InternConnect AI service

The matching service runs the locally stored `all-MiniLM-L6-v2` model. It can also normalize exact skill-name matches using local O*NET 31.0 vocabulary files. Unknown skill names remain unchanged; semantic similarity is still calculated by the sentence model.

The student Job Matching page sends the saved resume skills and current posting skill lists to the local `/api/match/rank` endpoint. The service's raw cosine similarities determine the ranking; the existing score badge displays that value as a rounded percent. If the service cannot be reached, the page keeps its existing local score behavior. This does not change the page layout or skill-gap chips.

For local browser development, the API allows requests from `localhost` and `127.0.0.1` origins. Set `IC_AI_API_BASE` in the page before `assets/js/core/ai-matching.js` if the service uses a different URL. To allow a deployed frontend, set `IC_AI_ALLOWED_ORIGINS` on the API server to a comma-separated list of its exact origins.

Place the full **O*NET 31.0 CSV ZIP** at `ai-service/onet_data/onet_database.zip`, then run this from the repository root:

```powershell
ai-service\.venv\Scripts\python.exe ai-service\download_onet_data.py
```

The setup script imports eight tables from the local archive: Essential Skills, Transferable Skills, Software Skills, Occupation Data, Job Titles, Sample of Reported Titles, Knowledge, and Task Statements. It validates the versioned paths, column headers and nonempty rows before replacing local files. It records row counts and an archive SHA-256 in `manifest.json`. Other ZIP members are left in the archive. When no ZIP is present, the script retains its original three-file vocabulary download behavior.

Restart the API after importing. Data and the ZIP remain in `ai-service/onet_data/`, excluded from Git. Matching can run without the archive; occupation endpoints return 503 until the full import is available.

The following endpoints are available in `/docs`:

- `POST /api/match/careers`: ranks local occupation profiles against saved resume
  skills and narrative context. Returns five suggestions by default, raw cosine
  similarity expressed as an alignment percentage, direct listed-skill overlaps,
  and skills to explore. These percentages are not calibrated hiring probabilities
  or qualification assessments. Missing listed skills do not prove missing ability.
  The first request builds an in-memory occupation embedding index; restart after
  changing model or catalog files. No external AI calls or database migrations are
  required. The Resume Builder's Explore Careers dialog uses this endpoint.

- `GET /api/onet/status`: import readiness, missing tables and loaded vocabulary counts.
- `GET /api/onet/occupations?query=software%20developer`: occupation candidates from official and reported titles. Exact aliases appear first. Results are candidates to review; no occupation is assigned automatically.
- `GET /api/onet/occupations/15-1252.00`: occupation description, skills and knowledge sorted by O*NET importance, software examples, and task statements. Suppressed or not-relevant skill/knowledge ratings are excluded. Importance uses the original O*NET IM scale; it is not a student score.

Rank requests may optionally include `onet_soc_code` on a posting. A valid code adds the occupation's code and title to that match's response. Unknown codes are rejected. Saved postings with this field pass it through from the student page. The posting editor does not yet provide an occupation selector; the lookup endpoints make the data available for that later integration.

Occupation profiles provide context for defining and reviewing requirements. They do not prove a student has those skills or that every employer requires them, so they are not appended automatically to embedding inputs. Current matching still compares the supplied student and posting skill lists. More imported data alone does not establish improved accuracy: local job/student examples and human relevance judgments are still needed to measure ranking accuracy and calibrate thresholds. Displayed percentages are scaled cosine similarities, not probabilities of suitability.

O*NET data source and attribution details are in [ONET_DATA_NOTICE.md](ONET_DATA_NOTICE.md).
