// 네이버 블로그 CS·이웃 루프 설치 마법사 (Node.js 18+, 추가 설치 없음)
//   node setup.mjs             전체 설치 (기존 config.json이 있으면 그 값을 기본값으로 불러옴)
//   node setup.mjs --neighbor  서로이웃 범위만 수정
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import { fileURLToPath } from "node:url";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const CONFIG = path.join(DIR, "config.json");
const HISTORY = path.join(DIR, "처리기록.json");
const ONLY_NEIGHBOR = process.argv.includes("--neighbor");

// ── 입력 도우미 (파이프 입력이 끝나면 기본값을 쓴다) ──
const rl = readline.createInterface({ input: process.stdin });
const buf = [];
const waiters = [];
let closed = false;
rl.on("line", (l) => (waiters.length ? waiters.shift()(l) : buf.push(l)));
rl.on("close", () => {
  closed = true;
  while (waiters.length) waiters.shift()("");
});
const next = () => new Promise((r) => (buf.length ? r(buf.shift()) : closed ? r("") : waiters.push(r)));
async function ask(q, def = "") {
  process.stdout.write(`${q}${def !== "" ? ` [${def}]` : ""}: `);
  const a = (await next()).trim();
  if (closed && a === "") process.stdout.write("\n");
  return a === "" ? String(def) : a;
}
const yes = (s) => /^(y|yes|예|네|ㅇ|1|true)$/i.test(String(s).trim());
const list = (s) =>
  String(s)
    .split(/[,，\n]/)
    .map((x) => x.trim())
    .filter(Boolean);
const num = (s, def, min, max) => {
  const v = parseInt(s, 10);
  if (Number.isNaN(v)) return def;
  return Math.min(max, Math.max(min, v));
};
const ymd = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

// ── 기존 설정 불러오기 ──
let old = {};
if (fs.existsSync(CONFIG)) {
  try {
    old = JSON.parse(fs.readFileSync(CONFIG, "utf8"));
  } catch {
    old = {};
  }
}
if (ONLY_NEIGHBOR && !old.blogId) {
  console.log("config.json이 없습니다. 먼저 setup.cmd(또는 node setup.mjs)로 전체 설치를 해주세요.");
  process.exit(1);
}
const oldN = old.neighbor || {};
const oldI = old.inquiry || {};
const cfg = { ...old };

console.log("\n=== 네이버 블로그 CS·이웃 루프 " + (ONLY_NEIGHBOR ? "서로이웃 범위 수정" : "설치") + " ===");
if (old.blogId) console.log("기존 설정을 불러왔습니다. 엔터를 누르면 [괄호] 안의 값을 그대로 씁니다.\n");

if (!ONLY_NEIGHBOR) {
  console.log("[1/3] 내 블로그");
  cfg.blogId = await ask("  네이버 블로그 아이디 (blog.naver.com/ 뒤에 오는 값)", old.blogId || "");
  while (!/^[A-Za-z0-9_.-]+$/.test(cfg.blogId) && !closed) {
    cfg.blogId = await ask("  영문·숫자로 된 블로그 아이디를 입력해 주세요", "");
  }
  cfg.blogNickname = await ask("  댓글에 표시되는 내 블로그 닉네임 (등록 후 본인 확인에 씁니다)", old.blogNickname || "");
  cfg.brandName = await ask("  답글·신청 메시지에서 쓸 이름 (예: 아트룸)", old.brandName || cfg.blogNickname);
  console.log("  ※ 네이버 계정 하나당 ego lite 프로필 하나를 쓰길 권장합니다. 모르면 비워 두세요(기본 프로필 사용).");
  cfg.profileId = await ask("  ego lite 프로필 ID (예: Profile 1)", old.profileId || "");
  cfg.scheduleTime = await ask("  매일 실행 시간 (24시간, 예: 10:30)", old.scheduleTime || "10:30");
  if (!/^([01]?\d|2[0-3]):[0-5]\d$/.test(cfg.scheduleTime)) {
    console.log("  → 형식이 맞지 않아 10:30으로 설정합니다.");
    cfg.scheduleTime = "10:30";
  }

  console.log("\n[2/3] 견적문의 댓글");
  cfg.inquiry = { enabled: true, secret: true, reply: "" };
  cfg.inquiry.enabled = yes(await ask("  견적문의 댓글에 안내 문구로 답글을 달까요? (y/n)", oldI.enabled === false ? "n" : "y"));
  if (cfg.inquiry.enabled) {
    cfg.inquiry.secret = yes(await ask("  비밀댓글로 등록할까요? (y/n)", oldI.secret === false ? "n" : "y"));
    const tpl = path.join(DIR, "templates", "견적문의_레몬하우스.txt");
    console.log("  안내 문구 고르기:  1) 레몬하우스 기본 문구   2) 직접 입력(한 줄, 줄바꿈은 \\n)   3) 기존/기본 유지");
    const pick = await ask("  선택", oldI.reply ? "3" : "1");
    if (pick === "1" && fs.existsSync(tpl)) {
      cfg.inquiry.reply = fs.readFileSync(tpl, "utf8").replace(/\r\n/g, "\n").trimEnd();
    } else if (pick === "2") {
      cfg.inquiry.reply = (await ask("  문구", "")).replace(/\\n/g, "\n");
    } else {
      cfg.inquiry.reply = oldI.reply || "문의주셔서 감사합니다 :D\n\n담당자와 상담 후 안내드리겠습니다.";
    }
  }
}

