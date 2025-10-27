/**
 * Tools available to the auto agent.
 *
 * The agent currently exposes a single automation tool that forwards a fixed
 * payload to the automation service, with the LLM only selecting a case name.
 */
import { randomUUID } from "node:crypto";
import { tool } from "@langchain/core/tools";
import { z } from "zod";

export interface AutomationRequest {
  header: {
    id: string;
    timestamp: number;
  };
  data: {
    case_name: string;
    auto_pre_data: Record<string, string>;
    step: number;
    user_data: {
      TSP_PM: { user_id: string; password: string };
      TSP_RE: { user_id: string; password: string };
      PC_PM: { user_id: string; password: string };
      PC_RE: { user_id: string; password: string };
    };
    header_id: string;
    total_steps: number;
    run_config: {
      isAsync?: boolean; // 是否异步执行
      isClosePage?: boolean; // 执行完案例后是否关闭窗口
      isLogout?: boolean;
      isConfirm?: boolean;
    }
  };
}

const AUTOMATION_ENDPOINT = "http://localhost:3002/routers/auto/start";

const AUTOMATION_CASE_NAMES = [
  "IMLC_001",
  "TEST_001",
] as const;

const automationCaseSchema = z.object({
  caseName: z.enum(AUTOMATION_CASE_NAMES, {
    message: `Use one of: ${AUTOMATION_CASE_NAMES.join(", ")}`,
  }),
});

const DEFAULT_AUTO_PRE_DATA: Record<string, string> = {};

const DEFAULT_USER_DATA: AutomationRequest["data"]["user_data"] = {
  TSP_PM: { user_id: "csasiaop1", password: "csasiaop1" },
  TSP_RE: { user_id: "csasiaop1", password: "csasiaop1" },
  PC_PM: { user_id: "csasiaop1", password: "csasiaop1" },
  PC_RE: { user_id: "csasiaop1", password: "csasiaop1" },
};

const DEFAULT_STEP = 1;
const DEFAULT_TOTAL_STEPS = 1;

const automationTool = tool(
  async ({ caseName }) => {
    const headerId = randomUUID();
    const payload: AutomationRequest = {
      header: {
        id: headerId,
        timestamp: Date.now(),
      },
      data: {
        case_name: caseName,
        auto_pre_data: DEFAULT_AUTO_PRE_DATA,
        step: DEFAULT_STEP,
        user_data: DEFAULT_USER_DATA,
        header_id: headerId,
        total_steps: DEFAULT_TOTAL_STEPS,
        run_config: {
          isAsync: false,
          isClosePage: false,
          isLogout: false,
          isConfirm: false
        }
      },
    };

    let response: Response;
    try {
      response = await fetch(AUTOMATION_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
    } catch (error) {
      throw new Error(
        `Failed to reach automation service: ${(error as Error).message}`,
      );
    }

    const rawBody = await response.text();
    let parsedBody: unknown;
    try {
      parsedBody = rawBody ? JSON.parse(rawBody) : null;
    } catch {
      parsedBody = rawBody;
    }

    if (!response.ok) {
      const errorMessage =
        typeof parsedBody === "string"
          ? parsedBody
          : JSON.stringify(parsedBody, null, 2);
      throw new Error(
        `Automation service error ${response.status}: ${errorMessage}`,
      );
    }

    if (typeof parsedBody === "string" || parsedBody === null) {
      return parsedBody ?? "";
    }

    return JSON.stringify(parsedBody);
  },
  {
    name: "trigger_automation_case",
    description:
      "调用自动化程序(非测试用例)。仅提供一个 caseName 参数来选择要执行的自动化用例。",
    schema: automationCaseSchema,
  },
);

export const TOOLS = [automationTool];
