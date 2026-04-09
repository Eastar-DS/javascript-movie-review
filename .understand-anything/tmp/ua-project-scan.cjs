#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const projectRoot = process.argv[2];
const outputPath = process.argv[3];

if (!projectRoot || !outputPath) {
  console.error("Usage: ua-project-scan.js <projectRoot> <outputPath>");
  process.exit(1);
}

try {
  if (!fs.existsSync(projectRoot) || !fs.statSync(projectRoot).isDirectory()) {
    console.error(`Not a directory: ${projectRoot}`);
    process.exit(1);
  }
} catch (err) {
  console.error(`Cannot access directory: ${projectRoot} - ${err.message}`);
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Step 1: File Discovery
// ---------------------------------------------------------------------------
function listGitFiles(root) {
  try {
    const out = execSync("git ls-files", {
      cwd: root,
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
    });
    return out
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
  } catch (e) {
    return null;
  }
}

function walkDir(root) {
  const results = [];
  const stack = [root];
  while (stack.length) {
    const current = stack.pop();
    let entries;
    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch (e) {
      continue;
    }
    for (const entry of entries) {
      const full = path.join(current, entry.name);
      const rel = path.relative(root, full);
      if (entry.isDirectory()) {
        if (
          entry.name === "node_modules" ||
          entry.name === ".git" ||
          entry.name === "vendor" ||
          entry.name === "venv" ||
          entry.name === ".venv" ||
          entry.name === "__pycache__" ||
          entry.name === "dist" ||
          entry.name === "build" ||
          entry.name === "out" ||
          entry.name === "coverage" ||
          entry.name === ".next" ||
          entry.name === ".cache" ||
          entry.name === ".turbo" ||
          entry.name === "target" ||
          entry.name === ".idea" ||
          entry.name === ".vscode"
        ) {
          continue;
        }
        stack.push(full);
      } else if (entry.isFile()) {
        results.push(rel);
      }
    }
  }
  return results;
}

let allFiles = listGitFiles(projectRoot);
if (!allFiles) {
  allFiles = walkDir(projectRoot);
}

// ---------------------------------------------------------------------------
// Step 2: Exclusion Filtering
// ---------------------------------------------------------------------------
const EXCLUDE_DIR_SEGMENTS = new Set([
  "node_modules",
  ".git",
  "vendor",
  "venv",
  ".venv",
  "__pycache__",
  "dist",
  "build",
  "out",
  "coverage",
  ".next",
  ".cache",
  ".turbo",
  "target",
  ".idea",
  ".vscode",
]);

const BINARY_EXT = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".svg",
  ".ico",
  ".woff",
  ".woff2",
  ".ttf",
  ".eot",
  ".mp3",
  ".mp4",
  ".pdf",
  ".zip",
  ".tar",
  ".gz",
]);

function hasExcludedSegment(relPath) {
  const segs = relPath.split(/[\\/]/);
  for (const s of segs) {
    if (EXCLUDE_DIR_SEGMENTS.has(s)) return true;
  }
  return false;
}

function isExcludedFile(relPath) {
  const base = path.basename(relPath);
  const lower = base.toLowerCase();
  const ext = path.extname(base).toLowerCase();

  if (hasExcludedSegment(relPath)) return true;
  if (BINARY_EXT.has(ext)) return true;

  // Lock files
  if (ext === ".lock") return true;
  if (lower === "package-lock.json") return true;
  if (lower === "yarn.lock") return true;
  if (lower === "pnpm-lock.yaml") return true;

  // Generated / minified
  if (/\.min\.(js|css)$/.test(lower)) return true;
  if (ext === ".map") return true;
  if (/\.generated\./.test(lower)) return true;

  // Misc non-source
  if (lower === "license" || lower === "license.md" || lower === "license.txt") return true;
  if (lower === ".gitignore") return true;
  if (lower === ".editorconfig") return true;
  if (lower === ".prettierrc") return true;
  if (/^\.eslintrc/.test(lower)) return true;
  if (ext === ".log") return true;

  return false;
}

const discovered = allFiles.filter((f) => {
  const full = path.join(projectRoot, f);
  try {
    if (!fs.existsSync(full)) return false;
    if (!fs.statSync(full).isFile()) return false;
  } catch (e) {
    return false;
  }
  return !isExcludedFile(f);
});

