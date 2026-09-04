import { matchHintPack, hintTreeQuestions } from "../src/lib/ved/tnved-hint-trees";

const H7 = [
  { q: "очки", pack: "optics", minSteps: 2, note: "composition after form" },
  { q: "лампочка", pack: "led", minSteps: 1 },
  { q: "hdmi кабель", pack: "power", minSteps: 1 },
  { q: "бижутерия", pack: "jewelry", minSteps: 2, note: "7117 fork" },
];

let pass = 0;
for (const row of H7) {
  const pack = matchHintPack(row.q)?.id ?? null;
  const steps = hintTreeQuestions(row.q).length;
  const ok = pack === row.pack && steps >= row.minSteps;
  console.log(
    `${ok ? "PASS" : "FAIL"}\t${row.q}\tpack=${pack ?? "null"} steps=${steps} (want ${row.pack}≥${row.minSteps})${row.note ? " · " + row.note : ""}`,
  );
  if (ok) pass++;
}
console.log(`H7_OFFLINE ${pass}/${H7.length}`);
process.exit(pass === H7.length ? 0 : 1);
