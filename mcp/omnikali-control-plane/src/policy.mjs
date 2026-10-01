const SAFE = new Set(['device.identity','device.list','fs.read','fs.list','fs.search','process.list','android.rish','android.screenshot','android.ui.snapshot','android.ui.find','app.inspect','model.status','model.ask','human.status']);
const MUTATING = new Set(['fs.write','fs.move','process.exec','process.kill','android.input','android.ui.tap','android.ui.text','android.ui.back','app.launch','app.stop']);
const SENSITIVE = new Set(['fs.write','fs.move','process.exec','process.kill','android.input','android.ui.tap','android.ui.text','android.ui.back','app.launch','app.stop']);

export function authorize(tool, { token, requiredToken, confirmation = false } = {}) {
  if (!requiredToken || token !== requiredToken) throw new Error('UNAUTHORIZED');
  if (!SAFE.has(tool) && !MUTATING.has(tool)) throw new Error('TOOL_NOT_ALLOWLISTED');
  if (SENSITIVE.has(tool) && !confirmation) throw new Error('CONFIRMATION_REQUIRED');
  return true;
}

export function toolClass(tool) {
  if (SAFE.has(tool)) return 'SAFE';
  if (MUTATING.has(tool)) return 'MUTATING';
  return 'DENIED';
}
