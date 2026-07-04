const { execSync } = require('child_process');
const path = require('path');

const CLI_PATH = path.resolve(__dirname, '../bin/compliance.js');

class OpenClawGatewayMock {
  constructor(channelId) {
    this.channelId = channelId;
  }

  /**
   * Simulates receiving a user message from a messaging channel.
   * Runs the message through the compliance CLI for redaction.
   */
  receiveMessage(text, sender) {
    console.log(`\n--- [OpenClaw Gateway] Inbound Message on Channel '${this.channelId}' from '${sender}' ---`);
    console.log(`Raw Content: "${text}"`);

    // Verify channel permission via compliance check (simulation)
    // Runs the redact command on the compliance CLI
    let redactedText = '';
    try {
      redactedText = execSync(`node "${CLI_PATH}" redact`, {
        input: text,
        encoding: 'utf8'
      }).trim();
    } catch (e) {
      console.error(`[-] Gateway compliance check failed: ${e.message}`);
      throw e;
    }

    console.log(`Gateway Filtered Output: "${redactedText}"`);
    return redactedText;
  }

  /**
   * Simulates rendering a dashboard widget populated by compliance status JSON payload.
   */
  renderDashboardWidget() {
    console.log(`\n--- [OpenClaw Gateway Dashboard] ---`);
    try {
      const statusJson = execSync(`node "${CLI_PATH}" status --json`, {
        encoding: 'utf8'
      });
      const status = JSON.parse(statusJson);
      
      console.log(`[Shield Badge]: ${status.status === 'HEALTHY' ? '🟢 HIPAA Shield Active' : '🟡 Security Warning'}`);
      console.log(`System Security Score: ${status.systemScore}/100`);
      console.log(`Active Compliance Profiles: ${status.activeFrameworks.join(', ')}`);
      console.log(`Violations Logged: ${status.totalViolationsLogged}`);
    } catch (e) {
      console.error("Failed to render gateway dashboard widget:", e.message);
    }
  }
}

module.exports = OpenClawGatewayMock;