// ---------------------------------------------------------------------------
// Step 3: Language Detection
// ---------------------------------------------------------------------------
const EXT_LANG = {
  ".ts": "typescript",
  ".tsx": "typescript",
  ".js": "javascript",
  ".jsx": "javascript",
  ".mjs": "javascript",
  ".cjs": "javascript",
  ".py": "python",
  ".go": "go",
  ".rs": "rust",
  ".java": "java",
  ".rb": "ruby",
  ".cpp": "cpp",
  ".cc": "cpp",
  ".cxx": "cpp",
  ".h": "cpp",
  ".hpp": "cpp",
  ".c": "c",
  ".cs": "csharp",
  ".swift": "swift",
  ".kt": "kotlin",
  ".php": "php",
  ".vue": "vue",
  ".svelte": "svelte",
  ".sh": "shell",
  ".bash": "shell",
  ".md": "markdown",
  ".rst": "markdown",
  ".yaml": "yaml",
  ".yml": "yaml",
  ".json": "json",
  ".toml": "toml",
  ".sql": "sql",
  ".graphql": "graphql",
  ".gql": "graphql",
  ".proto": "protobuf",
  ".tf": "terraform",
  ".tfvars": "terraform",
  ".html": "html",
  ".htm": "html",
  ".css": "css",
  ".scss": "css",
  ".sass": "css",
  ".less": "css",
  ".xml": "xml",
  ".cfg": "config",
  ".ini": "config",
  ".env": "config",
};

function detectLanguage(relPath) {
  const base = path.basename(relPath);
  const ext = path.extname(base).toLowerCase();
  if (EXT_LANG[ext]) return EXT_LANG[ext];
  if (base === "Dockerfile" || /^Dockerfile\./.test(base)) return "dockerfile";
  if (base === "Makefile") return "makefile";
  if (base === "Jenkinsfile") return "jenkinsfile";
  // files like .env.example
  if (/^\.env/.test(base)) return "config";
  return null;
}

// ---------------------------------------------------------------------------
// Step 4: File Category Detection
// ---------------------------------------------------------------------------
function detectCategory(relPath) {
  const base = path.basename(relPath);
  const lower = base.toLowerCase();
  const ext = path.extname(base).toLowerCase();
  const relNorm = relPath.split(path.sep).join("/");

  // Infra first (most specific)
  if (base === "Dockerfile" || /^Dockerfile/.test(base)) return "infra";
  if (/^docker-compose(\..+)?\.(ya?ml)$/i.test(base)) return "infra";
  if (ext === ".tf" || ext === ".tfvars") return "infra";
  if (base === "Makefile") return "infra";
  if (base === "Jenkinsfile") return "infra";
  if (base === "Procfile") return "infra";
  if (base === "Vagrantfile") return "infra";
  if (relNorm.startsWith(".github/workflows/")) return "infra";
  if (lower === ".gitlab-ci.yml") return "infra";
  if (relNorm.startsWith(".circleci/")) return "infra";
  if (/\.k8s\.(ya?ml)$/i.test(base)) return "infra";
  if (relNorm.split("/").includes("k8s")) return "infra";
  if (relNorm.split("/").includes("kubernetes")) return "infra";

  // Docs
  if ((ext === ".md" || ext === ".rst" || ext === ".txt") && lower !== "license") return "docs";

  // Data
  if (ext === ".sql") return "data";
  if (ext === ".graphql" || ext === ".gql") return "data";
  if (ext === ".proto") return "data";
  if (ext === ".prisma") return "data";
  if (/\.schema\.json$/i.test(lower)) return "data";
  if (ext === ".csv") return "data";

  // Config
  if (
    ext === ".yaml" ||
    ext === ".yml" ||
    ext === ".json" ||
    ext === ".toml" ||
    ext === ".xml" ||
    ext === ".cfg" ||
    ext === ".ini" ||
    ext === ".env" ||
    /^\.env/.test(base) ||
    lower === "tsconfig.json" ||
    lower === "package.json" ||
    lower === "pyproject.toml" ||
    lower === "cargo.toml" ||
    lower === "go.mod"
  ) {
    return "config";
  }

  // Script
  if (ext === ".sh" || ext === ".bash" || ext === ".ps1" || ext === ".bat") return "script";

  // Markup
  if (
    ext === ".html" ||
    ext === ".htm" ||
    ext === ".css" ||
    ext === ".scss" ||
    ext === ".sass" ||
    ext === ".less"
  ) {
    return "markup";
  }

  return "code";
}