console.log(`\n[${ONLY_NEIGHBOR ? "1/1" : "3/3"}] 서로이웃 범위 (나중에 setup.cmd --neighbor 로 언제든 바꿀 수 있습니다)`);
const n = {};
n.enabled = yes(await ask("  서로이웃·외부 댓글 작업을 사용할까요? (y/n)", oldN.enabled === false ? "n" : "y"));
if (n.enabled) {
  console.log("  신청 방식:  1) 서로이웃(상대가 수락해야 맺어짐)   2) 이웃추가(내가 일방적으로 구독)");
  n.mode = (await ask("  선택", oldN.mode === "follow" ? "2" : "1")) === "2" ? "follow" : "mutual";
  n.keywords = list(
    await ask("  검색 키워드 — 이 키워드로 최근 글을 쓴 블로거를 찾습니다 (쉼표로 구분)", (oldN.keywords || []).join(", "))
  );
  if (!n.keywords.length) {
    console.log("  → 키워드가 비어 있어 서로이웃 작업을 끕니다.");
    n.enabled = false;
  }
  n.topicHint = await ask("  어떤 글만 대상으로 할까요? (예: 인테리어·리모델링 관련 글만, 비우면 전체)", oldN.topicHint || "");
  n.excludeKeywords = list(
    await ask("  제외할 단어 (예: 자동차, 광고 — 쉼표로 구분, 비워도 됨)", (oldN.excludeKeywords || []).join(", "))
  );
  n.maxAgeHours = num(await ask("  최근 몇 시간 안에 올라온 글만? (1~72)", oldN.maxAgeHours ?? 24), 24, 1, 72);
  n.dailyBuddyLimit = num(
    await ask("  하루 최대 신청 인원 (1~50, 처음엔 10 이하 권장)", oldN.dailyBuddyLimit ?? 10),
    10,
    1,
    50
  );
  n.dailyCommentLimit = num(
    await ask("  하루 최대 외부 댓글 수 (1~50, 처음엔 10 이하 권장)", oldN.dailyCommentLimit ?? 10),
    10,
    1,
    50
  );
  if (n.dailyBuddyLimit > 20 || n.dailyCommentLimit > 20) {
    console.log("  ⚠️ 하루 20을 넘으면 네이버 보호조치가 걸릴 수 있습니다.");
  }
} else {
  Object.assign(n, {
    mode: oldN.mode || "mutual",
    keywords: oldN.keywords || [],
    topicHint: oldN.topicHint || "",
    excludeKeywords: oldN.excludeKeywords || [],
    maxAgeHours: oldN.maxAgeHours ?? 24,
    dailyBuddyLimit: oldN.dailyBuddyLimit ?? 10,
    dailyCommentLimit: oldN.dailyCommentLimit ?? 10,
  });
}
cfg.neighbor = n;

if (!ONLY_NEIGHBOR) {
  cfg.approvalMode = old.approvalMode ?? true;
  if (!old.approvalUntil) {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    cfg.approvalUntil = ymd(d);
  }
  cfg.notify = old.notify ?? process.platform === "win32";
}

