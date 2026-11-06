// Two small features. The page works fully without this script.
// 1. Marks which timeline step is in view.
// 2. Runs the "train a tiny model" demo: a word-counting classifier.

(function () {
  "use strict";
  document.documentElement.classList.add("js");

  var steps = Array.prototype.slice.call(document.querySelectorAll(".timeline a"));
  var sections = steps.map(function (a) {
    return document.querySelector(a.getAttribute("href"));
  });
  if (!steps.length) return;

  var ticking = false;

  function update() {
    ticking = false;
    var line = window.innerHeight * 0.35;
    var current = 0;
    sections.forEach(function (s, i) {
      if (s && s.getBoundingClientRect().top <= line) current = i;
    });
    // Past the last step (sources, notes): keep the final step marked as done.
    var sourcesEl = document.getElementById("sources");
    var pastSteps = sourcesEl && sourcesEl.getBoundingClientRect().top <= line;

    steps.forEach(function (a, i) {
      var done = i < current || (pastSteps && i === current);
      var now = i === current && !pastSteps;
      a.classList.toggle("done", done);
      a.classList.toggle("now", now);
      if (now) a.setAttribute("aria-current", "step");
      else a.removeAttribute("aria-current");
    });
  }

  function onScroll() {
    if (!ticking) {
      ticking = true;
      window.requestAnimationFrame(update);
    }
  }

  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll);
  update();
})();

(function () {
  "use strict";
  var demo = document.getElementById("demo");
  if (!demo) return;

  // --- The model: naive Bayes over words, with add-one smoothing. ---
  function tokens(s) {
    return String(s).toLowerCase().match(/[a-z']+/g) || [];
  }
  function train(rows) {
    var m = { cnt: { spam: {}, ham: {} }, tot: { spam: 0, ham: 0 }, n: { spam: 0, ham: 0 }, vocab: {} };
    rows.forEach(function (r) {
      m.n[r.label]++;
      tokens(r.text).forEach(function (w) {
        m.cnt[r.label][w] = (m.cnt[r.label][w] || 0) + 1;
        m.tot[r.label]++;
        m.vocab[w] = 1;
      });
    });
    m.size = Object.keys(m.vocab).length;
    return m;
  }
  function logp(m, c, w) {
    return Math.log(((m.cnt[c][w] || 0) + 1) / (m.tot[c] + m.size));
  }
  function lean(m, w) {
    return logp(m, "spam", w) - logp(m, "ham", w);
  }
  function guess(m, text) {
    var total = m.n.spam + m.n.ham;
    var ls = Math.log((m.n.spam + 1) / (total + 2));
    var lh = Math.log((m.n.ham + 1) / (total + 2));
    var seen = {}, known = 0;
    tokens(text).forEach(function (w) {
      if (seen[w] || !m.vocab[w]) return;
      seen[w] = 1;
      known++;
      ls += logp(m, "spam", w);
      lh += logp(m, "ham", w);
    });
    return { pSpam: 1 / (1 + Math.exp(lh - ls)), known: known };
  }
  function topWords(m, sign, count) {
    return Object.keys(m.vocab)
      .map(function (w) { return { w: w, d: lean(m, w) }; })
      .filter(function (x) { return sign > 0 ? x.d > 0.3 : x.d < -0.3; })
      .sort(function (a, b) { return sign > 0 ? b.d - a.d : a.d - b.d; })
      .slice(0, count)
      .map(function (x) { return x.w; });
  }

  // --- The demo content. ---
  var TRAIN = [
    ["Win a free prize now", true],
    ["Lunch tomorrow at 1pm?", false],
    ["Claim your free gift today", true],
    ["Invoice attached for last month", false],
    ["Urgent: verify your account now", true],
    ["Meeting notes attached", false]
  ];
  var TESTS = ["Claim your free prize", "Notes attached for lunch", "Free lunch tomorrow?"];

  var mails = document.getElementById("mails");
  var learned = document.getElementById("learned");
  var guesses = document.getElementById("guesses");
  var boxes = [];

  TRAIN.forEach(function (t, i) {
    var li = document.createElement("li");
    var label = document.createElement("label");
    var box = document.createElement("input");
    box.type = "checkbox";
    box.id = "mail" + i;
    box.checked = t[1];
    box.addEventListener("change", render);
    label.appendChild(box);
    label.appendChild(document.createTextNode(t[0]));
    li.appendChild(label);
    mails.appendChild(li);
    boxes.push(box);
  });

  function render() {
    var model = train(TRAIN.map(function (t, i) {
      return { text: t[0], label: boxes[i].checked ? "spam" : "ham" };
    }));

    var sp = topWords(model, 1, 3), hm = topWords(model, -1, 3);
    learned.textContent = "Spam words: " + (sp.join(", ") || "none") +
      ". Not-spam words: " + (hm.join(", ") || "none") + ".";

    guesses.textContent = "";
    TESTS.forEach(function (t) {
      var g = guess(model, t);
      var isSpam = g.pSpam >= 0.5;
      var conf = isSpam ? g.pSpam : 1 - g.pSpam;
      var verdict = conf < 0.6 || g.known === 0
        ? "Unsure"
        : (isSpam ? "Spam" : "Not spam") + " · " + Math.round(conf * 100) + "%";
      var li = document.createElement("li");
      var text = document.createElement("span");
      text.textContent = t;
      var v = document.createElement("strong");
      v.className = "verdict";
      v.textContent = verdict;
      li.appendChild(text);
      li.appendChild(v);
      guesses.appendChild(li);
    });
  }

  render();
  demo.hidden = false;
})();
