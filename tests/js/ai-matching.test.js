// Offline tests for assets/js/core/ai-matching.js. Run: node --test tests/js/
const test = require('node:test');
const assert = require('node:assert/strict');
const ai = require('../../assets/js/core/ai-matching.js');

function fakeFetch(handler) {
  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push({ url, body: JSON.parse(options.body) });
    return handler(calls[calls.length - 1]);
  };
  return calls;
}
const json = body => ({ ok: true, json: async () => body });

test.afterEach(() => { delete globalThis.fetch; delete globalThis.IC_AI_API_BASE; });

test('buildPostings keeps skill names, trims, and drops postings with no required skills', () => {
  const postings = ai.buildPostings({
    a: { skills: [['SQL', true], [' Python ', false]], onet_soc_code: '15-1252.00' },
    b: { skills: [] },
    c: { skills: ['Canva', '', '  '] },
    d: {}
  });
  assert.deepEqual(postings, [
    { id: 'a', onet_soc_code: '15-1252.00', required_skills: ['SQL', 'Python'] },
    { id: 'c', required_skills: ['Canva'] }
  ]);
});

test('percentText rounds, clamps, and returns null without a score', () => {
  assert.equal(ai.percentText(0.874), '87%');
  assert.equal(ai.percentText(0), '0%');
  assert.equal(ai.percentText(-0.2), '0%');
  assert.equal(ai.percentText(1.4), '100%');
  for (const missing of [undefined, null, NaN, '0.5']) assert.equal(ai.percentText(missing), null);
});

test('badgeText shows a loading mark, the score, or "Score unavailable" and never a made-up number', () => {
  assert.equal(ai.badgeText(undefined, 'loading'), '…');
  assert.equal(ai.badgeText(undefined, 'unavailable'), 'Score unavailable');
  assert.equal(ai.badgeText(NaN, 'ready'), 'Score unavailable');
  assert.equal(ai.badgeText(0.5, 'ready'), '50%');
});

test('unscored items tie at the bottom and keep their original order', () => {
  const items = [
    { id: 'first-unscored' }, { id: 'mid', score: 0.5 }, { id: 'second-unscored' }, { id: 'top', score: 0.9 }
  ];
  items.sort((x, y) => ai.sortValue(y.score) - ai.sortValue(x.score));
  assert.deepEqual(items.map(item => item.id), ['top', 'mid', 'first-unscored', 'second-unscored']);

  const none = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
  none.sort((x, y) => ai.sortValue(y.score) - ai.sortValue(x.score));
  assert.deepEqual(none.map(item => item.id), ['a', 'b', 'c']);
});

test('rankJobs posts to the configured service and returns similarities by posting id', async () => {
  globalThis.IC_AI_API_BASE = 'http://ai.test:9000/';
  const calls = fakeFetch(() => json({ matches: [
    { posting_id: 'p1', similarity: 0.62 }, { posting_id: 'bad', similarity: 'x' }, { similarity: 0.1 }
  ] }));
  const scores = await ai.rankJobs(['Python'], [{ id: 'p1', required_skills: ['SQL'] }]);
  assert.equal(calls[0].url, 'http://ai.test:9000/api/match/rank');
  assert.deepEqual(calls[0].body, { student_skills: ['Python'], postings: [{ id: 'p1', required_skills: ['SQL'] }] });
  assert.deepEqual([...scores], [['p1', 0.62]]);
});

test('scoreOne returns the service similarity for one applicant and posting', async () => {
  const calls = fakeFetch(() => json({ matches: [{ posting_id: 'job-1', similarity: 0.71 }] }));
  const score = await ai.scoreOne([' Python ', 'Python', 'SQL'], 'job-1', { skills: [['SQL', true]] });
  assert.equal(score, 0.71);
  assert.deepEqual(calls[0].body.student_skills, ['Python', 'SQL']);
});

test('scoreOne returns null, without calling the service, when there is nothing to score', async () => {
  const calls = fakeFetch(() => json({ matches: [] }));
  assert.equal(await ai.scoreOne([], 'job-1', { skills: [['SQL', true]] }), null);
  assert.equal(await ai.scoreOne(['Python'], 'job-1', { skills: [] }), null);
  assert.equal(calls.length, 0);
});

test('when the service is down scoreOne fails instead of returning a substitute number', async () => {
  fakeFetch(() => ({ ok: false, status: 503 }));
  await assert.rejects(ai.scoreOne(['Python'], 'job-1', { skills: [['SQL', true]] }), /503/);
  globalThis.fetch = async () => { throw new TypeError('Failed to fetch'); };
  await assert.rejects(ai.scoreOne(['Python'], 'job-1', { skills: [['SQL', true]] }), /Failed to fetch/);
});

test('the score note says it is similarity, not a hiring probability', () => {
  assert.match(ai.SCORE_NOTE, /similarity/i);
  assert.match(ai.SCORE_NOTE, /not a hiring probability/i);
});