// ---------------------------------------------------------------------------
// Step 5: Line Counting
// ---------------------------------------------------------------------------
function countLinesBatch(files) {
  // Count via fs.readFileSync to avoid spawning many processes and shell-escaping issues.
  const result = {};
  for (const rel of files) {
    const full = path.join(projectRoot, rel);
    try {
      const content = fs.readFileSync(full, "utf8");
      if (!content) {
        result[rel] = 0;
      } else {
        // Count newlines; if file doesn't end in newline, add 1 for last line
        let count = 0;
        for (let i = 0; i < content.length; i++) {
          if (content.charCodeAt(i) === 10) count++;
        }
        if (content.length > 0 && content.charCodeAt(content.length - 1) !== 10) count++;
        result[rel] = count;
      }
    } catch (e) {
      result[rel] = 0;
    }
  }
  return result;
}

const lineCounts = countLinesBatch(discovered);

// ---------------------------------------------------------------------------
// Step 6: Framework Detection
// ---------------------------------------------------------------------------
const frameworks = new Set();
let projectName = null;
let rawDescription = "";

function safeReadJson(relPath) {
  const full = path.join(projectRoot, relPath);
  try {
    if (!fs.existsSync(full)) return null;
    return JSON.parse(fs.readFileSync(full, "utf8"));
  } catch (e) {
    return null;
  }
}

function safeReadText(relPath) {
  const full = path.join(projectRoot, relPath);
  try {
    if (!fs.existsSync(full)) return null;
    return fs.readFileSync(full, "utf8");
  } catch (e) {
    return null;
  }
}

const JS_FRAMEWORK_MAP = {
  react: "React",
  vue: "Vue",
  svelte: "Svelte",
  "@angular/core": "Angular",
  express: "Express",
  fastify: "Fastify",
  koa: "Koa",
  next: "Next.js",
  nuxt: "Nuxt",
  vite: "Vite",
  vitest: "Vitest",
  jest: "Jest",
  mocha: "Mocha",
  tailwindcss: "Tailwind CSS",
  prisma: "Prisma",
  typeorm: "TypeORM",
  sequelize: "Sequelize",
  mongoose: "Mongoose",
  redux: "Redux",
  zustand: "Zustand",
  mobx: "MobX",
  cypress: "Cypress",
  typescript: "TypeScript",
};

const PY_FRAMEWORK_MAP = {
  django: "Django",
  djangorestframework: "Django REST Framework",
  fastapi: "FastAPI",
  flask: "Flask",
  sqlalchemy: "SQLAlchemy",
  alembic: "Alembic",
  celery: "Celery",
  pydantic: "Pydantic",
  uvicorn: "Uvicorn",
  gunicorn: "Gunicorn",
  aiohttp: "aiohttp",
  tornado: "Tornado",
  starlette: "Starlette",
  pytest: "pytest",
  hypothesis: "Hypothesis",
  channels: "Django Channels",
};

const RUBY_FRAMEWORK_MAP = {
  rails: "Ruby on Rails",
  railties: "Ruby on Rails",
  sinatra: "Sinatra",
  grape: "Grape",
  rspec: "RSpec",
  sidekiq: "Sidekiq",
  activerecord: "ActiveRecord",
  actionpack: "ActionPack",
  devise: "Devise",
  pundit: "Pundit",
};

const GO_FRAMEWORK_MAP = {
  "github.com/gin-gonic/gin": "Gin",
  "github.com/labstack/echo": "Echo",
  "github.com/gofiber/fiber": "Fiber",
  "github.com/go-chi/chi": "chi",
  "gorm.io/gorm": "GORM",
};

const RUST_FRAMEWORK_MAP = {
  "actix-web": "Actix Web",
  axum: "Axum",
  rocket: "Rocket",
  diesel: "Diesel",
  tokio: "Tokio",
  serde: "Serde",
  warp: "Warp",
};

const JVM_FRAMEWORK_MAP = {
  "spring-boot": "Spring Boot",
  "spring-web": "Spring Web",
  "spring-data": "Spring Data",
  quarkus: "Quarkus",
  micronaut: "Micronaut",
  hibernate: "Hibernate",
  jakarta: "Jakarta EE",
  junit: "JUnit",
  ktor: "Ktor",
};

