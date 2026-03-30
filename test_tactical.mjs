import { 
    getAgent, 
    buildTacticalContext, 
    calculatePerformanceScore, 
    normalize,
    getValidSites,
    getMapCallouts
} from './lib/tactical_knowledge.js';

console.log("--- STARTING VALIDATION ---");

// 1. Case-Insensitive Agent Lookup
const jett1 = getAgent("Jett");
const jett2 = getAgent("jett");
const jett3 = getAgent("JETT");

if (jett1 && jett1.name === "Jett" && jett1 === jett2 && jett1 === jett3) {
    console.log("✅ Case-insensitive agent lookup working.");
} else {
    console.error("❌ Case-insensitive agent lookup FAILED.");
}

// 2. Custom Agent Lookup
const waylay = getAgent("Waylay");
if (waylay && waylay.source === "custom") {
    console.log("✅ Custom agent (Waylay) found.");
} else {
    console.error("❌ Custom agent lookup FAILED.");
}

// 3. Build Tactical Context
const context = buildTacticalContext({ map: "Ascent", agent: "Sova" });
if (context && context.map.name === "Ascent" && context.agent.name === "Sova") {
    console.log("✅ buildTacticalContext working.");
    // console.log(JSON.stringify(context, null, 2));
} else {
    console.error("❌ buildTacticalContext FAILED.");
}

// 4. Performance Calculation
const stats = { adr: 150, fb: 3, kd: 1.2, kast: 75 };
const score = calculatePerformanceScore(stats, "duelista");
if (score > 0) {
    console.log(`✅ Performance score calculated: ${score}`);
} else {
    console.error("❌ Performance score calculation FAILED.");
}

// 5. Map Sites & Callouts
const sites = getValidSites("Bind");
const callouts = getMapCallouts("Bind");
if (sites.length === 2 && callouts.includes("Hookah")) {
    console.log("✅ Map sites and callouts working.");
} else {
    console.error("❌ Map sites/callouts FAILED.");
}

console.log("--- VALIDATION COMPLETE ---");
