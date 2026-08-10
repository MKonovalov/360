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
      const persisted = await persistGroundedPacket(applicationRunId, normalized.packet);
      if (!persisted.ok) {
        const failed = await recordFailure(applicationRunId, "execution_failed");
        if (failed.ok) return {
          applicationRunId,
          terminalStatus: "failed"
        };
        return await observeAuthoritativeState(applicationRunId);
      }
      await recordTelemetryAfterPersistence(applicationRunId, execution.execution, normalized.packet);
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
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsibm9kZV9tb2R1bGVzL21zL2luZGV4LmpzIiwgInNyYy93b3JrZmxvd3MvYW5hbHlzaXNSdW4udHMiLCAibm9kZV9tb2R1bGVzL0B3b3JrZmxvdy91dGlscy9zcmMvdGltZS50cyIsICJub2RlX21vZHVsZXMvQHdvcmtmbG93L2Vycm9ycy9zcmMvaW5kZXgudHMiLCAibm9kZV9tb2R1bGVzL3dvcmtmbG93L3NyYy9zdGRsaWIudHMiLCAic3JjL3dvcmtmbG93cy93b3JrZmxvd1Byb29mLnRzIiwgIm5vZGVfbW9kdWxlcy9idWlsdGluLW1vZHVsZXMvYnVpbHRpbi1tb2R1bGVzLmpzb24iLCAibm9kZV9tb2R1bGVzL2J1aWx0aW4tbW9kdWxlcy9pbmRleC5qcyIsICJub2RlX21vZHVsZXMvQHdvcmtmbG93L2J1aWxkZXJzL3NyYy9zZXJkZS1jaGVja2VyLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKipcbiAqIEhlbHBlcnMuXG4gKi8gdmFyIHMgPSAxMDAwO1xudmFyIG0gPSBzICogNjA7XG52YXIgaCA9IG0gKiA2MDtcbnZhciBkID0gaCAqIDI0O1xudmFyIHcgPSBkICogNztcbnZhciB5ID0gZCAqIDM2NS4yNTtcbi8qKlxuICogUGFyc2Ugb3IgZm9ybWF0IHRoZSBnaXZlbiBgdmFsYC5cbiAqXG4gKiBPcHRpb25zOlxuICpcbiAqICAtIGBsb25nYCB2ZXJib3NlIGZvcm1hdHRpbmcgW2ZhbHNlXVxuICpcbiAqIEBwYXJhbSB7U3RyaW5nfE51bWJlcn0gdmFsXG4gKiBAcGFyYW0ge09iamVjdH0gW29wdGlvbnNdXG4gKiBAdGhyb3dzIHtFcnJvcn0gdGhyb3cgYW4gZXJyb3IgaWYgdmFsIGlzIG5vdCBhIG5vbi1lbXB0eSBzdHJpbmcgb3IgYSBudW1iZXJcbiAqIEByZXR1cm4ge1N0cmluZ3xOdW1iZXJ9XG4gKiBAYXBpIHB1YmxpY1xuICovIG1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24odmFsLCBvcHRpb25zKSB7XG4gICAgb3B0aW9ucyA9IG9wdGlvbnMgfHwge307XG4gICAgdmFyIHR5cGUgPSB0eXBlb2YgdmFsO1xuICAgIGlmICh0eXBlID09PSAnc3RyaW5nJyAmJiB2YWwubGVuZ3RoID4gMCkge1xuICAgICAgICByZXR1cm4gcGFyc2UodmFsKTtcbiAgICB9IGVsc2UgaWYgKHR5cGUgPT09ICdudW1iZXInICYmIGlzRmluaXRlKHZhbCkpIHtcbiAgICAgICAgcmV0dXJuIG9wdGlvbnMubG9uZyA/IGZtdExvbmcodmFsKSA6IGZtdFNob3J0KHZhbCk7XG4gICAgfVxuICAgIHRocm93IG5ldyBFcnJvcigndmFsIGlzIG5vdCBhIG5vbi1lbXB0eSBzdHJpbmcgb3IgYSB2YWxpZCBudW1iZXIuIHZhbD0nICsgSlNPTi5zdHJpbmdpZnkodmFsKSk7XG59O1xuLyoqXG4gKiBQYXJzZSB0aGUgZ2l2ZW4gYHN0cmAgYW5kIHJldHVybiBtaWxsaXNlY29uZHMuXG4gKlxuICogQHBhcmFtIHtTdHJpbmd9IHN0clxuICogQHJldHVybiB7TnVtYmVyfVxuICogQGFwaSBwcml2YXRlXG4gKi8gZnVuY3Rpb24gcGFyc2Uoc3RyKSB7XG4gICAgc3RyID0gU3RyaW5nKHN0cik7XG4gICAgaWYgKHN0ci5sZW5ndGggPiAxMDApIHtcbiAgICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICB2YXIgbWF0Y2ggPSAvXigtPyg/OlxcZCspP1xcLj9cXGQrKSAqKG1pbGxpc2Vjb25kcz98bXNlY3M/fG1zfHNlY29uZHM/fHNlY3M/fHN8bWludXRlcz98bWlucz98bXxob3Vycz98aHJzP3xofGRheXM/fGR8d2Vla3M/fHd8eWVhcnM/fHlycz98eSk/JC9pLmV4ZWMoc3RyKTtcbiAgICBpZiAoIW1hdGNoKSB7XG4gICAgICAgIHJldHVybjtcbiAgICB9XG4gICAgdmFyIG4gPSBwYXJzZUZsb2F0KG1hdGNoWzFdKTtcbiAgICB2YXIgdHlwZSA9IChtYXRjaFsyXSB8fCAnbXMnKS50b0xvd2VyQ2FzZSgpO1xuICAgIHN3aXRjaCh0eXBlKXtcbiAgICAgICAgY2FzZSAneWVhcnMnOlxuICAgICAgICBjYXNlICd5ZWFyJzpcbiAgICAgICAgY2FzZSAneXJzJzpcbiAgICAgICAgY2FzZSAneXInOlxuICAgICAgICBjYXNlICd5JzpcbiAgICAgICAgICAgIHJldHVybiBuICogeTtcbiAgICAgICAgY2FzZSAnd2Vla3MnOlxuICAgICAgICBjYXNlICd3ZWVrJzpcbiAgICAgICAgY2FzZSAndyc6XG4gICAgICAgICAgICByZXR1cm4gbiAqIHc7XG4gICAgICAgIGNhc2UgJ2RheXMnOlxuICAgICAgICBjYXNlICdkYXknOlxuICAgICAgICBjYXNlICdkJzpcbiAgICAgICAgICAgIHJldHVybiBuICogZDtcbiAgICAgICAgY2FzZSAnaG91cnMnOlxuICAgICAgICBjYXNlICdob3VyJzpcbiAgICAgICAgY2FzZSAnaHJzJzpcbiAgICAgICAgY2FzZSAnaHInOlxuICAgICAgICBjYXNlICdoJzpcbiAgICAgICAgICAgIHJldHVybiBuICogaDtcbiAgICAgICAgY2FzZSAnbWludXRlcyc6XG4gICAgICAgIGNhc2UgJ21pbnV0ZSc6XG4gICAgICAgIGNhc2UgJ21pbnMnOlxuICAgICAgICBjYXNlICdtaW4nOlxuICAgICAgICBjYXNlICdtJzpcbiAgICAgICAgICAgIHJldHVybiBuICogbTtcbiAgICAgICAgY2FzZSAnc2Vjb25kcyc6XG4gICAgICAgIGNhc2UgJ3NlY29uZCc6XG4gICAgICAgIGNhc2UgJ3NlY3MnOlxuICAgICAgICBjYXNlICdzZWMnOlxuICAgICAgICBjYXNlICdzJzpcbiAgICAgICAgICAgIHJldHVybiBuICogcztcbiAgICAgICAgY2FzZSAnbWlsbGlzZWNvbmRzJzpcbiAgICAgICAgY2FzZSAnbWlsbGlzZWNvbmQnOlxuICAgICAgICBjYXNlICdtc2Vjcyc6XG4gICAgICAgIGNhc2UgJ21zZWMnOlxuICAgICAgICBjYXNlICdtcyc6XG4gICAgICAgICAgICByZXR1cm4gbjtcbiAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICAgIHJldHVybiB1bmRlZmluZWQ7XG4gICAgfVxufVxuLyoqXG4gKiBTaG9ydCBmb3JtYXQgZm9yIGBtc2AuXG4gKlxuICogQHBhcmFtIHtOdW1iZXJ9IG1zXG4gKiBAcmV0dXJuIHtTdHJpbmd9XG4gKiBAYXBpIHByaXZhdGVcbiAqLyBmdW5jdGlvbiBmbXRTaG9ydChtcykge1xuICAgIHZhciBtc0FicyA9IE1hdGguYWJzKG1zKTtcbiAgICBpZiAobXNBYnMgPj0gZCkge1xuICAgICAgICByZXR1cm4gTWF0aC5yb3VuZChtcyAvIGQpICsgJ2QnO1xuICAgIH1cbiAgICBpZiAobXNBYnMgPj0gaCkge1xuICAgICAgICByZXR1cm4gTWF0aC5yb3VuZChtcyAvIGgpICsgJ2gnO1xuICAgIH1cbiAgICBpZiAobXNBYnMgPj0gbSkge1xuICAgICAgICByZXR1cm4gTWF0aC5yb3VuZChtcyAvIG0pICsgJ20nO1xuICAgIH1cbiAgICBpZiAobXNBYnMgPj0gcykge1xuICAgICAgICByZXR1cm4gTWF0aC5yb3VuZChtcyAvIHMpICsgJ3MnO1xuICAgIH1cbiAgICByZXR1cm4gbXMgKyAnbXMnO1xufVxuLyoqXG4gKiBMb25nIGZvcm1hdCBmb3IgYG1zYC5cbiAqXG4gKiBAcGFyYW0ge051bWJlcn0gbXNcbiAqIEByZXR1cm4ge1N0cmluZ31cbiAqIEBhcGkgcHJpdmF0ZVxuICovIGZ1bmN0aW9uIGZtdExvbmcobXMpIHtcbiAgICB2YXIgbXNBYnMgPSBNYXRoLmFicyhtcyk7XG4gICAgaWYgKG1zQWJzID49IGQpIHtcbiAgICAgICAgcmV0dXJuIHBsdXJhbChtcywgbXNBYnMsIGQsICdkYXknKTtcbiAgICB9XG4gICAgaWYgKG1zQWJzID49IGgpIHtcbiAgICAgICAgcmV0dXJuIHBsdXJhbChtcywgbXNBYnMsIGgsICdob3VyJyk7XG4gICAgfVxuICAgIGlmIChtc0FicyA+PSBtKSB7XG4gICAgICAgIHJldHVybiBwbHVyYWwobXMsIG1zQWJzLCBtLCAnbWludXRlJyk7XG4gICAgfVxuICAgIGlmIChtc0FicyA+PSBzKSB7XG4gICAgICAgIHJldHVybiBwbHVyYWwobXMsIG1zQWJzLCBzLCAnc2Vjb25kJyk7XG4gICAgfVxuICAgIHJldHVybiBtcyArICcgbXMnO1xufVxuLyoqXG4gKiBQbHVyYWxpemF0aW9uIGhlbHBlci5cbiAqLyBmdW5jdGlvbiBwbHVyYWwobXMsIG1zQWJzLCBuLCBuYW1lKSB7XG4gICAgdmFyIGlzUGx1cmFsID0gbXNBYnMgPj0gbiAqIDEuNTtcbiAgICByZXR1cm4gTWF0aC5yb3VuZChtcyAvIG4pICsgJyAnICsgbmFtZSArIChpc1BsdXJhbCA/ICdzJyA6ICcnKTtcbn1cbiIsICIvKipfX2ludGVybmFsX3dvcmtmbG93c3tcIndvcmtmbG93c1wiOntcInNyYy93b3JrZmxvd3MvYW5hbHlzaXNSdW4udHNcIjp7XCJhbmFseXNpc1J1blwiOntcIndvcmtmbG93SWRcIjpcIndvcmtmbG93Ly8uL3NyYy93b3JrZmxvd3MvYW5hbHlzaXNSdW4vL2FuYWx5c2lzUnVuXCJ9fX0sXCJzdGVwc1wiOntcInNyYy93b3JrZmxvd3MvYW5hbHlzaXNSdW4udHNcIjp7XCJjbGFpbVF1ZXVlZFJ1blwiOntcInN0ZXBJZFwiOlwic3RlcC8vLi9zcmMvd29ya2Zsb3dzL2FuYWx5c2lzUnVuLy9jbGFpbVF1ZXVlZFJ1blwifSxcImNvbXBsZXRlUGVyc2lzdGVkUnVuXCI6e1wic3RlcElkXCI6XCJzdGVwLy8uL3NyYy93b3JrZmxvd3MvYW5hbHlzaXNSdW4vL2NvbXBsZXRlUGVyc2lzdGVkUnVuXCJ9LFwiZXhlY3V0ZUdyb3VuZGVkQW5hbHlzaXNcIjp7XCJzdGVwSWRcIjpcInN0ZXAvLy4vc3JjL3dvcmtmbG93cy9hbmFseXNpc1J1bi8vZXhlY3V0ZUdyb3VuZGVkQW5hbHlzaXNcIn0sXCJsb2FkUnVuXCI6e1wic3RlcElkXCI6XCJzdGVwLy8uL3NyYy93b3JrZmxvd3MvYW5hbHlzaXNSdW4vL2xvYWRSdW5cIn0sXCJub3JtYWxpemVHcm91bmRlZFBhY2tldFwiOntcInN0ZXBJZFwiOlwic3RlcC8vLi9zcmMvd29ya2Zsb3dzL2FuYWx5c2lzUnVuLy9ub3JtYWxpemVHcm91bmRlZFBhY2tldFwifSxcIm9ic2VydmVBdXRob3JpdGF0aXZlU3RhdGVcIjp7XCJzdGVwSWRcIjpcInN0ZXAvLy4vc3JjL3dvcmtmbG93cy9hbmFseXNpc1J1bi8vb2JzZXJ2ZUF1dGhvcml0YXRpdmVTdGF0ZVwifSxcInBlcnNpc3RHcm91bmRlZFBhY2tldFwiOntcInN0ZXBJZFwiOlwic3RlcC8vLi9zcmMvd29ya2Zsb3dzL2FuYWx5c2lzUnVuLy9wZXJzaXN0R3JvdW5kZWRQYWNrZXRcIn0sXCJyZWNvbmNpbGVDb21wbGV0ZWRSdW5cIjp7XCJzdGVwSWRcIjpcInN0ZXAvLy4vc3JjL3dvcmtmbG93cy9hbmFseXNpc1J1bi8vcmVjb25jaWxlQ29tcGxldGVkUnVuXCJ9LFwicmVjb3JkQ2FuY2VsbGVkUnVuXCI6e1wic3RlcElkXCI6XCJzdGVwLy8uL3NyYy93b3JrZmxvd3MvYW5hbHlzaXNSdW4vL3JlY29yZENhbmNlbGxlZFJ1blwifSxcInJlY29yZEZhaWx1cmVcIjp7XCJzdGVwSWRcIjpcInN0ZXAvLy4vc3JjL3dvcmtmbG93cy9hbmFseXNpc1J1bi8vcmVjb3JkRmFpbHVyZVwifSxcInJlY29yZFRlbGVtZXRyeUFmdGVyUGVyc2lzdGVuY2VcIjp7XCJzdGVwSWRcIjpcInN0ZXAvLy4vc3JjL3dvcmtmbG93cy9hbmFseXNpc1J1bi8vcmVjb3JkVGVsZW1ldHJ5QWZ0ZXJQZXJzaXN0ZW5jZVwifX19fSovO1xuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGFuYWx5c2lzUnVuKGFwcGxpY2F0aW9uUnVuSWQpIHtcbiAgICBjb25zdCBjdXJyZW50ID0gYXdhaXQgbG9hZFJ1bihhcHBsaWNhdGlvblJ1bklkKTtcbiAgICBpZiAoY3VycmVudC5zdGF0dXMgPT09ICdxdWV1ZWQnKSB7XG4gICAgICAgIGNvbnN0IGNsYWltID0gYXdhaXQgY2xhaW1RdWV1ZWRSdW4oYXBwbGljYXRpb25SdW5JZCk7XG4gICAgICAgIGlmIChjbGFpbS5vaykge1xuICAgICAgICAgICAgY29uc3QgZXhlY3V0aW9uID0gYXdhaXQgZXhlY3V0ZUdyb3VuZGVkQW5hbHlzaXMoYXBwbGljYXRpb25SdW5JZCk7XG4gICAgICAgICAgICBpZiAoIWV4ZWN1dGlvbi5vaykge1xuICAgICAgICAgICAgICAgIGNvbnN0IGZhaWxlZCA9IGF3YWl0IHJlY29yZEZhaWx1cmUoYXBwbGljYXRpb25SdW5JZCwgZXhlY3V0aW9uLnNhZmVSZWFzb24pO1xuICAgICAgICAgICAgICAgIGlmIChmYWlsZWQub2spIHJldHVybiB7XG4gICAgICAgICAgICAgICAgICAgIGFwcGxpY2F0aW9uUnVuSWQsXG4gICAgICAgICAgICAgICAgICAgIHRlcm1pbmFsU3RhdHVzOiAnZmFpbGVkJ1xuICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICAgICAgcmV0dXJuIGF3YWl0IG9ic2VydmVBdXRob3JpdGF0aXZlU3RhdGUoYXBwbGljYXRpb25SdW5JZCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBjb25zdCBub3JtYWxpemVkID0gYXdhaXQgbm9ybWFsaXplR3JvdW5kZWRQYWNrZXQoYXBwbGljYXRpb25SdW5JZCwgZXhlY3V0aW9uLmV4ZWN1dGlvbik7XG4gICAgICAgICAgICBpZiAoIW5vcm1hbGl6ZWQub2spIHtcbiAgICAgICAgICAgICAgICBjb25zdCBmYWlsZWQgPSBhd2FpdCByZWNvcmRGYWlsdXJlKGFwcGxpY2F0aW9uUnVuSWQsICdleGVjdXRpb25fZmFpbGVkJyk7XG4gICAgICAgICAgICAgICAgaWYgKGZhaWxlZC5vaykgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICAgICAgYXBwbGljYXRpb25SdW5JZCxcbiAgICAgICAgICAgICAgICAgICAgdGVybWluYWxTdGF0dXM6ICdmYWlsZWQnXG4gICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgICAgICByZXR1cm4gYXdhaXQgb2JzZXJ2ZUF1dGhvcml0YXRpdmVTdGF0ZShhcHBsaWNhdGlvblJ1bklkKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGNvbnN0IHBlcnNpc3RlZCA9IGF3YWl0IHBlcnNpc3RHcm91bmRlZFBhY2tldChhcHBsaWNhdGlvblJ1bklkLCBub3JtYWxpemVkLnBhY2tldCk7XG4gICAgICAgICAgICBpZiAoIXBlcnNpc3RlZC5vaykge1xuICAgICAgICAgICAgICAgIGNvbnN0IGZhaWxlZCA9IGF3YWl0IHJlY29yZEZhaWx1cmUoYXBwbGljYXRpb25SdW5JZCwgJ2V4ZWN1dGlvbl9mYWlsZWQnKTtcbiAgICAgICAgICAgICAgICBpZiAoZmFpbGVkLm9rKSByZXR1cm4ge1xuICAgICAgICAgICAgICAgICAgICBhcHBsaWNhdGlvblJ1bklkLFxuICAgICAgICAgICAgICAgICAgICB0ZXJtaW5hbFN0YXR1czogJ2ZhaWxlZCdcbiAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgICAgIHJldHVybiBhd2FpdCBvYnNlcnZlQXV0aG9yaXRhdGl2ZVN0YXRlKGFwcGxpY2F0aW9uUnVuSWQpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgYXdhaXQgcmVjb3JkVGVsZW1ldHJ5QWZ0ZXJQZXJzaXN0ZW5jZShhcHBsaWNhdGlvblJ1bklkLCBleGVjdXRpb24uZXhlY3V0aW9uLCBub3JtYWxpemVkLnBhY2tldCk7XG4gICAgICAgICAgICBjb25zdCBjb21wbGV0ZWQgPSBhd2FpdCBjb21wbGV0ZVBlcnNpc3RlZFJ1bihhcHBsaWNhdGlvblJ1bklkKTtcbiAgICAgICAgICAgIGlmIChjb21wbGV0ZWQub2spIHtcbiAgICAgICAgICAgICAgICBhd2FpdCByZWNvbmNpbGVDb21wbGV0ZWRSdW4oYXBwbGljYXRpb25SdW5JZCk7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICAgICAgYXBwbGljYXRpb25SdW5JZCxcbiAgICAgICAgICAgICAgICAgICAgdGVybWluYWxTdGF0dXM6ICdjb21wbGV0ZWQnXG4gICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gYXdhaXQgb2JzZXJ2ZUF1dGhvcml0YXRpdmVTdGF0ZShhcHBsaWNhdGlvblJ1bklkKTtcbiAgICB9XG4gICAgaWYgKGN1cnJlbnQuc3RhdHVzID09PSAncnVubmluZycpIHtcbiAgICAgICAgY29uc3QgdGltZW91dFNlY29uZHMgPSBjdXJyZW50LnBvbGljeVNuYXBzaG90Lm1vZGUgPT09ICdwaGFzZTMyX25vb3AnID8gNSA6IGN1cnJlbnQucG9saWN5U25hcHNob3QuZWZmZWN0aXZlTWF4RXhlY3V0aW9uU2Vjb25kcztcbiAgICAgICAgY29uc3Qgd2luZG93RXhwaXJlZCA9IGN1cnJlbnQuc3RhcnRlZEF0ICE9PSBudWxsICYmIERhdGUubm93KCkgLSBjdXJyZW50LnN0YXJ0ZWRBdC5nZXRUaW1lKCkgPiB0aW1lb3V0U2Vjb25kcyAqIDFfMDAwO1xuICAgICAgICBjb25zdCB0ZXJtaW5hbCA9IHdpbmRvd0V4cGlyZWQgPyBhd2FpdCByZWNvcmRGYWlsdXJlKGFwcGxpY2F0aW9uUnVuSWQsICd0aW1lZF9vdXQnKSA6IGF3YWl0IHJlY29yZENhbmNlbGxlZFJ1bihhcHBsaWNhdGlvblJ1bklkKTtcbiAgICAgICAgaWYgKHRlcm1pbmFsLm9rKSByZXR1cm4ge1xuICAgICAgICAgICAgYXBwbGljYXRpb25SdW5JZCxcbiAgICAgICAgICAgIHRlcm1pbmFsU3RhdHVzOiB3aW5kb3dFeHBpcmVkID8gJ2ZhaWxlZCcgOiAnY2FuY2VsbGVkJ1xuICAgICAgICB9O1xuICAgIH1cbiAgICByZXR1cm4gYXdhaXQgb2JzZXJ2ZUF1dGhvcml0YXRpdmVTdGF0ZShhcHBsaWNhdGlvblJ1bklkKTtcbn1cbmFuYWx5c2lzUnVuLndvcmtmbG93SWQgPSBcIndvcmtmbG93Ly8uL3NyYy93b3JrZmxvd3MvYW5hbHlzaXNSdW4vL2FuYWx5c2lzUnVuXCI7XG5nbG9iYWxUaGlzLl9fcHJpdmF0ZV93b3JrZmxvd3Muc2V0KFwid29ya2Zsb3cvLy4vc3JjL3dvcmtmbG93cy9hbmFseXNpc1J1bi8vYW5hbHlzaXNSdW5cIiwgYW5hbHlzaXNSdW4pO1xudmFyIGxvYWRSdW4gPSBnbG9iYWxUaGlzW1N5bWJvbC5mb3IoXCJXT1JLRkxPV19VU0VfU1RFUFwiKV0oXCJzdGVwLy8uL3NyYy93b3JrZmxvd3MvYW5hbHlzaXNSdW4vL2xvYWRSdW5cIik7XG52YXIgY2xhaW1RdWV1ZWRSdW4gPSBnbG9iYWxUaGlzW1N5bWJvbC5mb3IoXCJXT1JLRkxPV19VU0VfU1RFUFwiKV0oXCJzdGVwLy8uL3NyYy93b3JrZmxvd3MvYW5hbHlzaXNSdW4vL2NsYWltUXVldWVkUnVuXCIpO1xudmFyIGV4ZWN1dGVHcm91bmRlZEFuYWx5c2lzID0gZ2xvYmFsVGhpc1tTeW1ib2wuZm9yKFwiV09SS0ZMT1dfVVNFX1NURVBcIildKFwic3RlcC8vLi9zcmMvd29ya2Zsb3dzL2FuYWx5c2lzUnVuLy9leGVjdXRlR3JvdW5kZWRBbmFseXNpc1wiKTtcbnZhciBub3JtYWxpemVHcm91bmRlZFBhY2tldCA9IGdsb2JhbFRoaXNbU3ltYm9sLmZvcihcIldPUktGTE9XX1VTRV9TVEVQXCIpXShcInN0ZXAvLy4vc3JjL3dvcmtmbG93cy9hbmFseXNpc1J1bi8vbm9ybWFsaXplR3JvdW5kZWRQYWNrZXRcIik7XG52YXIgcGVyc2lzdEdyb3VuZGVkUGFja2V0ID0gZ2xvYmFsVGhpc1tTeW1ib2wuZm9yKFwiV09SS0ZMT1dfVVNFX1NURVBcIildKFwic3RlcC8vLi9zcmMvd29ya2Zsb3dzL2FuYWx5c2lzUnVuLy9wZXJzaXN0R3JvdW5kZWRQYWNrZXRcIik7XG52YXIgcmVjb3JkVGVsZW1ldHJ5QWZ0ZXJQZXJzaXN0ZW5jZSA9IGdsb2JhbFRoaXNbU3ltYm9sLmZvcihcIldPUktGTE9XX1VTRV9TVEVQXCIpXShcInN0ZXAvLy4vc3JjL3dvcmtmbG93cy9hbmFseXNpc1J1bi8vcmVjb3JkVGVsZW1ldHJ5QWZ0ZXJQZXJzaXN0ZW5jZVwiKTtcbnZhciBjb21wbGV0ZVBlcnNpc3RlZFJ1biA9IGdsb2JhbFRoaXNbU3ltYm9sLmZvcihcIldPUktGTE9XX1VTRV9TVEVQXCIpXShcInN0ZXAvLy4vc3JjL3dvcmtmbG93cy9hbmFseXNpc1J1bi8vY29tcGxldGVQZXJzaXN0ZWRSdW5cIik7XG52YXIgcmVjb25jaWxlQ29tcGxldGVkUnVuID0gZ2xvYmFsVGhpc1tTeW1ib2wuZm9yKFwiV09SS0ZMT1dfVVNFX1NURVBcIildKFwic3RlcC8vLi9zcmMvd29ya2Zsb3dzL2FuYWx5c2lzUnVuLy9yZWNvbmNpbGVDb21wbGV0ZWRSdW5cIik7XG52YXIgcmVjb3JkRmFpbHVyZSA9IGdsb2JhbFRoaXNbU3ltYm9sLmZvcihcIldPUktGTE9XX1VTRV9TVEVQXCIpXShcInN0ZXAvLy4vc3JjL3dvcmtmbG93cy9hbmFseXNpc1J1bi8vcmVjb3JkRmFpbHVyZVwiKTtcbnZhciByZWNvcmRDYW5jZWxsZWRSdW4gPSBnbG9iYWxUaGlzW1N5bWJvbC5mb3IoXCJXT1JLRkxPV19VU0VfU1RFUFwiKV0oXCJzdGVwLy8uL3NyYy93b3JrZmxvd3MvYW5hbHlzaXNSdW4vL3JlY29yZENhbmNlbGxlZFJ1blwiKTtcbnZhciBvYnNlcnZlQXV0aG9yaXRhdGl2ZVN0YXRlID0gZ2xvYmFsVGhpc1tTeW1ib2wuZm9yKFwiV09SS0ZMT1dfVVNFX1NURVBcIildKFwic3RlcC8vLi9zcmMvd29ya2Zsb3dzL2FuYWx5c2lzUnVuLy9vYnNlcnZlQXV0aG9yaXRhdGl2ZVN0YXRlXCIpO1xuIiwgImltcG9ydCB0eXBlIHsgU3RyaW5nVmFsdWUgfSBmcm9tICdtcyc7XG5pbXBvcnQgbXMgZnJvbSAnbXMnO1xuXG4vKipcbiAqIFBhcnNlcyBhIGR1cmF0aW9uIHBhcmFtZXRlciAoc3RyaW5nLCBudW1iZXIsIG9yIERhdGUpIGFuZCByZXR1cm5zIGEgRGF0ZSBvYmplY3RcbiAqIHJlcHJlc2VudGluZyB3aGVuIHRoZSBkdXJhdGlvbiBzaG91bGQgZWxhcHNlLlxuICpcbiAqIC0gRm9yIHN0cmluZ3M6IFBhcnNlcyBkdXJhdGlvbiBzdHJpbmdzIGxpa2UgXCIxc1wiLCBcIjVtXCIsIFwiMWhcIiwgZXRjLiB1c2luZyB0aGUgYG1zYCBsaWJyYXJ5XG4gKiAtIEZvciBudW1iZXJzOiBUcmVhdHMgYXMgbWlsbGlzZWNvbmRzIGZyb20gbm93XG4gKiAtIEZvciBEYXRlIG9iamVjdHM6IFJldHVybnMgdGhlIGRhdGUgZGlyZWN0bHkgKGhhbmRsZXMgYm90aCBEYXRlIGluc3RhbmNlcyBhbmQgZGF0ZS1saWtlIG9iamVjdHMgZnJvbSBkZXNlcmlhbGl6YXRpb24pXG4gKlxuICogQHBhcmFtIHBhcmFtIC0gVGhlIGR1cmF0aW9uIHBhcmFtZXRlciAoU3RyaW5nVmFsdWUsIERhdGUsIG9yIG51bWJlciBvZiBtaWxsaXNlY29uZHMpXG4gKiBAcmV0dXJucyBBIERhdGUgb2JqZWN0IHJlcHJlc2VudGluZyB3aGVuIHRoZSBkdXJhdGlvbiBzaG91bGQgZWxhcHNlXG4gKiBAdGhyb3dzIHtFcnJvcn0gSWYgdGhlIHBhcmFtZXRlciBpcyBpbnZhbGlkIG9yIGNhbm5vdCBiZSBwYXJzZWRcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHBhcnNlRHVyYXRpb25Ub0RhdGUocGFyYW06IFN0cmluZ1ZhbHVlIHwgRGF0ZSB8IG51bWJlcik6IERhdGUge1xuICBpZiAodHlwZW9mIHBhcmFtID09PSAnc3RyaW5nJykge1xuICAgIGNvbnN0IGR1cmF0aW9uTXMgPSBtcyhwYXJhbSk7XG4gICAgaWYgKHR5cGVvZiBkdXJhdGlvbk1zICE9PSAnbnVtYmVyJyB8fCBkdXJhdGlvbk1zIDwgMCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKFxuICAgICAgICBgSW52YWxpZCBkdXJhdGlvbjogXCIke3BhcmFtfVwiLiBFeHBlY3RlZCBhIHZhbGlkIGR1cmF0aW9uIHN0cmluZyBsaWtlIFwiMXNcIiwgXCIxbVwiLCBcIjFoXCIsIGV0Yy5gXG4gICAgICApO1xuICAgIH1cbiAgICByZXR1cm4gbmV3IERhdGUoRGF0ZS5ub3coKSArIGR1cmF0aW9uTXMpO1xuICB9IGVsc2UgaWYgKHR5cGVvZiBwYXJhbSA9PT0gJ251bWJlcicpIHtcbiAgICBpZiAocGFyYW0gPCAwIHx8ICFOdW1iZXIuaXNGaW5pdGUocGFyYW0pKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoXG4gICAgICAgIGBJbnZhbGlkIGR1cmF0aW9uOiAke3BhcmFtfS4gRXhwZWN0ZWQgYSBub24tbmVnYXRpdmUgZmluaXRlIG51bWJlciBvZiBtaWxsaXNlY29uZHMuYFxuICAgICAgKTtcbiAgICB9XG4gICAgcmV0dXJuIG5ldyBEYXRlKERhdGUubm93KCkgKyBwYXJhbSk7XG4gIH0gZWxzZSBpZiAoXG4gICAgcGFyYW0gaW5zdGFuY2VvZiBEYXRlIHx8XG4gICAgKHBhcmFtICYmXG4gICAgICB0eXBlb2YgcGFyYW0gPT09ICdvYmplY3QnICYmXG4gICAgICB0eXBlb2YgKHBhcmFtIGFzIGFueSkuZ2V0VGltZSA9PT0gJ2Z1bmN0aW9uJylcbiAgKSB7XG4gICAgLy8gSGFuZGxlIGJvdGggRGF0ZSBpbnN0YW5jZXMgYW5kIGRhdGUtbGlrZSBvYmplY3RzIChmcm9tIGRlc2VyaWFsaXphdGlvbilcbiAgICByZXR1cm4gcGFyYW0gaW5zdGFuY2VvZiBEYXRlID8gcGFyYW0gOiBuZXcgRGF0ZSgocGFyYW0gYXMgYW55KS5nZXRUaW1lKCkpO1xuICB9IGVsc2Uge1xuICAgIHRocm93IG5ldyBFcnJvcihcbiAgICAgIGBJbnZhbGlkIGR1cmF0aW9uIHBhcmFtZXRlci4gRXhwZWN0ZWQgYSBkdXJhdGlvbiBzdHJpbmcsIG51bWJlciAobWlsbGlzZWNvbmRzKSwgb3IgRGF0ZSBvYmplY3QuYFxuICAgICk7XG4gIH1cbn1cbiIsICJpbXBvcnQgeyBwYXJzZUR1cmF0aW9uVG9EYXRlIH0gZnJvbSAnQHdvcmtmbG93L3V0aWxzJztcbmltcG9ydCB0eXBlIHsgU3RydWN0dXJlZEVycm9yIH0gZnJvbSAnQHdvcmtmbG93L3dvcmxkJztcbmltcG9ydCB0eXBlIHsgU3RyaW5nVmFsdWUgfSBmcm9tICdtcyc7XG5cbmNvbnN0IEJBU0VfVVJMID0gJ2h0dHBzOi8vdXNld29ya2Zsb3cuZGV2L2Vycic7XG5cbi8qKlxuICogQGludGVybmFsXG4gKiBDaGVjayBpZiBhIHZhbHVlIGlzIGFuIEVycm9yIHdpdGhvdXQgcmVseWluZyBvbiBOb2RlLmpzIHV0aWxpdGllcy5cbiAqIFRoaXMgaXMgbmVlZGVkIGZvciBlcnJvciBjbGFzc2VzIHRoYXQgY2FuIGJlIHVzZWQgaW4gVk0gY29udGV4dHMgd2hlcmVcbiAqIE5vZGUuanMgaW1wb3J0cyBhcmUgbm90IGF2YWlsYWJsZS5cbiAqL1xuZnVuY3Rpb24gaXNFcnJvcih2YWx1ZTogdW5rbm93bik6IHZhbHVlIGlzIHsgbmFtZTogc3RyaW5nOyBtZXNzYWdlOiBzdHJpbmcgfSB7XG4gIHJldHVybiAoXG4gICAgdHlwZW9mIHZhbHVlID09PSAnb2JqZWN0JyAmJlxuICAgIHZhbHVlICE9PSBudWxsICYmXG4gICAgJ25hbWUnIGluIHZhbHVlICYmXG4gICAgJ21lc3NhZ2UnIGluIHZhbHVlXG4gICk7XG59XG5cbi8qKlxuICogQGludGVybmFsXG4gKiBBbGwgdGhlIHNsdWdzIG9mIHRoZSBlcnJvcnMgdXNlZCBmb3IgZG9jdW1lbnRhdGlvbiBsaW5rcy5cbiAqL1xuZXhwb3J0IGNvbnN0IEVSUk9SX1NMVUdTID0ge1xuICBOT0RFX0pTX01PRFVMRV9JTl9XT1JLRkxPVzogJ25vZGUtanMtbW9kdWxlLWluLXdvcmtmbG93JyxcbiAgU1RBUlRfSU5WQUxJRF9XT1JLRkxPV19GVU5DVElPTjogJ3N0YXJ0LWludmFsaWQtd29ya2Zsb3ctZnVuY3Rpb24nLFxuICBTRVJJQUxJWkFUSU9OX0ZBSUxFRDogJ3NlcmlhbGl6YXRpb24tZmFpbGVkJyxcbiAgV0VCSE9PS19JTlZBTElEX1JFU1BPTkRfV0lUSF9WQUxVRTogJ3dlYmhvb2staW52YWxpZC1yZXNwb25kLXdpdGgtdmFsdWUnLFxuICBXRUJIT09LX1JFU1BPTlNFX05PVF9TRU5UOiAnd2ViaG9vay1yZXNwb25zZS1ub3Qtc2VudCcsXG4gIEZFVENIX0lOX1dPUktGTE9XX0ZVTkNUSU9OOiAnZmV0Y2gtaW4td29ya2Zsb3cnLFxuICBUSU1FT1VUX0ZVTkNUSU9OU19JTl9XT1JLRkxPVzogJ3RpbWVvdXQtaW4td29ya2Zsb3cnLFxuICBIT09LX0NPTkZMSUNUOiAnaG9vay1jb25mbGljdCcsXG4gIENPUlJVUFRFRF9FVkVOVF9MT0c6ICdjb3JydXB0ZWQtZXZlbnQtbG9nJyxcbiAgUkVQTEFZX0RJVkVSR0VOQ0U6ICdyZXBsYXktZGl2ZXJnZW5jZScsXG4gIFNURVBfTk9UX1JFR0lTVEVSRUQ6ICdzdGVwLW5vdC1yZWdpc3RlcmVkJyxcbiAgV09SS0ZMT1dfTk9UX1JFR0lTVEVSRUQ6ICd3b3JrZmxvdy1ub3QtcmVnaXN0ZXJlZCcsXG4gIFJVTlRJTUVfREVDUllQVElPTl9GQUlMRUQ6ICdydW50aW1lLWRlY3J5cHRpb24tZmFpbGVkJyxcbn0gYXMgY29uc3Q7XG5cbnR5cGUgRXJyb3JTbHVnID0gKHR5cGVvZiBFUlJPUl9TTFVHUylba2V5b2YgdHlwZW9mIEVSUk9SX1NMVUdTXTtcblxuaW50ZXJmYWNlIFdvcmtmbG93RXJyb3JPcHRpb25zIGV4dGVuZHMgRXJyb3JPcHRpb25zIHtcbiAgLyoqXG4gICAqIFRoZSBzbHVnIG9mIHRoZSBlcnJvci4gVGhpcyB3aWxsIGJlIHVzZWQgdG8gZ2VuZXJhdGUgYSBsaW5rIHRvIHRoZSBlcnJvciBkb2N1bWVudGF0aW9uLlxuICAgKi9cbiAgc2x1Zz86IEVycm9yU2x1Zztcbn1cblxuLyoqXG4gKiBUaGUgYmFzZSBjbGFzcyBmb3IgYWxsIFdvcmtmbG93LXJlbGF0ZWQgZXJyb3JzLlxuICpcbiAqIFRoaXMgZXJyb3IgaXMgdGhyb3duIGJ5IHRoZSBXb3JrZmxvdyBTREsgd2hlbiBpbnRlcm5hbCBvcGVyYXRpb25zIGZhaWwuXG4gKiBZb3UgY2FuIHVzZSB0aGlzIGNsYXNzIHdpdGggYGluc3RhbmNlb2ZgIHRvIGNhdGNoIGFueSBXb3JrZmxvdyBTREsgZXJyb3IuXG4gKlxuICogQGV4YW1wbGVcbiAqIGBgYHRzXG4gKiB0cnkge1xuICogICBhd2FpdCBnZXRSdW4ocnVuSWQpO1xuICogfSBjYXRjaCAoZXJyb3IpIHtcbiAqICAgaWYgKGVycm9yIGluc3RhbmNlb2YgV29ya2Zsb3dFcnJvcikge1xuICogICAgIGNvbnNvbGUuZXJyb3IoJ1dvcmtmbG93IFNESyBlcnJvcjonLCBlcnJvci5tZXNzYWdlKTtcbiAqICAgfVxuICogfVxuICogYGBgXG4gKi9cbmV4cG9ydCBjbGFzcyBXb3JrZmxvd0Vycm9yIGV4dGVuZHMgRXJyb3Ige1xuICByZWFkb25seSBjYXVzZT86IHVua25vd247XG5cbiAgY29uc3RydWN0b3IobWVzc2FnZTogc3RyaW5nLCBvcHRpb25zPzogV29ya2Zsb3dFcnJvck9wdGlvbnMpIHtcbiAgICBjb25zdCBtc2dEb2NzID0gb3B0aW9ucz8uc2x1Z1xuICAgICAgPyBgJHttZXNzYWdlfVxcblxcbkxlYXJuIG1vcmU6ICR7QkFTRV9VUkx9LyR7b3B0aW9ucy5zbHVnfWBcbiAgICAgIDogbWVzc2FnZTtcbiAgICBzdXBlcihtc2dEb2NzLCB7IGNhdXNlOiBvcHRpb25zPy5jYXVzZSB9KTtcbiAgICB0aGlzLmNhdXNlID0gb3B0aW9ucz8uY2F1c2U7XG5cbiAgICBpZiAob3B0aW9ucz8uY2F1c2UgaW5zdGFuY2VvZiBFcnJvcikge1xuICAgICAgdGhpcy5zdGFjayA9IGAke3RoaXMuc3RhY2t9XFxuQ2F1c2VkIGJ5OiAke29wdGlvbnMuY2F1c2Uuc3RhY2t9YDtcbiAgICB9XG4gIH1cblxuICBzdGF0aWMgaXModmFsdWU6IHVua25vd24pOiB2YWx1ZSBpcyBXb3JrZmxvd0Vycm9yIHtcbiAgICByZXR1cm4gaXNFcnJvcih2YWx1ZSkgJiYgdmFsdWUubmFtZSA9PT0gJ1dvcmtmbG93RXJyb3InO1xuICB9XG59XG5cbi8qKlxuICogVGhyb3duIHdoZW4gYSB3b3JsZCAoc3RvcmFnZSBiYWNrZW5kKSBvcGVyYXRpb24gZmFpbHMgdW5leHBlY3RlZGx5LlxuICpcbiAqIFRoaXMgaXMgdGhlIGNhdGNoLWFsbCBlcnJvciBmb3Igd29ybGQgaW1wbGVtZW50YXRpb25zLiBTcGVjaWZpYyxcbiAqIHdlbGwta25vd24gZmFpbHVyZSBtb2RlcyBoYXZlIGRlZGljYXRlZCBlcnJvciB0eXBlcyAoZS5nLlxuICogRW50aXR5Q29uZmxpY3RFcnJvciwgUnVuRXhwaXJlZEVycm9yLCBUaHJvdHRsZUVycm9yKS4gVGhpcyBlcnJvclxuICogY292ZXJzIGV2ZXJ5dGhpbmcgZWxzZSDigJQgdmFsaWRhdGlvbiBmYWlsdXJlcywgbWlzc2luZyBlbnRpdGllc1xuICogd2l0aG91dCBhIGRlZGljYXRlZCB0eXBlLCBvciB1bmV4cGVjdGVkIEhUVFAgZXJyb3JzIGZyb20gd29ybGQtdmVyY2VsLlxuICovXG5leHBvcnQgY2xhc3MgV29ya2Zsb3dXb3JsZEVycm9yIGV4dGVuZHMgV29ya2Zsb3dFcnJvciB7XG4gIHN0YXR1cz86IG51bWJlcjtcbiAgY29kZT86IHN0cmluZztcbiAgdXJsPzogc3RyaW5nO1xuICAvKiogUmV0cnktQWZ0ZXIgdmFsdWUgaW4gc2Vjb25kcywgcHJlc2VudCBvbiA0MjkgYW5kIDQyNSByZXNwb25zZXMgKi9cbiAgcmV0cnlBZnRlcj86IG51bWJlcjtcblxuICBjb25zdHJ1Y3RvcihcbiAgICBtZXNzYWdlOiBzdHJpbmcsXG4gICAgb3B0aW9ucz86IHtcbiAgICAgIHN0YXR1cz86IG51bWJlcjtcbiAgICAgIHVybD86IHN0cmluZztcbiAgICAgIGNvZGU/OiBzdHJpbmc7XG4gICAgICByZXRyeUFmdGVyPzogbnVtYmVyO1xuICAgICAgY2F1c2U/OiB1bmtub3duO1xuICAgIH1cbiAgKSB7XG4gICAgc3VwZXIobWVzc2FnZSwge1xuICAgICAgY2F1c2U6IG9wdGlvbnM/LmNhdXNlLFxuICAgIH0pO1xuICAgIHRoaXMubmFtZSA9ICdXb3JrZmxvd1dvcmxkRXJyb3InO1xuICAgIHRoaXMuc3RhdHVzID0gb3B0aW9ucz8uc3RhdHVzO1xuICAgIHRoaXMuY29kZSA9IG9wdGlvbnM/LmNvZGU7XG4gICAgdGhpcy51cmwgPSBvcHRpb25zPy51cmw7XG4gICAgdGhpcy5yZXRyeUFmdGVyID0gb3B0aW9ucz8ucmV0cnlBZnRlcjtcbiAgfVxuXG4gIHN0YXRpYyBpcyh2YWx1ZTogdW5rbm93bik6IHZhbHVlIGlzIFdvcmtmbG93V29ybGRFcnJvciB7XG4gICAgcmV0dXJuIGlzRXJyb3IodmFsdWUpICYmIHZhbHVlLm5hbWUgPT09ICdXb3JrZmxvd1dvcmxkRXJyb3InO1xuICB9XG59XG5cbi8qKlxuICogVGhyb3duIHdoZW4gYSB3b3JrZmxvdyBydW4gZmFpbHMgZHVyaW5nIGV4ZWN1dGlvbi5cbiAqXG4gKiBUaGlzIGVycm9yIGluZGljYXRlcyB0aGF0IHRoZSB3b3JrZmxvdyBlbmNvdW50ZXJlZCBhIGZhdGFsIGVycm9yIGFuZCBjYW5ub3RcbiAqIGNvbnRpbnVlLiBJdCBpcyB0aHJvd24gd2hlbiBhd2FpdGluZyBgcnVuLnJldHVyblZhbHVlYCBvbiBhIHJ1biB3aG9zZSBzdGF0dXNcbiAqIGlzIGAnZmFpbGVkJ2AuIFRoZSBgY2F1c2VgIHByb3BlcnR5IGNvbnRhaW5zIHRoZSB1bmRlcmx5aW5nIGVycm9yIHdpdGggaXRzXG4gKiBtZXNzYWdlLCBzdGFjayB0cmFjZSwgYW5kIG9wdGlvbmFsIGVycm9yIGNvZGUuXG4gKlxuICogVXNlIHRoZSBzdGF0aWMgYFdvcmtmbG93UnVuRmFpbGVkRXJyb3IuaXMoKWAgbWV0aG9kIGZvciB0eXBlLXNhZmUgY2hlY2tpbmdcbiAqIGluIGNhdGNoIGJsb2Nrcy5cbiAqXG4gKiBAZXhhbXBsZVxuICogYGBgdHNcbiAqIGltcG9ydCB7IFdvcmtmbG93UnVuRmFpbGVkRXJyb3IgfSBmcm9tIFwid29ya2Zsb3cvaW50ZXJuYWwvZXJyb3JzXCI7XG4gKlxuICogdHJ5IHtcbiAqICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgcnVuLnJldHVyblZhbHVlO1xuICogfSBjYXRjaCAoZXJyb3IpIHtcbiAqICAgaWYgKFdvcmtmbG93UnVuRmFpbGVkRXJyb3IuaXMoZXJyb3IpKSB7XG4gKiAgICAgY29uc29sZS5lcnJvcihgUnVuICR7ZXJyb3IucnVuSWR9IGZhaWxlZDpgLCBlcnJvci5jYXVzZS5tZXNzYWdlKTtcbiAqICAgfVxuICogfVxuICogYGBgXG4gKi9cbmV4cG9ydCBjbGFzcyBXb3JrZmxvd1J1bkZhaWxlZEVycm9yIGV4dGVuZHMgV29ya2Zsb3dFcnJvciB7XG4gIHJ1bklkOiBzdHJpbmc7XG4gIGRlY2xhcmUgY2F1c2U6IEVycm9yICYgeyBjb2RlPzogc3RyaW5nIH07XG5cbiAgY29uc3RydWN0b3IocnVuSWQ6IHN0cmluZywgZXJyb3I6IFN0cnVjdHVyZWRFcnJvcikge1xuICAgIC8vIENyZWF0ZSBhIHByb3BlciBFcnJvciBpbnN0YW5jZSBmcm9tIHRoZSBTdHJ1Y3R1cmVkRXJyb3IgdG8gc2V0IGFzIGNhdXNlXG4gICAgLy8gTk9URTogY3VzdG9tIGVycm9yIHR5cGVzIGRvIG5vdCBnZXQgc2VyaWFsaXplZC9kZXNlcmlhbGl6ZWQuIEV2ZXJ5dGhpbmcgaXMgYW4gRXJyb3JcbiAgICBjb25zdCBjYXVzZUVycm9yID0gbmV3IEVycm9yKGVycm9yLm1lc3NhZ2UpO1xuICAgIGlmIChlcnJvci5zdGFjaykge1xuICAgICAgY2F1c2VFcnJvci5zdGFjayA9IGVycm9yLnN0YWNrO1xuICAgIH1cbiAgICBpZiAoZXJyb3IuY29kZSkge1xuICAgICAgKGNhdXNlRXJyb3IgYXMgYW55KS5jb2RlID0gZXJyb3IuY29kZTtcbiAgICB9XG5cbiAgICBzdXBlcihgV29ya2Zsb3cgcnVuIFwiJHtydW5JZH1cIiBmYWlsZWQ6ICR7ZXJyb3IubWVzc2FnZX1gLCB7XG4gICAgICBjYXVzZTogY2F1c2VFcnJvcixcbiAgICB9KTtcbiAgICB0aGlzLm5hbWUgPSAnV29ya2Zsb3dSdW5GYWlsZWRFcnJvcic7XG4gICAgdGhpcy5ydW5JZCA9IHJ1bklkO1xuICB9XG5cbiAgc3RhdGljIGlzKHZhbHVlOiB1bmtub3duKTogdmFsdWUgaXMgV29ya2Zsb3dSdW5GYWlsZWRFcnJvciB7XG4gICAgcmV0dXJuIGlzRXJyb3IodmFsdWUpICYmIHZhbHVlLm5hbWUgPT09ICdXb3JrZmxvd1J1bkZhaWxlZEVycm9yJztcbiAgfVxufVxuXG4vKipcbiAqIFRocm93biB3aGVuIGF0dGVtcHRpbmcgdG8gZ2V0IHJlc3VsdHMgZnJvbSBhbiBpbmNvbXBsZXRlIHdvcmtmbG93IHJ1bi5cbiAqXG4gKiBUaGlzIGVycm9yIG9jY3VycyB3aGVuIHlvdSB0cnkgdG8gYWNjZXNzIHRoZSByZXN1bHQgb2YgYSB3b3JrZmxvd1xuICogdGhhdCBpcyBzdGlsbCBydW5uaW5nIG9yIGhhc24ndCBjb21wbGV0ZWQgeWV0LlxuICovXG5leHBvcnQgY2xhc3MgV29ya2Zsb3dSdW5Ob3RDb21wbGV0ZWRFcnJvciBleHRlbmRzIFdvcmtmbG93RXJyb3Ige1xuICBydW5JZDogc3RyaW5nO1xuICBzdGF0dXM6IHN0cmluZztcblxuICBjb25zdHJ1Y3RvcihydW5JZDogc3RyaW5nLCBzdGF0dXM6IHN0cmluZykge1xuICAgIHN1cGVyKGBXb3JrZmxvdyBydW4gXCIke3J1bklkfVwiIGhhcyBub3QgY29tcGxldGVkYCwge30pO1xuICAgIHRoaXMubmFtZSA9ICdXb3JrZmxvd1J1bk5vdENvbXBsZXRlZEVycm9yJztcbiAgICB0aGlzLnJ1bklkID0gcnVuSWQ7XG4gICAgdGhpcy5zdGF0dXMgPSBzdGF0dXM7XG4gIH1cblxuICBzdGF0aWMgaXModmFsdWU6IHVua25vd24pOiB2YWx1ZSBpcyBXb3JrZmxvd1J1bk5vdENvbXBsZXRlZEVycm9yIHtcbiAgICByZXR1cm4gaXNFcnJvcih2YWx1ZSkgJiYgdmFsdWUubmFtZSA9PT0gJ1dvcmtmbG93UnVuTm90Q29tcGxldGVkRXJyb3InO1xuICB9XG59XG5cbi8qKlxuICogVGhyb3duIHdoZW4gdGhlIFdvcmtmbG93IHJ1bnRpbWUgZW5jb3VudGVycyBhbiBpbnRlcm5hbCBlcnJvci5cbiAqXG4gKiBUaGlzIGVycm9yIGluZGljYXRlcyBhbiBpc3N1ZSB3aXRoIHdvcmtmbG93IGV4ZWN1dGlvbiwgc3VjaCBhc1xuICogc2VyaWFsaXphdGlvbiBmYWlsdXJlcywgc3RhcnRpbmcgYW4gaW52YWxpZCB3b3JrZmxvdyBmdW5jdGlvbiwgb3JcbiAqIG90aGVyIHJ1bnRpbWUgcHJvYmxlbXMuXG4gKi9cbmV4cG9ydCBjbGFzcyBXb3JrZmxvd1J1bnRpbWVFcnJvciBleHRlbmRzIFdvcmtmbG93RXJyb3Ige1xuICBjb25zdHJ1Y3RvcihtZXNzYWdlOiBzdHJpbmcsIG9wdGlvbnM/OiBXb3JrZmxvd0Vycm9yT3B0aW9ucykge1xuICAgIHN1cGVyKG1lc3NhZ2UsIHtcbiAgICAgIC4uLm9wdGlvbnMsXG4gICAgfSk7XG4gICAgdGhpcy5uYW1lID0gJ1dvcmtmbG93UnVudGltZUVycm9yJztcbiAgfVxuXG4gIHN0YXRpYyBpcyh2YWx1ZTogdW5rbm93bik6IHZhbHVlIGlzIFdvcmtmbG93UnVudGltZUVycm9yIHtcbiAgICByZXR1cm4gaXNFcnJvcih2YWx1ZSkgJiYgdmFsdWUubmFtZSA9PT0gJ1dvcmtmbG93UnVudGltZUVycm9yJztcbiAgfVxufVxuXG4vKipcbiAqIFRocm93biB3aGVuIHRoZSBwZXJzaXN0ZWQgd29ya2Zsb3cgZXZlbnQgbG9nIGNhbm5vdCBiZSByZXBsYXllZCBiZWNhdXNlIGl0XG4gKiBjb250YWlucyBvcnBoYW5lZCwgZHVwbGljYXRlLCBvciBtaXNtYXRjaGVkIGV2ZW50cy5cbiAqXG4gKiBUaGlzIGlzIGEgcnVudGltZS9pbmZyYXN0cnVjdHVyZSBmYWlsdXJlIHJhdGhlciB0aGFuIHVzZXIgY29kZSB0aHJvd2luZy5cbiAqIFdoZW4gdGhpcyByZWFjaGVzIHJ1biBmYWlsdXJlIGhhbmRsaW5nLCBpdCBpcyByZWNvcmRlZCB3aXRoIHRoZSBkaXN0aW5jdFxuICogYENPUlJVUFRFRF9FVkVOVF9MT0dgIGNvZGUgc28gd29ybGRzIGFuZCBiYWNrZW5kcyBjYW4gdHJhY2sgaXQgc2VwYXJhdGVseVxuICogZnJvbSBnZW5lcmljIHJ1bnRpbWUgZmFpbHVyZXMuXG4gKi9cbmV4cG9ydCBjbGFzcyBDb3JydXB0ZWRFdmVudExvZ0Vycm9yIGV4dGVuZHMgV29ya2Zsb3dSdW50aW1lRXJyb3Ige1xuICBjb25zdHJ1Y3RvcihtZXNzYWdlOiBzdHJpbmcsIG9wdGlvbnM/OiBFcnJvck9wdGlvbnMpIHtcbiAgICBzdXBlcihtZXNzYWdlLCB7XG4gICAgICAuLi5vcHRpb25zLFxuICAgICAgc2x1ZzogRVJST1JfU0xVR1MuQ09SUlVQVEVEX0VWRU5UX0xPRyxcbiAgICB9KTtcbiAgICB0aGlzLm5hbWUgPSAnQ29ycnVwdGVkRXZlbnRMb2dFcnJvcic7XG4gIH1cblxuICBzdGF0aWMgaXModmFsdWU6IHVua25vd24pOiB2YWx1ZSBpcyBDb3JydXB0ZWRFdmVudExvZ0Vycm9yIHtcbiAgICByZXR1cm4gaXNFcnJvcih2YWx1ZSkgJiYgdmFsdWUubmFtZSA9PT0gJ0NvcnJ1cHRlZEV2ZW50TG9nRXJyb3InO1xuICB9XG59XG5cbi8qKlxuICogVGhyb3duIHdoZW4gYSBydW4ncyBldmVudCBsb2cgcmVhY2hlcyB0aGUgc2VydmVyLXN1cHBsaWVkIHBlci1ydW4gZXZlbnRcbiAqIGNlaWxpbmcuIENsYXNzaWZpZWQgYXMgYE1BWF9FVkVOVFNfRVhDRUVERURgIChzZWUgYGNsYXNzaWZ5UnVuRXJyb3JgKS5cbiAqL1xuZXhwb3J0IGNsYXNzIE1heEV2ZW50c0V4Y2VlZGVkRXJyb3IgZXh0ZW5kcyBXb3JrZmxvd0Vycm9yIHtcbiAgcmVhZG9ubHkgZXZlbnRDb3VudDogbnVtYmVyO1xuICByZWFkb25seSBsaW1pdDogbnVtYmVyO1xuXG4gIGNvbnN0cnVjdG9yKFxuICAgIGV2ZW50Q291bnQ6IG51bWJlcixcbiAgICBsaW1pdDogbnVtYmVyLFxuICAgIG9wdGlvbnM/OiBXb3JrZmxvd0Vycm9yT3B0aW9uc1xuICApIHtcbiAgICBzdXBlcihgV29ya2Zsb3cgZXhjZWVkZWQgdGhlIG1heGltdW0gb2YgJHtsaW1pdH0gZXZlbnRzIHBlciBydW5gLCBvcHRpb25zKTtcbiAgICB0aGlzLm5hbWUgPSAnTWF4RXZlbnRzRXhjZWVkZWRFcnJvcic7XG4gICAgdGhpcy5ldmVudENvdW50ID0gZXZlbnRDb3VudDtcbiAgICB0aGlzLmxpbWl0ID0gbGltaXQ7XG4gIH1cblxuICBzdGF0aWMgaXModmFsdWU6IHVua25vd24pOiB2YWx1ZSBpcyBNYXhFdmVudHNFeGNlZWRlZEVycm9yIHtcbiAgICByZXR1cm4gaXNFcnJvcih2YWx1ZSkgJiYgdmFsdWUubmFtZSA9PT0gJ01heEV2ZW50c0V4Y2VlZGVkRXJyb3InO1xuICB9XG59XG5cbi8qKlxuICogT3B0aW9uYWwgc3RydWN0dXJlZCBjb250ZXh0IGF0dGFjaGVkIHRvIGEge0BsaW5rIFJ1bnRpbWVEZWNyeXB0aW9uRXJyb3J9LFxuICogY2FycmllZCBvdmVyIGZyb20gdGhlIHVuZGVybHlpbmcgZGVjcnlwdCBjYWxsIHNpdGUgdG8gaGVscCBkaWFnbm9zZSB0aGVcbiAqIGZhaWx1cmUgd2l0aG91dCBwb2tpbmcgdGhyb3VnaCBzdGFja3MuXG4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgUnVudGltZURlY3J5cHRpb25FcnJvckNvbnRleHQge1xuICAvKiogVGhlIG9wZXJhdGlvbiB0aGF0IGZhaWxlZCDigJQgdXNlZnVsIHRvIHRlbGwgZW5jcnlwdCB2cyBkZWNyeXB0IGFwYXJ0LiAqL1xuICBvcGVyYXRpb24/OiAnZW5jcnlwdCcgfCAnZGVjcnlwdCc7XG4gIC8qKiBCeXRlIGxlbmd0aCBvZiB0aGUgaW5wdXQgcGF5bG9hZCBhdCB0aGUgdGltZSBvZiB0aGUgZmFpbHVyZS4gKi9cbiAgYnl0ZUxlbmd0aD86IG51bWJlcjtcbiAgLyoqXG4gICAqIFRoZSBmaXJzdCA0IGJ5dGVzIG9mIHRoZSBpbnB1dCBwYXlsb2FkLCBkZWNvZGVkIGFzIFVURi04IGlmIHByaW50YWJsZS5cbiAgICogVXNlZnVsIGZvciB0ZWxsaW5nIGFwYXJ0IHRydW5jYXRlZC1idXQtdmFsaWQtbG9va2luZyBlbmNyeXB0ZWQgcGF5bG9hZHNcbiAgICogZnJvbSBjb21wbGV0ZWx5IHVucmVsYXRlZCBjb3JydXB0aW9uIChlLmcuIGFuIEhUTUwgZXJyb3IgcGFnZSBzdXJmYWNlZFxuICAgKiBhcyBhIDIwMCBPSykuXG4gICAqL1xuICBmb3JtYXRQcmVmaXg/OiBzdHJpbmc7XG59XG5cbi8qKlxuICogVGhyb3duIHdoZW4gdGhlIFNESydzIGJ1aWx0LWluIEFFUy1HQ00gZW5jcnlwdGlvbiBsYXllciBmYWlscyB0byBlbmNyeXB0XG4gKiBvciBkZWNyeXB0IGEgd29ya2Zsb3cgcGF5bG9hZC5cbiAqXG4gKiBUaGlzIGlzIGFuIGludGVybmFsIFNESyBmYWlsdXJlIOKAlCB1c2VyIGNvZGUgbmV2ZXIgaW52b2tlcyB0aGUgU0RLJ3NcbiAqIGVuY3J5cHRpb24gcHJpbWl0aXZlcyBkaXJlY3RseS4gQ29tbW9uIGNhdXNlczpcbiAqXG4gKiAtIEEgY2lwaGVydGV4dCAvIGF1dGggdGFnIG1pc21hdGNoLCB0eXBpY2FsbHkgc3VyZmFjZWQgYXMgdGhlIG5hdGl2ZSBXZWJcbiAqICAgQ3J5cHRvIGBPcGVyYXRpb25FcnJvcjogVGhlIG9wZXJhdGlvbiBmYWlsZWQgZm9yIGFuIG9wZXJhdGlvbi1zcGVjaWZpY1xuICogICByZWFzb25gLiBVc3VhbGx5IGNhdXNlZCBieSBjaXBoZXJ0ZXh0IG11dGF0aW9uIG9yIHRydW5jYXRpb24gaW4gdHJhbnNpdFxuICogICBiZXR3ZWVuIHN0b3JhZ2UgYW5kIHJlYWQgKHRydW5jYXRlZCBIVFRQIHJlc3BvbnNlLCBlZGdlLWNhY2hlIG1pc3NcbiAqICAgcmV0dXJuaW5nIGEgcGFydGlhbCAyMDAsIHByb3h5IGRyb3AgZHVyaW5nIHN0cmVhbWluZywgZXRjLikuXG4gKiAtIEEga2V5IHJlc29sdXRpb24gbWlzbWF0Y2ggKHdyb25nIGRlcGxveW1lbnQsIG1pc3Npbmcga2V5IG1hdGVyaWFsKS5cbiAqIC0gQSBtYWxmb3JtZWQgZW5jcnlwdGVkIGVudmVsb3BlICh0b28gc2hvcnQgdG8gY29udGFpbiB0aGUgR0NNIG5vbmNlXG4gKiAgIGFuZCB0YWcpLlxuICpcbiAqIEV4dGVuZHMge0BsaW5rIFdvcmtmbG93UnVudGltZUVycm9yfSBzbyB0aGUgcnVuLWZhaWx1cmUgY2xhc3NpZmllclxuICogcm91dGVzIGl0IHRvIGBSVU5USU1FX0VSUk9SYC5cbiAqL1xuZXhwb3J0IGNsYXNzIFJ1bnRpbWVEZWNyeXB0aW9uRXJyb3IgZXh0ZW5kcyBXb3JrZmxvd1J1bnRpbWVFcnJvciB7XG4gIC8qKiBPcHRpb25hbCBzdHJ1Y3R1cmVkIGNvbnRleHQgYWJvdXQgdGhlIGZhaWxlZCBlbmNyeXB0L2RlY3J5cHQgY2FsbC4gKi9cbiAgZGVjbGFyZSByZWFkb25seSBjb250ZXh0PzogUnVudGltZURlY3J5cHRpb25FcnJvckNvbnRleHQ7XG5cbiAgY29uc3RydWN0b3IoXG4gICAgbWVzc2FnZTogc3RyaW5nLFxuICAgIG9wdGlvbnM/OiBFcnJvck9wdGlvbnMgJiB7IGNvbnRleHQ/OiBSdW50aW1lRGVjcnlwdGlvbkVycm9yQ29udGV4dCB9XG4gICkge1xuICAgIHN1cGVyKG1lc3NhZ2UsIHtcbiAgICAgIGNhdXNlOiBvcHRpb25zPy5jYXVzZSxcbiAgICAgIHNsdWc6IEVSUk9SX1NMVUdTLlJVTlRJTUVfREVDUllQVElPTl9GQUlMRUQsXG4gICAgfSk7XG4gICAgdGhpcy5uYW1lID0gJ1J1bnRpbWVEZWNyeXB0aW9uRXJyb3InO1xuICAgIGlmIChvcHRpb25zPy5jb250ZXh0ICE9PSB1bmRlZmluZWQpIHtcbiAgICAgIHRoaXMuY29udGV4dCA9IG9wdGlvbnMuY29udGV4dDtcbiAgICB9XG4gIH1cblxuICBzdGF0aWMgaXModmFsdWU6IHVua25vd24pOiB2YWx1ZSBpcyBSdW50aW1lRGVjcnlwdGlvbkVycm9yIHtcbiAgICByZXR1cm4gaXNFcnJvcih2YWx1ZSkgJiYgdmFsdWUubmFtZSA9PT0gJ1J1bnRpbWVEZWNyeXB0aW9uRXJyb3InO1xuICB9XG59XG5cbi8qKlxuICogVGhyb3duIHdoZW4gdGhlIGN1cnJlbnQgd29ya2Zsb3cgcmVwbGF5IGNhbm5vdCBmb2xsb3cgdGhlIHBhdGggZGVzY3JpYmVkIGJ5XG4gKiB0aGUgcmVjb3JkZWQgZXZlbnQgbG9nLiBBIHNpbmdsZSBkaXZlcmdlbmNlIGRvZXMgbm90IHByb3ZlIHRoYXQgdGhlXG4gKiBwZXJzaXN0ZWQgaGlzdG9yeSBpcyBpbnZhbGlkOiBhIHN1YnNlcXVlbnQgcmVwbGF5IG1heSBvYnNlcnZlIG9yIHNjaGVkdWxlXG4gKiB3b3JrIGNvcnJlY3RseSwgc28gdGhlIHJ1bnRpbWUgbWF5IHJlZGVsaXZlciBiZWZvcmUgZGVjbGFyaW5nIGNvcnJ1cHRpb24uXG4gKi9cbmV4cG9ydCBjbGFzcyBSZXBsYXlEaXZlcmdlbmNlRXJyb3IgZXh0ZW5kcyBXb3JrZmxvd1J1bnRpbWVFcnJvciB7XG4gIHJlYWRvbmx5IGV2ZW50SWQ6IHN0cmluZztcblxuICBjb25zdHJ1Y3RvcihtZXNzYWdlOiBzdHJpbmcsIG9wdGlvbnM6IEVycm9yT3B0aW9ucyAmIHsgZXZlbnRJZDogc3RyaW5nIH0pIHtcbiAgICBzdXBlcihtZXNzYWdlLCB7XG4gICAgICAuLi5vcHRpb25zLFxuICAgICAgc2x1ZzogRVJST1JfU0xVR1MuUkVQTEFZX0RJVkVSR0VOQ0UsXG4gICAgfSk7XG4gICAgdGhpcy5uYW1lID0gJ1JlcGxheURpdmVyZ2VuY2VFcnJvcic7XG4gICAgdGhpcy5ldmVudElkID0gb3B0aW9ucy5ldmVudElkO1xuICB9XG5cbiAgc3RhdGljIGlzKHZhbHVlOiB1bmtub3duKTogdmFsdWUgaXMgUmVwbGF5RGl2ZXJnZW5jZUVycm9yIHtcbiAgICByZXR1cm4gaXNFcnJvcih2YWx1ZSkgJiYgdmFsdWUubmFtZSA9PT0gJ1JlcGxheURpdmVyZ2VuY2VFcnJvcic7XG4gIH1cbn1cblxuLyoqXG4gKiBUaHJvd24gd2hlbiBhIHN0ZXAgZnVuY3Rpb24gaXMgbm90IHJlZ2lzdGVyZWQgaW4gdGhlIGN1cnJlbnQgZGVwbG95bWVudC5cbiAqXG4gKiBUaGlzIGlzIGFuIGluZnJhc3RydWN0dXJlIGVycm9yIOKAlCBub3QgYSB1c2VyIGNvZGUgZXJyb3IuIEl0IHR5cGljYWxseSBtZWFuc1xuICogc29tZXRoaW5nIHdlbnQgd3Jvbmcgd2l0aCB0aGUgYnVuZGxpbmcvYnVpbGQgdG9vbGluZyB0aGF0IGNhdXNlZCB0aGUgc3RlcFxuICogdG8gbm90IGdldCBidWlsdCBjb3JyZWN0bHkuXG4gKlxuICogV2hlbiB0aGlzIGhhcHBlbnMsIHRoZSBzdGVwIGZhaWxzIChsaWtlIGEgRmF0YWxFcnJvcikgYW5kIGNvbnRyb2wgaXMgcGFzc2VkIGJhY2tcbiAqIHRvIHRoZSB3b3JrZmxvdyBmdW5jdGlvbiwgd2hpY2ggY2FuIG9wdGlvbmFsbHkgaGFuZGxlIHRoZSBmYWlsdXJlIGdyYWNlZnVsbHkuXG4gKi9cbmV4cG9ydCBjbGFzcyBTdGVwTm90UmVnaXN0ZXJlZEVycm9yIGV4dGVuZHMgV29ya2Zsb3dSdW50aW1lRXJyb3Ige1xuICBzdGVwTmFtZTogc3RyaW5nO1xuXG4gIGNvbnN0cnVjdG9yKHN0ZXBOYW1lOiBzdHJpbmcpIHtcbiAgICBzdXBlcihcbiAgICAgIGBTdGVwIFwiJHtzdGVwTmFtZX1cIiBpcyBub3QgcmVnaXN0ZXJlZCBpbiB0aGUgY3VycmVudCBkZXBsb3ltZW50LiBUaGlzIHVzdWFsbHkgaW5kaWNhdGVzIGEgYnVpbGQgb3IgYnVuZGxpbmcgaXNzdWUgdGhhdCBjYXVzZWQgdGhlIHN0ZXAgdG8gbm90IGJlIGluY2x1ZGVkIGluIHRoZSBkZXBsb3ltZW50LmAsXG4gICAgICB7IHNsdWc6IEVSUk9SX1NMVUdTLlNURVBfTk9UX1JFR0lTVEVSRUQgfVxuICAgICk7XG4gICAgdGhpcy5uYW1lID0gJ1N0ZXBOb3RSZWdpc3RlcmVkRXJyb3InO1xuICAgIHRoaXMuc3RlcE5hbWUgPSBzdGVwTmFtZTtcbiAgfVxuXG4gIHN0YXRpYyBpcyh2YWx1ZTogdW5rbm93bik6IHZhbHVlIGlzIFN0ZXBOb3RSZWdpc3RlcmVkRXJyb3Ige1xuICAgIHJldHVybiBpc0Vycm9yKHZhbHVlKSAmJiB2YWx1ZS5uYW1lID09PSAnU3RlcE5vdFJlZ2lzdGVyZWRFcnJvcic7XG4gIH1cbn1cblxuLyoqXG4gKiBUaHJvd24gd2hlbiBhIHdvcmtmbG93IGZ1bmN0aW9uIGlzIG5vdCByZWdpc3RlcmVkIGluIHRoZSBjdXJyZW50IGRlcGxveW1lbnQuXG4gKlxuICogVGhpcyBpcyBhbiBpbmZyYXN0cnVjdHVyZSBlcnJvciDigJQgbm90IGEgdXNlciBjb2RlIGVycm9yLiBJdCB0eXBpY2FsbHkgbWVhbnM6XG4gKiAtIEEgcnVuIHdhcyBzdGFydGVkIGFnYWluc3QgYSBkZXBsb3ltZW50IHRoYXQgZG9lcyBub3QgaGF2ZSB0aGUgd29ya2Zsb3dcbiAqICAgKGUuZy4sIHRoZSB3b3JrZmxvdyB3YXMgcmVuYW1lZCBvciBtb3ZlZCBhbmQgYSBuZXcgcnVuIHRhcmdldGVkIHRoZSBsYXRlc3QgZGVwbG95bWVudClcbiAqIC0gU29tZXRoaW5nIHdlbnQgd3Jvbmcgd2l0aCB0aGUgYnVuZGxpbmcvYnVpbGQgdG9vbGluZyB0aGF0IGNhdXNlZCB0aGUgd29ya2Zsb3dcbiAqICAgdG8gbm90IGdldCBidWlsdCBjb3JyZWN0bHlcbiAqXG4gKiBXaGVuIHRoaXMgaGFwcGVucywgdGhlIHJ1biBmYWlscyB3aXRoIGEgYFJVTlRJTUVfRVJST1JgIGVycm9yIGNvZGUuXG4gKi9cbmV4cG9ydCBjbGFzcyBXb3JrZmxvd05vdFJlZ2lzdGVyZWRFcnJvciBleHRlbmRzIFdvcmtmbG93UnVudGltZUVycm9yIHtcbiAgd29ya2Zsb3dOYW1lOiBzdHJpbmc7XG5cbiAgY29uc3RydWN0b3Iod29ya2Zsb3dOYW1lOiBzdHJpbmcpIHtcbiAgICBzdXBlcihcbiAgICAgIGBXb3JrZmxvdyBcIiR7d29ya2Zsb3dOYW1lfVwiIGlzIG5vdCByZWdpc3RlcmVkIGluIHRoZSBjdXJyZW50IGRlcGxveW1lbnQuIFRoaXMgdXN1YWxseSBtZWFucyBhIHJ1biB3YXMgc3RhcnRlZCBhZ2FpbnN0IGEgZGVwbG95bWVudCB0aGF0IGRvZXMgbm90IGhhdmUgdGhpcyB3b3JrZmxvdywgb3IgdGhlcmUgd2FzIGEgYnVpbGQvYnVuZGxpbmcgaXNzdWUuYCxcbiAgICAgIHsgc2x1ZzogRVJST1JfU0xVR1MuV09SS0ZMT1dfTk9UX1JFR0lTVEVSRUQgfVxuICAgICk7XG4gICAgdGhpcy5uYW1lID0gJ1dvcmtmbG93Tm90UmVnaXN0ZXJlZEVycm9yJztcbiAgICB0aGlzLndvcmtmbG93TmFtZSA9IHdvcmtmbG93TmFtZTtcbiAgfVxuXG4gIHN0YXRpYyBpcyh2YWx1ZTogdW5rbm93bik6IHZhbHVlIGlzIFdvcmtmbG93Tm90UmVnaXN0ZXJlZEVycm9yIHtcbiAgICByZXR1cm4gaXNFcnJvcih2YWx1ZSkgJiYgdmFsdWUubmFtZSA9PT0gJ1dvcmtmbG93Tm90UmVnaXN0ZXJlZEVycm9yJztcbiAgfVxufVxuXG4vKipcbiAqIFRocm93biB3aGVuIHBlcmZvcm1pbmcgb3BlcmF0aW9ucyBvbiBhIHdvcmtmbG93IHJ1biB0aGF0IGRvZXMgbm90IGV4aXN0LlxuICpcbiAqIFRoaXMgZXJyb3Igb2NjdXJzIHdoZW4geW91IGNhbGwgbWV0aG9kcyBvbiBhIHJ1biBvYmplY3QgKGUuZy4gYHJ1bi5zdGF0dXNgLFxuICogYHJ1bi5jYW5jZWwoKWAsIGBydW4ucmV0dXJuVmFsdWVgKSBidXQgdGhlIHVuZGVybHlpbmcgcnVuIElEIGRvZXMgbm90IG1hdGNoXG4gKiBhbnkga25vd24gd29ya2Zsb3cgcnVuLiBOb3RlIHRoYXQgYGdldFJ1bihpZClgIGl0c2VsZiBpcyBzeW5jaHJvbm91cyBhbmQgd2lsbFxuICogbm90IHRocm93IOKAlCB0aGlzIGVycm9yIGlzIHJhaXNlZCB3aGVuIHN1YnNlcXVlbnQgb3BlcmF0aW9ucyBkaXNjb3ZlciB0aGUgcnVuXG4gKiBpcyBtaXNzaW5nLlxuICpcbiAqIFVzZSB0aGUgc3RhdGljIGBXb3JrZmxvd1J1bk5vdEZvdW5kRXJyb3IuaXMoKWAgbWV0aG9kIGZvciB0eXBlLXNhZmUgY2hlY2tpbmdcbiAqIGluIGNhdGNoIGJsb2Nrcy5cbiAqXG4gKiBAZXhhbXBsZVxuICogYGBgdHNcbiAqIGltcG9ydCB7IFdvcmtmbG93UnVuTm90Rm91bmRFcnJvciB9IGZyb20gXCJ3b3JrZmxvdy9pbnRlcm5hbC9lcnJvcnNcIjtcbiAqXG4gKiB0cnkge1xuICogICBjb25zdCBzdGF0dXMgPSBhd2FpdCBydW4uc3RhdHVzO1xuICogfSBjYXRjaCAoZXJyb3IpIHtcbiAqICAgaWYgKFdvcmtmbG93UnVuTm90Rm91bmRFcnJvci5pcyhlcnJvcikpIHtcbiAqICAgICBjb25zb2xlLmVycm9yKGBSdW4gJHtlcnJvci5ydW5JZH0gZG9lcyBub3QgZXhpc3RgKTtcbiAqICAgfVxuICogfVxuICogYGBgXG4gKi9cbmV4cG9ydCBjbGFzcyBXb3JrZmxvd1J1bk5vdEZvdW5kRXJyb3IgZXh0ZW5kcyBXb3JrZmxvd0Vycm9yIHtcbiAgcnVuSWQ6IHN0cmluZztcblxuICBjb25zdHJ1Y3RvcihydW5JZDogc3RyaW5nKSB7XG4gICAgc3VwZXIoYFdvcmtmbG93IHJ1biBcIiR7cnVuSWR9XCIgbm90IGZvdW5kYCwge30pO1xuICAgIHRoaXMubmFtZSA9ICdXb3JrZmxvd1J1bk5vdEZvdW5kRXJyb3InO1xuICAgIHRoaXMucnVuSWQgPSBydW5JZDtcbiAgfVxuXG4gIHN0YXRpYyBpcyh2YWx1ZTogdW5rbm93bik6IHZhbHVlIGlzIFdvcmtmbG93UnVuTm90Rm91bmRFcnJvciB7XG4gICAgcmV0dXJuIGlzRXJyb3IodmFsdWUpICYmIHZhbHVlLm5hbWUgPT09ICdXb3JrZmxvd1J1bk5vdEZvdW5kRXJyb3InO1xuICB9XG59XG5cbi8qKlxuICogVGhyb3duIHdoZW4gYSBob29rIHRva2VuIGlzIGFscmVhZHkgaW4gdXNlIGJ5IGFub3RoZXIgYWN0aXZlIHdvcmtmbG93IHJ1bi5cbiAqXG4gKiBUaGlzIGlzIGEgdXNlciBlcnJvciDigJQgaXQgbWVhbnMgdGhlIHNhbWUgY3VzdG9tIHRva2VuIHdhcyBwYXNzZWQgdG9cbiAqIGBjcmVhdGVIb29rYCBpbiB0d28gb3IgbW9yZSBjb25jdXJyZW50IHJ1bnMuIFVzZSBhIHVuaXF1ZSB0b2tlbiBwZXIgcnVuXG4gKiAob3Igb21pdCB0aGUgdG9rZW4gdG8gbGV0IHRoZSBydW50aW1lIGdlbmVyYXRlIG9uZSBhdXRvbWF0aWNhbGx5KS5cbiAqL1xuZXhwb3J0IGNsYXNzIEhvb2tDb25mbGljdEVycm9yIGV4dGVuZHMgV29ya2Zsb3dFcnJvciB7XG4gIHRva2VuOiBzdHJpbmc7XG4gIC8vIFRPRE86IE1ha2UgdGhpcyByZXF1aXJlZCBvbmNlIGFsbCBwZXJzaXN0ZWQgaG9va19jb25mbGljdCBldmVudHMgYW5kIFdvcmxkXG4gIC8vIGltcGxlbWVudGF0aW9ucyBhbHdheXMgaW5jbHVkZSB0aGUgYWN0aXZlIGhvb2sgb3duZXIncyBydW4gSUQuXG4gIGNvbmZsaWN0aW5nUnVuSWQ/OiBzdHJpbmc7XG5cbiAgY29uc3RydWN0b3IodG9rZW46IHN0cmluZywgY29uZmxpY3RpbmdSdW5JZD86IHN0cmluZykge1xuICAgIHN1cGVyKFxuICAgICAgYEhvb2sgdG9rZW4gXCIke3Rva2VufVwiIGlzIGFscmVhZHkgaW4gdXNlIGJ5IGFub3RoZXIgd29ya2Zsb3cke2NvbmZsaWN0aW5nUnVuSWQgPyBgIChydW4gXCIke2NvbmZsaWN0aW5nUnVuSWR9XCIpYCA6ICcnfWAsXG4gICAgICB7XG4gICAgICAgIHNsdWc6IEVSUk9SX1NMVUdTLkhPT0tfQ09ORkxJQ1QsXG4gICAgICB9XG4gICAgKTtcbiAgICB0aGlzLm5hbWUgPSAnSG9va0NvbmZsaWN0RXJyb3InO1xuICAgIHRoaXMudG9rZW4gPSB0b2tlbjtcbiAgICBpZiAoY29uZmxpY3RpbmdSdW5JZCAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICB0aGlzLmNvbmZsaWN0aW5nUnVuSWQgPSBjb25mbGljdGluZ1J1bklkO1xuICAgIH1cbiAgfVxuXG4gIHN0YXRpYyBpcyh2YWx1ZTogdW5rbm93bik6IHZhbHVlIGlzIEhvb2tDb25mbGljdEVycm9yIHtcbiAgICByZXR1cm4gaXNFcnJvcih2YWx1ZSkgJiYgdmFsdWUubmFtZSA9PT0gJ0hvb2tDb25mbGljdEVycm9yJztcbiAgfVxufVxuXG4vKipcbiAqIFRocm93biB3aGVuIGNhbGxpbmcgYHJlc3VtZUhvb2soKWAgb3IgYHJlc3VtZVdlYmhvb2soKWAgd2l0aCBhIHRva2VuIHRoYXRcbiAqIGRvZXMgbm90IG1hdGNoIGFueSBhY3RpdmUgaG9vay5cbiAqXG4gKiBDb21tb24gY2F1c2VzOlxuICogLSBUaGUgaG9vayBoYXMgZXhwaXJlZCAocGFzdCBpdHMgVFRMKVxuICogLSBUaGUgaG9vayB3YXMgYWxyZWFkeSBkaXNwb3NlZCBhZnRlciBiZWluZyBjb25zdW1lZFxuICogLSBUaGUgd29ya2Zsb3cgaGFzIG5vdCBzdGFydGVkIHlldCwgc28gdGhlIGhvb2sgZG9lcyBub3QgZXhpc3RcbiAqXG4gKiBBIGNvbW1vbiBwYXR0ZXJuIGlzIHRvIGNhdGNoIHRoaXMgZXJyb3IgYW5kIHN0YXJ0IGEgbmV3IHdvcmtmbG93IHJ1biB3aGVuXG4gKiB0aGUgaG9vayBkb2VzIG5vdCBleGlzdCB5ZXQgKHRoZSBcInJlc3VtZSBvciBzdGFydFwiIHBhdHRlcm4pLlxuICpcbiAqIFVzZSB0aGUgc3RhdGljIGBIb29rTm90Rm91bmRFcnJvci5pcygpYCBtZXRob2QgZm9yIHR5cGUtc2FmZSBjaGVja2luZyBpblxuICogY2F0Y2ggYmxvY2tzLlxuICpcbiAqIEBleGFtcGxlXG4gKiBgYGB0c1xuICogaW1wb3J0IHsgSG9va05vdEZvdW5kRXJyb3IgfSBmcm9tIFwid29ya2Zsb3cvaW50ZXJuYWwvZXJyb3JzXCI7XG4gKlxuICogdHJ5IHtcbiAqICAgYXdhaXQgcmVzdW1lSG9vayh0b2tlbiwgcGF5bG9hZCk7XG4gKiB9IGNhdGNoIChlcnJvcikge1xuICogICBpZiAoSG9va05vdEZvdW5kRXJyb3IuaXMoZXJyb3IpKSB7XG4gKiAgICAgLy8gSG9vayBkb2Vzbid0IGV4aXN0IOKAlCBzdGFydCBhIG5ldyB3b3JrZmxvdyBydW4gaW5zdGVhZFxuICogICAgIGF3YWl0IHN0YXJ0V29ya2Zsb3coXCJteVdvcmtmbG93XCIsIHBheWxvYWQpO1xuICogICB9XG4gKiB9XG4gKiBgYGBcbiAqL1xuZXhwb3J0IGNsYXNzIEhvb2tOb3RGb3VuZEVycm9yIGV4dGVuZHMgV29ya2Zsb3dFcnJvciB7XG4gIHRva2VuOiBzdHJpbmc7XG5cbiAgY29uc3RydWN0b3IodG9rZW46IHN0cmluZykge1xuICAgIHN1cGVyKCdIb29rIG5vdCBmb3VuZCcsIHt9KTtcbiAgICB0aGlzLm5hbWUgPSAnSG9va05vdEZvdW5kRXJyb3InO1xuICAgIHRoaXMudG9rZW4gPSB0b2tlbjtcbiAgfVxuXG4gIHN0YXRpYyBpcyh2YWx1ZTogdW5rbm93bik6IHZhbHVlIGlzIEhvb2tOb3RGb3VuZEVycm9yIHtcbiAgICByZXR1cm4gaXNFcnJvcih2YWx1ZSkgJiYgdmFsdWUubmFtZSA9PT0gJ0hvb2tOb3RGb3VuZEVycm9yJztcbiAgfVxufVxuXG4vKipcbiAqIFRocm93biB3aGVuIGFuIG9wZXJhdGlvbiBjb25mbGljdHMgd2l0aCB0aGUgY3VycmVudCBzdGF0ZSBvZiBhbiBlbnRpdHkuXG4gKiBUaGlzIGluY2x1ZGVzIGF0dGVtcHRzIHRvIG1vZGlmeSBhbiBlbnRpdHkgYWxyZWFkeSBpbiBhIHRlcm1pbmFsIHN0YXRlLFxuICogY3JlYXRlIGFuIGVudGl0eSB0aGF0IGFscmVhZHkgZXhpc3RzLCBvciBhbnkgb3RoZXIgNDA5LXN0eWxlIGNvbmZsaWN0LlxuICpcbiAqIFRoZSB3b3JrZmxvdyBydW50aW1lIGhhbmRsZXMgdGhpcyBlcnJvciBhdXRvbWF0aWNhbGx5LiBVc2VycyBpbnRlcmFjdGluZ1xuICogd2l0aCB3b3JsZCBzdG9yYWdlIGJhY2tlbmRzIGRpcmVjdGx5IG1heSBlbmNvdW50ZXIgaXQuXG4gKi9cbmV4cG9ydCBjbGFzcyBFbnRpdHlDb25mbGljdEVycm9yIGV4dGVuZHMgV29ya2Zsb3dXb3JsZEVycm9yIHtcbiAgY29uc3RydWN0b3IobWVzc2FnZTogc3RyaW5nKSB7XG4gICAgc3VwZXIobWVzc2FnZSk7XG4gICAgdGhpcy5uYW1lID0gJ0VudGl0eUNvbmZsaWN0RXJyb3InO1xuICB9XG5cbiAgc3RhdGljIGlzKHZhbHVlOiB1bmtub3duKTogdmFsdWUgaXMgRW50aXR5Q29uZmxpY3RFcnJvciB7XG4gICAgcmV0dXJuIGlzRXJyb3IodmFsdWUpICYmIHZhbHVlLm5hbWUgPT09ICdFbnRpdHlDb25mbGljdEVycm9yJztcbiAgfVxufVxuXG4vKipcbiAqIFRocm93biB3aGVuIGEgcnVuIGlzIG5vIGxvbmdlciBhdmFpbGFibGUg4oCUIGVpdGhlciBiZWNhdXNlIGl0IGhhcyBiZWVuXG4gKiBjbGVhbmVkIHVwLCBleHBpcmVkLCBvciBhbHJlYWR5IHJlYWNoZWQgYSB0ZXJtaW5hbCBzdGF0ZSAoY29tcGxldGVkL2ZhaWxlZCkuXG4gKlxuICogVGhlIHdvcmtmbG93IHJ1bnRpbWUgaGFuZGxlcyB0aGlzIGVycm9yIGF1dG9tYXRpY2FsbHkuIFVzZXJzIGludGVyYWN0aW5nXG4gKiB3aXRoIHdvcmxkIHN0b3JhZ2UgYmFja2VuZHMgZGlyZWN0bHkgbWF5IGVuY291bnRlciBpdC5cbiAqL1xuZXhwb3J0IGNsYXNzIFJ1bkV4cGlyZWRFcnJvciBleHRlbmRzIFdvcmtmbG93V29ybGRFcnJvciB7XG4gIGNvbnN0cnVjdG9yKG1lc3NhZ2U6IHN0cmluZykge1xuICAgIHN1cGVyKG1lc3NhZ2UpO1xuICAgIHRoaXMubmFtZSA9ICdSdW5FeHBpcmVkRXJyb3InO1xuICB9XG5cbiAgc3RhdGljIGlzKHZhbHVlOiB1bmtub3duKTogdmFsdWUgaXMgUnVuRXhwaXJlZEVycm9yIHtcbiAgICByZXR1cm4gaXNFcnJvcih2YWx1ZSkgJiYgdmFsdWUubmFtZSA9PT0gJ1J1bkV4cGlyZWRFcnJvcic7XG4gIH1cbn1cblxuLyoqXG4gKiBUaHJvd24gd2hlbiBhbiBvcGVyYXRpb24gY2Fubm90IHByb2NlZWQgYmVjYXVzZSBhIHJlcXVpcmVkIHRpbWVzdGFtcFxuICogKGUuZy4gcmV0cnlBZnRlcikgaGFzIG5vdCBiZWVuIHJlYWNoZWQgeWV0LlxuICpcbiAqIFRoZSB3b3JrZmxvdyBydW50aW1lIGhhbmRsZXMgdGhpcyBlcnJvciBhdXRvbWF0aWNhbGx5LiBVc2VycyBpbnRlcmFjdGluZ1xuICogd2l0aCB3b3JsZCBzdG9yYWdlIGJhY2tlbmRzIGRpcmVjdGx5IG1heSBlbmNvdW50ZXIgaXQuXG4gKlxuICogQHByb3BlcnR5IHJldHJ5QWZ0ZXIgLSBEZWxheSBpbiBzZWNvbmRzIGJlZm9yZSB0aGUgb3BlcmF0aW9uIGNhbiBiZSByZXRyaWVkLlxuICovXG5leHBvcnQgY2xhc3MgVG9vRWFybHlFcnJvciBleHRlbmRzIFdvcmtmbG93V29ybGRFcnJvciB7XG4gIGNvbnN0cnVjdG9yKG1lc3NhZ2U6IHN0cmluZywgb3B0aW9ucz86IHsgcmV0cnlBZnRlcj86IG51bWJlciB9KSB7XG4gICAgc3VwZXIobWVzc2FnZSwgeyByZXRyeUFmdGVyOiBvcHRpb25zPy5yZXRyeUFmdGVyIH0pO1xuICAgIHRoaXMubmFtZSA9ICdUb29FYXJseUVycm9yJztcbiAgfVxuXG4gIHN0YXRpYyBpcyh2YWx1ZTogdW5rbm93bik6IHZhbHVlIGlzIFRvb0Vhcmx5RXJyb3Ige1xuICAgIHJldHVybiBpc0Vycm9yKHZhbHVlKSAmJiB2YWx1ZS5uYW1lID09PSAnVG9vRWFybHlFcnJvcic7XG4gIH1cbn1cblxuLyoqXG4gKiBUaHJvd24gd2hlbiBhIHJlcXVlc3QgaXMgcmF0ZSBsaW1pdGVkIGJ5IHRoZSB3b3JrZmxvdyBiYWNrZW5kLlxuICpcbiAqIFRoZSB3b3JrZmxvdyBydW50aW1lIGhhbmRsZXMgdGhpcyBlcnJvciBhdXRvbWF0aWNhbGx5IHdpdGggcmV0cnkgbG9naWMuXG4gKiBVc2VycyBpbnRlcmFjdGluZyB3aXRoIHdvcmxkIHN0b3JhZ2UgYmFja2VuZHMgZGlyZWN0bHkgbWF5IGVuY291bnRlciBpdFxuICogaWYgcmV0cmllcyBhcmUgZXhoYXVzdGVkLlxuICpcbiAqIEBwcm9wZXJ0eSByZXRyeUFmdGVyIC0gRGVsYXkgaW4gc2Vjb25kcyBiZWZvcmUgdGhlIHJlcXVlc3QgY2FuIGJlIHJldHJpZWQuXG4gKi9cbmV4cG9ydCBjbGFzcyBUaHJvdHRsZUVycm9yIGV4dGVuZHMgV29ya2Zsb3dXb3JsZEVycm9yIHtcbiAgcmV0cnlBZnRlcj86IG51bWJlcjtcblxuICBjb25zdHJ1Y3RvcihtZXNzYWdlOiBzdHJpbmcsIG9wdGlvbnM/OiB7IHJldHJ5QWZ0ZXI/OiBudW1iZXIgfSkge1xuICAgIHN1cGVyKG1lc3NhZ2UpO1xuICAgIHRoaXMubmFtZSA9ICdUaHJvdHRsZUVycm9yJztcbiAgICB0aGlzLnJldHJ5QWZ0ZXIgPSBvcHRpb25zPy5yZXRyeUFmdGVyO1xuICB9XG5cbiAgc3RhdGljIGlzKHZhbHVlOiB1bmtub3duKTogdmFsdWUgaXMgVGhyb3R0bGVFcnJvciB7XG4gICAgcmV0dXJuIGlzRXJyb3IodmFsdWUpICYmIHZhbHVlLm5hbWUgPT09ICdUaHJvdHRsZUVycm9yJztcbiAgfVxufVxuXG4vKipcbiAqIFRocm93biB3aGVuIHRoZSBiYWNrZW5kIHJlamVjdHMgYW4gZXZlbnQgY3JlYXRpb24gYmVjYXVzZSB0aGUgY2xpZW50J3NcbiAqIGV2ZW50LWxvZyBzbmFwc2hvdCBpcyBzdGFsZSDigJQgYSBuZXdlciBvdXQtb2YtYmFuZCBldmVudCAoZS5nLiBhIHJlY2VpdmVkXG4gKiBob29rIG9yIGEgY29tcGxldGVkIHN0ZXApIHdhcyByZWNvcmRlZCBhZnRlciB0aGUgc25hcHNob3QgdGhlIGNsaWVudFxuICogcmVwbGF5ZWQgZnJvbSAoSFRUUCA0MTIpLlxuICpcbiAqIFRoZSB3b3JrZmxvdyBydW50aW1lIGhhbmRsZXMgdGhpcyBhdXRvbWF0aWNhbGx5OiBpdCByZWxvYWRzIHRoZSBldmVudCBsb2dcbiAqIGFuZCByZXRyaWVzLCB1bHRpbWF0ZWx5IHJlLWVucXVldWVpbmcgdGhlIHJ1biBpZiBpdCBjYW5ub3QgY2F0Y2ggdXAuIFVzZXJzXG4gKiBpbnRlcmFjdGluZyB3aXRoIHdvcmxkIHN0b3JhZ2UgYmFja2VuZHMgZGlyZWN0bHkgbWF5IGVuY291bnRlciBpdC5cbiAqL1xuZXhwb3J0IGNsYXNzIFByZWNvbmRpdGlvbkZhaWxlZEVycm9yIGV4dGVuZHMgV29ya2Zsb3dXb3JsZEVycm9yIHtcbiAgY29uc3RydWN0b3IobWVzc2FnZTogc3RyaW5nLCBvcHRpb25zPzogeyByZXRyeUFmdGVyPzogbnVtYmVyIH0pIHtcbiAgICBzdXBlcihtZXNzYWdlLCB7IHN0YXR1czogNDEyLCByZXRyeUFmdGVyOiBvcHRpb25zPy5yZXRyeUFmdGVyIH0pO1xuICAgIHRoaXMubmFtZSA9ICdQcmVjb25kaXRpb25GYWlsZWRFcnJvcic7XG4gIH1cblxuICBzdGF0aWMgaXModmFsdWU6IHVua25vd24pOiB2YWx1ZSBpcyBQcmVjb25kaXRpb25GYWlsZWRFcnJvciB7XG4gICAgcmV0dXJuIGlzRXJyb3IodmFsdWUpICYmIHZhbHVlLm5hbWUgPT09ICdQcmVjb25kaXRpb25GYWlsZWRFcnJvcic7XG4gIH1cbn1cblxuLyoqXG4gKiBUaHJvd24gd2hlbiBhd2FpdGluZyBgcnVuLnJldHVyblZhbHVlYCBvbiBhIHdvcmtmbG93IHJ1biB0aGF0IHdhcyBjYW5jZWxsZWQuXG4gKlxuICogVGhpcyBlcnJvciBpbmRpY2F0ZXMgdGhhdCB0aGUgd29ya2Zsb3cgd2FzIGV4cGxpY2l0bHkgY2FuY2VsbGVkICh2aWFcbiAqIGBydW4uY2FuY2VsKClgKSBhbmQgd2lsbCBub3QgcHJvZHVjZSBhIHJldHVybiB2YWx1ZS4gWW91IGNhbiBjaGVjayBmb3JcbiAqIGNhbmNlbGxhdGlvbiBiZWZvcmUgYXdhaXRpbmcgdGhlIHJldHVybiB2YWx1ZSBieSBpbnNwZWN0aW5nIGBydW4uc3RhdHVzYC5cbiAqXG4gKiBVc2UgdGhlIHN0YXRpYyBgV29ya2Zsb3dSdW5DYW5jZWxsZWRFcnJvci5pcygpYCBtZXRob2QgZm9yIHR5cGUtc2FmZVxuICogY2hlY2tpbmcgaW4gY2F0Y2ggYmxvY2tzLlxuICpcbiAqIEBleGFtcGxlXG4gKiBgYGB0c1xuICogaW1wb3J0IHsgV29ya2Zsb3dSdW5DYW5jZWxsZWRFcnJvciB9IGZyb20gXCJ3b3JrZmxvdy9pbnRlcm5hbC9lcnJvcnNcIjtcbiAqXG4gKiB0cnkge1xuICogICBjb25zdCByZXN1bHQgPSBhd2FpdCBydW4ucmV0dXJuVmFsdWU7XG4gKiB9IGNhdGNoIChlcnJvcikge1xuICogICBpZiAoV29ya2Zsb3dSdW5DYW5jZWxsZWRFcnJvci5pcyhlcnJvcikpIHtcbiAqICAgICBjb25zb2xlLmxvZyhgUnVuICR7ZXJyb3IucnVuSWR9IHdhcyBjYW5jZWxsZWRgKTtcbiAqICAgfVxuICogfVxuICogYGBgXG4gKi9cbmV4cG9ydCBjbGFzcyBXb3JrZmxvd1J1bkNhbmNlbGxlZEVycm9yIGV4dGVuZHMgV29ya2Zsb3dFcnJvciB7XG4gIHJ1bklkOiBzdHJpbmc7XG5cbiAgY29uc3RydWN0b3IocnVuSWQ6IHN0cmluZykge1xuICAgIHN1cGVyKGBXb3JrZmxvdyBydW4gXCIke3J1bklkfVwiIGNhbmNlbGxlZGAsIHt9KTtcbiAgICB0aGlzLm5hbWUgPSAnV29ya2Zsb3dSdW5DYW5jZWxsZWRFcnJvcic7XG4gICAgdGhpcy5ydW5JZCA9IHJ1bklkO1xuICB9XG5cbiAgc3RhdGljIGlzKHZhbHVlOiB1bmtub3duKTogdmFsdWUgaXMgV29ya2Zsb3dSdW5DYW5jZWxsZWRFcnJvciB7XG4gICAgcmV0dXJuIGlzRXJyb3IodmFsdWUpICYmIHZhbHVlLm5hbWUgPT09ICdXb3JrZmxvd1J1bkNhbmNlbGxlZEVycm9yJztcbiAgfVxufVxuXG4vKipcbiAqIFRocm93biB3aGVuIGF0dGVtcHRpbmcgdG8gb3BlcmF0ZSBvbiBhIHdvcmtmbG93IHJ1biB0aGF0IHJlcXVpcmVzIGEgbmV3ZXIgV29ybGQgdmVyc2lvbi5cbiAqXG4gKiBUaGlzIGVycm9yIG9jY3VycyB3aGVuIGEgcnVuIHdhcyBjcmVhdGVkIHdpdGggYSBuZXdlciBzcGVjIHZlcnNpb24gdGhhbiB0aGVcbiAqIGN1cnJlbnQgV29ybGQgaW1wbGVtZW50YXRpb24gc3VwcG9ydHMuIFRvIHJlc29sdmUgdGhpcywgdXBncmFkZSB5b3VyXG4gKiBgd29ya2Zsb3dgIHBhY2thZ2VzIHRvIGEgdmVyc2lvbiB0aGF0IHN1cHBvcnRzIHRoZSByZXF1aXJlZCBzcGVjIHZlcnNpb24uXG4gKlxuICogVXNlIHRoZSBzdGF0aWMgYFJ1bk5vdFN1cHBvcnRlZEVycm9yLmlzKClgIG1ldGhvZCBmb3IgdHlwZS1zYWZlIGNoZWNraW5nIGluXG4gKiBjYXRjaCBibG9ja3MuXG4gKlxuICogQGV4YW1wbGVcbiAqIGBgYHRzXG4gKiBpbXBvcnQgeyBSdW5Ob3RTdXBwb3J0ZWRFcnJvciB9IGZyb20gXCJ3b3JrZmxvdy9pbnRlcm5hbC9lcnJvcnNcIjtcbiAqXG4gKiB0cnkge1xuICogICBjb25zdCBzdGF0dXMgPSBhd2FpdCBydW4uc3RhdHVzO1xuICogfSBjYXRjaCAoZXJyb3IpIHtcbiAqICAgaWYgKFJ1bk5vdFN1cHBvcnRlZEVycm9yLmlzKGVycm9yKSkge1xuICogICAgIGNvbnNvbGUuZXJyb3IoXG4gKiAgICAgICBgUnVuIHJlcXVpcmVzIHNwZWMgdiR7ZXJyb3IucnVuU3BlY1ZlcnNpb259LCBgICtcbiAqICAgICAgIGBidXQgd29ybGQgc3VwcG9ydHMgdiR7ZXJyb3Iud29ybGRTcGVjVmVyc2lvbn1gXG4gKiAgICAgKTtcbiAqICAgfVxuICogfVxuICogYGBgXG4gKi9cbmV4cG9ydCBjbGFzcyBSdW5Ob3RTdXBwb3J0ZWRFcnJvciBleHRlbmRzIFdvcmtmbG93RXJyb3Ige1xuICByZWFkb25seSBydW5TcGVjVmVyc2lvbjogbnVtYmVyO1xuICByZWFkb25seSB3b3JsZFNwZWNWZXJzaW9uOiBudW1iZXI7XG5cbiAgY29uc3RydWN0b3IocnVuU3BlY1ZlcnNpb246IG51bWJlciwgd29ybGRTcGVjVmVyc2lvbjogbnVtYmVyKSB7XG4gICAgc3VwZXIoXG4gICAgICBgUnVuIHJlcXVpcmVzIHNwZWMgdmVyc2lvbiAke3J1blNwZWNWZXJzaW9ufSwgYnV0IHdvcmxkIHN1cHBvcnRzIHZlcnNpb24gJHt3b3JsZFNwZWNWZXJzaW9ufS4gYCArXG4gICAgICAgIGBQbGVhc2UgdXBncmFkZSAnd29ya2Zsb3cnIHBhY2thZ2UuYFxuICAgICk7XG4gICAgdGhpcy5uYW1lID0gJ1J1bk5vdFN1cHBvcnRlZEVycm9yJztcbiAgICB0aGlzLnJ1blNwZWNWZXJzaW9uID0gcnVuU3BlY1ZlcnNpb247XG4gICAgdGhpcy53b3JsZFNwZWNWZXJzaW9uID0gd29ybGRTcGVjVmVyc2lvbjtcbiAgfVxuXG4gIHN0YXRpYyBpcyh2YWx1ZTogdW5rbm93bik6IHZhbHVlIGlzIFJ1bk5vdFN1cHBvcnRlZEVycm9yIHtcbiAgICByZXR1cm4gaXNFcnJvcih2YWx1ZSkgJiYgdmFsdWUubmFtZSA9PT0gJ1J1bk5vdFN1cHBvcnRlZEVycm9yJztcbiAgfVxufVxuXG4vKipcbiAqIEEgZmF0YWwgZXJyb3IgaXMgYW4gZXJyb3IgdGhhdCBjYW5ub3QgYmUgcmV0cmllZC5cbiAqIEl0IHdpbGwgY2F1c2UgdGhlIHN0ZXAgdG8gZmFpbCBhbmQgdGhlIGVycm9yIHdpbGxcbiAqIGJlIGJ1YmJsZWQgdXAgdG8gdGhlIHdvcmtmbG93IGxvZ2ljLlxuICovXG5leHBvcnQgY2xhc3MgRmF0YWxFcnJvciBleHRlbmRzIEVycm9yIHtcbiAgZmF0YWwgPSB0cnVlO1xuXG4gIGNvbnN0cnVjdG9yKG1lc3NhZ2U6IHN0cmluZykge1xuICAgIHN1cGVyKG1lc3NhZ2UpO1xuICAgIHRoaXMubmFtZSA9ICdGYXRhbEVycm9yJztcbiAgfVxuXG4gIHN0YXRpYyBpcyh2YWx1ZTogdW5rbm93bik6IHZhbHVlIGlzIEZhdGFsRXJyb3Ige1xuICAgIHJldHVybiBpc0Vycm9yKHZhbHVlKSAmJiB2YWx1ZS5uYW1lID09PSAnRmF0YWxFcnJvcic7XG4gIH1cbn1cblxuZXhwb3J0IGludGVyZmFjZSBSZXRyeWFibGVFcnJvck9wdGlvbnMge1xuICAvKipcbiAgICogVGhlIG51bWJlciBvZiBtaWxsaXNlY29uZHMgdG8gd2FpdCBiZWZvcmUgcmV0cnlpbmcgdGhlIHN0ZXAuXG4gICAqIENhbiBhbHNvIGJlIGEgZHVyYXRpb24gc3RyaW5nIChlLmcuLCBcIjVzXCIsIFwiMm1cIikgb3IgYSBEYXRlIG9iamVjdC5cbiAgICogSWYgbm90IHByb3ZpZGVkLCB0aGUgc3RlcCB3aWxsIGJlIHJldHJpZWQgYWZ0ZXIgMSBzZWNvbmQgKDEwMDAgbWlsbGlzZWNvbmRzKS5cbiAgICovXG4gIHJldHJ5QWZ0ZXI/OiBudW1iZXIgfCBTdHJpbmdWYWx1ZSB8IERhdGU7XG59XG5cbi8qKlxuICogQW4gZXJyb3IgdGhhdCBjYW4gaGFwcGVuIGR1cmluZyBhIHN0ZXAgZXhlY3V0aW9uLCBhbGxvd2luZ1xuICogZm9yIGNvbmZpZ3VyYXRpb24gb2YgdGhlIHJldHJ5IGJlaGF2aW9yLlxuICovXG5leHBvcnQgY2xhc3MgUmV0cnlhYmxlRXJyb3IgZXh0ZW5kcyBFcnJvciB7XG4gIC8qKlxuICAgKiBUaGUgRGF0ZSB3aGVuIHRoZSBzdGVwIHNob3VsZCBiZSByZXRyaWVkLlxuICAgKi9cbiAgcmV0cnlBZnRlcjogRGF0ZTtcblxuICBjb25zdHJ1Y3RvcihtZXNzYWdlOiBzdHJpbmcsIG9wdGlvbnM6IFJldHJ5YWJsZUVycm9yT3B0aW9ucyA9IHt9KSB7XG4gICAgc3VwZXIobWVzc2FnZSk7XG4gICAgdGhpcy5uYW1lID0gJ1JldHJ5YWJsZUVycm9yJztcblxuICAgIGlmIChvcHRpb25zLnJldHJ5QWZ0ZXIgIT09IHVuZGVmaW5lZCkge1xuICAgICAgdGhpcy5yZXRyeUFmdGVyID0gcGFyc2VEdXJhdGlvblRvRGF0ZShvcHRpb25zLnJldHJ5QWZ0ZXIpO1xuICAgIH0gZWxzZSB7XG4gICAgICAvLyBEZWZhdWx0IHRvIDEgc2Vjb25kICgxMDAwIG1pbGxpc2Vjb25kcylcbiAgICAgIHRoaXMucmV0cnlBZnRlciA9IG5ldyBEYXRlKERhdGUubm93KCkgKyAxMDAwKTtcbiAgICB9XG4gIH1cblxuICBzdGF0aWMgaXModmFsdWU6IHVua25vd24pOiB2YWx1ZSBpcyBSZXRyeWFibGVFcnJvciB7XG4gICAgcmV0dXJuIGlzRXJyb3IodmFsdWUpICYmIHZhbHVlLm5hbWUgPT09ICdSZXRyeWFibGVFcnJvcic7XG4gIH1cbn1cblxuZXhwb3J0IGNvbnN0IFZFUkNFTF80MDNfRVJST1JfTUVTU0FHRSA9XG4gICdZb3VyIGN1cnJlbnQgdmVyY2VsIGFjY291bnQgZG9lcyBub3QgaGF2ZSBhY2Nlc3MgdG8gdGhpcyByZXNvdXJjZS4gVXNlIGB2ZXJjZWwgbG9naW5gIG9yIGB2ZXJjZWwgc3dpdGNoYCB0byBlbnN1cmUgeW91IGFyZSBsaW5rZWQgdG8gdGhlIHJpZ2h0IGFjY291bnQuJztcblxuZXhwb3J0IHsgUlVOX0VSUk9SX0NPREVTLCB0eXBlIFJ1bkVycm9yQ29kZSB9IGZyb20gJy4vZXJyb3ItY29kZXMuanMnO1xuXG4vLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbi8vIENyb3NzLXJlYWxtIGNsYXNzIHJlZ2lzdHJhdGlvblxuLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4vL1xuLy8gYEZhdGFsRXJyb3JgLCBgUmV0cnlhYmxlRXJyb3JgLCBhbmQgYEhvb2tDb25mbGljdEVycm9yYCBhcmUgbm90IGJ1aWx0LWlucywgc28gZGlmZmVyZW50IHJlYWxtc1xuLy8gKGUuZy4gdGhlIHdvcmtmbG93IFZNIGNvbnRleHQgdnMuIHRoZSBob3N0IGNvbnRleHQgdGhhdCBydW5zIHRoZSBxdWV1ZVxuLy8gaGFuZGxlcikgYnVuZGxlIGFuZCBsb2FkIHRoZWlyIG93biBjb3BpZXMgb2YgdGhpcyBtb2R1bGUg4oCUIG1lYW5pbmcgZWFjaFxuLy8gcmVhbG0gaGFzIGl0cyBvd24gZGlzdGluY3QgY2xhc3MgaWRlbnRpdHkuIENyb3NzLXJlYWxtIGBpbnN0YW5jZW9mYCBmYWlsc1xuLy8gYmVjYXVzZSB0aGUgcHJvdG90eXBlIGNoYWlucyBuZXZlciBtZWV0LlxuLy9cbi8vIFRvIGxldCBzZXJpYWxpemF0aW9uIHJldml2ZXJzIHJlY29uc3RydWN0IGEgdmFsdWUgYXMgdGhlICpjb25zdW1lcidzKlxuLy8gRmF0YWxFcnJvciAoc28gdXNlci1jb2RlIGBlcnIgaW5zdGFuY2VvZiBGYXRhbEVycm9yYCBwYXNzZXMpLCBlYWNoIGJ1bmRsZWRcbi8vIGNvcHkgb2YgdGhpcyBtb2R1bGUgc2VsZi1yZWdpc3RlcnMgaXRzIGNsYXNzIG9uIGBnbG9iYWxUaGlzYCB2aWEgYSBrbm93blxuLy8gU3ltYm9sLmZvciBrZXkuIFJldml2ZXJzIGluIGBAd29ya2Zsb3cvY29yZWAgbG9vayB1cCB0aGUgY2xhc3MgdmlhIHRoZVxuLy8gY29uc3VtZXIncyBnbG9iYWxUaGlzIGF0IGh5ZHJhdGlvbiB0aW1lLlxuLy9cbi8vIEZpcnN0IHJlZ2lzdHJhdGlvbiBpbiBhIGdpdmVuIHJlYWxtIHdpbnMuIFRoZSBkZXNjcmlwdG9yIGlzIG5vbi13cml0YWJsZVxuLy8gYW5kIG5vbi1jb25maWd1cmFibGUgdG8gbWFrZSBhY2NpZGVudGFsIGNsb2JiZXJpbmcgbG91ZC5cbmNvbnN0IEZBVEFMX0VSUk9SX0tFWSA9IFN5bWJvbC5mb3IoJ0B3b3JrZmxvdy9lcnJvcnMvL0ZhdGFsRXJyb3InKTtcbmNvbnN0IFJFVFJZQUJMRV9FUlJPUl9LRVkgPSBTeW1ib2wuZm9yKCdAd29ya2Zsb3cvZXJyb3JzLy9SZXRyeWFibGVFcnJvcicpO1xuY29uc3QgSE9PS19DT05GTElDVF9FUlJPUl9LRVkgPSBTeW1ib2wuZm9yKFxuICAnQHdvcmtmbG93L2Vycm9ycy8vSG9va0NvbmZsaWN0RXJyb3InXG4pO1xuXG5pZiAodHlwZW9mIGdsb2JhbFRoaXMgIT09ICd1bmRlZmluZWQnKSB7XG4gIGlmICghT2JqZWN0Lmhhc093bihnbG9iYWxUaGlzLCBGQVRBTF9FUlJPUl9LRVkpKSB7XG4gICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KGdsb2JhbFRoaXMsIEZBVEFMX0VSUk9SX0tFWSwge1xuICAgICAgdmFsdWU6IEZhdGFsRXJyb3IsXG4gICAgICB3cml0YWJsZTogZmFsc2UsXG4gICAgICBlbnVtZXJhYmxlOiBmYWxzZSxcbiAgICAgIGNvbmZpZ3VyYWJsZTogZmFsc2UsXG4gICAgfSk7XG4gIH1cbiAgaWYgKCFPYmplY3QuaGFzT3duKGdsb2JhbFRoaXMsIFJFVFJZQUJMRV9FUlJPUl9LRVkpKSB7XG4gICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KGdsb2JhbFRoaXMsIFJFVFJZQUJMRV9FUlJPUl9LRVksIHtcbiAgICAgIHZhbHVlOiBSZXRyeWFibGVFcnJvcixcbiAgICAgIHdyaXRhYmxlOiBmYWxzZSxcbiAgICAgIGVudW1lcmFibGU6IGZhbHNlLFxuICAgICAgY29uZmlndXJhYmxlOiBmYWxzZSxcbiAgICB9KTtcbiAgfVxuICBpZiAoIU9iamVjdC5oYXNPd24oZ2xvYmFsVGhpcywgSE9PS19DT05GTElDVF9FUlJPUl9LRVkpKSB7XG4gICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KGdsb2JhbFRoaXMsIEhPT0tfQ09ORkxJQ1RfRVJST1JfS0VZLCB7XG4gICAgICB2YWx1ZTogSG9va0NvbmZsaWN0RXJyb3IsXG4gICAgICB3cml0YWJsZTogZmFsc2UsXG4gICAgICBlbnVtZXJhYmxlOiBmYWxzZSxcbiAgICAgIGNvbmZpZ3VyYWJsZTogZmFsc2UsXG4gICAgfSk7XG4gIH1cbn1cbiIsICIvKipcbiAqIFRoaXMgaXMgdGhlIFwic3RhbmRhcmQgbGlicmFyeVwiIG9mIHN0ZXBzIHRoYXQgd2UgbWFrZSBhdmFpbGFibGUgdG8gYWxsIHdvcmtmbG93IHVzZXJzLlxuICogVGhlIGNhbiBiZSBpbXBvcnRlZCBsaWtlIHNvOiBgaW1wb3J0IHsgZmV0Y2ggfSBmcm9tICd3b3JrZmxvdydgLiBhbmQgdXNlZCBpbiB3b3JrZmxvdy5cbiAqIFRoZSBuZWVkIHRvIGJlIGV4cG9ydGVkIGRpcmVjdGx5IGluIHRoaXMgcGFja2FnZSBhbmQgY2Fubm90IGxpdmUgaW4gYGNvcmVgIHRvIHByZXZlbnRcbiAqIGNpcmN1bGFyIGRlcGVuZGVuY2llcyBwb3N0LWNvbXBpbGF0aW9uLlxuICovXG5cbi8qKlxuICogQSBob2lzdGVkIGBmZXRjaCgpYCBmdW5jdGlvbiB0aGF0IGlzIGV4ZWN1dGVkIGFzIGEgXCJzdGVwXCIgZnVuY3Rpb24sXG4gKiBmb3IgdXNlIHdpdGhpbiB3b3JrZmxvdyBmdW5jdGlvbnMuXG4gKlxuICogQHNlZSBodHRwczovL2RldmVsb3Blci5tb3ppbGxhLm9yZy9lbi1VUy9kb2NzL1dlYi9BUEkvRmV0Y2hfQVBJXG4gKi9cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBmZXRjaCguLi5hcmdzOiBQYXJhbWV0ZXJzPHR5cGVvZiBnbG9iYWxUaGlzLmZldGNoPikge1xuICAndXNlIHN0ZXAnO1xuICByZXR1cm4gZ2xvYmFsVGhpcy5mZXRjaCguLi5hcmdzKTtcbn1cbiIsICJpbXBvcnQgeyBGYXRhbEVycm9yLCBSZXRyeWFibGVFcnJvciB9IGZyb20gJ3dvcmtmbG93Jztcbi8qKl9faW50ZXJuYWxfd29ya2Zsb3dze1wid29ya2Zsb3dzXCI6e1wic3JjL3dvcmtmbG93cy93b3JrZmxvd1Byb29mLnRzXCI6e1wid29ya2Zsb3dQcm9vZlwiOntcIndvcmtmbG93SWRcIjpcIndvcmtmbG93Ly8uL3NyYy93b3JrZmxvd3Mvd29ya2Zsb3dQcm9vZi8vd29ya2Zsb3dQcm9vZlwifX19LFwic3RlcHNcIjp7XCJzcmMvd29ya2Zsb3dzL3dvcmtmbG93UHJvb2YudHNcIjp7XCJjbGFpbVByb29mXCI6e1wic3RlcElkXCI6XCJzdGVwLy8uL3NyYy93b3JrZmxvd3Mvd29ya2Zsb3dQcm9vZi8vY2xhaW1Qcm9vZlwifSxcImNvbXBsZXRlUHJvb2ZcIjp7XCJzdGVwSWRcIjpcInN0ZXAvLy4vc3JjL3dvcmtmbG93cy93b3JrZmxvd1Byb29mLy9jb21wbGV0ZVByb29mXCJ9LFwiZmFpbFByb29mXCI6e1wic3RlcElkXCI6XCJzdGVwLy8uL3NyYy93b3JrZmxvd3Mvd29ya2Zsb3dQcm9vZi8vZmFpbFByb29mXCJ9LFwicmVjb25jaWxlUHJvb2ZcIjp7XCJzdGVwSWRcIjpcInN0ZXAvLy4vc3JjL3dvcmtmbG93cy93b3JrZmxvd1Byb29mLy9yZWNvbmNpbGVQcm9vZlwifSxcInN5bnRoZXRpY1dvcmtcIjp7XCJzdGVwSWRcIjpcInN0ZXAvLy4vc3JjL3dvcmtmbG93cy93b3JrZmxvd1Byb29mLy9zeW50aGV0aWNXb3JrXCJ9fX19Ki87XG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gd29ya2Zsb3dQcm9vZihhcHBsaWNhdGlvblJ1bklkKSB7XG4gICAgdHJ5IHtcbiAgICAgICAgYXdhaXQgY2xhaW1Qcm9vZihhcHBsaWNhdGlvblJ1bklkKTtcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICBpZiAoZXJyb3IgaW5zdGFuY2VvZiBGYXRhbEVycm9yKSByZXR1cm4gYXdhaXQgZmFpbFByb29mKGFwcGxpY2F0aW9uUnVuSWQpO1xuICAgICAgICB0aHJvdyBlcnJvcjtcbiAgICB9XG4gICAgbGV0IHJlY29uY2lsZWRTdGF0dXM7XG4gICAgdHJ5IHtcbiAgICAgICAgcmVjb25jaWxlZFN0YXR1cyA9IGF3YWl0IHJlY29uY2lsZVByb29mKGFwcGxpY2F0aW9uUnVuSWQpO1xuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgIGlmIChlcnJvciBpbnN0YW5jZW9mIEZhdGFsRXJyb3IpIHJldHVybiBhd2FpdCBmYWlsUHJvb2YoYXBwbGljYXRpb25SdW5JZCk7XG4gICAgICAgIHRocm93IGVycm9yO1xuICAgIH1cbiAgICBpZiAocmVjb25jaWxlZFN0YXR1cyA9PT0gJ2NvbXBsZXRlZCcgfHwgcmVjb25jaWxlZFN0YXR1cyA9PT0gJ2ZhaWxlZCcpIHtcbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIGFwcGxpY2F0aW9uUnVuSWQsXG4gICAgICAgICAgICB0ZXJtaW5hbFN0YXR1czogcmVjb25jaWxlZFN0YXR1c1xuICAgICAgICB9O1xuICAgIH1cbiAgICBpZiAocmVjb25jaWxlZFN0YXR1cyAhPT0gJ3J1bm5pbmcnKSB7XG4gICAgICAgIHJldHVybiBhd2FpdCBmYWlsUHJvb2YoYXBwbGljYXRpb25SdW5JZCk7XG4gICAgfVxuICAgIHRyeSB7XG4gICAgICAgIGF3YWl0IHN5bnRoZXRpY1dvcmsoYXBwbGljYXRpb25SdW5JZCk7XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgaWYgKGVycm9yIGluc3RhbmNlb2YgUmV0cnlhYmxlRXJyb3IpIHRocm93IGVycm9yO1xuICAgICAgICByZXR1cm4gYXdhaXQgZmFpbFByb29mKGFwcGxpY2F0aW9uUnVuSWQpO1xuICAgIH1cbiAgICByZXR1cm4gYXdhaXQgY29tcGxldGVQcm9vZihhcHBsaWNhdGlvblJ1bklkKTtcbn1cbndvcmtmbG93UHJvb2Yud29ya2Zsb3dJZCA9IFwid29ya2Zsb3cvLy4vc3JjL3dvcmtmbG93cy93b3JrZmxvd1Byb29mLy93b3JrZmxvd1Byb29mXCI7XG5nbG9iYWxUaGlzLl9fcHJpdmF0ZV93b3JrZmxvd3Muc2V0KFwid29ya2Zsb3cvLy4vc3JjL3dvcmtmbG93cy93b3JrZmxvd1Byb29mLy93b3JrZmxvd1Byb29mXCIsIHdvcmtmbG93UHJvb2YpO1xudmFyIGNsYWltUHJvb2YgPSBnbG9iYWxUaGlzW1N5bWJvbC5mb3IoXCJXT1JLRkxPV19VU0VfU1RFUFwiKV0oXCJzdGVwLy8uL3NyYy93b3JrZmxvd3Mvd29ya2Zsb3dQcm9vZi8vY2xhaW1Qcm9vZlwiKTtcbnZhciByZWNvbmNpbGVQcm9vZiA9IGdsb2JhbFRoaXNbU3ltYm9sLmZvcihcIldPUktGTE9XX1VTRV9TVEVQXCIpXShcInN0ZXAvLy4vc3JjL3dvcmtmbG93cy93b3JrZmxvd1Byb29mLy9yZWNvbmNpbGVQcm9vZlwiKTtcbnZhciBzeW50aGV0aWNXb3JrID0gZ2xvYmFsVGhpc1tTeW1ib2wuZm9yKFwiV09SS0ZMT1dfVVNFX1NURVBcIildKFwic3RlcC8vLi9zcmMvd29ya2Zsb3dzL3dvcmtmbG93UHJvb2YvL3N5bnRoZXRpY1dvcmtcIik7XG5zeW50aGV0aWNXb3JrLm1heFJldHJpZXMgPSAxO1xudmFyIGNvbXBsZXRlUHJvb2YgPSBnbG9iYWxUaGlzW1N5bWJvbC5mb3IoXCJXT1JLRkxPV19VU0VfU1RFUFwiKV0oXCJzdGVwLy8uL3NyYy93b3JrZmxvd3Mvd29ya2Zsb3dQcm9vZi8vY29tcGxldGVQcm9vZlwiKTtcbnZhciBmYWlsUHJvb2YgPSBnbG9iYWxUaGlzW1N5bWJvbC5mb3IoXCJXT1JLRkxPV19VU0VfU1RFUFwiKV0oXCJzdGVwLy8uL3NyYy93b3JrZmxvd3Mvd29ya2Zsb3dQcm9vZi8vZmFpbFByb29mXCIpO1xuIiwgIltcblx0XCJub2RlOmFzc2VydFwiLFxuXHRcImFzc2VydFwiLFxuXHRcIm5vZGU6YXNzZXJ0L3N0cmljdFwiLFxuXHRcImFzc2VydC9zdHJpY3RcIixcblx0XCJub2RlOmFzeW5jX2hvb2tzXCIsXG5cdFwiYXN5bmNfaG9va3NcIixcblx0XCJub2RlOmJ1ZmZlclwiLFxuXHRcImJ1ZmZlclwiLFxuXHRcIm5vZGU6Y2hpbGRfcHJvY2Vzc1wiLFxuXHRcImNoaWxkX3Byb2Nlc3NcIixcblx0XCJub2RlOmNsdXN0ZXJcIixcblx0XCJjbHVzdGVyXCIsXG5cdFwibm9kZTpjb25zb2xlXCIsXG5cdFwiY29uc29sZVwiLFxuXHRcIm5vZGU6Y29uc3RhbnRzXCIsXG5cdFwiY29uc3RhbnRzXCIsXG5cdFwibm9kZTpjcnlwdG9cIixcblx0XCJjcnlwdG9cIixcblx0XCJub2RlOmRncmFtXCIsXG5cdFwiZGdyYW1cIixcblx0XCJub2RlOmRpYWdub3N0aWNzX2NoYW5uZWxcIixcblx0XCJkaWFnbm9zdGljc19jaGFubmVsXCIsXG5cdFwibm9kZTpkbnNcIixcblx0XCJkbnNcIixcblx0XCJub2RlOmRucy9wcm9taXNlc1wiLFxuXHRcImRucy9wcm9taXNlc1wiLFxuXHRcIm5vZGU6ZG9tYWluXCIsXG5cdFwiZG9tYWluXCIsXG5cdFwibm9kZTpldmVudHNcIixcblx0XCJldmVudHNcIixcblx0XCJub2RlOmZzXCIsXG5cdFwiZnNcIixcblx0XCJub2RlOmZzL3Byb21pc2VzXCIsXG5cdFwiZnMvcHJvbWlzZXNcIixcblx0XCJub2RlOmh0dHBcIixcblx0XCJodHRwXCIsXG5cdFwibm9kZTpodHRwMlwiLFxuXHRcImh0dHAyXCIsXG5cdFwibm9kZTpodHRwc1wiLFxuXHRcImh0dHBzXCIsXG5cdFwibm9kZTppbnNwZWN0b3JcIixcblx0XCJpbnNwZWN0b3JcIixcblx0XCJub2RlOmluc3BlY3Rvci9wcm9taXNlc1wiLFxuXHRcImluc3BlY3Rvci9wcm9taXNlc1wiLFxuXHRcIm5vZGU6bW9kdWxlXCIsXG5cdFwibW9kdWxlXCIsXG5cdFwibm9kZTpuZXRcIixcblx0XCJuZXRcIixcblx0XCJub2RlOm9zXCIsXG5cdFwib3NcIixcblx0XCJub2RlOnBhdGhcIixcblx0XCJwYXRoXCIsXG5cdFwibm9kZTpwYXRoL3Bvc2l4XCIsXG5cdFwicGF0aC9wb3NpeFwiLFxuXHRcIm5vZGU6cGF0aC93aW4zMlwiLFxuXHRcInBhdGgvd2luMzJcIixcblx0XCJub2RlOnBlcmZfaG9va3NcIixcblx0XCJwZXJmX2hvb2tzXCIsXG5cdFwibm9kZTpwcm9jZXNzXCIsXG5cdFwicHJvY2Vzc1wiLFxuXHRcIm5vZGU6cXVlcnlzdHJpbmdcIixcblx0XCJxdWVyeXN0cmluZ1wiLFxuXHRcIm5vZGU6cXVpY1wiLFxuXHRcIm5vZGU6cmVhZGxpbmVcIixcblx0XCJyZWFkbGluZVwiLFxuXHRcIm5vZGU6cmVhZGxpbmUvcHJvbWlzZXNcIixcblx0XCJyZWFkbGluZS9wcm9taXNlc1wiLFxuXHRcIm5vZGU6cmVwbFwiLFxuXHRcInJlcGxcIixcblx0XCJub2RlOnNlYVwiLFxuXHRcIm5vZGU6c3FsaXRlXCIsXG5cdFwibm9kZTpzdHJlYW1cIixcblx0XCJzdHJlYW1cIixcblx0XCJub2RlOnN0cmVhbS9jb25zdW1lcnNcIixcblx0XCJzdHJlYW0vY29uc3VtZXJzXCIsXG5cdFwibm9kZTpzdHJlYW0vcHJvbWlzZXNcIixcblx0XCJzdHJlYW0vcHJvbWlzZXNcIixcblx0XCJub2RlOnN0cmVhbS93ZWJcIixcblx0XCJzdHJlYW0vd2ViXCIsXG5cdFwibm9kZTpzdHJpbmdfZGVjb2RlclwiLFxuXHRcInN0cmluZ19kZWNvZGVyXCIsXG5cdFwibm9kZTp0ZXN0XCIsXG5cdFwibm9kZTp0ZXN0L3JlcG9ydGVyc1wiLFxuXHRcIm5vZGU6dGltZXJzXCIsXG5cdFwidGltZXJzXCIsXG5cdFwibm9kZTp0aW1lcnMvcHJvbWlzZXNcIixcblx0XCJ0aW1lcnMvcHJvbWlzZXNcIixcblx0XCJub2RlOnRsc1wiLFxuXHRcInRsc1wiLFxuXHRcIm5vZGU6dHJhY2VfZXZlbnRzXCIsXG5cdFwidHJhY2VfZXZlbnRzXCIsXG5cdFwibm9kZTp0dHlcIixcblx0XCJ0dHlcIixcblx0XCJub2RlOnVybFwiLFxuXHRcInVybFwiLFxuXHRcIm5vZGU6dXRpbFwiLFxuXHRcInV0aWxcIixcblx0XCJub2RlOnV0aWwvdHlwZXNcIixcblx0XCJ1dGlsL3R5cGVzXCIsXG5cdFwibm9kZTp2OFwiLFxuXHRcInY4XCIsXG5cdFwibm9kZTp2bVwiLFxuXHRcInZtXCIsXG5cdFwibm9kZTp3YXNpXCIsXG5cdFwid2FzaVwiLFxuXHRcIm5vZGU6d29ya2VyX3RocmVhZHNcIixcblx0XCJ3b3JrZXJfdGhyZWFkc1wiLFxuXHRcIm5vZGU6emxpYlwiLFxuXHRcInpsaWJcIlxuXVxuIiwgImltcG9ydCBidWlsdGluTW9kdWxlcyBmcm9tICcuL2J1aWx0aW4tbW9kdWxlcy5qc29uJztcbmV4cG9ydCBkZWZhdWx0IGJ1aWx0aW5Nb2R1bGVzO1xuIiwgIi8qKlxuICogU2VyZGUgY29tcGxpYW5jZSBjaGVja2VyIGZvciB3b3JrZmxvdyBjdXN0b20gY2xhc3Mgc2VyaWFsaXphdGlvbi5cbiAqXG4gKiBBbmFseXplcyBzb3VyY2UgY29kZSB0byBkZXRlcm1pbmUgaWYgY2xhc3NlcyB3aXRoIFdPUktGTE9XX1NFUklBTElaRSAvXG4gKiBXT1JLRkxPV19ERVNFUklBTElaRSBhcmUgY29ycmVjdGx5IHNldCB1cCBmb3IgdGhlIHdvcmtmbG93IHNhbmRib3guXG4gKlxuICogVXNlZCBieTpcbiAqIC0gQ0xJIGB2YWxpZGF0ZWAgY29tbWFuZFxuICogLSBDTEkgYHRyYW5zZm9ybWAgY29tbWFuZCAoLS1jaGVjay1zZXJkZSlcbiAqIC0gU1dDIHBsYXlncm91bmQgc2VyZGUgYW5hbHlzaXMgcGFuZWxcbiAqIC0gQnVpbGQtdGltZSB3YXJuaW5ncyBpbiBCYXNlQnVpbGRlclxuICovXG5cbmltcG9ydCBidWlsdGluTW9kdWxlcyBmcm9tICdidWlsdGluLW1vZHVsZXMnO1xuaW1wb3J0IHR5cGUgeyBXb3JrZmxvd01hbmlmZXN0IH0gZnJvbSAnLi9hcHBseS1zd2MtdHJhbnNmb3JtLmpzJztcblxuLy8gQnVpbGQgYSByZWdleCB0aGF0IG1hdGNoZXMgTm9kZS5qcyBidWlsdC1pbiBtb2R1bGUgaW1wb3J0cyBpbiB0cmFuc2Zvcm1lZCBjb2RlLlxuLy8gSGFuZGxlcyBib3RoIEVTTSAoYGZyb20gJ2ZzJ2AsIGBmcm9tICdub2RlOmZzJ2ApIGFuZCBDSlMgKGByZXF1aXJlKCdmcycpYClcbmNvbnN0IG5vZGVCdWlsdGlucyA9IGJ1aWx0aW5Nb2R1bGVzLmpvaW4oJ3wnKTtcblxuLy8gUmVnZXggdG8gZXh0cmFjdCBzcGVjaWZpYyBtb2R1bGUgbmFtZXMgZnJvbSBpbXBvcnQvcmVxdWlyZSBzdGF0ZW1lbnRzXG5jb25zdCBub2RlSW1wb3J0RXh0cmFjdFJlZ2V4ID0gbmV3IFJlZ0V4cChcbiAgYCg/OmZyb21cXFxccytbJ1wiXSg/Om5vZGU6KT8oKD86JHtub2RlQnVpbHRpbnN9KSg/Oi9bXidcIl0qKT8pWydcIl1gICtcbiAgICBgfHJlcXVpcmVcXFxccypcXFxcKFxcXFxzKlsnXCJdKD86bm9kZTopPygoPzoke25vZGVCdWlsdGluc30pKD86L1teJ1wiXSopPylbJ1wiXVxcXFxzKlxcXFwpKWAsXG4gICdnJ1xuKTtcblxuLy8gUmVnZXggdG8gZGV0ZWN0IGNsYXNzIHJlZ2lzdHJhdGlvbiBJSUZFcyBnZW5lcmF0ZWQgYnkgdGhlIFNXQyBwbHVnaW5cbmNvbnN0IHJlZ2lzdHJhdGlvbklpZmVSZWdleCA9XG4gIC9TeW1ib2xcXC5mb3JcXHMqXFwoXFxzKltcIiddd29ya2Zsb3ctY2xhc3MtcmVnaXN0cnlbXCInXVxccypcXCkvO1xuXG4vKipcbiAqIFJlc3VsdCBvZiBjaGVja2luZyBhIHNpbmdsZSBjbGFzcyBmb3Igc2VyZGUgY29tcGxpYW5jZS5cbiAqL1xuZXhwb3J0IGludGVyZmFjZSBTZXJkZUNsYXNzQ2hlY2tSZXN1bHQge1xuICAvKiogVGhlIGNsYXNzIG5hbWUgYXMgZGV0ZWN0ZWQgaW4gdGhlIHNvdXJjZSAqL1xuICBjbGFzc05hbWU6IHN0cmluZztcbiAgLyoqIFRoZSBjbGFzc0lkIGFzc2lnbmVkIGJ5IHRoZSBTV0MgcGx1Z2luIChmcm9tIHRoZSBtYW5pZmVzdCkgKi9cbiAgY2xhc3NJZDogc3RyaW5nO1xuICAvKiogV2hldGhlciB0aGUgU1dDIHBsdWdpbiBkZXRlY3RlZCBzZXJkZSBzeW1ib2xzIG9uIHRoaXMgY2xhc3MgKi9cbiAgZGV0ZWN0ZWQ6IGJvb2xlYW47XG4gIC8qKiBXaGV0aGVyIGEgcmVnaXN0cmF0aW9uIElJRkUgd2FzIGdlbmVyYXRlZCBpbiB0aGUgb3V0cHV0ICovXG4gIHJlZ2lzdGVyZWQ6IGJvb2xlYW47XG4gIC8qKlxuICAgKiBOb2RlLmpzIGJ1aWx0LWluIG1vZHVsZSBpbXBvcnRzIHJlbWFpbmluZyBpbiB0aGUgd29ya2Zsb3ctbW9kZSBvdXRwdXQuXG4gICAqIElmIG5vbi1lbXB0eSwgdGhlIGNsYXNzIGlzIE5PVCB3b3JrZmxvdy1zYW5kYm94IGNvbXBsaWFudC5cbiAgICovXG4gIG5vZGVJbXBvcnRzOiBzdHJpbmdbXTtcbiAgLyoqIFdoZXRoZXIgdGhlIGNsYXNzIHBhc3NlcyBhbGwgY29tcGxpYW5jZSBjaGVja3MgKi9cbiAgY29tcGxpYW50OiBib29sZWFuO1xuICAvKiogSHVtYW4tcmVhZGFibGUgZGVzY3JpcHRpb25zIG9mIGFueSBpc3N1ZXMgZm91bmQgKi9cbiAgaXNzdWVzOiBzdHJpbmdbXTtcbn1cblxuLyoqXG4gKiBGdWxsIHJlc3VsdCBvZiBzZXJkZSBjb21wbGlhbmNlIGFuYWx5c2lzIGZvciBhIHNvdXJjZSBmaWxlLlxuICovXG5leHBvcnQgaW50ZXJmYWNlIFNlcmRlQ2hlY2tSZXN1bHQge1xuICAvKiogUGVyLWNsYXNzIGFuYWx5c2lzIHJlc3VsdHMgKi9cbiAgY2xhc3NlczogU2VyZGVDbGFzc0NoZWNrUmVzdWx0W107XG4gIC8qKiBBbGwgTm9kZS5qcyBidWlsdC1pbiBpbXBvcnRzIGZvdW5kIGluIHRoZSB3b3JrZmxvdy1tb2RlIG91dHB1dCAqL1xuICBnbG9iYWxOb2RlSW1wb3J0czogc3RyaW5nW107XG4gIC8qKiBXaGV0aGVyIHRoZSB3b3JrZmxvdy1tb2RlIG91dHB1dCBjb250YWlucyBhbnkgc2VyZGUtcmVsYXRlZCBjbGFzc2VzICovXG4gIGhhc1NlcmRlQ2xhc3NlczogYm9vbGVhbjtcbiAgLyoqIFRoZSByYXcgd29ya2Zsb3cgbWFuaWZlc3QgZXh0cmFjdGVkIGZyb20gdGhlIFNXQyB0cmFuc2Zvcm0gKi9cbiAgbWFuaWZlc3Q6IFdvcmtmbG93TWFuaWZlc3Q7XG59XG5cbi8qKlxuICogTGlnaHR3ZWlnaHQgc2VyZGUgY29tcGxpYW5jZSBjaGVja2VyIHRoYXQgd29ya3Mgd2l0aCBwcmUtY29tcHV0ZWRcbiAqIFNXQyB0cmFuc2Zvcm0gcmVzdWx0cy4gVGhpcyBhdm9pZHMgcmUtcnVubmluZyB0aGUgU1dDIHRyYW5zZm9ybVxuICogd2hlbiB0aGUgY2FsbGVyIGFscmVhZHkgaGFzIHRoZSBvdXRwdXRzIChlLmcuLCB0aGUgcGxheWdyb3VuZCBvciBidWlsZGVyKS5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGFuYWx5emVTZXJkZUNvbXBsaWFuY2Uob3B0aW9uczoge1xuICAvKiogU291cmNlIGNvZGUgKHVzZWQgZm9yIHBhdHRlcm4gZGV0ZWN0aW9uKSAqL1xuICBzb3VyY2VDb2RlOiBzdHJpbmc7XG4gIC8qKiBXb3JrZmxvdy1tb2RlIHRyYW5zZm9ybWVkIG91dHB1dCAqL1xuICB3b3JrZmxvd0NvZGU6IHN0cmluZztcbiAgLyoqIE1hbmlmZXN0IGV4dHJhY3RlZCBmcm9tIHRoZSBTV0MgdHJhbnNmb3JtICovXG4gIG1hbmlmZXN0OiBXb3JrZmxvd01hbmlmZXN0O1xufSk6IFNlcmRlQ2hlY2tSZXN1bHQge1xuICBjb25zdCB7IHNvdXJjZUNvZGUsIHdvcmtmbG93Q29kZSwgbWFuaWZlc3QgfSA9IG9wdGlvbnM7XG5cbiAgLy8gMS4gRXh0cmFjdCBhbGwgTm9kZS5qcyBidWlsdC1pbiBpbXBvcnRzIGZyb20gdGhlIHdvcmtmbG93IG91dHB1dFxuICBjb25zdCBnbG9iYWxOb2RlSW1wb3J0cyA9IGV4dHJhY3ROb2RlSW1wb3J0cyh3b3JrZmxvd0NvZGUpO1xuXG4gIC8vIDIuIENoZWNrIGlmIHRoZSBtYW5pZmVzdCBjb250YWlucyBhbnkgc2VyZGUtcmVnaXN0ZXJlZCBjbGFzc2VzXG4gIGNvbnN0IGNsYXNzRW50cmllcyA9IGV4dHJhY3RDbGFzc0VudHJpZXMobWFuaWZlc3QpO1xuICBjb25zdCBoYXNTZXJkZUNsYXNzZXMgPSBjbGFzc0VudHJpZXMubGVuZ3RoID4gMDtcblxuICAvLyAzLiBDaGVjayBpZiB0aGUgd29ya2Zsb3cgb3V0cHV0IGNvbnRhaW5zIHJlZ2lzdHJhdGlvbiBJSUZFc1xuICBjb25zdCBoYXNSZWdpc3RyYXRpb24gPSByZWdpc3RyYXRpb25JaWZlUmVnZXgudGVzdCh3b3JrZmxvd0NvZGUpO1xuXG4gIC8vIDQuIEFuYWx5emUgZWFjaCBjbGFzc1xuICBjb25zdCBjbGFzc2VzOiBTZXJkZUNsYXNzQ2hlY2tSZXN1bHRbXSA9IGNsYXNzRW50cmllcy5tYXAoKGVudHJ5KSA9PiB7XG4gICAgY29uc3QgaXNzdWVzOiBzdHJpbmdbXSA9IFtdO1xuXG4gICAgLy8gQ2hlY2sgZm9yIE5vZGUuanMgaW1wb3J0cyAodGhlc2Ugd2lsbCBmYWlsIGluIHRoZSB3b3JrZmxvdyBzYW5kYm94KVxuICAgIGlmIChnbG9iYWxOb2RlSW1wb3J0cy5sZW5ndGggPiAwKSB7XG4gICAgICBpc3N1ZXMucHVzaChcbiAgICAgICAgYFdvcmtmbG93IGJ1bmRsZSBjb250YWlucyBOb2RlLmpzIGJ1aWx0LWluIGltcG9ydHM6ICR7Z2xvYmFsTm9kZUltcG9ydHMuam9pbignLCAnKX0uIGAgK1xuICAgICAgICAgIGBUaGVzZSB3aWxsIGZhaWwgYXQgcnVudGltZSBpbiB0aGUgd29ya2Zsb3cgc2FuZGJveC4gYCArXG4gICAgICAgICAgYEFkZCBcInVzZSBzdGVwXCIgdG8gbWV0aG9kcyB0aGF0IGRlcGVuZCBvbiBOb2RlLmpzIEFQSXMgc28gdGhleSBhcmUgc3RyaXBwZWQgZnJvbSB0aGUgd29ya2Zsb3cgYnVuZGxlLmBcbiAgICAgICk7XG4gICAgfVxuXG4gICAgLy8gQ2hlY2sgZm9yIHJlZ2lzdHJhdGlvblxuICAgIGlmICghaGFzUmVnaXN0cmF0aW9uKSB7XG4gICAgICBpc3N1ZXMucHVzaChcbiAgICAgICAgYE5vIGNsYXNzIHJlZ2lzdHJhdGlvbiBJSUZFIHdhcyBnZW5lcmF0ZWQuIGAgK1xuICAgICAgICAgIGBFbnN1cmUgV09SS0ZMT1dfU0VSSUFMSVpFIGFuZCBXT1JLRkxPV19ERVNFUklBTElaRSBhcmUgZGVmaW5lZCBhcyBzdGF0aWMgbWV0aG9kcyBgICtcbiAgICAgICAgICBgaW5zaWRlIHRoZSBjbGFzcyBib2R5IHVzaW5nIGNvbXB1dGVkIHByb3BlcnR5IHN5bnRheDogc3RhdGljIFtXT1JLRkxPV19TRVJJQUxJWkVdKC4uLikgeyAuLi4gfWBcbiAgICAgICk7XG4gICAgfVxuXG4gICAgcmV0dXJuIHtcbiAgICAgIGNsYXNzTmFtZTogZW50cnkuY2xhc3NOYW1lLFxuICAgICAgY2xhc3NJZDogZW50cnkuY2xhc3NJZCxcbiAgICAgIGRldGVjdGVkOiB0cnVlLFxuICAgICAgcmVnaXN0ZXJlZDogaGFzUmVnaXN0cmF0aW9uLFxuICAgICAgbm9kZUltcG9ydHM6IGdsb2JhbE5vZGVJbXBvcnRzLFxuICAgICAgY29tcGxpYW50OiBnbG9iYWxOb2RlSW1wb3J0cy5sZW5ndGggPT09IDAgJiYgaGFzUmVnaXN0cmF0aW9uLFxuICAgICAgaXNzdWVzLFxuICAgIH07XG4gIH0pO1xuXG4gIC8vIDUuIENoZWNrIGZvciBjbGFzc2VzIHRoYXQgaGF2ZSBzZXJkZSBwYXR0ZXJucyBpbiBzb3VyY2UgYnV0IHdlcmVuJ3QgZGV0ZWN0ZWQgYnkgU1dDXG4gIGNvbnN0IHNvdXJjZUhhc1NlcmRlUGF0dGVybnMgPVxuICAgIC9cXFtcXHMqV09SS0ZMT1dfKD86U0VSSUFMSVpFfERFU0VSSUFMSVpFKVxccypcXF0vLnRlc3Qoc291cmNlQ29kZSkgfHxcbiAgICAvU3ltYm9sXFwuZm9yXFxzKlxcKFxccypbJ1wiXXdvcmtmbG93LSg/OnNlcmlhbGl6ZXxkZXNlcmlhbGl6ZSlbJ1wiXVxccypcXCkvLnRlc3QoXG4gICAgICBzb3VyY2VDb2RlXG4gICAgKTtcblxuICBpZiAoc291cmNlSGFzU2VyZGVQYXR0ZXJucyAmJiBjbGFzc0VudHJpZXMubGVuZ3RoID09PSAwKSB7XG4gICAgY2xhc3Nlcy5wdXNoKHtcbiAgICAgIGNsYXNzTmFtZTogJzx1bmtub3duPicsXG4gICAgICBjbGFzc0lkOiAnJyxcbiAgICAgIGRldGVjdGVkOiBmYWxzZSxcbiAgICAgIHJlZ2lzdGVyZWQ6IGZhbHNlLFxuICAgICAgbm9kZUltcG9ydHM6IGdsb2JhbE5vZGVJbXBvcnRzLFxuICAgICAgY29tcGxpYW50OiBmYWxzZSxcbiAgICAgIGlzc3VlczogW1xuICAgICAgICBgU291cmNlIGNvZGUgY29udGFpbnMgV09SS0ZMT1dfU0VSSUFMSVpFL1dPUktGTE9XX0RFU0VSSUFMSVpFIHBhdHRlcm5zIGJ1dCBgICtcbiAgICAgICAgICBgdGhlIFNXQyBwbHVnaW4gZGlkIG5vdCBkZXRlY3QgYW55IHNlcmRlLWVuYWJsZWQgY2xhc3Nlcy4gYCArXG4gICAgICAgICAgYEVuc3VyZSB0aGUgc3ltYm9scyBhcmUgZGVmaW5lZCBhcyBzdGF0aWMgbWV0aG9kcyBJTlNJREUgdGhlIGNsYXNzIGJvZHksIGAgK1xuICAgICAgICAgIGBub3QgYXNzaWduZWQgZXh0ZXJuYWxseSAoZS5nLiwgKE15Q2xhc3MgYXMgYW55KVtXT1JLRkxPV19TRVJJQUxJWkVdID0gLi4uKS5gLFxuICAgICAgXSxcbiAgICB9KTtcbiAgfVxuXG4gIHJldHVybiB7XG4gICAgY2xhc3NlcyxcbiAgICBnbG9iYWxOb2RlSW1wb3J0cyxcbiAgICBoYXNTZXJkZUNsYXNzZXMsXG4gICAgbWFuaWZlc3QsXG4gIH07XG59XG5cbi8qKlxuICogRXh0cmFjdCBOb2RlLmpzIGJ1aWx0LWluIG1vZHVsZSBuYW1lcyBmcm9tIHRyYW5zZm9ybWVkIGNvZGUuXG4gKi9cbmZ1bmN0aW9uIGV4dHJhY3ROb2RlSW1wb3J0cyhjb2RlOiBzdHJpbmcpOiBzdHJpbmdbXSB7XG4gIGNvbnN0IGltcG9ydHMgPSBuZXcgU2V0PHN0cmluZz4oKTtcbiAgLy8gUmVzZXQgcmVnZXggc3RhdGVcbiAgbm9kZUltcG9ydEV4dHJhY3RSZWdleC5sYXN0SW5kZXggPSAwO1xuICBmb3IgKFxuICAgIGxldCBtYXRjaCA9IG5vZGVJbXBvcnRFeHRyYWN0UmVnZXguZXhlYyhjb2RlKTtcbiAgICBtYXRjaCAhPT0gbnVsbDtcbiAgICBtYXRjaCA9IG5vZGVJbXBvcnRFeHRyYWN0UmVnZXguZXhlYyhjb2RlKVxuICApIHtcbiAgICAvLyBtYXRjaFsxXSBpcyBmcm9tIHRoZSBFU00gcGF0dGVybiwgbWF0Y2hbMl0gaXMgZnJvbSB0aGUgQ0pTIHBhdHRlcm5cbiAgICBjb25zdCBtb2R1bGVOYW1lID0gbWF0Y2hbMV0gfHwgbWF0Y2hbMl07XG4gICAgaWYgKG1vZHVsZU5hbWUpIHtcbiAgICAgIC8vIE5vcm1hbGl6ZSB0byBiYXNlIG1vZHVsZSBuYW1lIChlLmcuLCAnZnMvcHJvbWlzZXMnIC0+ICdmcycpXG4gICAgICBpbXBvcnRzLmFkZChtb2R1bGVOYW1lLnNwbGl0KCcvJylbMF0pO1xuICAgIH1cbiAgfVxuICByZXR1cm4gWy4uLmltcG9ydHNdLnNvcnQoKTtcbn1cblxuLyoqXG4gKiBFeHRyYWN0IGNsYXNzIGVudHJpZXMgZnJvbSBhIFdvcmtmbG93TWFuaWZlc3QuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBleHRyYWN0Q2xhc3NFbnRyaWVzKFxuICBtYW5pZmVzdDogV29ya2Zsb3dNYW5pZmVzdFxuKTogQXJyYXk8eyBjbGFzc05hbWU6IHN0cmluZzsgY2xhc3NJZDogc3RyaW5nOyBmaWxlTmFtZTogc3RyaW5nIH0+IHtcbiAgY29uc3QgZW50cmllczogQXJyYXk8e1xuICAgIGNsYXNzTmFtZTogc3RyaW5nO1xuICAgIGNsYXNzSWQ6IHN0cmluZztcbiAgICBmaWxlTmFtZTogc3RyaW5nO1xuICB9PiA9IFtdO1xuICBpZiAoIW1hbmlmZXN0LmNsYXNzZXMpIHJldHVybiBlbnRyaWVzO1xuXG4gIGZvciAoY29uc3QgW2ZpbGVOYW1lLCBjbGFzc2VzXSBvZiBPYmplY3QuZW50cmllcyhtYW5pZmVzdC5jbGFzc2VzKSkge1xuICAgIGZvciAoY29uc3QgW2NsYXNzTmFtZSwgeyBjbGFzc0lkIH1dIG9mIE9iamVjdC5lbnRyaWVzKGNsYXNzZXMpKSB7XG4gICAgICBlbnRyaWVzLnB1c2goeyBjbGFzc05hbWUsIGNsYXNzSWQsIGZpbGVOYW1lIH0pO1xuICAgIH1cbiAgfVxuICByZXR1cm4gZW50cmllcztcbn1cbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUFBO0FBQUEsc0NBQUFBLFNBQUE7QUFFSSxRQUFJLElBQUk7QUFDWixRQUFJLElBQUksSUFBSTtBQUNaLFFBQUksSUFBSSxJQUFJO0FBQ1osUUFBSSxJQUFJLElBQUk7QUFDWixRQUFJLElBQUksSUFBSTtBQUNaLFFBQUksSUFBSSxJQUFJO0FBYVIsSUFBQUEsUUFBTyxVQUFVLFNBQVMsS0FBSyxTQUFTO0FBQ3hDLGdCQUFVLFdBQVcsQ0FBQztBQUN0QixVQUFJLE9BQU8sT0FBTztBQUNsQixVQUFJLFNBQVMsWUFBWSxJQUFJLFNBQVMsR0FBRztBQUNyQyxlQUFPLE1BQU0sR0FBRztBQUFBLE1BQ3BCLFdBQVcsU0FBUyxZQUFZLFNBQVMsR0FBRyxHQUFHO0FBQzNDLGVBQU8sUUFBUSxPQUFPLFFBQVEsR0FBRyxJQUFJLFNBQVMsR0FBRztBQUFBLE1BQ3JEO0FBQ0EsWUFB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
`;

export const POST = workflowEntrypoint(workflowCode);
export const GET = POST;
export const HEAD = POST;
export const OPTIONS = POST;