// package.json
const pkg = safeReadJson("package.json");
if (pkg) {
  if (typeof pkg.name === "string") projectName = pkg.name;
  if (typeof pkg.description === "string") rawDescription = pkg.description;
  const deps = Object.assign({}, pkg.dependencies || {}, pkg.devDependencies || {});
  for (const dep of Object.keys(deps)) {
    if (JS_FRAMEWORK_MAP[dep]) frameworks.add(JS_FRAMEWORK_MAP[dep]);
  }
}

// tsconfig.json
if (fs.existsSync(path.join(projectRoot, "tsconfig.json"))) {
  frameworks.add("TypeScript");
}

// Cargo.toml
const cargo = safeReadText("Cargo.toml");
if (cargo) {
  const nameMatch = cargo.match(/\[package\][\s\S]*?name\s*=\s*"([^"]+)"/);
  if (nameMatch && !projectName) projectName = nameMatch[1];
  const depsSection = cargo.match(/\[dependencies\]([\s\S]*?)(\n\[|$)/);
  if (depsSection) {
    for (const line of depsSection[1].split("\n")) {
      const m = line.match(/^\s*([a-zA-Z0-9_\-]+)\s*=/);
      if (m && RUST_FRAMEWORK_MAP[m[1]]) frameworks.add(RUST_FRAMEWORK_MAP[m[1]]);
    }
  }
}

// go.mod
const gomod = safeReadText("go.mod");
if (gomod) {
  const modMatch = gomod.match(/^module\s+(.+)$/m);
  if (modMatch && !projectName) {
    const modPath = modMatch[1].trim();
    projectName = modPath.split("/").pop();
  }
  for (const [key, value] of Object.entries(GO_FRAMEWORK_MAP)) {
    if (gomod.indexOf(key) !== -1) frameworks.add(value);
  }
}

// requirements.txt
const reqs = safeReadText("requirements.txt");
if (reqs) {
  for (const line of reqs.split("\n")) {
    const name = line.trim().split(/[<>=!~\s]/)[0].toLowerCase();
    if (PY_FRAMEWORK_MAP[name]) frameworks.add(PY_FRAMEWORK_MAP[name]);
  }
}

// pyproject.toml
const pyproject = safeReadText("pyproject.toml");
if (pyproject) {
  const nameMatch =
    pyproject.match(/\[project\][\s\S]*?name\s*=\s*"([^"]+)"/) ||
    pyproject.match(/\[tool\.poetry\][\s\S]*?name\s*=\s*"([^"]+)"/);
  if (nameMatch && !projectName) projectName = nameMatch[1];
  const lower = pyproject.toLowerCase();
  for (const key of Object.keys(PY_FRAMEWORK_MAP)) {
    if (lower.indexOf(key) !== -1) frameworks.add(PY_FRAMEWORK_MAP[key]);
  }
  if (/\[tool\.pytest\.ini_options\]/.test(pyproject)) frameworks.add("pytest");
  if (/\[tool\.django\]/.test(pyproject)) frameworks.add("Django");
}

// setup.py / setup.cfg / Pipfile
for (const f of ["setup.py", "setup.cfg", "Pipfile"]) {
  const text = safeReadText(f);
  if (text) {
    const lower = text.toLowerCase();
    for (const key of Object.keys(PY_FRAMEWORK_MAP)) {
      if (lower.indexOf(key) !== -1) frameworks.add(PY_FRAMEWORK_MAP[key]);
    }
  }
}

// Gemfile
const gemfile = safeReadText("Gemfile");
if (gemfile) {
  for (const line of gemfile.split("\n")) {
    const m = line.match(/gem\s+['"]([^'"]+)['"]/);
    if (m && RUBY_FRAMEWORK_MAP[m[1]]) frameworks.add(RUBY_FRAMEWORK_MAP[m[1]]);
  }
}

// pom.xml / build.gradle(.kts)
for (const f of ["pom.xml", "build.gradle", "build.gradle.kts"]) {
  const text = safeReadText(f);
  if (text) {
    const lower = text.toLowerCase();
    for (const key of Object.keys(JVM_FRAMEWORK_MAP)) {
      if (lower.indexOf(key) !== -1) frameworks.add(JVM_FRAMEWORK_MAP[key]);
    }
  }
}

