#!/usr/bin/env python3
import json
import subprocess
import os
import sys

# Locate compliance CLI binary
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
CLI_PATH = os.path.abspath(os.path.join(SCRIPT_DIR, "../bin/compliance.js"))

class HermesAgentMock:
    def __init__(self, agent_id="hermes-default"):
        self.agent_id = agent_id
        self.run_id = "run-session-007"

    def render_tui_status_bar(self):
        """Prints a mock TUI compliance status bar on terminal console."""
        # Query status via CLI
        try:
            res = subprocess.run(
                ["node", CLI_PATH, "status", "--json"],
                capture_output=True,
                text=True,
                check=True
            )
            status = json.loads(res.stdout.strip())
            shield = "🛡️  HIPAA ENFORCED" if "HIPAA" in status["activeFrameworks"] else "🛡️  STANDARD SECURE"
            sys.stdout.write(f"\n\033[44;37m {shield} | Score: {status['systemScore']}/100 | Key: OK \033[0m\n")
        except Exception as e:
            sys.stdout.write(f"\n\033[41;37m [Compliance Daemon Offline] {str(e)} \033[0m\n")
        sys.stdout.flush()

    def run_tool(self, tool_name, arguments):
        """Simulates executing an agent tool, first running verify --mode tool."""
        print(f"\n[Hermes Agent] Planning to execute tool '{tool_name}' with args: {json.dumps(arguments)}...")
        
        payload = {
            "agent_id": self.agent_id,
            "run_id": self.run_id,
            "tool_name": tool_name,
            "arguments": arguments
        }

        # Call compliance CLI verify --mode tool
        try:
            process = subprocess.run(
                ["node", CLI_PATH, "verify", "--mode", "tool"],
                input=json.dumps(payload),
                text=True,
                capture_output=True
            )
            
            response = json.loads(process.stdout.strip())
            
            if response.get("decision") == "ALLOW":
                print(f"\033[32m[Hermes Agent] [+] TOOL ALLOWED: Executed '{tool_name}' successfully.\033[0m")
                return {"status": "SUCCESS", "output": f"Mock output from {tool_name}"}
            else:
                reason = response.get("reason", "Violates compliance rules.")
                print(f"\033[31m[Hermes Agent] [-] TOOL BLOCKED: Compliance Engine prevented '{tool_name}'. Reason: {reason}\033[0m")
                return {"status": "BLOCKED", "reason": reason}
        except Exception as e:
            print(f"\033[31m[Hermes Agent] [-] Compliance verification error: {str(e)}\033[0m")
            return {"status": "ERROR", "reason": str(e)}

    def delegate_to_agent(self, receiver_agent, has_phi):
        """Simulates A2A communication, verifying compliance scopes."""
        print(f"\n[Hermes Agent] Attempting to delegate work to external agent '{receiver_agent}' (contains PHI={has_phi})...")
        payload = {
            "sender": self.agent_id,
            "receiver": receiver_agent,
            "has_phi": has_phi,
            "signed_jwt": "jwt-scopes-phi-allowed"
        }

        try:
            process = subprocess.run(
                ["node", CLI_PATH, "verify", "--mode", "a2a"],
                input=json.dumps(payload),
                text=True,
                capture_output=True
            )
            response = json.loads(process.stdout.strip())
            if response.get("decision") == "ALLOW":
                print(f"\033[32m[Hermes Agent] [+] A2A DELEGATION ALLOWED to '{receiver_agent}'.\033[0m")
                return True
            else:
                reason = response.get("reason", "A2A Verification Blocked.")
                print(f"\033[31m[Hermes Agent] [-] A2A DELEGATION BLOCKED. Reason: {reason}\033[0m")
                return False
        except Exception as e:
            print(f"A2A verification error: {str(e)}")
            return False

    def send_data_to_platform(self, endpoint, classification, tls_version):
        """Simulates A2P webhook delivery, checking TLS and data restrictions."""
        print(f"\n[Hermes Agent] Attempting to dispatch webhook payload to '{endpoint}' (TLS={tls_version}, Class={classification})...")
        payload = {
            "endpoint": endpoint,
            "data_classification": classification,
            "tls_version": tls_version
        }

        try:
            process = subprocess.run(
                ["node", CLI_PATH, "verify", "--mode", "a2p"],
                input=json.dumps(payload),
                text=True,
                capture_output=True
            )
            response = json.loads(process.stdout.strip())
            if response.get("decision") == "ALLOW":
                print(f"\033[32m[Hermes Agent] [+] A2P DISPATCH ALLOWED to '{endpoint}'.\033[0m")
                return True
            else:
                reason = response.get("reason", "A2P Verification Blocked.")
                print(f"\033[31m[Hermes Agent] [-] A2P DISPATCH BLOCKED. Reason: {reason}\033[0m")
                return False
        except Exception as e:
            print(f"A2P verification error: {str(e)}")
            return False

if __name__ == "__main__":
    # Test script if executed directly
    agent = HermesAgentMock()
    agent.render_tui_status_bar()
    agent.run_tool("web_search", {"query": "diabetes symptoms"})
    agent.run_tool("local_file_read", {"path": "patients.txt"})
    agent.delegate_to_agent("marketing-agent", has_phi=True)
    agent.delegate_to_agent("medical-agent", has_phi=True)
    agent.send_data_to_platform("https://zapier.com/hooks/123", "phi", "TLS-1.2")
    agent.send_data_to_platform("https://zapier.com/hooks/123", "phi", "TLS-1.3")
