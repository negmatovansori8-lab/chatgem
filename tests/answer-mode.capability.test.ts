import { describe, expect, it } from "vitest";
import {
  answerModeBlock,
  detectAnswerPlan,
  detectAnswerPlanInContext,
  withDeliverableReminder,
} from "../src/lib/assistant/answer-mode";

describe("«can you …?» questions get a yes/no answer first", () => {
  it("treats a short «can you give a prompt?» as a capability question", () => {
    for (const q of [
      "ПРОМТ ДОДА МЕТОНИ",
      "промт дода метонӣ?",
      "ту метавонӣ ба ман промт нависӣ?",
      "можешь написать промпт?",
      "Can you write a prompt?",
    ]) {
      const plan = detectAnswerPlan(q);
      expect(plan.mode, q).toBe("simple");
      expect(plan.capability, q).toBe("prompt");
    }
  });

  it("does not deliver the prompt for a capability question", () => {
    const plan = detectAnswerPlan("промт дода метони");
    const block = answerModeBlock(plan, "tg");
    expect(block).toContain("YES/NO CAPABILITY QUESTION");
    expect(block).not.toContain("READY-TO-USE PROMPT");
    expect(withDeliverableReminder("промт дода метони", plan, "tg")).toBe("промт дода метони");
  });

  it("treats «can you build a site?» the same way", () => {
    expect(detectAnswerPlan("метонӣ сайт созӣ?").capability).toBe("build");
  });

  it("still delivers when the request is a command", () => {
    expect(detectAnswerPlan("барои Cursor промт навис").mode).toBe("prompt");
  });

  it("delivers a detailed «can you» request, but starts with yes", () => {
    const plan = detectAnswerPlan(
      "метонӣ барои сайти онлайн-мағозаи либос бо сабад, пардохт ва панели админ промт нависӣ?",
    );
    expect(plan.mode).toBe("prompt");
    expect(plan.askedAbility).toBe(true);
    expect(answerModeBlock(plan, "tg")).toContain("Ҳа, метавонам.");
  });

  it("the go-ahead after a capability answer produces the prompt", () => {
    const previous = "промт дода метони";
    expect(detectAnswerPlanInContext("ҳа, деҳ", previous).mode).toBe("prompt");
    expect(detectAnswerPlanInContext("барои сайти онлайн-мағоза", previous).mode).toBe("prompt");
    expect(detectAnswerPlanInContext("пойтахти Фаронса?", previous).mode).toBe("simple");
  });
});
