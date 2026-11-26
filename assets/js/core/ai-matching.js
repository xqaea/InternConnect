/* Local AI matching client. Set IC_AI_API_BASE before this file to change the service URL.
 * Every compatibility score shown to users comes from the Sentence-BERT service (semantic similarity,
 * not a hiring probability). When the service cannot score something, callers show "Score unavailable"
 * and keep a neutral order; they never substitute a different formula. */
(function (root) {
  'use strict';

  const UNAVAILABLE_LABEL = 'Score unavailable';
  const SCORE_NOTE = 'Semantic similarity from the Sentence-BERT model. Not a hiring probability.';
  // Used only if the service response carries no threshold. The service owns tau (IC_MATCH_THRESHOLD, default 0.60).
  const DEFAULT_THRESHOLD = 0.60;
  // Outbound links only: no API access and no scraping of these platforms.
  const EXTERNAL_PLATFORMS = Object.freeze([
    Object.freeze({ name: 'LinkedIn', url: 'https://www.linkedin.com/jobs/' }),
    Object.freeze({ name: 'JobStreet', url: 'https://ph.jobstreet.com/' })
  ]);

  function apiBase() {
    return String(root.IC_AI_API_BASE || 'http://127.0.0.1:8000').replace(/\/$/, '');
  }

  async function rankJobs(studentSkills, postings) {
    const response = await fetch(apiBase() + '/api/match/rank', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ student_skills: studentSkills, postings })
    });
    if (!response.ok) throw new Error('AI matching service returned ' + response.status);

    const result = await response.json();
    const scores = new Map((result.matches || [])
      .filter(match => match && typeof match.posting_id === 'string' && Number.isFinite(match.similarity))
      .map(match => [match.posting_id, match.similarity]));
    // The cutoff tau in force on the server, so the page and the service never disagree about it.
    scores.threshold = Number.isFinite(result.threshold) ? result.threshold : DEFAULT_THRESHOLD;
    return scores;
  }

  // Occupation suggestions from the local O*NET profiles (skills only, no free-text resume content is sent).
  async function fetchCareers(skills, limit) {
    const own = cleanSkills(skills).filter(skill => skill.length <= 200).slice(0, 200);
    if (!own.length) return [];
    const response = await fetch(apiBase() + '/api/match/careers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ student_skills: own, limit: limit || 3 })
    });
    if (!response.ok) throw new Error('Career suggestions returned ' + response.status);
    const result = await response.json();
    return (result.matches || []).filter(match => match && typeof match.title === 'string');
  }

  // Posting payload for /api/match/rank. Postings without required skills cannot be scored and are left out.
  function buildPostings(jobs) {
    return Object.entries(jobs || {}).map(([id, job]) => ({
      id,
      ...(job.onet_soc_code ? { onet_soc_code: job.onet_soc_code } : {}),
      required_skills: (job.skills || []).map(skill => Array.isArray(skill) ? skill[0] : skill)
        .map(skill => String(skill || '').trim()).filter(Boolean)
    })).filter(posting => posting.required_skills.length);
  }

  function cleanSkills(skills) {
    return [...new Set((skills || []).map(skill => String(skill || '').trim()).filter(Boolean))];
  }

  // Similarity of one skill list against one posting. Returns null when there is nothing to score
  // (no skills or no required skills); throws when the service is unreachable.
  async function scoreOne(skills, id, job) {
    const own = cleanSkills(skills), postings = buildPostings({ [id]: job });
    if (!own.length || !postings.length) return null;
    const scores = await rankJobs(own, postings);
    return scores.has(id) ? scores.get(id) : null;
  }

  // "87%" for a similarity in [0, 1]; null when there is no score.
  function percentText(score) {
    return Number.isFinite(score) ? Math.round(Math.max(0, Math.min(1, score)) * 100) + '%' : null;
  }

  // Sort key: missing scores go last and tie, so a stable sort keeps their original order.
  function sortValue(score) {
    return Number.isFinite(score) ? score : -1;
  }

  // state: 'loading' | 'ready' | 'unavailable'
  function badgeText(score, state) {
    const text = percentText(score);
    if (text) return text;
    return state === 'loading' ? '…' : UNAVAILABLE_LABEL;
  }

  function meetsThreshold(score, threshold) {
    return Number.isFinite(score) && score >= (Number.isFinite(threshold) ? threshold : DEFAULT_THRESHOLD);
  }

  // Ranking comparator for two postings (a negative result puts X first). Similarity decides the order.
  // Distance only breaks a tie, where a tie is the same displayed percentage (or both unscored); it is never
  // blended into the score. Unknown distances sort after known ones.
  function rankCompare(scoreX, kmX, scoreY, kmY) {
    const textX = percentText(scoreX), textY = percentText(scoreY);
    if (textX !== textY) return sortValue(scoreY) - sortValue(scoreX);
    const distX = Number.isFinite(kmX) ? kmX : Infinity, distY = Number.isFinite(kmY) ? kmY : Infinity;
    if (distX === distY) return 0;
    return distX < distY ? -1 : 1;
  }

  // Radius pre-filter. No radius, remote work and unknown distances are never excluded: the filter can only
  // remove a posting whose distance is known and beyond the radius.
  function withinRadius(km, radiusKm, isRemote) {
    if (!Number.isFinite(radiusKm) || radiusKm <= 0 || isRemote) return true;
    return !Number.isFinite(km) || km <= radiusKm;
  }

  // The fallback applies when the service answered and no eligible posting reaches tau (including no postings).
  // It does not apply while loading or when the service is down, because then nothing has been judged.
  function fallbackNeeded({ state, hasSkills, scores, ids, threshold }) {
    if (state !== 'ready' || !hasSkills) return false;
    return !(ids || []).some(id => meetsThreshold(scores && scores.get(id), threshold));
  }

  root.ICCore = root.ICCore || {};
  const api = Object.freeze({
    rankJobs, buildPostings, scoreOne, percentText, sortValue, badgeText,
    meetsThreshold, rankCompare, withinRadius, fallbackNeeded, fetchCareers,
    UNAVAILABLE_LABEL, SCORE_NOTE, DEFAULT_THRESHOLD, EXTERNAL_PLATFORMS
  });
  root.ICCore.aiMatching = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
