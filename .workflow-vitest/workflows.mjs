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
      const claimed = await loadRun(applicationRunId);
      if (claimed.policySnapshot.mode === "phase32_noop") {
        const completed2 = await completePersistedRun(applicationRunId);
        if (completed2.ok) return {
          applicationRunId,
          terminalStatus: "completed"
        };
        return await observeAuthoritativeState(applicationRunId);
      }
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
      if (completed.ok) return {
        applicationRunId,
        terminalStatus: "completed"
      };
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
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsibm9kZV9tb2R1bGVzL21zL2luZGV4LmpzIiwgInNyYy93b3JrZmxvd3MvYW5hbHlzaXNSdW4udHMiLCAibm9kZV9tb2R1bGVzL0B3b3JrZmxvdy91dGlscy9zcmMvdGltZS50cyIsICJub2RlX21vZHVsZXMvQHdvcmtmbG93L2Vycm9ycy9zcmMvaW5kZXgudHMiLCAibm9kZV9tb2R1bGVzL3dvcmtmbG93L3NyYy9zdGRsaWIudHMiLCAic3JjL3dvcmtmbG93cy93b3JrZmxvd1Byb29mLnRzIiwgIm5vZGVfbW9kdWxlcy9idWlsdGluLW1vZHVsZXMvYnVpbHRpbi1tb2R1bGVzLmpzb24iLCAibm9kZV9tb2R1bGVzL2J1aWx0aW4tbW9kdWxlcy9pbmRleC5qcyIsICJub2RlX21vZHVsZXMvQHdvcmtmbG93L2J1aWxkZXJzL3NyYy9zZXJkZS1jaGVja2VyLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKipcbiAqIEhlbHBlcnMuXG4gKi8gdmFyIHMgPSAxMDAwO1xudmFyIG0gPSBzICogNjA7XG52YXIgaCA9IG0gKiA2MDtcbnZhciBkID0gaCAqIDI0O1xudmFyIHcgPSBkICogNztcbnZhciB5ID0gZCAqIDM2NS4yNTtcbi8qKlxuICogUGFyc2Ugb3IgZm9ybWF0IHRoZSBnaXZlbiBgdmFsYC5cbiAqXG4gKiBPcHRpb25zOlxuICpcbiAqICAtIGBsb25nYCB2ZXJib3NlIGZvcm1hdHRpbmcgW2ZhbHNlXVxuICpcbiAqIEBwYXJhbSB7U3RyaW5nfE51bWJlcn0gdmFsXG4gKiBAcGFyYW0ge09iamVjdH0gW29wdGlvbnNdXG4gKiBAdGhyb3dzIHtFcnJvcn0gdGhyb3cgYW4gZXJyb3IgaWYgdmFsIGlzIG5vdCBhIG5vbi1lbXB0eSBzdHJpbmcgb3IgYSBudW1iZXJcbiAqIEByZXR1cm4ge1N0cmluZ3xOdW1iZXJ9XG4gKiBAYXBpIHB1YmxpY1xuICovIG1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24odmFsLCBvcHRpb25zKSB7XG4gICAgb3B0aW9ucyA9IG9wdGlvbnMgfHwge307XG4gICAgdmFyIHR5cGUgPSB0eXBlb2YgdmFsO1xuICAgIGlmICh0eXBlID09PSAnc3RyaW5nJyAmJiB2YWwubGVuZ3RoID4gMCkge1xuICAgICAgICByZXR1cm4gcGFyc2UodmFsKTtcbiAgICB9IGVsc2UgaWYgKHR5cGUgPT09ICdudW1iZXInICYmIGlzRmluaXRlKHZhbCkpIHtcbiAgICAgICAgcmV0dXJuIG9wdGlvbnMubG9uZyA/IGZtdExvbmcodmFsKSA6IGZtdFNob3J0KHZhbCk7XG4gICAgfVxuICAgIHRocm93IG5ldyBFcnJvcigndmFsIGlzIG5vdCBhIG5vbi1lbXB0eSBzdHJpbmcgb3IgYSB2YWxpZCBudW1iZXIuIHZhbD0nICsgSlNPTi5zdHJpbmdpZnkodmFsKSk7XG59O1xuLyoqXG4gKiBQYXJzZSB0aGUgZ2l2ZW4gYHN0cmAgYW5kIHJldHVybiBtaWxsaXNlY29uZHMuXG4gKlxuICogQHBhcmFtIHtTdHJpbmd9IHN0clxuICogQHJldHVybiB7TnVtYmVyfVxuICogQGFwaSBwcml2YXRlXG4gKi8gZnVuY3Rpb24gcGFyc2Uoc3RyKSB7XG4gICAgc3RyID0gU3RyaW5nKHN0cik7XG4gICAgaWYgKHN0ci5sZW5ndGggPiAxMDApIHtcbiAgICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICB2YXIgbWF0Y2ggPSAvXigtPyg/OlxcZCspP1xcLj9cXGQrKSAqKG1pbGxpc2Vjb25kcz98bXNlY3M/fG1zfHNlY29uZHM/fHNlY3M/fHN8bWludXRlcz98bWlucz98bXxob3Vycz98aHJzP3xofGRheXM/fGR8d2Vla3M/fHd8eWVhcnM/fHlycz98eSk/JC9pLmV4ZWMoc3RyKTtcbiAgICBpZiAoIW1hdGNoKSB7XG4gICAgICAgIHJldHVybjtcbiAgICB9XG4gICAgdmFyIG4gPSBwYXJzZUZsb2F0KG1hdGNoWzFdKTtcbiAgICB2YXIgdHlwZSA9IChtYXRjaFsyXSB8fCAnbXMnKS50b0xvd2VyQ2FzZSgpO1xuICAgIHN3aXRjaCh0eXBlKXtcbiAgICAgICAgY2FzZSAneWVhcnMnOlxuICAgICAgICBjYXNlICd5ZWFyJzpcbiAgICAgICAgY2FzZSAneXJzJzpcbiAgICAgICAgY2FzZSAneXInOlxuICAgICAgICBjYXNlICd5JzpcbiAgICAgICAgICAgIHJldHVybiBuICogeTtcbiAgICAgICAgY2FzZSAnd2Vla3MnOlxuICAgICAgICBjYXNlICd3ZWVrJzpcbiAgICAgICAgY2FzZSAndyc6XG4gICAgICAgICAgICByZXR1cm4gbiAqIHc7XG4gICAgICAgIGNhc2UgJ2RheXMnOlxuICAgICAgICBjYXNlICdkYXknOlxuICAgICAgICBjYXNlICdkJzpcbiAgICAgICAgICAgIHJldHVybiBuICogZDtcbiAgICAgICAgY2FzZSAnaG91cnMnOlxuICAgICAgICBjYXNlICdob3VyJzpcbiAgICAgICAgY2FzZSAnaHJzJzpcbiAgICAgICAgY2FzZSAnaHInOlxuICAgICAgICBjYXNlICdoJzpcbiAgICAgICAgICAgIHJldHVybiBuICogaDtcbiAgICAgICAgY2FzZSAnbWludXRlcyc6XG4gICAgICAgIGNhc2UgJ21pbnV0ZSc6XG4gICAgICAgIGNhc2UgJ21pbnMnOlxuICAgICAgICBjYXNlICdtaW4nOlxuICAgICAgICBjYXNlICdtJzpcbiAgICAgICAgICAgIHJldHVybiBuICogbTtcbiAgICAgICAgY2FzZSAnc2Vjb25kcyc6XG4gICAgICAgIGNhc2UgJ3NlY29uZCc6XG4gICAgICAgIGNhc2UgJ3NlY3MnOlxuICAgICAgICBjYXNlICdzZWMnOlxuICAgICAgICBjYXNlICdzJzpcbiAgICAgICAgICAgIHJldHVybiBuICogcztcbiAgICAgICAgY2FzZSAnbWlsbGlzZWNvbmRzJzpcbiAgICAgICAgY2FzZSAnbWlsbGlzZWNvbmQnOlxuICAgICAgICBjYXNlICdtc2Vjcyc6XG4gICAgICAgIGNhc2UgJ21zZWMnOlxuICAgICAgICBjYXNlICdtcyc6XG4gICAgICAgICAgICByZXR1cm4gbjtcbiAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICAgIHJldHVybiB1bmRlZmluZWQ7XG4gICAgfVxufVxuLyoqXG4gKiBTaG9ydCBmb3JtYXQgZm9yIGBtc2AuXG4gKlxuICogQHBhcmFtIHtOdW1iZXJ9IG1zXG4gKiBAcmV0dXJuIHtTdHJpbmd9XG4gKiBAYXBpIHByaXZhdGVcbiAqLyBmdW5jdGlvbiBmbXRTaG9ydChtcykge1xuICAgIHZhciBtc0FicyA9IE1hdGguYWJzKG1zKTtcbiAgICBpZiAobXNBYnMgPj0gZCkge1xuICAgICAgICByZXR1cm4gTWF0aC5yb3VuZChtcyAvIGQpICsgJ2QnO1xuICAgIH1cbiAgICBpZiAobXNBYnMgPj0gaCkge1xuICAgICAgICByZXR1cm4gTWF0aC5yb3VuZChtcyAvIGgpICsgJ2gnO1xuICAgIH1cbiAgICBpZiAobXNBYnMgPj0gbSkge1xuICAgICAgICByZXR1cm4gTWF0aC5yb3VuZChtcyAvIG0pICsgJ20nO1xuICAgIH1cbiAgICBpZiAobXNBYnMgPj0gcykge1xuICAgICAgICByZXR1cm4gTWF0aC5yb3VuZChtcyAvIHMpICsgJ3MnO1xuICAgIH1cbiAgICByZXR1cm4gbXMgKyAnbXMnO1xufVxuLyoqXG4gKiBMb25nIGZvcm1hdCBmb3IgYG1zYC5cbiAqXG4gKiBAcGFyYW0ge051bWJlcn0gbXNcbiAqIEByZXR1cm4ge1N0cmluZ31cbiAqIEBhcGkgcHJpdmF0ZVxuICovIGZ1bmN0aW9uIGZtdExvbmcobXMpIHtcbiAgICB2YXIgbXNBYnMgPSBNYXRoLmFicyhtcyk7XG4gICAgaWYgKG1zQWJzID49IGQpIHtcbiAgICAgICAgcmV0dXJuIHBsdXJhbChtcywgbXNBYnMsIGQsICdkYXknKTtcbiAgICB9XG4gICAgaWYgKG1zQWJzID49IGgpIHtcbiAgICAgICAgcmV0dXJuIHBsdXJhbChtcywgbXNBYnMsIGgsICdob3VyJyk7XG4gICAgfVxuICAgIGlmIChtc0FicyA+PSBtKSB7XG4gICAgICAgIHJldHVybiBwbHVyYWwobXMsIG1zQWJzLCBtLCAnbWludXRlJyk7XG4gICAgfVxuICAgIGlmIChtc0FicyA+PSBzKSB7XG4gICAgICAgIHJldHVybiBwbHVyYWwobXMsIG1zQWJzLCBzLCAnc2Vjb25kJyk7XG4gICAgfVxuICAgIHJldHVybiBtcyArICcgbXMnO1xufVxuLyoqXG4gKiBQbHVyYWxpemF0aW9uIGhlbHBlci5cbiAqLyBmdW5jdGlvbiBwbHVyYWwobXMsIG1zQWJzLCBuLCBuYW1lKSB7XG4gICAgdmFyIGlzUGx1cmFsID0gbXNBYnMgPj0gbiAqIDEuNTtcbiAgICByZXR1cm4gTWF0aC5yb3VuZChtcyAvIG4pICsgJyAnICsgbmFtZSArIChpc1BsdXJhbCA/ICdzJyA6ICcnKTtcbn1cbiIsICIvKipfX2ludGVybmFsX3dvcmtmbG93c3tcIndvcmtmbG93c1wiOntcInNyYy93b3JrZmxvd3MvYW5hbHlzaXNSdW4udHNcIjp7XCJhbmFseXNpc1J1blwiOntcIndvcmtmbG93SWRcIjpcIndvcmtmbG93Ly8uL3NyYy93b3JrZmxvd3MvYW5hbHlzaXNSdW4vL2FuYWx5c2lzUnVuXCJ9fX0sXCJzdGVwc1wiOntcInNyYy93b3JrZmxvd3MvYW5hbHlzaXNSdW4udHNcIjp7XCJjbGFpbVF1ZXVlZFJ1blwiOntcInN0ZXBJZFwiOlwic3RlcC8vLi9zcmMvd29ya2Zsb3dzL2FuYWx5c2lzUnVuLy9jbGFpbVF1ZXVlZFJ1blwifSxcImNvbXBsZXRlUGVyc2lzdGVkUnVuXCI6e1wic3RlcElkXCI6XCJzdGVwLy8uL3NyYy93b3JrZmxvd3MvYW5hbHlzaXNSdW4vL2NvbXBsZXRlUGVyc2lzdGVkUnVuXCJ9LFwiZXhlY3V0ZUdyb3VuZGVkQW5hbHlzaXNcIjp7XCJzdGVwSWRcIjpcInN0ZXAvLy4vc3JjL3dvcmtmbG93cy9hbmFseXNpc1J1bi8vZXhlY3V0ZUdyb3VuZGVkQW5hbHlzaXNcIn0sXCJsb2FkUnVuXCI6e1wic3RlcElkXCI6XCJzdGVwLy8uL3NyYy93b3JrZmxvd3MvYW5hbHlzaXNSdW4vL2xvYWRSdW5cIn0sXCJub3JtYWxpemVHcm91bmRlZFBhY2tldFwiOntcInN0ZXBJZFwiOlwic3RlcC8vLi9zcmMvd29ya2Zsb3dzL2FuYWx5c2lzUnVuLy9ub3JtYWxpemVHcm91bmRlZFBhY2tldFwifSxcIm9ic2VydmVBdXRob3JpdGF0aXZlU3RhdGVcIjp7XCJzdGVwSWRcIjpcInN0ZXAvLy4vc3JjL3dvcmtmbG93cy9hbmFseXNpc1J1bi8vb2JzZXJ2ZUF1dGhvcml0YXRpdmVTdGF0ZVwifSxcInBlcnNpc3RHcm91bmRlZFBhY2tldFwiOntcInN0ZXBJZFwiOlwic3RlcC8vLi9zcmMvd29ya2Zsb3dzL2FuYWx5c2lzUnVuLy9wZXJzaXN0R3JvdW5kZWRQYWNrZXRcIn0sXCJyZWNvcmRDYW5jZWxsZWRSdW5cIjp7XCJzdGVwSWRcIjpcInN0ZXAvLy4vc3JjL3dvcmtmbG93cy9hbmFseXNpc1J1bi8vcmVjb3JkQ2FuY2VsbGVkUnVuXCJ9LFwicmVjb3JkRmFpbHVyZVwiOntcInN0ZXBJZFwiOlwic3RlcC8vLi9zcmMvd29ya2Zsb3dzL2FuYWx5c2lzUnVuLy9yZWNvcmRGYWlsdXJlXCJ9LFwicmVjb3JkVGVsZW1ldHJ5QWZ0ZXJQZXJzaXN0ZW5jZVwiOntcInN0ZXBJZFwiOlwic3RlcC8vLi9zcmMvd29ya2Zsb3dzL2FuYWx5c2lzUnVuLy9yZWNvcmRUZWxlbWV0cnlBZnRlclBlcnNpc3RlbmNlXCJ9fX19Ki87XG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gYW5hbHlzaXNSdW4oYXBwbGljYXRpb25SdW5JZCkge1xuICAgIGNvbnN0IGN1cnJlbnQgPSBhd2FpdCBsb2FkUnVuKGFwcGxpY2F0aW9uUnVuSWQpO1xuICAgIGlmIChjdXJyZW50LnN0YXR1cyA9PT0gJ3F1ZXVlZCcpIHtcbiAgICAgICAgY29uc3QgY2xhaW0gPSBhd2FpdCBjbGFpbVF1ZXVlZFJ1bihhcHBsaWNhdGlvblJ1bklkKTtcbiAgICAgICAgaWYgKGNsYWltLm9rKSB7XG4gICAgICAgICAgICBjb25zdCBjbGFpbWVkID0gYXdhaXQgbG9hZFJ1bihhcHBsaWNhdGlvblJ1bklkKTtcbiAgICAgICAgICAgIGlmIChjbGFpbWVkLnBvbGljeVNuYXBzaG90Lm1vZGUgPT09ICdwaGFzZTMyX25vb3AnKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgY29tcGxldGVkID0gYXdhaXQgY29tcGxldGVQZXJzaXN0ZWRSdW4oYXBwbGljYXRpb25SdW5JZCk7XG4gICAgICAgICAgICAgICAgaWYgKGNvbXBsZXRlZC5vaykgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICAgICAgYXBwbGljYXRpb25SdW5JZCxcbiAgICAgICAgICAgICAgICAgICAgdGVybWluYWxTdGF0dXM6ICdjb21wbGV0ZWQnXG4gICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgICAgICByZXR1cm4gYXdhaXQgb2JzZXJ2ZUF1dGhvcml0YXRpdmVTdGF0ZShhcHBsaWNhdGlvblJ1bklkKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGNvbnN0IGV4ZWN1dGlvbiA9IGF3YWl0IGV4ZWN1dGVHcm91bmRlZEFuYWx5c2lzKGFwcGxpY2F0aW9uUnVuSWQpO1xuICAgICAgICAgICAgaWYgKCFleGVjdXRpb24ub2spIHtcbiAgICAgICAgICAgICAgICBjb25zdCBmYWlsZWQgPSBhd2FpdCByZWNvcmRGYWlsdXJlKGFwcGxpY2F0aW9uUnVuSWQsIGV4ZWN1dGlvbi5zYWZlUmVhc29uKTtcbiAgICAgICAgICAgICAgICBpZiAoZmFpbGVkLm9rKSByZXR1cm4ge1xuICAgICAgICAgICAgICAgICAgICBhcHBsaWNhdGlvblJ1bklkLFxuICAgICAgICAgICAgICAgICAgICB0ZXJtaW5hbFN0YXR1czogJ2ZhaWxlZCdcbiAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgICAgIHJldHVybiBhd2FpdCBvYnNlcnZlQXV0aG9yaXRhdGl2ZVN0YXRlKGFwcGxpY2F0aW9uUnVuSWQpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY29uc3Qgbm9ybWFsaXplZCA9IGF3YWl0IG5vcm1hbGl6ZUdyb3VuZGVkUGFja2V0KGFwcGxpY2F0aW9uUnVuSWQsIGV4ZWN1dGlvbi5leGVjdXRpb24pO1xuICAgICAgICAgICAgaWYgKCFub3JtYWxpemVkLm9rKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgZmFpbGVkID0gYXdhaXQgcmVjb3JkRmFpbHVyZShhcHBsaWNhdGlvblJ1bklkLCAnZXhlY3V0aW9uX2ZhaWxlZCcpO1xuICAgICAgICAgICAgICAgIGlmIChmYWlsZWQub2spIHJldHVybiB7XG4gICAgICAgICAgICAgICAgICAgIGFwcGxpY2F0aW9uUnVuSWQsXG4gICAgICAgICAgICAgICAgICAgIHRlcm1pbmFsU3RhdHVzOiAnZmFpbGVkJ1xuICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICAgICAgcmV0dXJuIGF3YWl0IG9ic2VydmVBdXRob3JpdGF0aXZlU3RhdGUoYXBwbGljYXRpb25SdW5JZCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBjb25zdCBwZXJzaXN0ZWQgPSBhd2FpdCBwZXJzaXN0R3JvdW5kZWRQYWNrZXQoYXBwbGljYXRpb25SdW5JZCwgbm9ybWFsaXplZC5wYWNrZXQpO1xuICAgICAgICAgICAgaWYgKCFwZXJzaXN0ZWQub2spIHtcbiAgICAgICAgICAgICAgICBjb25zdCBmYWlsZWQgPSBhd2FpdCByZWNvcmRGYWlsdXJlKGFwcGxpY2F0aW9uUnVuSWQsICdleGVjdXRpb25fZmFpbGVkJyk7XG4gICAgICAgICAgICAgICAgaWYgKGZhaWxlZC5vaykgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICAgICAgYXBwbGljYXRpb25SdW5JZCxcbiAgICAgICAgICAgICAgICAgICAgdGVybWluYWxTdGF0dXM6ICdmYWlsZWQnXG4gICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgICAgICByZXR1cm4gYXdhaXQgb2JzZXJ2ZUF1dGhvcml0YXRpdmVTdGF0ZShhcHBsaWNhdGlvblJ1bklkKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGF3YWl0IHJlY29yZFRlbGVtZXRyeUFmdGVyUGVyc2lzdGVuY2UoYXBwbGljYXRpb25SdW5JZCwgZXhlY3V0aW9uLmV4ZWN1dGlvbiwgbm9ybWFsaXplZC5wYWNrZXQpO1xuICAgICAgICAgICAgY29uc3QgY29tcGxldGVkID0gYXdhaXQgY29tcGxldGVQZXJzaXN0ZWRSdW4oYXBwbGljYXRpb25SdW5JZCk7XG4gICAgICAgICAgICBpZiAoY29tcGxldGVkLm9rKSByZXR1cm4ge1xuICAgICAgICAgICAgICAgIGFwcGxpY2F0aW9uUnVuSWQsXG4gICAgICAgICAgICAgICAgdGVybWluYWxTdGF0dXM6ICdjb21wbGV0ZWQnXG4gICAgICAgICAgICB9O1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBhd2FpdCBvYnNlcnZlQXV0aG9yaXRhdGl2ZVN0YXRlKGFwcGxpY2F0aW9uUnVuSWQpO1xuICAgIH1cbiAgICBpZiAoY3VycmVudC5zdGF0dXMgPT09ICdydW5uaW5nJykge1xuICAgICAgICBjb25zdCB0aW1lb3V0U2Vjb25kcyA9IGN1cnJlbnQucG9saWN5U25hcHNob3QubW9kZSA9PT0gJ3BoYXNlMzJfbm9vcCcgPyA1IDogY3VycmVudC5wb2xpY3lTbmFwc2hvdC5lZmZlY3RpdmVNYXhFeGVjdXRpb25TZWNvbmRzO1xuICAgICAgICBjb25zdCB3aW5kb3dFeHBpcmVkID0gY3VycmVudC5zdGFydGVkQXQgIT09IG51bGwgJiYgRGF0ZS5ub3coKSAtIGN1cnJlbnQuc3RhcnRlZEF0LmdldFRpbWUoKSA+IHRpbWVvdXRTZWNvbmRzICogMV8wMDA7XG4gICAgICAgIGNvbnN0IHRlcm1pbmFsID0gd2luZG93RXhwaXJlZCA/IGF3YWl0IHJlY29yZEZhaWx1cmUoYXBwbGljYXRpb25SdW5JZCwgJ3RpbWVkX291dCcpIDogYXdhaXQgcmVjb3JkQ2FuY2VsbGVkUnVuKGFwcGxpY2F0aW9uUnVuSWQpO1xuICAgICAgICBpZiAodGVybWluYWwub2spIHJldHVybiB7XG4gICAgICAgICAgICBhcHBsaWNhdGlvblJ1bklkLFxuICAgICAgICAgICAgdGVybWluYWxTdGF0dXM6IHdpbmRvd0V4cGlyZWQgPyAnZmFpbGVkJyA6ICdjYW5jZWxsZWQnXG4gICAgICAgIH07XG4gICAgfVxuICAgIHJldHVybiBhd2FpdCBvYnNlcnZlQXV0aG9yaXRhdGl2ZVN0YXRlKGFwcGxpY2F0aW9uUnVuSWQpO1xufVxuYW5hbHlzaXNSdW4ud29ya2Zsb3dJZCA9IFwid29ya2Zsb3cvLy4vc3JjL3dvcmtmbG93cy9hbmFseXNpc1J1bi8vYW5hbHlzaXNSdW5cIjtcbmdsb2JhbFRoaXMuX19wcml2YXRlX3dvcmtmbG93cy5zZXQoXCJ3b3JrZmxvdy8vLi9zcmMvd29ya2Zsb3dzL2FuYWx5c2lzUnVuLy9hbmFseXNpc1J1blwiLCBhbmFseXNpc1J1bik7XG52YXIgbG9hZFJ1biA9IGdsb2JhbFRoaXNbU3ltYm9sLmZvcihcIldPUktGTE9XX1VTRV9TVEVQXCIpXShcInN0ZXAvLy4vc3JjL3dvcmtmbG93cy9hbmFseXNpc1J1bi8vbG9hZFJ1blwiKTtcbnZhciBjbGFpbVF1ZXVlZFJ1biA9IGdsb2JhbFRoaXNbU3ltYm9sLmZvcihcIldPUktGTE9XX1VTRV9TVEVQXCIpXShcInN0ZXAvLy4vc3JjL3dvcmtmbG93cy9hbmFseXNpc1J1bi8vY2xhaW1RdWV1ZWRSdW5cIik7XG52YXIgZXhlY3V0ZUdyb3VuZGVkQW5hbHlzaXMgPSBnbG9iYWxUaGlzW1N5bWJvbC5mb3IoXCJXT1JLRkxPV19VU0VfU1RFUFwiKV0oXCJzdGVwLy8uL3NyYy93b3JrZmxvd3MvYW5hbHlzaXNSdW4vL2V4ZWN1dGVHcm91bmRlZEFuYWx5c2lzXCIpO1xudmFyIG5vcm1hbGl6ZUdyb3VuZGVkUGFja2V0ID0gZ2xvYmFsVGhpc1tTeW1ib2wuZm9yKFwiV09SS0ZMT1dfVVNFX1NURVBcIildKFwic3RlcC8vLi9zcmMvd29ya2Zsb3dzL2FuYWx5c2lzUnVuLy9ub3JtYWxpemVHcm91bmRlZFBhY2tldFwiKTtcbnZhciBwZXJzaXN0R3JvdW5kZWRQYWNrZXQgPSBnbG9iYWxUaGlzW1N5bWJvbC5mb3IoXCJXT1JLRkxPV19VU0VfU1RFUFwiKV0oXCJzdGVwLy8uL3NyYy93b3JrZmxvd3MvYW5hbHlzaXNSdW4vL3BlcnNpc3RHcm91bmRlZFBhY2tldFwiKTtcbnZhciByZWNvcmRUZWxlbWV0cnlBZnRlclBlcnNpc3RlbmNlID0gZ2xvYmFsVGhpc1tTeW1ib2wuZm9yKFwiV09SS0ZMT1dfVVNFX1NURVBcIildKFwic3RlcC8vLi9zcmMvd29ya2Zsb3dzL2FuYWx5c2lzUnVuLy9yZWNvcmRUZWxlbWV0cnlBZnRlclBlcnNpc3RlbmNlXCIpO1xudmFyIGNvbXBsZXRlUGVyc2lzdGVkUnVuID0gZ2xvYmFsVGhpc1tTeW1ib2wuZm9yKFwiV09SS0ZMT1dfVVNFX1NURVBcIildKFwic3RlcC8vLi9zcmMvd29ya2Zsb3dzL2FuYWx5c2lzUnVuLy9jb21wbGV0ZVBlcnNpc3RlZFJ1blwiKTtcbnZhciByZWNvcmRGYWlsdXJlID0gZ2xvYmFsVGhpc1tTeW1ib2wuZm9yKFwiV09SS0ZMT1dfVVNFX1NURVBcIildKFwic3RlcC8vLi9zcmMvd29ya2Zsb3dzL2FuYWx5c2lzUnVuLy9yZWNvcmRGYWlsdXJlXCIpO1xudmFyIHJlY29yZENhbmNlbGxlZFJ1biA9IGdsb2JhbFRoaXNbU3ltYm9sLmZvcihcIldPUktGTE9XX1VTRV9TVEVQXCIpXShcInN0ZXAvLy4vc3JjL3dvcmtmbG93cy9hbmFseXNpc1J1bi8vcmVjb3JkQ2FuY2VsbGVkUnVuXCIpO1xudmFyIG9ic2VydmVBdXRob3JpdGF0aXZlU3RhdGUgPSBnbG9iYWxUaGlzW1N5bWJvbC5mb3IoXCJXT1JLRkxPV19VU0VfU1RFUFwiKV0oXCJzdGVwLy8uL3NyYy93b3JrZmxvd3MvYW5hbHlzaXNSdW4vL29ic2VydmVBdXRob3JpdGF0aXZlU3RhdGVcIik7XG4iLCAiaW1wb3J0IHR5cGUgeyBTdHJpbmdWYWx1ZSB9IGZyb20gJ21zJztcbmltcG9ydCBtcyBmcm9tICdtcyc7XG5cbi8qKlxuICogUGFyc2VzIGEgZHVyYXRpb24gcGFyYW1ldGVyIChzdHJpbmcsIG51bWJlciwgb3IgRGF0ZSkgYW5kIHJldHVybnMgYSBEYXRlIG9iamVjdFxuICogcmVwcmVzZW50aW5nIHdoZW4gdGhlIGR1cmF0aW9uIHNob3VsZCBlbGFwc2UuXG4gKlxuICogLSBGb3Igc3RyaW5nczogUGFyc2VzIGR1cmF0aW9uIHN0cmluZ3MgbGlrZSBcIjFzXCIsIFwiNW1cIiwgXCIxaFwiLCBldGMuIHVzaW5nIHRoZSBgbXNgIGxpYnJhcnlcbiAqIC0gRm9yIG51bWJlcnM6IFRyZWF0cyBhcyBtaWxsaXNlY29uZHMgZnJvbSBub3dcbiAqIC0gRm9yIERhdGUgb2JqZWN0czogUmV0dXJucyB0aGUgZGF0ZSBkaXJlY3RseSAoaGFuZGxlcyBib3RoIERhdGUgaW5zdGFuY2VzIGFuZCBkYXRlLWxpa2Ugb2JqZWN0cyBmcm9tIGRlc2VyaWFsaXphdGlvbilcbiAqXG4gKiBAcGFyYW0gcGFyYW0gLSBUaGUgZHVyYXRpb24gcGFyYW1ldGVyIChTdHJpbmdWYWx1ZSwgRGF0ZSwgb3IgbnVtYmVyIG9mIG1pbGxpc2Vjb25kcylcbiAqIEByZXR1cm5zIEEgRGF0ZSBvYmplY3QgcmVwcmVzZW50aW5nIHdoZW4gdGhlIGR1cmF0aW9uIHNob3VsZCBlbGFwc2VcbiAqIEB0aHJvd3Mge0Vycm9yfSBJZiB0aGUgcGFyYW1ldGVyIGlzIGludmFsaWQgb3IgY2Fubm90IGJlIHBhcnNlZFxuICovXG5leHBvcnQgZnVuY3Rpb24gcGFyc2VEdXJhdGlvblRvRGF0ZShwYXJhbTogU3RyaW5nVmFsdWUgfCBEYXRlIHwgbnVtYmVyKTogRGF0ZSB7XG4gIGlmICh0eXBlb2YgcGFyYW0gPT09ICdzdHJpbmcnKSB7XG4gICAgY29uc3QgZHVyYXRpb25NcyA9IG1zKHBhcmFtKTtcbiAgICBpZiAodHlwZW9mIGR1cmF0aW9uTXMgIT09ICdudW1iZXInIHx8IGR1cmF0aW9uTXMgPCAwKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoXG4gICAgICAgIGBJbnZhbGlkIGR1cmF0aW9uOiBcIiR7cGFyYW19XCIuIEV4cGVjdGVkIGEgdmFsaWQgZHVyYXRpb24gc3RyaW5nIGxpa2UgXCIxc1wiLCBcIjFtXCIsIFwiMWhcIiwgZXRjLmBcbiAgICAgICk7XG4gICAgfVxuICAgIHJldHVybiBuZXcgRGF0ZShEYXRlLm5vdygpICsgZHVyYXRpb25Ncyk7XG4gIH0gZWxzZSBpZiAodHlwZW9mIHBhcmFtID09PSAnbnVtYmVyJykge1xuICAgIGlmIChwYXJhbSA8IDAgfHwgIU51bWJlci5pc0Zpbml0ZShwYXJhbSkpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihcbiAgICAgICAgYEludmFsaWQgZHVyYXRpb246ICR7cGFyYW19LiBFeHBlY3RlZCBhIG5vbi1uZWdhdGl2ZSBmaW5pdGUgbnVtYmVyIG9mIG1pbGxpc2Vjb25kcy5gXG4gICAgICApO1xuICAgIH1cbiAgICByZXR1cm4gbmV3IERhdGUoRGF0ZS5ub3coKSArIHBhcmFtKTtcbiAgfSBlbHNlIGlmIChcbiAgICBwYXJhbSBpbnN0YW5jZW9mIERhdGUgfHxcbiAgICAocGFyYW0gJiZcbiAgICAgIHR5cGVvZiBwYXJhbSA9PT0gJ29iamVjdCcgJiZcbiAgICAgIHR5cGVvZiAocGFyYW0gYXMgYW55KS5nZXRUaW1lID09PSAnZnVuY3Rpb24nKVxuICApIHtcbiAgICAvLyBIYW5kbGUgYm90aCBEYXRlIGluc3RhbmNlcyBhbmQgZGF0ZS1saWtlIG9iamVjdHMgKGZyb20gZGVzZXJpYWxpemF0aW9uKVxuICAgIHJldHVybiBwYXJhbSBpbnN0YW5jZW9mIERhdGUgPyBwYXJhbSA6IG5ldyBEYXRlKChwYXJhbSBhcyBhbnkpLmdldFRpbWUoKSk7XG4gIH0gZWxzZSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKFxuICAgICAgYEludmFsaWQgZHVyYXRpb24gcGFyYW1ldGVyLiBFeHBlY3RlZCBhIGR1cmF0aW9uIHN0cmluZywgbnVtYmVyIChtaWxsaXNlY29uZHMpLCBvciBEYXRlIG9iamVjdC5gXG4gICAgKTtcbiAgfVxufVxuIiwgImltcG9ydCB7IHBhcnNlRHVyYXRpb25Ub0RhdGUgfSBmcm9tICdAd29ya2Zsb3cvdXRpbHMnO1xuaW1wb3J0IHR5cGUgeyBTdHJ1Y3R1cmVkRXJyb3IgfSBmcm9tICdAd29ya2Zsb3cvd29ybGQnO1xuaW1wb3J0IHR5cGUgeyBTdHJpbmdWYWx1ZSB9IGZyb20gJ21zJztcblxuY29uc3QgQkFTRV9VUkwgPSAnaHR0cHM6Ly91c2V3b3JrZmxvdy5kZXYvZXJyJztcblxuLyoqXG4gKiBAaW50ZXJuYWxcbiAqIENoZWNrIGlmIGEgdmFsdWUgaXMgYW4gRXJyb3Igd2l0aG91dCByZWx5aW5nIG9uIE5vZGUuanMgdXRpbGl0aWVzLlxuICogVGhpcyBpcyBuZWVkZWQgZm9yIGVycm9yIGNsYXNzZXMgdGhhdCBjYW4gYmUgdXNlZCBpbiBWTSBjb250ZXh0cyB3aGVyZVxuICogTm9kZS5qcyBpbXBvcnRzIGFyZSBub3QgYXZhaWxhYmxlLlxuICovXG5mdW5jdGlvbiBpc0Vycm9yKHZhbHVlOiB1bmtub3duKTogdmFsdWUgaXMgeyBuYW1lOiBzdHJpbmc7IG1lc3NhZ2U6IHN0cmluZyB9IHtcbiAgcmV0dXJuIChcbiAgICB0eXBlb2YgdmFsdWUgPT09ICdvYmplY3QnICYmXG4gICAgdmFsdWUgIT09IG51bGwgJiZcbiAgICAnbmFtZScgaW4gdmFsdWUgJiZcbiAgICAnbWVzc2FnZScgaW4gdmFsdWVcbiAgKTtcbn1cblxuLyoqXG4gKiBAaW50ZXJuYWxcbiAqIEFsbCB0aGUgc2x1Z3Mgb2YgdGhlIGVycm9ycyB1c2VkIGZvciBkb2N1bWVudGF0aW9uIGxpbmtzLlxuICovXG5leHBvcnQgY29uc3QgRVJST1JfU0xVR1MgPSB7XG4gIE5PREVfSlNfTU9EVUxFX0lOX1dPUktGTE9XOiAnbm9kZS1qcy1tb2R1bGUtaW4td29ya2Zsb3cnLFxuICBTVEFSVF9JTlZBTElEX1dPUktGTE9XX0ZVTkNUSU9OOiAnc3RhcnQtaW52YWxpZC13b3JrZmxvdy1mdW5jdGlvbicsXG4gIFNFUklBTElaQVRJT05fRkFJTEVEOiAnc2VyaWFsaXphdGlvbi1mYWlsZWQnLFxuICBXRUJIT09LX0lOVkFMSURfUkVTUE9ORF9XSVRIX1ZBTFVFOiAnd2ViaG9vay1pbnZhbGlkLXJlc3BvbmQtd2l0aC12YWx1ZScsXG4gIFdFQkhPT0tfUkVTUE9OU0VfTk9UX1NFTlQ6ICd3ZWJob29rLXJlc3BvbnNlLW5vdC1zZW50JyxcbiAgRkVUQ0hfSU5fV09SS0ZMT1dfRlVOQ1RJT046ICdmZXRjaC1pbi13b3JrZmxvdycsXG4gIFRJTUVPVVRfRlVOQ1RJT05TX0lOX1dPUktGTE9XOiAndGltZW91dC1pbi13b3JrZmxvdycsXG4gIEhPT0tfQ09ORkxJQ1Q6ICdob29rLWNvbmZsaWN0JyxcbiAgQ09SUlVQVEVEX0VWRU5UX0xPRzogJ2NvcnJ1cHRlZC1ldmVudC1sb2cnLFxuICBSRVBMQVlfRElWRVJHRU5DRTogJ3JlcGxheS1kaXZlcmdlbmNlJyxcbiAgU1RFUF9OT1RfUkVHSVNURVJFRDogJ3N0ZXAtbm90LXJlZ2lzdGVyZWQnLFxuICBXT1JLRkxPV19OT1RfUkVHSVNURVJFRDogJ3dvcmtmbG93LW5vdC1yZWdpc3RlcmVkJyxcbiAgUlVOVElNRV9ERUNSWVBUSU9OX0ZBSUxFRDogJ3J1bnRpbWUtZGVjcnlwdGlvbi1mYWlsZWQnLFxufSBhcyBjb25zdDtcblxudHlwZSBFcnJvclNsdWcgPSAodHlwZW9mIEVSUk9SX1NMVUdTKVtrZXlvZiB0eXBlb2YgRVJST1JfU0xVR1NdO1xuXG5pbnRlcmZhY2UgV29ya2Zsb3dFcnJvck9wdGlvbnMgZXh0ZW5kcyBFcnJvck9wdGlvbnMge1xuICAvKipcbiAgICogVGhlIHNsdWcgb2YgdGhlIGVycm9yLiBUaGlzIHdpbGwgYmUgdXNlZCB0byBnZW5lcmF0ZSBhIGxpbmsgdG8gdGhlIGVycm9yIGRvY3VtZW50YXRpb24uXG4gICAqL1xuICBzbHVnPzogRXJyb3JTbHVnO1xufVxuXG4vKipcbiAqIFRoZSBiYXNlIGNsYXNzIGZvciBhbGwgV29ya2Zsb3ctcmVsYXRlZCBlcnJvcnMuXG4gKlxuICogVGhpcyBlcnJvciBpcyB0aHJvd24gYnkgdGhlIFdvcmtmbG93IFNESyB3aGVuIGludGVybmFsIG9wZXJhdGlvbnMgZmFpbC5cbiAqIFlvdSBjYW4gdXNlIHRoaXMgY2xhc3Mgd2l0aCBgaW5zdGFuY2VvZmAgdG8gY2F0Y2ggYW55IFdvcmtmbG93IFNESyBlcnJvci5cbiAqXG4gKiBAZXhhbXBsZVxuICogYGBgdHNcbiAqIHRyeSB7XG4gKiAgIGF3YWl0IGdldFJ1bihydW5JZCk7XG4gKiB9IGNhdGNoIChlcnJvcikge1xuICogICBpZiAoZXJyb3IgaW5zdGFuY2VvZiBXb3JrZmxvd0Vycm9yKSB7XG4gKiAgICAgY29uc29sZS5lcnJvcignV29ya2Zsb3cgU0RLIGVycm9yOicsIGVycm9yLm1lc3NhZ2UpO1xuICogICB9XG4gKiB9XG4gKiBgYGBcbiAqL1xuZXhwb3J0IGNsYXNzIFdvcmtmbG93RXJyb3IgZXh0ZW5kcyBFcnJvciB7XG4gIHJlYWRvbmx5IGNhdXNlPzogdW5rbm93bjtcblxuICBjb25zdHJ1Y3RvcihtZXNzYWdlOiBzdHJpbmcsIG9wdGlvbnM/OiBXb3JrZmxvd0Vycm9yT3B0aW9ucykge1xuICAgIGNvbnN0IG1zZ0RvY3MgPSBvcHRpb25zPy5zbHVnXG4gICAgICA/IGAke21lc3NhZ2V9XFxuXFxuTGVhcm4gbW9yZTogJHtCQVNFX1VSTH0vJHtvcHRpb25zLnNsdWd9YFxuICAgICAgOiBtZXNzYWdlO1xuICAgIHN1cGVyKG1zZ0RvY3MsIHsgY2F1c2U6IG9wdGlvbnM/LmNhdXNlIH0pO1xuICAgIHRoaXMuY2F1c2UgPSBvcHRpb25zPy5jYXVzZTtcblxuICAgIGlmIChvcHRpb25zPy5jYXVzZSBpbnN0YW5jZW9mIEVycm9yKSB7XG4gICAgICB0aGlzLnN0YWNrID0gYCR7dGhpcy5zdGFja31cXG5DYXVzZWQgYnk6ICR7b3B0aW9ucy5jYXVzZS5zdGFja31gO1xuICAgIH1cbiAgfVxuXG4gIHN0YXRpYyBpcyh2YWx1ZTogdW5rbm93bik6IHZhbHVlIGlzIFdvcmtmbG93RXJyb3Ige1xuICAgIHJldHVybiBpc0Vycm9yKHZhbHVlKSAmJiB2YWx1ZS5uYW1lID09PSAnV29ya2Zsb3dFcnJvcic7XG4gIH1cbn1cblxuLyoqXG4gKiBUaHJvd24gd2hlbiBhIHdvcmxkIChzdG9yYWdlIGJhY2tlbmQpIG9wZXJhdGlvbiBmYWlscyB1bmV4cGVjdGVkbHkuXG4gKlxuICogVGhpcyBpcyB0aGUgY2F0Y2gtYWxsIGVycm9yIGZvciB3b3JsZCBpbXBsZW1lbnRhdGlvbnMuIFNwZWNpZmljLFxuICogd2VsbC1rbm93biBmYWlsdXJlIG1vZGVzIGhhdmUgZGVkaWNhdGVkIGVycm9yIHR5cGVzIChlLmcuXG4gKiBFbnRpdHlDb25mbGljdEVycm9yLCBSdW5FeHBpcmVkRXJyb3IsIFRocm90dGxlRXJyb3IpLiBUaGlzIGVycm9yXG4gKiBjb3ZlcnMgZXZlcnl0aGluZyBlbHNlIOKAlCB2YWxpZGF0aW9uIGZhaWx1cmVzLCBtaXNzaW5nIGVudGl0aWVzXG4gKiB3aXRob3V0IGEgZGVkaWNhdGVkIHR5cGUsIG9yIHVuZXhwZWN0ZWQgSFRUUCBlcnJvcnMgZnJvbSB3b3JsZC12ZXJjZWwuXG4gKi9cbmV4cG9ydCBjbGFzcyBXb3JrZmxvd1dvcmxkRXJyb3IgZXh0ZW5kcyBXb3JrZmxvd0Vycm9yIHtcbiAgc3RhdHVzPzogbnVtYmVyO1xuICBjb2RlPzogc3RyaW5nO1xuICB1cmw/OiBzdHJpbmc7XG4gIC8qKiBSZXRyeS1BZnRlciB2YWx1ZSBpbiBzZWNvbmRzLCBwcmVzZW50IG9uIDQyOSBhbmQgNDI1IHJlc3BvbnNlcyAqL1xuICByZXRyeUFmdGVyPzogbnVtYmVyO1xuXG4gIGNvbnN0cnVjdG9yKFxuICAgIG1lc3NhZ2U6IHN0cmluZyxcbiAgICBvcHRpb25zPzoge1xuICAgICAgc3RhdHVzPzogbnVtYmVyO1xuICAgICAgdXJsPzogc3RyaW5nO1xuICAgICAgY29kZT86IHN0cmluZztcbiAgICAgIHJldHJ5QWZ0ZXI/OiBudW1iZXI7XG4gICAgICBjYXVzZT86IHVua25vd247XG4gICAgfVxuICApIHtcbiAgICBzdXBlcihtZXNzYWdlLCB7XG4gICAgICBjYXVzZTogb3B0aW9ucz8uY2F1c2UsXG4gICAgfSk7XG4gICAgdGhpcy5uYW1lID0gJ1dvcmtmbG93V29ybGRFcnJvcic7XG4gICAgdGhpcy5zdGF0dXMgPSBvcHRpb25zPy5zdGF0dXM7XG4gICAgdGhpcy5jb2RlID0gb3B0aW9ucz8uY29kZTtcbiAgICB0aGlzLnVybCA9IG9wdGlvbnM/LnVybDtcbiAgICB0aGlzLnJldHJ5QWZ0ZXIgPSBvcHRpb25zPy5yZXRyeUFmdGVyO1xuICB9XG5cbiAgc3RhdGljIGlzKHZhbHVlOiB1bmtub3duKTogdmFsdWUgaXMgV29ya2Zsb3dXb3JsZEVycm9yIHtcbiAgICByZXR1cm4gaXNFcnJvcih2YWx1ZSkgJiYgdmFsdWUubmFtZSA9PT0gJ1dvcmtmbG93V29ybGRFcnJvcic7XG4gIH1cbn1cblxuLyoqXG4gKiBUaHJvd24gd2hlbiBhIHdvcmtmbG93IHJ1biBmYWlscyBkdXJpbmcgZXhlY3V0aW9uLlxuICpcbiAqIFRoaXMgZXJyb3IgaW5kaWNhdGVzIHRoYXQgdGhlIHdvcmtmbG93IGVuY291bnRlcmVkIGEgZmF0YWwgZXJyb3IgYW5kIGNhbm5vdFxuICogY29udGludWUuIEl0IGlzIHRocm93biB3aGVuIGF3YWl0aW5nIGBydW4ucmV0dXJuVmFsdWVgIG9uIGEgcnVuIHdob3NlIHN0YXR1c1xuICogaXMgYCdmYWlsZWQnYC4gVGhlIGBjYXVzZWAgcHJvcGVydHkgY29udGFpbnMgdGhlIHVuZGVybHlpbmcgZXJyb3Igd2l0aCBpdHNcbiAqIG1lc3NhZ2UsIHN0YWNrIHRyYWNlLCBhbmQgb3B0aW9uYWwgZXJyb3IgY29kZS5cbiAqXG4gKiBVc2UgdGhlIHN0YXRpYyBgV29ya2Zsb3dSdW5GYWlsZWRFcnJvci5pcygpYCBtZXRob2QgZm9yIHR5cGUtc2FmZSBjaGVja2luZ1xuICogaW4gY2F0Y2ggYmxvY2tzLlxuICpcbiAqIEBleGFtcGxlXG4gKiBgYGB0c1xuICogaW1wb3J0IHsgV29ya2Zsb3dSdW5GYWlsZWRFcnJvciB9IGZyb20gXCJ3b3JrZmxvdy9pbnRlcm5hbC9lcnJvcnNcIjtcbiAqXG4gKiB0cnkge1xuICogICBjb25zdCByZXN1bHQgPSBhd2FpdCBydW4ucmV0dXJuVmFsdWU7XG4gKiB9IGNhdGNoIChlcnJvcikge1xuICogICBpZiAoV29ya2Zsb3dSdW5GYWlsZWRFcnJvci5pcyhlcnJvcikpIHtcbiAqICAgICBjb25zb2xlLmVycm9yKGBSdW4gJHtlcnJvci5ydW5JZH0gZmFpbGVkOmAsIGVycm9yLmNhdXNlLm1lc3NhZ2UpO1xuICogICB9XG4gKiB9XG4gKiBgYGBcbiAqL1xuZXhwb3J0IGNsYXNzIFdvcmtmbG93UnVuRmFpbGVkRXJyb3IgZXh0ZW5kcyBXb3JrZmxvd0Vycm9yIHtcbiAgcnVuSWQ6IHN0cmluZztcbiAgZGVjbGFyZSBjYXVzZTogRXJyb3IgJiB7IGNvZGU/OiBzdHJpbmcgfTtcblxuICBjb25zdHJ1Y3RvcihydW5JZDogc3RyaW5nLCBlcnJvcjogU3RydWN0dXJlZEVycm9yKSB7XG4gICAgLy8gQ3JlYXRlIGEgcHJvcGVyIEVycm9yIGluc3RhbmNlIGZyb20gdGhlIFN0cnVjdHVyZWRFcnJvciB0byBzZXQgYXMgY2F1c2VcbiAgICAvLyBOT1RFOiBjdXN0b20gZXJyb3IgdHlwZXMgZG8gbm90IGdldCBzZXJpYWxpemVkL2Rlc2VyaWFsaXplZC4gRXZlcnl0aGluZyBpcyBhbiBFcnJvclxuICAgIGNvbnN0IGNhdXNlRXJyb3IgPSBuZXcgRXJyb3IoZXJyb3IubWVzc2FnZSk7XG4gICAgaWYgKGVycm9yLnN0YWNrKSB7XG4gICAgICBjYXVzZUVycm9yLnN0YWNrID0gZXJyb3Iuc3RhY2s7XG4gICAgfVxuICAgIGlmIChlcnJvci5jb2RlKSB7XG4gICAgICAoY2F1c2VFcnJvciBhcyBhbnkpLmNvZGUgPSBlcnJvci5jb2RlO1xuICAgIH1cblxuICAgIHN1cGVyKGBXb3JrZmxvdyBydW4gXCIke3J1bklkfVwiIGZhaWxlZDogJHtlcnJvci5tZXNzYWdlfWAsIHtcbiAgICAgIGNhdXNlOiBjYXVzZUVycm9yLFxuICAgIH0pO1xuICAgIHRoaXMubmFtZSA9ICdXb3JrZmxvd1J1bkZhaWxlZEVycm9yJztcbiAgICB0aGlzLnJ1bklkID0gcnVuSWQ7XG4gIH1cblxuICBzdGF0aWMgaXModmFsdWU6IHVua25vd24pOiB2YWx1ZSBpcyBXb3JrZmxvd1J1bkZhaWxlZEVycm9yIHtcbiAgICByZXR1cm4gaXNFcnJvcih2YWx1ZSkgJiYgdmFsdWUubmFtZSA9PT0gJ1dvcmtmbG93UnVuRmFpbGVkRXJyb3InO1xuICB9XG59XG5cbi8qKlxuICogVGhyb3duIHdoZW4gYXR0ZW1wdGluZyB0byBnZXQgcmVzdWx0cyBmcm9tIGFuIGluY29tcGxldGUgd29ya2Zsb3cgcnVuLlxuICpcbiAqIFRoaXMgZXJyb3Igb2NjdXJzIHdoZW4geW91IHRyeSB0byBhY2Nlc3MgdGhlIHJlc3VsdCBvZiBhIHdvcmtmbG93XG4gKiB0aGF0IGlzIHN0aWxsIHJ1bm5pbmcgb3IgaGFzbid0IGNvbXBsZXRlZCB5ZXQuXG4gKi9cbmV4cG9ydCBjbGFzcyBXb3JrZmxvd1J1bk5vdENvbXBsZXRlZEVycm9yIGV4dGVuZHMgV29ya2Zsb3dFcnJvciB7XG4gIHJ1bklkOiBzdHJpbmc7XG4gIHN0YXR1czogc3RyaW5nO1xuXG4gIGNvbnN0cnVjdG9yKHJ1bklkOiBzdHJpbmcsIHN0YXR1czogc3RyaW5nKSB7XG4gICAgc3VwZXIoYFdvcmtmbG93IHJ1biBcIiR7cnVuSWR9XCIgaGFzIG5vdCBjb21wbGV0ZWRgLCB7fSk7XG4gICAgdGhpcy5uYW1lID0gJ1dvcmtmbG93UnVuTm90Q29tcGxldGVkRXJyb3InO1xuICAgIHRoaXMucnVuSWQgPSBydW5JZDtcbiAgICB0aGlzLnN0YXR1cyA9IHN0YXR1cztcbiAgfVxuXG4gIHN0YXRpYyBpcyh2YWx1ZTogdW5rbm93bik6IHZhbHVlIGlzIFdvcmtmbG93UnVuTm90Q29tcGxldGVkRXJyb3Ige1xuICAgIHJldHVybiBpc0Vycm9yKHZhbHVlKSAmJiB2YWx1ZS5uYW1lID09PSAnV29ya2Zsb3dSdW5Ob3RDb21wbGV0ZWRFcnJvcic7XG4gIH1cbn1cblxuLyoqXG4gKiBUaHJvd24gd2hlbiB0aGUgV29ya2Zsb3cgcnVudGltZSBlbmNvdW50ZXJzIGFuIGludGVybmFsIGVycm9yLlxuICpcbiAqIFRoaXMgZXJyb3IgaW5kaWNhdGVzIGFuIGlzc3VlIHdpdGggd29ya2Zsb3cgZXhlY3V0aW9uLCBzdWNoIGFzXG4gKiBzZXJpYWxpemF0aW9uIGZhaWx1cmVzLCBzdGFydGluZyBhbiBpbnZhbGlkIHdvcmtmbG93IGZ1bmN0aW9uLCBvclxuICogb3RoZXIgcnVudGltZSBwcm9ibGVtcy5cbiAqL1xuZXhwb3J0IGNsYXNzIFdvcmtmbG93UnVudGltZUVycm9yIGV4dGVuZHMgV29ya2Zsb3dFcnJvciB7XG4gIGNvbnN0cnVjdG9yKG1lc3NhZ2U6IHN0cmluZywgb3B0aW9ucz86IFdvcmtmbG93RXJyb3JPcHRpb25zKSB7XG4gICAgc3VwZXIobWVzc2FnZSwge1xuICAgICAgLi4ub3B0aW9ucyxcbiAgICB9KTtcbiAgICB0aGlzLm5hbWUgPSAnV29ya2Zsb3dSdW50aW1lRXJyb3InO1xuICB9XG5cbiAgc3RhdGljIGlzKHZhbHVlOiB1bmtub3duKTogdmFsdWUgaXMgV29ya2Zsb3dSdW50aW1lRXJyb3Ige1xuICAgIHJldHVybiBpc0Vycm9yKHZhbHVlKSAmJiB2YWx1ZS5uYW1lID09PSAnV29ya2Zsb3dSdW50aW1lRXJyb3InO1xuICB9XG59XG5cbi8qKlxuICogVGhyb3duIHdoZW4gdGhlIHBlcnNpc3RlZCB3b3JrZmxvdyBldmVudCBsb2cgY2Fubm90IGJlIHJlcGxheWVkIGJlY2F1c2UgaXRcbiAqIGNvbnRhaW5zIG9ycGhhbmVkLCBkdXBsaWNhdGUsIG9yIG1pc21hdGNoZWQgZXZlbnRzLlxuICpcbiAqIFRoaXMgaXMgYSBydW50aW1lL2luZnJhc3RydWN0dXJlIGZhaWx1cmUgcmF0aGVyIHRoYW4gdXNlciBjb2RlIHRocm93aW5nLlxuICogV2hlbiB0aGlzIHJlYWNoZXMgcnVuIGZhaWx1cmUgaGFuZGxpbmcsIGl0IGlzIHJlY29yZGVkIHdpdGggdGhlIGRpc3RpbmN0XG4gKiBgQ09SUlVQVEVEX0VWRU5UX0xPR2AgY29kZSBzbyB3b3JsZHMgYW5kIGJhY2tlbmRzIGNhbiB0cmFjayBpdCBzZXBhcmF0ZWx5XG4gKiBmcm9tIGdlbmVyaWMgcnVudGltZSBmYWlsdXJlcy5cbiAqL1xuZXhwb3J0IGNsYXNzIENvcnJ1cHRlZEV2ZW50TG9nRXJyb3IgZXh0ZW5kcyBXb3JrZmxvd1J1bnRpbWVFcnJvciB7XG4gIGNvbnN0cnVjdG9yKG1lc3NhZ2U6IHN0cmluZywgb3B0aW9ucz86IEVycm9yT3B0aW9ucykge1xuICAgIHN1cGVyKG1lc3NhZ2UsIHtcbiAgICAgIC4uLm9wdGlvbnMsXG4gICAgICBzbHVnOiBFUlJPUl9TTFVHUy5DT1JSVVBURURfRVZFTlRfTE9HLFxuICAgIH0pO1xuICAgIHRoaXMubmFtZSA9ICdDb3JydXB0ZWRFdmVudExvZ0Vycm9yJztcbiAgfVxuXG4gIHN0YXRpYyBpcyh2YWx1ZTogdW5rbm93bik6IHZhbHVlIGlzIENvcnJ1cHRlZEV2ZW50TG9nRXJyb3Ige1xuICAgIHJldHVybiBpc0Vycm9yKHZhbHVlKSAmJiB2YWx1ZS5uYW1lID09PSAnQ29ycnVwdGVkRXZlbnRMb2dFcnJvcic7XG4gIH1cbn1cblxuLyoqXG4gKiBUaHJvd24gd2hlbiBhIHJ1bidzIGV2ZW50IGxvZyByZWFjaGVzIHRoZSBzZXJ2ZXItc3VwcGxpZWQgcGVyLXJ1biBldmVudFxuICogY2VpbGluZy4gQ2xhc3NpZmllZCBhcyBgTUFYX0VWRU5UU19FWENFRURFRGAgKHNlZSBgY2xhc3NpZnlSdW5FcnJvcmApLlxuICovXG5leHBvcnQgY2xhc3MgTWF4RXZlbnRzRXhjZWVkZWRFcnJvciBleHRlbmRzIFdvcmtmbG93RXJyb3Ige1xuICByZWFkb25seSBldmVudENvdW50OiBudW1iZXI7XG4gIHJlYWRvbmx5IGxpbWl0OiBudW1iZXI7XG5cbiAgY29uc3RydWN0b3IoXG4gICAgZXZlbnRDb3VudDogbnVtYmVyLFxuICAgIGxpbWl0OiBudW1iZXIsXG4gICAgb3B0aW9ucz86IFdvcmtmbG93RXJyb3JPcHRpb25zXG4gICkge1xuICAgIHN1cGVyKGBXb3JrZmxvdyBleGNlZWRlZCB0aGUgbWF4aW11bSBvZiAke2xpbWl0fSBldmVudHMgcGVyIHJ1bmAsIG9wdGlvbnMpO1xuICAgIHRoaXMubmFtZSA9ICdNYXhFdmVudHNFeGNlZWRlZEVycm9yJztcbiAgICB0aGlzLmV2ZW50Q291bnQgPSBldmVudENvdW50O1xuICAgIHRoaXMubGltaXQgPSBsaW1pdDtcbiAgfVxuXG4gIHN0YXRpYyBpcyh2YWx1ZTogdW5rbm93bik6IHZhbHVlIGlzIE1heEV2ZW50c0V4Y2VlZGVkRXJyb3Ige1xuICAgIHJldHVybiBpc0Vycm9yKHZhbHVlKSAmJiB2YWx1ZS5uYW1lID09PSAnTWF4RXZlbnRzRXhjZWVkZWRFcnJvcic7XG4gIH1cbn1cblxuLyoqXG4gKiBPcHRpb25hbCBzdHJ1Y3R1cmVkIGNvbnRleHQgYXR0YWNoZWQgdG8gYSB7QGxpbmsgUnVudGltZURlY3J5cHRpb25FcnJvcn0sXG4gKiBjYXJyaWVkIG92ZXIgZnJvbSB0aGUgdW5kZXJseWluZyBkZWNyeXB0IGNhbGwgc2l0ZSB0byBoZWxwIGRpYWdub3NlIHRoZVxuICogZmFpbHVyZSB3aXRob3V0IHBva2luZyB0aHJvdWdoIHN0YWNrcy5cbiAqL1xuZXhwb3J0IGludGVyZmFjZSBSdW50aW1lRGVjcnlwdGlvbkVycm9yQ29udGV4dCB7XG4gIC8qKiBUaGUgb3BlcmF0aW9uIHRoYXQgZmFpbGVkIOKAlCB1c2VmdWwgdG8gdGVsbCBlbmNyeXB0IHZzIGRlY3J5cHQgYXBhcnQuICovXG4gIG9wZXJhdGlvbj86ICdlbmNyeXB0JyB8ICdkZWNyeXB0JztcbiAgLyoqIEJ5dGUgbGVuZ3RoIG9mIHRoZSBpbnB1dCBwYXlsb2FkIGF0IHRoZSB0aW1lIG9mIHRoZSBmYWlsdXJlLiAqL1xuICBieXRlTGVuZ3RoPzogbnVtYmVyO1xuICAvKipcbiAgICogVGhlIGZpcnN0IDQgYnl0ZXMgb2YgdGhlIGlucHV0IHBheWxvYWQsIGRlY29kZWQgYXMgVVRGLTggaWYgcHJpbnRhYmxlLlxuICAgKiBVc2VmdWwgZm9yIHRlbGxpbmcgYXBhcnQgdHJ1bmNhdGVkLWJ1dC12YWxpZC1sb29raW5nIGVuY3J5cHRlZCBwYXlsb2Fkc1xuICAgKiBmcm9tIGNvbXBsZXRlbHkgdW5yZWxhdGVkIGNvcnJ1cHRpb24gKGUuZy4gYW4gSFRNTCBlcnJvciBwYWdlIHN1cmZhY2VkXG4gICAqIGFzIGEgMjAwIE9LKS5cbiAgICovXG4gIGZvcm1hdFByZWZpeD86IHN0cmluZztcbn1cblxuLyoqXG4gKiBUaHJvd24gd2hlbiB0aGUgU0RLJ3MgYnVpbHQtaW4gQUVTLUdDTSBlbmNyeXB0aW9uIGxheWVyIGZhaWxzIHRvIGVuY3J5cHRcbiAqIG9yIGRlY3J5cHQgYSB3b3JrZmxvdyBwYXlsb2FkLlxuICpcbiAqIFRoaXMgaXMgYW4gaW50ZXJuYWwgU0RLIGZhaWx1cmUg4oCUIHVzZXIgY29kZSBuZXZlciBpbnZva2VzIHRoZSBTREsnc1xuICogZW5jcnlwdGlvbiBwcmltaXRpdmVzIGRpcmVjdGx5LiBDb21tb24gY2F1c2VzOlxuICpcbiAqIC0gQSBjaXBoZXJ0ZXh0IC8gYXV0aCB0YWcgbWlzbWF0Y2gsIHR5cGljYWxseSBzdXJmYWNlZCBhcyB0aGUgbmF0aXZlIFdlYlxuICogICBDcnlwdG8gYE9wZXJhdGlvbkVycm9yOiBUaGUgb3BlcmF0aW9uIGZhaWxlZCBmb3IgYW4gb3BlcmF0aW9uLXNwZWNpZmljXG4gKiAgIHJlYXNvbmAuIFVzdWFsbHkgY2F1c2VkIGJ5IGNpcGhlcnRleHQgbXV0YXRpb24gb3IgdHJ1bmNhdGlvbiBpbiB0cmFuc2l0XG4gKiAgIGJldHdlZW4gc3RvcmFnZSBhbmQgcmVhZCAodHJ1bmNhdGVkIEhUVFAgcmVzcG9uc2UsIGVkZ2UtY2FjaGUgbWlzc1xuICogICByZXR1cm5pbmcgYSBwYXJ0aWFsIDIwMCwgcHJveHkgZHJvcCBkdXJpbmcgc3RyZWFtaW5nLCBldGMuKS5cbiAqIC0gQSBrZXkgcmVzb2x1dGlvbiBtaXNtYXRjaCAod3JvbmcgZGVwbG95bWVudCwgbWlzc2luZyBrZXkgbWF0ZXJpYWwpLlxuICogLSBBIG1hbGZvcm1lZCBlbmNyeXB0ZWQgZW52ZWxvcGUgKHRvbyBzaG9ydCB0byBjb250YWluIHRoZSBHQ00gbm9uY2VcbiAqICAgYW5kIHRhZykuXG4gKlxuICogRXh0ZW5kcyB7QGxpbmsgV29ya2Zsb3dSdW50aW1lRXJyb3J9IHNvIHRoZSBydW4tZmFpbHVyZSBjbGFzc2lmaWVyXG4gKiByb3V0ZXMgaXQgdG8gYFJVTlRJTUVfRVJST1JgLlxuICovXG5leHBvcnQgY2xhc3MgUnVudGltZURlY3J5cHRpb25FcnJvciBleHRlbmRzIFdvcmtmbG93UnVudGltZUVycm9yIHtcbiAgLyoqIE9wdGlvbmFsIHN0cnVjdHVyZWQgY29udGV4dCBhYm91dCB0aGUgZmFpbGVkIGVuY3J5cHQvZGVjcnlwdCBjYWxsLiAqL1xuICBkZWNsYXJlIHJlYWRvbmx5IGNvbnRleHQ/OiBSdW50aW1lRGVjcnlwdGlvbkVycm9yQ29udGV4dDtcblxuICBjb25zdHJ1Y3RvcihcbiAgICBtZXNzYWdlOiBzdHJpbmcsXG4gICAgb3B0aW9ucz86IEVycm9yT3B0aW9ucyAmIHsgY29udGV4dD86IFJ1bnRpbWVEZWNyeXB0aW9uRXJyb3JDb250ZXh0IH1cbiAgKSB7XG4gICAgc3VwZXIobWVzc2FnZSwge1xuICAgICAgY2F1c2U6IG9wdGlvbnM/LmNhdXNlLFxuICAgICAgc2x1ZzogRVJST1JfU0xVR1MuUlVOVElNRV9ERUNSWVBUSU9OX0ZBSUxFRCxcbiAgICB9KTtcbiAgICB0aGlzLm5hbWUgPSAnUnVudGltZURlY3J5cHRpb25FcnJvcic7XG4gICAgaWYgKG9wdGlvbnM/LmNvbnRleHQgIT09IHVuZGVmaW5lZCkge1xuICAgICAgdGhpcy5jb250ZXh0ID0gb3B0aW9ucy5jb250ZXh0O1xuICAgIH1cbiAgfVxuXG4gIHN0YXRpYyBpcyh2YWx1ZTogdW5rbm93bik6IHZhbHVlIGlzIFJ1bnRpbWVEZWNyeXB0aW9uRXJyb3Ige1xuICAgIHJldHVybiBpc0Vycm9yKHZhbHVlKSAmJiB2YWx1ZS5uYW1lID09PSAnUnVudGltZURlY3J5cHRpb25FcnJvcic7XG4gIH1cbn1cblxuLyoqXG4gKiBUaHJvd24gd2hlbiB0aGUgY3VycmVudCB3b3JrZmxvdyByZXBsYXkgY2Fubm90IGZvbGxvdyB0aGUgcGF0aCBkZXNjcmliZWQgYnlcbiAqIHRoZSByZWNvcmRlZCBldmVudCBsb2cuIEEgc2luZ2xlIGRpdmVyZ2VuY2UgZG9lcyBub3QgcHJvdmUgdGhhdCB0aGVcbiAqIHBlcnNpc3RlZCBoaXN0b3J5IGlzIGludmFsaWQ6IGEgc3Vic2VxdWVudCByZXBsYXkgbWF5IG9ic2VydmUgb3Igc2NoZWR1bGVcbiAqIHdvcmsgY29ycmVjdGx5LCBzbyB0aGUgcnVudGltZSBtYXkgcmVkZWxpdmVyIGJlZm9yZSBkZWNsYXJpbmcgY29ycnVwdGlvbi5cbiAqL1xuZXhwb3J0IGNsYXNzIFJlcGxheURpdmVyZ2VuY2VFcnJvciBleHRlbmRzIFdvcmtmbG93UnVudGltZUVycm9yIHtcbiAgcmVhZG9ubHkgZXZlbnRJZDogc3RyaW5nO1xuXG4gIGNvbnN0cnVjdG9yKG1lc3NhZ2U6IHN0cmluZywgb3B0aW9uczogRXJyb3JPcHRpb25zICYgeyBldmVudElkOiBzdHJpbmcgfSkge1xuICAgIHN1cGVyKG1lc3NhZ2UsIHtcbiAgICAgIC4uLm9wdGlvbnMsXG4gICAgICBzbHVnOiBFUlJPUl9TTFVHUy5SRVBMQVlfRElWRVJHRU5DRSxcbiAgICB9KTtcbiAgICB0aGlzLm5hbWUgPSAnUmVwbGF5RGl2ZXJnZW5jZUVycm9yJztcbiAgICB0aGlzLmV2ZW50SWQgPSBvcHRpb25zLmV2ZW50SWQ7XG4gIH1cblxuICBzdGF0aWMgaXModmFsdWU6IHVua25vd24pOiB2YWx1ZSBpcyBSZXBsYXlEaXZlcmdlbmNlRXJyb3Ige1xuICAgIHJldHVybiBpc0Vycm9yKHZhbHVlKSAmJiB2YWx1ZS5uYW1lID09PSAnUmVwbGF5RGl2ZXJnZW5jZUVycm9yJztcbiAgfVxufVxuXG4vKipcbiAqIFRocm93biB3aGVuIGEgc3RlcCBmdW5jdGlvbiBpcyBub3QgcmVnaXN0ZXJlZCBpbiB0aGUgY3VycmVudCBkZXBsb3ltZW50LlxuICpcbiAqIFRoaXMgaXMgYW4gaW5mcmFzdHJ1Y3R1cmUgZXJyb3Ig4oCUIG5vdCBhIHVzZXIgY29kZSBlcnJvci4gSXQgdHlwaWNhbGx5IG1lYW5zXG4gKiBzb21ldGhpbmcgd2VudCB3cm9uZyB3aXRoIHRoZSBidW5kbGluZy9idWlsZCB0b29saW5nIHRoYXQgY2F1c2VkIHRoZSBzdGVwXG4gKiB0byBub3QgZ2V0IGJ1aWx0IGNvcnJlY3RseS5cbiAqXG4gKiBXaGVuIHRoaXMgaGFwcGVucywgdGhlIHN0ZXAgZmFpbHMgKGxpa2UgYSBGYXRhbEVycm9yKSBhbmQgY29udHJvbCBpcyBwYXNzZWQgYmFja1xuICogdG8gdGhlIHdvcmtmbG93IGZ1bmN0aW9uLCB3aGljaCBjYW4gb3B0aW9uYWxseSBoYW5kbGUgdGhlIGZhaWx1cmUgZ3JhY2VmdWxseS5cbiAqL1xuZXhwb3J0IGNsYXNzIFN0ZXBOb3RSZWdpc3RlcmVkRXJyb3IgZXh0ZW5kcyBXb3JrZmxvd1J1bnRpbWVFcnJvciB7XG4gIHN0ZXBOYW1lOiBzdHJpbmc7XG5cbiAgY29uc3RydWN0b3Ioc3RlcE5hbWU6IHN0cmluZykge1xuICAgIHN1cGVyKFxuICAgICAgYFN0ZXAgXCIke3N0ZXBOYW1lfVwiIGlzIG5vdCByZWdpc3RlcmVkIGluIHRoZSBjdXJyZW50IGRlcGxveW1lbnQuIFRoaXMgdXN1YWxseSBpbmRpY2F0ZXMgYSBidWlsZCBvciBidW5kbGluZyBpc3N1ZSB0aGF0IGNhdXNlZCB0aGUgc3RlcCB0byBub3QgYmUgaW5jbHVkZWQgaW4gdGhlIGRlcGxveW1lbnQuYCxcbiAgICAgIHsgc2x1ZzogRVJST1JfU0xVR1MuU1RFUF9OT1RfUkVHSVNURVJFRCB9XG4gICAgKTtcbiAgICB0aGlzLm5hbWUgPSAnU3RlcE5vdFJlZ2lzdGVyZWRFcnJvcic7XG4gICAgdGhpcy5zdGVwTmFtZSA9IHN0ZXBOYW1lO1xuICB9XG5cbiAgc3RhdGljIGlzKHZhbHVlOiB1bmtub3duKTogdmFsdWUgaXMgU3RlcE5vdFJlZ2lzdGVyZWRFcnJvciB7XG4gICAgcmV0dXJuIGlzRXJyb3IodmFsdWUpICYmIHZhbHVlLm5hbWUgPT09ICdTdGVwTm90UmVnaXN0ZXJlZEVycm9yJztcbiAgfVxufVxuXG4vKipcbiAqIFRocm93biB3aGVuIGEgd29ya2Zsb3cgZnVuY3Rpb24gaXMgbm90IHJlZ2lzdGVyZWQgaW4gdGhlIGN1cnJlbnQgZGVwbG95bWVudC5cbiAqXG4gKiBUaGlzIGlzIGFuIGluZnJhc3RydWN0dXJlIGVycm9yIOKAlCBub3QgYSB1c2VyIGNvZGUgZXJyb3IuIEl0IHR5cGljYWxseSBtZWFuczpcbiAqIC0gQSBydW4gd2FzIHN0YXJ0ZWQgYWdhaW5zdCBhIGRlcGxveW1lbnQgdGhhdCBkb2VzIG5vdCBoYXZlIHRoZSB3b3JrZmxvd1xuICogICAoZS5nLiwgdGhlIHdvcmtmbG93IHdhcyByZW5hbWVkIG9yIG1vdmVkIGFuZCBhIG5ldyBydW4gdGFyZ2V0ZWQgdGhlIGxhdGVzdCBkZXBsb3ltZW50KVxuICogLSBTb21ldGhpbmcgd2VudCB3cm9uZyB3aXRoIHRoZSBidW5kbGluZy9idWlsZCB0b29saW5nIHRoYXQgY2F1c2VkIHRoZSB3b3JrZmxvd1xuICogICB0byBub3QgZ2V0IGJ1aWx0IGNvcnJlY3RseVxuICpcbiAqIFdoZW4gdGhpcyBoYXBwZW5zLCB0aGUgcnVuIGZhaWxzIHdpdGggYSBgUlVOVElNRV9FUlJPUmAgZXJyb3IgY29kZS5cbiAqL1xuZXhwb3J0IGNsYXNzIFdvcmtmbG93Tm90UmVnaXN0ZXJlZEVycm9yIGV4dGVuZHMgV29ya2Zsb3dSdW50aW1lRXJyb3Ige1xuICB3b3JrZmxvd05hbWU6IHN0cmluZztcblxuICBjb25zdHJ1Y3Rvcih3b3JrZmxvd05hbWU6IHN0cmluZykge1xuICAgIHN1cGVyKFxuICAgICAgYFdvcmtmbG93IFwiJHt3b3JrZmxvd05hbWV9XCIgaXMgbm90IHJlZ2lzdGVyZWQgaW4gdGhlIGN1cnJlbnQgZGVwbG95bWVudC4gVGhpcyB1c3VhbGx5IG1lYW5zIGEgcnVuIHdhcyBzdGFydGVkIGFnYWluc3QgYSBkZXBsb3ltZW50IHRoYXQgZG9lcyBub3QgaGF2ZSB0aGlzIHdvcmtmbG93LCBvciB0aGVyZSB3YXMgYSBidWlsZC9idW5kbGluZyBpc3N1ZS5gLFxuICAgICAgeyBzbHVnOiBFUlJPUl9TTFVHUy5XT1JLRkxPV19OT1RfUkVHSVNURVJFRCB9XG4gICAgKTtcbiAgICB0aGlzLm5hbWUgPSAnV29ya2Zsb3dOb3RSZWdpc3RlcmVkRXJyb3InO1xuICAgIHRoaXMud29ya2Zsb3dOYW1lID0gd29ya2Zsb3dOYW1lO1xuICB9XG5cbiAgc3RhdGljIGlzKHZhbHVlOiB1bmtub3duKTogdmFsdWUgaXMgV29ya2Zsb3dOb3RSZWdpc3RlcmVkRXJyb3Ige1xuICAgIHJldHVybiBpc0Vycm9yKHZhbHVlKSAmJiB2YWx1ZS5uYW1lID09PSAnV29ya2Zsb3dOb3RSZWdpc3RlcmVkRXJyb3InO1xuICB9XG59XG5cbi8qKlxuICogVGhyb3duIHdoZW4gcGVyZm9ybWluZyBvcGVyYXRpb25zIG9uIGEgd29ya2Zsb3cgcnVuIHRoYXQgZG9lcyBub3QgZXhpc3QuXG4gKlxuICogVGhpcyBlcnJvciBvY2N1cnMgd2hlbiB5b3UgY2FsbCBtZXRob2RzIG9uIGEgcnVuIG9iamVjdCAoZS5nLiBgcnVuLnN0YXR1c2AsXG4gKiBgcnVuLmNhbmNlbCgpYCwgYHJ1bi5yZXR1cm5WYWx1ZWApIGJ1dCB0aGUgdW5kZXJseWluZyBydW4gSUQgZG9lcyBub3QgbWF0Y2hcbiAqIGFueSBrbm93biB3b3JrZmxvdyBydW4uIE5vdGUgdGhhdCBgZ2V0UnVuKGlkKWAgaXRzZWxmIGlzIHN5bmNocm9ub3VzIGFuZCB3aWxsXG4gKiBub3QgdGhyb3cg4oCUIHRoaXMgZXJyb3IgaXMgcmFpc2VkIHdoZW4gc3Vic2VxdWVudCBvcGVyYXRpb25zIGRpc2NvdmVyIHRoZSBydW5cbiAqIGlzIG1pc3NpbmcuXG4gKlxuICogVXNlIHRoZSBzdGF0aWMgYFdvcmtmbG93UnVuTm90Rm91bmRFcnJvci5pcygpYCBtZXRob2QgZm9yIHR5cGUtc2FmZSBjaGVja2luZ1xuICogaW4gY2F0Y2ggYmxvY2tzLlxuICpcbiAqIEBleGFtcGxlXG4gKiBgYGB0c1xuICogaW1wb3J0IHsgV29ya2Zsb3dSdW5Ob3RGb3VuZEVycm9yIH0gZnJvbSBcIndvcmtmbG93L2ludGVybmFsL2Vycm9yc1wiO1xuICpcbiAqIHRyeSB7XG4gKiAgIGNvbnN0IHN0YXR1cyA9IGF3YWl0IHJ1bi5zdGF0dXM7XG4gKiB9IGNhdGNoIChlcnJvcikge1xuICogICBpZiAoV29ya2Zsb3dSdW5Ob3RGb3VuZEVycm9yLmlzKGVycm9yKSkge1xuICogICAgIGNvbnNvbGUuZXJyb3IoYFJ1biAke2Vycm9yLnJ1bklkfSBkb2VzIG5vdCBleGlzdGApO1xuICogICB9XG4gKiB9XG4gKiBgYGBcbiAqL1xuZXhwb3J0IGNsYXNzIFdvcmtmbG93UnVuTm90Rm91bmRFcnJvciBleHRlbmRzIFdvcmtmbG93RXJyb3Ige1xuICBydW5JZDogc3RyaW5nO1xuXG4gIGNvbnN0cnVjdG9yKHJ1bklkOiBzdHJpbmcpIHtcbiAgICBzdXBlcihgV29ya2Zsb3cgcnVuIFwiJHtydW5JZH1cIiBub3QgZm91bmRgLCB7fSk7XG4gICAgdGhpcy5uYW1lID0gJ1dvcmtmbG93UnVuTm90Rm91bmRFcnJvcic7XG4gICAgdGhpcy5ydW5JZCA9IHJ1bklkO1xuICB9XG5cbiAgc3RhdGljIGlzKHZhbHVlOiB1bmtub3duKTogdmFsdWUgaXMgV29ya2Zsb3dSdW5Ob3RGb3VuZEVycm9yIHtcbiAgICByZXR1cm4gaXNFcnJvcih2YWx1ZSkgJiYgdmFsdWUubmFtZSA9PT0gJ1dvcmtmbG93UnVuTm90Rm91bmRFcnJvcic7XG4gIH1cbn1cblxuLyoqXG4gKiBUaHJvd24gd2hlbiBhIGhvb2sgdG9rZW4gaXMgYWxyZWFkeSBpbiB1c2UgYnkgYW5vdGhlciBhY3RpdmUgd29ya2Zsb3cgcnVuLlxuICpcbiAqIFRoaXMgaXMgYSB1c2VyIGVycm9yIOKAlCBpdCBtZWFucyB0aGUgc2FtZSBjdXN0b20gdG9rZW4gd2FzIHBhc3NlZCB0b1xuICogYGNyZWF0ZUhvb2tgIGluIHR3byBvciBtb3JlIGNvbmN1cnJlbnQgcnVucy4gVXNlIGEgdW5pcXVlIHRva2VuIHBlciBydW5cbiAqIChvciBvbWl0IHRoZSB0b2tlbiB0byBsZXQgdGhlIHJ1bnRpbWUgZ2VuZXJhdGUgb25lIGF1dG9tYXRpY2FsbHkpLlxuICovXG5leHBvcnQgY2xhc3MgSG9va0NvbmZsaWN0RXJyb3IgZXh0ZW5kcyBXb3JrZmxvd0Vycm9yIHtcbiAgdG9rZW46IHN0cmluZztcbiAgLy8gVE9ETzogTWFrZSB0aGlzIHJlcXVpcmVkIG9uY2UgYWxsIHBlcnNpc3RlZCBob29rX2NvbmZsaWN0IGV2ZW50cyBhbmQgV29ybGRcbiAgLy8gaW1wbGVtZW50YXRpb25zIGFsd2F5cyBpbmNsdWRlIHRoZSBhY3RpdmUgaG9vayBvd25lcidzIHJ1biBJRC5cbiAgY29uZmxpY3RpbmdSdW5JZD86IHN0cmluZztcblxuICBjb25zdHJ1Y3Rvcih0b2tlbjogc3RyaW5nLCBjb25mbGljdGluZ1J1bklkPzogc3RyaW5nKSB7XG4gICAgc3VwZXIoXG4gICAgICBgSG9vayB0b2tlbiBcIiR7dG9rZW59XCIgaXMgYWxyZWFkeSBpbiB1c2UgYnkgYW5vdGhlciB3b3JrZmxvdyR7Y29uZmxpY3RpbmdSdW5JZCA/IGAgKHJ1biBcIiR7Y29uZmxpY3RpbmdSdW5JZH1cIilgIDogJyd9YCxcbiAgICAgIHtcbiAgICAgICAgc2x1ZzogRVJST1JfU0xVR1MuSE9PS19DT05GTElDVCxcbiAgICAgIH1cbiAgICApO1xuICAgIHRoaXMubmFtZSA9ICdIb29rQ29uZmxpY3RFcnJvcic7XG4gICAgdGhpcy50b2tlbiA9IHRva2VuO1xuICAgIGlmIChjb25mbGljdGluZ1J1bklkICE9PSB1bmRlZmluZWQpIHtcbiAgICAgIHRoaXMuY29uZmxpY3RpbmdSdW5JZCA9IGNvbmZsaWN0aW5nUnVuSWQ7XG4gICAgfVxuICB9XG5cbiAgc3RhdGljIGlzKHZhbHVlOiB1bmtub3duKTogdmFsdWUgaXMgSG9va0NvbmZsaWN0RXJyb3Ige1xuICAgIHJldHVybiBpc0Vycm9yKHZhbHVlKSAmJiB2YWx1ZS5uYW1lID09PSAnSG9va0NvbmZsaWN0RXJyb3InO1xuICB9XG59XG5cbi8qKlxuICogVGhyb3duIHdoZW4gY2FsbGluZyBgcmVzdW1lSG9vaygpYCBvciBgcmVzdW1lV2ViaG9vaygpYCB3aXRoIGEgdG9rZW4gdGhhdFxuICogZG9lcyBub3QgbWF0Y2ggYW55IGFjdGl2ZSBob29rLlxuICpcbiAqIENvbW1vbiBjYXVzZXM6XG4gKiAtIFRoZSBob29rIGhhcyBleHBpcmVkIChwYXN0IGl0cyBUVEwpXG4gKiAtIFRoZSBob29rIHdhcyBhbHJlYWR5IGRpc3Bvc2VkIGFmdGVyIGJlaW5nIGNvbnN1bWVkXG4gKiAtIFRoZSB3b3JrZmxvdyBoYXMgbm90IHN0YXJ0ZWQgeWV0LCBzbyB0aGUgaG9vayBkb2VzIG5vdCBleGlzdFxuICpcbiAqIEEgY29tbW9uIHBhdHRlcm4gaXMgdG8gY2F0Y2ggdGhpcyBlcnJvciBhbmQgc3RhcnQgYSBuZXcgd29ya2Zsb3cgcnVuIHdoZW5cbiAqIHRoZSBob29rIGRvZXMgbm90IGV4aXN0IHlldCAodGhlIFwicmVzdW1lIG9yIHN0YXJ0XCIgcGF0dGVybikuXG4gKlxuICogVXNlIHRoZSBzdGF0aWMgYEhvb2tOb3RGb3VuZEVycm9yLmlzKClgIG1ldGhvZCBmb3IgdHlwZS1zYWZlIGNoZWNraW5nIGluXG4gKiBjYXRjaCBibG9ja3MuXG4gKlxuICogQGV4YW1wbGVcbiAqIGBgYHRzXG4gKiBpbXBvcnQgeyBIb29rTm90Rm91bmRFcnJvciB9IGZyb20gXCJ3b3JrZmxvdy9pbnRlcm5hbC9lcnJvcnNcIjtcbiAqXG4gKiB0cnkge1xuICogICBhd2FpdCByZXN1bWVIb29rKHRva2VuLCBwYXlsb2FkKTtcbiAqIH0gY2F0Y2ggKGVycm9yKSB7XG4gKiAgIGlmIChIb29rTm90Rm91bmRFcnJvci5pcyhlcnJvcikpIHtcbiAqICAgICAvLyBIb29rIGRvZXNuJ3QgZXhpc3Qg4oCUIHN0YXJ0IGEgbmV3IHdvcmtmbG93IHJ1biBpbnN0ZWFkXG4gKiAgICAgYXdhaXQgc3RhcnRXb3JrZmxvdyhcIm15V29ya2Zsb3dcIiwgcGF5bG9hZCk7XG4gKiAgIH1cbiAqIH1cbiAqIGBgYFxuICovXG5leHBvcnQgY2xhc3MgSG9va05vdEZvdW5kRXJyb3IgZXh0ZW5kcyBXb3JrZmxvd0Vycm9yIHtcbiAgdG9rZW46IHN0cmluZztcblxuICBjb25zdHJ1Y3Rvcih0b2tlbjogc3RyaW5nKSB7XG4gICAgc3VwZXIoJ0hvb2sgbm90IGZvdW5kJywge30pO1xuICAgIHRoaXMubmFtZSA9ICdIb29rTm90Rm91bmRFcnJvcic7XG4gICAgdGhpcy50b2tlbiA9IHRva2VuO1xuICB9XG5cbiAgc3RhdGljIGlzKHZhbHVlOiB1bmtub3duKTogdmFsdWUgaXMgSG9va05vdEZvdW5kRXJyb3Ige1xuICAgIHJldHVybiBpc0Vycm9yKHZhbHVlKSAmJiB2YWx1ZS5uYW1lID09PSAnSG9va05vdEZvdW5kRXJyb3InO1xuICB9XG59XG5cbi8qKlxuICogVGhyb3duIHdoZW4gYW4gb3BlcmF0aW9uIGNvbmZsaWN0cyB3aXRoIHRoZSBjdXJyZW50IHN0YXRlIG9mIGFuIGVudGl0eS5cbiAqIFRoaXMgaW5jbHVkZXMgYXR0ZW1wdHMgdG8gbW9kaWZ5IGFuIGVudGl0eSBhbHJlYWR5IGluIGEgdGVybWluYWwgc3RhdGUsXG4gKiBjcmVhdGUgYW4gZW50aXR5IHRoYXQgYWxyZWFkeSBleGlzdHMsIG9yIGFueSBvdGhlciA0MDktc3R5bGUgY29uZmxpY3QuXG4gKlxuICogVGhlIHdvcmtmbG93IHJ1bnRpbWUgaGFuZGxlcyB0aGlzIGVycm9yIGF1dG9tYXRpY2FsbHkuIFVzZXJzIGludGVyYWN0aW5nXG4gKiB3aXRoIHdvcmxkIHN0b3JhZ2UgYmFja2VuZHMgZGlyZWN0bHkgbWF5IGVuY291bnRlciBpdC5cbiAqL1xuZXhwb3J0IGNsYXNzIEVudGl0eUNvbmZsaWN0RXJyb3IgZXh0ZW5kcyBXb3JrZmxvd1dvcmxkRXJyb3Ige1xuICBjb25zdHJ1Y3RvcihtZXNzYWdlOiBzdHJpbmcpIHtcbiAgICBzdXBlcihtZXNzYWdlKTtcbiAgICB0aGlzLm5hbWUgPSAnRW50aXR5Q29uZmxpY3RFcnJvcic7XG4gIH1cblxuICBzdGF0aWMgaXModmFsdWU6IHVua25vd24pOiB2YWx1ZSBpcyBFbnRpdHlDb25mbGljdEVycm9yIHtcbiAgICByZXR1cm4gaXNFcnJvcih2YWx1ZSkgJiYgdmFsdWUubmFtZSA9PT0gJ0VudGl0eUNvbmZsaWN0RXJyb3InO1xuICB9XG59XG5cbi8qKlxuICogVGhyb3duIHdoZW4gYSBydW4gaXMgbm8gbG9uZ2VyIGF2YWlsYWJsZSDigJQgZWl0aGVyIGJlY2F1c2UgaXQgaGFzIGJlZW5cbiAqIGNsZWFuZWQgdXAsIGV4cGlyZWQsIG9yIGFscmVhZHkgcmVhY2hlZCBhIHRlcm1pbmFsIHN0YXRlIChjb21wbGV0ZWQvZmFpbGVkKS5cbiAqXG4gKiBUaGUgd29ya2Zsb3cgcnVudGltZSBoYW5kbGVzIHRoaXMgZXJyb3IgYXV0b21hdGljYWxseS4gVXNlcnMgaW50ZXJhY3RpbmdcbiAqIHdpdGggd29ybGQgc3RvcmFnZSBiYWNrZW5kcyBkaXJlY3RseSBtYXkgZW5jb3VudGVyIGl0LlxuICovXG5leHBvcnQgY2xhc3MgUnVuRXhwaXJlZEVycm9yIGV4dGVuZHMgV29ya2Zsb3dXb3JsZEVycm9yIHtcbiAgY29uc3RydWN0b3IobWVzc2FnZTogc3RyaW5nKSB7XG4gICAgc3VwZXIobWVzc2FnZSk7XG4gICAgdGhpcy5uYW1lID0gJ1J1bkV4cGlyZWRFcnJvcic7XG4gIH1cblxuICBzdGF0aWMgaXModmFsdWU6IHVua25vd24pOiB2YWx1ZSBpcyBSdW5FeHBpcmVkRXJyb3Ige1xuICAgIHJldHVybiBpc0Vycm9yKHZhbHVlKSAmJiB2YWx1ZS5uYW1lID09PSAnUnVuRXhwaXJlZEVycm9yJztcbiAgfVxufVxuXG4vKipcbiAqIFRocm93biB3aGVuIGFuIG9wZXJhdGlvbiBjYW5ub3QgcHJvY2VlZCBiZWNhdXNlIGEgcmVxdWlyZWQgdGltZXN0YW1wXG4gKiAoZS5nLiByZXRyeUFmdGVyKSBoYXMgbm90IGJlZW4gcmVhY2hlZCB5ZXQuXG4gKlxuICogVGhlIHdvcmtmbG93IHJ1bnRpbWUgaGFuZGxlcyB0aGlzIGVycm9yIGF1dG9tYXRpY2FsbHkuIFVzZXJzIGludGVyYWN0aW5nXG4gKiB3aXRoIHdvcmxkIHN0b3JhZ2UgYmFja2VuZHMgZGlyZWN0bHkgbWF5IGVuY291bnRlciBpdC5cbiAqXG4gKiBAcHJvcGVydHkgcmV0cnlBZnRlciAtIERlbGF5IGluIHNlY29uZHMgYmVmb3JlIHRoZSBvcGVyYXRpb24gY2FuIGJlIHJldHJpZWQuXG4gKi9cbmV4cG9ydCBjbGFzcyBUb29FYXJseUVycm9yIGV4dGVuZHMgV29ya2Zsb3dXb3JsZEVycm9yIHtcbiAgY29uc3RydWN0b3IobWVzc2FnZTogc3RyaW5nLCBvcHRpb25zPzogeyByZXRyeUFmdGVyPzogbnVtYmVyIH0pIHtcbiAgICBzdXBlcihtZXNzYWdlLCB7IHJldHJ5QWZ0ZXI6IG9wdGlvbnM/LnJldHJ5QWZ0ZXIgfSk7XG4gICAgdGhpcy5uYW1lID0gJ1Rvb0Vhcmx5RXJyb3InO1xuICB9XG5cbiAgc3RhdGljIGlzKHZhbHVlOiB1bmtub3duKTogdmFsdWUgaXMgVG9vRWFybHlFcnJvciB7XG4gICAgcmV0dXJuIGlzRXJyb3IodmFsdWUpICYmIHZhbHVlLm5hbWUgPT09ICdUb29FYXJseUVycm9yJztcbiAgfVxufVxuXG4vKipcbiAqIFRocm93biB3aGVuIGEgcmVxdWVzdCBpcyByYXRlIGxpbWl0ZWQgYnkgdGhlIHdvcmtmbG93IGJhY2tlbmQuXG4gKlxuICogVGhlIHdvcmtmbG93IHJ1bnRpbWUgaGFuZGxlcyB0aGlzIGVycm9yIGF1dG9tYXRpY2FsbHkgd2l0aCByZXRyeSBsb2dpYy5cbiAqIFVzZXJzIGludGVyYWN0aW5nIHdpdGggd29ybGQgc3RvcmFnZSBiYWNrZW5kcyBkaXJlY3RseSBtYXkgZW5jb3VudGVyIGl0XG4gKiBpZiByZXRyaWVzIGFyZSBleGhhdXN0ZWQuXG4gKlxuICogQHByb3BlcnR5IHJldHJ5QWZ0ZXIgLSBEZWxheSBpbiBzZWNvbmRzIGJlZm9yZSB0aGUgcmVxdWVzdCBjYW4gYmUgcmV0cmllZC5cbiAqL1xuZXhwb3J0IGNsYXNzIFRocm90dGxlRXJyb3IgZXh0ZW5kcyBXb3JrZmxvd1dvcmxkRXJyb3Ige1xuICByZXRyeUFmdGVyPzogbnVtYmVyO1xuXG4gIGNvbnN0cnVjdG9yKG1lc3NhZ2U6IHN0cmluZywgb3B0aW9ucz86IHsgcmV0cnlBZnRlcj86IG51bWJlciB9KSB7XG4gICAgc3VwZXIobWVzc2FnZSk7XG4gICAgdGhpcy5uYW1lID0gJ1Rocm90dGxlRXJyb3InO1xuICAgIHRoaXMucmV0cnlBZnRlciA9IG9wdGlvbnM/LnJldHJ5QWZ0ZXI7XG4gIH1cblxuICBzdGF0aWMgaXModmFsdWU6IHVua25vd24pOiB2YWx1ZSBpcyBUaHJvdHRsZUVycm9yIHtcbiAgICByZXR1cm4gaXNFcnJvcih2YWx1ZSkgJiYgdmFsdWUubmFtZSA9PT0gJ1Rocm90dGxlRXJyb3InO1xuICB9XG59XG5cbi8qKlxuICogVGhyb3duIHdoZW4gdGhlIGJhY2tlbmQgcmVqZWN0cyBhbiBldmVudCBjcmVhdGlvbiBiZWNhdXNlIHRoZSBjbGllbnQnc1xuICogZXZlbnQtbG9nIHNuYXBzaG90IGlzIHN0YWxlIOKAlCBhIG5ld2VyIG91dC1vZi1iYW5kIGV2ZW50IChlLmcuIGEgcmVjZWl2ZWRcbiAqIGhvb2sgb3IgYSBjb21wbGV0ZWQgc3RlcCkgd2FzIHJlY29yZGVkIGFmdGVyIHRoZSBzbmFwc2hvdCB0aGUgY2xpZW50XG4gKiByZXBsYXllZCBmcm9tIChIVFRQIDQxMikuXG4gKlxuICogVGhlIHdvcmtmbG93IHJ1bnRpbWUgaGFuZGxlcyB0aGlzIGF1dG9tYXRpY2FsbHk6IGl0IHJlbG9hZHMgdGhlIGV2ZW50IGxvZ1xuICogYW5kIHJldHJpZXMsIHVsdGltYXRlbHkgcmUtZW5xdWV1ZWluZyB0aGUgcnVuIGlmIGl0IGNhbm5vdCBjYXRjaCB1cC4gVXNlcnNcbiAqIGludGVyYWN0aW5nIHdpdGggd29ybGQgc3RvcmFnZSBiYWNrZW5kcyBkaXJlY3RseSBtYXkgZW5jb3VudGVyIGl0LlxuICovXG5leHBvcnQgY2xhc3MgUHJlY29uZGl0aW9uRmFpbGVkRXJyb3IgZXh0ZW5kcyBXb3JrZmxvd1dvcmxkRXJyb3Ige1xuICBjb25zdHJ1Y3RvcihtZXNzYWdlOiBzdHJpbmcsIG9wdGlvbnM/OiB7IHJldHJ5QWZ0ZXI/OiBudW1iZXIgfSkge1xuICAgIHN1cGVyKG1lc3NhZ2UsIHsgc3RhdHVzOiA0MTIsIHJldHJ5QWZ0ZXI6IG9wdGlvbnM/LnJldHJ5QWZ0ZXIgfSk7XG4gICAgdGhpcy5uYW1lID0gJ1ByZWNvbmRpdGlvbkZhaWxlZEVycm9yJztcbiAgfVxuXG4gIHN0YXRpYyBpcyh2YWx1ZTogdW5rbm93bik6IHZhbHVlIGlzIFByZWNvbmRpdGlvbkZhaWxlZEVycm9yIHtcbiAgICByZXR1cm4gaXNFcnJvcih2YWx1ZSkgJiYgdmFsdWUubmFtZSA9PT0gJ1ByZWNvbmRpdGlvbkZhaWxlZEVycm9yJztcbiAgfVxufVxuXG4vKipcbiAqIFRocm93biB3aGVuIGF3YWl0aW5nIGBydW4ucmV0dXJuVmFsdWVgIG9uIGEgd29ya2Zsb3cgcnVuIHRoYXQgd2FzIGNhbmNlbGxlZC5cbiAqXG4gKiBUaGlzIGVycm9yIGluZGljYXRlcyB0aGF0IHRoZSB3b3JrZmxvdyB3YXMgZXhwbGljaXRseSBjYW5jZWxsZWQgKHZpYVxuICogYHJ1bi5jYW5jZWwoKWApIGFuZCB3aWxsIG5vdCBwcm9kdWNlIGEgcmV0dXJuIHZhbHVlLiBZb3UgY2FuIGNoZWNrIGZvclxuICogY2FuY2VsbGF0aW9uIGJlZm9yZSBhd2FpdGluZyB0aGUgcmV0dXJuIHZhbHVlIGJ5IGluc3BlY3RpbmcgYHJ1bi5zdGF0dXNgLlxuICpcbiAqIFVzZSB0aGUgc3RhdGljIGBXb3JrZmxvd1J1bkNhbmNlbGxlZEVycm9yLmlzKClgIG1ldGhvZCBmb3IgdHlwZS1zYWZlXG4gKiBjaGVja2luZyBpbiBjYXRjaCBibG9ja3MuXG4gKlxuICogQGV4YW1wbGVcbiAqIGBgYHRzXG4gKiBpbXBvcnQgeyBXb3JrZmxvd1J1bkNhbmNlbGxlZEVycm9yIH0gZnJvbSBcIndvcmtmbG93L2ludGVybmFsL2Vycm9yc1wiO1xuICpcbiAqIHRyeSB7XG4gKiAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IHJ1bi5yZXR1cm5WYWx1ZTtcbiAqIH0gY2F0Y2ggKGVycm9yKSB7XG4gKiAgIGlmIChXb3JrZmxvd1J1bkNhbmNlbGxlZEVycm9yLmlzKGVycm9yKSkge1xuICogICAgIGNvbnNvbGUubG9nKGBSdW4gJHtlcnJvci5ydW5JZH0gd2FzIGNhbmNlbGxlZGApO1xuICogICB9XG4gKiB9XG4gKiBgYGBcbiAqL1xuZXhwb3J0IGNsYXNzIFdvcmtmbG93UnVuQ2FuY2VsbGVkRXJyb3IgZXh0ZW5kcyBXb3JrZmxvd0Vycm9yIHtcbiAgcnVuSWQ6IHN0cmluZztcblxuICBjb25zdHJ1Y3RvcihydW5JZDogc3RyaW5nKSB7XG4gICAgc3VwZXIoYFdvcmtmbG93IHJ1biBcIiR7cnVuSWR9XCIgY2FuY2VsbGVkYCwge30pO1xuICAgIHRoaXMubmFtZSA9ICdXb3JrZmxvd1J1bkNhbmNlbGxlZEVycm9yJztcbiAgICB0aGlzLnJ1bklkID0gcnVuSWQ7XG4gIH1cblxuICBzdGF0aWMgaXModmFsdWU6IHVua25vd24pOiB2YWx1ZSBpcyBXb3JrZmxvd1J1bkNhbmNlbGxlZEVycm9yIHtcbiAgICByZXR1cm4gaXNFcnJvcih2YWx1ZSkgJiYgdmFsdWUubmFtZSA9PT0gJ1dvcmtmbG93UnVuQ2FuY2VsbGVkRXJyb3InO1xuICB9XG59XG5cbi8qKlxuICogVGhyb3duIHdoZW4gYXR0ZW1wdGluZyB0byBvcGVyYXRlIG9uIGEgd29ya2Zsb3cgcnVuIHRoYXQgcmVxdWlyZXMgYSBuZXdlciBXb3JsZCB2ZXJzaW9uLlxuICpcbiAqIFRoaXMgZXJyb3Igb2NjdXJzIHdoZW4gYSBydW4gd2FzIGNyZWF0ZWQgd2l0aCBhIG5ld2VyIHNwZWMgdmVyc2lvbiB0aGFuIHRoZVxuICogY3VycmVudCBXb3JsZCBpbXBsZW1lbnRhdGlvbiBzdXBwb3J0cy4gVG8gcmVzb2x2ZSB0aGlzLCB1cGdyYWRlIHlvdXJcbiAqIGB3b3JrZmxvd2AgcGFja2FnZXMgdG8gYSB2ZXJzaW9uIHRoYXQgc3VwcG9ydHMgdGhlIHJlcXVpcmVkIHNwZWMgdmVyc2lvbi5cbiAqXG4gKiBVc2UgdGhlIHN0YXRpYyBgUnVuTm90U3VwcG9ydGVkRXJyb3IuaXMoKWAgbWV0aG9kIGZvciB0eXBlLXNhZmUgY2hlY2tpbmcgaW5cbiAqIGNhdGNoIGJsb2Nrcy5cbiAqXG4gKiBAZXhhbXBsZVxuICogYGBgdHNcbiAqIGltcG9ydCB7IFJ1bk5vdFN1cHBvcnRlZEVycm9yIH0gZnJvbSBcIndvcmtmbG93L2ludGVybmFsL2Vycm9yc1wiO1xuICpcbiAqIHRyeSB7XG4gKiAgIGNvbnN0IHN0YXR1cyA9IGF3YWl0IHJ1bi5zdGF0dXM7XG4gKiB9IGNhdGNoIChlcnJvcikge1xuICogICBpZiAoUnVuTm90U3VwcG9ydGVkRXJyb3IuaXMoZXJyb3IpKSB7XG4gKiAgICAgY29uc29sZS5lcnJvcihcbiAqICAgICAgIGBSdW4gcmVxdWlyZXMgc3BlYyB2JHtlcnJvci5ydW5TcGVjVmVyc2lvbn0sIGAgK1xuICogICAgICAgYGJ1dCB3b3JsZCBzdXBwb3J0cyB2JHtlcnJvci53b3JsZFNwZWNWZXJzaW9ufWBcbiAqICAgICApO1xuICogICB9XG4gKiB9XG4gKiBgYGBcbiAqL1xuZXhwb3J0IGNsYXNzIFJ1bk5vdFN1cHBvcnRlZEVycm9yIGV4dGVuZHMgV29ya2Zsb3dFcnJvciB7XG4gIHJlYWRvbmx5IHJ1blNwZWNWZXJzaW9uOiBudW1iZXI7XG4gIHJlYWRvbmx5IHdvcmxkU3BlY1ZlcnNpb246IG51bWJlcjtcblxuICBjb25zdHJ1Y3RvcihydW5TcGVjVmVyc2lvbjogbnVtYmVyLCB3b3JsZFNwZWNWZXJzaW9uOiBudW1iZXIpIHtcbiAgICBzdXBlcihcbiAgICAgIGBSdW4gcmVxdWlyZXMgc3BlYyB2ZXJzaW9uICR7cnVuU3BlY1ZlcnNpb259LCBidXQgd29ybGQgc3VwcG9ydHMgdmVyc2lvbiAke3dvcmxkU3BlY1ZlcnNpb259LiBgICtcbiAgICAgICAgYFBsZWFzZSB1cGdyYWRlICd3b3JrZmxvdycgcGFja2FnZS5gXG4gICAgKTtcbiAgICB0aGlzLm5hbWUgPSAnUnVuTm90U3VwcG9ydGVkRXJyb3InO1xuICAgIHRoaXMucnVuU3BlY1ZlcnNpb24gPSBydW5TcGVjVmVyc2lvbjtcbiAgICB0aGlzLndvcmxkU3BlY1ZlcnNpb24gPSB3b3JsZFNwZWNWZXJzaW9uO1xuICB9XG5cbiAgc3RhdGljIGlzKHZhbHVlOiB1bmtub3duKTogdmFsdWUgaXMgUnVuTm90U3VwcG9ydGVkRXJyb3Ige1xuICAgIHJldHVybiBpc0Vycm9yKHZhbHVlKSAmJiB2YWx1ZS5uYW1lID09PSAnUnVuTm90U3VwcG9ydGVkRXJyb3InO1xuICB9XG59XG5cbi8qKlxuICogQSBmYXRhbCBlcnJvciBpcyBhbiBlcnJvciB0aGF0IGNhbm5vdCBiZSByZXRyaWVkLlxuICogSXQgd2lsbCBjYXVzZSB0aGUgc3RlcCB0byBmYWlsIGFuZCB0aGUgZXJyb3Igd2lsbFxuICogYmUgYnViYmxlZCB1cCB0byB0aGUgd29ya2Zsb3cgbG9naWMuXG4gKi9cbmV4cG9ydCBjbGFzcyBGYXRhbEVycm9yIGV4dGVuZHMgRXJyb3Ige1xuICBmYXRhbCA9IHRydWU7XG5cbiAgY29uc3RydWN0b3IobWVzc2FnZTogc3RyaW5nKSB7XG4gICAgc3VwZXIobWVzc2FnZSk7XG4gICAgdGhpcy5uYW1lID0gJ0ZhdGFsRXJyb3InO1xuICB9XG5cbiAgc3RhdGljIGlzKHZhbHVlOiB1bmtub3duKTogdmFsdWUgaXMgRmF0YWxFcnJvciB7XG4gICAgcmV0dXJuIGlzRXJyb3IodmFsdWUpICYmIHZhbHVlLm5hbWUgPT09ICdGYXRhbEVycm9yJztcbiAgfVxufVxuXG5leHBvcnQgaW50ZXJmYWNlIFJldHJ5YWJsZUVycm9yT3B0aW9ucyB7XG4gIC8qKlxuICAgKiBUaGUgbnVtYmVyIG9mIG1pbGxpc2Vjb25kcyB0byB3YWl0IGJlZm9yZSByZXRyeWluZyB0aGUgc3RlcC5cbiAgICogQ2FuIGFsc28gYmUgYSBkdXJhdGlvbiBzdHJpbmcgKGUuZy4sIFwiNXNcIiwgXCIybVwiKSBvciBhIERhdGUgb2JqZWN0LlxuICAgKiBJZiBub3QgcHJvdmlkZWQsIHRoZSBzdGVwIHdpbGwgYmUgcmV0cmllZCBhZnRlciAxIHNlY29uZCAoMTAwMCBtaWxsaXNlY29uZHMpLlxuICAgKi9cbiAgcmV0cnlBZnRlcj86IG51bWJlciB8IFN0cmluZ1ZhbHVlIHwgRGF0ZTtcbn1cblxuLyoqXG4gKiBBbiBlcnJvciB0aGF0IGNhbiBoYXBwZW4gZHVyaW5nIGEgc3RlcCBleGVjdXRpb24sIGFsbG93aW5nXG4gKiBmb3IgY29uZmlndXJhdGlvbiBvZiB0aGUgcmV0cnkgYmVoYXZpb3IuXG4gKi9cbmV4cG9ydCBjbGFzcyBSZXRyeWFibGVFcnJvciBleHRlbmRzIEVycm9yIHtcbiAgLyoqXG4gICAqIFRoZSBEYXRlIHdoZW4gdGhlIHN0ZXAgc2hvdWxkIGJlIHJldHJpZWQuXG4gICAqL1xuICByZXRyeUFmdGVyOiBEYXRlO1xuXG4gIGNvbnN0cnVjdG9yKG1lc3NhZ2U6IHN0cmluZywgb3B0aW9uczogUmV0cnlhYmxlRXJyb3JPcHRpb25zID0ge30pIHtcbiAgICBzdXBlcihtZXNzYWdlKTtcbiAgICB0aGlzLm5hbWUgPSAnUmV0cnlhYmxlRXJyb3InO1xuXG4gICAgaWYgKG9wdGlvbnMucmV0cnlBZnRlciAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICB0aGlzLnJldHJ5QWZ0ZXIgPSBwYXJzZUR1cmF0aW9uVG9EYXRlKG9wdGlvbnMucmV0cnlBZnRlcik7XG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIERlZmF1bHQgdG8gMSBzZWNvbmQgKDEwMDAgbWlsbGlzZWNvbmRzKVxuICAgICAgdGhpcy5yZXRyeUFmdGVyID0gbmV3IERhdGUoRGF0ZS5ub3coKSArIDEwMDApO1xuICAgIH1cbiAgfVxuXG4gIHN0YXRpYyBpcyh2YWx1ZTogdW5rbm93bik6IHZhbHVlIGlzIFJldHJ5YWJsZUVycm9yIHtcbiAgICByZXR1cm4gaXNFcnJvcih2YWx1ZSkgJiYgdmFsdWUubmFtZSA9PT0gJ1JldHJ5YWJsZUVycm9yJztcbiAgfVxufVxuXG5leHBvcnQgY29uc3QgVkVSQ0VMXzQwM19FUlJPUl9NRVNTQUdFID1cbiAgJ1lvdXIgY3VycmVudCB2ZXJjZWwgYWNjb3VudCBkb2VzIG5vdCBoYXZlIGFjY2VzcyB0byB0aGlzIHJlc291cmNlLiBVc2UgYHZlcmNlbCBsb2dpbmAgb3IgYHZlcmNlbCBzd2l0Y2hgIHRvIGVuc3VyZSB5b3UgYXJlIGxpbmtlZCB0byB0aGUgcmlnaHQgYWNjb3VudC4nO1xuXG5leHBvcnQgeyBSVU5fRVJST1JfQ09ERVMsIHR5cGUgUnVuRXJyb3JDb2RlIH0gZnJvbSAnLi9lcnJvci1jb2Rlcy5qcyc7XG5cbi8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuLy8gQ3Jvc3MtcmVhbG0gY2xhc3MgcmVnaXN0cmF0aW9uXG4vLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbi8vXG4vLyBgRmF0YWxFcnJvcmAsIGBSZXRyeWFibGVFcnJvcmAsIGFuZCBgSG9va0NvbmZsaWN0RXJyb3JgIGFyZSBub3QgYnVpbHQtaW5zLCBzbyBkaWZmZXJlbnQgcmVhbG1zXG4vLyAoZS5nLiB0aGUgd29ya2Zsb3cgVk0gY29udGV4dCB2cy4gdGhlIGhvc3QgY29udGV4dCB0aGF0IHJ1bnMgdGhlIHF1ZXVlXG4vLyBoYW5kbGVyKSBidW5kbGUgYW5kIGxvYWQgdGhlaXIgb3duIGNvcGllcyBvZiB0aGlzIG1vZHVsZSDigJQgbWVhbmluZyBlYWNoXG4vLyByZWFsbSBoYXMgaXRzIG93biBkaXN0aW5jdCBjbGFzcyBpZGVudGl0eS4gQ3Jvc3MtcmVhbG0gYGluc3RhbmNlb2ZgIGZhaWxzXG4vLyBiZWNhdXNlIHRoZSBwcm90b3R5cGUgY2hhaW5zIG5ldmVyIG1lZXQuXG4vL1xuLy8gVG8gbGV0IHNlcmlhbGl6YXRpb24gcmV2aXZlcnMgcmVjb25zdHJ1Y3QgYSB2YWx1ZSBhcyB0aGUgKmNvbnN1bWVyJ3MqXG4vLyBGYXRhbEVycm9yIChzbyB1c2VyLWNvZGUgYGVyciBpbnN0YW5jZW9mIEZhdGFsRXJyb3JgIHBhc3NlcyksIGVhY2ggYnVuZGxlZFxuLy8gY29weSBvZiB0aGlzIG1vZHVsZSBzZWxmLXJlZ2lzdGVycyBpdHMgY2xhc3Mgb24gYGdsb2JhbFRoaXNgIHZpYSBhIGtub3duXG4vLyBTeW1ib2wuZm9yIGtleS4gUmV2aXZlcnMgaW4gYEB3b3JrZmxvdy9jb3JlYCBsb29rIHVwIHRoZSBjbGFzcyB2aWEgdGhlXG4vLyBjb25zdW1lcidzIGdsb2JhbFRoaXMgYXQgaHlkcmF0aW9uIHRpbWUuXG4vL1xuLy8gRmlyc3QgcmVnaXN0cmF0aW9uIGluIGEgZ2l2ZW4gcmVhbG0gd2lucy4gVGhlIGRlc2NyaXB0b3IgaXMgbm9uLXdyaXRhYmxlXG4vLyBhbmQgbm9uLWNvbmZpZ3VyYWJsZSB0byBtYWtlIGFjY2lkZW50YWwgY2xvYmJlcmluZyBsb3VkLlxuY29uc3QgRkFUQUxfRVJST1JfS0VZID0gU3ltYm9sLmZvcignQHdvcmtmbG93L2Vycm9ycy8vRmF0YWxFcnJvcicpO1xuY29uc3QgUkVUUllBQkxFX0VSUk9SX0tFWSA9IFN5bWJvbC5mb3IoJ0B3b3JrZmxvdy9lcnJvcnMvL1JldHJ5YWJsZUVycm9yJyk7XG5jb25zdCBIT09LX0NPTkZMSUNUX0VSUk9SX0tFWSA9IFN5bWJvbC5mb3IoXG4gICdAd29ya2Zsb3cvZXJyb3JzLy9Ib29rQ29uZmxpY3RFcnJvcidcbik7XG5cbmlmICh0eXBlb2YgZ2xvYmFsVGhpcyAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgaWYgKCFPYmplY3QuaGFzT3duKGdsb2JhbFRoaXMsIEZBVEFMX0VSUk9SX0tFWSkpIHtcbiAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkoZ2xvYmFsVGhpcywgRkFUQUxfRVJST1JfS0VZLCB7XG4gICAgICB2YWx1ZTogRmF0YWxFcnJvcixcbiAgICAgIHdyaXRhYmxlOiBmYWxzZSxcbiAgICAgIGVudW1lcmFibGU6IGZhbHNlLFxuICAgICAgY29uZmlndXJhYmxlOiBmYWxzZSxcbiAgICB9KTtcbiAgfVxuICBpZiAoIU9iamVjdC5oYXNPd24oZ2xvYmFsVGhpcywgUkVUUllBQkxFX0VSUk9SX0tFWSkpIHtcbiAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkoZ2xvYmFsVGhpcywgUkVUUllBQkxFX0VSUk9SX0tFWSwge1xuICAgICAgdmFsdWU6IFJldHJ5YWJsZUVycm9yLFxuICAgICAgd3JpdGFibGU6IGZhbHNlLFxuICAgICAgZW51bWVyYWJsZTogZmFsc2UsXG4gICAgICBjb25maWd1cmFibGU6IGZhbHNlLFxuICAgIH0pO1xuICB9XG4gIGlmICghT2JqZWN0Lmhhc093bihnbG9iYWxUaGlzLCBIT09LX0NPTkZMSUNUX0VSUk9SX0tFWSkpIHtcbiAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkoZ2xvYmFsVGhpcywgSE9PS19DT05GTElDVF9FUlJPUl9LRVksIHtcbiAgICAgIHZhbHVlOiBIb29rQ29uZmxpY3RFcnJvcixcbiAgICAgIHdyaXRhYmxlOiBmYWxzZSxcbiAgICAgIGVudW1lcmFibGU6IGZhbHNlLFxuICAgICAgY29uZmlndXJhYmxlOiBmYWxzZSxcbiAgICB9KTtcbiAgfVxufVxuIiwgIi8qKlxuICogVGhpcyBpcyB0aGUgXCJzdGFuZGFyZCBsaWJyYXJ5XCIgb2Ygc3RlcHMgdGhhdCB3ZSBtYWtlIGF2YWlsYWJsZSB0byBhbGwgd29ya2Zsb3cgdXNlcnMuXG4gKiBUaGUgY2FuIGJlIGltcG9ydGVkIGxpa2Ugc286IGBpbXBvcnQgeyBmZXRjaCB9IGZyb20gJ3dvcmtmbG93J2AuIGFuZCB1c2VkIGluIHdvcmtmbG93LlxuICogVGhlIG5lZWQgdG8gYmUgZXhwb3J0ZWQgZGlyZWN0bHkgaW4gdGhpcyBwYWNrYWdlIGFuZCBjYW5ub3QgbGl2ZSBpbiBgY29yZWAgdG8gcHJldmVudFxuICogY2lyY3VsYXIgZGVwZW5kZW5jaWVzIHBvc3QtY29tcGlsYXRpb24uXG4gKi9cblxuLyoqXG4gKiBBIGhvaXN0ZWQgYGZldGNoKClgIGZ1bmN0aW9uIHRoYXQgaXMgZXhlY3V0ZWQgYXMgYSBcInN0ZXBcIiBmdW5jdGlvbixcbiAqIGZvciB1c2Ugd2l0aGluIHdvcmtmbG93IGZ1bmN0aW9ucy5cbiAqXG4gKiBAc2VlIGh0dHBzOi8vZGV2ZWxvcGVyLm1vemlsbGEub3JnL2VuLVVTL2RvY3MvV2ViL0FQSS9GZXRjaF9BUElcbiAqL1xuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGZldGNoKC4uLmFyZ3M6IFBhcmFtZXRlcnM8dHlwZW9mIGdsb2JhbFRoaXMuZmV0Y2g+KSB7XG4gICd1c2Ugc3RlcCc7XG4gIHJldHVybiBnbG9iYWxUaGlzLmZldGNoKC4uLmFyZ3MpO1xufVxuIiwgImltcG9ydCB7IEZhdGFsRXJyb3IsIFJldHJ5YWJsZUVycm9yIH0gZnJvbSAnd29ya2Zsb3cnO1xuLyoqX19pbnRlcm5hbF93b3JrZmxvd3N7XCJ3b3JrZmxvd3NcIjp7XCJzcmMvd29ya2Zsb3dzL3dvcmtmbG93UHJvb2YudHNcIjp7XCJ3b3JrZmxvd1Byb29mXCI6e1wid29ya2Zsb3dJZFwiOlwid29ya2Zsb3cvLy4vc3JjL3dvcmtmbG93cy93b3JrZmxvd1Byb29mLy93b3JrZmxvd1Byb29mXCJ9fX0sXCJzdGVwc1wiOntcInNyYy93b3JrZmxvd3Mvd29ya2Zsb3dQcm9vZi50c1wiOntcImNsYWltUHJvb2ZcIjp7XCJzdGVwSWRcIjpcInN0ZXAvLy4vc3JjL3dvcmtmbG93cy93b3JrZmxvd1Byb29mLy9jbGFpbVByb29mXCJ9LFwiY29tcGxldGVQcm9vZlwiOntcInN0ZXBJZFwiOlwic3RlcC8vLi9zcmMvd29ya2Zsb3dzL3dvcmtmbG93UHJvb2YvL2NvbXBsZXRlUHJvb2ZcIn0sXCJmYWlsUHJvb2ZcIjp7XCJzdGVwSWRcIjpcInN0ZXAvLy4vc3JjL3dvcmtmbG93cy93b3JrZmxvd1Byb29mLy9mYWlsUHJvb2ZcIn0sXCJyZWNvbmNpbGVQcm9vZlwiOntcInN0ZXBJZFwiOlwic3RlcC8vLi9zcmMvd29ya2Zsb3dzL3dvcmtmbG93UHJvb2YvL3JlY29uY2lsZVByb29mXCJ9LFwic3ludGhldGljV29ya1wiOntcInN0ZXBJZFwiOlwic3RlcC8vLi9zcmMvd29ya2Zsb3dzL3dvcmtmbG93UHJvb2YvL3N5bnRoZXRpY1dvcmtcIn19fX0qLztcbmV4cG9ydCBhc3luYyBmdW5jdGlvbiB3b3JrZmxvd1Byb29mKGFwcGxpY2F0aW9uUnVuSWQpIHtcbiAgICB0cnkge1xuICAgICAgICBhd2FpdCBjbGFpbVByb29mKGFwcGxpY2F0aW9uUnVuSWQpO1xuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgIGlmIChlcnJvciBpbnN0YW5jZW9mIEZhdGFsRXJyb3IpIHJldHVybiBhd2FpdCBmYWlsUHJvb2YoYXBwbGljYXRpb25SdW5JZCk7XG4gICAgICAgIHRocm93IGVycm9yO1xuICAgIH1cbiAgICBsZXQgcmVjb25jaWxlZFN0YXR1cztcbiAgICB0cnkge1xuICAgICAgICByZWNvbmNpbGVkU3RhdHVzID0gYXdhaXQgcmVjb25jaWxlUHJvb2YoYXBwbGljYXRpb25SdW5JZCk7XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgaWYgKGVycm9yIGluc3RhbmNlb2YgRmF0YWxFcnJvcikgcmV0dXJuIGF3YWl0IGZhaWxQcm9vZihhcHBsaWNhdGlvblJ1bklkKTtcbiAgICAgICAgdGhyb3cgZXJyb3I7XG4gICAgfVxuICAgIGlmIChyZWNvbmNpbGVkU3RhdHVzID09PSAnY29tcGxldGVkJyB8fCByZWNvbmNpbGVkU3RhdHVzID09PSAnZmFpbGVkJykge1xuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgYXBwbGljYXRpb25SdW5JZCxcbiAgICAgICAgICAgIHRlcm1pbmFsU3RhdHVzOiByZWNvbmNpbGVkU3RhdHVzXG4gICAgICAgIH07XG4gICAgfVxuICAgIGlmIChyZWNvbmNpbGVkU3RhdHVzICE9PSAncnVubmluZycpIHtcbiAgICAgICAgcmV0dXJuIGF3YWl0IGZhaWxQcm9vZihhcHBsaWNhdGlvblJ1bklkKTtcbiAgICB9XG4gICAgdHJ5IHtcbiAgICAgICAgYXdhaXQgc3ludGhldGljV29yayhhcHBsaWNhdGlvblJ1bklkKTtcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICBpZiAoZXJyb3IgaW5zdGFuY2VvZiBSZXRyeWFibGVFcnJvcikgdGhyb3cgZXJyb3I7XG4gICAgICAgIHJldHVybiBhd2FpdCBmYWlsUHJvb2YoYXBwbGljYXRpb25SdW5JZCk7XG4gICAgfVxuICAgIHJldHVybiBhd2FpdCBjb21wbGV0ZVByb29mKGFwcGxpY2F0aW9uUnVuSWQpO1xufVxud29ya2Zsb3dQcm9vZi53b3JrZmxvd0lkID0gXCJ3b3JrZmxvdy8vLi9zcmMvd29ya2Zsb3dzL3dvcmtmbG93UHJvb2YvL3dvcmtmbG93UHJvb2ZcIjtcbmdsb2JhbFRoaXMuX19wcml2YXRlX3dvcmtmbG93cy5zZXQoXCJ3b3JrZmxvdy8vLi9zcmMvd29ya2Zsb3dzL3dvcmtmbG93UHJvb2YvL3dvcmtmbG93UHJvb2ZcIiwgd29ya2Zsb3dQcm9vZik7XG52YXIgY2xhaW1Qcm9vZiA9IGdsb2JhbFRoaXNbU3ltYm9sLmZvcihcIldPUktGTE9XX1VTRV9TVEVQXCIpXShcInN0ZXAvLy4vc3JjL3dvcmtmbG93cy93b3JrZmxvd1Byb29mLy9jbGFpbVByb29mXCIpO1xudmFyIHJlY29uY2lsZVByb29mID0gZ2xvYmFsVGhpc1tTeW1ib2wuZm9yKFwiV09SS0ZMT1dfVVNFX1NURVBcIildKFwic3RlcC8vLi9zcmMvd29ya2Zsb3dzL3dvcmtmbG93UHJvb2YvL3JlY29uY2lsZVByb29mXCIpO1xudmFyIHN5bnRoZXRpY1dvcmsgPSBnbG9iYWxUaGlzW1N5bWJvbC5mb3IoXCJXT1JLRkxPV19VU0VfU1RFUFwiKV0oXCJzdGVwLy8uL3NyYy93b3JrZmxvd3Mvd29ya2Zsb3dQcm9vZi8vc3ludGhldGljV29ya1wiKTtcbnN5bnRoZXRpY1dvcmsubWF4UmV0cmllcyA9IDE7XG52YXIgY29tcGxldGVQcm9vZiA9IGdsb2JhbFRoaXNbU3ltYm9sLmZvcihcIldPUktGTE9XX1VTRV9TVEVQXCIpXShcInN0ZXAvLy4vc3JjL3dvcmtmbG93cy93b3JrZmxvd1Byb29mLy9jb21wbGV0ZVByb29mXCIpO1xudmFyIGZhaWxQcm9vZiA9IGdsb2JhbFRoaXNbU3ltYm9sLmZvcihcIldPUktGTE9XX1VTRV9TVEVQXCIpXShcInN0ZXAvLy4vc3JjL3dvcmtmbG93cy93b3JrZmxvd1Byb29mLy9mYWlsUHJvb2ZcIik7XG4iLCAiW1xuXHRcIm5vZGU6YXNzZXJ0XCIsXG5cdFwiYXNzZXJ0XCIsXG5cdFwibm9kZTphc3NlcnQvc3RyaWN0XCIsXG5cdFwiYXNzZXJ0L3N0cmljdFwiLFxuXHRcIm5vZGU6YXN5bmNfaG9va3NcIixcblx0XCJhc3luY19ob29rc1wiLFxuXHRcIm5vZGU6YnVmZmVyXCIsXG5cdFwiYnVmZmVyXCIsXG5cdFwibm9kZTpjaGlsZF9wcm9jZXNzXCIsXG5cdFwiY2hpbGRfcHJvY2Vzc1wiLFxuXHRcIm5vZGU6Y2x1c3RlclwiLFxuXHRcImNsdXN0ZXJcIixcblx0XCJub2RlOmNvbnNvbGVcIixcblx0XCJjb25zb2xlXCIsXG5cdFwibm9kZTpjb25zdGFudHNcIixcblx0XCJjb25zdGFudHNcIixcblx0XCJub2RlOmNyeXB0b1wiLFxuXHRcImNyeXB0b1wiLFxuXHRcIm5vZGU6ZGdyYW1cIixcblx0XCJkZ3JhbVwiLFxuXHRcIm5vZGU6ZGlhZ25vc3RpY3NfY2hhbm5lbFwiLFxuXHRcImRpYWdub3N0aWNzX2NoYW5uZWxcIixcblx0XCJub2RlOmRuc1wiLFxuXHRcImRuc1wiLFxuXHRcIm5vZGU6ZG5zL3Byb21pc2VzXCIsXG5cdFwiZG5zL3Byb21pc2VzXCIsXG5cdFwibm9kZTpkb21haW5cIixcblx0XCJkb21haW5cIixcblx0XCJub2RlOmV2ZW50c1wiLFxuXHRcImV2ZW50c1wiLFxuXHRcIm5vZGU6ZnNcIixcblx0XCJmc1wiLFxuXHRcIm5vZGU6ZnMvcHJvbWlzZXNcIixcblx0XCJmcy9wcm9taXNlc1wiLFxuXHRcIm5vZGU6aHR0cFwiLFxuXHRcImh0dHBcIixcblx0XCJub2RlOmh0dHAyXCIsXG5cdFwiaHR0cDJcIixcblx0XCJub2RlOmh0dHBzXCIsXG5cdFwiaHR0cHNcIixcblx0XCJub2RlOmluc3BlY3RvclwiLFxuXHRcImluc3BlY3RvclwiLFxuXHRcIm5vZGU6aW5zcGVjdG9yL3Byb21pc2VzXCIsXG5cdFwiaW5zcGVjdG9yL3Byb21pc2VzXCIsXG5cdFwibm9kZTptb2R1bGVcIixcblx0XCJtb2R1bGVcIixcblx0XCJub2RlOm5ldFwiLFxuXHRcIm5ldFwiLFxuXHRcIm5vZGU6b3NcIixcblx0XCJvc1wiLFxuXHRcIm5vZGU6cGF0aFwiLFxuXHRcInBhdGhcIixcblx0XCJub2RlOnBhdGgvcG9zaXhcIixcblx0XCJwYXRoL3Bvc2l4XCIsXG5cdFwibm9kZTpwYXRoL3dpbjMyXCIsXG5cdFwicGF0aC93aW4zMlwiLFxuXHRcIm5vZGU6cGVyZl9ob29rc1wiLFxuXHRcInBlcmZfaG9va3NcIixcblx0XCJub2RlOnByb2Nlc3NcIixcblx0XCJwcm9jZXNzXCIsXG5cdFwibm9kZTpxdWVyeXN0cmluZ1wiLFxuXHRcInF1ZXJ5c3RyaW5nXCIsXG5cdFwibm9kZTpxdWljXCIsXG5cdFwibm9kZTpyZWFkbGluZVwiLFxuXHRcInJlYWRsaW5lXCIsXG5cdFwibm9kZTpyZWFkbGluZS9wcm9taXNlc1wiLFxuXHRcInJlYWRsaW5lL3Byb21pc2VzXCIsXG5cdFwibm9kZTpyZXBsXCIsXG5cdFwicmVwbFwiLFxuXHRcIm5vZGU6c2VhXCIsXG5cdFwibm9kZTpzcWxpdGVcIixcblx0XCJub2RlOnN0cmVhbVwiLFxuXHRcInN0cmVhbVwiLFxuXHRcIm5vZGU6c3RyZWFtL2NvbnN1bWVyc1wiLFxuXHRcInN0cmVhbS9jb25zdW1lcnNcIixcblx0XCJub2RlOnN0cmVhbS9wcm9taXNlc1wiLFxuXHRcInN0cmVhbS9wcm9taXNlc1wiLFxuXHRcIm5vZGU6c3RyZWFtL3dlYlwiLFxuXHRcInN0cmVhbS93ZWJcIixcblx0XCJub2RlOnN0cmluZ19kZWNvZGVyXCIsXG5cdFwic3RyaW5nX2RlY29kZXJcIixcblx0XCJub2RlOnRlc3RcIixcblx0XCJub2RlOnRlc3QvcmVwb3J0ZXJzXCIsXG5cdFwibm9kZTp0aW1lcnNcIixcblx0XCJ0aW1lcnNcIixcblx0XCJub2RlOnRpbWVycy9wcm9taXNlc1wiLFxuXHRcInRpbWVycy9wcm9taXNlc1wiLFxuXHRcIm5vZGU6dGxzXCIsXG5cdFwidGxzXCIsXG5cdFwibm9kZTp0cmFjZV9ldmVudHNcIixcblx0XCJ0cmFjZV9ldmVudHNcIixcblx0XCJub2RlOnR0eVwiLFxuXHRcInR0eVwiLFxuXHRcIm5vZGU6dXJsXCIsXG5cdFwidXJsXCIsXG5cdFwibm9kZTp1dGlsXCIsXG5cdFwidXRpbFwiLFxuXHRcIm5vZGU6dXRpbC90eXBlc1wiLFxuXHRcInV0aWwvdHlwZXNcIixcblx0XCJub2RlOnY4XCIsXG5cdFwidjhcIixcblx0XCJub2RlOnZtXCIsXG5cdFwidm1cIixcblx0XCJub2RlOndhc2lcIixcblx0XCJ3YXNpXCIsXG5cdFwibm9kZTp3b3JrZXJfdGhyZWFkc1wiLFxuXHRcIndvcmtlcl90aHJlYWRzXCIsXG5cdFwibm9kZTp6bGliXCIsXG5cdFwiemxpYlwiXG5dXG4iLCAiaW1wb3J0IGJ1aWx0aW5Nb2R1bGVzIGZyb20gJy4vYnVpbHRpbi1tb2R1bGVzLmpzb24nO1xuZXhwb3J0IGRlZmF1bHQgYnVpbHRpbk1vZHVsZXM7XG4iLCAiLyoqXG4gKiBTZXJkZSBjb21wbGlhbmNlIGNoZWNrZXIgZm9yIHdvcmtmbG93IGN1c3RvbSBjbGFzcyBzZXJpYWxpemF0aW9uLlxuICpcbiAqIEFuYWx5emVzIHNvdXJjZSBjb2RlIHRvIGRldGVybWluZSBpZiBjbGFzc2VzIHdpdGggV09SS0ZMT1dfU0VSSUFMSVpFIC9cbiAqIFdPUktGTE9XX0RFU0VSSUFMSVpFIGFyZSBjb3JyZWN0bHkgc2V0IHVwIGZvciB0aGUgd29ya2Zsb3cgc2FuZGJveC5cbiAqXG4gKiBVc2VkIGJ5OlxuICogLSBDTEkgYHZhbGlkYXRlYCBjb21tYW5kXG4gKiAtIENMSSBgdHJhbnNmb3JtYCBjb21tYW5kICgtLWNoZWNrLXNlcmRlKVxuICogLSBTV0MgcGxheWdyb3VuZCBzZXJkZSBhbmFseXNpcyBwYW5lbFxuICogLSBCdWlsZC10aW1lIHdhcm5pbmdzIGluIEJhc2VCdWlsZGVyXG4gKi9cblxuaW1wb3J0IGJ1aWx0aW5Nb2R1bGVzIGZyb20gJ2J1aWx0aW4tbW9kdWxlcyc7XG5pbXBvcnQgdHlwZSB7IFdvcmtmbG93TWFuaWZlc3QgfSBmcm9tICcuL2FwcGx5LXN3Yy10cmFuc2Zvcm0uanMnO1xuXG4vLyBCdWlsZCBhIHJlZ2V4IHRoYXQgbWF0Y2hlcyBOb2RlLmpzIGJ1aWx0LWluIG1vZHVsZSBpbXBvcnRzIGluIHRyYW5zZm9ybWVkIGNvZGUuXG4vLyBIYW5kbGVzIGJvdGggRVNNIChgZnJvbSAnZnMnYCwgYGZyb20gJ25vZGU6ZnMnYCkgYW5kIENKUyAoYHJlcXVpcmUoJ2ZzJylgKVxuY29uc3Qgbm9kZUJ1aWx0aW5zID0gYnVpbHRpbk1vZHVsZXMuam9pbignfCcpO1xuXG4vLyBSZWdleCB0byBleHRyYWN0IHNwZWNpZmljIG1vZHVsZSBuYW1lcyBmcm9tIGltcG9ydC9yZXF1aXJlIHN0YXRlbWVudHNcbmNvbnN0IG5vZGVJbXBvcnRFeHRyYWN0UmVnZXggPSBuZXcgUmVnRXhwKFxuICBgKD86ZnJvbVxcXFxzK1snXCJdKD86bm9kZTopPygoPzoke25vZGVCdWlsdGluc30pKD86L1teJ1wiXSopPylbJ1wiXWAgK1xuICAgIGB8cmVxdWlyZVxcXFxzKlxcXFwoXFxcXHMqWydcIl0oPzpub2RlOik/KCg/OiR7bm9kZUJ1aWx0aW5zfSkoPzovW14nXCJdKik/KVsnXCJdXFxcXHMqXFxcXCkpYCxcbiAgJ2cnXG4pO1xuXG4vLyBSZWdleCB0byBkZXRlY3QgY2xhc3MgcmVnaXN0cmF0aW9uIElJRkVzIGdlbmVyYXRlZCBieSB0aGUgU1dDIHBsdWdpblxuY29uc3QgcmVnaXN0cmF0aW9uSWlmZVJlZ2V4ID1cbiAgL1N5bWJvbFxcLmZvclxccypcXChcXHMqW1wiJ113b3JrZmxvdy1jbGFzcy1yZWdpc3RyeVtcIiddXFxzKlxcKS87XG5cbi8qKlxuICogUmVzdWx0IG9mIGNoZWNraW5nIGEgc2luZ2xlIGNsYXNzIGZvciBzZXJkZSBjb21wbGlhbmNlLlxuICovXG5leHBvcnQgaW50ZXJmYWNlIFNlcmRlQ2xhc3NDaGVja1Jlc3VsdCB7XG4gIC8qKiBUaGUgY2xhc3MgbmFtZSBhcyBkZXRlY3RlZCBpbiB0aGUgc291cmNlICovXG4gIGNsYXNzTmFtZTogc3RyaW5nO1xuICAvKiogVGhlIGNsYXNzSWQgYXNzaWduZWQgYnkgdGhlIFNXQyBwbHVnaW4gKGZyb20gdGhlIG1hbmlmZXN0KSAqL1xuICBjbGFzc0lkOiBzdHJpbmc7XG4gIC8qKiBXaGV0aGVyIHRoZSBTV0MgcGx1Z2luIGRldGVjdGVkIHNlcmRlIHN5bWJvbHMgb24gdGhpcyBjbGFzcyAqL1xuICBkZXRlY3RlZDogYm9vbGVhbjtcbiAgLyoqIFdoZXRoZXIgYSByZWdpc3RyYXRpb24gSUlGRSB3YXMgZ2VuZXJhdGVkIGluIHRoZSBvdXRwdXQgKi9cbiAgcmVnaXN0ZXJlZDogYm9vbGVhbjtcbiAgLyoqXG4gICAqIE5vZGUuanMgYnVpbHQtaW4gbW9kdWxlIGltcG9ydHMgcmVtYWluaW5nIGluIHRoZSB3b3JrZmxvdy1tb2RlIG91dHB1dC5cbiAgICogSWYgbm9uLWVtcHR5LCB0aGUgY2xhc3MgaXMgTk9UIHdvcmtmbG93LXNhbmRib3ggY29tcGxpYW50LlxuICAgKi9cbiAgbm9kZUltcG9ydHM6IHN0cmluZ1tdO1xuICAvKiogV2hldGhlciB0aGUgY2xhc3MgcGFzc2VzIGFsbCBjb21wbGlhbmNlIGNoZWNrcyAqL1xuICBjb21wbGlhbnQ6IGJvb2xlYW47XG4gIC8qKiBIdW1hbi1yZWFkYWJsZSBkZXNjcmlwdGlvbnMgb2YgYW55IGlzc3VlcyBmb3VuZCAqL1xuICBpc3N1ZXM6IHN0cmluZ1tdO1xufVxuXG4vKipcbiAqIEZ1bGwgcmVzdWx0IG9mIHNlcmRlIGNvbXBsaWFuY2UgYW5hbHlzaXMgZm9yIGEgc291cmNlIGZpbGUuXG4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgU2VyZGVDaGVja1Jlc3VsdCB7XG4gIC8qKiBQZXItY2xhc3MgYW5hbHlzaXMgcmVzdWx0cyAqL1xuICBjbGFzc2VzOiBTZXJkZUNsYXNzQ2hlY2tSZXN1bHRbXTtcbiAgLyoqIEFsbCBOb2RlLmpzIGJ1aWx0LWluIGltcG9ydHMgZm91bmQgaW4gdGhlIHdvcmtmbG93LW1vZGUgb3V0cHV0ICovXG4gIGdsb2JhbE5vZGVJbXBvcnRzOiBzdHJpbmdbXTtcbiAgLyoqIFdoZXRoZXIgdGhlIHdvcmtmbG93LW1vZGUgb3V0cHV0IGNvbnRhaW5zIGFueSBzZXJkZS1yZWxhdGVkIGNsYXNzZXMgKi9cbiAgaGFzU2VyZGVDbGFzc2VzOiBib29sZWFuO1xuICAvKiogVGhlIHJhdyB3b3JrZmxvdyBtYW5pZmVzdCBleHRyYWN0ZWQgZnJvbSB0aGUgU1dDIHRyYW5zZm9ybSAqL1xuICBtYW5pZmVzdDogV29ya2Zsb3dNYW5pZmVzdDtcbn1cblxuLyoqXG4gKiBMaWdodHdlaWdodCBzZXJkZSBjb21wbGlhbmNlIGNoZWNrZXIgdGhhdCB3b3JrcyB3aXRoIHByZS1jb21wdXRlZFxuICogU1dDIHRyYW5zZm9ybSByZXN1bHRzLiBUaGlzIGF2b2lkcyByZS1ydW5uaW5nIHRoZSBTV0MgdHJhbnNmb3JtXG4gKiB3aGVuIHRoZSBjYWxsZXIgYWxyZWFkeSBoYXMgdGhlIG91dHB1dHMgKGUuZy4sIHRoZSBwbGF5Z3JvdW5kIG9yIGJ1aWxkZXIpLlxuICovXG5leHBvcnQgZnVuY3Rpb24gYW5hbHl6ZVNlcmRlQ29tcGxpYW5jZShvcHRpb25zOiB7XG4gIC8qKiBTb3VyY2UgY29kZSAodXNlZCBmb3IgcGF0dGVybiBkZXRlY3Rpb24pICovXG4gIHNvdXJjZUNvZGU6IHN0cmluZztcbiAgLyoqIFdvcmtmbG93LW1vZGUgdHJhbnNmb3JtZWQgb3V0cHV0ICovXG4gIHdvcmtmbG93Q29kZTogc3RyaW5nO1xuICAvKiogTWFuaWZlc3QgZXh0cmFjdGVkIGZyb20gdGhlIFNXQyB0cmFuc2Zvcm0gKi9cbiAgbWFuaWZlc3Q6IFdvcmtmbG93TWFuaWZlc3Q7XG59KTogU2VyZGVDaGVja1Jlc3VsdCB7XG4gIGNvbnN0IHsgc291cmNlQ29kZSwgd29ya2Zsb3dDb2RlLCBtYW5pZmVzdCB9ID0gb3B0aW9ucztcblxuICAvLyAxLiBFeHRyYWN0IGFsbCBOb2RlLmpzIGJ1aWx0LWluIGltcG9ydHMgZnJvbSB0aGUgd29ya2Zsb3cgb3V0cHV0XG4gIGNvbnN0IGdsb2JhbE5vZGVJbXBvcnRzID0gZXh0cmFjdE5vZGVJbXBvcnRzKHdvcmtmbG93Q29kZSk7XG5cbiAgLy8gMi4gQ2hlY2sgaWYgdGhlIG1hbmlmZXN0IGNvbnRhaW5zIGFueSBzZXJkZS1yZWdpc3RlcmVkIGNsYXNzZXNcbiAgY29uc3QgY2xhc3NFbnRyaWVzID0gZXh0cmFjdENsYXNzRW50cmllcyhtYW5pZmVzdCk7XG4gIGNvbnN0IGhhc1NlcmRlQ2xhc3NlcyA9IGNsYXNzRW50cmllcy5sZW5ndGggPiAwO1xuXG4gIC8vIDMuIENoZWNrIGlmIHRoZSB3b3JrZmxvdyBvdXRwdXQgY29udGFpbnMgcmVnaXN0cmF0aW9uIElJRkVzXG4gIGNvbnN0IGhhc1JlZ2lzdHJhdGlvbiA9IHJlZ2lzdHJhdGlvbklpZmVSZWdleC50ZXN0KHdvcmtmbG93Q29kZSk7XG5cbiAgLy8gNC4gQW5hbHl6ZSBlYWNoIGNsYXNzXG4gIGNvbnN0IGNsYXNzZXM6IFNlcmRlQ2xhc3NDaGVja1Jlc3VsdFtdID0gY2xhc3NFbnRyaWVzLm1hcCgoZW50cnkpID0+IHtcbiAgICBjb25zdCBpc3N1ZXM6IHN0cmluZ1tdID0gW107XG5cbiAgICAvLyBDaGVjayBmb3IgTm9kZS5qcyBpbXBvcnRzICh0aGVzZSB3aWxsIGZhaWwgaW4gdGhlIHdvcmtmbG93IHNhbmRib3gpXG4gICAgaWYgKGdsb2JhbE5vZGVJbXBvcnRzLmxlbmd0aCA+IDApIHtcbiAgICAgIGlzc3Vlcy5wdXNoKFxuICAgICAgICBgV29ya2Zsb3cgYnVuZGxlIGNvbnRhaW5zIE5vZGUuanMgYnVpbHQtaW4gaW1wb3J0czogJHtnbG9iYWxOb2RlSW1wb3J0cy5qb2luKCcsICcpfS4gYCArXG4gICAgICAgICAgYFRoZXNlIHdpbGwgZmFpbCBhdCBydW50aW1lIGluIHRoZSB3b3JrZmxvdyBzYW5kYm94LiBgICtcbiAgICAgICAgICBgQWRkIFwidXNlIHN0ZXBcIiB0byBtZXRob2RzIHRoYXQgZGVwZW5kIG9uIE5vZGUuanMgQVBJcyBzbyB0aGV5IGFyZSBzdHJpcHBlZCBmcm9tIHRoZSB3b3JrZmxvdyBidW5kbGUuYFxuICAgICAgKTtcbiAgICB9XG5cbiAgICAvLyBDaGVjayBmb3IgcmVnaXN0cmF0aW9uXG4gICAgaWYgKCFoYXNSZWdpc3RyYXRpb24pIHtcbiAgICAgIGlzc3Vlcy5wdXNoKFxuICAgICAgICBgTm8gY2xhc3MgcmVnaXN0cmF0aW9uIElJRkUgd2FzIGdlbmVyYXRlZC4gYCArXG4gICAgICAgICAgYEVuc3VyZSBXT1JLRkxPV19TRVJJQUxJWkUgYW5kIFdPUktGTE9XX0RFU0VSSUFMSVpFIGFyZSBkZWZpbmVkIGFzIHN0YXRpYyBtZXRob2RzIGAgK1xuICAgICAgICAgIGBpbnNpZGUgdGhlIGNsYXNzIGJvZHkgdXNpbmcgY29tcHV0ZWQgcHJvcGVydHkgc3ludGF4OiBzdGF0aWMgW1dPUktGTE9XX1NFUklBTElaRV0oLi4uKSB7IC4uLiB9YFxuICAgICAgKTtcbiAgICB9XG5cbiAgICByZXR1cm4ge1xuICAgICAgY2xhc3NOYW1lOiBlbnRyeS5jbGFzc05hbWUsXG4gICAgICBjbGFzc0lkOiBlbnRyeS5jbGFzc0lkLFxuICAgICAgZGV0ZWN0ZWQ6IHRydWUsXG4gICAgICByZWdpc3RlcmVkOiBoYXNSZWdpc3RyYXRpb24sXG4gICAgICBub2RlSW1wb3J0czogZ2xvYmFsTm9kZUltcG9ydHMsXG4gICAgICBjb21wbGlhbnQ6IGdsb2JhbE5vZGVJbXBvcnRzLmxlbmd0aCA9PT0gMCAmJiBoYXNSZWdpc3RyYXRpb24sXG4gICAgICBpc3N1ZXMsXG4gICAgfTtcbiAgfSk7XG5cbiAgLy8gNS4gQ2hlY2sgZm9yIGNsYXNzZXMgdGhhdCBoYXZlIHNlcmRlIHBhdHRlcm5zIGluIHNvdXJjZSBidXQgd2VyZW4ndCBkZXRlY3RlZCBieSBTV0NcbiAgY29uc3Qgc291cmNlSGFzU2VyZGVQYXR0ZXJucyA9XG4gICAgL1xcW1xccypXT1JLRkxPV18oPzpTRVJJQUxJWkV8REVTRVJJQUxJWkUpXFxzKlxcXS8udGVzdChzb3VyY2VDb2RlKSB8fFxuICAgIC9TeW1ib2xcXC5mb3JcXHMqXFwoXFxzKlsnXCJdd29ya2Zsb3ctKD86c2VyaWFsaXplfGRlc2VyaWFsaXplKVsnXCJdXFxzKlxcKS8udGVzdChcbiAgICAgIHNvdXJjZUNvZGVcbiAgICApO1xuXG4gIGlmIChzb3VyY2VIYXNTZXJkZVBhdHRlcm5zICYmIGNsYXNzRW50cmllcy5sZW5ndGggPT09IDApIHtcbiAgICBjbGFzc2VzLnB1c2goe1xuICAgICAgY2xhc3NOYW1lOiAnPHVua25vd24+JyxcbiAgICAgIGNsYXNzSWQ6ICcnLFxuICAgICAgZGV0ZWN0ZWQ6IGZhbHNlLFxuICAgICAgcmVnaXN0ZXJlZDogZmFsc2UsXG4gICAgICBub2RlSW1wb3J0czogZ2xvYmFsTm9kZUltcG9ydHMsXG4gICAgICBjb21wbGlhbnQ6IGZhbHNlLFxuICAgICAgaXNzdWVzOiBbXG4gICAgICAgIGBTb3VyY2UgY29kZSBjb250YWlucyBXT1JLRkxPV19TRVJJQUxJWkUvV09SS0ZMT1dfREVTRVJJQUxJWkUgcGF0dGVybnMgYnV0IGAgK1xuICAgICAgICAgIGB0aGUgU1dDIHBsdWdpbiBkaWQgbm90IGRldGVjdCBhbnkgc2VyZGUtZW5hYmxlZCBjbGFzc2VzLiBgICtcbiAgICAgICAgICBgRW5zdXJlIHRoZSBzeW1ib2xzIGFyZSBkZWZpbmVkIGFzIHN0YXRpYyBtZXRob2RzIElOU0lERSB0aGUgY2xhc3MgYm9keSwgYCArXG4gICAgICAgICAgYG5vdCBhc3NpZ25lZCBleHRlcm5hbGx5IChlLmcuLCAoTXlDbGFzcyBhcyBhbnkpW1dPUktGTE9XX1NFUklBTElaRV0gPSAuLi4pLmAsXG4gICAgICBdLFxuICAgIH0pO1xuICB9XG5cbiAgcmV0dXJuIHtcbiAgICBjbGFzc2VzLFxuICAgIGdsb2JhbE5vZGVJbXBvcnRzLFxuICAgIGhhc1NlcmRlQ2xhc3NlcyxcbiAgICBtYW5pZmVzdCxcbiAgfTtcbn1cblxuLyoqXG4gKiBFeHRyYWN0IE5vZGUuanMgYnVpbHQtaW4gbW9kdWxlIG5hbWVzIGZyb20gdHJhbnNmb3JtZWQgY29kZS5cbiAqL1xuZnVuY3Rpb24gZXh0cmFjdE5vZGVJbXBvcnRzKGNvZGU6IHN0cmluZyk6IHN0cmluZ1tdIHtcbiAgY29uc3QgaW1wb3J0cyA9IG5ldyBTZXQ8c3RyaW5nPigpO1xuICAvLyBSZXNldCByZWdleCBzdGF0ZVxuICBub2RlSW1wb3J0RXh0cmFjdFJlZ2V4Lmxhc3RJbmRleCA9IDA7XG4gIGZvciAoXG4gICAgbGV0IG1hdGNoID0gbm9kZUltcG9ydEV4dHJhY3RSZWdleC5leGVjKGNvZGUpO1xuICAgIG1hdGNoICE9PSBudWxsO1xuICAgIG1hdGNoID0gbm9kZUltcG9ydEV4dHJhY3RSZWdleC5leGVjKGNvZGUpXG4gICkge1xuICAgIC8vIG1hdGNoWzFdIGlzIGZyb20gdGhlIEVTTSBwYXR0ZXJuLCBtYXRjaFsyXSBpcyBmcm9tIHRoZSBDSlMgcGF0dGVyblxuICAgIGNvbnN0IG1vZHVsZU5hbWUgPSBtYXRjaFsxXSB8fCBtYXRjaFsyXTtcbiAgICBpZiAobW9kdWxlTmFtZSkge1xuICAgICAgLy8gTm9ybWFsaXplIHRvIGJhc2UgbW9kdWxlIG5hbWUgKGUuZy4sICdmcy9wcm9taXNlcycgLT4gJ2ZzJylcbiAgICAgIGltcG9ydHMuYWRkKG1vZHVsZU5hbWUuc3BsaXQoJy8nKVswXSk7XG4gICAgfVxuICB9XG4gIHJldHVybiBbLi4uaW1wb3J0c10uc29ydCgpO1xufVxuXG4vKipcbiAqIEV4dHJhY3QgY2xhc3MgZW50cmllcyBmcm9tIGEgV29ya2Zsb3dNYW5pZmVzdC5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGV4dHJhY3RDbGFzc0VudHJpZXMoXG4gIG1hbmlmZXN0OiBXb3JrZmxvd01hbmlmZXN0XG4pOiBBcnJheTx7IGNsYXNzTmFtZTogc3RyaW5nOyBjbGFzc0lkOiBzdHJpbmc7IGZpbGVOYW1lOiBzdHJpbmcgfT4ge1xuICBjb25zdCBlbnRyaWVzOiBBcnJheTx7XG4gICAgY2xhc3NOYW1lOiBzdHJpbmc7XG4gICAgY2xhc3NJZDogc3RyaW5nO1xuICAgIGZpbGVOYW1lOiBzdHJpbmc7XG4gIH0+ID0gW107XG4gIGlmICghbWFuaWZlc3QuY2xhc3NlcykgcmV0dXJuIGVudHJpZXM7XG5cbiAgZm9yIChjb25zdCBbZmlsZU5hbWUsIGNsYXNzZXNdIG9mIE9iamVjdC5lbnRyaWVzKG1hbmlmZXN0LmNsYXNzZXMpKSB7XG4gICAgZm9yIChjb25zdCBbY2xhc3NOYW1lLCB7IGNsYXNzSWQgfV0gb2YgT2JqZWN0LmVudHJpZXMoY2xhc3NlcykpIHtcbiAgICAgIGVudHJpZXMucHVzaCh7IGNsYXNzTmFtZSwgY2xhc3NJZCwgZmlsZU5hbWUgfSk7XG4gICAgfVxuICB9XG4gIHJldHVybiBlbnRyaWVzO1xufVxuIl0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBQUE7QUFBQSxzQ0FBQUEsU0FBQTtBQUVJLFFBQUksSUFBSTtBQUNaLFFBQUksSUFBSSxJQUFJO0FBQ1osUUFBSSxJQUFJLElBQUk7QUFDWixRQUFJLElBQUksSUFBSTtBQUNaLFFBQUksSUFBSSxJQUFJO0FBQ1osUUFBSSxJQUFJLElBQUk7QUFhUixJQUFBQSxRQUFPLFVBQVUsU0FBUyxLQUFLLFNBQVM7QUFDeEMsZ0JBQVUsV0FBVyxDQUFDO0FBQ3RCLFVBQUksT0FBTyxPQUFPO0FBQ2xCLFVBQUksU0FBUyxZQUFZLElBQUksU0FBUyxHQUFHO0FBQ3JDLGVBQU8sTUFBTSxHQUFHO0FB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O0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFDRDs7O0FDN0dBLElBQU9DLDJCQUFROzs7QUNnQmYsSUFBQSxlQUFBQyx5QkFBQSxLQUFBLEdBQUE7QUFHQSxJQUFBLHlCQUFBLElBQUEsT0FBQSxnQ0FBd0UsWUFBQSwwREFBQSxZQUFBLDhCQUFBLEdBQUE7IiwKICAibmFtZXMiOiBbIm1vZHVsZSIsICJtcyIsICJjb21wbGV0ZWQiLCAibXMiLCAiYnVpbHRpbl9tb2R1bGVzX2RlZmF1bHQiLCAiYnVpbHRpbl9tb2R1bGVzX2RlZmF1bHQiXQp9Cg==
`;

export const POST = workflowEntrypoint(workflowCode);
export const GET = POST;
export const HEAD = POST;
export const OPTIONS = POST;