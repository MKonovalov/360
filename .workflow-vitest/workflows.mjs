// biome-ignore-all lint: generated file
/* eslint-disable */
import { workflowEntrypoint } from 'workflow/runtime';

const workflowCode = `globalThis.__private_workflows = new Map();
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });
var __commonJS = (cb, mod) => function __require() {
  try {
    return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
  } catch (e) {
    throw mod = 0, e;
  }
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// node_modules/ms/index.js
var require_ms = __commonJS({
  "node_modules/ms/index.js"(exports, module2) {
    var s = 1e3;
    var m = s * 60;
    var h = m * 60;
    var d = h * 24;
    var w = d * 7;
    var y = d * 365.25;
    module2.exports = function(val, options) {
      options = options || {};
      var type = typeof val;
      if (type === "string" && val.length > 0) {
        return parse(val);
      } else if (type === "number" && isFinite(val)) {
        return options.long ? fmtLong(val) : fmtShort(val);
      }
      throw new Error("val is not a non-empty string or a valid number. val=" + JSON.stringify(val));
    };
    function parse(str) {
      str = String(str);
      if (str.length > 100) {
        return;
      }
      var match = /^(-?(?:\\d+)?\\.?\\d+) *(milliseconds?|msecs?|ms|seconds?|secs?|s|minutes?|mins?|m|hours?|hrs?|h|days?|d|weeks?|w|years?|yrs?|y)?\$/i.exec(str);
      if (!match) {
        return;
      }
      var n = parseFloat(match[1]);
      var type = (match[2] || "ms").toLowerCase();
      switch (type) {
        case "years":
        case "year":
        case "yrs":
        case "yr":
        case "y":
          return n * y;
        case "weeks":
        case "week":
        case "w":
          return n * w;
        case "days":
        case "day":
        case "d":
          return n * d;
        case "hours":
        case "hour":
        case "hrs":
        case "hr":
        case "h":
          return n * h;
        case "minutes":
        case "minute":
        case "mins":
        case "min":
        case "m":
          return n * m;
        case "seconds":
        case "second":
        case "secs":
        case "sec":
        case "s":
          return n * s;
        case "milliseconds":
        case "millisecond":
        case "msecs":
        case "msec":
        case "ms":
          return n;
        default:
          return void 0;
      }
    }
    __name(parse, "parse");
    function fmtShort(ms2) {
      var msAbs = Math.abs(ms2);
      if (msAbs >= d) {
        return Math.round(ms2 / d) + "d";
      }
      if (msAbs >= h) {
        return Math.round(ms2 / h) + "h";
      }
      if (msAbs >= m) {
        return Math.round(ms2 / m) + "m";
      }
      if (msAbs >= s) {
        return Math.round(ms2 / s) + "s";
      }
      return ms2 + "ms";
    }
    __name(fmtShort, "fmtShort");
    function fmtLong(ms2) {
      var msAbs = Math.abs(ms2);
      if (msAbs >= d) {
        return plural(ms2, msAbs, d, "day");
      }
      if (msAbs >= h) {
        return plural(ms2, msAbs, h, "hour");
      }
      if (msAbs >= m) {
        return plural(ms2, msAbs, m, "minute");
      }
      if (msAbs >= s) {
        return plural(ms2, msAbs, s, "second");
      }
      return ms2 + " ms";
    }
    __name(fmtLong, "fmtLong");
    function plural(ms2, msAbs, n, name) {
      var isPlural = msAbs >= n * 1.5;
      return Math.round(ms2 / n) + " " + name + (isPlural ? "s" : "");
    }
    __name(plural, "plural");
  }
});

// src/workflows/analysisRun.ts
async function analysisRun(applicationRunId) {
  const current = await loadRun(applicationRunId);
  if (current.status === "queued") {
    const claim = await claimQueuedRun(applicationRunId);
    if (claim.ok) {
      const execution = await executeGroundedAnalysis(applicationRunId);
      if (!execution.ok) {
        const failed = await recordFailure(applicationRunId, execution.safeReason);
        if (failed.ok) return {
          applicationRunId,
          terminalStatus: "failed"
        };
        return await observeAuthoritativeState(applicationRunId);
      }
      const normalized = await normalizeGroundedPacket(applicationRunId, execution.execution);
      if (!normalized.ok) {
        const failed = await recordFailure(applicationRunId, "execution_failed");
        if (failed.ok) return {
          applicationRunId,
          terminalStatus: "failed"
        };
        return await observeAuthoritativeState(applicationRunId);
      }
      const persisted = await persistGroundedPacket(applicationRunId, normalized.result);
      if (!persisted.ok) {
        const failed = await recordFailure(applicationRunId, "execution_failed");
        if (failed.ok) return {
          applicationRunId,
          terminalStatus: "failed"
        };
        return await observeAuthoritativeState(applicationRunId);
      }
      await recordTelemetryAfterPersistence(applicationRunId, execution.execution, normalized.result.packet);
      const completed = await completePersistedRun(applicationRunId);
      if (completed.ok) {
        await reconcileCompletedRun(applicationRunId);
        return {
          applicationRunId,
          terminalStatus: "completed"
        };
      }
    }
    return await observeAuthoritativeState(applicationRunId);
  }
  if (current.status === "running") {
    const timeoutSeconds = current.policySnapshot.mode === "phase32_noop" ? 5 : current.policySnapshot.effectiveMaxExecutionSeconds;
    const windowExpired = current.startedAt !== null && Date.now() - current.startedAt.getTime() > timeoutSeconds * 1e3;
    const terminal = windowExpired ? await recordFailure(applicationRunId, "timed_out") : await recordCancelledRun(applicationRunId);
    if (terminal.ok) return {
      applicationRunId,
      terminalStatus: windowExpired ? "failed" : "cancelled"
    };
  }
  return await observeAuthoritativeState(applicationRunId);
}
__name(analysisRun, "analysisRun");
analysisRun.workflowId = "workflow//./src/workflows/analysisRun//analysisRun";
globalThis.__private_workflows.set("workflow//./src/workflows/analysisRun//analysisRun", analysisRun);
var loadRun = globalThis[/* @__PURE__ */ Symbol.for("WORKFLOW_USE_STEP")]("step//./src/workflows/analysisRun//loadRun");
var claimQueuedRun = globalThis[/* @__PURE__ */ Symbol.for("WORKFLOW_USE_STEP")]("step//./src/workflows/analysisRun//claimQueuedRun");
var executeGroundedAnalysis = globalThis[/* @__PURE__ */ Symbol.for("WORKFLOW_USE_STEP")]("step//./src/workflows/analysisRun//executeGroundedAnalysis");
var normalizeGroundedPacket = globalThis[/* @__PURE__ */ Symbol.for("WORKFLOW_USE_STEP")]("step//./src/workflows/analysisRun//normalizeGroundedPacket");
var persistGroundedPacket = globalThis[/* @__PURE__ */ Symbol.for("WORKFLOW_USE_STEP")]("step//./src/workflows/analysisRun//persistGroundedPacket");
var recordTelemetryAfterPersistence = globalThis[/* @__PURE__ */ Symbol.for("WORKFLOW_USE_STEP")]("step//./src/workflows/analysisRun//recordTelemetryAfterPersistence");
var completePersistedRun = globalThis[/* @__PURE__ */ Symbol.for("WORKFLOW_USE_STEP")]("step//./src/workflows/analysisRun//completePersistedRun");
var reconcileCompletedRun = globalThis[/* @__PURE__ */ Symbol.for("WORKFLOW_USE_STEP")]("step//./src/workflows/analysisRun//reconcileCompletedRun");
var recordFailure = globalThis[/* @__PURE__ */ Symbol.for("WORKFLOW_USE_STEP")]("step//./src/workflows/analysisRun//recordFailure");
var recordCancelledRun = globalThis[/* @__PURE__ */ Symbol.for("WORKFLOW_USE_STEP")]("step//./src/workflows/analysisRun//recordCancelledRun");
var observeAuthoritativeState = globalThis[/* @__PURE__ */ Symbol.for("WORKFLOW_USE_STEP")]("step//./src/workflows/analysisRun//observeAuthoritativeState");

// node_modules/@workflow/utils/dist/time.js
var import_ms = __toESM(require_ms(), 1);
function parseDurationToDate(param) {
  if (typeof param === "string") {
    const durationMs = (0, import_ms.default)(param);
    if (typeof durationMs !== "number" || durationMs < 0) {
      throw new Error(\`Invalid duration: "\${param}". Expected a valid duration string like "1s", "1m", "1h", etc.\`);
    }
    return new Date(Date.now() + durationMs);
  } else if (typeof param === "number") {
    if (param < 0 || !Number.isFinite(param)) {
      throw new Error(\`Invalid duration: \${param}. Expected a non-negative finite number of milliseconds.\`);
    }
    return new Date(Date.now() + param);
  } else if (param instanceof Date || param && typeof param === "object" && typeof param.getTime === "function") {
    return param instanceof Date ? param : new Date(param.getTime());
  } else {
    throw new Error(\`Invalid duration parameter. Expected a duration string, number (milliseconds), or Date object.\`);
  }
}
__name(parseDurationToDate, "parseDurationToDate");

// node_modules/@workflow/errors/dist/index.js
var BASE_URL = "https://useworkflow.dev/err";
function isError(value) {
  return typeof value === "object" && value !== null && "name" in value && "message" in value;
}
__name(isError, "isError");
var ERROR_SLUGS = {
  NODE_JS_MODULE_IN_WORKFLOW: "node-js-module-in-workflow",
  START_INVALID_WORKFLOW_FUNCTION: "start-invalid-workflow-function",
  SERIALIZATION_FAILED: "serialization-failed",
  WEBHOOK_INVALID_RESPOND_WITH_VALUE: "webhook-invalid-respond-with-value",
  WEBHOOK_RESPONSE_NOT_SENT: "webhook-response-not-sent",
  FETCH_IN_WORKFLOW_FUNCTION: "fetch-in-workflow",
  TIMEOUT_FUNCTIONS_IN_WORKFLOW: "timeout-in-workflow",
  HOOK_CONFLICT: "hook-conflict",
  CORRUPTED_EVENT_LOG: "corrupted-event-log",
  REPLAY_DIVERGENCE: "replay-divergence",
  STEP_NOT_REGISTERED: "step-not-registered",
  WORKFLOW_NOT_REGISTERED: "workflow-not-registered",
  RUNTIME_DECRYPTION_FAILED: "runtime-decryption-failed"
};
var WorkflowError = class extends Error {
  static {
    __name(this, "WorkflowError");
  }
  cause;
  constructor(message, options) {
    const msgDocs = options?.slug ? \`\${message}

Learn more: \${BASE_URL}/\${options.slug}\` : message;
    super(msgDocs, {
      cause: options?.cause
    });
    this.cause = options?.cause;
    if (options?.cause instanceof Error) {
      this.stack = \`\${this.stack}
Caused by: \${options.cause.stack}\`;
    }
  }
  static is(value) {
    return isError(value) && value.name === "WorkflowError";
  }
};
var HookConflictError = class extends WorkflowError {
  static {
    __name(this, "HookConflictError");
  }
  token;
  // TODO: Make this required once all persisted hook_conflict events and World
  // implementations always include the active hook owner's run ID.
  conflictingRunId;
  constructor(token, conflictingRunId) {
    super(\`Hook token "\${token}" is already in use by another workflow\${conflictingRunId ? \` (run "\${conflictingRunId}")\` : ""}\`, {
      slug: ERROR_SLUGS.HOOK_CONFLICT
    });
    this.name = "HookConflictError";
    this.token = token;
    if (conflictingRunId !== void 0) {
      this.conflictingRunId = conflictingRunId;
    }
  }
  static is(value) {
    return isError(value) && value.name === "HookConflictError";
  }
};
var FatalError = class extends Error {
  static {
    __name(this, "FatalError");
  }
  fatal = true;
  constructor(message) {
    super(message);
    this.name = "FatalError";
  }
  static is(value) {
    return isError(value) && value.name === "FatalError";
  }
};
var RetryableError = class extends Error {
  static {
    __name(this, "RetryableError");
  }
  /**
   * The Date when the step should be retried.
   */
  retryAfter;
  constructor(message, options = {}) {
    super(message);
    this.name = "RetryableError";
    if (options.retryAfter !== void 0) {
      this.retryAfter = parseDurationToDate(options.retryAfter);
    } else {
      this.retryAfter = new Date(Date.now() + 1e3);
    }
  }
  static is(value) {
    return isError(value) && value.name === "RetryableError";
  }
};
var FATAL_ERROR_KEY = /* @__PURE__ */ Symbol.for("@workflow/errors//FatalError");
var RETRYABLE_ERROR_KEY = /* @__PURE__ */ Symbol.for("@workflow/errors//RetryableError");
var HOOK_CONFLICT_ERROR_KEY = /* @__PURE__ */ Symbol.for("@workflow/errors//HookConflictError");
if (typeof globalThis !== "undefined") {
  if (!Object.hasOwn(globalThis, FATAL_ERROR_KEY)) {
    Object.defineProperty(globalThis, FATAL_ERROR_KEY, {
      value: FatalError,
      writable: false,
      enumerable: false,
      configurable: false
    });
  }
  if (!Object.hasOwn(globalThis, RETRYABLE_ERROR_KEY)) {
    Object.defineProperty(globalThis, RETRYABLE_ERROR_KEY, {
      value: RetryableError,
      writable: false,
      enumerable: false,
      configurable: false
    });
  }
  if (!Object.hasOwn(globalThis, HOOK_CONFLICT_ERROR_KEY)) {
    Object.defineProperty(globalThis, HOOK_CONFLICT_ERROR_KEY, {
      value: HookConflictError,
      writable: false,
      enumerable: false,
      configurable: false
    });
  }
}

// node_modules/workflow/dist/stdlib.js
var fetch = globalThis[/* @__PURE__ */ Symbol.for("WORKFLOW_USE_STEP")]("step//workflow@4.8.0//fetch");

// src/workflows/workflowProof.ts
async function workflowProof(applicationRunId) {
  try {
    await claimProof(applicationRunId);
  } catch (error) {
    if (error instanceof FatalError) return await failProof(applicationRunId);
    throw error;
  }
  let reconciledStatus;
  try {
    reconciledStatus = await reconcileProof(applicationRunId);
  } catch (error) {
    if (error instanceof FatalError) return await failProof(applicationRunId);
    throw error;
  }
  if (reconciledStatus === "completed" || reconciledStatus === "failed") {
    return {
      applicationRunId,
      terminalStatus: reconciledStatus
    };
  }
  if (reconciledStatus !== "running") {
    return await failProof(applicationRunId);
  }
  try {
    await syntheticWork(applicationRunId);
  } catch (error) {
    if (error instanceof RetryableError) throw error;
    return await failProof(applicationRunId);
  }
  return await completeProof(applicationRunId);
}
__name(workflowProof, "workflowProof");
workflowProof.workflowId = "workflow//./src/workflows/workflowProof//workflowProof";
globalThis.__private_workflows.set("workflow//./src/workflows/workflowProof//workflowProof", workflowProof);
var claimProof = globalThis[/* @__PURE__ */ Symbol.for("WORKFLOW_USE_STEP")]("step//./src/workflows/workflowProof//claimProof");
var reconcileProof = globalThis[/* @__PURE__ */ Symbol.for("WORKFLOW_USE_STEP")]("step//./src/workflows/workflowProof//reconcileProof");
var syntheticWork = globalThis[/* @__PURE__ */ Symbol.for("WORKFLOW_USE_STEP")]("step//./src/workflows/workflowProof//syntheticWork");
syntheticWork.maxRetries = 1;
var completeProof = globalThis[/* @__PURE__ */ Symbol.for("WORKFLOW_USE_STEP")]("step//./src/workflows/workflowProof//completeProof");
var failProof = globalThis[/* @__PURE__ */ Symbol.for("WORKFLOW_USE_STEP")]("step//./src/workflows/workflowProof//failProof");

// node_modules/builtin-modules/builtin-modules.json
var builtin_modules_default = [
  "node:assert",
  "assert",
  "node:assert/strict",
  "assert/strict",
  "node:async_hooks",
  "async_hooks",
  "node:buffer",
  "buffer",
  "node:child_process",
  "child_process",
  "node:cluster",
  "cluster",
  "node:console",
  "console",
  "node:constants",
  "constants",
  "node:crypto",
  "crypto",
  "node:dgram",
  "dgram",
  "node:diagnostics_channel",
  "diagnostics_channel",
  "node:dns",
  "dns",
  "node:dns/promises",
  "dns/promises",
  "node:domain",
  "domain",
  "node:events",
  "events",
  "node:fs",
  "fs",
  "node:fs/promises",
  "fs/promises",
  "node:http",
  "http",
  "node:http2",
  "http2",
  "node:https",
  "https",
  "node:inspector",
  "inspector",
  "node:inspector/promises",
  "inspector/promises",
  "node:module",
  "module",
  "node:net",
  "net",
  "node:os",
  "os",
  "node:path",
  "path",
  "node:path/posix",
  "path/posix",
  "node:path/win32",
  "path/win32",
  "node:perf_hooks",
  "perf_hooks",
  "node:process",
  "process",
  "node:querystring",
  "querystring",
  "node:quic",
  "node:readline",
  "readline",
  "node:readline/promises",
  "readline/promises",
  "node:repl",
  "repl",
  "node:sea",
  "node:sqlite",
  "node:stream",
  "stream",
  "node:stream/consumers",
  "stream/consumers",
  "node:stream/promises",
  "stream/promises",
  "node:stream/web",
  "stream/web",
  "node:string_decoder",
  "string_decoder",
  "node:test",
  "node:test/reporters",
  "node:timers",
  "timers",
  "node:timers/promises",
  "timers/promises",
  "node:tls",
  "tls",
  "node:trace_events",
  "trace_events",
  "node:tty",
  "tty",
  "node:url",
  "url",
  "node:util",
  "util",
  "node:util/types",
  "util/types",
  "node:v8",
  "v8",
  "node:vm",
  "vm",
  "node:wasi",
  "wasi",
  "node:worker_threads",
  "worker_threads",
  "node:zlib",
  "zlib"
];

// node_modules/builtin-modules/index.js
var builtin_modules_default2 = builtin_modules_default;

// node_modules/@workflow/builders/dist/serde-checker.js
var nodeBuiltins = builtin_modules_default2.join("|");
var nodeImportExtractRegex = new RegExp(\`(?:from\\\\s+['"](?:node:)?((?:\${nodeBuiltins})(?:/[^'"]*)?)['"]|require\\\\s*\\\\(\\\\s*['"](?:node:)?((?:\${nodeBuiltins})(?:/[^'"]*)?)['"]\\\\s*\\\\))\`, "g");
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsibm9kZV9tb2R1bGVzL21zL2luZGV4LmpzIiwgInNyYy93b3JrZmxvd3MvYW5hbHlzaXNSdW4udHMiLCAibm9kZV9tb2R1bGVzL0B3b3JrZmxvdy91dGlscy9zcmMvdGltZS50cyIsICJub2RlX21vZHVsZXMvQHdvcmtmbG93L2Vycm9ycy9zcmMvaW5kZXgudHMiLCAibm9kZV9tb2R1bGVzL3dvcmtmbG93L3NyYy9zdGRsaWIudHMiLCAic3JjL3dvcmtmbG93cy93b3JrZmxvd1Byb29mLnRzIiwgIm5vZGVfbW9kdWxlcy9idWlsdGluLW1vZHVsZXMvYnVpbHRpbi1tb2R1bGVzLmpzb24iLCAibm9kZV9tb2R1bGVzL2J1aWx0aW4tbW9kdWxlcy9pbmRleC5qcyIsICJub2RlX21vZHVsZXMvQHdvcmtmbG93L2J1aWxkZXJzL3NyYy9zZXJkZS1jaGVja2VyLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKipcbiAqIEhlbHBlcnMuXG4gKi8gdmFyIHMgPSAxMDAwO1xudmFyIG0gPSBzICogNjA7XG52YXIgaCA9IG0gKiA2MDtcbnZhciBkID0gaCAqIDI0O1xudmFyIHcgPSBkICogNztcbnZhciB5ID0gZCAqIDM2NS4yNTtcbi8qKlxuICogUGFyc2Ugb3IgZm9ybWF0IHRoZSBnaXZlbiBgdmFsYC5cbiAqXG4gKiBPcHRpb25zOlxuICpcbiAqICAtIGBsb25nYCB2ZXJib3NlIGZvcm1hdHRpbmcgW2ZhbHNlXVxuICpcbiAqIEBwYXJhbSB7U3RyaW5nfE51bWJlcn0gdmFsXG4gKiBAcGFyYW0ge09iamVjdH0gW29wdGlvbnNdXG4gKiBAdGhyb3dzIHtFcnJvcn0gdGhyb3cgYW4gZXJyb3IgaWYgdmFsIGlzIG5vdCBhIG5vbi1lbXB0eSBzdHJpbmcgb3IgYSBudW1iZXJcbiAqIEByZXR1cm4ge1N0cmluZ3xOdW1iZXJ9XG4gKiBAYXBpIHB1YmxpY1xuICovIG1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24odmFsLCBvcHRpb25zKSB7XG4gICAgb3B0aW9ucyA9IG9wdGlvbnMgfHwge307XG4gICAgdmFyIHR5cGUgPSB0eXBlb2YgdmFsO1xuICAgIGlmICh0eXBlID09PSAnc3RyaW5nJyAmJiB2YWwubGVuZ3RoID4gMCkge1xuICAgICAgICByZXR1cm4gcGFyc2UodmFsKTtcbiAgICB9IGVsc2UgaWYgKHR5cGUgPT09ICdudW1iZXInICYmIGlzRmluaXRlKHZhbCkpIHtcbiAgICAgICAgcmV0dXJuIG9wdGlvbnMubG9uZyA/IGZtdExvbmcodmFsKSA6IGZtdFNob3J0KHZhbCk7XG4gICAgfVxuICAgIHRocm93IG5ldyBFcnJvcigndmFsIGlzIG5vdCBhIG5vbi1lbXB0eSBzdHJpbmcgb3IgYSB2YWxpZCBudW1iZXIuIHZhbD0nICsgSlNPTi5zdHJpbmdpZnkodmFsKSk7XG59O1xuLyoqXG4gKiBQYXJzZSB0aGUgZ2l2ZW4gYHN0cmAgYW5kIHJldHVybiBtaWxsaXNlY29uZHMuXG4gKlxuICogQHBhcmFtIHtTdHJpbmd9IHN0clxuICogQHJldHVybiB7TnVtYmVyfVxuICogQGFwaSBwcml2YXRlXG4gKi8gZnVuY3Rpb24gcGFyc2Uoc3RyKSB7XG4gICAgc3RyID0gU3RyaW5nKHN0cik7XG4gICAgaWYgKHN0ci5sZW5ndGggPiAxMDApIHtcbiAgICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICB2YXIgbWF0Y2ggPSAvXigtPyg/OlxcZCspP1xcLj9cXGQrKSAqKG1pbGxpc2Vjb25kcz98bXNlY3M/fG1zfHNlY29uZHM/fHNlY3M/fHN8bWludXRlcz98bWlucz98bXxob3Vycz98aHJzP3xofGRheXM/fGR8d2Vla3M/fHd8eWVhcnM/fHlycz98eSk/JC9pLmV4ZWMoc3RyKTtcbiAgICBpZiAoIW1hdGNoKSB7XG4gICAgICAgIHJldHVybjtcbiAgICB9XG4gICAgdmFyIG4gPSBwYXJzZUZsb2F0KG1hdGNoWzFdKTtcbiAgICB2YXIgdHlwZSA9IChtYXRjaFsyXSB8fCAnbXMnKS50b0xvd2VyQ2FzZSgpO1xuICAgIHN3aXRjaCh0eXBlKXtcbiAgICAgICAgY2FzZSAneWVhcnMnOlxuICAgICAgICBjYXNlICd5ZWFyJzpcbiAgICAgICAgY2FzZSAneXJzJzpcbiAgICAgICAgY2FzZSAneXInOlxuICAgICAgICBjYXNlICd5JzpcbiAgICAgICAgICAgIHJldHVybiBuICogeTtcbiAgICAgICAgY2FzZSAnd2Vla3MnOlxuICAgICAgICBjYXNlICd3ZWVrJzpcbiAgICAgICAgY2FzZSAndyc6XG4gICAgICAgICAgICByZXR1cm4gbiAqIHc7XG4gICAgICAgIGNhc2UgJ2RheXMnOlxuICAgICAgICBjYXNlICdkYXknOlxuICAgICAgICBjYXNlICdkJzpcbiAgICAgICAgICAgIHJldHVybiBuICogZDtcbiAgICAgICAgY2FzZSAnaG91cnMnOlxuICAgICAgICBjYXNlICdob3VyJzpcbiAgICAgICAgY2FzZSAnaHJzJzpcbiAgICAgICAgY2FzZSAnaHInOlxuICAgICAgICBjYXNlICdoJzpcbiAgICAgICAgICAgIHJldHVybiBuICogaDtcbiAgICAgICAgY2FzZSAnbWludXRlcyc6XG4gICAgICAgIGNhc2UgJ21pbnV0ZSc6XG4gICAgICAgIGNhc2UgJ21pbnMnOlxuICAgICAgICBjYXNlICdtaW4nOlxuICAgICAgICBjYXNlICdtJzpcbiAgICAgICAgICAgIHJldHVybiBuICogbTtcbiAgICAgICAgY2FzZSAnc2Vjb25kcyc6XG4gICAgICAgIGNhc2UgJ3NlY29uZCc6XG4gICAgICAgIGNhc2UgJ3NlY3MnOlxuICAgICAgICBjYXNlICdzZWMnOlxuICAgICAgICBjYXNlICdzJzpcbiAgICAgICAgICAgIHJldHVybiBuICogcztcbiAgICAgICAgY2FzZSAnbWlsbGlzZWNvbmRzJzpcbiAgICAgICAgY2FzZSAnbWlsbGlzZWNvbmQnOlxuICAgICAgICBjYXNlICdtc2Vjcyc6XG4gICAgICAgIGNhc2UgJ21zZWMnOlxuICAgICAgICBjYXNlICdtcyc6XG4gICAgICAgICAgICByZXR1cm4gbjtcbiAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICAgIHJldHVybiB1bmRlZmluZWQ7XG4gICAgfVxufVxuLyoqXG4gKiBTaG9ydCBmb3JtYXQgZm9yIGBtc2AuXG4gKlxuICogQHBhcmFtIHtOdW1iZXJ9IG1zXG4gKiBAcmV0dXJuIHtTdHJpbmd9XG4gKiBAYXBpIHByaXZhdGVcbiAqLyBmdW5jdGlvbiBmbXRTaG9ydChtcykge1xuICAgIHZhciBtc0FicyA9IE1hdGguYWJzKG1zKTtcbiAgICBpZiAobXNBYnMgPj0gZCkge1xuICAgICAgICByZXR1cm4gTWF0aC5yb3VuZChtcyAvIGQpICsgJ2QnO1xuICAgIH1cbiAgICBpZiAobXNBYnMgPj0gaCkge1xuICAgICAgICByZXR1cm4gTWF0aC5yb3VuZChtcyAvIGgpICsgJ2gnO1xuICAgIH1cbiAgICBpZiAobXNBYnMgPj0gbSkge1xuICAgICAgICByZXR1cm4gTWF0aC5yb3VuZChtcyAvIG0pICsgJ20nO1xuICAgIH1cbiAgICBpZiAobXNBYnMgPj0gcykge1xuICAgICAgICByZXR1cm4gTWF0aC5yb3VuZChtcyAvIHMpICsgJ3MnO1xuICAgIH1cbiAgICByZXR1cm4gbXMgKyAnbXMnO1xufVxuLyoqXG4gKiBMb25nIGZvcm1hdCBmb3IgYG1zYC5cbiAqXG4gKiBAcGFyYW0ge051bWJlcn0gbXNcbiAqIEByZXR1cm4ge1N0cmluZ31cbiAqIEBhcGkgcHJpdmF0ZVxuICovIGZ1bmN0aW9uIGZtdExvbmcobXMpIHtcbiAgICB2YXIgbXNBYnMgPSBNYXRoLmFicyhtcyk7XG4gICAgaWYgKG1zQWJzID49IGQpIHtcbiAgICAgICAgcmV0dXJuIHBsdXJhbChtcywgbXNBYnMsIGQsICdkYXknKTtcbiAgICB9XG4gICAgaWYgKG1zQWJzID49IGgpIHtcbiAgICAgICAgcmV0dXJuIHBsdXJhbChtcywgbXNBYnMsIGgsICdob3VyJyk7XG4gICAgfVxuICAgIGlmIChtc0FicyA+PSBtKSB7XG4gICAgICAgIHJldHVybiBwbHVyYWwobXMsIG1zQWJzLCBtLCAnbWludXRlJyk7XG4gICAgfVxuICAgIGlmIChtc0FicyA+PSBzKSB7XG4gICAgICAgIHJldHVybiBwbHVyYWwobXMsIG1zQWJzLCBzLCAnc2Vjb25kJyk7XG4gICAgfVxuICAgIHJldHVybiBtcyArICcgbXMnO1xufVxuLyoqXG4gKiBQbHVyYWxpemF0aW9uIGhlbHBlci5cbiAqLyBmdW5jdGlvbiBwbHVyYWwobXMsIG1zQWJzLCBuLCBuYW1lKSB7XG4gICAgdmFyIGlzUGx1cmFsID0gbXNBYnMgPj0gbiAqIDEuNTtcbiAgICByZXR1cm4gTWF0aC5yb3VuZChtcyAvIG4pICsgJyAnICsgbmFtZSArIChpc1BsdXJhbCA/ICdzJyA6ICcnKTtcbn1cbiIsICIvKipfX2ludGVybmFsX3dvcmtmbG93c3tcIndvcmtmbG93c1wiOntcInNyYy93b3JrZmxvd3MvYW5hbHlzaXNSdW4udHNcIjp7XCJhbmFseXNpc1J1blwiOntcIndvcmtmbG93SWRcIjpcIndvcmtmbG93Ly8uL3NyYy93b3JrZmxvd3MvYW5hbHlzaXNSdW4vL2FuYWx5c2lzUnVuXCJ9fX0sXCJzdGVwc1wiOntcInNyYy93b3JrZmxvd3MvYW5hbHlzaXNSdW4udHNcIjp7XCJjbGFpbVF1ZXVlZFJ1blwiOntcInN0ZXBJZFwiOlwic3RlcC8vLi9zcmMvd29ya2Zsb3dzL2FuYWx5c2lzUnVuLy9jbGFpbVF1ZXVlZFJ1blwifSxcImNvbXBsZXRlUGVyc2lzdGVkUnVuXCI6e1wic3RlcElkXCI6XCJzdGVwLy8uL3NyYy93b3JrZmxvd3MvYW5hbHlzaXNSdW4vL2NvbXBsZXRlUGVyc2lzdGVkUnVuXCJ9LFwiZXhlY3V0ZUdyb3VuZGVkQW5hbHlzaXNcIjp7XCJzdGVwSWRcIjpcInN0ZXAvLy4vc3JjL3dvcmtmbG93cy9hbmFseXNpc1J1bi8vZXhlY3V0ZUdyb3VuZGVkQW5hbHlzaXNcIn0sXCJsb2FkUnVuXCI6e1wic3RlcElkXCI6XCJzdGVwLy8uL3NyYy93b3JrZmxvd3MvYW5hbHlzaXNSdW4vL2xvYWRSdW5cIn0sXCJub3JtYWxpemVHcm91bmRlZFBhY2tldFwiOntcInN0ZXBJZFwiOlwic3RlcC8vLi9zcmMvd29ya2Zsb3dzL2FuYWx5c2lzUnVuLy9ub3JtYWxpemVHcm91bmRlZFBhY2tldFwifSxcIm9ic2VydmVBdXRob3JpdGF0aXZlU3RhdGVcIjp7XCJzdGVwSWRcIjpcInN0ZXAvLy4vc3JjL3dvcmtmbG93cy9hbmFseXNpc1J1bi8vb2JzZXJ2ZUF1dGhvcml0YXRpdmVTdGF0ZVwifSxcInBlcnNpc3RHcm91bmRlZFBhY2tldFwiOntcInN0ZXBJZFwiOlwic3RlcC8vLi9zcmMvd29ya2Zsb3dzL2FuYWx5c2lzUnVuLy9wZXJzaXN0R3JvdW5kZWRQYWNrZXRcIn0sXCJyZWNvbmNpbGVDb21wbGV0ZWRSdW5cIjp7XCJzdGVwSWRcIjpcInN0ZXAvLy4vc3JjL3dvcmtmbG93cy9hbmFseXNpc1J1bi8vcmVjb25jaWxlQ29tcGxldGVkUnVuXCJ9LFwicmVjb3JkQ2FuY2VsbGVkUnVuXCI6e1wic3RlcElkXCI6XCJzdGVwLy8uL3NyYy93b3JrZmxvd3MvYW5hbHlzaXNSdW4vL3JlY29yZENhbmNlbGxlZFJ1blwifSxcInJlY29yZEZhaWx1cmVcIjp7XCJzdGVwSWRcIjpcInN0ZXAvLy4vc3JjL3dvcmtmbG93cy9hbmFseXNpc1J1bi8vcmVjb3JkRmFpbHVyZVwifSxcInJlY29yZFRlbGVtZXRyeUFmdGVyUGVyc2lzdGVuY2VcIjp7XCJzdGVwSWRcIjpcInN0ZXAvLy4vc3JjL3dvcmtmbG93cy9hbmFseXNpc1J1bi8vcmVjb3JkVGVsZW1ldHJ5QWZ0ZXJQZXJzaXN0ZW5jZVwifX19fSovO1xuLy8gUGxhdGZvcm06IFZlcmNlbCBIb2JieSBwZXJtaXRzIDMwMHMgd2l0aCBmbHVpZCBjb21wdXRlOyB0aGUgd29ya2Zsb3cgc3RlcFxuLy8gbXVzdCBleHBvcnQgbWF4RHVyYXRpb24gZXhwbGljaXRseSBcdTIwMTQgd2l0aG91dCBpdCwgdGhlIHN0ZXAgZGVmYXVsdHMgdG8gNjBzXG4vLyAoa2lsbGluZyB0aGUgYWdlbnQgbG9vcCdzIDI5MHMgYnVkZ2V0IGJlZm9yZSBpdCBjYW4gY29tcGxldGUpLlxuZXhwb3J0IGNvbnN0IG1heER1cmF0aW9uID0gMzAwO1xuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGFuYWx5c2lzUnVuKGFwcGxpY2F0aW9uUnVuSWQpIHtcbiAgICBjb25zdCBjdXJyZW50ID0gYXdhaXQgbG9hZFJ1bihhcHBsaWNhdGlvblJ1bklkKTtcbiAgICBpZiAoY3VycmVudC5zdGF0dXMgPT09ICdxdWV1ZWQnKSB7XG4gICAgICAgIGNvbnN0IGNsYWltID0gYXdhaXQgY2xhaW1RdWV1ZWRSdW4oYXBwbGljYXRpb25SdW5JZCk7XG4gICAgICAgIGlmIChjbGFpbS5vaykge1xuICAgICAgICAgICAgY29uc3QgZXhlY3V0aW9uID0gYXdhaXQgZXhlY3V0ZUdyb3VuZGVkQW5hbHlzaXMoYXBwbGljYXRpb25SdW5JZCk7XG4gICAgICAgICAgICBpZiAoIWV4ZWN1dGlvbi5vaykge1xuICAgICAgICAgICAgICAgIGNvbnN0IGZhaWxlZCA9IGF3YWl0IHJlY29yZEZhaWx1cmUoYXBwbGljYXRpb25SdW5JZCwgZXhlY3V0aW9uLnNhZmVSZWFzb24pO1xuICAgICAgICAgICAgICAgIGlmIChmYWlsZWQub2spIHJldHVybiB7XG4gICAgICAgICAgICAgICAgICAgIGFwcGxpY2F0aW9uUnVuSWQsXG4gICAgICAgICAgICAgICAgICAgIHRlcm1pbmFsU3RhdHVzOiAnZmFpbGVkJ1xuICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICAgICAgcmV0dXJuIGF3YWl0IG9ic2VydmVBdXRob3JpdGF0aXZlU3RhdGUoYXBwbGljYXRpb25SdW5JZCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBjb25zdCBub3JtYWxpemVkID0gYXdhaXQgbm9ybWFsaXplR3JvdW5kZWRQYWNrZXQoYXBwbGljYXRpb25SdW5JZCwgZXhlY3V0aW9uLmV4ZWN1dGlvbik7XG4gICAgICAgICAgICBpZiAoIW5vcm1hbGl6ZWQub2spIHtcbiAgICAgICAgICAgICAgICBjb25zdCBmYWlsZWQgPSBhd2FpdCByZWNvcmRGYWlsdXJlKGFwcGxpY2F0aW9uUnVuSWQsICdleGVjdXRpb25fZmFpbGVkJyk7XG4gICAgICAgICAgICAgICAgaWYgKGZhaWxlZC5vaykgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICAgICAgYXBwbGljYXRpb25SdW5JZCxcbiAgICAgICAgICAgICAgICAgICAgdGVybWluYWxTdGF0dXM6ICdmYWlsZWQnXG4gICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgICAgICByZXR1cm4gYXdhaXQgb2JzZXJ2ZUF1dGhvcml0YXRpdmVTdGF0ZShhcHBsaWNhdGlvblJ1bklkKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGNvbnN0IHBlcnNpc3RlZCA9IGF3YWl0IHBlcnNpc3RHcm91bmRlZFBhY2tldChhcHBsaWNhdGlvblJ1bklkLCBub3JtYWxpemVkLnJlc3VsdCk7XG4gICAgICAgICAgICBpZiAoIXBlcnNpc3RlZC5vaykge1xuICAgICAgICAgICAgICAgIGNvbnN0IGZhaWxlZCA9IGF3YWl0IHJlY29yZEZhaWx1cmUoYXBwbGljYXRpb25SdW5JZCwgJ2V4ZWN1dGlvbl9mYWlsZWQnKTtcbiAgICAgICAgICAgICAgICBpZiAoZmFpbGVkLm9rKSByZXR1cm4ge1xuICAgICAgICAgICAgICAgICAgICBhcHBsaWNhdGlvblJ1bklkLFxuICAgICAgICAgICAgICAgICAgICB0ZXJtaW5hbFN0YXR1czogJ2ZhaWxlZCdcbiAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgICAgIHJldHVybiBhd2FpdCBvYnNlcnZlQXV0aG9yaXRhdGl2ZVN0YXRlKGFwcGxpY2F0aW9uUnVuSWQpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgYXdhaXQgcmVjb3JkVGVsZW1ldHJ5QWZ0ZXJQZXJzaXN0ZW5jZShhcHBsaWNhdGlvblJ1bklkLCBleGVjdXRpb24uZXhlY3V0aW9uLCBub3JtYWxpemVkLnJlc3VsdC5wYWNrZXQpO1xuICAgICAgICAgICAgY29uc3QgY29tcGxldGVkID0gYXdhaXQgY29tcGxldGVQZXJzaXN0ZWRSdW4oYXBwbGljYXRpb25SdW5JZCk7XG4gICAgICAgICAgICBpZiAoY29tcGxldGVkLm9rKSB7XG4gICAgICAgICAgICAgICAgYXdhaXQgcmVjb25jaWxlQ29tcGxldGVkUnVuKGFwcGxpY2F0aW9uUnVuSWQpO1xuICAgICAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgICAgIGFwcGxpY2F0aW9uUnVuSWQsXG4gICAgICAgICAgICAgICAgICAgIHRlcm1pbmFsU3RhdHVzOiAnY29tcGxldGVkJ1xuICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGF3YWl0IG9ic2VydmVBdXRob3JpdGF0aXZlU3RhdGUoYXBwbGljYXRpb25SdW5JZCk7XG4gICAgfVxuICAgIGlmIChjdXJyZW50LnN0YXR1cyA9PT0gJ3J1bm5pbmcnKSB7XG4gICAgICAgIGNvbnN0IHRpbWVvdXRTZWNvbmRzID0gY3VycmVudC5wb2xpY3lTbmFwc2hvdC5tb2RlID09PSAncGhhc2UzMl9ub29wJyA/IDUgOiBjdXJyZW50LnBvbGljeVNuYXBzaG90LmVmZmVjdGl2ZU1heEV4ZWN1dGlvblNlY29uZHM7XG4gICAgICAgIGNvbnN0IHdpbmRvd0V4cGlyZWQgPSBjdXJyZW50LnN0YXJ0ZWRBdCAhPT0gbnVsbCAmJiBEYXRlLm5vdygpIC0gY3VycmVudC5zdGFydGVkQXQuZ2V0VGltZSgpID4gdGltZW91dFNlY29uZHMgKiAxXzAwMDtcbiAgICAgICAgY29uc3QgdGVybWluYWwgPSB3aW5kb3dFeHBpcmVkID8gYXdhaXQgcmVjb3JkRmFpbHVyZShhcHBsaWNhdGlvblJ1bklkLCAndGltZWRfb3V0JykgOiBhd2FpdCByZWNvcmRDYW5jZWxsZWRSdW4oYXBwbGljYXRpb25SdW5JZCk7XG4gICAgICAgIGlmICh0ZXJtaW5hbC5vaykgcmV0dXJuIHtcbiAgICAgICAgICAgIGFwcGxpY2F0aW9uUnVuSWQsXG4gICAgICAgICAgICB0ZXJtaW5hbFN0YXR1czogd2luZG93RXhwaXJlZCA/ICdmYWlsZWQnIDogJ2NhbmNlbGxlZCdcbiAgICAgICAgfTtcbiAgICB9XG4gICAgcmV0dXJuIGF3YWl0IG9ic2VydmVBdXRob3JpdGF0aXZlU3RhdGUoYXBwbGljYXRpb25SdW5JZCk7XG59XG5hbmFseXNpc1J1bi53b3JrZmxvd0lkID0gXCJ3b3JrZmxvdy8vLi9zcmMvd29ya2Zsb3dzL2FuYWx5c2lzUnVuLy9hbmFseXNpc1J1blwiO1xuZ2xvYmFsVGhpcy5fX3ByaXZhdGVfd29ya2Zsb3dzLnNldChcIndvcmtmbG93Ly8uL3NyYy93b3JrZmxvd3MvYW5hbHlzaXNSdW4vL2FuYWx5c2lzUnVuXCIsIGFuYWx5c2lzUnVuKTtcbnZhciBsb2FkUnVuID0gZ2xvYmFsVGhpc1tTeW1ib2wuZm9yKFwiV09SS0ZMT1dfVVNFX1NURVBcIildKFwic3RlcC8vLi9zcmMvd29ya2Zsb3dzL2FuYWx5c2lzUnVuLy9sb2FkUnVuXCIpO1xudmFyIGNsYWltUXVldWVkUnVuID0gZ2xvYmFsVGhpc1tTeW1ib2wuZm9yKFwiV09SS0ZMT1dfVVNFX1NURVBcIildKFwic3RlcC8vLi9zcmMvd29ya2Zsb3dzL2FuYWx5c2lzUnVuLy9jbGFpbVF1ZXVlZFJ1blwiKTtcbnZhciBleGVjdXRlR3JvdW5kZWRBbmFseXNpcyA9IGdsb2JhbFRoaXNbU3ltYm9sLmZvcihcIldPUktGTE9XX1VTRV9TVEVQXCIpXShcInN0ZXAvLy4vc3JjL3dvcmtmbG93cy9hbmFseXNpc1J1bi8vZXhlY3V0ZUdyb3VuZGVkQW5hbHlzaXNcIik7XG52YXIgbm9ybWFsaXplR3JvdW5kZWRQYWNrZXQgPSBnbG9iYWxUaGlzW1N5bWJvbC5mb3IoXCJXT1JLRkxPV19VU0VfU1RFUFwiKV0oXCJzdGVwLy8uL3NyYy93b3JrZmxvd3MvYW5hbHlzaXNSdW4vL25vcm1hbGl6ZUdyb3VuZGVkUGFja2V0XCIpO1xudmFyIHBlcnNpc3RHcm91bmRlZFBhY2tldCA9IGdsb2JhbFRoaXNbU3ltYm9sLmZvcihcIldPUktGTE9XX1VTRV9TVEVQXCIpXShcInN0ZXAvLy4vc3JjL3dvcmtmbG93cy9hbmFseXNpc1J1bi8vcGVyc2lzdEdyb3VuZGVkUGFja2V0XCIpO1xudmFyIHJlY29yZFRlbGVtZXRyeUFmdGVyUGVyc2lzdGVuY2UgPSBnbG9iYWxUaGlzW1N5bWJvbC5mb3IoXCJXT1JLRkxPV19VU0VfU1RFUFwiKV0oXCJzdGVwLy8uL3NyYy93b3JrZmxvd3MvYW5hbHlzaXNSdW4vL3JlY29yZFRlbGVtZXRyeUFmdGVyUGVyc2lzdGVuY2VcIik7XG52YXIgY29tcGxldGVQZXJzaXN0ZWRSdW4gPSBnbG9iYWxUaGlzW1N5bWJvbC5mb3IoXCJXT1JLRkxPV19VU0VfU1RFUFwiKV0oXCJzdGVwLy8uL3NyYy93b3JrZmxvd3MvYW5hbHlzaXNSdW4vL2NvbXBsZXRlUGVyc2lzdGVkUnVuXCIpO1xudmFyIHJlY29uY2lsZUNvbXBsZXRlZFJ1biA9IGdsb2JhbFRoaXNbU3ltYm9sLmZvcihcIldPUktGTE9XX1VTRV9TVEVQXCIpXShcInN0ZXAvLy4vc3JjL3dvcmtmbG93cy9hbmFseXNpc1J1bi8vcmVjb25jaWxlQ29tcGxldGVkUnVuXCIpO1xudmFyIHJlY29yZEZhaWx1cmUgPSBnbG9iYWxUaGlzW1N5bWJvbC5mb3IoXCJXT1JLRkxPV19VU0VfU1RFUFwiKV0oXCJzdGVwLy8uL3NyYy93b3JrZmxvd3MvYW5hbHlzaXNSdW4vL3JlY29yZEZhaWx1cmVcIik7XG52YXIgcmVjb3JkQ2FuY2VsbGVkUnVuID0gZ2xvYmFsVGhpc1tTeW1ib2wuZm9yKFwiV09SS0ZMT1dfVVNFX1NURVBcIildKFwic3RlcC8vLi9zcmMvd29ya2Zsb3dzL2FuYWx5c2lzUnVuLy9yZWNvcmRDYW5jZWxsZWRSdW5cIik7XG52YXIgb2JzZXJ2ZUF1dGhvcml0YXRpdmVTdGF0ZSA9IGdsb2JhbFRoaXNbU3ltYm9sLmZvcihcIldPUktGTE9XX1VTRV9TVEVQXCIpXShcInN0ZXAvLy4vc3JjL3dvcmtmbG93cy9hbmFseXNpc1J1bi8vb2JzZXJ2ZUF1dGhvcml0YXRpdmVTdGF0ZVwiKTtcbiIsICJpbXBvcnQgdHlwZSB7IFN0cmluZ1ZhbHVlIH0gZnJvbSAnbXMnO1xuaW1wb3J0IG1zIGZyb20gJ21zJztcblxuLyoqXG4gKiBQYXJzZXMgYSBkdXJhdGlvbiBwYXJhbWV0ZXIgKHN0cmluZywgbnVtYmVyLCBvciBEYXRlKSBhbmQgcmV0dXJucyBhIERhdGUgb2JqZWN0XG4gKiByZXByZXNlbnRpbmcgd2hlbiB0aGUgZHVyYXRpb24gc2hvdWxkIGVsYXBzZS5cbiAqXG4gKiAtIEZvciBzdHJpbmdzOiBQYXJzZXMgZHVyYXRpb24gc3RyaW5ncyBsaWtlIFwiMXNcIiwgXCI1bVwiLCBcIjFoXCIsIGV0Yy4gdXNpbmcgdGhlIGBtc2AgbGlicmFyeVxuICogLSBGb3IgbnVtYmVyczogVHJlYXRzIGFzIG1pbGxpc2Vjb25kcyBmcm9tIG5vd1xuICogLSBGb3IgRGF0ZSBvYmplY3RzOiBSZXR1cm5zIHRoZSBkYXRlIGRpcmVjdGx5IChoYW5kbGVzIGJvdGggRGF0ZSBpbnN0YW5jZXMgYW5kIGRhdGUtbGlrZSBvYmplY3RzIGZyb20gZGVzZXJpYWxpemF0aW9uKVxuICpcbiAqIEBwYXJhbSBwYXJhbSAtIFRoZSBkdXJhdGlvbiBwYXJhbWV0ZXIgKFN0cmluZ1ZhbHVlLCBEYXRlLCBvciBudW1iZXIgb2YgbWlsbGlzZWNvbmRzKVxuICogQHJldHVybnMgQSBEYXRlIG9iamVjdCByZXByZXNlbnRpbmcgd2hlbiB0aGUgZHVyYXRpb24gc2hvdWxkIGVsYXBzZVxuICogQHRocm93cyB7RXJyb3J9IElmIHRoZSBwYXJhbWV0ZXIgaXMgaW52YWxpZCBvciBjYW5ub3QgYmUgcGFyc2VkXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBwYXJzZUR1cmF0aW9uVG9EYXRlKHBhcmFtOiBTdHJpbmdWYWx1ZSB8IERhdGUgfCBudW1iZXIpOiBEYXRlIHtcbiAgaWYgKHR5cGVvZiBwYXJhbSA9PT0gJ3N0cmluZycpIHtcbiAgICBjb25zdCBkdXJhdGlvbk1zID0gbXMocGFyYW0pO1xuICAgIGlmICh0eXBlb2YgZHVyYXRpb25NcyAhPT0gJ251bWJlcicgfHwgZHVyYXRpb25NcyA8IDApIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihcbiAgICAgICAgYEludmFsaWQgZHVyYXRpb246IFwiJHtwYXJhbX1cIi4gRXhwZWN0ZWQgYSB2YWxpZCBkdXJhdGlvbiBzdHJpbmcgbGlrZSBcIjFzXCIsIFwiMW1cIiwgXCIxaFwiLCBldGMuYFxuICAgICAgKTtcbiAgICB9XG4gICAgcmV0dXJuIG5ldyBEYXRlKERhdGUubm93KCkgKyBkdXJhdGlvbk1zKTtcbiAgfSBlbHNlIGlmICh0eXBlb2YgcGFyYW0gPT09ICdudW1iZXInKSB7XG4gICAgaWYgKHBhcmFtIDwgMCB8fCAhTnVtYmVyLmlzRmluaXRlKHBhcmFtKSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKFxuICAgICAgICBgSW52YWxpZCBkdXJhdGlvbjogJHtwYXJhbX0uIEV4cGVjdGVkIGEgbm9uLW5lZ2F0aXZlIGZpbml0ZSBudW1iZXIgb2YgbWlsbGlzZWNvbmRzLmBcbiAgICAgICk7XG4gICAgfVxuICAgIHJldHVybiBuZXcgRGF0ZShEYXRlLm5vdygpICsgcGFyYW0pO1xuICB9IGVsc2UgaWYgKFxuICAgIHBhcmFtIGluc3RhbmNlb2YgRGF0ZSB8fFxuICAgIChwYXJhbSAmJlxuICAgICAgdHlwZW9mIHBhcmFtID09PSAnb2JqZWN0JyAmJlxuICAgICAgdHlwZW9mIChwYXJhbSBhcyBhbnkpLmdldFRpbWUgPT09ICdmdW5jdGlvbicpXG4gICkge1xuICAgIC8vIEhhbmRsZSBib3RoIERhdGUgaW5zdGFuY2VzIGFuZCBkYXRlLWxpa2Ugb2JqZWN0cyAoZnJvbSBkZXNlcmlhbGl6YXRpb24pXG4gICAgcmV0dXJuIHBhcmFtIGluc3RhbmNlb2YgRGF0ZSA/IHBhcmFtIDogbmV3IERhdGUoKHBhcmFtIGFzIGFueSkuZ2V0VGltZSgpKTtcbiAgfSBlbHNlIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoXG4gICAgICBgSW52YWxpZCBkdXJhdGlvbiBwYXJhbWV0ZXIuIEV4cGVjdGVkIGEgZHVyYXRpb24gc3RyaW5nLCBudW1iZXIgKG1pbGxpc2Vjb25kcyksIG9yIERhdGUgb2JqZWN0LmBcbiAgICApO1xuICB9XG59XG4iLCAiaW1wb3J0IHsgcGFyc2VEdXJhdGlvblRvRGF0ZSB9IGZyb20gJ0B3b3JrZmxvdy91dGlscyc7XG5pbXBvcnQgdHlwZSB7IFN0cnVjdHVyZWRFcnJvciB9IGZyb20gJ0B3b3JrZmxvdy93b3JsZCc7XG5pbXBvcnQgdHlwZSB7IFN0cmluZ1ZhbHVlIH0gZnJvbSAnbXMnO1xuXG5jb25zdCBCQVNFX1VSTCA9ICdodHRwczovL3VzZXdvcmtmbG93LmRldi9lcnInO1xuXG4vKipcbiAqIEBpbnRlcm5hbFxuICogQ2hlY2sgaWYgYSB2YWx1ZSBpcyBhbiBFcnJvciB3aXRob3V0IHJlbHlpbmcgb24gTm9kZS5qcyB1dGlsaXRpZXMuXG4gKiBUaGlzIGlzIG5lZWRlZCBmb3IgZXJyb3IgY2xhc3NlcyB0aGF0IGNhbiBiZSB1c2VkIGluIFZNIGNvbnRleHRzIHdoZXJlXG4gKiBOb2RlLmpzIGltcG9ydHMgYXJlIG5vdCBhdmFpbGFibGUuXG4gKi9cbmZ1bmN0aW9uIGlzRXJyb3IodmFsdWU6IHVua25vd24pOiB2YWx1ZSBpcyB7IG5hbWU6IHN0cmluZzsgbWVzc2FnZTogc3RyaW5nIH0ge1xuICByZXR1cm4gKFxuICAgIHR5cGVvZiB2YWx1ZSA9PT0gJ29iamVjdCcgJiZcbiAgICB2YWx1ZSAhPT0gbnVsbCAmJlxuICAgICduYW1lJyBpbiB2YWx1ZSAmJlxuICAgICdtZXNzYWdlJyBpbiB2YWx1ZVxuICApO1xufVxuXG4vKipcbiAqIEBpbnRlcm5hbFxuICogQWxsIHRoZSBzbHVncyBvZiB0aGUgZXJyb3JzIHVzZWQgZm9yIGRvY3VtZW50YXRpb24gbGlua3MuXG4gKi9cbmV4cG9ydCBjb25zdCBFUlJPUl9TTFVHUyA9IHtcbiAgTk9ERV9KU19NT0RVTEVfSU5fV09SS0ZMT1c6ICdub2RlLWpzLW1vZHVsZS1pbi13b3JrZmxvdycsXG4gIFNUQVJUX0lOVkFMSURfV09SS0ZMT1dfRlVOQ1RJT046ICdzdGFydC1pbnZhbGlkLXdvcmtmbG93LWZ1bmN0aW9uJyxcbiAgU0VSSUFMSVpBVElPTl9GQUlMRUQ6ICdzZXJpYWxpemF0aW9uLWZhaWxlZCcsXG4gIFdFQkhPT0tfSU5WQUxJRF9SRVNQT05EX1dJVEhfVkFMVUU6ICd3ZWJob29rLWludmFsaWQtcmVzcG9uZC13aXRoLXZhbHVlJyxcbiAgV0VCSE9PS19SRVNQT05TRV9OT1RfU0VOVDogJ3dlYmhvb2stcmVzcG9uc2Utbm90LXNlbnQnLFxuICBGRVRDSF9JTl9XT1JLRkxPV19GVU5DVElPTjogJ2ZldGNoLWluLXdvcmtmbG93JyxcbiAgVElNRU9VVF9GVU5DVElPTlNfSU5fV09SS0ZMT1c6ICd0aW1lb3V0LWluLXdvcmtmbG93JyxcbiAgSE9PS19DT05GTElDVDogJ2hvb2stY29uZmxpY3QnLFxuICBDT1JSVVBURURfRVZFTlRfTE9HOiAnY29ycnVwdGVkLWV2ZW50LWxvZycsXG4gIFJFUExBWV9ESVZFUkdFTkNFOiAncmVwbGF5LWRpdmVyZ2VuY2UnLFxuICBTVEVQX05PVF9SRUdJU1RFUkVEOiAnc3RlcC1ub3QtcmVnaXN0ZXJlZCcsXG4gIFdPUktGTE9XX05PVF9SRUdJU1RFUkVEOiAnd29ya2Zsb3ctbm90LXJlZ2lzdGVyZWQnLFxuICBSVU5USU1FX0RFQ1JZUFRJT05fRkFJTEVEOiAncnVudGltZS1kZWNyeXB0aW9uLWZhaWxlZCcsXG59IGFzIGNvbnN0O1xuXG50eXBlIEVycm9yU2x1ZyA9ICh0eXBlb2YgRVJST1JfU0xVR1MpW2tleW9mIHR5cGVvZiBFUlJPUl9TTFVHU107XG5cbmludGVyZmFjZSBXb3JrZmxvd0Vycm9yT3B0aW9ucyBleHRlbmRzIEVycm9yT3B0aW9ucyB7XG4gIC8qKlxuICAgKiBUaGUgc2x1ZyBvZiB0aGUgZXJyb3IuIFRoaXMgd2lsbCBiZSB1c2VkIHRvIGdlbmVyYXRlIGEgbGluayB0byB0aGUgZXJyb3IgZG9jdW1lbnRhdGlvbi5cbiAgICovXG4gIHNsdWc/OiBFcnJvclNsdWc7XG59XG5cbi8qKlxuICogVGhlIGJhc2UgY2xhc3MgZm9yIGFsbCBXb3JrZmxvdy1yZWxhdGVkIGVycm9ycy5cbiAqXG4gKiBUaGlzIGVycm9yIGlzIHRocm93biBieSB0aGUgV29ya2Zsb3cgU0RLIHdoZW4gaW50ZXJuYWwgb3BlcmF0aW9ucyBmYWlsLlxuICogWW91IGNhbiB1c2UgdGhpcyBjbGFzcyB3aXRoIGBpbnN0YW5jZW9mYCB0byBjYXRjaCBhbnkgV29ya2Zsb3cgU0RLIGVycm9yLlxuICpcbiAqIEBleGFtcGxlXG4gKiBgYGB0c1xuICogdHJ5IHtcbiAqICAgYXdhaXQgZ2V0UnVuKHJ1bklkKTtcbiAqIH0gY2F0Y2ggKGVycm9yKSB7XG4gKiAgIGlmIChlcnJvciBpbnN0YW5jZW9mIFdvcmtmbG93RXJyb3IpIHtcbiAqICAgICBjb25zb2xlLmVycm9yKCdXb3JrZmxvdyBTREsgZXJyb3I6JywgZXJyb3IubWVzc2FnZSk7XG4gKiAgIH1cbiAqIH1cbiAqIGBgYFxuICovXG5leHBvcnQgY2xhc3MgV29ya2Zsb3dFcnJvciBleHRlbmRzIEVycm9yIHtcbiAgcmVhZG9ubHkgY2F1c2U/OiB1bmtub3duO1xuXG4gIGNvbnN0cnVjdG9yKG1lc3NhZ2U6IHN0cmluZywgb3B0aW9ucz86IFdvcmtmbG93RXJyb3JPcHRpb25zKSB7XG4gICAgY29uc3QgbXNnRG9jcyA9IG9wdGlvbnM/LnNsdWdcbiAgICAgID8gYCR7bWVzc2FnZX1cXG5cXG5MZWFybiBtb3JlOiAke0JBU0VfVVJMfS8ke29wdGlvbnMuc2x1Z31gXG4gICAgICA6IG1lc3NhZ2U7XG4gICAgc3VwZXIobXNnRG9jcywgeyBjYXVzZTogb3B0aW9ucz8uY2F1c2UgfSk7XG4gICAgdGhpcy5jYXVzZSA9IG9wdGlvbnM/LmNhdXNlO1xuXG4gICAgaWYgKG9wdGlvbnM/LmNhdXNlIGluc3RhbmNlb2YgRXJyb3IpIHtcbiAgICAgIHRoaXMuc3RhY2sgPSBgJHt0aGlzLnN0YWNrfVxcbkNhdXNlZCBieTogJHtvcHRpb25zLmNhdXNlLnN0YWNrfWA7XG4gICAgfVxuICB9XG5cbiAgc3RhdGljIGlzKHZhbHVlOiB1bmtub3duKTogdmFsdWUgaXMgV29ya2Zsb3dFcnJvciB7XG4gICAgcmV0dXJuIGlzRXJyb3IodmFsdWUpICYmIHZhbHVlLm5hbWUgPT09ICdXb3JrZmxvd0Vycm9yJztcbiAgfVxufVxuXG4vKipcbiAqIFRocm93biB3aGVuIGEgd29ybGQgKHN0b3JhZ2UgYmFja2VuZCkgb3BlcmF0aW9uIGZhaWxzIHVuZXhwZWN0ZWRseS5cbiAqXG4gKiBUaGlzIGlzIHRoZSBjYXRjaC1hbGwgZXJyb3IgZm9yIHdvcmxkIGltcGxlbWVudGF0aW9ucy4gU3BlY2lmaWMsXG4gKiB3ZWxsLWtub3duIGZhaWx1cmUgbW9kZXMgaGF2ZSBkZWRpY2F0ZWQgZXJyb3IgdHlwZXMgKGUuZy5cbiAqIEVudGl0eUNvbmZsaWN0RXJyb3IsIFJ1bkV4cGlyZWRFcnJvciwgVGhyb3R0bGVFcnJvcikuIFRoaXMgZXJyb3JcbiAqIGNvdmVycyBldmVyeXRoaW5nIGVsc2Ug4oCUIHZhbGlkYXRpb24gZmFpbHVyZXMsIG1pc3NpbmcgZW50aXRpZXNcbiAqIHdpdGhvdXQgYSBkZWRpY2F0ZWQgdHlwZSwgb3IgdW5leHBlY3RlZCBIVFRQIGVycm9ycyBmcm9tIHdvcmxkLXZlcmNlbC5cbiAqL1xuZXhwb3J0IGNsYXNzIFdvcmtmbG93V29ybGRFcnJvciBleHRlbmRzIFdvcmtmbG93RXJyb3Ige1xuICBzdGF0dXM/OiBudW1iZXI7XG4gIGNvZGU/OiBzdHJpbmc7XG4gIHVybD86IHN0cmluZztcbiAgLyoqIFJldHJ5LUFmdGVyIHZhbHVlIGluIHNlY29uZHMsIHByZXNlbnQgb24gNDI5IGFuZCA0MjUgcmVzcG9uc2VzICovXG4gIHJldHJ5QWZ0ZXI/OiBudW1iZXI7XG5cbiAgY29uc3RydWN0b3IoXG4gICAgbWVzc2FnZTogc3RyaW5nLFxuICAgIG9wdGlvbnM/OiB7XG4gICAgICBzdGF0dXM/OiBudW1iZXI7XG4gICAgICB1cmw/OiBzdHJpbmc7XG4gICAgICBjb2RlPzogc3RyaW5nO1xuICAgICAgcmV0cnlBZnRlcj86IG51bWJlcjtcbiAgICAgIGNhdXNlPzogdW5rbm93bjtcbiAgICB9XG4gICkge1xuICAgIHN1cGVyKG1lc3NhZ2UsIHtcbiAgICAgIGNhdXNlOiBvcHRpb25zPy5jYXVzZSxcbiAgICB9KTtcbiAgICB0aGlzLm5hbWUgPSAnV29ya2Zsb3dXb3JsZEVycm9yJztcbiAgICB0aGlzLnN0YXR1cyA9IG9wdGlvbnM/LnN0YXR1cztcbiAgICB0aGlzLmNvZGUgPSBvcHRpb25zPy5jb2RlO1xuICAgIHRoaXMudXJsID0gb3B0aW9ucz8udXJsO1xuICAgIHRoaXMucmV0cnlBZnRlciA9IG9wdGlvbnM/LnJldHJ5QWZ0ZXI7XG4gIH1cblxuICBzdGF0aWMgaXModmFsdWU6IHVua25vd24pOiB2YWx1ZSBpcyBXb3JrZmxvd1dvcmxkRXJyb3Ige1xuICAgIHJldHVybiBpc0Vycm9yKHZhbHVlKSAmJiB2YWx1ZS5uYW1lID09PSAnV29ya2Zsb3dXb3JsZEVycm9yJztcbiAgfVxufVxuXG4vKipcbiAqIFRocm93biB3aGVuIGEgd29ya2Zsb3cgcnVuIGZhaWxzIGR1cmluZyBleGVjdXRpb24uXG4gKlxuICogVGhpcyBlcnJvciBpbmRpY2F0ZXMgdGhhdCB0aGUgd29ya2Zsb3cgZW5jb3VudGVyZWQgYSBmYXRhbCBlcnJvciBhbmQgY2Fubm90XG4gKiBjb250aW51ZS4gSXQgaXMgdGhyb3duIHdoZW4gYXdhaXRpbmcgYHJ1bi5yZXR1cm5WYWx1ZWAgb24gYSBydW4gd2hvc2Ugc3RhdHVzXG4gKiBpcyBgJ2ZhaWxlZCdgLiBUaGUgYGNhdXNlYCBwcm9wZXJ0eSBjb250YWlucyB0aGUgdW5kZXJseWluZyBlcnJvciB3aXRoIGl0c1xuICogbWVzc2FnZSwgc3RhY2sgdHJhY2UsIGFuZCBvcHRpb25hbCBlcnJvciBjb2RlLlxuICpcbiAqIFVzZSB0aGUgc3RhdGljIGBXb3JrZmxvd1J1bkZhaWxlZEVycm9yLmlzKClgIG1ldGhvZCBmb3IgdHlwZS1zYWZlIGNoZWNraW5nXG4gKiBpbiBjYXRjaCBibG9ja3MuXG4gKlxuICogQGV4YW1wbGVcbiAqIGBgYHRzXG4gKiBpbXBvcnQgeyBXb3JrZmxvd1J1bkZhaWxlZEVycm9yIH0gZnJvbSBcIndvcmtmbG93L2ludGVybmFsL2Vycm9yc1wiO1xuICpcbiAqIHRyeSB7XG4gKiAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IHJ1bi5yZXR1cm5WYWx1ZTtcbiAqIH0gY2F0Y2ggKGVycm9yKSB7XG4gKiAgIGlmIChXb3JrZmxvd1J1bkZhaWxlZEVycm9yLmlzKGVycm9yKSkge1xuICogICAgIGNvbnNvbGUuZXJyb3IoYFJ1biAke2Vycm9yLnJ1bklkfSBmYWlsZWQ6YCwgZXJyb3IuY2F1c2UubWVzc2FnZSk7XG4gKiAgIH1cbiAqIH1cbiAqIGBgYFxuICovXG5leHBvcnQgY2xhc3MgV29ya2Zsb3dSdW5GYWlsZWRFcnJvciBleHRlbmRzIFdvcmtmbG93RXJyb3Ige1xuICBydW5JZDogc3RyaW5nO1xuICBkZWNsYXJlIGNhdXNlOiBFcnJvciAmIHsgY29kZT86IHN0cmluZyB9O1xuXG4gIGNvbnN0cnVjdG9yKHJ1bklkOiBzdHJpbmcsIGVycm9yOiBTdHJ1Y3R1cmVkRXJyb3IpIHtcbiAgICAvLyBDcmVhdGUgYSBwcm9wZXIgRXJyb3IgaW5zdGFuY2UgZnJvbSB0aGUgU3RydWN0dXJlZEVycm9yIHRvIHNldCBhcyBjYXVzZVxuICAgIC8vIE5PVEU6IGN1c3RvbSBlcnJvciB0eXBlcyBkbyBub3QgZ2V0IHNlcmlhbGl6ZWQvZGVzZXJpYWxpemVkLiBFdmVyeXRoaW5nIGlzIGFuIEVycm9yXG4gICAgY29uc3QgY2F1c2VFcnJvciA9IG5ldyBFcnJvcihlcnJvci5tZXNzYWdlKTtcbiAgICBpZiAoZXJyb3Iuc3RhY2spIHtcbiAgICAgIGNhdXNlRXJyb3Iuc3RhY2sgPSBlcnJvci5zdGFjaztcbiAgICB9XG4gICAgaWYgKGVycm9yLmNvZGUpIHtcbiAgICAgIChjYXVzZUVycm9yIGFzIGFueSkuY29kZSA9IGVycm9yLmNvZGU7XG4gICAgfVxuXG4gICAgc3VwZXIoYFdvcmtmbG93IHJ1biBcIiR7cnVuSWR9XCIgZmFpbGVkOiAke2Vycm9yLm1lc3NhZ2V9YCwge1xuICAgICAgY2F1c2U6IGNhdXNlRXJyb3IsXG4gICAgfSk7XG4gICAgdGhpcy5uYW1lID0gJ1dvcmtmbG93UnVuRmFpbGVkRXJyb3InO1xuICAgIHRoaXMucnVuSWQgPSBydW5JZDtcbiAgfVxuXG4gIHN0YXRpYyBpcyh2YWx1ZTogdW5rbm93bik6IHZhbHVlIGlzIFdvcmtmbG93UnVuRmFpbGVkRXJyb3Ige1xuICAgIHJldHVybiBpc0Vycm9yKHZhbHVlKSAmJiB2YWx1ZS5uYW1lID09PSAnV29ya2Zsb3dSdW5GYWlsZWRFcnJvcic7XG4gIH1cbn1cblxuLyoqXG4gKiBUaHJvd24gd2hlbiBhdHRlbXB0aW5nIHRvIGdldCByZXN1bHRzIGZyb20gYW4gaW5jb21wbGV0ZSB3b3JrZmxvdyBydW4uXG4gKlxuICogVGhpcyBlcnJvciBvY2N1cnMgd2hlbiB5b3UgdHJ5IHRvIGFjY2VzcyB0aGUgcmVzdWx0IG9mIGEgd29ya2Zsb3dcbiAqIHRoYXQgaXMgc3RpbGwgcnVubmluZyBvciBoYXNuJ3QgY29tcGxldGVkIHlldC5cbiAqL1xuZXhwb3J0IGNsYXNzIFdvcmtmbG93UnVuTm90Q29tcGxldGVkRXJyb3IgZXh0ZW5kcyBXb3JrZmxvd0Vycm9yIHtcbiAgcnVuSWQ6IHN0cmluZztcbiAgc3RhdHVzOiBzdHJpbmc7XG5cbiAgY29uc3RydWN0b3IocnVuSWQ6IHN0cmluZywgc3RhdHVzOiBzdHJpbmcpIHtcbiAgICBzdXBlcihgV29ya2Zsb3cgcnVuIFwiJHtydW5JZH1cIiBoYXMgbm90IGNvbXBsZXRlZGAsIHt9KTtcbiAgICB0aGlzLm5hbWUgPSAnV29ya2Zsb3dSdW5Ob3RDb21wbGV0ZWRFcnJvcic7XG4gICAgdGhpcy5ydW5JZCA9IHJ1bklkO1xuICAgIHRoaXMuc3RhdHVzID0gc3RhdHVzO1xuICB9XG5cbiAgc3RhdGljIGlzKHZhbHVlOiB1bmtub3duKTogdmFsdWUgaXMgV29ya2Zsb3dSdW5Ob3RDb21wbGV0ZWRFcnJvciB7XG4gICAgcmV0dXJuIGlzRXJyb3IodmFsdWUpICYmIHZhbHVlLm5hbWUgPT09ICdXb3JrZmxvd1J1bk5vdENvbXBsZXRlZEVycm9yJztcbiAgfVxufVxuXG4vKipcbiAqIFRocm93biB3aGVuIHRoZSBXb3JrZmxvdyBydW50aW1lIGVuY291bnRlcnMgYW4gaW50ZXJuYWwgZXJyb3IuXG4gKlxuICogVGhpcyBlcnJvciBpbmRpY2F0ZXMgYW4gaXNzdWUgd2l0aCB3b3JrZmxvdyBleGVjdXRpb24sIHN1Y2ggYXNcbiAqIHNlcmlhbGl6YXRpb24gZmFpbHVyZXMsIHN0YXJ0aW5nIGFuIGludmFsaWQgd29ya2Zsb3cgZnVuY3Rpb24sIG9yXG4gKiBvdGhlciBydW50aW1lIHByb2JsZW1zLlxuICovXG5leHBvcnQgY2xhc3MgV29ya2Zsb3dSdW50aW1lRXJyb3IgZXh0ZW5kcyBXb3JrZmxvd0Vycm9yIHtcbiAgY29uc3RydWN0b3IobWVzc2FnZTogc3RyaW5nLCBvcHRpb25zPzogV29ya2Zsb3dFcnJvck9wdGlvbnMpIHtcbiAgICBzdXBlcihtZXNzYWdlLCB7XG4gICAgICAuLi5vcHRpb25zLFxuICAgIH0pO1xuICAgIHRoaXMubmFtZSA9ICdXb3JrZmxvd1J1bnRpbWVFcnJvcic7XG4gIH1cblxuICBzdGF0aWMgaXModmFsdWU6IHVua25vd24pOiB2YWx1ZSBpcyBXb3JrZmxvd1J1bnRpbWVFcnJvciB7XG4gICAgcmV0dXJuIGlzRXJyb3IodmFsdWUpICYmIHZhbHVlLm5hbWUgPT09ICdXb3JrZmxvd1J1bnRpbWVFcnJvcic7XG4gIH1cbn1cblxuLyoqXG4gKiBUaHJvd24gd2hlbiB0aGUgcGVyc2lzdGVkIHdvcmtmbG93IGV2ZW50IGxvZyBjYW5ub3QgYmUgcmVwbGF5ZWQgYmVjYXVzZSBpdFxuICogY29udGFpbnMgb3JwaGFuZWQsIGR1cGxpY2F0ZSwgb3IgbWlzbWF0Y2hlZCBldmVudHMuXG4gKlxuICogVGhpcyBpcyBhIHJ1bnRpbWUvaW5mcmFzdHJ1Y3R1cmUgZmFpbHVyZSByYXRoZXIgdGhhbiB1c2VyIGNvZGUgdGhyb3dpbmcuXG4gKiBXaGVuIHRoaXMgcmVhY2hlcyBydW4gZmFpbHVyZSBoYW5kbGluZywgaXQgaXMgcmVjb3JkZWQgd2l0aCB0aGUgZGlzdGluY3RcbiAqIGBDT1JSVVBURURfRVZFTlRfTE9HYCBjb2RlIHNvIHdvcmxkcyBhbmQgYmFja2VuZHMgY2FuIHRyYWNrIGl0IHNlcGFyYXRlbHlcbiAqIGZyb20gZ2VuZXJpYyBydW50aW1lIGZhaWx1cmVzLlxuICovXG5leHBvcnQgY2xhc3MgQ29ycnVwdGVkRXZlbnRMb2dFcnJvciBleHRlbmRzIFdvcmtmbG93UnVudGltZUVycm9yIHtcbiAgY29uc3RydWN0b3IobWVzc2FnZTogc3RyaW5nLCBvcHRpb25zPzogRXJyb3JPcHRpb25zKSB7XG4gICAgc3VwZXIobWVzc2FnZSwge1xuICAgICAgLi4ub3B0aW9ucyxcbiAgICAgIHNsdWc6IEVSUk9SX1NMVUdTLkNPUlJVUFRFRF9FVkVOVF9MT0csXG4gICAgfSk7XG4gICAgdGhpcy5uYW1lID0gJ0NvcnJ1cHRlZEV2ZW50TG9nRXJyb3InO1xuICB9XG5cbiAgc3RhdGljIGlzKHZhbHVlOiB1bmtub3duKTogdmFsdWUgaXMgQ29ycnVwdGVkRXZlbnRMb2dFcnJvciB7XG4gICAgcmV0dXJuIGlzRXJyb3IodmFsdWUpICYmIHZhbHVlLm5hbWUgPT09ICdDb3JydXB0ZWRFdmVudExvZ0Vycm9yJztcbiAgfVxufVxuXG4vKipcbiAqIFRocm93biB3aGVuIGEgcnVuJ3MgZXZlbnQgbG9nIHJlYWNoZXMgdGhlIHNlcnZlci1zdXBwbGllZCBwZXItcnVuIGV2ZW50XG4gKiBjZWlsaW5nLiBDbGFzc2lmaWVkIGFzIGBNQVhfRVZFTlRTX0VYQ0VFREVEYCAoc2VlIGBjbGFzc2lmeVJ1bkVycm9yYCkuXG4gKi9cbmV4cG9ydCBjbGFzcyBNYXhFdmVudHNFeGNlZWRlZEVycm9yIGV4dGVuZHMgV29ya2Zsb3dFcnJvciB7XG4gIHJlYWRvbmx5IGV2ZW50Q291bnQ6IG51bWJlcjtcbiAgcmVhZG9ubHkgbGltaXQ6IG51bWJlcjtcblxuICBjb25zdHJ1Y3RvcihcbiAgICBldmVudENvdW50OiBudW1iZXIsXG4gICAgbGltaXQ6IG51bWJlcixcbiAgICBvcHRpb25zPzogV29ya2Zsb3dFcnJvck9wdGlvbnNcbiAgKSB7XG4gICAgc3VwZXIoYFdvcmtmbG93IGV4Y2VlZGVkIHRoZSBtYXhpbXVtIG9mICR7bGltaXR9IGV2ZW50cyBwZXIgcnVuYCwgb3B0aW9ucyk7XG4gICAgdGhpcy5uYW1lID0gJ01heEV2ZW50c0V4Y2VlZGVkRXJyb3InO1xuICAgIHRoaXMuZXZlbnRDb3VudCA9IGV2ZW50Q291bnQ7XG4gICAgdGhpcy5saW1pdCA9IGxpbWl0O1xuICB9XG5cbiAgc3RhdGljIGlzKHZhbHVlOiB1bmtub3duKTogdmFsdWUgaXMgTWF4RXZlbnRzRXhjZWVkZWRFcnJvciB7XG4gICAgcmV0dXJuIGlzRXJyb3IodmFsdWUpICYmIHZhbHVlLm5hbWUgPT09ICdNYXhFdmVudHNFeGNlZWRlZEVycm9yJztcbiAgfVxufVxuXG4vKipcbiAqIE9wdGlvbmFsIHN0cnVjdHVyZWQgY29udGV4dCBhdHRhY2hlZCB0byBhIHtAbGluayBSdW50aW1lRGVjcnlwdGlvbkVycm9yfSxcbiAqIGNhcnJpZWQgb3ZlciBmcm9tIHRoZSB1bmRlcmx5aW5nIGRlY3J5cHQgY2FsbCBzaXRlIHRvIGhlbHAgZGlhZ25vc2UgdGhlXG4gKiBmYWlsdXJlIHdpdGhvdXQgcG9raW5nIHRocm91Z2ggc3RhY2tzLlxuICovXG5leHBvcnQgaW50ZXJmYWNlIFJ1bnRpbWVEZWNyeXB0aW9uRXJyb3JDb250ZXh0IHtcbiAgLyoqIFRoZSBvcGVyYXRpb24gdGhhdCBmYWlsZWQg4oCUIHVzZWZ1bCB0byB0ZWxsIGVuY3J5cHQgdnMgZGVjcnlwdCBhcGFydC4gKi9cbiAgb3BlcmF0aW9uPzogJ2VuY3J5cHQnIHwgJ2RlY3J5cHQnO1xuICAvKiogQnl0ZSBsZW5ndGggb2YgdGhlIGlucHV0IHBheWxvYWQgYXQgdGhlIHRpbWUgb2YgdGhlIGZhaWx1cmUuICovXG4gIGJ5dGVMZW5ndGg/OiBudW1iZXI7XG4gIC8qKlxuICAgKiBUaGUgZmlyc3QgNCBieXRlcyBvZiB0aGUgaW5wdXQgcGF5bG9hZCwgZGVjb2RlZCBhcyBVVEYtOCBpZiBwcmludGFibGUuXG4gICAqIFVzZWZ1bCBmb3IgdGVsbGluZyBhcGFydCB0cnVuY2F0ZWQtYnV0LXZhbGlkLWxvb2tpbmcgZW5jcnlwdGVkIHBheWxvYWRzXG4gICAqIGZyb20gY29tcGxldGVseSB1bnJlbGF0ZWQgY29ycnVwdGlvbiAoZS5nLiBhbiBIVE1MIGVycm9yIHBhZ2Ugc3VyZmFjZWRcbiAgICogYXMgYSAyMDAgT0spLlxuICAgKi9cbiAgZm9ybWF0UHJlZml4Pzogc3RyaW5nO1xufVxuXG4vKipcbiAqIFRocm93biB3aGVuIHRoZSBTREsncyBidWlsdC1pbiBBRVMtR0NNIGVuY3J5cHRpb24gbGF5ZXIgZmFpbHMgdG8gZW5jcnlwdFxuICogb3IgZGVjcnlwdCBhIHdvcmtmbG93IHBheWxvYWQuXG4gKlxuICogVGhpcyBpcyBhbiBpbnRlcm5hbCBTREsgZmFpbHVyZSDigJQgdXNlciBjb2RlIG5ldmVyIGludm9rZXMgdGhlIFNESydzXG4gKiBlbmNyeXB0aW9uIHByaW1pdGl2ZXMgZGlyZWN0bHkuIENvbW1vbiBjYXVzZXM6XG4gKlxuICogLSBBIGNpcGhlcnRleHQgLyBhdXRoIHRhZyBtaXNtYXRjaCwgdHlwaWNhbGx5IHN1cmZhY2VkIGFzIHRoZSBuYXRpdmUgV2ViXG4gKiAgIENyeXB0byBgT3BlcmF0aW9uRXJyb3I6IFRoZSBvcGVyYXRpb24gZmFpbGVkIGZvciBhbiBvcGVyYXRpb24tc3BlY2lmaWNcbiAqICAgcmVhc29uYC4gVXN1YWxseSBjYXVzZWQgYnkgY2lwaGVydGV4dCBtdXRhdGlvbiBvciB0cnVuY2F0aW9uIGluIHRyYW5zaXRcbiAqICAgYmV0d2VlbiBzdG9yYWdlIGFuZCByZWFkICh0cnVuY2F0ZWQgSFRUUCByZXNwb25zZSwgZWRnZS1jYWNoZSBtaXNzXG4gKiAgIHJldHVybmluZyBhIHBhcnRpYWwgMjAwLCBwcm94eSBkcm9wIGR1cmluZyBzdHJlYW1pbmcsIGV0Yy4pLlxuICogLSBBIGtleSByZXNvbHV0aW9uIG1pc21hdGNoICh3cm9uZyBkZXBsb3ltZW50LCBtaXNzaW5nIGtleSBtYXRlcmlhbCkuXG4gKiAtIEEgbWFsZm9ybWVkIGVuY3J5cHRlZCBlbnZlbG9wZSAodG9vIHNob3J0IHRvIGNvbnRhaW4gdGhlIEdDTSBub25jZVxuICogICBhbmQgdGFnKS5cbiAqXG4gKiBFeHRlbmRzIHtAbGluayBXb3JrZmxvd1J1bnRpbWVFcnJvcn0gc28gdGhlIHJ1bi1mYWlsdXJlIGNsYXNzaWZpZXJcbiAqIHJvdXRlcyBpdCB0byBgUlVOVElNRV9FUlJPUmAuXG4gKi9cbmV4cG9ydCBjbGFzcyBSdW50aW1lRGVjcnlwdGlvbkVycm9yIGV4dGVuZHMgV29ya2Zsb3dSdW50aW1lRXJyb3Ige1xuICAvKiogT3B0aW9uYWwgc3RydWN0dXJlZCBjb250ZXh0IGFib3V0IHRoZSBmYWlsZWQgZW5jcnlwdC9kZWNyeXB0IGNhbGwuICovXG4gIGRlY2xhcmUgcmVhZG9ubHkgY29udGV4dD86IFJ1bnRpbWVEZWNyeXB0aW9uRXJyb3JDb250ZXh0O1xuXG4gIGNvbnN0cnVjdG9yKFxuICAgIG1lc3NhZ2U6IHN0cmluZyxcbiAgICBvcHRpb25zPzogRXJyb3JPcHRpb25zICYgeyBjb250ZXh0PzogUnVudGltZURlY3J5cHRpb25FcnJvckNvbnRleHQgfVxuICApIHtcbiAgICBzdXBlcihtZXNzYWdlLCB7XG4gICAgICBjYXVzZTogb3B0aW9ucz8uY2F1c2UsXG4gICAgICBzbHVnOiBFUlJPUl9TTFVHUy5SVU5USU1FX0RFQ1JZUFRJT05fRkFJTEVELFxuICAgIH0pO1xuICAgIHRoaXMubmFtZSA9ICdSdW50aW1lRGVjcnlwdGlvbkVycm9yJztcbiAgICBpZiAob3B0aW9ucz8uY29udGV4dCAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICB0aGlzLmNvbnRleHQgPSBvcHRpb25zLmNvbnRleHQ7XG4gICAgfVxuICB9XG5cbiAgc3RhdGljIGlzKHZhbHVlOiB1bmtub3duKTogdmFsdWUgaXMgUnVudGltZURlY3J5cHRpb25FcnJvciB7XG4gICAgcmV0dXJuIGlzRXJyb3IodmFsdWUpICYmIHZhbHVlLm5hbWUgPT09ICdSdW50aW1lRGVjcnlwdGlvbkVycm9yJztcbiAgfVxufVxuXG4vKipcbiAqIFRocm93biB3aGVuIHRoZSBjdXJyZW50IHdvcmtmbG93IHJlcGxheSBjYW5ub3QgZm9sbG93IHRoZSBwYXRoIGRlc2NyaWJlZCBieVxuICogdGhlIHJlY29yZGVkIGV2ZW50IGxvZy4gQSBzaW5nbGUgZGl2ZXJnZW5jZSBkb2VzIG5vdCBwcm92ZSB0aGF0IHRoZVxuICogcGVyc2lzdGVkIGhpc3RvcnkgaXMgaW52YWxpZDogYSBzdWJzZXF1ZW50IHJlcGxheSBtYXkgb2JzZXJ2ZSBvciBzY2hlZHVsZVxuICogd29yayBjb3JyZWN0bHksIHNvIHRoZSBydW50aW1lIG1heSByZWRlbGl2ZXIgYmVmb3JlIGRlY2xhcmluZyBjb3JydXB0aW9uLlxuICovXG5leHBvcnQgY2xhc3MgUmVwbGF5RGl2ZXJnZW5jZUVycm9yIGV4dGVuZHMgV29ya2Zsb3dSdW50aW1lRXJyb3Ige1xuICByZWFkb25seSBldmVudElkOiBzdHJpbmc7XG5cbiAgY29uc3RydWN0b3IobWVzc2FnZTogc3RyaW5nLCBvcHRpb25zOiBFcnJvck9wdGlvbnMgJiB7IGV2ZW50SWQ6IHN0cmluZyB9KSB7XG4gICAgc3VwZXIobWVzc2FnZSwge1xuICAgICAgLi4ub3B0aW9ucyxcbiAgICAgIHNsdWc6IEVSUk9SX1NMVUdTLlJFUExBWV9ESVZFUkdFTkNFLFxuICAgIH0pO1xuICAgIHRoaXMubmFtZSA9ICdSZXBsYXlEaXZlcmdlbmNlRXJyb3InO1xuICAgIHRoaXMuZXZlbnRJZCA9IG9wdGlvbnMuZXZlbnRJZDtcbiAgfVxuXG4gIHN0YXRpYyBpcyh2YWx1ZTogdW5rbm93bik6IHZhbHVlIGlzIFJlcGxheURpdmVyZ2VuY2VFcnJvciB7XG4gICAgcmV0dXJuIGlzRXJyb3IodmFsdWUpICYmIHZhbHVlLm5hbWUgPT09ICdSZXBsYXlEaXZlcmdlbmNlRXJyb3InO1xuICB9XG59XG5cbi8qKlxuICogVGhyb3duIHdoZW4gYSBzdGVwIGZ1bmN0aW9uIGlzIG5vdCByZWdpc3RlcmVkIGluIHRoZSBjdXJyZW50IGRlcGxveW1lbnQuXG4gKlxuICogVGhpcyBpcyBhbiBpbmZyYXN0cnVjdHVyZSBlcnJvciDigJQgbm90IGEgdXNlciBjb2RlIGVycm9yLiBJdCB0eXBpY2FsbHkgbWVhbnNcbiAqIHNvbWV0aGluZyB3ZW50IHdyb25nIHdpdGggdGhlIGJ1bmRsaW5nL2J1aWxkIHRvb2xpbmcgdGhhdCBjYXVzZWQgdGhlIHN0ZXBcbiAqIHRvIG5vdCBnZXQgYnVpbHQgY29ycmVjdGx5LlxuICpcbiAqIFdoZW4gdGhpcyBoYXBwZW5zLCB0aGUgc3RlcCBmYWlscyAobGlrZSBhIEZhdGFsRXJyb3IpIGFuZCBjb250cm9sIGlzIHBhc3NlZCBiYWNrXG4gKiB0byB0aGUgd29ya2Zsb3cgZnVuY3Rpb24sIHdoaWNoIGNhbiBvcHRpb25hbGx5IGhhbmRsZSB0aGUgZmFpbHVyZSBncmFjZWZ1bGx5LlxuICovXG5leHBvcnQgY2xhc3MgU3RlcE5vdFJlZ2lzdGVyZWRFcnJvciBleHRlbmRzIFdvcmtmbG93UnVudGltZUVycm9yIHtcbiAgc3RlcE5hbWU6IHN0cmluZztcblxuICBjb25zdHJ1Y3RvcihzdGVwTmFtZTogc3RyaW5nKSB7XG4gICAgc3VwZXIoXG4gICAgICBgU3RlcCBcIiR7c3RlcE5hbWV9XCIgaXMgbm90IHJlZ2lzdGVyZWQgaW4gdGhlIGN1cnJlbnQgZGVwbG95bWVudC4gVGhpcyB1c3VhbGx5IGluZGljYXRlcyBhIGJ1aWxkIG9yIGJ1bmRsaW5nIGlzc3VlIHRoYXQgY2F1c2VkIHRoZSBzdGVwIHRvIG5vdCBiZSBpbmNsdWRlZCBpbiB0aGUgZGVwbG95bWVudC5gLFxuICAgICAgeyBzbHVnOiBFUlJPUl9TTFVHUy5TVEVQX05PVF9SRUdJU1RFUkVEIH1cbiAgICApO1xuICAgIHRoaXMubmFtZSA9ICdTdGVwTm90UmVnaXN0ZXJlZEVycm9yJztcbiAgICB0aGlzLnN0ZXBOYW1lID0gc3RlcE5hbWU7XG4gIH1cblxuICBzdGF0aWMgaXModmFsdWU6IHVua25vd24pOiB2YWx1ZSBpcyBTdGVwTm90UmVnaXN0ZXJlZEVycm9yIHtcbiAgICByZXR1cm4gaXNFcnJvcih2YWx1ZSkgJiYgdmFsdWUubmFtZSA9PT0gJ1N0ZXBOb3RSZWdpc3RlcmVkRXJyb3InO1xuICB9XG59XG5cbi8qKlxuICogVGhyb3duIHdoZW4gYSB3b3JrZmxvdyBmdW5jdGlvbiBpcyBub3QgcmVnaXN0ZXJlZCBpbiB0aGUgY3VycmVudCBkZXBsb3ltZW50LlxuICpcbiAqIFRoaXMgaXMgYW4gaW5mcmFzdHJ1Y3R1cmUgZXJyb3Ig4oCUIG5vdCBhIHVzZXIgY29kZSBlcnJvci4gSXQgdHlwaWNhbGx5IG1lYW5zOlxuICogLSBBIHJ1biB3YXMgc3RhcnRlZCBhZ2FpbnN0IGEgZGVwbG95bWVudCB0aGF0IGRvZXMgbm90IGhhdmUgdGhlIHdvcmtmbG93XG4gKiAgIChlLmcuLCB0aGUgd29ya2Zsb3cgd2FzIHJlbmFtZWQgb3IgbW92ZWQgYW5kIGEgbmV3IHJ1biB0YXJnZXRlZCB0aGUgbGF0ZXN0IGRlcGxveW1lbnQpXG4gKiAtIFNvbWV0aGluZyB3ZW50IHdyb25nIHdpdGggdGhlIGJ1bmRsaW5nL2J1aWxkIHRvb2xpbmcgdGhhdCBjYXVzZWQgdGhlIHdvcmtmbG93XG4gKiAgIHRvIG5vdCBnZXQgYnVpbHQgY29ycmVjdGx5XG4gKlxuICogV2hlbiB0aGlzIGhhcHBlbnMsIHRoZSBydW4gZmFpbHMgd2l0aCBhIGBSVU5USU1FX0VSUk9SYCBlcnJvciBjb2RlLlxuICovXG5leHBvcnQgY2xhc3MgV29ya2Zsb3dOb3RSZWdpc3RlcmVkRXJyb3IgZXh0ZW5kcyBXb3JrZmxvd1J1bnRpbWVFcnJvciB7XG4gIHdvcmtmbG93TmFtZTogc3RyaW5nO1xuXG4gIGNvbnN0cnVjdG9yKHdvcmtmbG93TmFtZTogc3RyaW5nKSB7XG4gICAgc3VwZXIoXG4gICAgICBgV29ya2Zsb3cgXCIke3dvcmtmbG93TmFtZX1cIiBpcyBub3QgcmVnaXN0ZXJlZCBpbiB0aGUgY3VycmVudCBkZXBsb3ltZW50LiBUaGlzIHVzdWFsbHkgbWVhbnMgYSBydW4gd2FzIHN0YXJ0ZWQgYWdhaW5zdCBhIGRlcGxveW1lbnQgdGhhdCBkb2VzIG5vdCBoYXZlIHRoaXMgd29ya2Zsb3csIG9yIHRoZXJlIHdhcyBhIGJ1aWxkL2J1bmRsaW5nIGlzc3VlLmAsXG4gICAgICB7IHNsdWc6IEVSUk9SX1NMVUdTLldPUktGTE9XX05PVF9SRUdJU1RFUkVEIH1cbiAgICApO1xuICAgIHRoaXMubmFtZSA9ICdXb3JrZmxvd05vdFJlZ2lzdGVyZWRFcnJvcic7XG4gICAgdGhpcy53b3JrZmxvd05hbWUgPSB3b3JrZmxvd05hbWU7XG4gIH1cblxuICBzdGF0aWMgaXModmFsdWU6IHVua25vd24pOiB2YWx1ZSBpcyBXb3JrZmxvd05vdFJlZ2lzdGVyZWRFcnJvciB7XG4gICAgcmV0dXJuIGlzRXJyb3IodmFsdWUpICYmIHZhbHVlLm5hbWUgPT09ICdXb3JrZmxvd05vdFJlZ2lzdGVyZWRFcnJvcic7XG4gIH1cbn1cblxuLyoqXG4gKiBUaHJvd24gd2hlbiBwZXJmb3JtaW5nIG9wZXJhdGlvbnMgb24gYSB3b3JrZmxvdyBydW4gdGhhdCBkb2VzIG5vdCBleGlzdC5cbiAqXG4gKiBUaGlzIGVycm9yIG9jY3VycyB3aGVuIHlvdSBjYWxsIG1ldGhvZHMgb24gYSBydW4gb2JqZWN0IChlLmcuIGBydW4uc3RhdHVzYCxcbiAqIGBydW4uY2FuY2VsKClgLCBgcnVuLnJldHVyblZhbHVlYCkgYnV0IHRoZSB1bmRlcmx5aW5nIHJ1biBJRCBkb2VzIG5vdCBtYXRjaFxuICogYW55IGtub3duIHdvcmtmbG93IHJ1bi4gTm90ZSB0aGF0IGBnZXRSdW4oaWQpYCBpdHNlbGYgaXMgc3luY2hyb25vdXMgYW5kIHdpbGxcbiAqIG5vdCB0aHJvdyDigJQgdGhpcyBlcnJvciBpcyByYWlzZWQgd2hlbiBzdWJzZXF1ZW50IG9wZXJhdGlvbnMgZGlzY292ZXIgdGhlIHJ1blxuICogaXMgbWlzc2luZy5cbiAqXG4gKiBVc2UgdGhlIHN0YXRpYyBgV29ya2Zsb3dSdW5Ob3RGb3VuZEVycm9yLmlzKClgIG1ldGhvZCBmb3IgdHlwZS1zYWZlIGNoZWNraW5nXG4gKiBpbiBjYXRjaCBibG9ja3MuXG4gKlxuICogQGV4YW1wbGVcbiAqIGBgYHRzXG4gKiBpbXBvcnQgeyBXb3JrZmxvd1J1bk5vdEZvdW5kRXJyb3IgfSBmcm9tIFwid29ya2Zsb3cvaW50ZXJuYWwvZXJyb3JzXCI7XG4gKlxuICogdHJ5IHtcbiAqICAgY29uc3Qgc3RhdHVzID0gYXdhaXQgcnVuLnN0YXR1cztcbiAqIH0gY2F0Y2ggKGVycm9yKSB7XG4gKiAgIGlmIChXb3JrZmxvd1J1bk5vdEZvdW5kRXJyb3IuaXMoZXJyb3IpKSB7XG4gKiAgICAgY29uc29sZS5lcnJvcihgUnVuICR7ZXJyb3IucnVuSWR9IGRvZXMgbm90IGV4aXN0YCk7XG4gKiAgIH1cbiAqIH1cbiAqIGBgYFxuICovXG5leHBvcnQgY2xhc3MgV29ya2Zsb3dSdW5Ob3RGb3VuZEVycm9yIGV4dGVuZHMgV29ya2Zsb3dFcnJvciB7XG4gIHJ1bklkOiBzdHJpbmc7XG5cbiAgY29uc3RydWN0b3IocnVuSWQ6IHN0cmluZykge1xuICAgIHN1cGVyKGBXb3JrZmxvdyBydW4gXCIke3J1bklkfVwiIG5vdCBmb3VuZGAsIHt9KTtcbiAgICB0aGlzLm5hbWUgPSAnV29ya2Zsb3dSdW5Ob3RGb3VuZEVycm9yJztcbiAgICB0aGlzLnJ1bklkID0gcnVuSWQ7XG4gIH1cblxuICBzdGF0aWMgaXModmFsdWU6IHVua25vd24pOiB2YWx1ZSBpcyBXb3JrZmxvd1J1bk5vdEZvdW5kRXJyb3Ige1xuICAgIHJldHVybiBpc0Vycm9yKHZhbHVlKSAmJiB2YWx1ZS5uYW1lID09PSAnV29ya2Zsb3dSdW5Ob3RGb3VuZEVycm9yJztcbiAgfVxufVxuXG4vKipcbiAqIFRocm93biB3aGVuIGEgaG9vayB0b2tlbiBpcyBhbHJlYWR5IGluIHVzZSBieSBhbm90aGVyIGFjdGl2ZSB3b3JrZmxvdyBydW4uXG4gKlxuICogVGhpcyBpcyBhIHVzZXIgZXJyb3Ig4oCUIGl0IG1lYW5zIHRoZSBzYW1lIGN1c3RvbSB0b2tlbiB3YXMgcGFzc2VkIHRvXG4gKiBgY3JlYXRlSG9va2AgaW4gdHdvIG9yIG1vcmUgY29uY3VycmVudCBydW5zLiBVc2UgYSB1bmlxdWUgdG9rZW4gcGVyIHJ1blxuICogKG9yIG9taXQgdGhlIHRva2VuIHRvIGxldCB0aGUgcnVudGltZSBnZW5lcmF0ZSBvbmUgYXV0b21hdGljYWxseSkuXG4gKi9cbmV4cG9ydCBjbGFzcyBIb29rQ29uZmxpY3RFcnJvciBleHRlbmRzIFdvcmtmbG93RXJyb3Ige1xuICB0b2tlbjogc3RyaW5nO1xuICAvLyBUT0RPOiBNYWtlIHRoaXMgcmVxdWlyZWQgb25jZSBhbGwgcGVyc2lzdGVkIGhvb2tfY29uZmxpY3QgZXZlbnRzIGFuZCBXb3JsZFxuICAvLyBpbXBsZW1lbnRhdGlvbnMgYWx3YXlzIGluY2x1ZGUgdGhlIGFjdGl2ZSBob29rIG93bmVyJ3MgcnVuIElELlxuICBjb25mbGljdGluZ1J1bklkPzogc3RyaW5nO1xuXG4gIGNvbnN0cnVjdG9yKHRva2VuOiBzdHJpbmcsIGNvbmZsaWN0aW5nUnVuSWQ/OiBzdHJpbmcpIHtcbiAgICBzdXBlcihcbiAgICAgIGBIb29rIHRva2VuIFwiJHt0b2tlbn1cIiBpcyBhbHJlYWR5IGluIHVzZSBieSBhbm90aGVyIHdvcmtmbG93JHtjb25mbGljdGluZ1J1bklkID8gYCAocnVuIFwiJHtjb25mbGljdGluZ1J1bklkfVwiKWAgOiAnJ31gLFxuICAgICAge1xuICAgICAgICBzbHVnOiBFUlJPUl9TTFVHUy5IT09LX0NPTkZMSUNULFxuICAgICAgfVxuICAgICk7XG4gICAgdGhpcy5uYW1lID0gJ0hvb2tDb25mbGljdEVycm9yJztcbiAgICB0aGlzLnRva2VuID0gdG9rZW47XG4gICAgaWYgKGNvbmZsaWN0aW5nUnVuSWQgIT09IHVuZGVmaW5lZCkge1xuICAgICAgdGhpcy5jb25mbGljdGluZ1J1bklkID0gY29uZmxpY3RpbmdSdW5JZDtcbiAgICB9XG4gIH1cblxuICBzdGF0aWMgaXModmFsdWU6IHVua25vd24pOiB2YWx1ZSBpcyBIb29rQ29uZmxpY3RFcnJvciB7XG4gICAgcmV0dXJuIGlzRXJyb3IodmFsdWUpICYmIHZhbHVlLm5hbWUgPT09ICdIb29rQ29uZmxpY3RFcnJvcic7XG4gIH1cbn1cblxuLyoqXG4gKiBUaHJvd24gd2hlbiBjYWxsaW5nIGByZXN1bWVIb29rKClgIG9yIGByZXN1bWVXZWJob29rKClgIHdpdGggYSB0b2tlbiB0aGF0XG4gKiBkb2VzIG5vdCBtYXRjaCBhbnkgYWN0aXZlIGhvb2suXG4gKlxuICogQ29tbW9uIGNhdXNlczpcbiAqIC0gVGhlIGhvb2sgaGFzIGV4cGlyZWQgKHBhc3QgaXRzIFRUTClcbiAqIC0gVGhlIGhvb2sgd2FzIGFscmVhZHkgZGlzcG9zZWQgYWZ0ZXIgYmVpbmcgY29uc3VtZWRcbiAqIC0gVGhlIHdvcmtmbG93IGhhcyBub3Qgc3RhcnRlZCB5ZXQsIHNvIHRoZSBob29rIGRvZXMgbm90IGV4aXN0XG4gKlxuICogQSBjb21tb24gcGF0dGVybiBpcyB0byBjYXRjaCB0aGlzIGVycm9yIGFuZCBzdGFydCBhIG5ldyB3b3JrZmxvdyBydW4gd2hlblxuICogdGhlIGhvb2sgZG9lcyBub3QgZXhpc3QgeWV0ICh0aGUgXCJyZXN1bWUgb3Igc3RhcnRcIiBwYXR0ZXJuKS5cbiAqXG4gKiBVc2UgdGhlIHN0YXRpYyBgSG9va05vdEZvdW5kRXJyb3IuaXMoKWAgbWV0aG9kIGZvciB0eXBlLXNhZmUgY2hlY2tpbmcgaW5cbiAqIGNhdGNoIGJsb2Nrcy5cbiAqXG4gKiBAZXhhbXBsZVxuICogYGBgdHNcbiAqIGltcG9ydCB7IEhvb2tOb3RGb3VuZEVycm9yIH0gZnJvbSBcIndvcmtmbG93L2ludGVybmFsL2Vycm9yc1wiO1xuICpcbiAqIHRyeSB7XG4gKiAgIGF3YWl0IHJlc3VtZUhvb2sodG9rZW4sIHBheWxvYWQpO1xuICogfSBjYXRjaCAoZXJyb3IpIHtcbiAqICAgaWYgKEhvb2tOb3RGb3VuZEVycm9yLmlzKGVycm9yKSkge1xuICogICAgIC8vIEhvb2sgZG9lc24ndCBleGlzdCDigJQgc3RhcnQgYSBuZXcgd29ya2Zsb3cgcnVuIGluc3RlYWRcbiAqICAgICBhd2FpdCBzdGFydFdvcmtmbG93KFwibXlXb3JrZmxvd1wiLCBwYXlsb2FkKTtcbiAqICAgfVxuICogfVxuICogYGBgXG4gKi9cbmV4cG9ydCBjbGFzcyBIb29rTm90Rm91bmRFcnJvciBleHRlbmRzIFdvcmtmbG93RXJyb3Ige1xuICB0b2tlbjogc3RyaW5nO1xuXG4gIGNvbnN0cnVjdG9yKHRva2VuOiBzdHJpbmcpIHtcbiAgICBzdXBlcignSG9vayBub3QgZm91bmQnLCB7fSk7XG4gICAgdGhpcy5uYW1lID0gJ0hvb2tOb3RGb3VuZEVycm9yJztcbiAgICB0aGlzLnRva2VuID0gdG9rZW47XG4gIH1cblxuICBzdGF0aWMgaXModmFsdWU6IHVua25vd24pOiB2YWx1ZSBpcyBIb29rTm90Rm91bmRFcnJvciB7XG4gICAgcmV0dXJuIGlzRXJyb3IodmFsdWUpICYmIHZhbHVlLm5hbWUgPT09ICdIb29rTm90Rm91bmRFcnJvcic7XG4gIH1cbn1cblxuLyoqXG4gKiBUaHJvd24gd2hlbiBhbiBvcGVyYXRpb24gY29uZmxpY3RzIHdpdGggdGhlIGN1cnJlbnQgc3RhdGUgb2YgYW4gZW50aXR5LlxuICogVGhpcyBpbmNsdWRlcyBhdHRlbXB0cyB0byBtb2RpZnkgYW4gZW50aXR5IGFscmVhZHkgaW4gYSB0ZXJtaW5hbCBzdGF0ZSxcbiAqIGNyZWF0ZSBhbiBlbnRpdHkgdGhhdCBhbHJlYWR5IGV4aXN0cywgb3IgYW55IG90aGVyIDQwOS1zdHlsZSBjb25mbGljdC5cbiAqXG4gKiBUaGUgd29ya2Zsb3cgcnVudGltZSBoYW5kbGVzIHRoaXMgZXJyb3IgYXV0b21hdGljYWxseS4gVXNlcnMgaW50ZXJhY3RpbmdcbiAqIHdpdGggd29ybGQgc3RvcmFnZSBiYWNrZW5kcyBkaXJlY3RseSBtYXkgZW5jb3VudGVyIGl0LlxuICovXG5leHBvcnQgY2xhc3MgRW50aXR5Q29uZmxpY3RFcnJvciBleHRlbmRzIFdvcmtmbG93V29ybGRFcnJvciB7XG4gIGNvbnN0cnVjdG9yKG1lc3NhZ2U6IHN0cmluZykge1xuICAgIHN1cGVyKG1lc3NhZ2UpO1xuICAgIHRoaXMubmFtZSA9ICdFbnRpdHlDb25mbGljdEVycm9yJztcbiAgfVxuXG4gIHN0YXRpYyBpcyh2YWx1ZTogdW5rbm93bik6IHZhbHVlIGlzIEVudGl0eUNvbmZsaWN0RXJyb3Ige1xuICAgIHJldHVybiBpc0Vycm9yKHZhbHVlKSAmJiB2YWx1ZS5uYW1lID09PSAnRW50aXR5Q29uZmxpY3RFcnJvcic7XG4gIH1cbn1cblxuLyoqXG4gKiBUaHJvd24gd2hlbiBhIHJ1biBpcyBubyBsb25nZXIgYXZhaWxhYmxlIOKAlCBlaXRoZXIgYmVjYXVzZSBpdCBoYXMgYmVlblxuICogY2xlYW5lZCB1cCwgZXhwaXJlZCwgb3IgYWxyZWFkeSByZWFjaGVkIGEgdGVybWluYWwgc3RhdGUgKGNvbXBsZXRlZC9mYWlsZWQpLlxuICpcbiAqIFRoZSB3b3JrZmxvdyBydW50aW1lIGhhbmRsZXMgdGhpcyBlcnJvciBhdXRvbWF0aWNhbGx5LiBVc2VycyBpbnRlcmFjdGluZ1xuICogd2l0aCB3b3JsZCBzdG9yYWdlIGJhY2tlbmRzIGRpcmVjdGx5IG1heSBlbmNvdW50ZXIgaXQuXG4gKi9cbmV4cG9ydCBjbGFzcyBSdW5FeHBpcmVkRXJyb3IgZXh0ZW5kcyBXb3JrZmxvd1dvcmxkRXJyb3Ige1xuICBjb25zdHJ1Y3RvcihtZXNzYWdlOiBzdHJpbmcpIHtcbiAgICBzdXBlcihtZXNzYWdlKTtcbiAgICB0aGlzLm5hbWUgPSAnUnVuRXhwaXJlZEVycm9yJztcbiAgfVxuXG4gIHN0YXRpYyBpcyh2YWx1ZTogdW5rbm93bik6IHZhbHVlIGlzIFJ1bkV4cGlyZWRFcnJvciB7XG4gICAgcmV0dXJuIGlzRXJyb3IodmFsdWUpICYmIHZhbHVlLm5hbWUgPT09ICdSdW5FeHBpcmVkRXJyb3InO1xuICB9XG59XG5cbi8qKlxuICogVGhyb3duIHdoZW4gYW4gb3BlcmF0aW9uIGNhbm5vdCBwcm9jZWVkIGJlY2F1c2UgYSByZXF1aXJlZCB0aW1lc3RhbXBcbiAqIChlLmcuIHJldHJ5QWZ0ZXIpIGhhcyBub3QgYmVlbiByZWFjaGVkIHlldC5cbiAqXG4gKiBUaGUgd29ya2Zsb3cgcnVudGltZSBoYW5kbGVzIHRoaXMgZXJyb3IgYXV0b21hdGljYWxseS4gVXNlcnMgaW50ZXJhY3RpbmdcbiAqIHdpdGggd29ybGQgc3RvcmFnZSBiYWNrZW5kcyBkaXJlY3RseSBtYXkgZW5jb3VudGVyIGl0LlxuICpcbiAqIEBwcm9wZXJ0eSByZXRyeUFmdGVyIC0gRGVsYXkgaW4gc2Vjb25kcyBiZWZvcmUgdGhlIG9wZXJhdGlvbiBjYW4gYmUgcmV0cmllZC5cbiAqL1xuZXhwb3J0IGNsYXNzIFRvb0Vhcmx5RXJyb3IgZXh0ZW5kcyBXb3JrZmxvd1dvcmxkRXJyb3Ige1xuICBjb25zdHJ1Y3RvcihtZXNzYWdlOiBzdHJpbmcsIG9wdGlvbnM/OiB7IHJldHJ5QWZ0ZXI/OiBudW1iZXIgfSkge1xuICAgIHN1cGVyKG1lc3NhZ2UsIHsgcmV0cnlBZnRlcjogb3B0aW9ucz8ucmV0cnlBZnRlciB9KTtcbiAgICB0aGlzLm5hbWUgPSAnVG9vRWFybHlFcnJvcic7XG4gIH1cblxuICBzdGF0aWMgaXModmFsdWU6IHVua25vd24pOiB2YWx1ZSBpcyBUb29FYXJseUVycm9yIHtcbiAgICByZXR1cm4gaXNFcnJvcih2YWx1ZSkgJiYgdmFsdWUubmFtZSA9PT0gJ1Rvb0Vhcmx5RXJyb3InO1xuICB9XG59XG5cbi8qKlxuICogVGhyb3duIHdoZW4gYSByZXF1ZXN0IGlzIHJhdGUgbGltaXRlZCBieSB0aGUgd29ya2Zsb3cgYmFja2VuZC5cbiAqXG4gKiBUaGUgd29ya2Zsb3cgcnVudGltZSBoYW5kbGVzIHRoaXMgZXJyb3IgYXV0b21hdGljYWxseSB3aXRoIHJldHJ5IGxvZ2ljLlxuICogVXNlcnMgaW50ZXJhY3Rpbmcgd2l0aCB3b3JsZCBzdG9yYWdlIGJhY2tlbmRzIGRpcmVjdGx5IG1heSBlbmNvdW50ZXIgaXRcbiAqIGlmIHJldHJpZXMgYXJlIGV4aGF1c3RlZC5cbiAqXG4gKiBAcHJvcGVydHkgcmV0cnlBZnRlciAtIERlbGF5IGluIHNlY29uZHMgYmVmb3JlIHRoZSByZXF1ZXN0IGNhbiBiZSByZXRyaWVkLlxuICovXG5leHBvcnQgY2xhc3MgVGhyb3R0bGVFcnJvciBleHRlbmRzIFdvcmtmbG93V29ybGRFcnJvciB7XG4gIHJldHJ5QWZ0ZXI/OiBudW1iZXI7XG5cbiAgY29uc3RydWN0b3IobWVzc2FnZTogc3RyaW5nLCBvcHRpb25zPzogeyByZXRyeUFmdGVyPzogbnVtYmVyIH0pIHtcbiAgICBzdXBlcihtZXNzYWdlKTtcbiAgICB0aGlzLm5hbWUgPSAnVGhyb3R0bGVFcnJvcic7XG4gICAgdGhpcy5yZXRyeUFmdGVyID0gb3B0aW9ucz8ucmV0cnlBZnRlcjtcbiAgfVxuXG4gIHN0YXRpYyBpcyh2YWx1ZTogdW5rbm93bik6IHZhbHVlIGlzIFRocm90dGxlRXJyb3Ige1xuICAgIHJldHVybiBpc0Vycm9yKHZhbHVlKSAmJiB2YWx1ZS5uYW1lID09PSAnVGhyb3R0bGVFcnJvcic7XG4gIH1cbn1cblxuLyoqXG4gKiBUaHJvd24gd2hlbiB0aGUgYmFja2VuZCByZWplY3RzIGFuIGV2ZW50IGNyZWF0aW9uIGJlY2F1c2UgdGhlIGNsaWVudCdzXG4gKiBldmVudC1sb2cgc25hcHNob3QgaXMgc3RhbGUg4oCUIGEgbmV3ZXIgb3V0LW9mLWJhbmQgZXZlbnQgKGUuZy4gYSByZWNlaXZlZFxuICogaG9vayBvciBhIGNvbXBsZXRlZCBzdGVwKSB3YXMgcmVjb3JkZWQgYWZ0ZXIgdGhlIHNuYXBzaG90IHRoZSBjbGllbnRcbiAqIHJlcGxheWVkIGZyb20gKEhUVFAgNDEyKS5cbiAqXG4gKiBUaGUgd29ya2Zsb3cgcnVudGltZSBoYW5kbGVzIHRoaXMgYXV0b21hdGljYWxseTogaXQgcmVsb2FkcyB0aGUgZXZlbnQgbG9nXG4gKiBhbmQgcmV0cmllcywgdWx0aW1hdGVseSByZS1lbnF1ZXVlaW5nIHRoZSBydW4gaWYgaXQgY2Fubm90IGNhdGNoIHVwLiBVc2Vyc1xuICogaW50ZXJhY3Rpbmcgd2l0aCB3b3JsZCBzdG9yYWdlIGJhY2tlbmRzIGRpcmVjdGx5IG1heSBlbmNvdW50ZXIgaXQuXG4gKi9cbmV4cG9ydCBjbGFzcyBQcmVjb25kaXRpb25GYWlsZWRFcnJvciBleHRlbmRzIFdvcmtmbG93V29ybGRFcnJvciB7XG4gIGNvbnN0cnVjdG9yKG1lc3NhZ2U6IHN0cmluZywgb3B0aW9ucz86IHsgcmV0cnlBZnRlcj86IG51bWJlciB9KSB7XG4gICAgc3VwZXIobWVzc2FnZSwgeyBzdGF0dXM6IDQxMiwgcmV0cnlBZnRlcjogb3B0aW9ucz8ucmV0cnlBZnRlciB9KTtcbiAgICB0aGlzLm5hbWUgPSAnUHJlY29uZGl0aW9uRmFpbGVkRXJyb3InO1xuICB9XG5cbiAgc3RhdGljIGlzKHZhbHVlOiB1bmtub3duKTogdmFsdWUgaXMgUHJlY29uZGl0aW9uRmFpbGVkRXJyb3Ige1xuICAgIHJldHVybiBpc0Vycm9yKHZhbHVlKSAmJiB2YWx1ZS5uYW1lID09PSAnUHJlY29uZGl0aW9uRmFpbGVkRXJyb3InO1xuICB9XG59XG5cbi8qKlxuICogVGhyb3duIHdoZW4gYXdhaXRpbmcgYHJ1bi5yZXR1cm5WYWx1ZWAgb24gYSB3b3JrZmxvdyBydW4gdGhhdCB3YXMgY2FuY2VsbGVkLlxuICpcbiAqIFRoaXMgZXJyb3IgaW5kaWNhdGVzIHRoYXQgdGhlIHdvcmtmbG93IHdhcyBleHBsaWNpdGx5IGNhbmNlbGxlZCAodmlhXG4gKiBgcnVuLmNhbmNlbCgpYCkgYW5kIHdpbGwgbm90IHByb2R1Y2UgYSByZXR1cm4gdmFsdWUuIFlvdSBjYW4gY2hlY2sgZm9yXG4gKiBjYW5jZWxsYXRpb24gYmVmb3JlIGF3YWl0aW5nIHRoZSByZXR1cm4gdmFsdWUgYnkgaW5zcGVjdGluZyBgcnVuLnN0YXR1c2AuXG4gKlxuICogVXNlIHRoZSBzdGF0aWMgYFdvcmtmbG93UnVuQ2FuY2VsbGVkRXJyb3IuaXMoKWAgbWV0aG9kIGZvciB0eXBlLXNhZmVcbiAqIGNoZWNraW5nIGluIGNhdGNoIGJsb2Nrcy5cbiAqXG4gKiBAZXhhbXBsZVxuICogYGBgdHNcbiAqIGltcG9ydCB7IFdvcmtmbG93UnVuQ2FuY2VsbGVkRXJyb3IgfSBmcm9tIFwid29ya2Zsb3cvaW50ZXJuYWwvZXJyb3JzXCI7XG4gKlxuICogdHJ5IHtcbiAqICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgcnVuLnJldHVyblZhbHVlO1xuICogfSBjYXRjaCAoZXJyb3IpIHtcbiAqICAgaWYgKFdvcmtmbG93UnVuQ2FuY2VsbGVkRXJyb3IuaXMoZXJyb3IpKSB7XG4gKiAgICAgY29uc29sZS5sb2coYFJ1biAke2Vycm9yLnJ1bklkfSB3YXMgY2FuY2VsbGVkYCk7XG4gKiAgIH1cbiAqIH1cbiAqIGBgYFxuICovXG5leHBvcnQgY2xhc3MgV29ya2Zsb3dSdW5DYW5jZWxsZWRFcnJvciBleHRlbmRzIFdvcmtmbG93RXJyb3Ige1xuICBydW5JZDogc3RyaW5nO1xuXG4gIGNvbnN0cnVjdG9yKHJ1bklkOiBzdHJpbmcpIHtcbiAgICBzdXBlcihgV29ya2Zsb3cgcnVuIFwiJHtydW5JZH1cIiBjYW5jZWxsZWRgLCB7fSk7XG4gICAgdGhpcy5uYW1lID0gJ1dvcmtmbG93UnVuQ2FuY2VsbGVkRXJyb3InO1xuICAgIHRoaXMucnVuSWQgPSBydW5JZDtcbiAgfVxuXG4gIHN0YXRpYyBpcyh2YWx1ZTogdW5rbm93bik6IHZhbHVlIGlzIFdvcmtmbG93UnVuQ2FuY2VsbGVkRXJyb3Ige1xuICAgIHJldHVybiBpc0Vycm9yKHZhbHVlKSAmJiB2YWx1ZS5uYW1lID09PSAnV29ya2Zsb3dSdW5DYW5jZWxsZWRFcnJvcic7XG4gIH1cbn1cblxuLyoqXG4gKiBUaHJvd24gd2hlbiBhdHRlbXB0aW5nIHRvIG9wZXJhdGUgb24gYSB3b3JrZmxvdyBydW4gdGhhdCByZXF1aXJlcyBhIG5ld2VyIFdvcmxkIHZlcnNpb24uXG4gKlxuICogVGhpcyBlcnJvciBvY2N1cnMgd2hlbiBhIHJ1biB3YXMgY3JlYXRlZCB3aXRoIGEgbmV3ZXIgc3BlYyB2ZXJzaW9uIHRoYW4gdGhlXG4gKiBjdXJyZW50IFdvcmxkIGltcGxlbWVudGF0aW9uIHN1cHBvcnRzLiBUbyByZXNvbHZlIHRoaXMsIHVwZ3JhZGUgeW91clxuICogYHdvcmtmbG93YCBwYWNrYWdlcyB0byBhIHZlcnNpb24gdGhhdCBzdXBwb3J0cyB0aGUgcmVxdWlyZWQgc3BlYyB2ZXJzaW9uLlxuICpcbiAqIFVzZSB0aGUgc3RhdGljIGBSdW5Ob3RTdXBwb3J0ZWRFcnJvci5pcygpYCBtZXRob2QgZm9yIHR5cGUtc2FmZSBjaGVja2luZyBpblxuICogY2F0Y2ggYmxvY2tzLlxuICpcbiAqIEBleGFtcGxlXG4gKiBgYGB0c1xuICogaW1wb3J0IHsgUnVuTm90U3VwcG9ydGVkRXJyb3IgfSBmcm9tIFwid29ya2Zsb3cvaW50ZXJuYWwvZXJyb3JzXCI7XG4gKlxuICogdHJ5IHtcbiAqICAgY29uc3Qgc3RhdHVzID0gYXdhaXQgcnVuLnN0YXR1cztcbiAqIH0gY2F0Y2ggKGVycm9yKSB7XG4gKiAgIGlmIChSdW5Ob3RTdXBwb3J0ZWRFcnJvci5pcyhlcnJvcikpIHtcbiAqICAgICBjb25zb2xlLmVycm9yKFxuICogICAgICAgYFJ1biByZXF1aXJlcyBzcGVjIHYke2Vycm9yLnJ1blNwZWNWZXJzaW9ufSwgYCArXG4gKiAgICAgICBgYnV0IHdvcmxkIHN1cHBvcnRzIHYke2Vycm9yLndvcmxkU3BlY1ZlcnNpb259YFxuICogICAgICk7XG4gKiAgIH1cbiAqIH1cbiAqIGBgYFxuICovXG5leHBvcnQgY2xhc3MgUnVuTm90U3VwcG9ydGVkRXJyb3IgZXh0ZW5kcyBXb3JrZmxvd0Vycm9yIHtcbiAgcmVhZG9ubHkgcnVuU3BlY1ZlcnNpb246IG51bWJlcjtcbiAgcmVhZG9ubHkgd29ybGRTcGVjVmVyc2lvbjogbnVtYmVyO1xuXG4gIGNvbnN0cnVjdG9yKHJ1blNwZWNWZXJzaW9uOiBudW1iZXIsIHdvcmxkU3BlY1ZlcnNpb246IG51bWJlcikge1xuICAgIHN1cGVyKFxuICAgICAgYFJ1biByZXF1aXJlcyBzcGVjIHZlcnNpb24gJHtydW5TcGVjVmVyc2lvbn0sIGJ1dCB3b3JsZCBzdXBwb3J0cyB2ZXJzaW9uICR7d29ybGRTcGVjVmVyc2lvbn0uIGAgK1xuICAgICAgICBgUGxlYXNlIHVwZ3JhZGUgJ3dvcmtmbG93JyBwYWNrYWdlLmBcbiAgICApO1xuICAgIHRoaXMubmFtZSA9ICdSdW5Ob3RTdXBwb3J0ZWRFcnJvcic7XG4gICAgdGhpcy5ydW5TcGVjVmVyc2lvbiA9IHJ1blNwZWNWZXJzaW9uO1xuICAgIHRoaXMud29ybGRTcGVjVmVyc2lvbiA9IHdvcmxkU3BlY1ZlcnNpb247XG4gIH1cblxuICBzdGF0aWMgaXModmFsdWU6IHVua25vd24pOiB2YWx1ZSBpcyBSdW5Ob3RTdXBwb3J0ZWRFcnJvciB7XG4gICAgcmV0dXJuIGlzRXJyb3IodmFsdWUpICYmIHZhbHVlLm5hbWUgPT09ICdSdW5Ob3RTdXBwb3J0ZWRFcnJvcic7XG4gIH1cbn1cblxuLyoqXG4gKiBBIGZhdGFsIGVycm9yIGlzIGFuIGVycm9yIHRoYXQgY2Fubm90IGJlIHJldHJpZWQuXG4gKiBJdCB3aWxsIGNhdXNlIHRoZSBzdGVwIHRvIGZhaWwgYW5kIHRoZSBlcnJvciB3aWxsXG4gKiBiZSBidWJibGVkIHVwIHRvIHRoZSB3b3JrZmxvdyBsb2dpYy5cbiAqL1xuZXhwb3J0IGNsYXNzIEZhdGFsRXJyb3IgZXh0ZW5kcyBFcnJvciB7XG4gIGZhdGFsID0gdHJ1ZTtcblxuICBjb25zdHJ1Y3RvcihtZXNzYWdlOiBzdHJpbmcpIHtcbiAgICBzdXBlcihtZXNzYWdlKTtcbiAgICB0aGlzLm5hbWUgPSAnRmF0YWxFcnJvcic7XG4gIH1cblxuICBzdGF0aWMgaXModmFsdWU6IHVua25vd24pOiB2YWx1ZSBpcyBGYXRhbEVycm9yIHtcbiAgICByZXR1cm4gaXNFcnJvcih2YWx1ZSkgJiYgdmFsdWUubmFtZSA9PT0gJ0ZhdGFsRXJyb3InO1xuICB9XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgUmV0cnlhYmxlRXJyb3JPcHRpb25zIHtcbiAgLyoqXG4gICAqIFRoZSBudW1iZXIgb2YgbWlsbGlzZWNvbmRzIHRvIHdhaXQgYmVmb3JlIHJldHJ5aW5nIHRoZSBzdGVwLlxuICAgKiBDYW4gYWxzbyBiZSBhIGR1cmF0aW9uIHN0cmluZyAoZS5nLiwgXCI1c1wiLCBcIjJtXCIpIG9yIGEgRGF0ZSBvYmplY3QuXG4gICAqIElmIG5vdCBwcm92aWRlZCwgdGhlIHN0ZXAgd2lsbCBiZSByZXRyaWVkIGFmdGVyIDEgc2Vjb25kICgxMDAwIG1pbGxpc2Vjb25kcykuXG4gICAqL1xuICByZXRyeUFmdGVyPzogbnVtYmVyIHwgU3RyaW5nVmFsdWUgfCBEYXRlO1xufVxuXG4vKipcbiAqIEFuIGVycm9yIHRoYXQgY2FuIGhhcHBlbiBkdXJpbmcgYSBzdGVwIGV4ZWN1dGlvbiwgYWxsb3dpbmdcbiAqIGZvciBjb25maWd1cmF0aW9uIG9mIHRoZSByZXRyeSBiZWhhdmlvci5cbiAqL1xuZXhwb3J0IGNsYXNzIFJldHJ5YWJsZUVycm9yIGV4dGVuZHMgRXJyb3Ige1xuICAvKipcbiAgICogVGhlIERhdGUgd2hlbiB0aGUgc3RlcCBzaG91bGQgYmUgcmV0cmllZC5cbiAgICovXG4gIHJldHJ5QWZ0ZXI6IERhdGU7XG5cbiAgY29uc3RydWN0b3IobWVzc2FnZTogc3RyaW5nLCBvcHRpb25zOiBSZXRyeWFibGVFcnJvck9wdGlvbnMgPSB7fSkge1xuICAgIHN1cGVyKG1lc3NhZ2UpO1xuICAgIHRoaXMubmFtZSA9ICdSZXRyeWFibGVFcnJvcic7XG5cbiAgICBpZiAob3B0aW9ucy5yZXRyeUFmdGVyICE9PSB1bmRlZmluZWQpIHtcbiAgICAgIHRoaXMucmV0cnlBZnRlciA9IHBhcnNlRHVyYXRpb25Ub0RhdGUob3B0aW9ucy5yZXRyeUFmdGVyKTtcbiAgICB9IGVsc2Uge1xuICAgICAgLy8gRGVmYXVsdCB0byAxIHNlY29uZCAoMTAwMCBtaWxsaXNlY29uZHMpXG4gICAgICB0aGlzLnJldHJ5QWZ0ZXIgPSBuZXcgRGF0ZShEYXRlLm5vdygpICsgMTAwMCk7XG4gICAgfVxuICB9XG5cbiAgc3RhdGljIGlzKHZhbHVlOiB1bmtub3duKTogdmFsdWUgaXMgUmV0cnlhYmxlRXJyb3Ige1xuICAgIHJldHVybiBpc0Vycm9yKHZhbHVlKSAmJiB2YWx1ZS5uYW1lID09PSAnUmV0cnlhYmxlRXJyb3InO1xuICB9XG59XG5cbmV4cG9ydCBjb25zdCBWRVJDRUxfNDAzX0VSUk9SX01FU1NBR0UgPVxuICAnWW91ciBjdXJyZW50IHZlcmNlbCBhY2NvdW50IGRvZXMgbm90IGhhdmUgYWNjZXNzIHRvIHRoaXMgcmVzb3VyY2UuIFVzZSBgdmVyY2VsIGxvZ2luYCBvciBgdmVyY2VsIHN3aXRjaGAgdG8gZW5zdXJlIHlvdSBhcmUgbGlua2VkIHRvIHRoZSByaWdodCBhY2NvdW50Lic7XG5cbmV4cG9ydCB7IFJVTl9FUlJPUl9DT0RFUywgdHlwZSBSdW5FcnJvckNvZGUgfSBmcm9tICcuL2Vycm9yLWNvZGVzLmpzJztcblxuLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4vLyBDcm9zcy1yZWFsbSBjbGFzcyByZWdpc3RyYXRpb25cbi8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuLy9cbi8vIGBGYXRhbEVycm9yYCwgYFJldHJ5YWJsZUVycm9yYCwgYW5kIGBIb29rQ29uZmxpY3RFcnJvcmAgYXJlIG5vdCBidWlsdC1pbnMsIHNvIGRpZmZlcmVudCByZWFsbXNcbi8vIChlLmcuIHRoZSB3b3JrZmxvdyBWTSBjb250ZXh0IHZzLiB0aGUgaG9zdCBjb250ZXh0IHRoYXQgcnVucyB0aGUgcXVldWVcbi8vIGhhbmRsZXIpIGJ1bmRsZSBhbmQgbG9hZCB0aGVpciBvd24gY29waWVzIG9mIHRoaXMgbW9kdWxlIOKAlCBtZWFuaW5nIGVhY2hcbi8vIHJlYWxtIGhhcyBpdHMgb3duIGRpc3RpbmN0IGNsYXNzIGlkZW50aXR5LiBDcm9zcy1yZWFsbSBgaW5zdGFuY2VvZmAgZmFpbHNcbi8vIGJlY2F1c2UgdGhlIHByb3RvdHlwZSBjaGFpbnMgbmV2ZXIgbWVldC5cbi8vXG4vLyBUbyBsZXQgc2VyaWFsaXphdGlvbiByZXZpdmVycyByZWNvbnN0cnVjdCBhIHZhbHVlIGFzIHRoZSAqY29uc3VtZXIncypcbi8vIEZhdGFsRXJyb3IgKHNvIHVzZXItY29kZSBgZXJyIGluc3RhbmNlb2YgRmF0YWxFcnJvcmAgcGFzc2VzKSwgZWFjaCBidW5kbGVkXG4vLyBjb3B5IG9mIHRoaXMgbW9kdWxlIHNlbGYtcmVnaXN0ZXJzIGl0cyBjbGFzcyBvbiBgZ2xvYmFsVGhpc2AgdmlhIGEga25vd25cbi8vIFN5bWJvbC5mb3Iga2V5LiBSZXZpdmVycyBpbiBgQHdvcmtmbG93L2NvcmVgIGxvb2sgdXAgdGhlIGNsYXNzIHZpYSB0aGVcbi8vIGNvbnN1bWVyJ3MgZ2xvYmFsVGhpcyBhdCBoeWRyYXRpb24gdGltZS5cbi8vXG4vLyBGaXJzdCByZWdpc3RyYXRpb24gaW4gYSBnaXZlbiByZWFsbSB3aW5zLiBUaGUgZGVzY3JpcHRvciBpcyBub24td3JpdGFibGVcbi8vIGFuZCBub24tY29uZmlndXJhYmxlIHRvIG1ha2UgYWNjaWRlbnRhbCBjbG9iYmVyaW5nIGxvdWQuXG5jb25zdCBGQVRBTF9FUlJPUl9LRVkgPSBTeW1ib2wuZm9yKCdAd29ya2Zsb3cvZXJyb3JzLy9GYXRhbEVycm9yJyk7XG5jb25zdCBSRVRSWUFCTEVfRVJST1JfS0VZID0gU3ltYm9sLmZvcignQHdvcmtmbG93L2Vycm9ycy8vUmV0cnlhYmxlRXJyb3InKTtcbmNvbnN0IEhPT0tfQ09ORkxJQ1RfRVJST1JfS0VZID0gU3ltYm9sLmZvcihcbiAgJ0B3b3JrZmxvdy9lcnJvcnMvL0hvb2tDb25mbGljdEVycm9yJ1xuKTtcblxuaWYgKHR5cGVvZiBnbG9iYWxUaGlzICE9PSAndW5kZWZpbmVkJykge1xuICBpZiAoIU9iamVjdC5oYXNPd24oZ2xvYmFsVGhpcywgRkFUQUxfRVJST1JfS0VZKSkge1xuICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShnbG9iYWxUaGlzLCBGQVRBTF9FUlJPUl9LRVksIHtcbiAgICAgIHZhbHVlOiBGYXRhbEVycm9yLFxuICAgICAgd3JpdGFibGU6IGZhbHNlLFxuICAgICAgZW51bWVyYWJsZTogZmFsc2UsXG4gICAgICBjb25maWd1cmFibGU6IGZhbHNlLFxuICAgIH0pO1xuICB9XG4gIGlmICghT2JqZWN0Lmhhc093bihnbG9iYWxUaGlzLCBSRVRSWUFCTEVfRVJST1JfS0VZKSkge1xuICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShnbG9iYWxUaGlzLCBSRVRSWUFCTEVfRVJST1JfS0VZLCB7XG4gICAgICB2YWx1ZTogUmV0cnlhYmxlRXJyb3IsXG4gICAgICB3cml0YWJsZTogZmFsc2UsXG4gICAgICBlbnVtZXJhYmxlOiBmYWxzZSxcbiAgICAgIGNvbmZpZ3VyYWJsZTogZmFsc2UsXG4gICAgfSk7XG4gIH1cbiAgaWYgKCFPYmplY3QuaGFzT3duKGdsb2JhbFRoaXMsIEhPT0tfQ09ORkxJQ1RfRVJST1JfS0VZKSkge1xuICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShnbG9iYWxUaGlzLCBIT09LX0NPTkZMSUNUX0VSUk9SX0tFWSwge1xuICAgICAgdmFsdWU6IEhvb2tDb25mbGljdEVycm9yLFxuICAgICAgd3JpdGFibGU6IGZhbHNlLFxuICAgICAgZW51bWVyYWJsZTogZmFsc2UsXG4gICAgICBjb25maWd1cmFibGU6IGZhbHNlLFxuICAgIH0pO1xuICB9XG59XG4iLCAiLyoqXG4gKiBUaGlzIGlzIHRoZSBcInN0YW5kYXJkIGxpYnJhcnlcIiBvZiBzdGVwcyB0aGF0IHdlIG1ha2UgYXZhaWxhYmxlIHRvIGFsbCB3b3JrZmxvdyB1c2Vycy5cbiAqIFRoZSBjYW4gYmUgaW1wb3J0ZWQgbGlrZSBzbzogYGltcG9ydCB7IGZldGNoIH0gZnJvbSAnd29ya2Zsb3cnYC4gYW5kIHVzZWQgaW4gd29ya2Zsb3cuXG4gKiBUaGUgbmVlZCB0byBiZSBleHBvcnRlZCBkaXJlY3RseSBpbiB0aGlzIHBhY2thZ2UgYW5kIGNhbm5vdCBsaXZlIGluIGBjb3JlYCB0byBwcmV2ZW50XG4gKiBjaXJjdWxhciBkZXBlbmRlbmNpZXMgcG9zdC1jb21waWxhdGlvbi5cbiAqL1xuXG4vKipcbiAqIEEgaG9pc3RlZCBgZmV0Y2goKWAgZnVuY3Rpb24gdGhhdCBpcyBleGVjdXRlZCBhcyBhIFwic3RlcFwiIGZ1bmN0aW9uLFxuICogZm9yIHVzZSB3aXRoaW4gd29ya2Zsb3cgZnVuY3Rpb25zLlxuICpcbiAqIEBzZWUgaHR0cHM6Ly9kZXZlbG9wZXIubW96aWxsYS5vcmcvZW4tVVMvZG9jcy9XZWIvQVBJL0ZldGNoX0FQSVxuICovXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gZmV0Y2goLi4uYXJnczogUGFyYW1ldGVyczx0eXBlb2YgZ2xvYmFsVGhpcy5mZXRjaD4pIHtcbiAgJ3VzZSBzdGVwJztcbiAgcmV0dXJuIGdsb2JhbFRoaXMuZmV0Y2goLi4uYXJncyk7XG59XG4iLCAiaW1wb3J0IHsgRmF0YWxFcnJvciwgUmV0cnlhYmxlRXJyb3IgfSBmcm9tICd3b3JrZmxvdyc7XG4vKipfX2ludGVybmFsX3dvcmtmbG93c3tcIndvcmtmbG93c1wiOntcInNyYy93b3JrZmxvd3Mvd29ya2Zsb3dQcm9vZi50c1wiOntcIndvcmtmbG93UHJvb2ZcIjp7XCJ3b3JrZmxvd0lkXCI6XCJ3b3JrZmxvdy8vLi9zcmMvd29ya2Zsb3dzL3dvcmtmbG93UHJvb2YvL3dvcmtmbG93UHJvb2ZcIn19fSxcInN0ZXBzXCI6e1wic3JjL3dvcmtmbG93cy93b3JrZmxvd1Byb29mLnRzXCI6e1wiY2xhaW1Qcm9vZlwiOntcInN0ZXBJZFwiOlwic3RlcC8vLi9zcmMvd29ya2Zsb3dzL3dvcmtmbG93UHJvb2YvL2NsYWltUHJvb2ZcIn0sXCJjb21wbGV0ZVByb29mXCI6e1wic3RlcElkXCI6XCJzdGVwLy8uL3NyYy93b3JrZmxvd3Mvd29ya2Zsb3dQcm9vZi8vY29tcGxldGVQcm9vZlwifSxcImZhaWxQcm9vZlwiOntcInN0ZXBJZFwiOlwic3RlcC8vLi9zcmMvd29ya2Zsb3dzL3dvcmtmbG93UHJvb2YvL2ZhaWxQcm9vZlwifSxcInJlY29uY2lsZVByb29mXCI6e1wic3RlcElkXCI6XCJzdGVwLy8uL3NyYy93b3JrZmxvd3Mvd29ya2Zsb3dQcm9vZi8vcmVjb25jaWxlUHJvb2ZcIn0sXCJzeW50aGV0aWNXb3JrXCI6e1wic3RlcElkXCI6XCJzdGVwLy8uL3NyYy93b3JrZmxvd3Mvd29ya2Zsb3dQcm9vZi8vc3ludGhldGljV29ya1wifX19fSovO1xuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIHdvcmtmbG93UHJvb2YoYXBwbGljYXRpb25SdW5JZCkge1xuICAgIHRyeSB7XG4gICAgICAgIGF3YWl0IGNsYWltUHJvb2YoYXBwbGljYXRpb25SdW5JZCk7XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgaWYgKGVycm9yIGluc3RhbmNlb2YgRmF0YWxFcnJvcikgcmV0dXJuIGF3YWl0IGZhaWxQcm9vZihhcHBsaWNhdGlvblJ1bklkKTtcbiAgICAgICAgdGhyb3cgZXJyb3I7XG4gICAgfVxuICAgIGxldCByZWNvbmNpbGVkU3RhdHVzO1xuICAgIHRyeSB7XG4gICAgICAgIHJlY29uY2lsZWRTdGF0dXMgPSBhd2FpdCByZWNvbmNpbGVQcm9vZihhcHBsaWNhdGlvblJ1bklkKTtcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICBpZiAoZXJyb3IgaW5zdGFuY2VvZiBGYXRhbEVycm9yKSByZXR1cm4gYXdhaXQgZmFpbFByb29mKGFwcGxpY2F0aW9uUnVuSWQpO1xuICAgICAgICB0aHJvdyBlcnJvcjtcbiAgICB9XG4gICAgaWYgKHJlY29uY2lsZWRTdGF0dXMgPT09ICdjb21wbGV0ZWQnIHx8IHJlY29uY2lsZWRTdGF0dXMgPT09ICdmYWlsZWQnKSB7XG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICBhcHBsaWNhdGlvblJ1bklkLFxuICAgICAgICAgICAgdGVybWluYWxTdGF0dXM6IHJlY29uY2lsZWRTdGF0dXNcbiAgICAgICAgfTtcbiAgICB9XG4gICAgaWYgKHJlY29uY2lsZWRTdGF0dXMgIT09ICdydW5uaW5nJykge1xuICAgICAgICByZXR1cm4gYXdhaXQgZmFpbFByb29mKGFwcGxpY2F0aW9uUnVuSWQpO1xuICAgIH1cbiAgICB0cnkge1xuICAgICAgICBhd2FpdCBzeW50aGV0aWNXb3JrKGFwcGxpY2F0aW9uUnVuSWQpO1xuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgIGlmIChlcnJvciBpbnN0YW5jZW9mIFJldHJ5YWJsZUVycm9yKSB0aHJvdyBlcnJvcjtcbiAgICAgICAgcmV0dXJuIGF3YWl0IGZhaWxQcm9vZihhcHBsaWNhdGlvblJ1bklkKTtcbiAgICB9XG4gICAgcmV0dXJuIGF3YWl0IGNvbXBsZXRlUHJvb2YoYXBwbGljYXRpb25SdW5JZCk7XG59XG53b3JrZmxvd1Byb29mLndvcmtmbG93SWQgPSBcIndvcmtmbG93Ly8uL3NyYy93b3JrZmxvd3Mvd29ya2Zsb3dQcm9vZi8vd29ya2Zsb3dQcm9vZlwiO1xuZ2xvYmFsVGhpcy5fX3ByaXZhdGVfd29ya2Zsb3dzLnNldChcIndvcmtmbG93Ly8uL3NyYy93b3JrZmxvd3Mvd29ya2Zsb3dQcm9vZi8vd29ya2Zsb3dQcm9vZlwiLCB3b3JrZmxvd1Byb29mKTtcbnZhciBjbGFpbVByb29mID0gZ2xvYmFsVGhpc1tTeW1ib2wuZm9yKFwiV09SS0ZMT1dfVVNFX1NURVBcIildKFwic3RlcC8vLi9zcmMvd29ya2Zsb3dzL3dvcmtmbG93UHJvb2YvL2NsYWltUHJvb2ZcIik7XG52YXIgcmVjb25jaWxlUHJvb2YgPSBnbG9iYWxUaGlzW1N5bWJvbC5mb3IoXCJXT1JLRkxPV19VU0VfU1RFUFwiKV0oXCJzdGVwLy8uL3NyYy93b3JrZmxvd3Mvd29ya2Zsb3dQcm9vZi8vcmVjb25jaWxlUHJvb2ZcIik7XG52YXIgc3ludGhldGljV29yayA9IGdsb2JhbFRoaXNbU3ltYm9sLmZvcihcIldPUktGTE9XX1VTRV9TVEVQXCIpXShcInN0ZXAvLy4vc3JjL3dvcmtmbG93cy93b3JrZmxvd1Byb29mLy9zeW50aGV0aWNXb3JrXCIpO1xuc3ludGhldGljV29yay5tYXhSZXRyaWVzID0gMTtcbnZhciBjb21wbGV0ZVByb29mID0gZ2xvYmFsVGhpc1tTeW1ib2wuZm9yKFwiV09SS0ZMT1dfVVNFX1NURVBcIildKFwic3RlcC8vLi9zcmMvd29ya2Zsb3dzL3dvcmtmbG93UHJvb2YvL2NvbXBsZXRlUHJvb2ZcIik7XG52YXIgZmFpbFByb29mID0gZ2xvYmFsVGhpc1tTeW1ib2wuZm9yKFwiV09SS0ZMT1dfVVNFX1NURVBcIildKFwic3RlcC8vLi9zcmMvd29ya2Zsb3dzL3dvcmtmbG93UHJvb2YvL2ZhaWxQcm9vZlwiKTtcbiIsICJbXG5cdFwibm9kZTphc3NlcnRcIixcblx0XCJhc3NlcnRcIixcblx0XCJub2RlOmFzc2VydC9zdHJpY3RcIixcblx0XCJhc3NlcnQvc3RyaWN0XCIsXG5cdFwibm9kZTphc3luY19ob29rc1wiLFxuXHRcImFzeW5jX2hvb2tzXCIsXG5cdFwibm9kZTpidWZmZXJcIixcblx0XCJidWZmZXJcIixcblx0XCJub2RlOmNoaWxkX3Byb2Nlc3NcIixcblx0XCJjaGlsZF9wcm9jZXNzXCIsXG5cdFwibm9kZTpjbHVzdGVyXCIsXG5cdFwiY2x1c3RlclwiLFxuXHRcIm5vZGU6Y29uc29sZVwiLFxuXHRcImNvbnNvbGVcIixcblx0XCJub2RlOmNvbnN0YW50c1wiLFxuXHRcImNvbnN0YW50c1wiLFxuXHRcIm5vZGU6Y3J5cHRvXCIsXG5cdFwiY3J5cHRvXCIsXG5cdFwibm9kZTpkZ3JhbVwiLFxuXHRcImRncmFtXCIsXG5cdFwibm9kZTpkaWFnbm9zdGljc19jaGFubmVsXCIsXG5cdFwiZGlhZ25vc3RpY3NfY2hhbm5lbFwiLFxuXHRcIm5vZGU6ZG5zXCIsXG5cdFwiZG5zXCIsXG5cdFwibm9kZTpkbnMvcHJvbWlzZXNcIixcblx0XCJkbnMvcHJvbWlzZXNcIixcblx0XCJub2RlOmRvbWFpblwiLFxuXHRcImRvbWFpblwiLFxuXHRcIm5vZGU6ZXZlbnRzXCIsXG5cdFwiZXZlbnRzXCIsXG5cdFwibm9kZTpmc1wiLFxuXHRcImZzXCIsXG5cdFwibm9kZTpmcy9wcm9taXNlc1wiLFxuXHRcImZzL3Byb21pc2VzXCIsXG5cdFwibm9kZTpodHRwXCIsXG5cdFwiaHR0cFwiLFxuXHRcIm5vZGU6aHR0cDJcIixcblx0XCJodHRwMlwiLFxuXHRcIm5vZGU6aHR0cHNcIixcblx0XCJodHRwc1wiLFxuXHRcIm5vZGU6aW5zcGVjdG9yXCIsXG5cdFwiaW5zcGVjdG9yXCIsXG5cdFwibm9kZTppbnNwZWN0b3IvcHJvbWlzZXNcIixcblx0XCJpbnNwZWN0b3IvcHJvbWlzZXNcIixcblx0XCJub2RlOm1vZHVsZVwiLFxuXHRcIm1vZHVsZVwiLFxuXHRcIm5vZGU6bmV0XCIsXG5cdFwibmV0XCIsXG5cdFwibm9kZTpvc1wiLFxuXHRcIm9zXCIsXG5cdFwibm9kZTpwYXRoXCIsXG5cdFwicGF0aFwiLFxuXHRcIm5vZGU6cGF0aC9wb3NpeFwiLFxuXHRcInBhdGgvcG9zaXhcIixcblx0XCJub2RlOnBhdGgvd2luMzJcIixcblx0XCJwYXRoL3dpbjMyXCIsXG5cdFwibm9kZTpwZXJmX2hvb2tzXCIsXG5cdFwicGVyZl9ob29rc1wiLFxuXHRcIm5vZGU6cHJvY2Vzc1wiLFxuXHRcInByb2Nlc3NcIixcblx0XCJub2RlOnF1ZXJ5c3RyaW5nXCIsXG5cdFwicXVlcnlzdHJpbmdcIixcblx0XCJub2RlOnF1aWNcIixcblx0XCJub2RlOnJlYWRsaW5lXCIsXG5cdFwicmVhZGxpbmVcIixcblx0XCJub2RlOnJlYWRsaW5lL3Byb21pc2VzXCIsXG5cdFwicmVhZGxpbmUvcHJvbWlzZXNcIixcblx0XCJub2RlOnJlcGxcIixcblx0XCJyZXBsXCIsXG5cdFwibm9kZTpzZWFcIixcblx0XCJub2RlOnNxbGl0ZVwiLFxuXHRcIm5vZGU6c3RyZWFtXCIsXG5cdFwic3RyZWFtXCIsXG5cdFwibm9kZTpzdHJlYW0vY29uc3VtZXJzXCIsXG5cdFwic3RyZWFtL2NvbnN1bWVyc1wiLFxuXHRcIm5vZGU6c3RyZWFtL3Byb21pc2VzXCIsXG5cdFwic3RyZWFtL3Byb21pc2VzXCIsXG5cdFwibm9kZTpzdHJlYW0vd2ViXCIsXG5cdFwic3RyZWFtL3dlYlwiLFxuXHRcIm5vZGU6c3RyaW5nX2RlY29kZXJcIixcblx0XCJzdHJpbmdfZGVjb2RlclwiLFxuXHRcIm5vZGU6dGVzdFwiLFxuXHRcIm5vZGU6dGVzdC9yZXBvcnRlcnNcIixcblx0XCJub2RlOnRpbWVyc1wiLFxuXHRcInRpbWVyc1wiLFxuXHRcIm5vZGU6dGltZXJzL3Byb21pc2VzXCIsXG5cdFwidGltZXJzL3Byb21pc2VzXCIsXG5cdFwibm9kZTp0bHNcIixcblx0XCJ0bHNcIixcblx0XCJub2RlOnRyYWNlX2V2ZW50c1wiLFxuXHRcInRyYWNlX2V2ZW50c1wiLFxuXHRcIm5vZGU6dHR5XCIsXG5cdFwidHR5XCIsXG5cdFwibm9kZTp1cmxcIixcblx0XCJ1cmxcIixcblx0XCJub2RlOnV0aWxcIixcblx0XCJ1dGlsXCIsXG5cdFwibm9kZTp1dGlsL3R5cGVzXCIsXG5cdFwidXRpbC90eXBlc1wiLFxuXHRcIm5vZGU6djhcIixcblx0XCJ2OFwiLFxuXHRcIm5vZGU6dm1cIixcblx0XCJ2bVwiLFxuXHRcIm5vZGU6d2FzaVwiLFxuXHRcIndhc2lcIixcblx0XCJub2RlOndvcmtlcl90aHJlYWRzXCIsXG5cdFwid29ya2VyX3RocmVhZHNcIixcblx0XCJub2RlOnpsaWJcIixcblx0XCJ6bGliXCJcbl1cbiIsICJpbXBvcnQgYnVpbHRpbk1vZHVsZXMgZnJvbSAnLi9idWlsdGluLW1vZHVsZXMuanNvbic7XG5leHBvcnQgZGVmYXVsdCBidWlsdGluTW9kdWxlcztcbiIsICIvKipcbiAqIFNlcmRlIGNvbXBsaWFuY2UgY2hlY2tlciBmb3Igd29ya2Zsb3cgY3VzdG9tIGNsYXNzIHNlcmlhbGl6YXRpb24uXG4gKlxuICogQW5hbHl6ZXMgc291cmNlIGNvZGUgdG8gZGV0ZXJtaW5lIGlmIGNsYXNzZXMgd2l0aCBXT1JLRkxPV19TRVJJQUxJWkUgL1xuICogV09SS0ZMT1dfREVTRVJJQUxJWkUgYXJlIGNvcnJlY3RseSBzZXQgdXAgZm9yIHRoZSB3b3JrZmxvdyBzYW5kYm94LlxuICpcbiAqIFVzZWQgYnk6XG4gKiAtIENMSSBgdmFsaWRhdGVgIGNvbW1hbmRcbiAqIC0gQ0xJIGB0cmFuc2Zvcm1gIGNvbW1hbmQgKC0tY2hlY2stc2VyZGUpXG4gKiAtIFNXQyBwbGF5Z3JvdW5kIHNlcmRlIGFuYWx5c2lzIHBhbmVsXG4gKiAtIEJ1aWxkLXRpbWUgd2FybmluZ3MgaW4gQmFzZUJ1aWxkZXJcbiAqL1xuXG5pbXBvcnQgYnVpbHRpbk1vZHVsZXMgZnJvbSAnYnVpbHRpbi1tb2R1bGVzJztcbmltcG9ydCB0eXBlIHsgV29ya2Zsb3dNYW5pZmVzdCB9IGZyb20gJy4vYXBwbHktc3djLXRyYW5zZm9ybS5qcyc7XG5cbi8vIEJ1aWxkIGEgcmVnZXggdGhhdCBtYXRjaGVzIE5vZGUuanMgYnVpbHQtaW4gbW9kdWxlIGltcG9ydHMgaW4gdHJhbnNmb3JtZWQgY29kZS5cbi8vIEhhbmRsZXMgYm90aCBFU00gKGBmcm9tICdmcydgLCBgZnJvbSAnbm9kZTpmcydgKSBhbmQgQ0pTIChgcmVxdWlyZSgnZnMnKWApXG5jb25zdCBub2RlQnVpbHRpbnMgPSBidWlsdGluTW9kdWxlcy5qb2luKCd8Jyk7XG5cbi8vIFJlZ2V4IHRvIGV4dHJhY3Qgc3BlY2lmaWMgbW9kdWxlIG5hbWVzIGZyb20gaW1wb3J0L3JlcXVpcmUgc3RhdGVtZW50c1xuY29uc3Qgbm9kZUltcG9ydEV4dHJhY3RSZWdleCA9IG5ldyBSZWdFeHAoXG4gIGAoPzpmcm9tXFxcXHMrWydcIl0oPzpub2RlOik/KCg/OiR7bm9kZUJ1aWx0aW5zfSkoPzovW14nXCJdKik/KVsnXCJdYCArXG4gICAgYHxyZXF1aXJlXFxcXHMqXFxcXChcXFxccypbJ1wiXSg/Om5vZGU6KT8oKD86JHtub2RlQnVpbHRpbnN9KSg/Oi9bXidcIl0qKT8pWydcIl1cXFxccypcXFxcKSlgLFxuICAnZydcbik7XG5cbi8vIFJlZ2V4IHRvIGRldGVjdCBjbGFzcyByZWdpc3RyYXRpb24gSUlGRXMgZ2VuZXJhdGVkIGJ5IHRoZSBTV0MgcGx1Z2luXG5jb25zdCByZWdpc3RyYXRpb25JaWZlUmVnZXggPVxuICAvU3ltYm9sXFwuZm9yXFxzKlxcKFxccypbXCInXXdvcmtmbG93LWNsYXNzLXJlZ2lzdHJ5W1wiJ11cXHMqXFwpLztcblxuLyoqXG4gKiBSZXN1bHQgb2YgY2hlY2tpbmcgYSBzaW5nbGUgY2xhc3MgZm9yIHNlcmRlIGNvbXBsaWFuY2UuXG4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgU2VyZGVDbGFzc0NoZWNrUmVzdWx0IHtcbiAgLyoqIFRoZSBjbGFzcyBuYW1lIGFzIGRldGVjdGVkIGluIHRoZSBzb3VyY2UgKi9cbiAgY2xhc3NOYW1lOiBzdHJpbmc7XG4gIC8qKiBUaGUgY2xhc3NJZCBhc3NpZ25lZCBieSB0aGUgU1dDIHBsdWdpbiAoZnJvbSB0aGUgbWFuaWZlc3QpICovXG4gIGNsYXNzSWQ6IHN0cmluZztcbiAgLyoqIFdoZXRoZXIgdGhlIFNXQyBwbHVnaW4gZGV0ZWN0ZWQgc2VyZGUgc3ltYm9scyBvbiB0aGlzIGNsYXNzICovXG4gIGRldGVjdGVkOiBib29sZWFuO1xuICAvKiogV2hldGhlciBhIHJlZ2lzdHJhdGlvbiBJSUZFIHdhcyBnZW5lcmF0ZWQgaW4gdGhlIG91dHB1dCAqL1xuICByZWdpc3RlcmVkOiBib29sZWFuO1xuICAvKipcbiAgICogTm9kZS5qcyBidWlsdC1pbiBtb2R1bGUgaW1wb3J0cyByZW1haW5pbmcgaW4gdGhlIHdvcmtmbG93LW1vZGUgb3V0cHV0LlxuICAgKiBJZiBub24tZW1wdHksIHRoZSBjbGFzcyBpcyBOT1Qgd29ya2Zsb3ctc2FuZGJveCBjb21wbGlhbnQuXG4gICAqL1xuICBub2RlSW1wb3J0czogc3RyaW5nW107XG4gIC8qKiBXaGV0aGVyIHRoZSBjbGFzcyBwYXNzZXMgYWxsIGNvbXBsaWFuY2UgY2hlY2tzICovXG4gIGNvbXBsaWFudDogYm9vbGVhbjtcbiAgLyoqIEh1bWFuLXJlYWRhYmxlIGRlc2NyaXB0aW9ucyBvZiBhbnkgaXNzdWVzIGZvdW5kICovXG4gIGlzc3Vlczogc3RyaW5nW107XG59XG5cbi8qKlxuICogRnVsbCByZXN1bHQgb2Ygc2VyZGUgY29tcGxpYW5jZSBhbmFseXNpcyBmb3IgYSBzb3VyY2UgZmlsZS5cbiAqL1xuZXhwb3J0IGludGVyZmFjZSBTZXJkZUNoZWNrUmVzdWx0IHtcbiAgLyoqIFBlci1jbGFzcyBhbmFseXNpcyByZXN1bHRzICovXG4gIGNsYXNzZXM6IFNlcmRlQ2xhc3NDaGVja1Jlc3VsdFtdO1xuICAvKiogQWxsIE5vZGUuanMgYnVpbHQtaW4gaW1wb3J0cyBmb3VuZCBpbiB0aGUgd29ya2Zsb3ctbW9kZSBvdXRwdXQgKi9cbiAgZ2xvYmFsTm9kZUltcG9ydHM6IHN0cmluZ1tdO1xuICAvKiogV2hldGhlciB0aGUgd29ya2Zsb3ctbW9kZSBvdXRwdXQgY29udGFpbnMgYW55IHNlcmRlLXJlbGF0ZWQgY2xhc3NlcyAqL1xuICBoYXNTZXJkZUNsYXNzZXM6IGJvb2xlYW47XG4gIC8qKiBUaGUgcmF3IHdvcmtmbG93IG1hbmlmZXN0IGV4dHJhY3RlZCBmcm9tIHRoZSBTV0MgdHJhbnNmb3JtICovXG4gIG1hbmlmZXN0OiBXb3JrZmxvd01hbmlmZXN0O1xufVxuXG4vKipcbiAqIExpZ2h0d2VpZ2h0IHNlcmRlIGNvbXBsaWFuY2UgY2hlY2tlciB0aGF0IHdvcmtzIHdpdGggcHJlLWNvbXB1dGVkXG4gKiBTV0MgdHJhbnNmb3JtIHJlc3VsdHMuIFRoaXMgYXZvaWRzIHJlLXJ1bm5pbmcgdGhlIFNXQyB0cmFuc2Zvcm1cbiAqIHdoZW4gdGhlIGNhbGxlciBhbHJlYWR5IGhhcyB0aGUgb3V0cHV0cyAoZS5nLiwgdGhlIHBsYXlncm91bmQgb3IgYnVpbGRlcikuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBhbmFseXplU2VyZGVDb21wbGlhbmNlKG9wdGlvbnM6IHtcbiAgLyoqIFNvdXJjZSBjb2RlICh1c2VkIGZvciBwYXR0ZXJuIGRldGVjdGlvbikgKi9cbiAgc291cmNlQ29kZTogc3RyaW5nO1xuICAvKiogV29ya2Zsb3ctbW9kZSB0cmFuc2Zvcm1lZCBvdXRwdXQgKi9cbiAgd29ya2Zsb3dDb2RlOiBzdHJpbmc7XG4gIC8qKiBNYW5pZmVzdCBleHRyYWN0ZWQgZnJvbSB0aGUgU1dDIHRyYW5zZm9ybSAqL1xuICBtYW5pZmVzdDogV29ya2Zsb3dNYW5pZmVzdDtcbn0pOiBTZXJkZUNoZWNrUmVzdWx0IHtcbiAgY29uc3QgeyBzb3VyY2VDb2RlLCB3b3JrZmxvd0NvZGUsIG1hbmlmZXN0IH0gPSBvcHRpb25zO1xuXG4gIC8vIDEuIEV4dHJhY3QgYWxsIE5vZGUuanMgYnVpbHQtaW4gaW1wb3J0cyBmcm9tIHRoZSB3b3JrZmxvdyBvdXRwdXRcbiAgY29uc3QgZ2xvYmFsTm9kZUltcG9ydHMgPSBleHRyYWN0Tm9kZUltcG9ydHMod29ya2Zsb3dDb2RlKTtcblxuICAvLyAyLiBDaGVjayBpZiB0aGUgbWFuaWZlc3QgY29udGFpbnMgYW55IHNlcmRlLXJlZ2lzdGVyZWQgY2xhc3Nlc1xuICBjb25zdCBjbGFzc0VudHJpZXMgPSBleHRyYWN0Q2xhc3NFbnRyaWVzKG1hbmlmZXN0KTtcbiAgY29uc3QgaGFzU2VyZGVDbGFzc2VzID0gY2xhc3NFbnRyaWVzLmxlbmd0aCA+IDA7XG5cbiAgLy8gMy4gQ2hlY2sgaWYgdGhlIHdvcmtmbG93IG91dHB1dCBjb250YWlucyByZWdpc3RyYXRpb24gSUlGRXNcbiAgY29uc3QgaGFzUmVnaXN0cmF0aW9uID0gcmVnaXN0cmF0aW9uSWlmZVJlZ2V4LnRlc3Qod29ya2Zsb3dDb2RlKTtcblxuICAvLyA0LiBBbmFseXplIGVhY2ggY2xhc3NcbiAgY29uc3QgY2xhc3NlczogU2VyZGVDbGFzc0NoZWNrUmVzdWx0W10gPSBjbGFzc0VudHJpZXMubWFwKChlbnRyeSkgPT4ge1xuICAgIGNvbnN0IGlzc3Vlczogc3RyaW5nW10gPSBbXTtcblxuICAgIC8vIENoZWNrIGZvciBOb2RlLmpzIGltcG9ydHMgKHRoZXNlIHdpbGwgZmFpbCBpbiB0aGUgd29ya2Zsb3cgc2FuZGJveClcbiAgICBpZiAoZ2xvYmFsTm9kZUltcG9ydHMubGVuZ3RoID4gMCkge1xuICAgICAgaXNzdWVzLnB1c2goXG4gICAgICAgIGBXb3JrZmxvdyBidW5kbGUgY29udGFpbnMgTm9kZS5qcyBidWlsdC1pbiBpbXBvcnRzOiAke2dsb2JhbE5vZGVJbXBvcnRzLmpvaW4oJywgJyl9LiBgICtcbiAgICAgICAgICBgVGhlc2Ugd2lsbCBmYWlsIGF0IHJ1bnRpbWUgaW4gdGhlIHdvcmtmbG93IHNhbmRib3guIGAgK1xuICAgICAgICAgIGBBZGQgXCJ1c2Ugc3RlcFwiIHRvIG1ldGhvZHMgdGhhdCBkZXBlbmQgb24gTm9kZS5qcyBBUElzIHNvIHRoZXkgYXJlIHN0cmlwcGVkIGZyb20gdGhlIHdvcmtmbG93IGJ1bmRsZS5gXG4gICAgICApO1xuICAgIH1cblxuICAgIC8vIENoZWNrIGZvciByZWdpc3RyYXRpb25cbiAgICBpZiAoIWhhc1JlZ2lzdHJhdGlvbikge1xuICAgICAgaXNzdWVzLnB1c2goXG4gICAgICAgIGBObyBjbGFzcyByZWdpc3RyYXRpb24gSUlGRSB3YXMgZ2VuZXJhdGVkLiBgICtcbiAgICAgICAgICBgRW5zdXJlIFdPUktGTE9XX1NFUklBTElaRSBhbmQgV09SS0ZMT1dfREVTRVJJQUxJWkUgYXJlIGRlZmluZWQgYXMgc3RhdGljIG1ldGhvZHMgYCArXG4gICAgICAgICAgYGluc2lkZSB0aGUgY2xhc3MgYm9keSB1c2luZyBjb21wdXRlZCBwcm9wZXJ0eSBzeW50YXg6IHN0YXRpYyBbV09SS0ZMT1dfU0VSSUFMSVpFXSguLi4pIHsgLi4uIH1gXG4gICAgICApO1xuICAgIH1cblxuICAgIHJldHVybiB7XG4gICAgICBjbGFzc05hbWU6IGVudHJ5LmNsYXNzTmFtZSxcbiAgICAgIGNsYXNzSWQ6IGVudHJ5LmNsYXNzSWQsXG4gICAgICBkZXRlY3RlZDogdHJ1ZSxcbiAgICAgIHJlZ2lzdGVyZWQ6IGhhc1JlZ2lzdHJhdGlvbixcbiAgICAgIG5vZGVJbXBvcnRzOiBnbG9iYWxOb2RlSW1wb3J0cyxcbiAgICAgIGNvbXBsaWFudDogZ2xvYmFsTm9kZUltcG9ydHMubGVuZ3RoID09PSAwICYmIGhhc1JlZ2lzdHJhdGlvbixcbiAgICAgIGlzc3VlcyxcbiAgICB9O1xuICB9KTtcblxuICAvLyA1LiBDaGVjayBmb3IgY2xhc3NlcyB0aGF0IGhhdmUgc2VyZGUgcGF0dGVybnMgaW4gc291cmNlIGJ1dCB3ZXJlbid0IGRldGVjdGVkIGJ5IFNXQ1xuICBjb25zdCBzb3VyY2VIYXNTZXJkZVBhdHRlcm5zID1cbiAgICAvXFxbXFxzKldPUktGTE9XXyg/OlNFUklBTElaRXxERVNFUklBTElaRSlcXHMqXFxdLy50ZXN0KHNvdXJjZUNvZGUpIHx8XG4gICAgL1N5bWJvbFxcLmZvclxccypcXChcXHMqWydcIl13b3JrZmxvdy0oPzpzZXJpYWxpemV8ZGVzZXJpYWxpemUpWydcIl1cXHMqXFwpLy50ZXN0KFxuICAgICAgc291cmNlQ29kZVxuICAgICk7XG5cbiAgaWYgKHNvdXJjZUhhc1NlcmRlUGF0dGVybnMgJiYgY2xhc3NFbnRyaWVzLmxlbmd0aCA9PT0gMCkge1xuICAgIGNsYXNzZXMucHVzaCh7XG4gICAgICBjbGFzc05hbWU6ICc8dW5rbm93bj4nLFxuICAgICAgY2xhc3NJZDogJycsXG4gICAgICBkZXRlY3RlZDogZmFsc2UsXG4gICAgICByZWdpc3RlcmVkOiBmYWxzZSxcbiAgICAgIG5vZGVJbXBvcnRzOiBnbG9iYWxOb2RlSW1wb3J0cyxcbiAgICAgIGNvbXBsaWFudDogZmFsc2UsXG4gICAgICBpc3N1ZXM6IFtcbiAgICAgICAgYFNvdXJjZSBjb2RlIGNvbnRhaW5zIFdPUktGTE9XX1NFUklBTElaRS9XT1JLRkxPV19ERVNFUklBTElaRSBwYXR0ZXJucyBidXQgYCArXG4gICAgICAgICAgYHRoZSBTV0MgcGx1Z2luIGRpZCBub3QgZGV0ZWN0IGFueSBzZXJkZS1lbmFibGVkIGNsYXNzZXMuIGAgK1xuICAgICAgICAgIGBFbnN1cmUgdGhlIHN5bWJvbHMgYXJlIGRlZmluZWQgYXMgc3RhdGljIG1ldGhvZHMgSU5TSURFIHRoZSBjbGFzcyBib2R5LCBgICtcbiAgICAgICAgICBgbm90IGFzc2lnbmVkIGV4dGVybmFsbHkgKGUuZy4sIChNeUNsYXNzIGFzIGFueSlbV09SS0ZMT1dfU0VSSUFMSVpFXSA9IC4uLikuYCxcbiAgICAgIF0sXG4gICAgfSk7XG4gIH1cblxuICByZXR1cm4ge1xuICAgIGNsYXNzZXMsXG4gICAgZ2xvYmFsTm9kZUltcG9ydHMsXG4gICAgaGFzU2VyZGVDbGFzc2VzLFxuICAgIG1hbmlmZXN0LFxuICB9O1xufVxuXG4vKipcbiAqIEV4dHJhY3QgTm9kZS5qcyBidWlsdC1pbiBtb2R1bGUgbmFtZXMgZnJvbSB0cmFuc2Zvcm1lZCBjb2RlLlxuICovXG5mdW5jdGlvbiBleHRyYWN0Tm9kZUltcG9ydHMoY29kZTogc3RyaW5nKTogc3RyaW5nW10ge1xuICBjb25zdCBpbXBvcnRzID0gbmV3IFNldDxzdHJpbmc+KCk7XG4gIC8vIFJlc2V0IHJlZ2V4IHN0YXRlXG4gIG5vZGVJbXBvcnRFeHRyYWN0UmVnZXgubGFzdEluZGV4ID0gMDtcbiAgZm9yIChcbiAgICBsZXQgbWF0Y2ggPSBub2RlSW1wb3J0RXh0cmFjdFJlZ2V4LmV4ZWMoY29kZSk7XG4gICAgbWF0Y2ggIT09IG51bGw7XG4gICAgbWF0Y2ggPSBub2RlSW1wb3J0RXh0cmFjdFJlZ2V4LmV4ZWMoY29kZSlcbiAgKSB7XG4gICAgLy8gbWF0Y2hbMV0gaXMgZnJvbSB0aGUgRVNNIHBhdHRlcm4sIG1hdGNoWzJdIGlzIGZyb20gdGhlIENKUyBwYXR0ZXJuXG4gICAgY29uc3QgbW9kdWxlTmFtZSA9IG1hdGNoWzFdIHx8IG1hdGNoWzJdO1xuICAgIGlmIChtb2R1bGVOYW1lKSB7XG4gICAgICAvLyBOb3JtYWxpemUgdG8gYmFzZSBtb2R1bGUgbmFtZSAoZS5nLiwgJ2ZzL3Byb21pc2VzJyAtPiAnZnMnKVxuICAgICAgaW1wb3J0cy5hZGQobW9kdWxlTmFtZS5zcGxpdCgnLycpWzBdKTtcbiAgICB9XG4gIH1cbiAgcmV0dXJuIFsuLi5pbXBvcnRzXS5zb3J0KCk7XG59XG5cbi8qKlxuICogRXh0cmFjdCBjbGFzcyBlbnRyaWVzIGZyb20gYSBXb3JrZmxvd01hbmlmZXN0LlxuICovXG5leHBvcnQgZnVuY3Rpb24gZXh0cmFjdENsYXNzRW50cmllcyhcbiAgbWFuaWZlc3Q6IFdvcmtmbG93TWFuaWZlc3Rcbik6IEFycmF5PHsgY2xhc3NOYW1lOiBzdHJpbmc7IGNsYXNzSWQ6IHN0cmluZzsgZmlsZU5hbWU6IHN0cmluZyB9PiB7XG4gIGNvbnN0IGVudHJpZXM6IEFycmF5PHtcbiAgICBjbGFzc05hbWU6IHN0cmluZztcbiAgICBjbGFzc0lkOiBzdHJpbmc7XG4gICAgZmlsZU5hbWU6IHN0cmluZztcbiAgfT4gPSBbXTtcbiAgaWYgKCFtYW5pZmVzdC5jbGFzc2VzKSByZXR1cm4gZW50cmllcztcblxuICBmb3IgKGNvbnN0IFtmaWxlTmFtZSwgY2xhc3Nlc10gb2YgT2JqZWN0LmVudHJpZXMobWFuaWZlc3QuY2xhc3NlcykpIHtcbiAgICBmb3IgKGNvbnN0IFtjbGFzc05hbWUsIHsgY2xhc3NJZCB9XSBvZiBPYmplY3QuZW50cmllcyhjbGFzc2VzKSkge1xuICAgICAgZW50cmllcy5wdXNoKHsgY2xhc3NOYW1lLCBjbGFzc0lkLCBmaWxlTmFtZSB9KTtcbiAgICB9XG4gIH1cbiAgcmV0dXJuIGVudHJpZXM7XG59XG4iXSwKICAibWFwcGluZ3MiOiAiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFBQTtBQUFBLHNDQUFBQSxTQUFBO0FBRUksUUFBSSxJQUFJO0FBQ1osUUFBSSxJQUFJLElBQUk7QUFDWixRQUFJLElBQUksSUFBSTtBQUNaLFFBQUksSUFBSSxJQUFJO0FBQ1osUUFBSSxJQUFJLElBQUk7QUFDWixRQUFJLElBQUksSUFBSTtBQWFSLElBQUFBLFFBQU8sVUFBVSxTQUFTLEtBQUssU0FBUztBQUN4QyxnQkFBVSxXQUFXLENBQUM7QUFDdEIsVUFBSSxPQUFPLE9BQU87QUFDbEIsVUFBSSxTQUFTLFlBQVksSUFBSSxTQUFTLEdBQUc7QUFDckMsZUFBTyxNQUFNLEdBQUc7QUFBQSxNQUNwQixXQUFXLFNBQVMsWUFBWSxTQUFTLEdBQUcsR0FBRztBQUMzQyxlQUFPLFFBQVEsT0FBTyxRQUFRLEdBQUcsSUFBSSxTQUFTLEdBQUc7QUFBQSxNQUNyRDtBQUNBLFlBQU0sSUFBSSxNQUFNLDBEQUEwRCxLQUFLLFVBQVUsR0FBRyxDQUFDO0FBQUEsSUFDakc7QUFPSSxhQUFTLE1BQU0sS0FBSztBQUNwQixZQUFNLE9BQU8sR0FBRztBQUNoQixVQUFJLElBQUksU0FBUyxLQUFLO0FBQ2xCO0FBQUEsTUFDSjtBQUNBLFVBQUksUUFBUSxtSUFBbUksS0FBSyxHQUFHO0FBQ3ZKLFVBQUksQ0FBQyxPQUFPO0FBQ1I7QUFBQSxNQUNKO0FBQ0EsVUFBSSxJQUFJLFdBQVcsTUFBTSxDQUFDLENBQUM7QUFDM0IsVUFBSSxRQUFRLE1BQU0sQ0FBQyxLQUFLLE1BQU0sWUFBWTtBQUMxQyxjQUFPLE1BQUs7QUFBQSxRQUNSLEtBQUs7QUFBQSxRQUNMLEtBQUs7QUFBQSxRQUNMLEtBQUs7QUFBQSxRQUNMLEtBQUs7QUFBQSxRQUNMLEtBQUs7QUFDRCxpQkFBTyxJQUFJO0FBQUEsUUFDZixLQUFLO0FBQUEsUUFDTCxLQUFLO0FBQUEsUUFDTCxLQUFLO0FBQ0QsaUJBQU8sSUFBSTtBQUFBLFFBQ2YsS0FBSztBQUFBLFFBQ0wsS0FBSztBQUFBLFFBQ0wsS0FBSztBQUNELGlCQUFPLElBQUk7QUFBQSxRQUNmLEtBQUs7QUFBQSxRQUNMLEtBQUs7QUFBQSxRQUNMLEtBQUs7QUFBQSxRQUNMLEtBQUs7QUFBQSxRQUNMLEtBQUs7QUFDRCxpQkFBTyxJQUFJO0FBQUEsUUFDZixLQUFLO0FBQUEsUUFDTCxLQUFLO0FBQUEsUUFDTCxLQUFLO0FBQUEsUUFDTCxLQUFLO0FBQUEsUUFDTCxLQUFLO0FBQ0QsaUJBQU8sSUFBSTtBQUFBLFFBQ2YsS0FBSztBQUFBLFFBQ0wsS0FBSztBQUFBLFFBQ0wsS0FBSztBQUFBLFFBQ0wsS0FBSztBQUFBLFFBQ0wsS0FBSztBQUNELGlCQUFPLElBQUk7QUFBQSxRQUNmLEtBQUs7QUFBQSxRQUNMLEtBQUs7QUFBQSxRQUNMLEtBQUs7QUFBQSxRQUNMLEtBQUs7QUFBQSxRQUNMLEtBQUs7QUFDRCxpQkFBTztBQUFBLFFBQ1g7QUFDSSxpQkFBTztBQUFBLE1BQ2Y7QUFBQSxJQUNKO0FBckRhO0FBNERULGFBQVMsU0FBU0MsS0FBSTtBQUN0QixVQUFJLFFBQVEsS0FBSyxJQUFJQSxHQUFFO0FBQ3ZCLFVBQUksU0FBUyxHQUFHO0FBQ1osZUFBTyxLQUFLLE1BQU1BLE1BQUssQ0FBQyxJQUFJO0FBQUEsTUFDaEM7QUFDQSxVQUFJLFNBQVMsR0FBRztBQUNaLGVBQU8sS0FBSyxNQUFNQSxNQUFLLENBQUMsSUFBSTtBQUFBLE1BQ2hDO0FBQ0EsVUFBSSxTQUFTLEdBQUc7QUFDWixlQUFPLEtBQUssTUFBTUEsTUFBSyxDQUFDLElBQUk7QUFBQSxNQUNoQztBQUNBLFVBQUksU0FBUyxHQUFHO0FBQ1osZUFBTyxLQUFLLE1BQU1BLE1BQUssQ0FBQyxJQUFJO0FBQUEsTUFDaEM7QUFDQSxhQUFPQSxNQUFLO0FBQUEsSUFDaEI7QUFmYTtBQXNCVCxhQUFTLFFBQVFBLEtBQUk7QUFDckIsVUFBSSxRQUFRLEtBQUssSUFBSUEsR0FBRTtBQUN2QixVQUFJLFNBQVMsR0FBRztBQUNaLGVBQU8sT0FBT0EsS0FBSSxPQUFPLEdBQUcsS0FBSztBQUFBLE1BQ3JDO0FBQ0EsVUFBSSxTQUFTLEdBQUc7QUFDWixlQUFPLE9BQU9BLEtBQUksT0FBTyxHQUFHLE1BQU07QUFBQSxNQUN0QztBQUNBLFVBQUksU0FBUyxHQUFHO0FBQ1osZUFBTyxPQUFPQSxLQUFJLE9BQU8sR0FBRyxRQUFRO0FBQUEsTUFDeEM7QUFDQSxVQUFJLFNBQVMsR0FBRztBQUNaLGVBQU8sT0FBT0EsS0FBSSxPQUFPLEdBQUcsUUFBUTtBQUFBLE1BQ3hDO0FBQ0EsYUFBT0EsTUFBSztBQUFBLElBQ2hCO0FBZmE7QUFrQlQsYUFBUyxPQUFPQSxLQUFJLE9BQU8sR0FBRyxNQUFNO0FBQ3BDLFVBQUksV0FBVyxTQUFTLElBQUk7QUFDNUIsYUFBTyxLQUFLLE1BQU1BLE1BQUssQ0FBQyxJQUFJLE1BQU0sUUFBUSxXQUFXLE1BQU07QUFBQSxJQUMvRDtBQUhhO0FBQUE7QUFBQTs7O0FDbkliLGVBQXNCLFlBQVksa0JBQWtCO0FBQ2hELFFBQU0sVUFBVSxNQUFNLFFBQVEsZ0JBQWdCO0FBQzlDLE1BQUksUUFBUSxXQUFXLFVBQVU7QUFDN0IsVUFBTSxRQUFRLE1BQU0sZUFBZSxnQkFBZ0I7QUFDbkQsUUFBSSxNQUFNLElBQUk7QUFDVixZQUFNLFlBQVksTUFBTSx3QkFBd0IsZ0JBQWdCO0FBQ2hFLFVBQUksQ0FBQyxVQUFVLElBQUk7QUFDZixjQUFNLFNBQVMsTUFBTSxjQUFjLGtCQUFrQixVQUFVLFVBQVU7QUFDekUsWUFBSSxPQUFPLEdBQUksUUFBTztBQUFBLFVBQ2xCO0FBQUEsVUFDQSxnQkFBZ0I7QUFBQSxRQUNwQjtBQUNBLGVBQU8sTUFBTSwwQkFBMEIsZ0JBQWdCO0FBQUEsTUFDM0Q7QUFDQSxZQUFNLGFBQWEsTUFBTSx3QkFBd0Isa0JBQWtCLFVBQVUsU0FBUztBQUN0RixVQUFJLENBQUMsV0FBVyxJQUFJO0FBQ2hCLGNBQU0sU0FBUyxNQUFNLGNBQWMsa0JBQWtCLGtCQUFrQjtBQUN2RSxZQUFJLE9BQU8sR0FBSSxRQUFPO0FBQUEsVUFDbEI7QUFBQSxVQUNBLGdCQUFnQjtBQUFBLFFBQ3BCO0FBQ0EsZUFBTyxNQUFNLDBCQUEwQixnQkFBZ0I7QUFBQSxNQUMzRDtBQUNBLFlBQU0sWUFBWSxNQUFNLHNCQUFzQixrQkFBa0IsV0FBVyxNQUFNO0FBQ2pGLFVBQUksQ0FBQyxVQUFVLElBQUk7QUFDZixjQUFNLFNBQVMsTUFBTSxjQUFjLGtCQUFrQixrQkFBa0I7QUFDdkUsWUFBSSxPQUFPLEdBQUksUUFBTztBQUFBLFVBQ2xCO0FBQUEsVUFDQSxnQkFBZ0I7QUFBQSxRQUNwQjtBQUNBLGVBQU8sTUFBTSwwQkFBMEIsZ0JBQWdCO0FBQUEsTUFDM0Q7QUFDQSxZQUFNLGdDQUFnQyxrQkFBa0IsVUFBVSxXQUFXLFdBQVcsT0FBTyxNQUFNO0FBQ3JHLFlBQU0sWUFBWSxNQUFNLHFCQUFxQixnQkFBZ0I7QUFDN0QsVUFBSSxVQUFVLElBQUk7QUFDZCxjQUFNLHNCQUFzQixnQkFBZ0I7QUFDNUMsZUFBTztBQUFBLFVBQ0g7QUFBQSxVQUNBLGdCQUFnQjtBQUFBLFFBQ3BCO0FBQUEsTUFDSjtBQUFBLElBQ0o7QUFDQSxXQUFPLE1BQU0sMEJBQTBCLGdCQUFnQjtBQUFBLEVBQzNEO0FBQ0EsTUFBSSxRQUFRLFdBQVcsV0FBVztBQUM5QixVQUFNLGlCQUFpQixRQUFRLGVBQWUsU0FBUyxpQkFBaUIsSUFBSSxRQUFRLGVBQWU7QUFDbkcsVUFBTSxnQkFBZ0IsUUFBUSxjQUFjLFFBQVEsS0FBSyxJQUFJLElBQUksUUFBUSxVQUFVLFFBQVEsSUFBSSxpQkFBaUI7QUFDaEgsVUFBTSxXQUFXLGdCQUFnQixNQUFNLGNBQWMsa0JBQWtCLFdBQVcsSUFBSSxNQUFNLG1CQUFtQixnQkFBZ0I7QUFDL0gsUUFBSSxTQUFTLEdBQUksUUFBTztBQUFBLE1BQ3BCO0FBQUEsTUFDQSxnQkFBZ0IsZ0JBQWdCLFdBQVc7QUFBQSxJQUMvQztBQUFBLEVBQ0o7QUFDQSxTQUFPLE1BQU0sMEJBQTBCLGdCQUFnQjtBQUMzRDtBQXREc0I7QUF1RHRCLFlBQVksYUFBYTtBQUN6QixXQUFXLG9CQUFvQixJQUFJLHNEQUFzRCxXQUFXO0FBQ3BHLElBQUksVUFBVSxXQUFXLHVCQUFPLElBQUksbUJBQW1CLENBQUMsRUFBRSw0Q0FBNEM7QUFDdEcsSUFBSSxpQkFBaUIsV0FBVyx1QkFBTyxJQUFJLG1CQUFtQixDQUFDLEVBQUUsbURBQW1EO0FBQ3BILElBQUksMEJBQTBCLFdBQVcsdUJBQU8sSUFBSSxtQkFBbUIsQ0FBQyxFQUFFLDREQUE0RDtBQUN0SSxJQUFJLDBCQUEwQixXQUFXLHVCQUFPLElBQUksbUJBQW1CLENBQUMsRUFBRSw0REFBNEQ7QUFDdEksSUFBSSx3QkFBd0IsV0FBVyx1QkFBTyxJQUFJLG1CQUFtQixDQUFDLEVBQUUsMERBQTBEO0FBQ2xJLElBQUksa0NBQWtDLFdBQVcsdUJBQU8sSUFBSSxtQkFBbUIsQ0FBQyxFQUFFLG9FQUFvRTtBQUN0SixJQUFJLHVCQUF1QixXQUFXLHVCQUFPLElBQUksbUJBQW1CLENBQUMsRUFBRSx5REFBeUQ7QUFDaEksSUFBSSx3QkFBd0IsV0FBVyx1QkFBTyxJQUFJLG1CQUFtQixDQUFDLEVBQUUsMERBQTBEO0FBQ2xJLElBQUksZ0JBQWdCLFdBQVcsdUJBQU8sSUFBSSxtQkFBbUIsQ0FBQyxFQUFFLGtEQUFrRDtBQUNsSCxJQUFJLHFCQUFxQixXQUFXLHVCQUFPLElBQUksbUJBQW1CLENBQUMsRUFBRSx1REFBdUQ7QUFDNUgsSUFBSSw0QkFBNEIsV0FBVyx1QkFBTyxJQUFJLG1CQUFtQixDQUFDLEVBQUUsOERBQThEOzs7QUN2RTFJLGdCQUFlO0FBYVosU0FBQSxvQkFBQSxPQUFBO0FBQ0gsTUFBTSxPQUFBLFVBQVUsVUFBbUI7QUFDN0IsVUFBQSxpQkFBaUIsVUFBQUMsU0FBQSxLQUFVO0FBQzdCLFFBQUEsT0FBTSxlQUFnQixZQUFPLGFBQUEsR0FBQTtBQUN6QixZQUFBLElBQU8sTUFBQSxzQkFBMkIsS0FBQSxpRUFBaUI7O0FBSXZELFdBQUMsSUFBQSxLQUFBLEtBQUEsSUFBQSxJQUFBLFVBQUE7YUFDTSxPQUFJLFVBQWEsVUFBSztBQUM5QixRQUFBLFFBQUEsS0FBQSxDQUFBLE9BQUEsU0FBQSxLQUFBLEdBQUE7QUFBTSxZQUFJLElBQU8sTUFBSyxxQkFBZ0IsS0FBQSwwREFBQTtJQUNyQztXQUNFLElBQU0sS0FBSSxLQUNSLElBQUEsSUFBQSxLQUFBO2FBRUgsaUJBQUEsUUFBQSxTQUFBLE9BQUEsVUFBQSxZQUFBLE9BQUEsTUFBQSxZQUFBLFlBQUE7QUFFRixXQUFBLGlCQUFBLE9BQUEsUUFBQSxJQUFBLEtBQUEsTUFBQSxRQUFBLENBQUE7U0FBTTtBQUVMLFVBQU0sSUFBQSxNQUFBLGdHQUFBOzs7QUFuQlA7OztBQ1ZILElBQU0sV0FBVztBQU9kLFNBQUEsUUFBQSxPQUFBO0FBQ0gsU0FBUyxPQUFRLFVBQWMsWUFBQSxVQUFBLFFBQUEsVUFBQSxTQUFBLGFBQUE7O0FBRDVCO0FBUUYsSUFBQSxjQUFBO0VBRUQsNEJBQUE7OztFQUdHLG9DQUFBO0VBQ0gsMkJBQTJCO0VBQ3pCLDRCQUE0QjtFQUM1QiwrQkFBK0I7RUFDL0IsZUFBQTtFQUNBLHFCQUFBO0VBQ0EsbUJBQUE7RUFDQSxxQkFBQTtFQUNBLHlCQUFBO0VBQ0EsMkJBQWU7OztFQWpDakI7Ozs7Ozs7OztNQWtFRyxPQUFBLFNBQUE7SUFDRyxDQUFBO0FBQ0ssU0FBZ0IsUUFBQSxTQUFBO0FBRXpCLFFBQUEsU0FBWSxpQkFBK0MsT0FBQTtBQUN6RCxXQUFNLFFBQVUsR0FBQSxLQUFTLEtBQUk7YUFBQSxRQUFBLE1BQUEsS0FBQTs7O1NBRzdCLEdBQU0sT0FBTztBQUNiLFdBQUssUUFBUSxLQUFPLEtBQUUsTUFBTSxTQUFBOzs7QUF5VzVCLElBQU0sb0JBQU4sY0FBNEIsY0FBbUI7RUFwYm5ELE9Bb2JtRDs7Ozs7O0VBS2pEO2NBQ1MsT0FBUSxrQkFBZ0I7QUFDaEMsVUFBQSxlQUFBLEtBQUEsMENBQUEsbUJBQUEsVUFBQSxnQkFBQSxPQUFBLEVBQUEsSUFBQTtNQUNGLE1BQUEsWUFBQTtJQUVELENBQUE7Ozs7OztFQU1HO0VBQ0gsT0FBTSxHQUFPLE9BQUE7QUFDWCxXQUFjLFFBQUEsS0FBQSxLQUFBLE1BQUEsU0FBQTtFQUNkOztBQXFPQyxJQUFBLGFBQUEsY0FBQSxNQUFBO0VBNXFCSCxPQTRxQkc7OztFQUNILFFBQU07RUFDSyxZQUFBLFNBQXVCO0FBQ3ZCLFVBQUEsT0FBeUI7QUFFbEMsU0FBQSxPQUFZOztZQUdOLE9BQUE7QUFFSixXQUFLLFFBQU8sS0FBQSxLQUFBLE1BQUEsU0FBdUI7OztBQU9wQyxJQUFBLGlCQUFBLGNBQUEsTUFBQTtFQTdyQkgsT0E2ckJHOzs7Ozs7Ozs7QUFPQSxTQUFBLE9BQUE7QUFDRyxRQUFBLFFBQU8sZUFBbUIsUUFBSztBQUMzQixXQUFLLGFBQUEsb0JBQUEsUUFBQSxVQUFBO0lBRWIsT0FBQTtBQUVNLFdBQUssYUFBRyxJQUFhLEtBQUEsS0FBQSxJQUFBLElBQUEsR0FBQTtJQUMxQjtFQUVEO1NBQ0UsR0FBQSxPQUFPO0FBQ1IsV0FBQSxRQUFBLEtBQUEsS0FBQSxNQUFBLFNBQUE7RUFDRjtBQVdEO3NCQXVCbUIsdUJBQU0sSUFBSSw4QkFBZ0M7SUFDMUQsc0JBQUEsdUJBQUEsSUFBQSxrQ0FBQTtJQUNGLDBCQUFBLHVCQUFBLElBQUEscUNBQUE7QUFFRCxJQUFBLE9BQU8sZUFBTSxhQUF3QjtBQUdyQyxNQUFPLENBQUUsT0FBQSxPQUFBLFlBQTBDLGVBQWtCLEdBQUM7QUFFdEUsV0FBQSxlQUFBLFlBQUEsaUJBQUE7TUFDQSxPQUFBO01BQ0EsVUFBQTtNQUNFLFlBQUE7TUFDRixjQUFBO0lBQ0EsQ0FBQTtFQUNBO0FBQ0EsTUFBQSxDQUFBLE9BQUEsT0FBQSxZQUFBLG1CQUFBLEdBQUE7QUFDQSxXQUFBLGVBQUEsWUFBQSxxQkFBMkM7TUFDekMsT0FBQTtNQUNGLFVBQUE7TUFDQSxZQUFBO01BQ0EsY0FBQTtJQUNBLENBQUE7RUFDQTtBQUNFLE1BQUEsQ0FBQSxPQUFBLE9BQUEsWUFBQSx1QkFBQSxHQUFBO0FBQ0YsV0FBQSxlQUFBLFlBQUEseUJBQUE7TUFDQSxPQUFBO01BQ00sVUFBZTtNQUNmLFlBQUE7TUFDQSxjQUFBO0lBSUYsQ0FBQTtFQUNGOzs7O0FDeHdCQyxJQUFBLFFBQUEsV0FBQSx1QkFBQSxJQUFBLG1CQUFBLENBQUEsRUFBQSw2QkFBQTs7O0FDVkgsZUFBc0IsY0FBYyxrQkFBa0I7QUFDbEQsTUFBSTtBQUNBLFVBQU0sV0FBVyxnQkFBZ0I7QUFBQSxFQUNyQyxTQUFTLE9BQU87QUFDWixRQUFJLGlCQUFpQixXQUFZLFFBQU8sTUFBTSxVQUFVLGdCQUFnQjtBQUN4RSxVQUFNO0FBQUEsRUFDVjtBQUNBLE1BQUk7QUFDSixNQUFJO0FBQ0EsdUJBQW1CLE1BQU0sZUFBZSxnQkFBZ0I7QUFBQSxFQUM1RCxTQUFTLE9BQU87QUFDWixRQUFJLGlCQUFpQixXQUFZLFFBQU8sTUFBTSxVQUFVLGdCQUFnQjtBQUN4RSxVQUFNO0FBQUEsRUFDVjtBQUNBLE1BQUkscUJBQXFCLGVBQWUscUJBQXFCLFVBQVU7QUFDbkUsV0FBTztBQUFBLE1BQ0g7QUFBQSxNQUNBLGdCQUFnQjtBQUFBLElBQ3BCO0FBQUEsRUFDSjtBQUNBLE1BQUkscUJBQXFCLFdBQVc7QUFDaEMsV0FBTyxNQUFNLFVBQVUsZ0JBQWdCO0FBQUEsRUFDM0M7QUFDQSxNQUFJO0FBQ0EsVUFBTSxjQUFjLGdCQUFnQjtBQUFBLEVBQ3hDLFNBQVMsT0FBTztBQUNaLFFBQUksaUJBQWlCLGVBQWdCLE9BQU07QUFDM0MsV0FBTyxNQUFNLFVBQVUsZ0JBQWdCO0FBQUEsRUFDM0M7QUFDQSxTQUFPLE1BQU0sY0FBYyxnQkFBZ0I7QUFDL0M7QUE5QnNCO0FBK0J0QixjQUFjLGFBQWE7QUFDM0IsV0FBVyxvQkFBb0IsSUFBSSwwREFBMEQsYUFBYTtBQUMxRyxJQUFJLGFBQWEsV0FBVyx1QkFBTyxJQUFJLG1CQUFtQixDQUFDLEVBQUUsaURBQWlEO0FBQzlHLElBQUksaUJBQWlCLFdBQVcsdUJBQU8sSUFBSSxtQkFBbUIsQ0FBQyxFQUFFLHFEQUFxRDtBQUN0SCxJQUFJLGdCQUFnQixXQUFXLHVCQUFPLElBQUksbUJBQW1CLENBQUMsRUFBRSxvREFBb0Q7QUFDcEgsY0FBYyxhQUFhO0FBQzNCLElBQUksZ0JBQWdCLFdBQVcsdUJBQU8sSUFBSSxtQkFBbUIsQ0FBQyxFQUFFLG9EQUFvRDtBQUNwSCxJQUFJLFlBQVksV0FBVyx1QkFBTyxJQUFJLG1CQUFtQixDQUFDLEVBQUUsZ0RBQWdEOzs7QUN4QzVHO0FBQUEsRUFDQztBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUNEOzs7QUM3R0EsSUFBT0MsMkJBQVE7OztBQ2dCZixJQUFBLGVBQUFDLHlCQUFBLEtBQUEsR0FBQTtBQUdBLElBQUEseUJBQUEsSUFBQSxPQUFBLGdDQUF3RSxZQUFBLDBEQUFBLFlBQUEsOEJBQUEsR0FBQTsiLAogICJuYW1lcyI6IFsibW9kdWxlIiwgIm1zIiwgIm1zIiwgImJ1aWx0aW5fbW9kdWxlc19kZWZhdWx0IiwgImJ1aWx0aW5fbW9kdWxlc19kZWZhdWx0Il0KfQo=
`;

export const POST = workflowEntrypoint(workflowCode);
export const GET = POST;
export const HEAD = POST;
export const OPTIONS = POST;