// Infra detection from discovered files
for (const rel of discovered) {
  const base = path.basename(rel);
  const relNorm = rel.split(path.sep).join("/");
  if (base === "Dockerfile") frameworks.add("Docker");
  if (/^docker-compose\.ya?ml$/i.test(base)) frameworks.add("Docker Compose");
  if (path.extname(base).toLowerCase() === ".tf") frameworks.add("Terraform");
  if (relNorm.startsWith(".github/workflows/") && /\.ya?ml$/i.test(base))
    frameworks.add("GitHub Actions");
  if (relNorm === ".gitlab-ci.yml") frameworks.add("GitLab CI");
  if (base === "Jenkinsfile") frameworks.add("Jenkins");
}

// ---------------------------------------------------------------------------
// Step 8: Project name fallback
// ---------------------------------------------------------------------------
if (!projectName) {
  projectName = path.basename(projectRoot);
}

// ---------------------------------------------------------------------------
// README head
// ---------------------------------------------------------------------------
let readmeHead = "";
const readmeCandidates = ["README.md", "readme.md", "Readme.md", "README.rst", "README.txt"];
for (const cand of readmeCandidates) {
  const text = safeReadText(cand);
  if (text) {
    readmeHead = text.split("\n").slice(0, 10).join("\n");
    break;
  }
}

// ---------------------------------------------------------------------------
// Assemble file entries
// ---------------------------------------------------------------------------
const fileEntries = [];
const languageSet = new Set();

for (const rel of discovered) {
  const relNorm = rel.split(path.sep).join("/");
  const lang = detectLanguage(rel);
  const category = detectCategory(rel);
  const sizeLines = lineCounts[rel] || 0;
  if (lang) languageSet.add(lang);
  fileEntries.push({
    path: relNorm,
    language: lang || "unknown",
    sizeLines,
    fileCategory: category,
  });
}

fileEntries.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));

// ---------------------------------------------------------------------------
// Step 7: Complexity
// ---------------------------------------------------------------------------
const totalFiles = fileEntries.length;
let estimatedComplexity;
if (totalFiles <= 30) estimatedComplexity = "small";
else if (totalFiles <= 150) estimatedComplexity = "moderate";
else if (totalFiles <= 500) estimatedComplexity = "large";
else estimatedComplexity = "very-large";

// ---------------------------------------------------------------------------
// Step 9: Import Resolution
// ---------------------------------------------------------------------------
const fileSet = new Set(fileEntries.map((f) => f.path));
const importMap = {};

function toPosix(p) {
  return p.split(path.sep).join("/");
}

function tryResolveWithExtensions(basePath) {
  const exts = [
    "",
    ".ts",
    ".tsx",
    ".js",
    ".jsx",
    ".mjs",
    ".cjs",
    ".py",
    ".go",
    ".rs",
    ".rb",
    "/index.ts",
    "/index.tsx",
    "/index.js",
    "/index.jsx",
  ];
  for (const ext of exts) {
    const candidate = toPosix(path.normalize(basePath + ext));
    if (fileSet.has(candidate)) return candidate;
  }
  return null;
}

function resolveRelative(fromFile, importPath) {
  const fromDir = path.dirname(fromFile);
  const combined = path.join(fromDir, importPath);
  return tryResolveWithExtensions(combined);
}

// For Go, extract module path
let goModulePath = null;
if (gomod) {
  const m = gomod.match(/^module\s+(.+)$/m);
  if (m) goModulePath = m[1].trim();
}

function extractImportsJS(content) {
  const imports = [];
  const patterns = [
    /import\s+(?:[^'"`]*?\s+from\s+)?['"]([^'"]+)['"]/g,
    /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
    /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
    /export\s+(?:\*|\{[^}]*\})\s+from\s+['"]([^'"]+)['"]/g,
  ];
  for (const re of patterns) {
    let m;
    while ((m = re.exec(content)) !== null) {
      imports.push(m[1]);
    }
  }
  return imports;
}

function extractImportsPython(content) {
  const imports = [];
  const re = /^\s*from\s+(\.+[\w.]*)\s+import\s+/gm;
  let m;
  while ((m = re.exec(content)) !== null) imports.push(m[1]);
  return imports;
}

