import { GoogleGenAI } from "@google/genai";
import { Octokit } from "@octokit/rest";

const SYSTEM = `You are UNORON AI, an autonomous software-development agent.

Return ONLY valid JSON:
{"files":{},"preview":"","version":"","log":[],"commitMessage":""}

For build: create a runnable project from the user's requirements.
For fix: preserve existing behavior and fix requested issues.
For test: inspect the supplied files and report only checks actually performed.
For self-upgrade: improve UNORON source files while preserving security, authentication, secrets protection, versioning and rollback controls.

Never put API keys or secrets in browser code.
Never claim code was executed when it was not.
Return complete file contents keyed by repository-relative paths.`;

function staticChecks(files) {
  const names = Object.keys(files || {});
  const logs = [`Candidate contains ${names.length} file(s).`];

  if (names.includes("package.json")) {
    logs.push("✓ package.json present");
  }

  if (names.includes("index.html")) {
    logs.push("✓ index.html present");
  }

  return logs;
}

async function commitToGithub(files, message) {
  const token = process.env.GITHUB_TOKEN;
  const owner = process.env.GITHUB_OWNER;
  const repo = process.env.GITHUB_REPO;
  const branch = process.env.GITHUB_BRANCH || "main";

  if (!token || !owner || !repo) {
    return {
      ok: false,
      reason: "GitHub credentials not configured; candidate remains uncommitted."
    };
  }

  const gh = new Octokit({ auth: token });

  const ref = await gh.git.getRef({
    owner,
    repo,
    ref: `heads/${branch}`
  });

  const baseCommit = await gh.git.getCommit({
    owner,
    repo,
    commit_sha: ref.data.object.sha
  });

  const blobs = [];

  for (const [path, content] of Object.entries(files || {})) {
    const blob = await gh.git.createBlob({
      owner,
      repo,
      content: Buffer.from(String(content)).toString("base64"),
      encoding: "base64"
    });

    blobs.push({
      path,
      mode: "100644",
      type: "blob",
      sha: blob.data.sha
    });
  }

  const tree = await gh.git.createTree({
    owner,
    repo,
    base_tree: baseCommit.data.tree.sha,
    tree: blobs
  });

  const commit = await gh.git.createCommit({
    owner,
    repo,
    message,
    tree: tree.data.sha,
    parents: [ref.data.object.sha]
  });

  await gh.git.updateRef({
    owner,
    repo,
    ref: `heads/${branch}`,
    sha: commit.data.sha,
    force: false
  });

  return {
    ok: true,
    sha: commit.data.sha
  };
}

export default async req => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", {
      status: 405
    });
  }

  try {
    const body = await req.json();

    const {
      prompt,
      mode = "build",
      files = {},
      version = "4.1.0"
    } = body;

    if (!prompt) {
      return Response.json(
        { error: "Prompt required" },
        { status: 400 }
      );
    }

    if (!process.env.GEMINI_API_KEY) {
      return Response.json(
        {
          error: "GEMINI_API_KEY is not configured in Netlify."
        },
        { status: 500 }
      );
    }

    const ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY
    });

    const model =
      process.env.GEMINI_MODEL || "gemini-2.5-flash";

    const userPayload = JSON.stringify({
      prompt,
      mode,
      version,
      files
    });

    const response = await ai.models.generateContent({
      model,
      contents: `${SYSTEM}

USER REQUEST:
${userPayload}`,
      config: {
        responseMimeType: "application/json"
      }
    });

    const out = JSON.parse(response.text || "{}");

    out.files = out.files || files;
    out.version = out.version || version;

    out.log = [
      ...(out.log || []),
      ...staticChecks(out.files)
    ];

    if (!out.preview && out.files["index.html"]) {
      out.preview = out.files["index.html"];
    }

    if (
      mode === "self-upgrade" &&
      process.env.ENABLE_SELF_COMMIT === "true"
    ) {
      const result = await commitToGithub(
        out.files,
        out.commitMessage ||
          `UNORON upgrade ${out.version}`
      );

      out.log.push(
        result.ok
          ? `✓ Candidate committed: ${result.sha}`
          : `• ${result.reason}`
      );
    }

    return Response.json(out);

  } catch (e) {
    return Response.json(
      {
        error: e?.message || "Agent error"
      },
      { status: 500 }
    );
  }
};