// ── 저장 ──
const order = [
  "blogId",
  "blogNickname",
  "brandName",
  "profileId",
  "scheduleTime",
  "approvalMode",
  "approvalUntil",
  "notify",
  "inquiry",
  "neighbor",
];
const out = {};
for (const k of order) if (cfg[k] !== undefined) out[k] = cfg[k];
fs.writeFileSync(CONFIG, JSON.stringify(out, null, 2) + "\n", "utf8");
if (!fs.existsSync(HISTORY)) {
  fs.writeFileSync(
    HISTORY,
    JSON.stringify({ runs: [], repliedComments: [], buddyRequests: [], externalComments: [] }, null, 2) + "\n",
    "utf8"
  );
}

// ── 프롬프트 파일 생성 ──
const abs = DIR.replace(/\\/g, "/");
const head = (extra) =>
  [
    "네이버 블로그 CS·이웃 루프를 실행한다. 모든 출력은 한국어로 쓴다.",
    "",
    `1. 먼저 \`${abs}/루프_지침.md\`를 끝까지 읽고 그 순서대로 진행한다.`,
    `2. 설정은 \`${abs}/config.json\`, 처리 기록은 \`${abs}/처리기록.json\`이다.`,
    "3. 브라우저는 ego-browser 스킬을 쓴다. 시작 전에 `ego-browser skill`을 실행해서 나온 사용법을 따른다.",
    extra,
    "",
  ].join("\n");
const scheduled = head(
  [
    "4. 오늘(KST) RSS에 새 글이 없거나 이미 처리한 글이면 한 줄만 보고하고 끝낸다.",
    '5. 로그인 계정이 블로그 주인이 아니면 아무것도 등록하지 말고 "ego lite에서 네이버 로그인 필요"라고 알리고 끝낸다. 비밀번호는 절대 입력하지 않는다.',
    "6. config.approvalMode가 true면 초안을 표로 보여주고, 사용자가 승인한 것만 등록한다.",
    "7. 캡차·보호조치·한도 메시지가 나오면 즉시 멈추고 보고한다.",
    "8. 마지막 보고는 5줄 이내로 쓴다.",
  ].join("\n")
);
const loginOnly = head(
  '4. 지침 2단계(로그인 확인)만 실행한다. 로그인이 안 되어 있으면 네이버 로그인 화면을 열고 사용자에게 넘긴다(handOff). 사용자가 직접 로그인한 뒤 "로그인 완료"라고 하면 블로그 주인 계정인지(통계·수정하기 메뉴) 확인하고 결과만 보고한다. 비밀번호는 절대 입력하지 않는다.'
);
fs.writeFileSync(path.join(DIR, "예약작업_프롬프트.txt"), scheduled, "utf8");
fs.writeFileSync(path.join(DIR, "최초로그인_프롬프트.txt"), loginOnly, "utf8");

const [hh, mm] = cfg.scheduleTime.split(":").map(Number);
console.log("\n=== 설치 완료 ===");
console.log(`- 설정: ${CONFIG}`);
console.log(
  `- 서로이웃: ${
    n.enabled
      ? `${n.mode === "follow" ? "이웃추가" : "서로이웃"} / 키워드 ${n.keywords.join(", ")} / 하루 신청 ${n.dailyBuddyLimit}명·댓글 ${n.dailyCommentLimit}개 / 최근 ${n.maxAgeHours}시간 글`
      : "사용 안 함"
  }`
);
if (!ONLY_NEIGHBOR) {
  console.log(`- 승인 모드: ${cfg.approvalMode ? `켜짐 (${cfg.approvalUntil}까지는 등록 전에 초안을 보여줍니다)` : "꺼짐"}`);
  console.log(`- 매일 ${cfg.scheduleTime} 실행 (cron: ${mm} ${hh} * * *)`);
  console.log("\n⚠️ 다음 단계 — 최초 1회, 본인이 직접 해야 합니다");
  console.log("  1) ego lite 브라우저의 해당 프로필에서 본인 네이버 계정으로 직접 로그인하세요. (비밀번호는 자동화가 입력하지 않습니다)");
  console.log("  2) Claude Code에서 최초로그인_프롬프트.txt 내용을 붙여넣어 로그인 확인을 받으세요.");
  console.log("  3) 확인되면 예약작업_프롬프트.txt 내용으로 Claude의 예약 작업을 만드세요.");
}
rl.close();
