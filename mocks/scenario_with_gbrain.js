const OpenClawGatewayMock = require('./openclaw_gateway');
const GBrainMemoryMock = require('./gbrain_memory');
const { execSync } = require('child_process');
const path = require('path');

const AGENT_MOCK_PATH = path.resolve(__dirname, 'hermes_agent.py');
const CLI_PATH = path.resolve(__dirname, '../bin/compliance.js');

console.log("\n==================================================================");
console.log("RUNNING SCENARIO 2: OpenClaw + Hermes + GBrain Integration");
console.log("==================================================================");

// 1. Initialize Mocks
const gateway = new OpenClawGatewayMock('teams-medical-channel');
const gbrain = new GBrainMemoryMock();

// 2. OpenClaw receives user data containing PHI/PII and sanitizes it
const userInput = "Patient Alice (MRN-998823) has been diagnosed with Flu.";
const sanitizedInput = gateway.receiveMessage(userInput, 'doctor-bob');

// 3. Hermes decides to store this patient data in GBrain's memory
// We simulate writing to GBrain under 'phi' classification
const pageId = 'records/patient-alice';
gbrain.writePage(pageId, sanitizedInput, 'phi');

// 4. Verification Read - Case A: Client has authorized scopes
const authorizedRead = gbrain.readPage(pageId, ['phi:read']);
console.log(`Read Plaintext Result (Authorized): "${authorizedRead}"`);

// 5. Verification Read - Case B: Client lacks scopes (unauthorized agent)
const unauthorizedRead = gbrain.readPage(pageId, ['public:read']);
console.log(`Read Plaintext Result (Unauthorized): "${unauthorizedRead}"`);

// 6. Leak Simulation - Plaintext PII is written to a public database page
console.log("\n[Leak Simulation] Bypassing gateway; writing plain text PII directly to public GBrain page...");
const publicPageId = 'wiki/public-sharing-page';
const leakContent = "Shared note: contact marketing coordinator at john.doe@company.com or call 555-9011.";
gbrain.writePage(publicPageId, leakContent, 'public');

// 7. Dream Cycle Audit - Background cron scanner runs overnight and flags the leak
const detectedLeaks = gbrain.runDreamCycleAudit();
console.log(`[Dream Cycle Outcome] Audit detected ${detectedLeaks} violations.`);

// 8. Render final Gateway compliance status showing the logged violation
gateway.renderDashboardWidget();

console.log("\n==================================================================");
console.log("SCENARIO 2 COMPLETED");
console.log("==================================================================\n");
