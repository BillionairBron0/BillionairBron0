import Ajv from 'ajv';
import schema from '../../shared/eventSchema.json' assert { type: 'json' };

const ajv = new Ajv({ allErrors: true });
const validate = ajv.compile(schema);

export function validateEvents(events) {
  const failures = [];
  for (const ev of events) {
    const ok = validate(ev);
    if (!ok) failures.push({ event: ev, errors: validate.errors });
  }
  return failures;
}