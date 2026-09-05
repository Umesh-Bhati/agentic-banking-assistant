const fs = require('fs');
let content = fs.readFileSync('src/routes/chat.ts', 'utf8');

function getStepEnum(stepName) {
  if (stepName === 'ask-date-range') return 'WAITING_DATE_RANGE';
  if (stepName === 'ask-account-selection') return 'WAITING_ACCOUNT_SELECTION';
  if (stepName === 'ask-fee-acceptance') return 'WAITING_FEE_ACCEPTANCE';
  return 'WAITING_FEE_ACCEPTANCE'; // fallback
}

// 1. Patch startStatementWorkflow step assignment
content = content.replace(
  /step: 'WAITING_FEE_ACCEPTANCE',(\s*)data: \{ runId: workflowResult\.runId, suspendedStep: suspendedStepName \},/g,
  `step: suspendedStepName === 'ask-date-range' ? 'WAITING_DATE_RANGE' : suspendedStepName === 'ask-account-selection' ? 'WAITING_ACCOUNT_SELECTION' : 'WAITING_FEE_ACCEPTANCE',
          data: { runId: workflowResult.runId, suspendedStep: suspendedStepName },`
);

// 2. Patch startStatementWorkflow suspendData extraction
content = content.replace(
  /const stepData = suspendData\?\.\['ask-fee-acceptance'\] \|\| suspendData;\s*const suspendMessage = stepData\?\.reason \|\| 'Generating this statement will cost 25 AED\. Do you accept\?';/g,
  `const stepData = suspendData?.[suspendedStepName] || suspendData;
        let suspendMessage = stepData?.reason || 'Generating this statement will cost 25 AED. Do you accept?';
        if (suspendedStepName === 'ask-account-selection' && stepData?.accounts) {
          suspendMessage += '\\n\\n' + stepData.accounts.map((a, i) => \`\${i + 1}. \${a.type} (\${a.account_number})\`).join('\\n');
        }`
);

// 3. Patch handleActiveWorkflow step handling for statement-workflow
const newHandleStr = `
        if (workflowState.step === 'WAITING_DATE_RANGE') {
          resumeData = { fromDate: '2026-08-01', toDate: '2026-09-01' }; // Simple mock dates
        } else if (workflowState.step === 'WAITING_ACCOUNT_SELECTION') {
          // simple mock selection matching
          const { data: accounts } = await supabase.from('bank_accounts').select('id, type').eq('customer_id', customerId);
          const lowerMsg = message.toLowerCase();
          const matched = accounts?.find(a => lowerMsg.includes(a.type.toLowerCase())) || accounts?.[0];
          if (matched) {
            resumeData = { accountId: matched.id };
          } else {
            await streamText('Could not understand account selection. Please specify Current or Savings.', callbacks.sendToken);
            callbacks.sendWorkflowSuspended(workflowState);
            return;
          }
        } else if (workflowState.step === 'WAITING_FEE_ACCEPTANCE') {
`;
content = content.replace(/if \(workflowState\.step === 'WAITING_FEE_ACCEPTANCE'\) \{/g, newHandleStr);

fs.writeFileSync('src/routes/chat.ts', content);
