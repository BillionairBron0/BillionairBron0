import { validateEvents } from '../eventValidator';

describe('eventValidator', () => {
  test('flags missing required fields', () => {
    const issues = validateEvents([{ type:'actionableSignal', side:'LONG' }]);
    expect(issues.find(i=>i.field==='time')).toBeTruthy();
    expect(issues.find(i=>i.field==='price')).toBeTruthy();
  });
  test('unknown type flagged', () => {
    const issues = validateEvents([{ type:'mystery' }]);
    expect(issues.some(i=>i.message==='unknown_type')).toBe(true);
  });
});