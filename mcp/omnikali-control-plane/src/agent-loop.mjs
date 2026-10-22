import { createHumanCheckpoint, clearHumanNotification, waitForHuman } from './human-gate.mjs';

const HUMAN_PATTERNS = [
  /captcha/i,
  /verify\s+(?:you(?:'re| are)|human)/i,
  /i'?m\s+not\s+a\s+robot/i,
  /two[- ]factor/i,
  /\b2fa\b/i,
  /biometric/i,
  /fingerprint/i,
  /face\s+(?:id|unlock)/i,
  /passcode/i,
  /one[- ]time\s+(?:code|password)/i,
  /\botp\b/i,
  /payment\s+(?:approval|verification)/i,
  /security\s+(?:check|verification)/i,
];

export function detectHumanBoundary(nodes = []) {
  const hits = [];
  for (const node of nodes) {
    const text = [node.text, node.desc, node.resourceId].filter(Boolean).join(' ');
    if (HUMAN_PATTERNS.some(pattern => pattern.test(text))) hits.push({ index: node.index, text: node.text, desc: node.desc, resourceId: node.resourceId });
  }
  return hits;
}

export function parsePlannerResponse(raw) {
  if (typeof raw !== 'string') throw new Error('PLANNER_RESPONSE_REQUIRED');
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1] || raw;
  const start = fenced.indexOf('{');
  const end = fenced.lastIndexOf('}');
  if (start < 0 || end < start) throw new Error('PLANNER_JSON_REQUIRED');
  const value = JSON.parse(fenced.slice(start, end + 1));
  if (!['CONTINUE','HUMAN_REQUIRED','DONE'].includes(value.status)) throw new Error('PLANNER_STATUS_INVALID');
  if (value.status === 'CONTINUE') {
    if (!value.action || !['tap','text','back'].includes(value.action.type)) throw new Error('PLANNER_ACTION_INVALID');
    if (value.action.type !== 'back' && !value.action.selector) throw new Error('PLANNER_SELECTOR_REQUIRED');
  }
  return value;
}

function selectorKeys(selector = {}) {
  return ['resourceId','contentDescription','text','className','packageName','clickable'].filter(k => selector[k] !== undefined && selector[k] !== '');
}

export function chooseNode(nodes, selector) {
  const keys = selectorKeys(selector);
  if (!keys.length) throw new Error('SELECTOR_REQUIRED');
  const matches = nodes.filter(node => keys.every(key => {
    if (key === 'clickable') return node.clickable === selector[key];
    const actual = String(node[key] || '').toLowerCase();
    const expected = String(selector[key]).toLowerCase();
    return key === 'text' || key === 'contentDescription' ? actual.includes(expected) : actual === expected;
  }));
  if (matches.length === 0) throw new Error('SELECTOR_NOT_FOUND');
  if (matches.length > 1) throw new Error('SELECTOR_AMBIGUOUS');
  return matches[0];
}

export function verifyExpected(nodes, expected = {}) {
  if (!expected || Object.keys(expected).length === 0) return { verified: true, reason: 'no explicit expected selector' };
  try {
    const node = chooseNode(nodes, expected);
    return { verified: true, node };
  } catch (error) {
    return { verified: false, reason: error.message };
  }
}

export async function runAgentLoop({ goal, maxSteps = 8, snapshot, act, askModel, provider = 'openai', broccoliRoot, humanTimeoutMs = 300000 }) {
  if (!goal?.trim()) throw new Error('GOAL_REQUIRED');
  if (!Number.isInteger(maxSteps) || maxSteps < 1 || maxSteps > 20) throw new Error('MAX_STEPS_OUT_OF_RANGE');
  const trace = [];
  const pauseAtHumanGate = async (step, hits, nodes, reason) => {
    const checkpoint = await createHumanCheckpoint({ broccoliRoot, goal, step, reason, hits, nodes });
    const waited = await waitForHuman({ snapshot, checkpoint, detectHumanBoundary, timeoutMs: humanTimeoutMs });
    if (waited.status === 'RESUMED') {
      await clearHumanNotification(checkpoint.id, broccoliRoot);
      return { snapshot: waited.snapshot, checkpoint };
    }
    return { snapshot: null, checkpoint };
  };
  for (let step = 1; step <= maxSteps; step += 1) {
    const before = await snapshot();
    const human = detectHumanBoundary(before.nodes);
    if (human.length) {
      const resumed = await pauseAtHumanGate(step, human, before.nodes, 'security_or_authorization_boundary');
      if (!resumed.snapshot) return { status:'WAITING_FOR_HUMAN', reason:'security_or_authorization_boundary', trace, checkpoint:resumed.checkpoint };
      trace.push({ step, humanGate:'RESUMED', checkpoint:resumed.checkpoint, resumeSnapshot:resumed.snapshot });
      continue;
    }
    const prompt = JSON.stringify({
      role:'OmniKali UI planner',
      rules:[
        'Return JSON only.',
        'Use only tap, text, or back actions.',
        'Never attempt CAPTCHA, authorization, biometric, payment approval, or security checks.',
        'Select exactly one current node for tap/text using semantic selector fields.',
        'After acting, require an expected selector when practical.',
        'Return DONE only when the goal is visibly verified.',
        'Return HUMAN_REQUIRED when the goal needs a person or the state is unsafe/ambiguous.'
      ],
      goal,
      step,
      nodes:before.nodes,
    });
    const planned = parsePlannerResponse((await askModel(provider, prompt)).text || '');
    trace.push({ step, before, planned });
    if (planned.status === 'HUMAN_REQUIRED') return { status:'HUMAN_REQUIRED', reason:planned.reason || 'planner_requested_human', checkpoint:{step,goal,nodes:before.nodes}, trace };
    if (planned.status === 'DONE') return { status:'DONE', goal, trace };
    let node = null;
    try {
      if (planned.action.type !== 'back') node = chooseNode(before.nodes, planned.action.selector);
    } catch (error) {
      trace[trace.length - 1].decisionError = error.message;
      if (error.message === 'SELECTOR_NOT_FOUND' || error.message === 'SELECTOR_AMBIGUOUS') continue;
      throw error;
    }
    if (planned.action.type === 'text' && !/EditText|TextInput/i.test(node.className || '')) throw new Error('TEXT_TARGET_NOT_EDITABLE');
    const action = planned.action.type === 'back'
      ? { type:'back' }
      : { type:planned.action.type, node, text:planned.action.text };
    const actionResult = await act(action);
    const after = await snapshot();
    const humanAfter = detectHumanBoundary(after.nodes);
    const verification = verifyExpected(after.nodes, planned.expected);
    trace[trace.length - 1].actionResult = actionResult;
    trace[trace.length - 1].after = after;
    trace[trace.length - 1].verification = verification;
    if (humanAfter.length) {
      const resumed = await pauseAtHumanGate(step, humanAfter, after.nodes, 'security_or_authorization_boundary');
      if (!resumed.snapshot) return { status:'WAITING_FOR_HUMAN', reason:'security_or_authorization_boundary', trace, checkpoint:resumed.checkpoint };
      trace[trace.length - 1].humanGate = 'RESUMED';
      trace[trace.length - 1].humanCheckpoint = resumed.checkpoint;
      trace[trace.length - 1].humanResumeSnapshot = resumed.snapshot;
    }
    if (!verification.verified) {
      trace[trace.length - 1].replan = verification.reason;
      continue;
    }
  }
  return { status:'STEP_LIMIT_REACHED', goal, trace };
}
