const fs = require('fs');
let content = fs.readFileSync('src/workflows/statement-workflow.ts', 'utf8');

content = content.replace(
  "url: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf'",
  "url: \`http://localhost:3000/api/statements?accountId=\${account.id}&fromDate=\${inputData.fromDate || ''}&toDate=\${inputData.toDate || ''}\`"
);

fs.writeFileSync('src/workflows/statement-workflow.ts', content);
