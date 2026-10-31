import { describe, expect, it } from "vitest";

import errorHandlerJson from "../n8n/workflows/error-handler.json";
import loanEventsJson from "../n8n/workflows/loan-events.json";
import overdueJson from "../n8n/workflows/overdue-reminders.json";

type WorkflowNode = {
  name: string;
  type: string;
  parameters?: Record<string, unknown>;
  retryOnFail?: boolean;
  maxTries?: number;
  waitBetweenTries?: number;
};

type WorkflowConnectionTarget = { node: string; type?: string; index?: number };

type Workflow = {
  id: string;
  name: string;
  active: boolean;
  nodes: WorkflowNode[];
  connections: Record<
    string,
    { main?: Array<Array<WorkflowConnectionTarget>> }
  >;
  settings?: { errorWorkflow?: string };
};

const errorHandler = errorHandlerJson as unknown as Workflow;
const loanEvents = loanEventsJson as unknown as Workflow;
const overdue = overdueJson as unknown as Workflow;

function node(workflow: Workflow, name: string): WorkflowNode {
  const found = workflow.nodes.find((candidate) => candidate.name === name);
  if (!found) throw new Error(`Missing node "${name}" in ${workflow.name}`);
  return found;
}

function codeOf(workflow: Workflow, name: string): string {
  const jsCode = node(workflow, name).parameters?.jsCode;
  if (typeof jsCode !== "string") {
    throw new Error(`Node "${name}" has no jsCode`);
  }
  return jsCode;
}

describe("n8n workflow exports", () => {
  const all = [errorHandler, loanEvents, overdue];

  it("have unique ids and names and are exported inactive", () => {
    const ids = all.map((workflow) => workflow.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const workflow of all) {
      expect(workflow.name.length).toBeGreaterThan(0);
      expect(workflow.active).toBe(false);
      expect(workflow.nodes.length).toBeGreaterThan(0);
    }
  });

  it("only connect nodes that exist", () => {
    for (const workflow of all) {
      const names = new Set(workflow.nodes.map((item) => item.name));
      for (const [source, connection] of Object.entries(workflow.connections)) {
        expect(names.has(source), `${workflow.name}: source ${source}`).toBe(true);
        for (const branch of connection.main ?? []) {
          for (const target of branch) {
            expect(
              names.has(target.node),
              `${workflow.name}: ${source} → ${target.node}`,
            ).toBe(true);
          }
        }
      }
    }
  });

  it("wire both operational workflows to the error workflow", () => {
    expect(node(errorHandler, "On workflow error").type).toBe(
      "n8n-nodes-base.errorTrigger",
    );
    expect(errorHandler.settings?.errorWorkflow).toBeUndefined();

    for (const workflow of [loanEvents, overdue]) {
      expect(workflow.settings?.errorWorkflow).toBe(errorHandler.id);
    }
  });

  it("verify the inbound HMAC before normalising or notifying", () => {
    const webhook = node(loanEvents, "Loan event webhook");
    expect(webhook.type).toBe("n8n-nodes-base.webhook");
    expect(webhook.parameters).toMatchObject({
      httpMethod: "POST",
      path: "lendloop/loan-events",
      responseMode: "responseNode",
      options: { rawBody: true },
    });

    const verify = codeOf(loanEvents, "Verify HMAC");
    expect(verify).toContain("$env.LENDLOOP_HMAC_SECRET");
    expect(verify).toContain("createHmac('sha256'");
    expect(verify).toContain("timingSafeEqual");
    expect(verify).toContain("> 300");
    expect(verify).toContain("x-lendloop-signature");
    expect(verify).toContain("x-lendloop-timestamp");

    const invalidBranch = loanEvents.connections["Signature valid?"]?.main?.[1]?.[0];
    expect(invalidBranch?.node).toBe("Respond 401");
    const validBranch = loanEvents.connections["Signature valid?"]?.main?.[0]?.[0];
    expect(validBranch?.node).toBe("Normalize payload");
  });

  it("send only minimised notification fields", () => {
    const normalize = codeOf(loanEvents, "Normalize payload");
    expect(normalize).toContain("recipientEmail");
    expect(normalize).toContain("toolName");
    expect(normalize).not.toContain("description");
    expect(normalize).not.toContain("message");

    const log = codeOf(loanEvents, "Log notification (mock)");
    expect(log).toContain("maskedEmail");
    expect(log).not.toContain("console.log(n.recipient.email)");
  });

  it("run the overdue workflow daily and sign both directions", () => {
    const schedule = node(overdue, "Daily at 09:00 UTC");
    expect(schedule.type).toBe("n8n-nodes-base.scheduleTrigger");
    expect(schedule.parameters).toMatchObject({
      rule: { interval: [{ field: "cronExpression", expression: "0 9 * * *" }] },
    });

    const fetchNode = node(overdue, "Fetch overdue loans");
    expect(fetchNode.parameters).toMatchObject({
      method: "GET",
      url: "={{ $json.url }}",
    });
    expect(fetchNode.retryOnFail).toBe(true);
    expect(fetchNode.maxTries).toBe(3);
    expect(fetchNode.waitBetweenTries).toBeGreaterThan(0);

    const writeBack = node(overdue, "Record reminder in Convex");
    expect(writeBack.parameters).toMatchObject({
      method: "POST",
      url: "={{ $json.url }}",
    });
    expect(writeBack.retryOnFail).toBe(true);
    expect(writeBack.maxTries).toBe(3);

    const signGet = codeOf(overdue, "Sign overdue feed request");
    expect(signGet).toContain("/n8n/overdue");
    expect(signGet).toContain("$env.LENDLOOP_CONVEX_URL");
    expect(signGet).toContain("$env.LENDLOOP_HMAC_SECRET");
    expect(signGet).toContain("createHmac('sha256'");

    const signPost = codeOf(overdue, "Sign reminder write-back");
    expect(signPost).toContain("/n8n/reminders");
    expect(signPost).toContain("JSON.stringify({");
    expect(signPost).toContain("reminderDate");
    expect(signPost).toContain("status: 'sent'");
  });

  it("contain no secret values or embedded credentials", () => {
    const serialized = JSON.stringify(all);
    for (const forbidden of [
      "dev_local_only",
      "LENDLOOP_HMAC_SECRET=",
      "N8N_HMAC_SECRET=",
      "sk_test_",
      "sk_live_",
      "Bearer ",
      "api_key",
    ]) {
      expect(serialized).not.toContain(forbidden);
    }
    expect(serialized).toContain("$env.LENDLOOP_HMAC_SECRET");
  });
});
