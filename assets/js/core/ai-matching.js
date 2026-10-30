/* Local AI matching client. Set IC_AI_API_BASE before this file to change the service URL. */
(function (root) {
  'use strict';

  async function rankJobs(studentSkills, postings) {
    const base = String(root.IC_AI_API_BASE || 'http://127.0.0.1:8000').replace(/\/$/, '');
    const response = await fetch(base + '/api/match/rank', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ student_skills: studentSkills, postings })
    });
    if (!response.ok) throw new Error('AI matching service returned ' + response.status);

    const result = await response.json();
    return new Map((result.matches || [])
      .filter(match => match && typeof match.posting_id === 'string' && Number.isFinite(match.similarity))
      .map(match => [match.posting_id, match.similarity]));
  }

  root.ICCore = root.ICCore || {};
  root.ICCore.aiMatching = Object.freeze({ rankJobs });
})(window);