function extractImportsRuby(content) {
  const imports = [];
  const re = /require_relative\s+['"]([^'"]+)['"]/g;
  let m;
  while ((m = re.exec(content)) !== null) imports.push(m[1]);
  return imports;
}

function extractImportsGo(content) {
  const imports = [];
  const singleRe = /^\s*import\s+"([^"]+)"/gm;
  let m;
  while ((m = singleRe.exec(content)) !== null) imports.push(m[1]);
  const blockRe = /import\s*\(\s*([\s\S]*?)\)/g;
  while ((m = blockRe.exec(content)) !== null) {
    const block = m[1];
    const lineRe = /"([^"]+)"/g;
    let lm;
    while ((lm = lineRe.exec(block)) !== null) imports.push(lm[1]);
  }
  return imports;
}

function extractImportsRust(content) {
  const imports = [];
  const useRe = /use\s+(crate|super|self)::([\w:]+)/g;
  let m;
  while ((m = useRe.exec(content)) !== null) imports.push(`${m[1]}::${m[2]}`);
  const modRe = /^\s*mod\s+(\w+)\s*;/gm;
  while ((m = modRe.exec(content)) !== null) imports.push(`mod:${m[1]}`);
  return imports;
}

for (const entry of fileEntries) {
  const rel = entry.path;
  if (entry.fileCategory !== "code") {
    importMap[rel] = [];
    continue;
  }
  const full = path.join(projectRoot, rel);
  let content = "";
  try {
    content = fs.readFileSync(full, "utf8");
  } catch (e) {
    importMap[rel] = [];
    continue;
  }
  const lang = entry.language;
  const resolved = new Set();

  if (lang === "typescript" || lang === "javascript" || lang === "vue" || lang === "svelte") {
    const imports = extractImportsJS(content);
    for (const imp of imports) {
      if (imp.startsWith("./") || imp.startsWith("../")) {
        const r = resolveRelative(rel, imp);
        if (r) resolved.add(r);
      }
    }
  } else if (lang === "python") {
    const imports = extractImportsPython(content);
    for (const imp of imports) {
      // imp like '.', '..', '.sub', '..pkg.mod'
      const dotMatch = imp.match(/^(\.+)(.*)$/);
      if (!dotMatch) continue;
      const dots = dotMatch[1].length;
      const rest = dotMatch[2];
      const fromDir = path.dirname(rel);
      let baseDir = fromDir;
      // First dot refers to current dir; each extra dot goes up
      for (let i = 1; i < dots; i++) {
        baseDir = path.dirname(baseDir);
      }
      const subPath = rest.replace(/\./g, "/");
      const combined = subPath ? path.join(baseDir, subPath) : baseDir;
      const resolvedPath = tryResolveWithExtensions(combined);
      if (resolvedPath) resolved.add(resolvedPath);
    }
  } else if (lang === "ruby") {
    const imports = extractImportsRuby(content);
    for (const imp of imports) {
      const r = resolveRelative(rel, imp);
      if (r) resolved.add(r);
    }
  } else if (lang === "go" && goModulePath) {
    const imports = extractImportsGo(content);
    for (const imp of imports) {
      if (imp.startsWith(goModulePath)) {
        const sub = imp.substring(goModulePath.length).replace(/^\//, "");
        // Go imports refer to packages (directories); skip directory resolution
        // Try adding common file markers
        const candidates = [sub + ".go", sub + "/main.go"];
        for (const c of candidates) {
          if (fileSet.has(c)) {
            resolved.add(c);
            break;
          }
        }
      }
    }
  } else if (lang === "rust") {
    // Skip for now - resolution is complex
  }

  importMap[rel] = Array.from(resolved).sort();
}

// ---------------------------------------------------------------------------
// Final result
// ---------------------------------------------------------------------------
const languages = Array.from(languageSet).sort();
const frameworksArr = Array.from(frameworks).sort();

const result = {
  scriptCompleted: true,
  name: projectName,
  rawDescription,
  readmeHead,
  languages,
  frameworks: frameworksArr,
  files: fileEntries,
  totalFiles,
  estimatedComplexity,
  importMap,
};

try {
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(result, null, 2), "utf8");
} catch (err) {
  console.error(`Failed to write output: ${err.message}`);
  process.exit(1);
}

process.exit(0);
