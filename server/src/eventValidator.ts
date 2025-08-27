// Lightweight structural validation of generated events
interface ValidationIssue { index:number; field:string; message:string }
const REQUIRED_BY_TYPE: Record<string,string[]> = {
	actionableSignal: ['type','side','time','price','confirmations','leadingIndicator'],
	watchOpportunity: ['type','side','time','price','confirmationsPassed','confirmationsMissing'],
	cancelledSetup: ['type','side','reason'],
	expiredSetup: ['type','side','reason']
};
export function validateEvents(evts:any[]): ValidationIssue[] {
	const issues:ValidationIssue[]=[]; evts.forEach((e,idx)=>{
		if(!e || typeof e!=='object'){ issues.push({ index:idx, field:'', message:'not_object'}); return; }
		const req = REQUIRED_BY_TYPE[e.type]; if(req){ for(const f of req){ if(e[f]===undefined) issues.push({ index:idx, field:f, message:'missing'}); }
		} else { issues.push({ index:idx, field:'type', message:'unknown_type'}); }
	}); return issues;
}