test('rankJobs carries the server threshold, falling back to 0.60 only if the response has none', async () => {
  fakeFetch(() => json({ threshold: 0.55, matches: [{ posting_id: 'p1', similarity: 0.5 }] }));
  assert.equal((await ai.rankJobs(['Python'], [{ id: 'p1', required_skills: ['SQL'] }])).threshold, 0.55);
  fakeFetch(() => json({ matches: [{ posting_id: 'p1', similarity: 0.5 }] }));
  assert.equal((await ai.rankJobs(['Python'], [{ id: 'p1', required_skills: ['SQL'] }])).threshold, 0.6);
  assert.equal(ai.DEFAULT_THRESHOLD, 0.6);
});

test('meetsThreshold needs a real score at or above tau', () => {
  assert.equal(ai.meetsThreshold(0.6, 0.6), true);
  assert.equal(ai.meetsThreshold(0.59, 0.6), false);
  assert.equal(ai.meetsThreshold(undefined, 0.6), false);
  assert.equal(ai.meetsThreshold(NaN, 0.6), false);
  assert.equal(ai.meetsThreshold(0.61, undefined), true);
});

test('rankCompare orders by similarity and uses distance only to break a tie', () => {
  const rows = [
    { id: 'far-tie', score: 0.612, km: 30 },
    { id: 'low', score: 0.40, km: 1 },
    { id: 'near-tie', score: 0.614, km: 2 },
    { id: 'best-far', score: 0.90, km: 99 },
    { id: 'unknown-tie', score: 0.613, km: undefined }
  ];
  rows.sort((x, y) => ai.rankCompare(x.score, x.km, y.score, y.km));
  // 0.612, 0.613 and 0.614 all display as 61%, so distance orders them; similarity alone never loses to distance.
  assert.deepEqual(rows.map(row => row.id), ['best-far', 'near-tie', 'far-tie', 'unknown-tie', 'low']);
});

test('rankCompare keeps unscored postings together and breaks their ties by distance', () => {
  assert.equal(ai.rankCompare(undefined, 5, undefined, 5), 0);
  assert.ok(ai.rankCompare(undefined, 1, undefined, 9) < 0);
  assert.ok(ai.rankCompare(0.5, 99, undefined, 1) < 0);
});

test('withinRadius only removes postings whose known distance is beyond the radius', () => {
  assert.equal(ai.withinRadius(12, 10, false), false);
  assert.equal(ai.withinRadius(10, 10, false), true);
  assert.equal(ai.withinRadius(3, 10, false), true);
  assert.equal(ai.withinRadius(undefined, 10, false), true);
  assert.equal(ai.withinRadius(500, 10, true), true);
  for (const radius of [0, undefined, null, NaN]) assert.equal(ai.withinRadius(500, radius, false), true);
});

test('fallbackNeeded fires only after the service answered and no eligible posting reaches tau', () => {
  const scores = new Map([['a', 0.59], ['b', 0.2]]);
  const base = { state: 'ready', hasSkills: true, scores, ids: ['a', 'b'], threshold: 0.6 };
  assert.equal(ai.fallbackNeeded(base), true);
  assert.equal(ai.fallbackNeeded({ ...base, scores: new Map([['a', 0.6], ['b', 0.2]]) }), false);
  assert.equal(ai.fallbackNeeded({ ...base, ids: [] }), true);              // no postings at all
  assert.equal(ai.fallbackNeeded({ ...base, ids: ['a'], scores: new Map([['b', 0.9]]) }), true); // only eligible ids count
  assert.equal(ai.fallbackNeeded({ ...base, state: 'loading' }), false);
  assert.equal(ai.fallbackNeeded({ ...base, state: 'unavailable' }), false);  // nothing was judged
  assert.equal(ai.fallbackNeeded({ ...base, hasSkills: false }), false);
});

test('external platforms are plain outbound links', () => {
  assert.deepEqual(ai.EXTERNAL_PLATFORMS.map(platform => platform.name), ['LinkedIn', 'JobStreet']);
  for (const platform of ai.EXTERNAL_PLATFORMS) assert.match(platform.url, /^https:\/\//);
});

test('fetchCareers sends skills only and returns the occupation matches', async () => {
  const calls = fakeFetch(() => json({ matches: [{ title: 'Software Developers', alignment_percent: 61.2 }, { nope: true }] }));
  const matches = await ai.fetchCareers([' Python ', 'Python', 'SQL', 'x'.repeat(201)], 3);
  assert.equal(calls[0].url.endsWith('/api/match/careers'), true);
  assert.deepEqual(calls[0].body, { student_skills: ['Python', 'SQL'], limit: 3 });
  assert.deepEqual(matches.map(match => match.title), ['Software Developers']);
});

test('fetchCareers skips the request without skills and fails when the service errors', async () => {
  const calls = fakeFetch(() => ({ ok: false, status: 503 }));
  assert.deepEqual(await ai.fetchCareers([], 3), []);
  assert.equal(calls.length, 0);
  await assert.rejects(ai.fetchCareers(['Python'], 3), /503/);
});
